import type { AxiosProgressEvent } from 'axios';
import { client } from './client';

/**
 * 강의 시청 검증 API — 학생 시청(목록/상세/세션/하트비트/이어보기) + 운영자 강의·문항·자료 CRUD.
 *
 * 세션 토큰(session_token)은 여기서 저장하지 않는다 — 호출자(LecturePlayer)가 메모리(ref)에만
 * 쥐고 하트비트마다 X-Lecture-Session 헤더로 넘긴다(localStorage 금지: 탭 단위 세션이고,
 * 영속시키면 두 탭이 같은 토큰을 공유해 동시 재생 차단이 무력화된다).
 */

/** 스트림/다운로드 절대 URL의 오리진 — 백엔드가 주는 경로(`/api/v1/...`) 앞에 붙인다. */
export const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

export interface LectureProgress {
  watched_max_sec: number;
  next_checkpoint_sec: number | null;
  checkpoints_passed: number;
  status: string; // watching | done
}

export interface LectureItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  order_no: number;
  duration_sec: number;
  question_count: number;
  progress: LectureProgress | null; // null = 아직 시작 안 함
}

export interface LectureMaterialItem {
  id: string;
  title: string;
  kind: 'link' | 'file';
  order_no: number;
  file_ext: string | null;
  file_bytes: number;
  url?: string; // kind=link — 새 탭으로 직접 이동
  download_url?: string; // kind=file — 학생 JWT 필요(axios blob으로 받는다)
}

export interface LectureDetail extends LectureItem {
  next_checkpoint_sec: number | null;
  materials: LectureMaterialItem[];
  /** 같은 과목의 강의 목차(사이드바용) — (order_no, created_at) 오름차순 + 내 진행 */
  toc: LectureItem[];
}

/** POST /session·/takeover 공통 응답 — 서명 세션 토큰 + 세션 바인딩 stream_url + 진행 정본 */
export interface LectureSession {
  ok: boolean;
  session_id: string;
  session_token: string;
  stream_url: string; // `/api/v1/lectures/{id}/stream?t=...` — API_ORIGIN을 붙여 쓴다
  watched_max_sec: number;
  next_checkpoint_sec: number | null;
  checkpoints_passed: number;
  status: string;
  duration_sec: number;
}

/** POST /progress 응답 — 서버가 검증한 정본. checkpoint_due=true면 캡차 게이트를 띄운다. */
export interface HeartbeatState {
  watched_max_sec: number;
  next_checkpoint_sec: number | null;
  checkpoint_due: boolean;
  exempted: boolean; // true면 상호작용 면제 — 캡차 없이 계속 재생
  checkpoints_passed: number;
  status: string;
  duration_sec: number;
}

export interface OpsLecture {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  video_ext: string;
  video_bytes: number;
  duration_sec: number;
  check_min_sec: number;
  check_max_sec: number;
  order_no?: number;
  status: string; // active | hidden
  question_count: number;
  active_question_count: number;
  created_at: string | null;
}

export interface OpsLectureQuestion {
  id: string;
  lecture_id: string;
  position_sec: number;
  prompt: string | null;
  options: string[];
  explain: string | null;
  answer_index: number;
  source: string; // manual | llm
  status: string; // draft | active
  order_no: number;
}

export interface OpsLectureMaterial {
  id: string;
  lecture_id?: string;
  title: string;
  kind: 'link' | 'file';
  url: string | null;
  order_no: number;
  file_ext: string | null;
  file_bytes: number;
  status?: string;
  created_at?: string | null;
}

