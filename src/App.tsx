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
import { localizeError, useI18n } from './i18n';

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

const SAMPLE_PLAN_EN = `{
  "schema_version": "1.0",
  "type": "daily_plan",
  "plan_id": "demo-2026-10-09-en",
  "date": "${todayIso()}",
  "title": "Focused workday",
  "tasks": [
    { "id": "focus-01", "title": "Deep work: LifeOS MVP", "description": "Finish one small, shippable loop", "start_time": "13:00", "end_time": "14:30", "category": "Create" },
    { "id": "walk-01", "title": "Walk and clear your mind", "start_time": "14:45", "end_time": "15:15", "category": "Recover" },
    { "id": "review-01", "title": "Organize today's output", "start_time": "15:30", "end_time": "16:30", "category": "Wrap up" }
  ]
}`;

const TASK_STATUS_KEYS: Record<TaskStatus, string> = {
  planned: 'statusPlanned',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  skipped: 'statusSkipped',
  cancelled: 'statusCancelled',
};

const REVIEW_STATUS_KEYS: Record<keyof typeof REVIEW_STATUS_LABELS, string> = {
  completed: 'completedWell',
  partial: 'partial',
  not_started: 'notStarted',
};

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
  const { language, t, toggleLanguage } = useI18n();
  const [view, setView] = useState<View>('today');
  const [data, setData] = useState<LifeOSData>({ plans: [], tasks: [], reviews: [] });
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [dark, setDark] = useState(() => localStorage.getItem('lifeos.theme') !== 'light');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setBusy(true);
    try { setData(await loadData()); setError(''); } catch (err) { setError(localizeError(err instanceof Error ? err.message : String(err), language)); } finally { setBusy(false); }
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
    try { await operation(); await refresh(); if (successMessage) setNotice(successMessage); } catch (err) { setError(localizeError(err instanceof Error ? err.message : String(err), language)); }
  };

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} onToday={() => { setSelectedDate(todayIso()); setView('today'); }} />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>LifeOS</span><ChevronRight size={15} /><strong>{view === 'today' ? t('today') : view === 'import' ? t('importPlan') : t('history')}</strong></div>
          <div className="top-actions">
            <button className="icon-button" title={t('openQuickPanel')} onClick={() => void openQuickPanel()}><PanelRight size={18} /></button>
            <button className="icon-button" title={dark ? t('lightMode') : t('darkMode')} onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button" title={t('reload')} onClick={() => void refresh()}><RefreshCw size={18} /></button>
            <button className="language-button" title={language === 'en' ? 'Switch to Chinese' : '切换到英文'} onClick={toggleLanguage}>{t('language')}</button>
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
  const { t } = useI18n();
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><Zap size={20} fill="currentColor" /></div><div><div className="brand-name">LifeOS</div><div className="brand-subtitle">offline first</div></div></div>
    <nav className="nav-list">
      <button className={view === 'today' ? 'nav-item active' : 'nav-item'} onClick={onToday}><LayoutDashboard size={18} /><span>{t('today')}</span><span className="nav-key">⌘1</span></button>
      <button className={view === 'import' ? 'nav-item active' : 'nav-item'} onClick={() => setView('import')}><Upload size={18} /><span>{t('importPlan')}</span><span className="nav-key">⌘2</span></button>
      <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setView('history')}><History size={18} /><span>{t('history')}</span></button>
    </nav>
    <div className="sidebar-bottom"><div className="local-badge"><span className="status-dot" />{t('localOnly')}</div><div className="version">LifeOS v0.1 MVP</div></div>
  </aside>;
}

function Loading() { const { t } = useI18n(); return <div className="loading-state"><RefreshCw className="spin" size={24} /><span>{t('reading')}</span></div>; }

