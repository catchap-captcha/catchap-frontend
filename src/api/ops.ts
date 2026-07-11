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

/** 승인한 기관 관리자에게 발급된 임시 자격증명 (응답에서만 1회 노출) */
export interface OpsAdminCredential {
  email: string;
  temp_password: string;
  organization_id: string;
}

export interface OpsApproveResult {
  ok: boolean;
  status: string;
  admin_credentials: OpsAdminCredential[];
}

export interface OpsSendCredResult {
  ok: boolean;
  email_sent: boolean;
  email_status: string; // sent | dry_run | failed
  to: string;
}

export interface OpsAuditLog {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null; // 사람이 읽는 실행자(학생은 익명 코드)
  actor_email: string | null; // 계정 유일 식별용(동명 운영자/기관 관리자 구분). 학생/삭제계정은 null
  organization_id: string | null;
  org_name: string | null;
  target_type: string | null;
  target_id: string | null;
  detail: OpsAuditInquiryDetail | null; // 문의 답변 미리보기용 스레드 (그 외 액션은 null)
  created_at: string | null;
}

/** 감사로그 필터·페이지네이션 응답 (실무 수준) */
export interface OpsAuditLogPage {
  items: OpsAuditLog[];
  total: number;
  page: number;
  page_size: number;
  actions: string[]; // 행동 필터 선택지
  orgs: { id: string; name: string }[]; // 기관 필터 선택지
}

/** 감사로그 조회 필터 */
export interface OpsLogFilter {
  action?: string;
  organization_id?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  page?: number;
  page_size?: number;
}

/** 감사로그 문의답변 미리보기 — 원래 질문 + 그 문의에 달린 모든 답변 */
export interface OpsAuditInquiryDetail {
  question: string | null;
  question_by: string | null;
  question_email: string | null; // 회신용 문의자 이메일
  question_at: string | null;
  answers: { body: string; at: string | null }[];
}

/** 운영자(ops) 계정 */
export interface OpsOperator {
  id: string;
  name: string;
  email: string | null;
  status: string; // active | disabled
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface OpsOperatorCreated extends OpsOperator {
  ok: boolean;
  temp_password: string; // 생성 응답에서만 1회 노출 (이메일 실패/dry-run 시 수동 전달용)
  email_status: string; // sent | dry_run | failed — 임시 비번 자동 통보 결과
}

export interface OpsOrg {
  id: string;
  name: string;
  code: string;
  org_type: string;
  status: string; // pending | active | disabled
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  business_number: string | null;
  edu_subjects: string[]; // 구매한 교육형 과목(발급 허용 범위)
  students: number;
  created_at: string | null;
}

export interface OpsOrgCreated extends OpsOrg {
  ok: boolean;
  admin_email: string;
  admin_temp_password: string; // 생성 응답에서만 1회 노출 (이메일 실패/dry-run 시 수동 전달용)
  admin_email_status: string; // sent | dry_run | failed — 임시 비번 자동 통보 결과
}

export interface OpsOrgCreateInput {
  name: string;
  org_type: string;
  status?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  business_number?: string | null;
  admin_name: string;
  admin_email: string;
}

export type OpsOrgUpdateInput = Partial<Omit<OpsOrgCreateInput, 'admin_name' | 'admin_email'>>;

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
  first_party: boolean;
  site_key: string;
  status: string; // active | disabled
  plan: string;
  usage_month: number;
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
  first_party: boolean;
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
  by_label: Record<string, number>; // organic | bot | human (지도학습 라벨)
  hourly_week: number[]; // 최근 7일 KST 시간대(0~23)별 수집 건수
  solve_hist: { edges_ms: number[]; counts: number[] }; // 풀이시간 분포
  comparison: BehaviorGroupMetrics[];
}

