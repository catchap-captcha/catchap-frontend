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

/** POST /progress 응답 — 서버가 검증한 정본. checkpoint_due=true면 캡차 게이트를 띄운다.
 *  (exempted 필드는 상호작용 면제 제거와 함께 사라졌다 — 체크포인트면 예외 없이 캡차) */
export interface HeartbeatState {
  watched_max_sec: number;
  next_checkpoint_sec: number | null;
  checkpoint_due: boolean;
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
  order_no?: number;
  status: string; // active | hidden
  question_count: number;
  /** 공개 문항 수 — 0이면 확인(캡차)이 아예 안 떠서 시청 검증이 없는 강의(콘솔 경고 근거) */
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
  /** 유효 정답 목록(다답형 — 학생은 전부 담아야 정답, 부분 정답 없음). 단일 정답 행도
   *  서버가 [answer_index]로 채워 내려 콘솔은 항상 이 필드로 체크박스를 그린다.
   *  구버전 서버는 필드를 안 주므로 옵셔널 — 없으면 [answer_index]로 본다. */
  answer_indexes?: number[];
  source: string; // manual | llm
  status: string; // draft | active
  order_no: number;
  /* (제거됨 0717) window_sec — 구간 출제. 모든 문항이 position_sec 정각의 고정 핀이다
     (되감기(cp-REWIND) 기준과 내용 시점이 어긋나는 버그로 구간을 걷어냈다 — 서버 lecture_pin_03) */
  /** 문제 이미지 서빙 URL(`/api/v1/...` 상대경로 — <img>에는 API_ORIGIN을 붙인다). 없으면 null */
  prompt_image_url: string | null;
  /** 보기와 같은 길이 — 이미지 없는 보기는 null. 이미지가 있는 보기는 텍스트를 비울 수 있다(그림 전용 보기) */
  option_image_urls: (string | null)[];
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

  /** 시청 하트비트 — 세션 식별은 X-Lecture-Session 서명 토큰으로만 한다.
   *  (interacted/tab_hidden 자기신고는 면제·의심 가중 제거와 함께 계약에서 빠졌다) */
  heartbeat: (
    lectureId: string,
    sessionToken: string,
    body: { position_sec: number },
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
      order_no: number;
      status: string;
    }>,
  ) => client.put<OpsLecture>(`/ops/lectures/${lectureId}`, body).then((r) => r.data),

  opsDelete: (lectureId: string) =>
    client.delete<{ ok: boolean }>(`/ops/lectures/${lectureId}`).then((r) => r.data),

  /** 운영자 미리보기 스트림 발급 — 문항 시점을 눈으로 찾고 강의 화면을 따오기 위한 재생.
   *  학생 세션을 만들지 않는다(같은 계정 학생 세션을 걷어차지 않음). stream_url은 서명 토큰이
   *  쿼리에 붙은 상대경로 — <video src>에는 API_ORIGIN을 붙여 쓴다. */
  opsPreview: (lectureId: string) =>
    client
      .post<{ stream_url: string; duration_sec: number }>(`/ops/lectures/${lectureId}/preview`)
      .then((r) => r.data),

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
      /** 다답 정답 목록 — 함께 보내면 이것이 정본(answer_index는 첫 값으로 동기화됨).
       *  구버전 서버는 이 필드를 무시하고 answer_index만 쓴다(단일 정답으로 저장). */
      answer_indexes?: number[];
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
      /** 다답 정답 목록 — 보내면 목록이 정본, answer_index만 보내면 단일 정답으로 전환 */
      answer_indexes: number[];
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

  /** 문항 이미지 첨부(multipart) — slot=prompt는 문제, slot=option은 optionIndex 보기(0부터).
   *  같은 슬롯에 다시 올리면 교체. png/jpg/jpeg/gif/webp만, 5MB 상한(초과·svg는 서버 400 detail).
   *  갱신된 문항 행을 돌려주지만, 성공 표기는 호출자가 재조회로 실재 확인 후에만 한다. */
  attachQuestionImage: (
    lectureId: string,
    questionId: string,
    args: { slot: 'prompt' | 'option'; optionIndex?: number; file: File },
    onProgress?: (e: AxiosProgressEvent) => void,
  ) => {
    const fd = new FormData();
    fd.append('slot', args.slot);
    if (args.slot === 'option' && args.optionIndex != null)
      fd.append('option_index', String(args.optionIndex));
    fd.append('file', args.file);
    return client
      .post<OpsLectureQuestion>(
        `/ops/lectures/${lectureId}/questions/${questionId}/images`,
        fd,
        { onUploadProgress: onProgress },
      )
      .then((r) => r.data);
  },

  /** 문항 이미지 제거 — 텍스트가 빈 보기의 이미지는 서버가 400으로 거부한다(보기가 통째로 비니까) */
  deleteQuestionImage: (
    lectureId: string,
    questionId: string,
    args: { slot: 'prompt' | 'option'; optionIndex?: number },
  ) =>
    client
      .delete<OpsLectureQuestion>(`/ops/lectures/${lectureId}/questions/${questionId}/images`, {
        params: {
          slot: args.slot,
          ...(args.slot === 'option' && args.optionIndex != null
            ? { option_index: args.optionIndex }
            : {}),
        },
      })
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
