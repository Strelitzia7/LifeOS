import { beforeEach, describe, expect, it } from 'vitest';
import { loadData, reviewToJson, savePlan, saveReview, updateTask } from './storage';

describe('local persistence adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a plan, task completion, and review after reloading data', async () => {
    const plan = await savePlan({
      schema_version: '1.0',
      type: 'daily_plan',
      plan_id: 'persistence-test',
      date: '2026-10-09',
      tasks: [{ id: 'persist-task', title: '持久化测试', start_time: '13:00', end_time: '13:30' }],
    });
    let snapshot = await loadData();
    expect(snapshot.plans).toHaveLength(1);
    expect(snapshot.tasks[0].status).toBe('planned');

    await updateTask({ ...snapshot.tasks[0], status: 'completed' });
    snapshot = await loadData();
    await saveReview(reviewToJson(undefined, plan.date, snapshot.tasks));

    const reloaded = await loadData();
    expect(reloaded.tasks[0].status).toBe('completed');
    expect(reloaded.reviews[0].date).toBe('2026-10-09');
    expect(reloaded.reviews[0].completionStatus).toBe('completed');
  });

  it('rejects duplicate task IDs across imported plans', async () => {
    const plan = { schema_version: '1.0' as const, type: 'daily_plan' as const, plan_id: 'first', date: '2026-10-09', tasks: [{ id: 'same-id', title: '任务', start_time: '13:00', end_time: '13:30' }] };
    await savePlan(plan);
    await expect(savePlan({ ...plan, plan_id: 'second', date: '2026-10-10' })).rejects.toThrow('重复任务 ID');
  });
});