export interface BehaviorStudent {
  // 아동 PII 비노출 — 서버가 학생 ID를 해시한 익명 코드와 학년밴드만 내려준다
  anon_code: string;
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
  input_type: string; // pointer | key | touch 등 입력 방식 (CSV 내보내기·분석용)
  sample_label: string | null; // 학습셋 큐레이션 라벨 (없으면 null)
  risk_level: string;
  dataset_status: string; // candidate | included | excluded
  trace_points: number | null; // null = 원시 궤적 없음
  trace_preview: [number, number][] | null; // 인라인 스파크라인용 다운샘플 [x,y] (없으면 null)
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
  label?: string; // organic | bot | human
  date_from?: string; // YYYY-MM-DD (KST)
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface OpsInquiryPage {
  items: OpsInquiry[];
  total: number;
  page: number;
  page_size: number;
  counts: { received: number; resolved: number; all: number };
}

export interface OpsSystemService {
  name: string;
  status: string; // ok | degraded | error | dry-run | not_deployed
  latency_ms: number | null;
  detail: string | null;
}
export interface OpsSystemHealth {
  services: OpsSystemService[];
  checked_at: string;
}

export interface OpsOrgPage {
  items: OpsOrg[];
  total: number;
  page: number;
  page_size: number;
  total_all: number;
  total_students: number;
}
export interface OpsApiKeyPage {
  items: OpsApiKey[];
  total: number;
  page: number;
  page_size: number;
  active_total: number; // 전체 활성 키 수(필터 무관)
}
export interface OpsRegRequestPage {
  items: OrgRegRequest[];
  total: number;
  page: number;
  page_size: number;
  counts: { pending: number; approved: number; rejected: number };
}

export interface OpsAiModel {
  id: string;
  category: string;
  name: string;
  provider: string;
  version: string;
  status: string; // 정상 | 베타 | 점검 | 중단
  description: string | null;
  updated_on: string | null;
}
export type OpsAiModelBody = Omit<OpsAiModel, 'id' | 'updated_on'>;

export const opsApi = {
  aiModels: () => client.get<OpsAiModel[]>('/ops/ai-models').then((r) => r.data),
  createAiModel: (body: OpsAiModelBody) =>
    client.post<OpsAiModel>('/ops/ai-models', body).then((r) => r.data),
  updateAiModel: (id: string, body: OpsAiModelBody) =>
    client.patch<OpsAiModel>(`/ops/ai-models/${id}`, body).then((r) => r.data),
  system: () => client.get<OpsSystemHealth>('/ops/system').then((r) => r.data),
  dashboard: () => client.get<OpsDashboard>('/ops/dashboard').then((r) => r.data),
  orgs: () => client.get<OpsOrg[]>('/ops/orgs').then((r) => r.data),
  /** 기관 목록 — 서버 페이지네이션+검색 (기관 관리 화면용) */
  orgsPage: (params: { search?: string; page: number; page_size?: number }) =>
    client.get<OpsOrgPage>('/ops/orgs', { params }).then((r) => r.data),
  createOrg: (body: OpsOrgCreateInput) =>
    client.post<OpsOrgCreated>('/ops/orgs', body).then((r) => r.data),
  updateOrg: (id: string, body: OpsOrgUpdateInput) =>
    client.patch<OpsOrg>(`/ops/orgs/${id}`, body).then((r) => r.data),
  deleteOrg: (id: string) => client.delete<{ ok: boolean }>(`/ops/orgs/${id}`).then((r) => r.data),

  /** 운영자 계정 관리 */
  operators: () => client.get<OpsOperator[]>('/ops/operators').then((r) => r.data),
  createOperator: (body: { name: string; email: string }) =>
    client.post<OpsOperatorCreated>('/ops/operators', body).then((r) => r.data),
  updateOperator: (id: string, body: { name?: string; status?: string }) =>
    client.patch<OpsOperator>(`/ops/operators/${id}`, body).then((r) => r.data),
  /** 운영자 임시 비밀번호 재설정 → 새 임시 비번 이메일 발송(1회 노출) + 기존 세션 폐기 */
  resetOperatorPassword: (id: string) =>
    client.post<OpsOperatorCreated>(`/ops/operators/${id}/reset-password`).then((r) => r.data),
  logs: (filter?: OpsLogFilter) =>
    client
      .get<OpsAuditLogPage>('/ops/logs', { params: filter && Object.keys(filter).length ? filter : undefined })
      .then((r) => r.data),
  inquiries: (params?: { status_filter?: string; search?: string; page?: number; page_size?: number }) =>
    client
      .get<OpsInquiryPage>('/ops/inquiries', { params })
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
  /** 가입 신청 목록 — 서버 페이지네이션 + 탭 배지 counts */
  registrationRequestsPage: (params: { status_filter?: string; page: number; page_size?: number }) =>
    client.get<OpsRegRequestPage>('/ops/registration-requests', { params }).then((r) => r.data),
  approve: (id: string) =>
    client
      .post<OpsApproveResult>(`/ops/registration-requests/${id}/approve`)
      .then((r) => r.data),
  /** 승인 시 발급된 관리자 임시 비밀번호를 담당자 이메일로 발송 */
  sendAdminCredentials: (orgId: string, email: string, tempPassword: string) =>
    client
      .post<OpsSendCredResult>(`/ops/orgs/${orgId}/send-admin-credentials`, {
        email,
        temp_password: tempPassword,
      })
      .then((r) => r.data),
  reject: (id: string) =>
    client.post(`/ops/registration-requests/${id}/reject`).then((r) => r.data),

  /** 캡차/교육형 API 키 관리 */
  plans: () => client.get<OpsPlansResponse>('/ops/plans').then((r) => r.data),
  apiKeys: () => client.get<OpsApiKey[]>('/ops/api-keys').then((r) => r.data),
  /** API 키 목록 — 서버 페이지네이션(+기관 필터) */
  apiKeysPage: (params: { organization_id?: string; page: number; page_size?: number }) =>
    client.get<OpsApiKeyPage>('/ops/api-keys', { params }).then((r) => r.data),
  issueApiKey: (body: {
    organization_id: string;
    product: string;
    subject?: string;
    label?: string;
    domain?: string;
    first_party?: boolean;
  }) => client.post<OpsIssuedKey>('/ops/api-keys', body).then((r) => r.data),
  revokeApiKey: (id: string) => client.delete(`/ops/api-keys/${id}`).then((r) => r.data),
  rotateSecret: (id: string) =>
    client
      .post<{ ok: boolean; site_key: string; secret_key: string }>(
        `/ops/api-keys/${id}/rotate-secret`,
      )
      .then((r) => r.data),
  /** 기관 구매 과목(edu_subjects) 설정 — 판매 프로비저닝 */
  setEntitlements: (orgId: string, edu_subjects: string[]) =>
    client
      .patch<{ ok: boolean; edu_subjects: string[] }>(`/ops/orgs/${orgId}/entitlements`, {
        edu_subjects,
      })
      .then((r) => r.data),

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
  /** 지도학습 라벨(bot/human/organic) 일괄 변경 — 다중 선택 큐레이션 */
  markBehaviorLabel: (ids: string[], sample_label: string) =>
    client
      .patch<{ ok: boolean; requested: number; changed: number; locked: number }>(
        '/ops/behavior/records/label',
        { ids, sample_label },
      )
      .then((r) => r.data),
  /** 레드팀 합성 봇 트래픽 생성 — sentinel org에 sample_label='bot' 적재 */
  behaviorRedteam: (count: number) =>
    client
      .post<{ ok: boolean; created: number }>('/ops/behavior/redteam', { count })
      .then((r) => r.data),
  behaviorTrace: (id: string) =>
    client.get<BehaviorTraceDetail>(`/ops/behavior/records/${id}/trace`).then((r) => r.data),

  /** 외부 업체 제공용 익명 내보내기 — 미리보기(JSON) */
  behaviorExportPreview: (params: {
    mode: 'aggregate' | 'rows';
    dataset?: string;
    source_type?: string;
    risk?: string;
    result_filter?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    client
      .get<BehaviorExportPreview>('/ops/behavior/export', { params: { ...params, fmt: 'json' } })
      .then((r) => r.data),
  /** 외부 업체 제공용 익명 내보내기 — CSV 다운로드(blob) */
  behaviorExportCsv: (params: {
    mode: 'aggregate' | 'rows';
    dataset?: string;
    source_type?: string;
    risk?: string;
    result_filter?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    client
      .get('/ops/behavior/export', { params: { ...params, fmt: 'csv' }, responseType: 'blob' })
      .then((r) => r.data as Blob),
};

export interface BehaviorExportPreview {
  mode: string;
  count: number;
  k_anon_min: number;
  k_dropped: number;
  columns: string[];
  rows: Record<string, string | number | null>[];
}
