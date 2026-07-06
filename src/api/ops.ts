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
};
