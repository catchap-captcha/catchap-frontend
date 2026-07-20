import { client } from './client';

/** 서버 자원 스냅샷(운영 모니터링). no_data=true면 아직 수집 전(에이전트 미배포 등). */
export interface ServerMetric {
  server_key: string;
  label: string;
  no_data: boolean;
  host?: string | null;
  cpu_pct?: number;
  cpu_cores?: number;
  load1?: number | null;
  mem_pct?: number;
  mem_used_mb?: number;
  mem_total_mb?: number;
  disk_pct?: number;
  disk_used_gb?: number;
  disk_total_gb?: number;
  gpu_present?: boolean;
  gpu_name?: string | null;
  gpu_util_pct?: number | null;
  gpu_mem_used_mb?: number | null;
  gpu_mem_total_mb?: number | null;
  age_sec?: number | null;
  stale?: boolean;
}

export interface LlmUsage {
  tokens_in: number;
  tokens_out: number;
  est_cost_usd: number;
  providers: { provider: string; tokens_in: number; tokens_out: number; cost_usd: number }[];
}

export interface MonitoringData {
  servers: ServerMetric[];
  llm: LlmUsage;
  as_of: string;
  stale_after_sec: number;
}

export const monitoringApi = {
  /** 운영자 모니터링 대시보드 — 서버별 자원 + LLM 사용량. 백엔드는 요청 시 self-collect(실측). */
  get: () => client.get<MonitoringData>('/ops/monitoring').then((r) => r.data),
};
