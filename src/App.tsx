import { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Download, FileJson, History, LayoutDashboard, Moon, PanelRight, Plus, RefreshCw, Save, Settings2, SlidersHorizontal, Sun, Trash2, Upload, X, Zap } from 'lucide-react';
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DailyPlanInput, DailyReviewExport, LifeOSData, PlanRecord, ReviewRecord, TaskRecord, TaskStatus } from './types';
import { REVIEW_STATUS_LABELS, STATUS_LABELS } from './types';
import { formatDate, formatDateShort, generateId, timeToMinutes, todayIso } from './lib/date';
import { backupToJson, createTask, deleteTask, loadData, reviewToJson, savePlan, saveReview, updateTask } from './lib/storage';
import { parseDailyPlan } from './validation/schemas';

type View = 'today' | 'import' | 'history';
const QUICK_PANEL_MODE = new URLSearchParams(window.location.search).get('panel') === 'quick';

const SAMPLE_PLAN = `{
  "schema_version": "1.0",
  "type": "daily_plan",
  "plan_id": "demo-2026-10-09",
  "date": "${todayIso()}",
  "title": "专注工作日",
  "tasks": [
    { "id": "focus-01", "title": "深度工作：LifeOS MVP", "description": "完成一个可交付的小闭环", "start_time": "13:00", "end_time": "14:30", "category": "创造" },
    { "id": "walk-01", "title": "散步与整理思路", "start_time": "14:45", "end_time": "15:15", "category": "恢复" },
    { "id": "review-01", "title": "整理今日输出", "start_time": "15:30", "end_time": "16:30", "category": "收尾" }
  ]
}`;

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [view, setView] = useState<View>('today');
  const [data, setData] = useState<LifeOSData>({ plans: [], tasks: [], reviews: [] });
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [dark, setDark] = useState(() => localStorage.getItem('lifeos.theme') !== 'light');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setBusy(true);
    try { setData(await loadData()); setError(''); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('lifeos.theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer); } }, [notice]);

  const plansForDate = data.plans.filter((plan) => plan.date === selectedDate).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activePlan = plansForDate[0];
  const activeTasks = activePlan ? data.tasks.filter((task) => task.planId === activePlan.id).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder) : [];
  const activeReview = data.reviews.find((review) => review.date === selectedDate);

  const run = async (operation: () => Promise<void>, successMessage?: string) => {
    setError('');
    try { await operation(); await refresh(); if (successMessage) setNotice(successMessage); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} onToday={() => { setSelectedDate(todayIso()); setView('today'); }} />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>LifeOS</span><ChevronRight size={15} /><strong>{view === 'today' ? '今日' : view === 'import' ? '导入计划' : '历史记录'}</strong></div>
          <div className="top-actions">
            <button className="icon-button" title="打开桌面便栏" onClick={() => void openQuickPanel()}><PanelRight size={18} /></button>
            <button className="icon-button" title={dark ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button" title="重新读取本地数据" onClick={() => void refresh()}><RefreshCw size={18} /></button>
          </div>
        </header>
        {error && <div className="alert error"><X size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="alert success"><Check size={18} /><span>{notice}</span></div>}
        {busy ? <Loading /> : view === 'today' ? <TodayView date={selectedDate} setDate={setSelectedDate} plan={activePlan} tasks={activeTasks} review={activeReview} data={data} run={run} onImport={() => setView('import')} /> : view === 'import' ? <ImportView existingPlans={data.plans} onImported={(date) => { setSelectedDate(date); setView('today'); }} run={run} /> : <HistoryView data={data} onSelectDate={(date) => { setSelectedDate(date); setView('today'); }} />}
      </main>
    </div>
  );
}

function Sidebar({ view, setView, onToday }: { view: View; setView: (view: View) => void; onToday: () => void }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor" /></div><div><div className="brand-name">LifeOS</div><div className="brand-subtitle">offline first</div></div></div>
    <nav className="nav-list">
      <button className={view === 'today' ? 'nav-item active' : 'nav-item'} onClick={onToday}><LayoutDashboard size={18} /><span>今日</span><span className="nav-key">⌘1</span></button>
      <button className={view === 'import' ? 'nav-item active' : 'nav-item'} onClick={() => setView('import')}><Upload size={18} /><span>导入计划</span><span className="nav-key">⌘2</span></button>
      <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setView('history')}><History size={18} /><span>历史记录</span></button>
    </nav>
    <div className="sidebar-bottom"><div className="local-badge"><span className="status-dot" />数据只保存在本机</div><div className="version">LifeOS v0.1 MVP</div></div>
  </aside>;
}