export const lectureApi = {
  /* ================= 학생 ================= */
  list: (subject?: string) =>
    client.get<LectureItem[]>('/lectures', { params: { subject } }).then((r) => r.data),

  detail: (lectureId: string) =>
    client.get<LectureDetail>(`/lectures/${lectureId}`).then((r) => r.data),

  /** 재생 시작 — 다른 활성 세션이 있으면 409 {detail:{active_elsewhere:true}} */
  startSession: (lectureId: string) =>
    client.post<LectureSession>(`/lectures/${lectureId}/session`).then((r) => r.data),

  /** 시청 하트비트 — 세션 식별은 X-Lecture-Session 서명 토큰으로만 한다 */
  heartbeat: (
    lectureId: string,
    sessionToken: string,
    body: { position_sec: number; interacted: boolean; tab_hidden: boolean },
  ) =>
    client
      .post<HeartbeatState>(`/lectures/${lectureId}/progress`, body, {
        headers: { 'X-Lecture-Session': sessionToken },
      })
      .then((r) => r.data),

  /** 이어보기 — 이전 활성 세션을 무효화하고 새 토큰·stream_url을 받는다 */
  takeover: (lectureId: string) =>
    client.post<LectureSession>(`/lectures/${lectureId}/takeover`).then((r) => r.data),

  /** file 자료 다운로드 — 학생 JWT가 필요해서 <a href>가 아니라 blob으로 받는다 */
  downloadMaterial: (lectureId: string, materialId: string) =>
    client
      .get<Blob>(`/lectures/${lectureId}/materials/${materialId}/download`, {
        responseType: 'blob',
      })
      .then((r) => r),

  /* ================= 운영자 ================= */
  opsList: () => client.get<OpsLecture[]>('/ops/lectures').then((r) => r.data),

  /** 강의 업로드(multipart) — onProgress로 업로드 진행률을 노출한다 */
  opsCreate: (form: FormData, onProgress?: (e: AxiosProgressEvent) => void) =>
    client
      .post<OpsLecture>('/ops/lectures', form, { onUploadProgress: onProgress })
      .then((r) => r.data),

  opsUpdate: (
    lectureId: string,
    body: Partial<{
      title: string;
      description: string;
      subject: string;
      duration_sec: number;
      check_min_sec: number;
      check_max_sec: number;
      order_no: number;
      status: string;
    }>,
  ) => client.put<OpsLecture>(`/ops/lectures/${lectureId}`, body).then((r) => r.data),

  opsDelete: (lectureId: string) =>
    client.delete<{ ok: boolean }>(`/ops/lectures/${lectureId}`).then((r) => r.data),

  /* ---- 확인 문항 ---- */
  opsQuestions: (lectureId: string) =>
    client.get<OpsLectureQuestion[]>(`/ops/lectures/${lectureId}/questions`).then((r) => r.data),

  opsQuestionCreate: (
    lectureId: string,
    body: {
      position_sec: number;
      prompt: string;
      options: string[];
      answer_index: number;
      explain?: string;
      status?: string;
    },
  ) =>
    client
      .post<OpsLectureQuestion>(`/ops/lectures/${lectureId}/questions`, body)
      .then((r) => r.data),

  opsQuestionUpdate: (
    lectureId: string,
    questionId: string,
    body: Partial<{
      position_sec: number;
      prompt: string;
      options: string[];
      answer_index: number;
      explain: string;
      status: string;
    }>,
  ) =>
    client
      .put<OpsLectureQuestion>(`/ops/lectures/${lectureId}/questions/${questionId}`, body)
      .then((r) => r.data),

  opsQuestionDelete: (lectureId: string, questionId: string) =>
    client
      .delete<{ ok: boolean }>(`/ops/lectures/${lectureId}/questions/${questionId}`)
      .then((r) => r.data),

  /** LLM 문항 자동 생성 — 키 미설정이면 503(정직한 에러, stub 생성 없음) */
  opsQuestionGenerate: (lectureId: string, n: number) =>
    client
      .post<{ created: number; questions: OpsLectureQuestion[] }>(
        `/ops/lectures/${lectureId}/questions/generate`,
        { n },
      )
      .then((r) => r.data),

  /* ---- 자료실 ---- */
  opsMaterials: (lectureId: string) =>
    client.get<OpsLectureMaterial[]>(`/ops/lectures/${lectureId}/materials`).then((r) => r.data),

  opsMaterialCreateLink: (lectureId: string, body: { title: string; url: string; order_no?: number }) =>
    client
      .post<OpsLectureMaterial>(`/ops/lectures/${lectureId}/materials`, body)
      .then((r) => r.data),

  opsMaterialCreateFile: (
    lectureId: string,
    form: FormData,
    onProgress?: (e: AxiosProgressEvent) => void,
  ) =>
    client
      .post<OpsLectureMaterial>(`/ops/lectures/${lectureId}/materials`, form, {
        onUploadProgress: onProgress,
      })
      .then((r) => r.data),

  opsMaterialUpdate: (
    lectureId: string,
    materialId: string,
    body: Partial<{ title: string; order_no: number }>,
  ) =>
    client
      .put<OpsLectureMaterial>(`/ops/lectures/${lectureId}/materials/${materialId}`, body)
      .then((r) => r.data),

  opsMaterialDelete: (lectureId: string, materialId: string) =>
    client
      .delete<{ ok: boolean }>(`/ops/lectures/${lectureId}/materials/${materialId}`)
      .then((r) => r.data),
};

/** axios 에러에서 active_elsewhere(다른 곳에서 시청 중, 409) 여부를 판별한다. */
export function isActiveElsewhere(e: unknown): boolean {
  const err = e as { response?: { status?: number; data?: { detail?: unknown } } };
  if (err?.response?.status !== 409) return false;
  const detail = err.response?.data?.detail;
  return !!(detail && typeof detail === 'object' && (detail as { active_elsewhere?: boolean }).active_elsewhere);
}

/** axios 에러에서 사용자에게 보여줄 detail 문구를 꺼낸다(없으면 fallback). */
export function errorDetail(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { detail?: unknown } } };
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (detail && typeof detail === 'object') {
    const msg = (detail as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}