function TodayView({ date, setDate, plan, tasks, review, data, run, onImport }: { date: string; setDate: (date: string) => void; plan?: PlanRecord; tasks: TaskRecord[]; review?: ReviewRecord; data: LifeOSData; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void>; onImport: () => void }) {
  const { language, t } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'zh-CN';
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const currentTask = tasks.find((task) => task.status !== 'completed' && task.status !== 'skipped' && timeToMinutes(task.startTime) <= currentClockMinutes() && currentClockMinutes() < timeToMinutes(task.endTime));
  const nextTask = tasks.find((task) => task.status !== 'completed' && task.status !== 'skipped' && timeToMinutes(task.startTime) > currentClockMinutes());
  const isToday = date === todayIso();

  return <div className="page today-page">
    <div className="page-heading">
      <div><div className="eyebrow">{isToday ? t('todayLabel') : t('savedDay')}</div><h1>{formatDate(date, locale)}</h1><p className="muted">{plan ? plan.title : t('noPlanForDay')}</p></div>
      <div className="date-control"><button className="icon-button" onClick={() => setDate(shiftDate(date, -1))}>‹</button><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="icon-button" onClick={() => setDate(shiftDate(date, 1))}>›</button></div>
    </div>
    <section className="hero-grid">
      <div className="progress-card card"><div className="card-label">{t('progress')}</div><div className="progress-main"><strong>{percent}%</strong><span>{t('tasksCount', { completed, total: tasks.length })}</span></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-foot"><span>{percent >= 100 ? t('planComplete') : t('keepGoing')}</span><span>{nextTask ? t('nextAt', { time: nextTask.startTime }) : ''}</span></div></div>
      <div className="current-card card">{currentTask ? <><div className="card-label"><span className="live-dot" />{t('currentTask')}</div><h2>{currentTask.title}</h2><div className="task-time"><Clock3 size={16} />{currentTask.startTime} — {currentTask.endTime}</div><button className="primary-button compact" onClick={() => void run(() => updateTask({ ...currentTask, status: 'completed' }), t('taskCompleted')) }><Check size={16} />{t('checkIn')}</button></> : <><div className="card-label">{t('currentTask')}</div><div className="empty-current"><Clock3 size={28} /><div><strong>{isToday ? t('noCurrentToday') : t('noCurrentDay')}</strong><span>{nextTask ? t('nextStarts', { time: nextTask.startTime }) : t('chooseTask')}</span></div></div></>}</div>
    </section>
    <div className="section-heading"><div><h2>{t('timeline')}</h2><p className="muted">{t('timelineHint')}</p></div>{plan && <span className="plan-version">{t('version', { time: new Date(plan.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>}</div>
    {plan ? <Timeline plan={plan} tasks={tasks} run={run} /> : <EmptyPlan onImport={onImport} />}
    <ReviewSection date={date} tasks={tasks} review={review} run={run} />
    {data.plans.filter((item) => item.date === date).length > 1 && <div className="info-note"><Archive size={17} /><span>{t('multipleVersions')}</span></div>}
  </div>;
}

function Timeline({ plan, tasks, run }: { plan: PlanRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  return <div className="timeline-wrap card"><div className="timeline-grid"><div className="time-ruler">{['13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => <span key={time}>{time}</span>)}</div><div className="timeline-body"><div className="ruler-line" />{tasks.length === 0 && <div className="timeline-empty">{t('noTasks')}</div>}{tasks.map((task) => <TaskRow key={task.id} task={task} tasks={tasks} run={run} />)}</div></div><button className="add-task-button" onClick={() => setShowAdd((value) => !value)}>{showAdd ? <X size={17} /> : <Plus size={17} />} {showAdd ? t('cancel') : t('addTask')}</button>{showAdd && <AddTaskForm plan={plan} tasks={tasks} run={run} onDone={() => setShowAdd(false)} />}</div>;
}

function TaskRow({ task, tasks, run }: { task: TaskRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(task.startTime);
  const [end, setEnd] = useState(task.endTime);
  const statusClass = task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'in-progress' : '';
  const top = Math.max(0, ((timeToMinutes(task.startTime) - 13 * 60) / 240) * 100);
  const height = Math.max(9, ((timeToMinutes(task.endTime) - timeToMinutes(task.startTime)) / 240) * 100);
  const saveTime = () => void run(async () => { await updateTask({ ...task, startTime: start, endTime: end }); setEditing(false); }, t('taskTimeUpdated'));
  return <div className={`task-row ${statusClass}`} style={{ top: `${top}%`, minHeight: `${height}%` }}><div className="task-line"><button className={`check-button ${task.status === 'completed' ? 'checked' : ''}`} title={t('changeStatus')} onClick={() => void run(() => updateTask({ ...task, status: task.status === 'completed' ? 'planned' : 'completed' }), task.status === 'completed' ? t('taskRestored') : t('taskCompleted'))}>{task.status === 'completed' && <Check size={14} />}</button><div className="task-content"><div className="task-title-line"><strong>{task.title}</strong>{task.category && <span className="category-chip">{task.category}</span>}</div>{task.description && <p>{task.description}</p>}<div className="task-meta"><Clock3 size={13} />{task.startTime} — {task.endTime}<span className="task-id">#{task.id}</span></div></div><select className="status-select" value={task.status} onChange={(event) => void run(() => updateTask({ ...task, status: event.target.value as TaskStatus }), t('taskStatusUpdated'))}>{Object.entries(STATUS_LABELS).map(([value]) => <option key={value} value={value}>{t(TASK_STATUS_KEYS[value as TaskStatus])}</option>)}</select><button className="ghost-icon" title={t('editTime')} onClick={() => setEditing((value) => !value)}><Settings2 size={16} /></button><button className="ghost-icon danger-icon" title={t('deleteTask')} onClick={() => { if (window.confirm(t('deleteConfirm', { title: task.title }))) void run(() => deleteTask(task.id), t('taskDeleted')); }}><Trash2 size={16} /></button></div>{editing && <div className="inline-editor"><label>{t('start')}<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>{t('end')}<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label><button className="primary-button compact" onClick={saveTime}><Save size={15} />{t('save')}</button></div>}</div>;
}

function AddTaskForm({ plan, tasks, run, onDone }: { plan: PlanRecord; tasks: TaskRecord[]; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(''); const [startTime, setStartTime] = useState('16:30'); const [endTime, setEndTime] = useState('17:00'); const [category, setCategory] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; void run(async () => { await createTask({ id: generateId('task'), planId: plan.id, date: plan.date, title: title.trim(), description: '', startTime, endTime, category: category.trim(), status: 'planned', sortOrder: tasks.length }); onDone(); }, t('taskAdded')); };
  return <form className="add-task-form" onSubmit={submit}><input autoFocus placeholder={t('taskName')} value={title} onChange={(event) => setTitle(event.target.value)} /><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /><span>—</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /><input placeholder={t('categoryOptional')} value={category} onChange={(event) => setCategory(event.target.value)} /><button className="primary-button compact" type="submit"><Plus size={15} />{t('addTask')}</button></form>;
}

function EmptyPlan({ onImport }: { onImport: () => void }) { const { t } = useI18n(); return <div className="empty-state card"><div className="empty-icon"><CalendarDays size={28} /></div><h3>{t('noTodayPlan')}</h3><p>{t('noTodayPlanBody')}</p><button className="primary-button" onClick={onImport}><Upload size={17} />{t('goImport')}</button></div>; }

function ReviewSection({ date, tasks, review, run }: { date: string; tasks: TaskRecord[]; review?: ReviewRecord; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const { t } = useI18n();
  const initial = reviewToJson(review, date, tasks); const [form, setForm] = useState<DailyReviewExport>(initial);
  useEffect(() => { setForm(initial); }, [date, review?.updatedAt, tasks.map((task) => `${task.id}:${task.status}`).join('|')]);
  const set = <K extends keyof DailyReviewExport>(key: K, value: DailyReviewExport[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => saveReview(form), t('saveReview')); };
  return <section className="review-section"><div className="section-heading"><div><h2>{t('dailyReview')}</h2><p className="muted">{t('reviewHint')}</p></div><button className="secondary-button" onClick={() => downloadJson(`lifeos-review-${date}.json`, form)}><Download size={16} />{t('exportReview')}</button></div><form className="review-card card" onSubmit={submit}><div className="review-grid"><label>{t('completion')}<select value={form.completion_status} onChange={(event) => set('completion_status', event.target.value as DailyReviewExport['completion_status'])}>{Object.entries(REVIEW_STATUS_LABELS).map(([value]) => <option key={value} value={value}>{t(REVIEW_STATUS_KEYS[value as keyof typeof REVIEW_STATUS_KEYS])}</option>)}</select></label><RatingField label={t('efficiency')} value={form.efficiency} onChange={(value) => set('efficiency', value)} /><RatingField label={t('autonomy')} value={form.autonomy} onChange={(value) => set('autonomy', value)} /></div><div className="review-text-grid"><TextArea label={t('cognitiveGains')} value={form.cognitive_gains} onChange={(value) => set('cognitive_gains', value)} placeholder={t('cognitivePlaceholder')} /><TextArea label={t('exploration')} value={form.exploration} onChange={(value) => set('exploration', value)} placeholder={t('explorationPlaceholder')} /><TextArea wide label={t('reflection')} value={form.reflection} onChange={(value) => set('reflection', value)} placeholder={t('reflectionPlaceholder')} /></div><div className="review-footer"><span className="muted"><CircleHelp size={15} />{t('localSqlite')}</span><button className="primary-button" type="submit"><Save size={17} />{t('saveReview')}</button></div></form></section>;
}

function RatingField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { const { t } = useI18n(); return <fieldset className="rating-field"><legend>{label}</legend><div>{[1, 2, 3, 4, 5].map((item) => <button key={item} type="button" className={value === item ? 'rating selected' : 'rating'} onClick={() => onChange(value === item ? null : item)}>{item}</button>)}</div><small>{t('ratingHint')}</small></fieldset>; }
function TextArea({ label, value, onChange, placeholder, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; wide?: boolean }) { return <label className={wide ? 'textarea-label wide' : 'textarea-label'}>{label}<textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }

function ImportView({ existingPlans, onImported, run }: { existingPlans: PlanRecord[]; onImported: (date: string) => void; run: (operation: () => Promise<void>, successMessage?: string) => Promise<void> }) {
  const { language, t } = useI18n();
  const [text, setText] = useState(''); const [parseError, setParseError] = useState(''); const [parsed, setParsed] = useState<DailyPlanInput | null>(null); const [showPreview, setShowPreview] = useState(false);
  const handleText = (value: string) => { setText(value); setParsed(null); setParseError(''); };
  const validate = () => { const result = parseDailyPlan(text); if (!result.success) { setParseError(localizeError(result.error, language)); setParsed(null); return; } setParseError(''); setParsed(result.data); setShowPreview(true); };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => handleText(String(reader.result ?? '')); reader.onerror = () => setParseError(t('noFile')); reader.readAsText(file); };
  const sameDay = parsed ? existingPlans.filter((plan) => plan.date === parsed.date) : [];
  return <div className="page import-page"><div className="page-heading"><div><div className="eyebrow">{t('input')}</div><h1>{t('importTitle')}</h1><p className="muted">{t('importHint')}</p></div><div className="protocol-pill"><FileJson size={17} />LifeOS JSON v1</div></div><div className="import-grid"><section className="import-editor card"><div className="card-header"><div><h2>{t('pastePlan')}</h2><p className="muted">{t('pasteHint')}</p></div><label className="secondary-button file-button"><Upload size={16} />{t('chooseFile')}<input type="file" accept="application/json,.json" onChange={onFile} /></label></div><textarea className="json-input" value={text} onChange={(event) => handleText(event.target.value)} placeholder={t('pasteHere')} spellCheck={false} /><div className="editor-actions"><button className="ghost-button" onClick={() => handleText(language === 'en' ? SAMPLE_PLAN_EN : SAMPLE_PLAN)}>{t('sample')}</button><button className="primary-button" onClick={validate} disabled={!text.trim()}><Check size={17} />{t('validatePreview')}</button></div>{parseError && <div className="parse-error"><X size={17} /><pre>{parseError}</pre></div>}</section><section className="protocol-card card"><div className="card-label">{t('importRules')}</div><Rule icon={<Check size={16} />} text={t('strictValidation')} /><Rule icon={<Archive size={16} />} text={t('newVersion')} /><Rule icon={<History size={16} />} text={t('historyPreserved')} /><Rule icon={<CircleHelp size={16} />} text={t('uniqueIds')} /><div className="schema-hint">{t('suggestedFields')} <code>plan_id · date · tasks[].start_time · tasks[].end_time</code></div></section></div>{showPreview && parsed && <ImportPreview plan={parsed} existingCount={sameDay.length} onCancel={() => setShowPreview(false)} onConfirm={() => void run(async () => { await savePlan(parsed); setShowPreview(false); onImported(parsed.date); }, t('planImported'))} />}</div>;
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) { return <div className="rule"><span>{icon}</span>{text}</div>; }
function ImportPreview({ plan, existingCount, onCancel, onConfirm }: { plan: DailyPlanInput; existingCount: number; onCancel: () => void; onConfirm: () => void }) {
  const { language, t } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'zh-CN';
  return <div className="modal-backdrop"><div className="preview-modal card"><div className="modal-header"><div><div className="eyebrow">{t('preview')}</div><h2>{t('confirmImport')}</h2></div><button className="icon-button" onClick={onCancel}><X size={18} /></button></div><div className="preview-summary"><div><span>{t('date')}</span><strong>{formatDateShort(plan.date, locale)}</strong></div><div><span>{t('taskCount', { count: plan.tasks.length })}</span><strong>{plan.tasks.length}</strong></div><div><span>{t('planVersion')}</span><strong>{plan.plan_id}</strong></div></div>{existingCount > 0 && <div className="warning-note"><Archive size={18} /><span>{t('existingVersions', { count: existingCount })}</span></div>}<div className="preview-list">{plan.tasks.map((task) => <div className="preview-task" key={task.id}><div><strong>{task.title}</strong><span>{task.category || t('unclassified')} · #{task.id}</span></div><time>{task.start_time} — {task.end_time}</time></div>)}</div><div className="modal-actions"><button className="secondary-button" onClick={onCancel}>{t('backToEdit')}</button><button className="primary-button" onClick={onConfirm}><Download size={16} />{t('confirmSave')}</button></div></div></div>;
}

function HistoryView({ data, onSelectDate }: { data: LifeOSData; onSelectDate: (date: string) => void }) {
  const { language, t } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'zh-CN';
  const dates = Array.from(new Set([...data.plans.map((plan) => plan.date), ...data.reviews.map((review) => review.date)])).sort((a, b) => b.localeCompare(a));
  return <div className="page history-page"><div className="page-heading"><div><div className="eyebrow">{t('archive')}</div><h1>{t('historyTitle')}</h1><p className="muted">{t('historyHint')}</p></div><button className="secondary-button" onClick={() => downloadJson(`lifeos-backup-${todayIso()}.json`, backupToJson(data))}><Download size={16} />{t('backupAll')}</button></div>{dates.length === 0 ? <div className="empty-state card"><div className="empty-icon"><History size={28} /></div><h3>{t('noHistory')}</h3><p>{t('noHistoryBody')}</p></div> : <div className="history-list">{dates.map((date) => { const plans = data.plans.filter((plan) => plan.date === date); const review = data.reviews.find((item) => item.date === date); const latest = plans[0]; const tasks = latest ? data.tasks.filter((task) => task.planId === latest.id) : []; const complete = tasks.filter((task) => task.status === 'completed').length; return <button className="history-card card" key={date} onClick={() => onSelectDate(date)}><div className="history-date"><span>{formatDateShort(date, locale)}</span><strong>{new Date(`${date}T12:00:00`).getFullYear()}</strong></div><div className="history-main"><strong>{latest?.title || t('onlyReview')}</strong><span>{t('versions', { count: plans.length })} · {t('completedCount', { completed: complete, total: tasks.length })}{review ? ` · ${t(REVIEW_STATUS_KEYS[review.completionStatus])}` : ` · ${t('reviewNotFilled')}`}</span></div><ChevronRight size={18} /></button>; })}</div>}</div>;
}

function currentClockMinutes(): number { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); }
function shiftDate(value: string, days: number): string { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

async function openQuickPanel(): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    window.alert('The desktop quick panel is available in the LifeOS Windows app.');
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
    title: 'LifeOS Quick Panel',
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
  const { language, t } = useI18n();
  const [data, setData] = useState<LifeOSData>({ plans: [], tasks: [], reviews: [] });
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('lifeos.quick-panel.opacity') ?? '0.94'));
  const [fontSize, setFontSize] = useState<'small' | 'normal' | 'large'>(() => (localStorage.getItem('lifeos.quick-panel.font-size') as 'small' | 'normal' | 'large') ?? 'normal');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const appWindow = getCurrentWindow();
  const date = todayIso();

  const refresh = async () => {
    try { setData(await loadData()); setError(''); } catch (err) { setError(localizeError(err instanceof Error ? err.message : String(err), language)); } finally { setBusy(false); }
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
    try { await updateTask({ ...task, status: task.status === 'completed' ? 'planned' : 'completed' }); await refresh(); } catch (err) { setError(localizeError(err instanceof Error ? err.message : String(err), language)); }
  };

  const beginDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input')) return;
    void appWindow.startDragging();
  };

  const beginResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void appWindow.startResizeDragging('SouthEast');
  };

  const locale = language === 'en' ? 'en-US' : 'zh-CN';
  return <div className={`quick-shell quick-font-${fontSize}`} style={{ '--panel-alpha': opacity } as CSSProperties}>
    <header className="quick-header" onMouseDown={beginDrag}>
      <div className="quick-brand"><div className="brand-mark"><Zap size={16} fill="currentColor" /></div><div><strong>LifeOS</strong><span>{t('quickPanel')}</span></div></div>
      <div className="quick-header-actions"><button className={controlsOpen ? 'quick-control-toggle open' : 'quick-control-toggle'} title={t('quickSettings')} onClick={() => setControlsOpen((value) => !value)}><SlidersHorizontal size={16} /></button><button className="quick-close" title={t('closePanel')} onClick={() => void appWindow.close()}><X size={17} /></button></div>
    </header>
    {controlsOpen && <div className="quick-controls"><div className="quick-setting"><strong>{t('opacity')}</strong><span>{t('opacityHint')}</span></div><label className="quick-opacity-control"><input type="range" min="0.55" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /><b>{Math.round(opacity * 100)}%</b></label><div className="quick-setting font-setting"><strong>{t('fontSize')}</strong><span>{t('englishFont')}</span></div><div className="quick-font-buttons">{(['small', 'normal', 'large'] as const).map((size) => <button key={size} className={fontSize === size ? 'selected' : ''} onClick={() => setFontSize(size)}>{size === 'small' ? t('small') : size === 'large' ? t('large') : t('standard')}</button>)}</div></div>}
    <main className="quick-content">
      <div className="quick-date"><div><span>{t('quickToday')}</span><strong>{formatDateShort(date, locale)}</strong></div><span className="quick-count">{t('quickCompleted', { completed, total: tasks.length })}</span></div>
      {error && <div className="quick-error">{error}</div>}
      {busy ? <div className="quick-empty">{t('quickReading')}</div> : tasks.length === 0 ? <div className="quick-empty"><CalendarDays size={24} /><span>{t('quickNoPlan')}</span><small>{t('quickNoPlanBody')}</small></div> : <div className="quick-tasks">{tasks.map((task) => <button className={task.status === 'completed' ? 'quick-task done' : 'quick-task'} key={task.id} onClick={() => void toggleTask(task)}><span className="quick-check">{task.status === 'completed' && <Check size={12} />}</span><span className="quick-task-copy"><strong>{task.title}</strong><small>{task.startTime} — {task.endTime}{task.category ? ` · ${task.category}` : ''}</small></span></button>)}</div>}
      <button className="quick-refresh" onClick={() => void refresh()}><RefreshCw size={14} />{t('refreshTasks')}</button>
    </main>
    <button className="quick-resize-grip" title={t('resizePanel')} aria-label={t('resizePanel')} onMouseDown={beginResize} />
  </div>;
}

export default QUICK_PANEL_MODE ? QuickPanel : App;