function Loading() { return <div className="loading-state"><RefreshCw className="spin" size={24} /><span>正在读取本地数据…</span></div>; }

function TodayView({ date, setDate, plan, tasks, review, data, run, onImport }: { date: string; setDate: (date: string) => void; plan?: PlanRecord; tasks: TaskRecord[]; review?: ReviewRecord; data: LifeOSData; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void>; onImport: () => void }) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const currentTask = tasks.find((task) => task.status !== 'completed' && task.status !== 'skipped' && timeToMinutes(task.startTime) <= currentClockMinutes() && currentClockMinutes() < timeToMinutes(task.endTime));
  const nextTask = tasks.find((task) => task.status !== 'completed' && task.status !== 'skipped' && timeToMinutes(task.startTime) > currentClockMinutes());
  const isToday = date === todayIso();

  return <div className="page today-page">
    <div className="page-heading">
      <div><div className="eyebrow">{isToday ? 'TODAY' : 'SAVED DAY'}</div><h1>{formatDate(date)}</h1><p className="muted">{plan ? plan.title : '还没有导入这一天的计划'}</p></div>
      <div className="date-control"><button className="icon-button" onClick={() => setDate(shiftDate(date, -1))}>‹</button><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="icon-button" onClick={() => setDate(shiftDate(date, 1))}>›</button></div>
    </div>
    <section className="hero-grid">
      <div className="progress-card card"><div className="card-label">今日进度</div><div className="progress-main"><strong>{percent}%</strong><span>{completed} / {tasks.length} 个任务</span></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-foot"><span>{percent >= 100 ? '今天的计划完成了。' : '保持节奏，完成下一个小步骤。'}</span><span>{nextTask ? `下一项 ${nextTask.startTime}` : ''}</span></div></div>
      <div className="current-card card">{currentTask ? <><div className="card-label"><span className="live-dot" />当前任务</div><h2>{currentTask.title}</h2><div className="task-time"><Clock3 size={16} />{currentTask.startTime} — {currentTask.endTime}</div><button className="primary-button compact" onClick={() => void run(() => updateTask({ ...currentTask, status: 'completed' }), '任务已完成') }><Check size={16} />完成打卡</button></> : <><div className="card-label">当前任务</div><div className="empty-current"><Clock3 size={28} /><div><strong>{isToday ? '现在没有进行中的任务' : '这一天没有进行中的任务'}</strong><span>{nextTask ? `下一个任务 ${nextTask.startTime} 开始` : '可以从下方选择一个任务开始'}</span></div></div></>}</div>
    </section>
    <div className="section-heading"><div><h2>今日时间轴</h2><p className="muted">13:00 — 17:00 · 点击任务可修改时间和状态</p></div>{plan && <span className="plan-version">版本 {new Date(plan.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
    {plan ? <Timeline plan={plan} tasks={tasks} run={run} /> : <EmptyPlan onImport={onImport} />}
    <ReviewSection date={date} tasks={tasks} review={review} run={run} />
    {data.plans.filter((item) => item.date === date).length > 1 && <div className="info-note"><Archive size={17} /><span>这一天有多个导入版本，当前显示最新版本；旧版本和执行记录保留在历史记录中。</span></div>}
  </div>;
}

function Timeline({ plan, tasks, run }: { plan: PlanRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  return <div className="timeline-wrap card"><div className="timeline-grid"><div className="time-ruler">{['13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => <span key={time}>{time}</span>)}</div><div className="timeline-body"><div className="ruler-line" />{tasks.length === 0 && <div className="timeline-empty">这个计划暂时没有任务。</div>}{tasks.map((task) => <TaskRow key={task.id} task={task} tasks={tasks} run={run} />)}</div></div><button className="add-task-button" onClick={() => setShowAdd((value) => !value)}>{showAdd ? <X size={17} /> : <Plus size={17} />} {showAdd ? '取消' : '添加任务'}</button>{showAdd && <AddTaskForm plan={plan} tasks={tasks} run={run} onDone={() => setShowAdd(false)} />}</div>;
}

function TaskRow({ task, tasks, run }: { task: TaskRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(task.startTime);
  const [end, setEnd] = useState(task.endTime);
  const statusClass = task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'in-progress' : '';
  const top = Math.max(0, ((timeToMinutes(task.startTime) - 13 * 60) / 240) * 100);
  const height = Math.max(9, ((timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) / 240) * 100);
  const saveTime = () => void run(async () => { await updateTask({ ...task, startTime: start, endTime: end }); setEditing(false); }, '任务时间已更新');
  return <div className={`task-row ${statusClass}`} style={{ top: `${top}%`, minHeight: `${height}%` }}><div className="task-line"><button className={`check-button ${task.status === 'completed' ? 'checked' : ''}`} title="切换完成状态" onClick={() => void run(() => updateTask({ ...task, status: task.status === 'completed' ? 'planned' : 'completed' }), task.status === 'completed' ? '已恢复为待开始' : '任务已完成')}>{task.status === 'completed' && <Check size={14} />}</button><div className="task-content"><div className="task-title-line"><strong>{task.title}</strong>{task.category && <span className="category-chip">{task.category}</span>}</div>{task.description && <p>{task.description}</p>}<div className="task-meta"><Clock3 size={13} />{task.startTime} — {task.endTime}<span className="task-id">#{task.id}</span></div></div><select className="status-select" value={task.status} onChange={(event) => void run(() => updateTask({ ...task, status: event.target.value as TaskStatus }), '任务状态已更新')}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="ghost-icon" title="修改时间" onClick={() => setEditing((value) => !value)}><Settings2 size={16} /></button><button className="ghost-icon danger-icon" title="删除任务" onClick={() => { if (window.confirm(`删除任务「${task.title}」？`)) void run(() => deleteTask(task.id), '任务已删除'); }}><Trash2 size={16} /></button></div>{editing && <div className="inline-editor"><label>开始<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>结束<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label><button className="primary-button compact" onClick={saveTime}><Save size={15} />保存</button></div>}</div>;
}

function AddTaskForm({ plan, tasks, run, onDone }: { plan: PlanRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void>; onDone: () => void }) {
  const [title, setTitle] = useState(''); const [startTime, setStartTime] = useState('16:30'); const [endTime, setEndTime] = useState('17:00'); const [category, setCategory] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; void run(async () => { await createTask({ id: generateId('task'), planId: plan.id, date: plan.date, title: title.trim(), description: '', startTime, endTime, category: category.trim(), status: 'planned', sortOrder: tasks.length }); onDone(); }, '任务已添加'); };
  return <form className="add-task-form" onSubmit={submit}><input autoFocus placeholder="任务名称" value={title} onChange={(event) => setTitle(event.target.value)} /><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /><span>—</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /><input placeholder="分类（可选）" value={category} onChange={(event) => setCategory(event.target.value)} /><button className="primary-button compact" type="submit"><Plus size={15} />添加</button></form>;
}

function EmptyPlan({ onImport }: { onImport: () => void }) { return <div className="empty-state card"><div className="empty-icon"><CalendarDays size={28} /></div><h3>还没有今天的计划</h3><p>从外部 AI 复制一份 LifeOS JSON v1 日程，导入后就能开始执行。</p><button className="primary-button" onClick={onImport}><Upload size={17} />去导入计划</button></div>; }

function ReviewSection({ date, tasks, review, run }: { date: string; tasks: TaskRecord[]; review?: ReviewRecord; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const initial = reviewToJson(review, date, tasks); const [form, setForm] = useState<DailyReviewExport>(initial);
  useEffect(() => { setForm(initial); }, [date, review?.updatedAt, tasks.map((task) => `${task.id}:${task.status}`).join('|')]);
  const set = <K extends keyof DailyReviewExport>(key: K, value: DailyReviewExport[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => saveReview(form), '今日复盘已保存'); };
  return <section className="review-section"><div className="section-heading"><div><h2>每日复盘</h2><p className="muted">把执行结果反馈给明天的自己，也可以直接导出给外部 AI。</p></div><button className="secondary-button" onClick={() => downloadJson(`lifeos-review-${date}.json`, form)}><Download size={16} />导出复盘 JSON</button></div><form className="review-card card" onSubmit={submit}><div className="review-grid"><label>完成情况<select value={form.completion_status} onChange={(event) => set('completion_status', event.target.value as DailyReviewExport['completion_status'])}>{Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><RatingField label="效率" value={form.efficiency} onChange={(value) => set('efficiency', value)} /><RatingField label="自主性" value={form.autonomy} onChange={(value) => set('autonomy', value)} /></div><div className="review-text-grid"><TextArea label="认知收获" value={form.cognitive_gains} onChange={(value) => set('cognitive_gains', value)} placeholder="今天理解了什么？" /><TextArea label="探索经历" value={form.exploration} onChange={(value) => set('exploration', value)} placeholder="有没有尝试新方法或接触新东西？" /><TextArea wide label="文字反思" value={form.reflection} onChange={(value) => set('reflection', value)} placeholder="今天哪些安排有效？明天需要调整什么？" /></div><div className="review-footer"><span className="muted"><CircleHelp size={15} />数据保存在本机 SQLite 中</span><button className="primary-button" type="submit"><Save size={17} />保存复盘</button></div></form></section>;
}

function RatingField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <fieldset className="rating-field"><legend>{label}</legend><div>{[1, 2, 3, 4, 5].map((item) => <button key={item} type="button" className={value === item ? 'rating selected' : 'rating'} onClick={() => onChange(value === item ? null : item)}>{item}</button>)}</div><small>1 低 · 5 高</small></fieldset>; }
function TextArea({ label, value, onChange, placeholder, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; wide?: boolean }) { return <label className={wide ? 'textarea-label wide' : 'textarea-label'}>{label}<textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }

function ImportView({ existingPlans, onImported, run }: { existingPlans: PlanRecord[]; onImported: (date: string) => void; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [parseError, setParseError] = useState(''); const [parsed, setParsed] = useState<DailyPlanInput | null>(null); const [showPreview, setShowPreview] = useState(false);
  const handleText = (value: string) => { setText(value); setParsed(null); setParseError(''); };
  const validate = () => { const result = parseDailyPlan(text); if (!result.success) { setParseError(result.error); setParsed(null); return; } setParseError(''); setParsed(result.data); setShowPreview(true); };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => handleText(String(reader.result ?? '')); reader.onerror = () => setParseError('文件读取失败。'); reader.readAsText(file); };
  const sameDay = parsed ? existingPlans.filter((plan) => plan.date === parsed.date) : [];
  return <div className="page import-page"><div className="page-heading"><div><div className="eyebrow">INPUT</div><h1>导入每日计划</h1><p className="muted">接收外部 AI 输出的标准化 JSON，在本地预览后保存。</p></div><div className="protocol-pill"><FileJson size={17} />LifeOS JSON v1</div></div><div className="import-grid"><section className="import-editor card"><div className="card-header"><div><h2>粘贴计划 JSON</h2><p className="muted">支持 schema_version 1.0 的 daily_plan</p></div><label className="secondary-button file-button"><Upload size={16} />选择文件<input type="file" accept="application/json,.json" onChange={onFile} /></label></div><textarea className="json-input" value={text} onChange={(event) => handleText(event.target.value)} placeholder="在这里粘贴 JSON…" spellCheck={false} /><div className="editor-actions"><button className="ghost-button" onClick={() => handleText(SAMPLE_PLAN)}>填入虚构示例</button><button className="primary-button" onClick={validate} disabled={!text.trim()}><Check size={17} />验证并预览</button></div>{parseError && <div className="parse-error"><X size={17} /><pre>{parseError}</pre></div>}</section><section className="protocol-card card"><div className="card-label">导入规则</div><Rule icon={<Check size={16} />} text="严格验证 LifeOS JSON v1" /><Rule icon={<Archive size={16} />} text="每次导入创建新版本" /><Rule icon={<History size={16} />} text="历史执行记录不会被覆盖" /><Rule icon={<CircleHelp size={16} />} text="任务 ID 必须全局唯一" /><div className="schema-hint">建议让外部 AI 生成如下字段：<code>plan_id · date · tasks[].start_time · tasks[].end_time</code></div></section></div>{showPreview && parsed && <ImportPreview plan={parsed} existingCount={sameDay.length} onCancel={() => setShowPreview(false)} onConfirm={() => void run(async () => { await savePlan(parsed); setShowPreview(false); onImported(parsed.date); }, '计划已导入')} />}</div>;
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) { return <div className="rule"><span>{icon}</span>{text}</div>; }
function ImportPreview({ plan, existingCount, onCancel, onConfirm }: { plan: DailyPlanInput; existingCount: number; onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop"><div className="preview-modal card"><div className="modal-header"><div><div className="eyebrow">PREVIEW</div><h2>确认导入这份计划？</h2></div><button className="icon-button" onClick={onCancel}><X size={18} /></button></div><div className="preview-summary"><div><span>日期</span><strong>{formatDateShort(plan.date)}</strong></div><div><span>任务</span><strong>{plan.tasks.length} 项</strong></div><div><span>版本</span><strong>{plan.plan_id}</strong></div></div>{existingCount > 0 && <div className="warning-note"><Archive size={18} /><span>这一天已有 {existingCount} 个计划版本。确认后会创建新版本，旧版本及执行历史会保留。</span></div>}<div className="preview-list">{plan.tasks.map((task) => <div className="preview-task" key={task.id}><div><strong>{task.title}</strong><span>{task.category || '未分类'} · #{task.id}</span></div><time>{task.start_time} — {task.end_time}</time></div>)}</div><div className="modal-actions"><button className="secondary-button" onClick={onCancel}>返回修改</button><button className="primary-button" onClick={onConfirm}><Download size={16} />确认并保存</button></div></div></div>; }

function HistoryView({ data, onSelectDate }: { data: LifeOSData; onSelectDate: (date: string) => void }) {
  const dates = Array.from(new Set([...data.plans.map((plan) => plan.date), ...data.reviews.map((review) => review.date)])).sort((a, b) => b.localeCompare(a));
  return <div className="page history-page"><div className="page-heading"><div><div className="eyebrow">ARCHIVE</div><h1>历史记录</h1><p className="muted">以前的计划和复盘都保存在本机，可随时回看。</p></div><button className="secondary-button" onClick={() => downloadJson(`lifeos-backup-${todayIso()}.json`, backupToJson(data))}><Download size={16} />备份全部数据</button></div>{dates.length === 0 ? <div className="empty-state card"><div className="empty-icon"><History size={28} /></div><h3>还没有历史记录</h3><p>导入第一份计划后，它会出现在这里。</p></div> : <div className="history-list">{dates.map((date) => { const plans = data.plans.filter((plan) => plan.date === date); const review = data.reviews.find((item) => item.date === date); const latest = plans[0]; const tasks = latest ? data.tasks.filter((task) => task.planId === latest.id) : []; const complete = tasks.filter((task) => task.status === 'completed').length; return <button className="history-card card" key={date} onClick={() => onSelectDate(date)}><div className="history-date"><span>{formatDateShort(date)}</span><strong>{new Date(`${date}T12:00:00`).getFullYear()}</strong></div><div className="history-main"><strong>{latest?.title || '只有复盘记录'}</strong><span>{plans.length} 个计划版本 · {complete}/{tasks.length} 完成{review ? ` · ${REVIEW_STATUS_LABELS[review.completionStatus]}` : ' · 未填写复盘'}</span></div><ChevronRight size={18} /></button>; })}</div>}</div>;
}

function currentClockMinutes(): number { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); }
function shiftDate(value: string, days: number): string { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

async function openQuickPanel(): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    window.alert('桌面便栏需要在 LifeOS Windows 桌面版中使用。');
    return;
  }
  const existing = await WebviewWindow.getByLabel('quick-panel');
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }
  const panel = new WebviewWindow('quick-panel', {
    url: 'index.html?panel=quick',
    title: 'LifeOS 快捷便栏',
    width: 360,
    height: 540,
    minWidth: 300,
    minHeight: 380,
    decorations: false,
    transparent: true,
    backgroundColor: [0, 0, 0, 0],
    noRedirectionBitmap: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    shadow: false,
    center: true,
  });
  panel.once('tauri://error', (event) => console.error('LifeOS quick panel failed to open', event));
}

function QuickPanel() {
  const [data, setData] = useState<LifeOSData>({ plans: [], tasks: [], reviews: [] });
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('lifeos.quick-panel.opacity') ?? '0.94'));
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>(() => (localStorage.getItem('lifeos.quick-panel.font-size') as 'small' | 'normal' | 'large') ?? 'normal');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const appWindow = getCurrentWindow();
  const date = todayIso();

  const refresh = async () => {
    try { setData(await loadData()); setError(''); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };

  useEffect(() => {
    document.body.classList.add('quick-mode');
    document.documentElement.classList.add('quick-root');
    document.documentElement.dataset.theme = localStorage.getItem('lifeos.theme') === 'light' ? 'light' : 'dark';
    void appWindow.setAlwaysOnTop(true);
    void appWindow.setBackgroundColor([0, 0, 0, 0]);
    void refresh();
    return () => { document.body.classList.remove('quick-mode'); document.documentElement.classList.remove('quick-root'); };
  }, []);

  useEffect(() => { localStorage.setItem('lifeos.quick-panel.opacity', String(opacity)); }, [opacity]);
  useEffect(() => { localStorage.setItem('lifeos.quick-panel.font-size', fontSize); }, [fontSize]);

  const plans = data.plans.filter((plan) => plan.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const plan = plans[0];
  const tasks = plan ? data.tasks.filter((task) => task.planId === plan.id).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  const completed = tasks.filter((task) => task.status === 'completed').length;

  const toggleTask = async (task: TaskRecord) => {
    try { await updateTask({ ...task, status: task.status === 'completed' ? 'planned' : 'completed' }); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const beginDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input')) return;
    void appWindow.startDragging();
  };

  const beginResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void appWindow.startResizeDragging('SouthEast');
  };

  return <div className={`quick-shell quick-font-${fontSize}`} style={{ '--panel-alpha': opacity } as CSSProperties}>
    <header className="quick-header" onMouseDown={beginDrag}>
      <div className="quick-brand"><div className="brand-mark"><Zap size={16} fill="currentColor" /></div><div><strong>LifeOS</strong><span>桌面便栏</span></div></div>
      <div className="quick-header-actions"><button className={controlsOpen ? 'quick-control-toggle open' : 'quick-control-toggle'} title="便栏设置" onClick={() => setControlsOpen((value) => !value)}><SlidersHorizontal size={16} /></button><button className="quick-close" title="关闭便栏" onClick={() => void appWindow.close()}><X size={17} /></button></div>
    </header>
    {controlsOpen && <div className="quick-controls"><div className="quick-setting"><strong>透明度</strong><span>只调整背景，不影响文字</span></div><label className="quick-opacity-control"><input type="range" min="0.55" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /><b>{Math.round(opacity * 100)}%</b></label><div className="quick-setting font-setting"><strong>字体大小</strong><span>英文：Consolas</span></div><div className="quick-font-buttons">{(['small', 'normal', 'large'] as const).map((size) => <button key={size} className={fontSize === size ? 'selected' : ''} onClick={() => setFontSize(size)}>{size === 'small' ? '小' : size === 'large' ? '大' : '标准'}</button>)}</div></div>}
    <main className="quick-content">
      <div className="quick-date"><div><span>今天</span><strong>{formatDateShort(date)}</strong></div><span className="quick-count">{completed}/{tasks.length} 完成</span></div>
      {error && <div className="quick-error">{error}</div>}
      {busy ? <div className="quick-empty">正在读取本地任务…</div> : tasks.length === 0 ? <div className="quick-empty"><CalendarDays size={24} /><span>今天还没有计划</span><small>打开 LifeOS 导入一份日程</small></div> : <div className="quick-tasks">{tasks.map((task) => <button className={task.status === 'completed' ? 'quick-task done' : 'quick-task'} key={task.id} onClick={() => void toggleTask(task)}><span className="quick-check">{task.status === 'completed' && <Check size={12} />}</span><span className="quick-task-copy"><strong>{task.title}</strong><small>{task.startTime} — {task.endTime}{task.category ? ` · ${task.category}` : ''}</small></span></button>)}</div>}
      <button className="quick-refresh" onClick={() => void refresh()}><RefreshCw size={14} />刷新任务</button>
    </main>
    <button className="quick-resize-grip" title="调整便栏大小" aria-label="调整便栏大小" onMouseDown={beginResize} />
  </div>;
}

export default QUICK_PANEL_MODE ? QuickPanel : App;
