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
  /** 소속 코스 id — null이면 미분류. 학생 목록을 과목 → 강사별 코스 → 강의로 묶는 근거 */
  course_id: string | null;
  order_no: number;
  duration_sec: number;
  question_count: number;
  progress: LectureProgress | null; // null = 아직 시작 안 함
}

/** 학생용 코스 — 활성 코스 + 강사 실명 + 활성 강의 수. GET /courses. */
export interface StudentCourse {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  order_no: number;
  instructor_name: string | null;
  lecture_count: number;
  /** 코스 Q(3단계-b) — 이 코스 강의에서 은행에 배치된 문항 수(총). 0이면 배지 숨김 */
  bank_question_count?: number;
  /** 그중 이 학생이 완주한 강의의 문항 수 — >0이면 '이 코스 문제 풀기' 버튼,
   *  0인데 총>0이면 "강의 완주 시 열려요" 잠금 안내(배움→연습 순서를 화면이 말해준다) */
  unlocked_question_count?: number;
  /** 수료 시험 요약(#28) — 없음/잠김/응시가능(진행)/수료 카드 렌더의 원천.
   *  '나의 기록' 수료 현황(수료 완료/진행 중/잠김 칸)도 이 요약 하나로 그린다. */
  exam?: {
    has_exam: boolean; // 활성 시험 문항 0개면 false(시험 카드 숨김)
    question_count: number;
    mastered_count: number;
    available: boolean; // 전 강의 완주 + 문항 있음
    lectures_done: number;
    lectures_total: number;
    passed: boolean;
    perfect: boolean;
    passed_at: string | null; // 수료일(미수료면 null)
    last_activity_at: string | null; // 마지막 시험 활동 시각 — '진행 중' 최신순 정렬용(안 본 코스는 null)
  };
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
  /** 소속 코스 id — null이면 미분류(코스 도입 전 강의 또는 코스에서 뺀 강의) */
  course_id: string | null;
  created_at: string | null;
}

/** 강사 코스 — 한 강사가 한 과목으로 묶는 강의 묶음(예: '수학 기초반'). 코스=과목 고정
 *  (도입 배경·설계는 docs/product-direction.md §3.5). 강사는 자기 코스만, 운영자는 전체. */
export interface OpsCourse {
  id: string;
  title: string;
  subject: string; // 고정 — 담기는 모든 강의가 이 과목
  description: string | null;
  order_no: number;
  status: string; // active | hidden
  instructor_id: string;
  lecture_count: number;
  created_at: string | null;
}

/** 코스 수료 시험 문항(강사) — 인덱스 기반(강의 문항과 같은 형식·채점 재사용). */
export type ExamOrigin = 'manual' | 'past_exam' | 'lecture' | 'llm';
export interface OpsExamQuestion {
  id: string;
  course_id: string;
  prompt: string;
  options: string[];
  answer_indexes: number[];
  explain: string | null;
  origin: ExamOrigin;
  /** 출처 문구 — origin=past_exam이면 필수. 화면(카드·결과지)에 상시 노출(비영리 전제) */
  source: string | null;
  order_no: number;
  status: string; // draft | active
  created_at: string | null;
}
export interface ExamQuestionInput {
  prompt: string;
  options: string[];
  answer_indexes: number[];
  explain?: string | null;
  origin?: ExamOrigin;
  source?: string | null;
  status?: string;
  order_no?: number;
}

/** 코스 수료 시험 상태(학생) — 시험 카드가 읽는 단일 원천. */
export interface ExamState {
  course_id: string;
  title: string;
  has_exam: boolean; // 활성 문항 0개면 false(시험 없는 코스)
  question_count: number;
  mastered_count: number; // 정복(정답 이력) 문항 수
  lectures_total: number;
  lectures_done: number;
  available: boolean; // 전 강의 완주 + 문항 있음
  passed: boolean;
  perfect: boolean;
  passed_at: string | null;
  /** 완벽 도전 가능 — 수료했지만 아직 완벽 통과 아님(전 문항 한 판으로 승급 도전) */
  can_perfect_challenge: boolean;
}
/** 발급된 회차 — 정답·해설 없음. 수료 후엔 questions 없이 passed=true. */
export interface ExamSessionQuestion {
  question_id: string;
  prompt: string;
  options: string[]; // 표시 순서(셔플됨)
  multi: boolean; // 다답(복수 선택) 여부
  origin: ExamOrigin;
  source: string | null;
}
export interface ExamSession {
  passed: boolean;
  perfect?: boolean;
  passed_at?: string | null;
  sitting_id?: string;
  questions?: ExamSessionQuestion[];
  /** 완벽 도전 회차(전 문항 한 판) 여부 — 화면 문구를 '완벽 도전'으로 바꾼다 */
  perfect_challenge?: boolean;
  progress?: { mastered: number; total: number };
}
export interface ExamSubmitInput {
  sitting_id: string;
  answers: { question_id: string; picks: number[] }[]; // picks = 표시 순서 기준 선택
  solve_time_ms?: number;
}
export interface ExamResultItem {
  question_id: string;
  prompt: string;
  options: string[];
  picked: number[];
  answer: number[]; // 정답의 표시 위치
  correct: boolean;
  explain: string | null;
  origin: ExamOrigin;
  source: string | null;
}
export interface ExamSubmitResult {
  total: number;
  correct: number;
  results: ExamResultItem[];
  /** 발급 후 강사 편집으로 채점 못 한 문항 수 — >0이면 '다음 회차에 다시' 안내 */
  stale: number;
  progress: { mastered: number; total: number };
  passed: boolean;
  perfect: boolean;
}

