import { client } from './client';

export type BehaviorExportMode = 'aggregate' | 'rows';
export type BehaviorExportStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'expired';

export interface BehaviorExportFilters {
  mode: BehaviorExportMode;
  dataset?: string;
  source_type?: string;
  risk?: string;
  result_filter?: string;
  date_from?: string;
  date_to?: string;
}

export interface BehaviorExportPreview {
  mode: BehaviorExportMode;
  count: number;
  k_anon_min: number;
  k_dropped: number;
  columns: string[];
  rows: Record<string, string | number | null>[];
  snapshot_at: string;
}

export interface BehaviorExportJob {
  id: string;
  mode: BehaviorExportMode;
  status: BehaviorExportStatus;
  phase: string | null;
  filters: Record<string, string>;
  purpose: string;
  dua_acknowledged: boolean;
  snapshot_at: string;
  row_count: number;
  processed_count: number;
  k_dropped: number;
  file_name: string | null;
  file_size: number | null;
  sha256: string | null;
  error_detail: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
}

export interface BehaviorExportCreate extends BehaviorExportFilters {
  purpose: string;
  dua_acknowledged: boolean;
  idempotency_key: string;
}

export const behaviorExportsApi = {
  preview: (params: BehaviorExportFilters) =>
    client
      .get<BehaviorExportPreview>('/ops/behavior/export/preview', { params })
      .then((response) => response.data),

  create: (body: BehaviorExportCreate) =>
    client
      .post<BehaviorExportJob>('/ops/behavior/exports', body)
      .then((response) => response.data),

  list: () =>
    client
      .get<{ items: BehaviorExportJob[] }>('/ops/behavior/exports')
      .then((response) => response.data.items),

  get: (jobId: string) =>
    client
      .get<BehaviorExportJob>('/ops/behavior/exports/' + jobId)
      .then((response) => response.data),

  downloadLink: (jobId: string) =>
    client
      .post<{ url: string; expires_in: number; file_name: string; sha256: string }>(
        '/ops/behavior/exports/' + jobId + '/download-link',
      )
      .then((response) => response.data),
};
