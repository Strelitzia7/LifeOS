export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type ReviewCompletion = 'completed' | 'partial' | 'not_started';

export interface PlanTaskInput {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category?: string;
  status?: TaskStatus;
}

export interface DailyPlanInput {
  schema_version: '1.0';
  type: 'daily_plan';
  plan_id: string;
  date: string;
  title?: string;
  tasks: PlanTaskInput[];
}

export interface PlanRecord {
  id: string;
  sourcePlanId: string;
  date: string;
  title: string;
  schemaVersion: string;
  createdAt: string;
  sourceJson: string;
}

export interface TaskRecord {
  id: string;
  planId: string;
  date: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
  status: TaskStatus;
  completedAt: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface ReviewRecord {
  date: string;
  schemaVersion: '1.0';
  completionStatus: ReviewCompletion;
  efficiency: number | null;
  cognitiveGains: string;
  exploration: string;
  autonomy: number | null;
  reflection: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeOSData {
  plans: PlanRecord[];
  tasks: TaskRecord[];
  reviews: ReviewRecord[];
}

export interface DailyReviewExport {
  schema_version: '1.0';
  type: 'daily_review';
  date: string;
  completion_status: ReviewCompletion;
  efficiency: number | null;
  cognitive_gains: string;
  exploration: string;
  autonomy: number | null;
  reflection: string;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  skipped: '已跳过',
  cancelled: '已取消',
};

export const REVIEW_STATUS_LABELS: Record<ReviewCompletion, string> = {
  completed: '完成得很好',
  partial: '部分完成',
  not_started: '尚未开始',
};