export interface OpsLectureQuestion {
  id: string;
  lecture_id: string;
  position_sec: number;
  /** 되감기 지점(이 문항이 다루는 내용의 시작, 초) — null = 미지정(서버 폴백: 출제 시점-30초).
   *  오답 3회 시 서버가 watched_max를 여기로 되감아 그 대목부터 다시 보게 한다. */
  content_start_sec: number | null;
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
  /** 자기검증(2번째 LLM) 판정 — LLM 자동 생성 문항에만. null=미판정/수기 문항.
   *  왜 이렇게 판정하나(팀 학습용): 데이터셋 구축의 'adversarial filtering' 기법.
   *  강의를 안 본 LLM(=봇)이 풀 수 있는 문제는 시청 검증용으로 무가치하므로 걸러낸다.
   *  - solver_passed(블라인드): 공개 맥락(제목·과목)만 주고 보기를 셔플해 3회 다수결로
   *    풀렸는지. true = 상식으로 풀림 → 캡차 부적합(전체학습 은행 후보).
   *  - transcript_solver_passed: 자막을 '주면' 풀리는지. false면 자막을 줘도 못 푸는
   *    문항 = 환각·모호 등 불량 의심(폐기 권고). null = 자막(STT) 미사용이라 판별 불가. */
  solver_passed?: boolean | null;
  transcript_solver_passed?: boolean | null;
  /** captcha = 강의 의존·정상(이상적) / bank = 상식 / discard = 불량 의심. null=미판정 */
  suggested_placement?: 'captcha' | 'bank' | 'discard' | null;
  /** 판정 감사 메타 — 어느 모델이 언제 몇 회 다수결로 판정했나(재현·추적용) */
  solver_meta?: { model: string; verified_at: string; trials: number } | null;
  /** 전체학습 은행 배치 이력 — 배치되면 {bank_id, at}. 중복 배치 방지·배지 근거 */
  bank_placed?: { bank_id: string; at: string } | null;
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

