import { describe, expect, it } from 'vitest';
import { dailyPlanSchema, dailyReviewSchema, parseDailyPlan } from './schemas';

const validPlan = {
  schema_version: '1.0' as const,
  type: 'daily_plan' as const,
  plan_id: 'test-plan',
  date: '2026-10-09',
  tasks: [
    { id: 'task-a', title: 'A', start_time: '13:00', end_time: '13:30' },
    { id: 'task-b', title: 'B', start_time: '13:30', end_time: '14:00' },
  ],
};

describe('LifeOS JSON v1 schemas', () => {
  it('accepts a valid daily plan and applies planned status', () => {
    const result = dailyPlanSchema.parse(validPlan);
    expect(result.tasks[0].status).toBe('planned');
  });

  it('rejects duplicate task IDs', () => {
    const result = dailyPlanSchema.safeParse({ ...validPlan, tasks: [validPlan.tasks[0], { ...validPlan.tasks[1], id: 'task-a' }] });
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues.some((issue) => issue.message.includes('重复任务 ID'))).toBe(true);
  });

  it('rejects overlapping or backwards times', () => {
    const result = parseDailyPlan(JSON.stringify({ ...validPlan, tasks: [{ ...validPlan.tasks[0], end_time: '14:00' }, validPlan.tasks[1]] }));
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error).toMatch(/冲突|晚于/);
  });

  it('rejects unknown fields and invalid schema version', () => {
    expect(dailyPlanSchema.safeParse({ ...validPlan, extra: true }).success).toBe(false);
    expect(dailyPlanSchema.safeParse({ ...validPlan, schema_version: '2.0' }).success).toBe(false);
  });

  it('validates a daily review', () => {
    const review = dailyReviewSchema.parse({ schema_version: '1.0', type: 'daily_review', date: '2026-10-09', completion_status: 'partial', efficiency: 4, cognitive_gains: '发现了节奏', exploration: '', autonomy: 3, reflection: '明天减少上下文切换。' });
    expect(review.autonomy).toBe(3);
    expect(dailyReviewSchema.safeParse({ ...review, efficiency: 7 }).success).toBe(false);
  });
});
