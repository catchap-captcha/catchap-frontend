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
  /** 이 서버에서 도는 프로그램(사람이 읽는 이름). ★노드 카드에만 온다.
   *  표에 저장하지 않고 조회할 때 프로메테우스에서 바로 읽는다 — 파드는 옮겨 다니기 때문. */
  apps?: string[];
  /** 임계 초과 경보 — metric='수집'은 오래됨(값 없음). value/threshold는 %. */
  alerts?: { metric: string; value: number | null; threshold: number | null }[];
  /** 추이 그래프용 표본(데이터 있는 서버만). gpu는 GPU 없는 서버면 null 배열.
   *  range=요청 기간(6h/24h=raw 30초 표본, 7d/30d=시간별 롤업 평균). */
  history?: { range: string; t: string[]; cpu: number[]; mem: number[]; gpu: (number | null)[] };
}

/** 추이 기간 선택 — 6h/24h는 raw 표본, 7d/30d는 시간별 롤업 평균(서버가 소스를 가름). */
export type MetricRange = '6h' | '24h' | '7d' | '30d';
export const METRIC_RANGES: { key: MetricRange; label: string }[] = [
  { key: '6h', label: '6시간' },
  { key: '24h', label: '24시간' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];

export interface LlmUsage {
  tokens_in: number;
  tokens_out: number;
  est_cost_usd: number;
  providers: { provider: string; tokens_in: number; tokens_out: number; cost_usd: number }[];
}

export interface MonitoringData {
  servers: ServerMetric[];
  alert_count: number;
  thresholds: Record<string, number>;
  llm: LlmUsage;
  as_of: string;
  stale_after_sec: number;
}

export const monitoringApi = {
  /** 운영자 모니터링 대시보드 — 서버별 자원 + LLM 사용량. 백엔드는 요청 시 self-collect(실측).
   *  range로 추이 기간을 고른다(기본 6h). */
  get: (range: MetricRange = '6h') =>
    client.get<MonitoringData>('/ops/monitoring', { params: { range } }).then((r) => r.data),
};
