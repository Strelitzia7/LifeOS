import Database from '@tauri-apps/plugin-sql';
import type { DailyPlanInput } from '../types';
import type { LifeOSData, PlanRecord, ReviewRecord, TaskRecord, DailyReviewExport } from '../types';
import { generateId, todayIso, timeToMinutes } from './date';
import { dailyReviewSchema } from '../validation/schemas';

const STORAGE_KEY = 'lifeos.local-data.v1';
let dbPromise: Promise<Database> | null = null;

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function emptyData(): LifeOSData {
  return { plans: [], tasks: [], reviews: [] };
}

function readLocal(): LifeOSData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyData();
  try {
    const parsed = JSON.parse(raw) as LifeOSData;
    return { plans: parsed.plans ?? [], tasks: parsed.tasks ?? [], reviews: parsed.reviews ?? [] };
  } catch {
    throw new Error('本地开发数据损坏，无法读取。请清理浏览器的 LifeOS 本地数据后重试。');
  }
}

function writeLocal(data: LifeOSData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new Error('本地存储失败：磁盘空间不足或浏览器拒绝写入。');
  }
}

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:lifeos.db').then(async (db) => {
      await db.execute('PRAGMA foreign_keys = ON');
      await db.execute(`CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        source_plan_id TEXT NOT NULL,
        plan_date TEXT NOT NULL,
        title TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        source_json TEXT NOT NULL
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        plan_date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        completed_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE CASCADE
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS reviews (
        review_date TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        completion_status TEXT NOT NULL,
        efficiency INTEGER,
        cognitive_gains TEXT NOT NULL,
        exploration TEXT NOT NULL,
        autonomy INTEGER,
        reflection TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      return db;
    }).catch((error) => {
      dbPromise = null;
      throw new Error(`SQLite 初始化失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return dbPromise;
}

function mapPlan(row: Record<string, unknown>): PlanRecord {
  return { id: String(row.id), sourcePlanId: String(row.source_plan_id), date: String(row.plan_date), title: String(row.title), schemaVersion: String(row.schema_version), createdAt: String(row.created_at), sourceJson: String(row.source_json) };
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  return { id: String(row.id), planId: String(row.plan_id), date: String(row.plan_date), title: String(row.title), description: String(row.description ?? ''), startTime: String(row.start_time), endTime: String(row.end_time), category: String(row.category ?? ''), status: String(row.status) as TaskRecord['status'], completedAt: row.completed_at ? String(row.completed_at) : null, sortOrder: Number(row.sort_order), updatedAt: String(row.updated_at) };
}

