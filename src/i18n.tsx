import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'zh';

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  en: {
    today: 'Today', importPlan: 'Import plan', history: 'History', openQuickPanel: 'Open desktop quick panel', darkMode: 'Switch to dark mode', lightMode: 'Switch to light mode', reload: 'Reload local data', localOnly: 'Data stays on this device', reading: 'Reading local data…', todayLabel: 'TODAY', savedDay: 'SAVED DAY', noPlanForDay: 'No plan imported for this day', progress: 'Today’s progress', tasksCount: '{completed} / {total} tasks', planComplete: 'Today’s plan is complete.', keepGoing: 'Keep the rhythm and finish the next small step.', nextAt: 'Next at {time}', currentTask: 'Current task', noCurrentToday: 'No task is in progress right now', noCurrentDay: 'No task is in progress on this day', nextStarts: 'Next task starts at {time}', chooseTask: 'Choose a task below to get started', checkIn: 'Check in complete', timeline: 'Today’s timeline', timelineHint: '13:00 — 17:00 · Click a task to edit its time or status', version: 'Version {time}', multipleVersions: 'Multiple plans exist for this day. The latest version is shown; older versions and execution history are preserved.', noTasks: 'This plan has no tasks yet.', cancel: 'Cancel', addTask: 'Add task', taskName: 'Task name', categoryOptional: 'Category (optional)', save: 'Save', start: 'Start', end: 'End', changeStatus: 'Change task status', editTime: 'Edit time', deleteTask: 'Delete task', deleteConfirm: 'Delete task “{title}”?', taskTimeUpdated: 'Task time updated', taskRestored: 'Task restored to planned', taskCompleted: 'Task completed', taskStatusUpdated: 'Task status updated', taskDeleted: 'Task deleted', taskAdded: 'Task added', noTodayPlan: 'No plan for today', noTodayPlanBody: 'Copy a LifeOS JSON v1 schedule from an external AI and import it to start executing.', goImport: 'Import a plan', dailyReview: 'Daily review', reviewHint: 'Feed execution results back to tomorrow’s self, or export them to an external AI.', exportReview: 'Export review JSON', completion: 'Completion', efficiency: 'Efficiency', autonomy: 'Autonomy', cognitiveGains: 'Cognitive gains', exploration: 'Exploration', reflection: 'Written reflection', cognitivePlaceholder: 'What did you understand today?', explorationPlaceholder: 'Did you try a new method or explore something new?', reflectionPlaceholder: 'What worked today? What should change tomorrow?', ratingHint: '1 low · 5 high', localSqlite: 'Saved locally in SQLite', saveReview: 'Save review', completedWell: 'Completed well', partial: 'Partially completed', notStarted: 'Not started', input: 'INPUT', archive: 'ARCHIVE', importTitle: 'Import daily plan', importHint: 'Receive a standardized JSON plan from an external AI and preview it locally before saving.', protocol: 'LifeOS JSON v1', pastePlan: 'Paste plan JSON', pasteHint: 'Supports schema_version 1.0 daily_plan', chooseFile: 'Choose file', pasteHere: 'Paste JSON here…', sample: 'Fill sample', validatePreview: 'Validate and preview', importRules: 'Import rules', strictValidation: 'Strictly validate LifeOS JSON v1', newVersion: 'Every import creates a new version', historyPreserved: 'Execution history is never overwritten', uniqueIds: 'Task IDs must be globally unique', suggestedFields: 'Ask the external AI to generate:', planImported: 'Plan imported', preview: 'PREVIEW', confirmImport: 'Import this plan?', date: 'Date', taskCount: '{count} tasks', planVersion: 'Version', existingVersions: 'This day already has {count} plan version(s). A new version will be created; older plans and execution history will remain.', unclassified: 'Unclassified', backToEdit: 'Back to edit', confirmSave: 'Confirm and save', historyTitle: 'History', historyHint: 'Previous plans and reviews stay on this device and can be revisited.', backupAll: 'Back up all data', noHistory: 'No history yet', noHistoryBody: 'Your first imported plan will appear here.', onlyReview: 'Review only', versions: '{count} plan version(s)', completedCount: '{completed}/{total} completed', reviewNotFilled: 'Review not filled', quickPanel: 'Desktop quick panel', quickSettings: 'Panel settings', opacity: 'Opacity', opacityHint: 'Adjusts the background only, not the text', fontSize: 'Font size', englishFont: 'English: Consolas', small: 'Small', standard: 'Standard', large: 'Large', quickToday: 'Today', quickCompleted: '{completed}/{total} complete', quickReading: 'Reading local tasks…', quickNoPlan: 'No plan for today', quickNoPlanBody: 'Open LifeOS to import a schedule', refreshTasks: 'Refresh tasks', closePanel: 'Close panel', resizePanel: 'Resize panel', desktopPanelNeedsApp: 'The desktop quick panel is available in the LifeOS Windows app.', statusPlanned: 'Planned', statusInProgress: 'In progress', statusCompleted: 'Completed', statusSkipped: 'Skipped', statusCancelled: 'Cancelled', language: '中文', noFile: 'File could not be read.'
  },
  zh: {
    today: '今日', importPlan: '导入计划', history: '历史记录', openQuickPanel: '打开桌面便栏', darkMode: '切换到深色模式', lightMode: '切换到浅色模式', reload: '重新读取本地数据', localOnly: '数据只保存在本机', reading: '正在读取本地数据…', todayLabel: 'TODAY', savedDay: 'SAVED DAY', noPlanForDay: '还没有导入这一天的计划', progress: '今日进度', tasksCount: '{completed} / {total} 个任务', planComplete: '今天的计划完成了。', keepGoing: '保持节奏，完成下一个小步骤。', nextAt: '下一项 {time}', currentTask: '当前任务', noCurrentToday: '现在没有进行中的任务', noCurrentDay: '这一天没有进行中的任务', nextStarts: '下一个任务 {time} 开始', chooseTask: '可以从下方选择一个任务开始', checkIn: '完成打卡', timeline: '今日时间轴', timelineHint: '13:00 — 17:00 · 点击任务可修改时间和状态', version: '版本 {time}', multipleVersions: '这一天有多个导入版本，当前显示最新版本；旧版本和执行记录保留在历史记录中。', noTasks: '这个计划暂时没有任务。', cancel: '取消', addTask: '添加任务', taskName: '任务名称', categoryOptional: '分类（可选）', save: '保存', start: '开始', end: '结束', changeStatus: '切换完成状态', editTime: '修改时间', deleteTask: '删除任务', deleteConfirm: '删除任务「{title}」？', taskTimeUpdated: '任务时间已更新', taskRestored: '已恢复为待开始', taskCompleted: '任务已完成', taskStatusUpdated: '任务状态已更新', taskDeleted: '任务已删除', taskAdded: '任务已添加', noTodayPlan: '还没有今天的计划', noTodayPlanBody: '从外部 AI 复制一份 LifeOS JSON v1 日程，导入后就能开始执行。', goImport: '去导入计划', dailyReview: '每日复盘', reviewHint: '把执行结果反馈给明天的自己，也可以直接导出给外部 AI。', exportReview: '导出复盘 JSON', completion: '完成情况', efficiency: '效率', autonomy: '自主性', cognitiveGains: '认知收获', exploration: '探索经历', reflection: '文字反思', cognitivePlaceholder: '今天理解了什么？', explorationPlaceholder: '有没有尝试新方法或接触新东西？', reflectionPlaceholder: '今天哪些安排有效？明天需要调整什么？', ratingHint: '1 低 · 5 高', localSqlite: '数据保存在本机 SQLite 中', saveReview: '保存复盘', completedWell: '完成得很好', partial: '部分完成', notStarted: '尚未开始', input: 'INPUT', archive: 'ARCHIVE', importTitle: '导入每日计划', importHint: '接收外部 AI 输出的标准化 JSON，在本地预览后保存。', protocol: 'LifeOS JSON v1', pastePlan: '粘贴计划 JSON', pasteHint: '支持 schema_version 1.0 的 daily_plan', chooseFile: '选择文件', pasteHere: '在这里粘贴 JSON…', sample: '填入虚构示例', validatePreview: '验证并预览', importRules: '导入规则', strictValidation: '严格验证 LifeOS JSON v1', newVersion: '每次导入创建新版本', historyPreserved: '历史执行记录不会被覆盖', uniqueIds: '任务 ID 必须全局唯一', suggestedFields: '建议让外部 AI 生成如下字段：', planImported: '计划已导入', preview: 'PREVIEW', confirmImport: '确认导入这份计划？', date: '日期', taskCount: '{count} 项', planVersion: '版本', existingVersions: '这一天已有 {count} 个计划版本。确认后会创建新版本，旧版本及执行历史会保留。', unclassified: '未分类', backToEdit: '返回修改', confirmSave: '确认并保存', historyTitle: '历史记录', historyHint: '以前的计划和复盘都保存在本机，可随时回看。', backupAll: '备份全部数据', noHistory: '还没有历史记录', noHistoryBody: '导入第一份计划后，它会出现在这里。', onlyReview: '只有复盘记录', versions: '{count} 个计划版本', completedCount: '{completed}/{total} 完成', reviewNotFilled: '未填写复盘', quickPanel: '桌面便栏', quickSettings: '便栏设置', opacity: '透明度', opacityHint: '只调整背景，不影响文字', fontSize: '字体大小', englishFont: '英文：Consolas', small: '小', standard: '标准', large: '大', quickToday: '今天', quickCompleted: '{completed}/{total} 完成', quickReading: '正在读取本地任务…', quickNoPlan: '今天还没有计划', quickNoPlanBody: '打开 LifeOS 导入一份日程', refreshTasks: '刷新任务', closePanel: '关闭便栏', resizePanel: '调整便栏大小', desktopPanelNeedsApp: '桌面便栏需要在 LifeOS Windows 桌面版中使用。', statusPlanned: '待开始', statusInProgress: '进行中', statusCompleted: '已完成', statusSkipped: '已跳过', statusCancelled: '已取消', language: 'EN', noFile: '文件读取失败。'
  }
};

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('lifeos.language') === 'zh' ? 'zh' : 'en');
  const changeLanguage = (next: Language) => { setLanguage(next); localStorage.setItem('lifeos.language', next); };
  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: changeLanguage,
    toggleLanguage: () => changeLanguage(language === 'en' ? 'zh' : 'en'),
    t: (key, variables) => Object.entries(variables ?? {}).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), dictionaries[language][key] ?? key),
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function localizeError(message: string, language: Language): string {
  if (language === 'zh') return message;
  return message
    .replaceAll('无法解析 JSON：请确认输入是完整、有效的 JSON 文本。', 'Unable to parse JSON: make sure the input is complete and valid JSON.')
    .replaceAll('重复任务 ID', 'Duplicate task ID')
    .replaceAll('结束时间必须晚于开始时间', 'End time must be later than start time')
    .replaceAll('与任务「', 'Time conflict with task "')
    .replaceAll('」时间冲突', '"')
    .replaceAll('时间冲突：', 'Time conflict: ')
    .replaceAll('本地开发数据损坏，无法读取。请清理浏览器的 LifeOS 本地数据后重试。', 'Local development data is corrupted. Clear LifeOS browser data and try again.')
    .replaceAll('本地存储失败：', 'Local storage failed: ')
    .replaceAll('SQLite 初始化失败：', 'SQLite initialization failed: ')
    .replaceAll('保存计划失败：', 'Could not save plan: ')
    .replaceAll('找不到需要更新的任务。', 'The task to update could not be found.')
    .replaceAll('保存任务失败：', 'Could not save task: ')
    .replaceAll('新增任务失败：', 'Could not add task: ')
    .replaceAll('删除任务失败：', 'Could not delete task: ')
    .replaceAll('复盘数据不符合 LifeOS JSON v1。', 'Review data does not match LifeOS JSON v1.')
    .replaceAll('保存复盘失败：', 'Could not save review: ')
    .replaceAll('文件读取失败。', 'The file could not be read.');
}
