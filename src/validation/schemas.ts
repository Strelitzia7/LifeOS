import { z } from 'zod';
import type { DailyPlanInput, DailyReviewExport, TaskStatus } from '../types';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间必须是 HH:mm 格式');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD 格式');
const taskStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'skipped', 'cancelled']);

const taskSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  start_time: timeSchema,
  end_time: timeSchema,
  category: z.string().trim().max(80).optional(),
  status: taskStatusSchema.optional().default('planned'),
}).strict();

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

export const dailyPlanSchema = z.object({
  schema_version: z.literal('1.0'),
  type: z.literal('daily_plan'),
  plan_id: z.string().trim().min(1).max(120),
  date: dateSchema,
  title: z.string().trim().max(200).optional(),
  tasks: z.array(taskSchema).min(1).max(200),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set<string>();
  plan.tasks.forEach((task, index) => {
    if (ids.has(task.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tasks', index, 'id'], message: `重复任务 ID: ${task.id}` });
    }
    ids.add(task.id);
    if (minutes(task.end_time) <= minutes(task.start_time)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tasks', index, 'end_time'], message: '结束时间必须晚于开始时间' });
    }
  });

  const sorted = [...plan.tasks].sort((a, b) => minutes(a.start_time) - minutes(b.start_time));
  sorted.forEach((task, index) => {
    const previous = sorted[index - 1];
    if (previous && minutes(task.start_time) < minutes(previous.end_time)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tasks', index, 'start_time'], message: `与任务「${previous.title}」时间冲突` });
    }
  });
});

export const dailyReviewSchema = z.object({
  schema_version: z.literal('1.0'),
  type: z.literal('daily_review'),
  date: dateSchema,
  completion_status: z.enum(['completed', 'partial', 'not_started']),
  efficiency: z.number().int().min(1).max(5).nullable(),
  cognitive_gains: z.string().max(4000),
  exploration: z.string().max(4000),
  autonomy: z.number().int().min(1).max(5).nullable(),
  reflection: z.string().max(8000),
}).strict();

export type ValidatedPlan = z.infer<typeof dailyPlanSchema>;
export type ValidatedReview = z.infer<typeof dailyReviewSchema>;

export function parseDailyPlan(text: string): { success: true; data: DailyPlanInput } | { success: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    const result = dailyPlanSchema.safeParse(parsed);
    if (!result.success) {
      return { success: false, error: result.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('\n') };
    }
    return { success: true, data: result.data as DailyPlanInput };
  } catch {
    return { success: false, error: '无法解析 JSON：请确认输入是完整、有效的 JSON 文本。' };
  }
}

export function parseDailyReview(value: unknown): DailyReviewExport {
  return dailyReviewSchema.parse(value) as DailyReviewExport;
}

export function isTaskStatus(value: string): value is TaskStatus {
  return taskStatusSchema.safeParse(value).success;
}
