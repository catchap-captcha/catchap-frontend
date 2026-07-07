import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OrgRegRequest {
  id: string;
  org_name: string;
  org_type: string;
  business_number: string | null;
  address: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  expected_students: string | null;
  plan_interest: string | null;
  status: string; // pending | approved | rejected
  org_code: string | null;
  org_status: string | null;
  created_at: string | null;
  approved_at: string | null;
}

export interface OpsAuditLog {
  id: string;
  action: string;
  actor_user_id: string | null;
  organization_id: string | null;
  target_type: string | null;
  target_id: string | null;
  created_at: string | null;
}

export interface OpsOrg {
  id: string;
  name: string;
  code: string;
  org_type: string;
  status: string; // pending | active | disabled
  students: number;
}

export interface OpsDashboard {
  organizations: number;
  users: number;
  students: number;
  active_api_keys: number;
  open_inquiries: number;
  audit_logs: number;
  api_calls_today: number;
  error_rate: string;
}

export interface OpsInquiryReply {
  id: string;
  body: string;
  answered_by: string | null;
  email_status: string; // sent | dry_run | failed
  created_at: string | null;
}

export interface OpsInquiry {
  id: string;
  inquiry_type: string;
  name: string;
  affiliation: string | null;
  email: string;
  content: string;
  status: string; // received | resolved
  replies: OpsInquiryReply[];
  created_at: string | null;
}

export interface OpsPlan {
  key: string;
  name: string;
  monthly_price: number;
  api_quota: number;
  products: string[]; // 이 요금제로 발급 가능한 제품 키 목록
}

export interface OpsPlansResponse {
  products: Record<string, string>; // product_key -> 표시명
  edu_subjects: string[];
  plans: OpsPlan[];
}

export interface OpsApiKey {
  id: string;
  organization_id: string;
  organization_name: string | null;
  product: string;
  product_name: string;
  subject: string | null;
  label: string | null;
  site_key: string;
  status: string; // active | disabled
  plan: string;
  last_used_at: string | null;
  created_at: string | null;
}

export interface OpsIssuedKey {
  ok: boolean;
  id: string;
  site_key: string;
  secret_key: string; // 발급 응답에서만 1회 노출
  product: string;
  subject: string | null;
}

export interface BehaviorGroupMetrics {
  group: string; // child | anonymous
  count: number;
  avg_solve_time_ms: number | null;
  avg_path_length: number | null;
  avg_speed: number | null;
  avg_pause_count: number | null;
  avg_retry_count: number | null;
}

export interface BehaviorOverview {
  total: number;
  week_count: number;
  trace_count: number; // 원시 궤적이 남은 레코드 수
  by_source: Record<string, number>; // game | edu-api
  by_result: Record<string, number>; // correct/pass | incorrect/fail
  by_risk: Record<string, number>; // low | review | elevated
  by_dataset: Record<string, number>; // candidate | included | excluded
  comparison: BehaviorGroupMetrics[];
}

export interface BehaviorStudent {
  nickname: string;
  student_code: string;
  age: number | null;
  grade_band: string;
}

export interface BehaviorRecord {
  id: string;
  source_type: string; // game | edu-api
  organization_name: string | null;
  student: BehaviorStudent | null; // null = 익명(외부 임베드)
  solve_time_ms: number;
  path_length: number;
  avg_speed: number;
  pause_count: number;
  retry_count: number;
  drop_distance_norm: number;
  interaction_result: string | null;
  risk_level: string;
  dataset_status: string; // candidate | included | excluded
  trace_points: number | null; // null = 원시 궤적 없음
  occurred_at: string | null;
  created_at: string | null;
}

export interface BehaviorTraceDetail {
  behavior_id: string;
  points: [number, number, number][]; // [t_ms, x(0~1), y(0~1)]
  point_count: number;
  duration_ms: number;
  box_w: number;
  box_h: number;
}

export interface BehaviorRecordsResponse {
  total: number;
  items: BehaviorRecord[];
}

export interface BehaviorRecordsFilter {
  source?: string;
  result_filter?: string;
  risk?: string;
  group?: string;
  dataset?: string;
  limit?: number;
  offset?: number;
}

export const opsApi = {
  dashboard: () => client.get<OpsDashboard>('/ops/dashboard').then((r) => r.data),
  orgs: () => client.get<OpsOrg[]>('/ops/orgs').then((r) => r.data),
  logs: () => client.get<OpsAuditLog[]>('/ops/logs').then((r) => r.data),
  inquiries: (status?: string) =>
    client
      .get<OpsInquiry[]>('/ops/inquiries', {
        params: status ? { status_filter: status } : undefined,
      })
      .then((r) => r.data),
  resolveInquiry: (id: string) =>
    client.post(`/ops/inquiries/${id}/resolve`).then((r) => r.data),
  answerInquiry: (id: string, answer: string) =>
    client
      .post<{ ok: boolean; status: string; email_sent: boolean; email_status: string }>(
        `/ops/inquiries/${id}/answer`,
        { answer },
      )
      .then((r) => r.data),
  registrationRequests: (status?: string) =>
    client
      .get<OrgRegRequest[]>('/ops/registration-requests', {
        params: status ? { status_filter: status } : undefined,
      })
      .then((r) => r.data),
  approve: (id: string) =>
    client.post(`/ops/registration-requests/${id}/approve`).then((r) => r.data),
  reject: (id: string) =>
    client.post(`/ops/registration-requests/${id}/reject`).then((r) => r.data),

  /** 캡차/교육형 API 키 관리 */
  plans: () => client.get<OpsPlansResponse>('/ops/plans').then((r) => r.data),
  apiKeys: () => client.get<OpsApiKey[]>('/ops/api-keys').then((r) => r.data),
  issueApiKey: (body: {
    organization_id: string;
    product: string;
    subject?: string;
    label?: string;
    domain?: string;
  }) => client.post<OpsIssuedKey>('/ops/api-keys', body).then((r) => r.data),
  revokeApiKey: (id: string) => client.delete(`/ops/api-keys/${id}`).then((r) => r.data),

  /** 행동 데이터 (아동용 캡차 학습셋) */
  behaviorOverview: () =>
    client.get<BehaviorOverview>('/ops/behavior/overview').then((r) => r.data),
  behaviorRecords: (filter?: BehaviorRecordsFilter) =>
    client
      .get<BehaviorRecordsResponse>('/ops/behavior/records', { params: filter })
      .then((r) => r.data),
  markBehaviorDataset: (id: string, dataset_status: string) =>
    client
      .patch<{ ok: boolean; dataset_status: string }>(`/ops/behavior/records/${id}/dataset`, {
        dataset_status,
      })
      .then((r) => r.data),
  behaviorTrace: (id: string) =>
    client.get<BehaviorTraceDetail>(`/ops/behavior/records/${id}/trace`).then((r) => r.data),
};