function mapReview(row: Record<string, unknown>): ReviewRecord {
  return { date: String(row.review_date), schemaVersion: '1.0', completionStatus: String(row.completion_status) as ReviewRecord['completionStatus'], efficiency: row.efficiency === null || row.efficiency === undefined ? null : Number(row.efficiency), cognitiveGains: String(row.cognitive_gains ?? ''), exploration: String(row.exploration ?? ''), autonomy: row.autonomy === null || row.autonomy === undefined ? null : Number(row.autonomy), reflection: String(row.reflection ?? ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export async function loadData(): Promise<LifeOSData> {
  if (!inTauri()) return readLocal();
  const db = await getDb();
  const [plans, tasks, reviews] = await Promise.all([
    db.select<Record<string, unknown>[]>('SELECT * FROM plans ORDER BY plan_date DESC, created_at DESC'),
    db.select<Record<string, unknown>[]>('SELECT * FROM tasks ORDER BY plan_date DESC, start_time ASC, sort_order ASC'),
    db.select<Record<string, unknown>[]>('SELECT * FROM reviews ORDER BY review_date DESC'),
  ]);
  return { plans: plans.map(mapPlan), tasks: tasks.map(mapTask), reviews: reviews.map(mapReview) };
}

export async function savePlan(input: DailyPlanInput): Promise<PlanRecord> {
  const data = await loadData();
  const duplicate = input.tasks.find((task) => data.tasks.some((existing) => existing.id === task.id));
  if (duplicate) throw new Error(`重复任务 ID：${duplicate.id} 已存在于历史计划中。请修改任务 ID 后再导入。`);
  const now = new Date().toISOString();
  const plan: PlanRecord = { id: generateId('plan'), sourcePlanId: input.plan_id, date: input.date, title: input.title || '未命名日程', schemaVersion: input.schema_version, createdAt: now, sourceJson: JSON.stringify(input, null, 2) };
  const tasks: TaskRecord[] = input.tasks.map((task, index) => ({ id: task.id, planId: plan.id, date: input.date, title: task.title, description: task.description ?? '', startTime: task.start_time, endTime: task.end_time, category: task.category ?? '', status: task.status ?? 'planned', completedAt: task.status === 'completed' ? now : null, sortOrder: index, updatedAt: now }));

  if (!inTauri()) {
    data.plans.unshift(plan);
    data.tasks.push(...tasks);
    writeLocal(data);
    return plan;
  }

  const db = await getDb();
  try {
    await db.execute('BEGIN TRANSACTION');
    await db.execute('INSERT INTO plans (id, source_plan_id, plan_date, title, schema_version, created_at, source_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [plan.id, plan.sourcePlanId, plan.date, plan.title, plan.schemaVersion, plan.createdAt, plan.sourceJson]);
    for (const task of tasks) {
      await db.execute('INSERT INTO tasks (id, plan_id, plan_date, title, description, start_time, end_time, category, status, completed_at, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [task.id, task.planId, task.date, task.title, task.description, task.startTime, task.endTime, task.category, task.status, task.completedAt, task.sortOrder, task.updatedAt]);
    }
    await db.execute('COMMIT');
    return plan;
  } catch (error) {
    await db.execute('ROLLBACK').catch(() => undefined);
    if (String(error).toLowerCase().includes('unique')) throw new Error('重复任务 ID：数据库中已经存在同名任务。');
    throw new Error(`保存计划失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateTask(task: TaskRecord): Promise<void> {
  const now = new Date().toISOString();
  if (timeToMinutes(task.endTime) <= timeToMinutes(task.startTime)) throw new Error('结束时间必须晚于开始时间。');
  const existingData = await loadData();
  const siblingTasks = existingData.tasks.filter((item) => item.planId === task.planId && item.id !== task.id);
  if (siblingTasks.some((item) => timeToMinutes(task.startTime) < timeToMinutes(item.endTime) && timeToMinutes(item.startTime) < timeToMinutes(task.endTime))) throw new Error('时间冲突：任务与当前计划中的另一项任务重叠。');
  const updated = { ...task, completedAt: task.status === 'completed' ? task.completedAt ?? now : null, updatedAt: now };
  if (!inTauri()) {
    const data = readLocal();
    const index = data.tasks.findIndex((item) => item.id === task.id);
    if (index < 0) throw new Error('找不到需要更新的任务。');
    data.tasks[index] = updated;
    writeLocal(data);
    return;
  }
  const db = await getDb();
  try {
    await db.execute('UPDATE tasks SET title = ?, description = ?, start_time = ?, end_time = ?, category = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [updated.title, updated.description, updated.startTime, updated.endTime, updated.category, updated.status, updated.completedAt, updated.updatedAt, updated.id]);
  } catch (error) {
    throw new Error(`保存任务失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function createTask(task: Omit<TaskRecord, 'updatedAt' | 'completedAt'>): Promise<void> {
  const now = new Date().toISOString();
  if (timeToMinutes(task.endTime) <= timeToMinutes(task.startTime)) throw new Error('结束时间必须晚于开始时间。');
  const data = await loadData();
  if (data.tasks.some((item) => item.id === task.id)) throw new Error(`重复任务 ID：${task.id}`);
  const siblingTasks = data.tasks.filter((item) => item.planId === task.planId && item.id !== task.id);
  if (siblingTasks.some((item) => timeToMinutes(task.startTime) < timeToMinutes(item.endTime) && timeToMinutes(item.startTime) < timeToMinutes(task.endTime))) throw new Error('时间冲突：新任务与当前计划中的任务重叠。');
  const record: TaskRecord = { ...task, completedAt: null, updatedAt: now };
  if (!inTauri()) {
    data.tasks.push(record);
    writeLocal(data);
    return;
  }
  const db = await getDb();
  try {
    await db.execute('INSERT INTO tasks (id, plan_id, plan_date, title, description, start_time, end_time, category, status, completed_at, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [record.id, record.planId, record.date, record.title, record.description, record.startTime, record.endTime, record.category, record.status, null, record.sortOrder, record.updatedAt]);
  } catch (error) {
    throw new Error(`新增任务失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!inTauri()) {
    const data = readLocal();
    data.tasks = data.tasks.filter((task) => task.id !== taskId);
    writeLocal(data);
    return;
  }
  const db = await getDb();
  try {
    await db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
  } catch (error) {
    throw new Error(`删除任务失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveReview(review: DailyReviewExport): Promise<void> {
  const parsed = dailyReviewSchema.safeParse(review);
  if (!parsed.success) throw new Error('复盘数据不符合 LifeOS JSON v1。');
  const data = await loadData();
  const now = new Date().toISOString();
  const existing = data.reviews.find((item) => item.date === review.date);
  const record: ReviewRecord = { date: review.date, schemaVersion: '1.0', completionStatus: review.completion_status, efficiency: review.efficiency, cognitiveGains: review.cognitive_gains, exploration: review.exploration, autonomy: review.autonomy, reflection: review.reflection, createdAt: existing?.createdAt ?? now, updatedAt: now };
  if (!inTauri()) {
    const index = data.reviews.findIndex((item) => item.date === review.date);
    if (index < 0) data.reviews.unshift(record); else data.reviews[index] = record;
    writeLocal(data);
    return;
  }
  const db = await getDb();
  try {
    await db.execute(`INSERT INTO reviews (review_date, schema_version, completion_status, efficiency, cognitive_gains, exploration, autonomy, reflection, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(review_date) DO UPDATE SET schema_version = excluded.schema_version, completion_status = excluded.completion_status, efficiency = excluded.efficiency, cognitive_gains = excluded.cognitive_gains, exploration = excluded.exploration, autonomy = excluded.autonomy, reflection = excluded.reflection, updated_at = excluded.updated_at`, [record.date, record.schemaVersion, record.completionStatus, record.efficiency, record.cognitiveGains, record.exploration, record.autonomy, record.reflection, record.createdAt, record.updatedAt]);
  } catch (error) {
    throw new Error(`保存复盘失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function reviewToJson(review: ReviewRecord | undefined, date: string, tasks: TaskRecord[]): DailyReviewExport {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const completionStatus = review?.completionStatus ?? (tasks.length > 0 && completed === tasks.length ? 'completed' : completed > 0 ? 'partial' : 'not_started');
  return { schema_version: '1.0', type: 'daily_review', date, completion_status: completionStatus, efficiency: review?.efficiency ?? null, cognitive_gains: review?.cognitiveGains ?? '', exploration: review?.exploration ?? '', autonomy: review?.autonomy ?? null, reflection: review?.reflection ?? '' };
}

export function backupToJson(data: LifeOSData): object {
  return { backup_version: '1.0', exported_at: new Date().toISOString(), plans: data.plans, tasks: data.tasks, reviews: data.reviews };
}

export { todayIso };