  /** 학생용 코스 목록 — 활성 코스(강사 실명·활성 강의 수 포함). 강의 목록을 과목 →
   *  강사별 코스 → 강의로 묶을 때 상위 그룹 메타로 쓴다(활성 강의 0개 코스는 서버가 제외). */
  courses: (subject?: string) =>
    client.get<StudentCourse[]>('/courses', { params: { subject } }).then((r) => r.data),

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
      /** 소속 코스 — 미전송=변경 없음, null=미분류로 빼기, id=그 코스로 이동(과목 일치 강제·서버 400).
       *  콘솔은 코스 변경 의도가 있을 때만 이 키를 넣는다(과목 변경 등 무관 수정은 코스 유지). */
      course_id: string | null;
    }>,
  ) => client.put<OpsLecture>(`/ops/lectures/${lectureId}`, body).then((r) => r.data),

  opsDelete: (lectureId: string) =>
    client.delete<{ ok: boolean }>(`/ops/lectures/${lectureId}`).then((r) => r.data),

  /** 드래그로 바꾼 강의 순서 저장 — 한 그룹(한 코스 또는 한 과목의 미분류)의 강의 전체를
   *  새 순서대로 보낸다. 서버가 차례대로 order_no=1,2,3…을 부여한다(부분 전송 금지 — 서버 주석). */
  opsReorderLectures: (lectureIds: string[]) =>
    client
      .put<{ ok: boolean; count: number }>('/ops/lectures/reorder', { lecture_ids: lectureIds })
      .then((r) => r.data),

  /* ---- 강사 코스 ---- (코스=과목 고정. 강사는 자기 코스만, 운영자는 전체 — 서버 스코프) */
  opsCourses: () => client.get<OpsCourse[]>('/ops/courses').then((r) => r.data),

  /** 코스 생성 — subject는 여기서 고정된다(생성 후 못 바꿈). 미지원 과목은 400. */
  opsCourseCreate: (body: { title: string; subject: string; description?: string | null }) =>
    client.post<OpsCourse>('/ops/courses', body).then((r) => r.data),

  /** 코스 수정 — subject는 스키마에 없다(코스=과목 고정). 미전송 필드는 변경 없음. */
  opsCourseUpdate: (
    courseId: string,
    body: Partial<{ title: string; description: string | null; order_no: number; status: string }>,
  ) => client.put<OpsCourse>(`/ops/courses/${courseId}`, body).then((r) => r.data),

  /** 코스 소프트 삭제 — 소속 강의는 미분류(course_id=null)로 풀려날 뿐 삭제되지 않는다.
   *  lectures_unassigned = 풀려난 강의 수(사용자 안내용). */
  opsCourseDelete: (courseId: string) =>
    client
      .delete<{ ok: boolean; lectures_unassigned: number }>(`/ops/courses/${courseId}`)
      .then((r) => r.data),

  /* ---- 코스 수료 시험 문항(강사) ---- (완전학습 — docs/course-exam-design.md)
   *  강의 문항 모달의 단순화판: 출제 시점·되감기 없음, 대신 origin·source(기출 출처).
   *  기출(past_exam)은 source 필수(서버 400) — 비영리 교육용 이용 전제. */
  opsExamQuestions: (courseId: string) =>
    client.get<OpsExamQuestion[]>(`/ops/courses/${courseId}/exam-questions`).then((r) => r.data),

  opsExamQuestionCreate: (courseId: string, body: ExamQuestionInput) =>
    client
      .post<OpsExamQuestion>(`/ops/courses/${courseId}/exam-questions`, body)
      .then((r) => r.data),

  opsExamQuestionUpdate: (courseId: string, questionId: string, body: Partial<ExamQuestionInput>) =>
    client
      .put<OpsExamQuestion>(`/ops/courses/${courseId}/exam-questions/${questionId}`, body)
      .then((r) => r.data),

  opsExamQuestionDelete: (courseId: string, questionId: string) =>
    client
      .delete<{ ok: boolean }>(`/ops/courses/${courseId}/exam-questions/${questionId}`)
      .then((r) => r.data),

  /** to-exam: 코스 강의의 활성 확인 문항을 시험 문항(draft)으로 일괄 복사(멱등). */
  opsExamImportFromLectures: (courseId: string) =>
    client
      .post<{ imported: number; skipped: number }>(
        `/ops/courses/${courseId}/exam-questions/import-from-lectures`,
      )
      .then((r) => r.data),

  /** LLM 코스 시험 문항 자동 생성(origin=llm, draft) — 운영자가 고른 생성 슬롯 모델 사용. */
  opsExamGenerate: (courseId: string, n: number) =>
    client
      .post<{ created: number; questions: OpsExamQuestion[] }>(
        `/ops/courses/${courseId}/exam-questions/generate`,
        { n },
      )
      .then((r) => r.data),

  /* ---- 코스 수료 시험(학생) ---- */
  examState: (courseId: string) =>
    client.get<ExamState>(`/courses/${courseId}/exam`).then((r) => r.data),

  /** 회차 발급 — 미완주면 403, 수료 후엔 {passed:true}. 정답·해설 미포함, 보기 셔플됨.
   *  perfect=true(완벽 도전)는 수료 학생 전용 — 전 문항을 한 판에 내서 다 맞히면 완벽 통과 승급. */
  examSession: (courseId: string, perfect = false) =>
    client
      .post<ExamSession>(`/courses/${courseId}/exam/session`, undefined, {
        params: perfect ? { perfect: true } : undefined,
      })
      .then((r) => r.data),

  /** 회차 제출 → 결과지(문항별 정오·해설·출처) + 진행 + 수료 여부 */
  examSubmit: (courseId: string, body: ExamSubmitInput) =>
    client.post<ExamSubmitResult>(`/courses/${courseId}/exam/submit`, body).then((r) => r.data),

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
      /** 되감기 지점 — null/미전송 = 미지정(서버 폴백). 지정 시 position_sec보다 앞이어야 함(서버 400) */
      content_start_sec?: number | null;
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
      /** 미전송 = 변경 없음, 명시적 null = 지정 해제(폴백 복귀) — 콘솔은 저장 시 항상 명시로 보낸다 */
      content_start_sec: number | null;
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

  /** 강의 문항 → 전체학습 은행 배치 — 자기검증 '은행 적합' 판정의 실행.
   *  형식 변환(인덱스→옵션id)은 서버가 담당. runtime_visible=false면 반영 실패(정직 노출).
   *  다답형·이미지 문항은 400, 은행 미적재(파일 폴백)·중복 배치는 409. */
  opsQuestionToBank: (lectureId: string, questionId: string) =>
    client
      .post<{ ok: boolean; bank_id: string; runtime_visible: boolean; demoted_from_active: boolean }>(
        `/ops/lectures/${lectureId}/questions/${questionId}/to-bank`,
      )
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

  /** LLM 문항 자동 생성 — 키 미설정이면 503(정직한 에러, stub 생성 없음).
   *  self_verified: 2번째 LLM이 봇 저항성을 판정했는지. bank/captcha_candidates=후보 수. */
  opsQuestionGenerate: (lectureId: string, n: number) =>
    client
      .post<{
        created: number;
        transcript_used: boolean;
        self_verified: boolean;
        bank_candidates: number | null;
        captcha_candidates: number | null;
        discard_candidates: number | null;
        verify_error: string | null;
        questions: OpsLectureQuestion[];
      }>(`/ops/lectures/${lectureId}/questions/generate`, { n })
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
