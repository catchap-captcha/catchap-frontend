import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  API_ORIGIN,
  errorDetail,
  lectureApi,
  type ExamOrigin,
  type ExamStats,
  type OpsCourse,
  type OpsExamQuestion,
  type OpsLecture,
  type OpsLectureMaterial,
  type OpsLectureQuestion,
  type OpsTrashLecture,
  type TranscriptStatus,
  type TranscriptSegment,
  thumbnailSrc,
} from '../../api/lectures';
import OpsNav from '../../components/ops/OpsNav';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';
import './OpsApproval.css';
import './OpsLectures.css';

/** 강의 관리 — 영상 업로드(진행률)·메타 수정·소프트 삭제 + 확인 문항·자료실 CRUD.
 * 성공 표기는 서버 확정 후에만 한다(업로드는 완료 후 목록 재조회로 실재 확인 — 가짜 성공 금지). */

const SUBJECTS = ['국어', '영어', '수학', '과학', '사회', '생활'];
// 코스 브라우징용 대분류(학교식 과목 대체) — 이수·수료 검증형 교육 기준. 자유롭게 조정 가능.

/* (제거됨 0717) 시청 확인 간격 프리셋 — 출제 시점이 전부 핀(문항의 position_sec 고정)이
   되면서 무작위 간격 설정 자체가 사라졌다. 확인이 뜨는 시점은 문항 등록에서 지정한다.
   (구간 모드도 함께 제거 — 되감기(cp-REWIND) 기준과 내용 시점이 어긋나는 버그. 서버 lecture_pin_03) */

/** 초 → "29분 12초" 사람이 읽는 형태 (강사용 표시) */
function humanDur(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h ? `${h}시간` : '', m ? `${m}분` : '', s ? `${s}초` : ''].filter(Boolean).join(' ');
}

/** 바이트 → "247.3MB" */
function humanSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

type Modal =
  | { mode: 'create'; courseId?: string }
  | { mode: 'edit'; lec: OpsLecture }
  | { mode: 'questions'; lec: OpsLecture }
  | { mode: 'materials'; lec: OpsLecture }
  | { mode: 'trash' }
  | null;

/** 강의 목록을 과목 → 코스 → 강의로 묶은 섹션. 각 섹션 안에서만 드래그로 순서를 바꾼다
 *  (코스 이동은 순서가 아니라 소속 변경이라 강의 수정에서 한다). courseId=null = 그 과목의 미분류. */
interface LectureGroup {
  key: string;
  subject: string;
  courseId: string | null;
  title: string;
  lectures: OpsLecture[];
}

/** rows(백엔드 목차순: 과목·order_no·created_at)를 과목별로 코스 그룹 + 미분류 그룹으로 나눈다.
 *  courses는 (과목·order_no)순이라 그 순서대로 코스 섹션이 놓인다. 강의 0개 코스는 기본으론
 *  숨기지만(순서 바꿀 게 없음), includeEmpty면 빈 그룹으로 넣어 '강의 없음 → 업로드' 안내를
 *  목록에 노출한다(검색·필터 중이 아닐 때만 — 필터 중엔 노이즈라 숨긴다). */
function buildLectureGroups(
  rows: OpsLecture[],
  courses: OpsCourse[],
  subjects: string[],
  includeEmpty = false,
): LectureGroup[] {
  const groups: LectureGroup[] = [];
  // 서버 과목(subjects) 순서를 따르되, 데이터에만 있는 과목도 빠뜨리지 않는다(과목 재편 지연 대비).
  const dataSubjects = [...new Set([...rows.map((l) => l.subject), ...courses.map((c) => c.subject)])];
  const subjectsInUse = [
    ...subjects.filter((s) => dataSubjects.includes(s)),
    ...dataSubjects.filter((s) => !subjects.includes(s)),
  ];
  for (const subj of subjectsInUse) {
    for (const c of courses.filter((c) => c.subject === subj)) {
      const lects = rows.filter((l) => l.course_id === c.id);
      // 강의가 있으면 그대로. 없어도 includeEmpty면 빈 그룹으로 넣는다(삭제된 코스는 제외).
      if (lects.length || (includeEmpty && c.status !== 'deleted'))
        groups.push({ key: `c-${c.id}`, subject: subj, courseId: c.id, title: c.title, lectures: lects });
    }
    const uncoursed = rows.filter((l) => l.subject === subj && !l.course_id);
    if (uncoursed.length)
      groups.push({ key: `u-${subj}`, subject: subj, courseId: null, title: '미분류', lectures: uncoursed });
  }
  return groups;
}

interface LectureForm {
  title: string;
  subject: string;
  duration_sec: string;
  description: string;
  order_no: string;
  status: string;
  /** 소속 코스 id — '' = 미분류. 과목을 바꾸면 안 맞는 코스는 자동 해제된다(코스=과목 고정) */
  course_id: string;
}

const EMPTY_FORM: LectureForm = {
  title: '',
  subject: '국어',
  duration_sec: '',
  description: '',
  order_no: '',
  status: 'active',
  course_id: '',
};

function fmtBytes(n: number): string {
  if (!n) return '-';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s ? `${s}초` : ''}`.trim() : `${s}초`;
}

/** 초 → "3:20" / "1:02:05" — 문항 출제 시점 표시용(강사는 플레이어 타임코드로 생각한다) */
function fmtMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 출제 시점 입력 파서 — "200"(초)도, "3:20"·"1:02:05"(분:초)도 받는다. 실패 시 null.
 *  기존 초 단위 입력과의 하위호환을 위해 순수 숫자를 그대로 초로 해석한다. */
function parseSecInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(?:(\d+):)?(\d{1,2}):([0-5]?\d)$/.exec(s);
  if (!m) return null;
  const hh = m[1] ? Number(m[1]) : 0;
  const mm = Number(m[2]);
  if (m[1] && mm > 59) return null; // h:mm:ss일 때 분은 0~59
  return hh * 3600 + mm * 60 + Number(m[3]);
}

export default function OpsLectures() {
  // 운영자(ops)는 감독·검수만(ops 권한 B) — 저작 컨트롤을 숨기고 조회+공개/숨김만 남긴다.
  // 백엔드가 이미 저작을 403으로 막으므로 이건 UX(운영자가 눌러도 안 되는 버튼을 안 보이게).
  const { me } = useAuth();
  const isOps = me?.role === 'ops';
  const [rows, setRows] = useState<OpsLecture[]>([]);
  const [courses, setCourses] = useState<OpsCourse[]>([]);
  const [liveSubjects, setLiveSubjects] = useState<string[]>(SUBJECTS); // 폴백 → 마운트 시 서버 과목으로 교체
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');
  // 처음 오는 강사용 이용 안내 — 첫 방문이면 힌트 배너를 띄우고, 본 뒤엔 접는다(localStorage).
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSeen, setGuideSeen] = useState(
    () => localStorage.getItem('catchap_lecture_guide_seen') === '1',
  );
  const markGuideSeen = () => {
    localStorage.setItem('catchap_lecture_guide_seen', '1');
    setGuideSeen(true);
  };
  const openGuide = () => {
    setGuideOpen(true);
    markGuideSeen();
  };

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const load = () => {
    setState('loading');
    lectureApi
      .opsList()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  /* 코스 목록 — 강의 폼의 배정 select와 목록의 코스 태그에 쓴다. 실패해도 강의 관리 자체는
     막지 않는다(코스는 부가 기능) — 조용히 빈 배열로 두고, 폼에선 '미분류'만 남는다. */
  const loadCourses = () => {
    lectureApi
      .opsCourses()
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => setCourses([]));
  };
  // 과목 목록 — 서버(런타임 은행)에서. 하드코딩(옛 6과목) 대신 동적. 실패하면 폴백 유지.
  const loadSubjects = () => {
    lectureApi
      .opsSubjects()
      .then((d) => {
        if (Array.isArray(d) && d.length) setLiveSubjects(d);
      })
      .catch(() => {
        /* 폴백(SUBJECTS) 유지 */
      });
  };
  useEffect(() => {
    load();
    loadCourses();
    loadSubjects();
  }, []);

  /* 드래그 중인 강의(id·소속 그룹) — 같은 그룹 안에서만 드롭을 허용한다 */
  const [drag, setDrag] = useState<{ id: string; group: string } | null>(null);

  /* 검색·필터 — 강의·코스가 많아질 때 관리 가능하게(상용 콘솔 기본). 검색은 제목·설명,
     과목·코스 필터는 드롭다운, 코스별 접기로 긴 스크롤을 줄인다. 필터·접기는 목록 표시에만
     영향(원본 rows는 그대로 — 드래그 정렬 등 무관). */
  const [search, setSearch] = useState('');
  const [subjFilter, setSubjFilter] = useState(''); // '' = 전체 과목
  const [courseFilter, setCourseFilter] = useState(''); // '' = 전체 코스
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()); // 접힌 그룹 key 집합
  // 드롭다운 후보 — 실제 강의·코스에 쓰인 과목만(빈 과목 노이즈 방지)
  const subjectOptions = liveSubjects.filter(
    (s) => rows.some((l) => l.subject === s) || courses.some((c) => c.subject === s),
  );
  // 코스 후보 — 강의가 실제 담긴 코스만(현재 과목 필터도 반영)
  const courseOptions = courses.filter(
    (c) =>
      (subjFilter === '' || c.subject === subjFilter) && rows.some((l) => l.course_id === c.id),
  );
  const q = search.trim().toLowerCase();
  const filteredRows = rows.filter(
    (l) =>
      (subjFilter === '' || l.subject === subjFilter) &&
      (courseFilter === '' || l.course_id === courseFilter) &&
      (q === '' ||
        l.title.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q)),
  );
  const isFiltering = q !== '' || subjFilter !== '' || courseFilter !== '';

  const groups =
    state === 'ready' ? buildLectureGroups(filteredRows, courses, liveSubjects, !isFiltering) : [];
  // 검색·필터 중엔 결과가 안 숨겨지게 강제 펼침. 그 외엔 collapsed 집합을 따른다.
  const isCollapsed = (key: string) => !isFiltering && collapsed.has(key);
  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.key));
  const setAllCollapsed = (collapse: boolean) =>
    setCollapsed(collapse ? new Set(groups.map((g) => g.key)) : new Set());

  /** 재배열 결과(그룹 강의 전체의 새 순서)를 저장한다.
   *
   *  화면은 낙관적으로 먼저 바꾸고, 서버가 거절하면 되돌린다. 종전엔 저장 후 load()로 목록
   *  전량을 다시 읽었는데, load()가 state를 'loading'으로 되돌려서 한 칸 옮길 때마다 목록이
   *  '불러오는 중…'으로 통째로 깜빡였다(화면이 새로고침되는 느낌 + 스크롤·접힘 상태 튐). */
  const applyOrder = async (ids: string[]) => {
    const prev = rows;
    setRows((cur) => {
      const idSet = new Set(ids);
      const byId = new Map(cur.map((l) => [l.id, l]));
      const seq = ids.map((id) => byId.get(id)).filter((l): l is OpsLecture => !!l);
      // 새 순서대로 뽑되 원래 배열에서 이 그룹이 차지하던 자리에 그대로 끼워 넣는다
      // (다른 과목·코스 강의의 위치는 건드리지 않는다). order_no도 서버가 매길 값과 맞춘다.
      let k = 0;
      return cur.map((l) => {
        if (!idSet.has(l.id)) return l;
        const next = seq[k];
        k += 1;
        return { ...next, order_no: k };
      });
    });
    try {
      await lectureApi.opsReorderLectures(ids);
    } catch (e) {
      setRows(prev); // 서버가 거절하면 화면 순서도 원래대로
      say(errorDetail(e, '순서 변경에 실패했어요.'));
    }
  };
  /** ▲▼ 버튼 — 한 칸 이동(드래그의 키보드·클릭 대체 경로). */
  const move = (g: LectureGroup, id: string, dir: -1 | 1) => {
    const ids = g.lectures.map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    applyOrder(ids);
  };
  /** 드롭 — 드래그한 강의를 대상 강의 자리로 옮긴다(같은 그룹 안에서만). */
  const dropOn = (g: LectureGroup, targetId: string) => {
    if (!drag || drag.group !== g.key) return;
    const ids = g.lectures.map((l) => l.id);
    const from = ids.indexOf(drag.id);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, drag.id);
    setDrag(null);
    applyOrder(ids);
  };

  const remove = async (lec: OpsLecture) => {
    if (
      !window.confirm(
        `'${lec.title}' 강의를 휴지통으로 보낼까요? 학생 화면에서 바로 사라지지만, 30일 안에는 '휴지통'에서 복구할 수 있어요(문항·자막·영상 모두 보존).`,
      )
    )
      return;
    try {
      await lectureApi.opsDelete(lec.id);
      say('강의를 휴지통으로 옮겼어요. 30일 안에 복구할 수 있어요.');
      load();
    } catch (e) {
      say(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  // 운영자 모더레이션 — 공개/숨김(status)만. 내용 편집은 서버가 403(감독·검수만).
  const setLecStatus = async (lec: OpsLecture, status: 'active' | 'hidden') => {
    try {
      await lectureApi.opsUpdate(lec.id, { status });
      say(status === 'hidden' ? '강의를 숨겼어요(학생 화면에서 내려감).' : '강의를 공개했어요.');
      load();
    } catch (e) {
      say(errorDetail(e, '상태 변경에 실패했어요.'));
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">강의 관리</h1>
            <p className="op-sub">시청 검증 강의의 영상 업로드·확인 문항·자료실을 관리해요.</p>
          </div>
          <div className="op-lect-headbtns">
            <button className="op-btn op-btn--soft" onClick={openGuide}>
              <i className="ph-bold ph-question" />
              이용 안내
            </button>
            {/* '코스 관리'는 상단 메뉴의 전용 화면(/ops/courses)으로 일원화 — 여기 버튼은 뺐다.
                한 기능이 두 곳에 있으면 한쪽만 고쳐져 동작이 갈린다(실제로 가격 설정이 그랬다). */}
            <button className="op-btn op-btn--soft" onClick={() => setModal({ mode: 'trash' })}>
              <i className="ph-bold ph-trash" />
              휴지통
            </button>
            {!isOps && (
              <button className="op-lect-btn-primary" onClick={() => setModal({ mode: 'create' })}>
                <i className="ph-bold ph-upload-simple" />
                강의 업로드
              </button>
            )}
          </div>
        </div>

        <div className="op-lect-notice">
          <i className="ph-fill ph-warning" />
          <span>확인 문항이 없는 강의는 시청 검증이 동작하지 않아요 — 업로드 후 꼭 문항을 등록하세요.</span>
        </div>

        {/* 운영자는 감독·검수 전용 — 저작(업로드·편집·문항)은 강사가 한다(ops 권한 B) */}
        {isOps && (
          <div className="op-lect-hint op-lect-modnote">
            <i className="ph-fill ph-shield-check" />
            <span>
              운영자는 <b>감독·검수 전용</b>이에요 — 강의·문항 <b>저작은 강사</b>가 하고,
              운영자는 조회와 <b>공개/숨김</b>(모더레이션)만 할 수 있어요.
            </span>
          </div>
        )}

        {/* 첫 방문 강사용 힌트 — 이용 안내를 열면 접힌다 */}
        {!guideSeen && (
          <div className="op-lect-hint">
            <i className="ph-fill ph-hand-waving" />
            <span>
              처음이신가요? <b>강의 업로드 → (선택) 자막 → AI 문항 생성 → 검수·공개</b> 순서예요.
            </span>
            <button className="op-btn op-btn--soft op-lect-hint-btn" onClick={openGuide}>
              이용 안내 보기
            </button>
            <button className="op-lect-hint-x" title="닫기" onClick={markGuideSeen}>
              <i className="ph-bold ph-x" />
            </button>
          </div>
        )}

        {state === 'ready' && rows.length > 0 && (
          <div className="op-lect-filterbar">
            <div className="op-lect-search">
              <i className="ph-bold ph-magnifying-glass" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="강의 제목·설명 검색"
                aria-label="강의 검색"
              />
              {search && (
                <button className="op-lect-search-x" onClick={() => setSearch('')} title="지우기">
                  <i className="ph-bold ph-x" />
                </button>
              )}
            </div>
            <div className="op-lect-chips" role="group" aria-label="과목 필터">
              <button
                type="button"
                className={`op-lect-chip${subjFilter === '' ? ' op-lect-chip--on' : ''}`}
                onClick={() => {
                  setSubjFilter('');
                  setCourseFilter('');
                }}
              >
                전체 과목
              </button>
              {subjectOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`op-lect-chip${subjFilter === s ? ' op-lect-chip--on' : ''}`}
                  onClick={() => {
                    setSubjFilter(s);
                    setCourseFilter('');
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {courseOptions.length > 0 && (
              <select
                className="op-lect-subjfilter"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="코스 필터"
              >
                <option value="">전체 코스</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} · {c.title}
                  </option>
                ))}
              </select>
            )}
            {/* 코스가 많을 때 긴 스크롤을 줄이는 모두 접기/펼치기(검색 중엔 결과가 늘 보이게 비활성) */}
            {groups.length > 1 && !isFiltering && (
              <button
                className="op-lect-filterclear"
                onClick={() => setAllCollapsed(!allCollapsed)}
              >
                {allCollapsed ? '모두 펼치기' : '모두 접기'}
              </button>
            )}
            {isFiltering && (
              <span className="op-lect-filtercount">
                {filteredRows.length}개 강의
                <button
                  className="op-lect-filterclear"
                  onClick={() => {
                    setSearch('');
                    setSubjFilter('');
                    setCourseFilter('');
                  }}
                >
                  필터 해제
                </button>
              </span>
            )}
          </div>
        )}

        <div className="op-lect-listwrap">
          <div className="op-loghead op-lect-grid op-lect-collabel">
            <span>강의</span>
            <span>과목</span>
            <span>길이</span>
            <span>문항</span>
            <span>상태</span>
            <span className="op-col-right">관리</span>
          </div>
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">
              강의 목록을 불러오지 못했어요.{' '}
              <button className="op-btn op-btn--reject" onClick={load}>
                다시 시도
              </button>
            </div>
          )}
          {state === 'ready' && rows.length === 0 && groups.length === 0 && (
            <div className="op-logrow">등록된 강의가 없어요. 우측 상단에서 영상을 업로드해 보세요.</div>
          )}
          {state === 'ready' && rows.length > 0 && isFiltering && groups.length === 0 && (
            <div className="op-logrow">검색 결과가 없어요. 다른 검색어나 과목을 시도해 보세요.</div>
          )}
          {state === 'ready' &&
            groups.map((g) => (
              <div key={g.key} className="op-lect-group">
                {/* 섹션 머리 — 과목 · 코스(또는 미분류). 이 안에서만 순서를 바꾼다 */}
                <div className="op-lect-grouphead">
                  {/* 코스별 접기 — 코스가 많으면 안 쓰는 코스를 접어 긴 스크롤을 줄인다 */}
                  <button
                    type="button"
                    className="op-lect-groupcaret"
                    onClick={() => toggleCollapse(g.key)}
                    aria-expanded={!isCollapsed(g.key)}
                    title={isCollapsed(g.key) ? '펼치기' : '접기'}
                  >
                    <i className={`ph-bold ${isCollapsed(g.key) ? 'ph-caret-right' : 'ph-caret-down'}`} />
                  </button>
                  <span className="op-lect-groupsubj">{g.subject}</span>
                  {g.courseId ? (
                    <span className="op-lect-grouptitle">
                      <i className="ph-fill ph-stack" /> {g.title}
                    </span>
                  ) : (
                    <span className="op-lect-grouptitle op-lect-grouptitle--none">미분류</span>
                  )}
                  <span className="op-lect-groupcount">{g.lectures.length}강</span>
                  {g.lectures.length > 1 && !isCollapsed(g.key) && (
                    <span className="op-lect-grouphint">
                      <i className="ph-bold ph-arrows-down-up" /> 끌어서 순서 변경
                    </span>
                  )}
                </div>
                {/* 강의 0개 코스 — 목록에도 노출하고 바로 업로드하도록 안내(그 코스 미리 선택). */}
                {!isCollapsed(g.key) && g.lectures.length === 0 && (
                  <div className="op-lect-emptycourse">
                    <span className="op-lect-emptycourse-msg">
                      <i className="ph ph-video-camera-slash" /> 이 코스에 강의가 없어요.
                    </span>
                    {!isOps && (
                      <button
                        type="button"
                        className="op-btn op-btn--approve op-lect-emptycourse-btn"
                        onClick={() => setModal({ mode: 'create', courseId: g.courseId ?? undefined })}
                      >
                        <i className="ph-bold ph-upload-simple" /> 강의 업로드
                      </button>
                    )}
                  </div>
                )}
                {!isCollapsed(g.key) &&
                  g.lectures.map((lec, idx) => (
                  <div
                    key={lec.id}
                    className={`op-logrow op-lect-grid${g.lectures.length > 1 ? ' op-lect-draggable' : ''}${
                      drag?.id === lec.id ? ' op-lect-dragging' : ''
                    }`}
                    draggable={g.lectures.length > 1}
                    onDragStart={(e) => {
                      setDrag({ id: lec.id, group: g.key });
                      // dataTransfer를 채워야 브라우저가 '유효한 이동 드래그'로 인정한다.
                      // 종전엔 비워둬서 드래그가 시작되다 마는 경우가 있었다(파이어폭스는 필수).
                      e.dataTransfer.effectAllowed = 'move';
                      try {
                        e.dataTransfer.setData('text/plain', lec.id);
                      } catch {
                        /* 일부 브라우저는 dragstart 밖 setData를 막는다 — 없어도 크롬은 동작 */
                      }
                    }}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => {
                      // 같은 그룹의 드래그일 때만 드롭 허용(다른 그룹으로는 못 옮긴다).
                      // preventDefault를 해야 이 요소가 드롭 대상이 된다 + 커서를 '이동'으로.
                      if (drag && drag.group === g.key) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropOn(g, lec.id);
                    }}
                  >
                    <span>
                      {g.lectures.length > 1 && (
                        <span className="op-lect-draghandle" title="끌어서 순서 변경">
                          <i className="ph-bold ph-dots-six-vertical" />
                        </span>
                      )}
                      <b>{lec.title}</b>
                      <small className="op-aimodel-desc">
                        {lec.video_ext} · {fmtBytes(lec.video_bytes)}
                        {lec.description ? ` · ${lec.description}` : ''}
                      </small>
                    </span>
                    <span>{lec.subject}</span>
                    <span>{fmtDur(lec.duration_sec)}</span>
                    <span>
                      <b>{lec.active_question_count}</b>
                      <small className="op-lect-dim">/{lec.question_count}</small>
                      {/* 문항 0개면 체크포인트에서 낼 문제가 없어 시청 검증이 통째로 없는
                          강의가 된다(챌린지 4xx → 게이트가 뜨지 않음). 숫자만 보고 넘기기
                          쉬우니 눈에 띄게 경고한다. */}
                      {lec.active_question_count === 0 && (
                        <span className="lu-nowarn" title="확인 문항이 없어 시청 검증이 동작하지 않아요">
                          <i className="ph-fill ph-warning" /> 검증 없음
                        </span>
                      )}
                    </span>
                    <span>
                      <span
                        className={`op-sys-status op-sys-status--${lec.status === 'active' ? 'ok' : 'warn'}`}
                      >
                        {lec.status === 'active' ? '공개' : '숨김'}
                      </span>
                    </span>
                    <span className="op-col-right op-lect-actions">
                      {/* ▲▼ — 드래그의 클릭·키보드 대체(접근성). 그룹 경계에서 비활성.
                          재정렬은 저작이라 운영자에겐 숨긴다(ops 권한 B). */}
                      {!isOps && g.lectures.length > 1 && (
                        <span className="op-lect-movebtns">
                          <button
                            className="op-btn op-btn--reject op-lect-movebtn"
                            disabled={idx === 0}
                            title="위로"
                            onClick={() => move(g, lec.id, -1)}
                          >
                            <i className="ph-bold ph-caret-up" />
                          </button>
                          <button
                            className="op-btn op-btn--reject op-lect-movebtn"
                            disabled={idx === g.lectures.length - 1}
                            title="아래로"
                            onClick={() => move(g, lec.id, 1)}
                          >
                            <i className="ph-bold ph-caret-down" />
                          </button>
                        </span>
                      )}
                      <button
                        className="op-btn op-btn--approve"
                        onClick={() => setModal({ mode: 'questions', lec })}
                      >
                        <i className="ph-bold ph-seal-question" />
                        문항
                      </button>
                      <button
                        className="op-btn op-lect-act op-lect-act--mat"
                        onClick={() => setModal({ mode: 'materials', lec })}
                      >
                        <i className="ph-bold ph-folder-open" />
                        자료
                      </button>
                      {isOps ? (
                        // 운영자 모더레이션 — 공개/숨김만(수정·삭제는 저작이라 숨김)
                        <button
                          className="op-btn op-lect-act op-lect-act--mod"
                          onClick={() => setLecStatus(lec, lec.status === 'active' ? 'hidden' : 'active')}
                          title="학생 화면에서 공개/숨김 전환(모더레이션)"
                        >
                          <i className={`ph-bold ${lec.status === 'active' ? 'ph-eye-slash' : 'ph-eye'}`} />
                          {lec.status === 'active' ? '숨기기' : '공개'}
                        </button>
                      ) : (
                        <>
                          <button
                            className="op-btn op-lect-act op-lect-act--edit"
                            onClick={() => setModal({ mode: 'edit', lec })}
                          >
                            <i className="ph-bold ph-pencil-simple" />
                            수정
                          </button>
                          <button
                            className="op-btn op-lect-act op-lect-act--del"
                            onClick={() => remove(lec)}
                          >
                            <i className="ph-bold ph-trash" />
                            삭제
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </main>

      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <LectureFormModal
          modal={modal}
          courses={courses}
          subjects={liveSubjects}
          onClose={() => setModal(null)}
          onCoursesChanged={loadCourses} // 업로드 창에서 코스를 바로 만들면 목록에 반영
          onSaved={(msg) => {
            setModal(null);
            say(msg);
            load();
            loadCourses(); // 강의 코스 배정이 바뀌면 코스별 강의 수(lecture_count)도 갱신
          }}
        />
      )}
      {modal?.mode === 'questions' && (
        <QuestionsModal lec={modal.lec} onClose={() => setModal(null)} onChanged={load} />
      )}
      {modal?.mode === 'materials' && (
        <MaterialsModal lec={modal.lec} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'trash' && (
        <TrashModal
          onClose={() => setModal(null)}
          onRestored={load} // 복구되면 활성 목록에 다시 나타나야 하므로 재조회
          say={say}
        />
      )}

      {guideOpen && <LectureGuideModal onClose={() => setGuideOpen(false)} />}

      {toast && (
        <div className="op-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* 처음 오는 강사용 이용 안내 — 강의 제작 워크플로를 순서대로. 인터랙티브 투어 대신
   단계 설명 모달(가볍고 안 깨짐). 실제 버튼 이름(문항·AI 문항 생성·자막 등)을 그대로 써서
   화면과 1:1로 대응시킨다. */
const _GUIDE_STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'ph-upload-simple',
    title: '1. 강의 영상 업로드',
    body: "오른쪽 위 '강의 업로드'로 영상(mp4·webm)과 과목을 올려요. 코스에 소속시키면 학생 화면에서 코스 단위로 묶여 보여요.",
  },
  {
    icon: 'ph-closed-captioning',
    title: '2. (선택) 자막 넣기',
    body: "강의 행의 '문항'을 열면 위쪽에 '자막' 바가 있어요. 이미 자막(SRT/VTT)이 있으면 올리거나 붙여넣으세요 — AI가 그 자막으로 더 정확한 문항을 만들어요. 없으면 강의 소리를 자막으로 자동 변환하니 건너뛰어도 돼요.",
  },
  {
    icon: 'ph-sparkle',
    title: '3. AI 문항 생성',
    body: "'문항' 창에서 개수를 정하고 'AI 문항 생성'을 누르면 확인 문항 초안이 만들어져요. 직접 '문항 추가'로 손수 낼 수도 있어요.",
  },
  {
    icon: 'ph-seal-check',
    title: '4. 검수 & 공개',
    body: "만든 문항은 초안(draft)이에요. 배지(확인 문항 적합/은행/불량 의심)를 보고 다듬은 뒤 '공개(active)'로 바꿔야 학생에게 떠요. 공개 문항이 0개면 그 강의는 시청 검증이 동작하지 않아요.",
  },
  {
    icon: 'ph-exam',
    title: '5. (선택) 코스 & 수료 시험',
    body: "여러 강의를 '코스 관리'로 묶고, 코스에는 수료 시험을 붙일 수 있어요. 수료 시험 문항도 '강의 문항 가져오기'·'AI로 생성'으로 빠르게 채워요(자막이 있으면 시험도 더 깊어져요).",
  },
];
function LectureGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="op-bh-overlay" onClick={onClose}>
      <div className="op-formmodal op-lect-guide" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-graduation-cap" /> 강의 제작 이용 안내
          </span>
          <button className="op-bh-modal-x" onClick={onClose}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <p className="op-lect-guide-lead">
          이 화면에서 <b>영상 → (자막) → AI 문항 → 검수·공개</b> 순서로 시청 검증 강의를 만들어요.
          자막과 코스·수료 시험은 선택이에요.
        </p>
        <ol className="op-lect-guide-steps">
          {_GUIDE_STEPS.map((s) => (
            <li key={s.title}>
              <span className="op-lect-guide-ic"><i className={`ph-fill ${s.icon}`} /></span>
              <div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="op-lect-guide-foot">
          <button className="op-btn op-btn--approve" onClick={onClose}>
            <i className="ph-bold ph-check" /> 알겠어요
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= 강의 업로드/수정 모달 ================= */
function LectureFormModal({
  modal,
  courses,
  subjects,
  onClose,
  onSaved,
  onCoursesChanged,
}: {
  modal: { mode: 'create'; courseId?: string } | { mode: 'edit'; lec: OpsLecture };
  courses: OpsCourse[];
  subjects: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onCoursesChanged: () => void;
}) {
  const editing = modal.mode === 'edit' ? modal.lec : null;
  // 빈 코스 안내의 '강의 업로드'로 들어오면 그 코스를 미리 선택하고 과목도 코스에 맞춘다
  // (서버는 코스 과목 ≠ 강의 과목이면 막으므로).
  const preCourse =
    modal.mode === 'create' && modal.courseId
      ? courses.find((c) => c.id === modal.courseId)
      : null;
  const [form, setForm] = useState<LectureForm>(
    editing
      ? {
          title: editing.title,
          subject: editing.subject,
          duration_sec: String(editing.duration_sec),
          description: editing.description ?? '',
          order_no: editing.order_no != null ? String(editing.order_no) : '',
          status: editing.status,
          course_id: editing.course_id ?? '',
        }
      : preCourse
        ? { ...EMPTY_FORM, course_id: preCourse.id, subject: preCourse.subject }
        : EMPTY_FORM,
  );
  const [file, setFile] = useState<File | null>(null);
  // 영상 썸네일(선택) — 새로 고른 파일 + 미리보기(신규는 blob:, 없으면 기존 강의 썸네일).
  const existingThumb = editing?.thumbnail_url ? thumbnailSrc(editing.thumbnail_url) ?? null : null;
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(existingThumb);
  const [thumbRemoved, setThumbRemoved] = useState(false); // '썸네일 제거' 후 — 기존 미리보기로 되돌리지 않게
  const thumbBlobRef = useRef<string | null>(null); // 현재 미리보기 blob URL(정리 대상)
  const pickThumb = (f: File | null) => {
    if (thumbBlobRef.current) URL.revokeObjectURL(thumbBlobRef.current); // 이전 blob 정리(누수 방지)
    thumbBlobRef.current = f ? URL.createObjectURL(f) : null;
    if (f) setThumbRemoved(false); // 새로 고르면 제거 상태 해제
    // 취소하면 기존 썸네일로 되돌림(단 이미 제거했으면 빈 상태 유지)
    setThumbPreview(f ? thumbBlobRef.current : thumbRemoved ? null : existingThumb);
    setThumbFile(f);
  };
  // 썸네일만 제거 — 서버 파일까지 삭제(강의는 유지, 다시 자동 커버). 즉시 반영.
  const removeThumb = async () => {
    if (!editing) return;
    try {
      await lectureApi.opsDeleteThumbnail(editing.id);
      if (thumbBlobRef.current) {
        URL.revokeObjectURL(thumbBlobRef.current);
        thumbBlobRef.current = null;
      }
      setThumbFile(null);
      setThumbPreview(null);
      setThumbRemoved(true);
    } catch {
      setErr('썸네일 제거에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  // 언마운트 시 남은 blob 미리보기 정리
  useEffect(() => () => {
    if (thumbBlobRef.current) URL.revokeObjectURL(thumbBlobRef.current);
  }, []);

  // ── 썸네일 드래그드롭 + 영상 프레임 캡처 ──
  const [thumbDragOver, setThumbDragOver] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // 선택한 로컬 영상 blob(캡처용)
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  // 선택한 영상 파일로 blob URL 생성(같은 오리진이라 canvas 오염 없음 → toBlob 가능)
  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      setCaptureOpen(false);
      return;
    }
    const u = URL.createObjectURL(file);
    setVideoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  // 현재 영상 프레임을 캡처해 썸네일(jpeg)로 — 강사가 이미지 파일 없이 대표 장면을 바로 뽑는다.
  const captureFrame = () => {
    const v = captureVideoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const f = new File([blob], `frame-${Math.floor(v.currentTime)}s.jpg`, { type: 'image/jpeg' });
        pickThumb(f);
        setCaptureOpen(false);
      },
      'image/jpeg',
      0.9,
    );
  };

  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [autoDur, setAutoDur] = useState<'idle' | 'reading' | 'ok' | 'fail'>('idle');
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null); // 업로드 중 취소용
  const [newCourse, setNewCourse] = useState<string | null>(null); // null=닫힘, ''~=새 코스 이름 입력 중
  const [courseErr, setCourseErr] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);

  // 업로드 창에서 새 코스를 바로 만든다(현재 선택한 과목으로). 만든 뒤 그 코스로 자동 배정 —
  // '코스 관리'로 나갔다 오지 않아도 되게(발견성 개선). 코스=과목 고정이라 form.subject를 쓴다.
  const addCourse = async () => {
    const title = (newCourse || '').trim();
    if (!title) return setCourseErr('코스 이름을 입력하세요.');
    setCourseSaving(true);
    setCourseErr('');
    try {
      const created = await lectureApi.opsCourseCreate({ title }); // 코스 중심: 과목 안 보냄(서버 기본 '일반')
      onCoursesChanged(); // 부모 코스 목록 갱신 → select에 새 코스가 나타난다
      // ★새 코스로 배정하면서 강의 과목도 그 코스의 과목(기본 '일반')으로 맞춘다 — 안 맞추면
      // 서버가 '코스 과목(일반) ≠ 강의 과목' 400으로 업로드를 막아, 코스 추가가 조용히 실패했다.
      setForm((f) => ({ ...f, course_id: created.id, subject: created.subject }));
      setNewCourse(null);
    } catch (e) {
      setCourseErr(errorDetail(e, '코스를 만들지 못했어요.'));
    } finally {
      setCourseSaving(false);
    }
  };
  const set = (k: keyof LectureForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  /* Phase 1(코스 중심): 과목 선택을 없애 subjectCourses·changeSubject를 제거했다. 강의 폼은
     코스만 고르고, 과목은 그 코스에서 자동 유래한다(미분류면 기본 과목 유지 — DB·은행 정합). */

  /* 파일 선택 시 브라우저가 영상 메타데이터에서 길이를 읽어 자동 기입한다.
     운영자가 초를 손으로 계산하면 틀리기 쉽고, 틀리면 시청 검증이 깨진다
     (짧게 넣으면 안 봤는데 완주 처리, 길게 넣으면 끝까지 봐도 완주 불가).
     판독 실패 시 입력란은 그대로 열어둬 수동 입력으로 진행할 수 있게 한다
     (ffprobe 등 서버 의존성 없이 처리 — 서버는 양수 검증만). */
  const pickFile = (f: File | null) => {
    // 서버로 보내기 전에 여기서 먼저 거른다 — 5GB 초과·영상 아님을 즉시 명확히 알려,
    // 업로드 도중 413/400으로 애매하게 실패하는 걸 막는다(백엔드 MAX_UPLOAD_BYTES=5GB와 맞춤).
    if (f) {
      const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024; // 백엔드 한도와 동일(5GB)
      if (f.size > MAX_UPLOAD_BYTES) {
        setErr(`영상이 너무 커요(${humanSize(f.size)}) — 최대 5GB까지 올릴 수 있어요. 더 짧게 자르거나 화질(해상도·비트레이트)을 낮춰 다시 올려주세요.`);
        return;
      }
      const okExt = /\.(mp4|webm)$/i.test(f.name);
      const okType = !f.type || f.type.startsWith('video/') || f.type === 'application/octet-stream';
      if (!okExt || !okType) {
        setErr(`이 파일은 올릴 수 없어요(${f.name}). mp4 또는 webm 영상만 업로드할 수 있어요.`);
        return;
      }
      setErr('');
    }
    setFile(f);
    if (!f) return setAutoDur('idle');
    setAutoDur('reading');
    const url = URL.createObjectURL(f);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      // floor로 저장한다(round 아님) — 재생 중 서버가 받는 위치는 floor(currentTime)이라,
      // 끝에서 watched_max의 최대치는 floor(video.duration)이다. round면 1006.5s가 1007로 올라가
      // watched_max(1006)가 duration(1007)에 영영 못 닿아 완주가 안 된다(off-by-one·라이브 버그).
      const d = Math.floor(probe.duration);
      URL.revokeObjectURL(url);
      if (Number.isFinite(d) && d > 0) {
        setForm((prev) => ({ ...prev, duration_sec: String(d) }));
        setAutoDur('ok');
      } else {
        setAutoDur('fail');
      }
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setAutoDur('fail');
    };
    probe.src = url;
  };

  const save = async () => {
    const duration = Number(form.duration_sec);
    if (!form.title.trim()) return setErr('제목은 필수예요.');
    if (!Number.isInteger(duration) || duration <= 0) return setErr('영상 길이(초)는 1 이상의 정수예요.');
    if (!editing && !file) return setErr('업로드할 영상 파일(mp4/webm)을 선택하세요.');

    setSaving(true);
    setErr('');
    try {
      if (editing) {
        await lectureApi.opsUpdate(editing.id, {
          title: form.title.trim(),
          description: form.description,
          subject: form.subject,
          duration_sec: duration,
          ...(form.order_no !== '' ? { order_no: Number(form.order_no) } : {}),
          status: form.status,
          // 항상 명시 전송 — 폼이 현재/의도한 소속을 그대로 담고 있다('' → null=미분류).
          // 과목을 바꾸면 changeSubject가 안 맞는 코스를 미리 해제하므로 서버 과목불일치 400은 안 난다.
          course_id: form.course_id || null,
        });
        // 썸네일을 새로 골랐으면 메타 수정 후 올린다(목록 재조회로 새 thumbnail_url 반영).
        if (thumbFile) await lectureApi.opsUploadThumbnail(editing.id, thumbFile);
        onSaved('강의 정보를 수정했어요.');
      } else {
        const fd = new FormData();
        fd.append('title', form.title.trim());
        fd.append('subject', form.subject);
        fd.append('duration_sec', String(duration));
        if (form.description) fd.append('description', form.description);
        if (form.order_no !== '') fd.append('order_no', form.order_no);
        if (form.course_id) fd.append('course_id', form.course_id); // 미지정이면 미분류(서버 기본)
        fd.append('file', file as File);
        setProgress(0);
        abortRef.current = new AbortController();
        const created = await lectureApi.opsCreate(
          fd,
          (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
          },
          abortRef.current.signal,
        );
        // 영상 생성 직후 썸네일(선택)을 올린다 — 아래 목록 재조회에 새 thumbnail_url이 실린다.
        if (thumbFile) await lectureApi.opsUploadThumbnail(created.id, thumbFile);
        // 성공 표기는 목록 재조회로 실재 확인 후에만 — 업로드 응답만 믿지 않는다.
        // 재조회 자체가 실패한 경우는 '업로드 실패'로 오표기하지 않는다(재업로드 유도 →
        // 중복 강의 생성 위험) — 완료됐을 수 있음을 정직하게 안내한다.
        let fresh;
        try {
          fresh = await lectureApi.opsList();
        } catch {
          throw new Error(
            '업로드는 완료됐을 수 있지만 목록 재조회에 실패했어요. 재업로드하지 말고 새로고침으로 확인하세요.',
          );
        }
        if (!fresh.some((r) => r.id === created.id)) {
          throw new Error('업로드 후 목록에서 강의를 확인하지 못했어요. 새로고침 후 다시 확인하세요.');
        }
        onSaved(`'${created.title}' 업로드 완료 — 목록에서 확인했어요. 이제 확인 문항을 등록하세요.`);
      }
    } catch (e) {
      // '실패 이유가 안 보인다'를 없앤다 — 응답이 없는 끊김/타임아웃도 원인을 짚어 안내한다.
      const err = e as { response?: unknown; code?: string; message?: string };
      if (err?.code === 'ERR_CANCELED') {
        // 사용자가 업로드를 직접 취소함 — 실패가 아니므로 조용히 되돌린다.
        setErr('');
        setProgress(null);
        return;
      }
      let msg: string;
      if (err?.response) {
        msg = errorDetail(e, '저장에 실패했어요.'); // 서버가 사유 제공(413 용량·400 형식 등)
      } else if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        // 응답 없이 끊김 — 업로드 중이었다면 대개 용량 초과나 네트워크 문제
        msg =
          progress != null
            ? '업로드가 중간에 끊겼어요 — 영상이 너무 크거나(최대 5GB) 네트워크가 불안정할 수 있어요. 파일 크기와 연결을 확인하고 다시 시도하세요.'
            : '서버에 연결하지 못했어요 — 네트워크를 확인하고 다시 시도하세요.';
      } else if (err?.code === 'ECONNABORTED') {
        msg = '업로드 시간이 초과됐어요 — 파일이 크면 오래 걸릴 수 있어요. 연결이 빠른 곳에서 다시 시도하세요.';
      } else if (e instanceof Error && !('response' in e)) {
        msg = err.message || '저장에 실패했어요.'; // 커스텀 throw(정보성 메시지) 보존
      } else {
        msg = errorDetail(e, '저장에 실패했어요.');
      }
      setErr(msg);
      setProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const mRef = useModalA11y<HTMLDivElement>(() => { if (!saving) onClose(); });
  return (
    <div className="op-bh-overlay" onClick={() => !saving && onClose()}>
      <div
        className="op-formmodal"
        onClick={(e) => e.stopPropagation()}
        ref={mRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '강의 수정' : '강의 업로드'}
      >
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-video-camera" /> {editing ? '강의 수정' : '강의 업로드'}
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={saving}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <div className="op-form-grid">
          {!editing && (
            <div className="op-form-section op-form-span2">
              <i className="ph-bold ph-number-circle-one" /> 강의 영상
            </div>
          )}
          {/* ① 영상 — 먼저 올려야 길이가 자동으로 잡힌다 */}
          {!editing && (
            <div className="ox-field op-form-span2">
              <div
                className={`lu-drop${dragOver ? ' lu-drop--over' : ''}${file ? ' lu-drop--has' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                onClick={() => document.getElementById('lu-file')?.click()}
              >
                <input
                  id="lu-file"
                  type="file"
                  accept="video/mp4,video/webm"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {!file ? (
                  <>
                    <i className="ph-fill ph-upload-simple lu-drop-ico" />
                    <b>영상을 여기로 끌어다 놓거나 클릭해서 선택하세요</b>
                    <span className="lu-drop-sub">MP4 · WebM · 최대 5GB</span>
                  </>
                ) : (
                  <>
                    <i className="ph-fill ph-file-video lu-drop-ico lu-drop-ico--ok" />
                    <b>{file.name}</b>
                    <span className="lu-drop-sub">
                      {humanSize(file.size)}
                      {autoDur === 'reading' && ' · 길이 확인 중…'}
                      {autoDur === 'ok' && ` · ${humanDur(Number(form.duration_sec))} (자동 인식)`}
                      {autoDur === 'fail' && ' · 길이를 못 읽었어요 — 아래에 직접 입력'}
                    </span>
                    <span className="lu-drop-sub">다른 영상을 고르려면 클릭하세요</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 자동 인식 실패 또는 수정 모드일 때만 길이를 직접 다룬다 */}
          {(editing || autoDur === 'fail') && (
            <label className="ox-field">
              영상 길이(초)
              {editing && <span className="lu-help">{humanDur(Number(form.duration_sec))}</span>}
              <input
                value={form.duration_sec}
                onChange={(e) => set('duration_sec')(e.target.value)}
                placeholder="예: 1740 (29분)"
              />
            </label>
          )}

          {/* 영상 썸네일(선택) — 없으면 학생 화면이 자동 커버(모노그램). 강사 편의: 이미지 드래그드롭 +
              선택한 영상에서 프레임을 바로 캡처해 썸네일로(이미지 파일 없이도 대표 장면 지정). */}
          <div className="ox-field op-form-span2">
            <span className="lu-thumb-lb">영상 썸네일 (선택) — 없으면 자동 커버 사용</span>
            <span className="lu-help">학생 화면 강의 카드에 보이는 대표 이미지예요. 권장 16:9.</span>
            <div className="lu-thumb-row">
              {thumbPreview && (
                <img
                  src={thumbPreview}
                  alt="썸네일 미리보기"
                  className="lu-thumb-preview"
                  style={{ width: 200, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 10, display: 'block' }}
                />
              )}
              <div className="lu-thumb-side">
                <label
                  className={`lu-drop lu-drop--img${thumbDragOver ? ' lu-drop--over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setThumbDragOver(true); }}
                  onDragLeave={() => setThumbDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setThumbDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f?.type.startsWith('image/')) pickThumb(f);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => pickThumb(e.target.files?.[0] ?? null)}
                  />
                  <i className="ph-fill ph-image lu-drop-ico" />
                  <b>이미지를 끌어다 놓거나 클릭</b>
                  <span className="lu-drop-sub">JPG · PNG · WebP</span>
                </label>
                <div className="lu-thumb-btns">
                  {videoUrl && (
                    <button type="button" className="op-btn op-btn--soft" onClick={() => setCaptureOpen((o) => !o)}>
                      <i className="ph-bold ph-film-strip" /> {captureOpen ? '캡처 닫기' : '영상에서 캡처'}
                    </button>
                  )}
                  {thumbFile && (
                    <button type="button" className="op-btn op-btn--soft" onClick={() => pickThumb(null)}>
                      <i className="ph-bold ph-x" /> 선택 취소
                    </button>
                  )}
                  {editing?.thumbnail_url && !thumbFile && !thumbRemoved && (
                    <button type="button" className="op-btn op-btn--soft" onClick={removeThumb}>
                      <i className="ph-bold ph-trash" /> 썸네일 제거
                    </button>
                  )}
                </div>
              </div>
            </div>
            {captureOpen && videoUrl && (
              <div className="lu-capture">
                <video ref={captureVideoRef} src={videoUrl} controls className="lu-capture-video" />
                <div className="lu-capture-foot">
                  <span className="lu-drop-sub">원하는 장면에서 멈추고 아래 버튼을 누르세요.</span>
                  <button type="button" className="op-btn op-btn--approve" onClick={captureFrame}>
                    <i className="ph-bold ph-camera" /> 이 장면을 썸네일로
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="op-form-section op-form-span2">
            <i className="ph-bold ph-number-circle-two" /> 강의 정보
          </div>
          {/* ② 기본 정보 */}
          <label className="ox-field op-form-span2">
            강의 제목
            <input value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="예: 1강 · 오리엔테이션" />
          </label>
          <div className="op-form-section op-form-span2">
            <i className="ph-bold ph-number-circle-three" /> 코스와 순서
          </div>
          {/* Phase 1(코스 중심): 과목 선택 제거 — 코스를 고르면 그 코스의 과목이 자동 적용된다.
              미분류면 기본 과목으로 둔다(DB 컬럼·은행 정합 유지). 코스가 최상위 단위. */}
          <label className="ox-field op-form-span2">
            코스
            <span className="lu-help">
              강의가 속할 코스를 고르세요. 미분류로 두면 학생 화면에서 코스 없이 낱개로 보여요.
              코스가 없으면 오른쪽 &lsquo;새 코스&rsquo;로 바로 만들 수 있어요.
            </span>
            <div className="op-lect-courserow">
              <select
                value={form.course_id}
                onChange={(e) => {
                  const cid = e.target.value;
                  const c = courses.find((x) => x.id === cid);
                  // 코스를 고르면 과목은 그 코스를 따른다(미분류면 기본 과목 유지).
                  setForm((f) => ({
                    ...f,
                    course_id: cid,
                    subject: c?.subject || f.subject || subjects[0] || '일반',
                  }));
                }}
              >
                <option value="">미분류(코스 없음)</option>
                {courses
                  .filter((c) => c.status !== 'deleted')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.status === 'hidden' ? ' (숨김)' : ''}
                    </option>
                  ))}
              </select>
              {newCourse === null && (
                <button
                  type="button"
                  className="op-btn op-btn--soft op-lect-newcourse-btn"
                  onClick={() => { setCourseErr(''); setNewCourse(''); }}
                  title="새 코스를 여기서 바로 만들어요(분류는 코스 관리에서 지정)"
                >
                  <i className="ph-bold ph-plus" /> 새 코스
                </button>
              )}
            </div>
            {newCourse !== null && (
              <div className="op-lect-newcourse-form">
                <input
                  value={newCourse}
                  autoFocus
                  onChange={(e) => setNewCourse(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void addCourse(); }
                  }}
                  placeholder="새 코스 이름 (예: 기초반)"
                />
                <button type="button" className="op-btn op-btn--approve" disabled={courseSaving} onClick={() => void addCourse()}>
                  {courseSaving ? '만드는 중…' : '만들기'}
                </button>
                <button type="button" className="op-btn op-btn--reject" disabled={courseSaving} onClick={() => setNewCourse(null)}>
                  취소
                </button>
              </div>
            )}
            {courseErr && <div className="op-form-err">{courseErr}</div>}
          </label>
          <label className="ox-field">
            강의 순서
            <span className="lu-help">비워두면 맨 뒤에 추가돼요</span>
            <input value={form.order_no} onChange={(e) => set('order_no')(e.target.value)} placeholder="예: 1" />
          </label>
          <label className="ox-field op-form-span2">
            강의 소개
            <span className="lu-help">학생 화면에 보이는 한 줄 소개예요</span>
            <input value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="예: 이 강의에서 배우는 핵심 내용을 한 줄로" />
          </label>

          {/* ③ 시청 확인 안내 — 확인이 뜨는 시점은 간격 설정이 아니라 문항 등록에서 지정한다 */}
          <div className="ox-field op-form-span2">
            시청 확인 문제
            <span className="lu-help">
              확인 문제가 뜨는 시점은 <b>문항 등록</b>에서 지정해요(문항이 다루는 대목의
              정확한 시점). 업로드 후 목록의 &lsquo;문항&rsquo;에서 등록하세요 — 문항이 없으면
              시청 검증이 동작하지 않아요.
            </span>
          </div>

          {editing && (
            <label className="ox-field">
              공개 상태
              <select value={form.status} onChange={(e) => set('status')(e.target.value)}>
                <option value="active">공개</option>
                <option value="hidden">숨김</option>
              </select>
            </label>
          )}
        </div>
        {progress != null && (
          <div className="op-lect-progress">
            <div className="op-lect-progress-track">
              <div className="op-lect-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="op-lect-progress-row">
              <span>
                {progress < 100 ? `업로드 중… ${progress}%` : '서버에서 저장 확인 중…'}
              </span>
              {progress < 100 && (
                <button
                  type="button"
                  className="op-btn op-btn--reject op-lect-abort"
                  onClick={() => abortRef.current?.abort()}
                >
                  <i className="ph-bold ph-x" /> 업로드 취소
                </button>
              )}
            </div>
          </div>
        )}
        {err && (
          <div className="op-form-err">
            <i className="ph-fill ph-warning-circle" /> {err}
          </div>
        )}
        <div className="op-form-actions">
          <button className="op-btn op-btn--reject" disabled={saving} onClick={onClose}>
            취소
          </button>
          <button className="op-btn op-btn--approve" disabled={saving} onClick={save}>
            <i className="ph-bold ph-check" />
            {saving ? '저장 중…' : editing ? '저장' : '업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= 휴지통 모달 ================= */
// 삭제한 강의를 복구하거나 완전 삭제한다. 조회 시 서버가 30일 지난 항목을 자동 완전삭제한다.
function TrashModal({
  onClose,
  onRestored,
  say,
}: {
  onClose: () => void;
  onRestored: () => void; // 복구되면 활성 목록 재조회(부모)
  say: (m: string) => void;
}) {
  const mRef = useModalA11y<HTMLDivElement>(onClose);
  const [items, setItems] = useState<OpsTrashLecture[] | null>(null);
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // 처리 중인 강의 id(연타 방지)

  const load = () => {
    lectureApi
      .opsTrash()
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setBanner(errorDetail(e, '휴지통을 불러오지 못했어요.'));
      });
  };
  useEffect(load, []);

  const restore = async (t: OpsTrashLecture) => {
    setBusy(t.id);
    try {
      await lectureApi.opsRestore(t.id);
      say(`'${t.title}' 강의를 복구했어요.`);
      load();
      onRestored();
    } catch (e) {
      setBanner(errorDetail(e, '복구에 실패했어요.'));
    } finally {
      setBusy(null);
    }
  };

  const purge = async (t: OpsTrashLecture) => {
    if (
      !window.confirm(
        `'${t.title}' 강의를 완전히 삭제할까요?\n\n문항·자막(STT)·시청 이력·영상 파일까지 영구 삭제되며 되돌릴 수 없어요.`,
      )
    )
      return;
    setBusy(t.id);
    try {
      await lectureApi.opsPermanentDelete(t.id);
      say(`'${t.title}' 강의를 완전히 삭제했어요.`);
      load();
    } catch (e) {
      setBanner(errorDetail(e, '완전 삭제에 실패했어요.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="op-bh-overlay" onClick={onClose}>
      <div
        ref={mRef}
        className="op-formmodal op-lect-widemodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="op-bh-modal-h">
          <h3>
            <i className="ph-fill ph-trash" /> 휴지통
          </h3>
          <button className="op-bh-modal-x" onClick={onClose}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <p className="lu-help">
          삭제한 강의는 여기서 <b>복구</b>할 수 있어요. 삭제 후 <b>30일</b>이 지나면 문항·자막(STT)·
          영상까지 <b>자동으로 완전 삭제</b>돼요.
        </p>
        {banner && <div className="op-form-err op-lect-banner">{banner}</div>}
        {items === null ? (
          <div className="op-logrow">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="op-logrow">휴지통이 비어 있어요.</div>
        ) : (
          <ul className="op-trash-list">
            {items.map((t) => (
              <li key={t.id} className="op-trash-row">
                <div className="op-trash-info">
                  <div className="op-trash-title">{t.title}</div>
                  <div className="op-trash-meta">
                    <span>{t.subject}</span>
                    <span>·</span>
                    <span>문항 {t.question_count}개</span>
                    <span>·</span>
                    <span>{fmtBytes(t.video_bytes)}</span>
                    {t.days_left != null && (
                      <span
                        className={
                          'op-trash-days' + (t.days_left <= 7 ? ' op-trash-days--soon' : '')
                        }
                      >
                        <i className="ph-fill ph-clock-countdown" /> {t.days_left}일 후 자동 삭제
                      </span>
                    )}
                  </div>
                </div>
                <div className="op-trash-actions">
                  <button
                    className="op-btn op-btn--approve"
                    disabled={busy === t.id}
                    onClick={() => restore(t)}
                  >
                    <i className="ph-bold ph-arrow-counter-clockwise" /> 복구
                  </button>
                  <button
                    className="op-btn op-btn--reject"
                    disabled={busy === t.id}
                    onClick={() => purge(t)}
                  >
                    <i className="ph-bold ph-trash" /> 완전 삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ================= 코스 가격 설정 모달 =================
   수강료의 서버 정본을 강사가 직접 정한다(PUT /ops/courses/{id}/pricing).
   결제 금액은 주문 생성 때 서버가 이 값으로 다시 계산해 주문에 스냅샷하므로, 프런트가
   다른 금액을 보내도 승인되지 않는다 — 여기 입력은 '정본을 바꾸는' 행위다.
   0원이면 무료 코스가 되어 결제 없이 바로 수강신청된다(학생 화면 Checkout이 분기). */
/** PG 최소 결제금액(원). 카드는 100원, 계좌이체는 200원 미만을 승인하지 않는다.
 *  0원(무료)은 결제를 거치지 않으므로 예외. 서버도 같은 값으로 막는다(lectures.py). */
const MIN_PAID_PRICE = 100;
const TOO_LOW_MSG = (label: string) =>
  `${label}는 0원(무료) 또는 ${MIN_PAID_PRICE}원 이상이어야 해요. ` +
  `결제대행사가 ${MIN_PAID_PRICE}원 미만은 승인하지 않아 수강신청이 막혀요.`;

export function PricingModal({
  course,
  onClose,
  onSaved,
  say,
}: {
  course: OpsCourse;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string) => void;
}) {
  const mRef = useModalA11y<HTMLDivElement>(onClose);
  const cur = course.pricing;
  const [price, setPrice] = useState(String(cur?.price ?? 0));
  // 할인 방식 — off(없음) / amount(금액 원) / percent(퍼센트 %). 서버는 절대금액(sale_price)만
  // 저장하므로 기존 코스는 amount로 연다. percent로 넣으면 저장 때 정상가 기준으로 원으로 환산해
  // sale_price로 보낸다(백엔드 계약 불변).
  const [saleMode, setSaleMode] = useState<'off' | 'amount' | 'percent'>(
    cur?.sale_price != null ? 'amount' : 'off',
  );
  const [salePrice, setSalePrice] = useState(String(cur?.sale_price ?? ''));
  const [salePercent, setSalePercent] = useState('');
  // datetime-local 은 'YYYY-MM-DDTHH:mm' — 서버가 준 ISO에서 초 이하를 잘라 맞춘다.
  const [saleEnds, setSaleEnds] = useState((cur?.sale_ends_at ?? '').slice(0, 16));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const useSale = saleMode !== 'off';
  const isPercent = saleMode === 'percent';

  const priceNum = Number(price.replace(/[^\d]/g, '') || 0);
  const pctNum = Number(salePercent.replace(/[^\d]/g, '') || 0);
  // 할인가(절대 원) — 퍼센트면 정상가 기준 환산(1~99%만 유효), 금액이면 입력값 그대로.
  const saleNum = isPercent
    ? pctNum > 0 && pctNum < 100
      ? Math.round(priceNum * (1 - pctNum / 100))
      : 0
    : Number(salePrice.replace(/[^\d]/g, '') || 0);
  const effective = useSale && saleNum > 0 ? saleNum : priceNum;
  // 1~99원은 결제창까지 갔다가 PG가 거절해 수강신청이 막힌다(카드 최소 100원).
  // 0원은 무료 코스라 결제를 아예 거치지 않으므로 허용한다. 서버도 같은 규칙으로 막는다.
  const belowMin = (n: number) => n > 0 && n < MIN_PAID_PRICE;
  const priceTooLow = belowMin(priceNum);
  const saleTooLow = useSale && belowMin(saleNum);

  const save = async () => {
    setErr('');
    if (!Number.isFinite(priceNum) || priceNum < 0) return setErr('정상가를 올바르게 입력해 주세요.');
    if (priceTooLow) return setErr(TOO_LOW_MSG('정상가'));
    if (useSale) {
      if (isPercent && (pctNum <= 0 || pctNum >= 100))
        return setErr('할인율은 1~99% 사이로 입력해 주세요.');
      if (saleNum <= 0) return setErr('할인가를 입력하거나 할인 사용을 꺼 주세요.');
      if (saleTooLow) return setErr(TOO_LOW_MSG('할인가'));
      if (saleNum > priceNum) return setErr('할인가는 정상가보다 클 수 없어요.');
      if (!saleEnds) return setErr('할인 종료일을 정해 주세요.');
    }
    setSaving(true);
    try {
      await lectureApi.opsCourseSetPricing(course.id, {
        price: priceNum,
        sale_price: useSale ? saleNum : null,
        sale_ends_at: useSale ? saleEnds : null,
      });
      say(
        priceNum === 0
          ? `'${course.title}' 코스를 무료로 설정했어요.`
          : `'${course.title}' 수강료를 ${effective.toLocaleString('ko-KR')}원으로 설정했어요.`,
      );
      onSaved();
      onClose();
    } catch (e) {
      setErr(errorDetail(e, '가격을 저장하지 못했어요.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-bh-overlay" onClick={() => !saving && onClose()}>
      <div
        className="op-formmodal"
        onClick={(e) => e.stopPropagation()}
        ref={mRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="수강료 설정"
      >
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-tag" /> 수강료 설정
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={saving}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="op-lect-qform">
          <p className="lu-help op-price-course">
            <i className="ph-fill ph-stack" /> {course.title}
          </p>

          <div className="op-form-grid op-price-grid">
            <label className="ox-field">
              정상가 (원)
              <span className="lu-help">
                0원(무료) 또는 {MIN_PAID_PRICE}원 이상. 무료면 결제 없이 바로 수강신청돼요
              </span>
              <input
                inputMode="numeric"
                className={priceTooLow ? 'op-price-bad' : undefined}
                aria-invalid={priceTooLow || undefined}
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="예: 49000"
              />
              {priceTooLow && (
                <span className="op-price-warn">
                  <i className="ph-fill ph-warning-circle" /> {TOO_LOW_MSG('정상가')}
                </span>
              )}
            </label>

            <label className="ox-field">
              할인 적용
              <span className="lu-help">금액(원) 또는 퍼센트(%)로 기간 한정 할인가를 둘 수 있어요</span>
              <select
                value={saleMode}
                onChange={(e) => setSaleMode(e.target.value as 'off' | 'amount' | 'percent')}
              >
                <option value="off">사용 안 함</option>
                <option value="amount">금액(원)으로</option>
                <option value="percent">퍼센트(%)로</option>
              </select>
            </label>

            {useSale && (
              <>
                <label className="ox-field">
                  {isPercent ? '할인율 (%)' : '할인가 (원)'}
                  <span className="lu-help">
                    {isPercent
                      ? '정상가에서 이 비율만큼 깎여요 (1~99%)'
                      : '학생이 실제로 결제하는 금액이라 같은 하한이 적용돼요'}
                  </span>
                  <input
                    inputMode="numeric"
                    className={saleTooLow ? 'op-price-bad' : undefined}
                    aria-invalid={saleTooLow || undefined}
                    value={isPercent ? salePercent : salePrice}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '');
                      if (isPercent) setSalePercent(v.slice(0, 2));
                      else setSalePrice(v);
                    }}
                    placeholder={isPercent ? '예: 20' : '예: 39000'}
                  />
                  {saleTooLow && (
                    <span className="op-price-warn">
                      <i className="ph-fill ph-warning-circle" /> {TOO_LOW_MSG('할인가')}
                    </span>
                  )}
                </label>
                <label className="ox-field">
                  할인 종료
                  <span className="lu-help">이 시각이 지나면 정상가로 돌아가요</span>
                  <input
                    type="datetime-local"
                    value={saleEnds}
                    onChange={(e) => setSaleEnds(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>

          <div className="op-price-preview">
            <span>학생에게 보이는 금액</span>
            <strong>{effective === 0 ? '무료' : `${effective.toLocaleString('ko-KR')}원`}</strong>
            {useSale && saleNum > 0 && priceNum > saleNum && (
              <s>{priceNum.toLocaleString('ko-KR')}원</s>
            )}
            {isPercent && pctNum > 0 && pctNum < 100 && (
              <span className="op-price-pct">{pctNum}% 할인</span>
            )}
          </div>

          {err && (
            <div className="op-form-err">
              <i className="ph-fill ph-warning-circle" /> {err}
            </div>
          )}

          <div className="op-form-actions">
            <button className="op-btn op-btn--reject" disabled={saving} onClick={onClose}>
              취소
            </button>
            <button
              className="op-btn op-btn--approve"
              disabled={saving || priceTooLow || saleTooLow}
              onClick={save}
            >
              <i className="ph-bold ph-check" /> {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 코스 수료 시험 문항 모달 =================
   완전학습(mastery) — 강의 문항 모달의 단순화판. 출제 시점·되감기·이미지가 없는 대신
   origin(자작/기출)·source(출처)가 있다. 기출은 출처가 필수(비영리 교육용 이용 전제 —
   서버 400). 설계: docs/course-exam-design.md */
interface ExamQForm {
  id: string | null; // null = 새 문항
  prompt: string;
  options: string[]; // 2~6개
  answerIdx: number[]; // 정답(다답 지원). 옵션 인덱스 집합
  explain: string;
  origin: ExamOrigin;
  source: string;
  status: string;
}

const EXAM_ORIGIN_LABEL: Record<ExamOrigin, string> = {
  manual: '자작',
  past_exam: '기출',
  lecture: '강의',
  llm: 'AI',
};

/** 코스 수료 시험 문항 모달 — 코스 관리 화면(OpsCourses)에서 코스별
 *  '수료 시험 문항' 버튼으로 여는 것과 완전히 같은 컴포넌트를, 코스 관리 전용 화면
 *  (OpsCourses.tsx)의 '시험 문항' 버튼에서도 그대로 재사용한다(중복 구현 대신 export). */
export function ExamQuestionsModal({
  course,
  onClose,
  say,
}: {
  course: OpsCourse;
  onClose: () => void;
  say: (m: string) => void;
}) {
  const { me } = useAuth();
  const isOps = me?.role === 'ops'; // 운영자는 통계·문항 조회만, 저작(추가·AI·수정·삭제)은 숨김
  const [rows, setRows] = useState<OpsExamQuestion[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState<ExamQForm | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  // 시험 통계(문항별 통과율·오답·근사 시간 + 수료율) — 강사가 어느 문항에서 학생이 막히나
  // 보고 문항을 고치게. 로드 실패는 조용히 미표시(가짜 데이터 대신 부재 — 관리 화면 부가 정보).
  const [stats, setStats] = useState<ExamStats | null>(null);
  // 편집 중 문항의 현재 이미지 URL(프롬프트·보기별) — 이미지는 저장된 문항에 즉시 첨부/삭제되므로
  // API 응답(갱신된 문항)으로 이 뷰를 갱신한다. 새 문항(id 없음)은 저장 후에야 첨부 가능.
  const [editImages, setEditImages] = useState<{ prompt: string | null; options: (string | null)[] }>(
    { prompt: null, options: [] },
  );

  const load = () => {
    lectureApi
      .opsExamQuestions(course.id)
      .then(setRows)
      .catch((e) => setLoadErr(errorDetail(e, '수료 시험 문항을 불러오지 못했어요.')));
  };
  useEffect(load, [course.id]);
  useEffect(() => {
    lectureApi.opsExamStats(course.id).then(setStats).catch(() => setStats(null));
  }, [course.id]);

  // 문항 id → 통계(빠른 조회). 통계 없거나 아무도 안 푼 문항은 배지 미표시.
  const statByQ = new Map((stats?.questions ?? []).map((s) => [s.id, s]));

  const activeCount = (rows ?? []).filter((q) => q.status === 'active').length;

  const newForm = (): ExamQForm => ({
    id: null, prompt: '', options: ['', ''], answerIdx: [0], explain: '',
    origin: 'manual', source: '', status: 'active',
  });

  const editForm = (q: OpsExamQuestion): ExamQForm => ({
    id: q.id, prompt: q.prompt, options: [...q.options], answerIdx: [...q.answer_indexes],
    explain: q.explain ?? '', origin: q.origin, source: q.source ?? '', status: q.status,
  });

  const setOpt = (i: number, v: string) => {
    if (!form) return;
    const options = [...form.options];
    options[i] = v;
    setForm({ ...form, options });
  };
  const addOpt = () => form && form.options.length < 6 && setForm({ ...form, options: [...form.options, ''] });
  const removeOpt = (i: number) => {
    if (!form || form.options.length <= 2) return;
    const options = form.options.filter((_, j) => j !== i);
    // 정답 인덱스 재조정 — 지운 뒤 인덱스가 밀리므로 유효한 것만 남겨 다시 매핑
    const answerIdx = form.answerIdx
      .filter((a) => a !== i)
      .map((a) => (a > i ? a - 1 : a));
    setForm({ ...form, options, answerIdx: answerIdx.length ? answerIdx : [0] });
  };
  const toggleAnswer = (i: number) => {
    if (!form) return;
    const has = form.answerIdx.includes(i);
    const answerIdx = has ? form.answerIdx.filter((a) => a !== i) : [...form.answerIdx, i];
    setForm({ ...form, answerIdx: answerIdx.length ? answerIdx.sort((a, b) => a - b) : [i] });
  };

  const save = async () => {
    if (!form) return;
    if (!form.prompt.trim()) return setErr('문제를 입력해 주세요.');
    if (form.options.some((o) => !o.trim())) return setErr('보기를 모두 채워 주세요(빈 보기 불가).');
    if (!form.answerIdx.length) return setErr('정답을 하나 이상 선택해 주세요.');
    if (form.origin === 'past_exam' && !form.source.trim())
      return setErr('기출 문항은 출처가 필수예요. 예: 2024학년도 수능 수학 15번');
    setSaving(true);
    setErr('');
    const body = {
      prompt: form.prompt.trim(),
      options: form.options.map((o) => o.trim()),
      answer_indexes: form.answerIdx,
      explain: form.explain.trim() || null,
      origin: form.origin,
      source: form.source.trim() || null,
      status: form.status,
    };
    try {
      if (form.id) {
        await lectureApi.opsExamQuestionUpdate(course.id, form.id, body);
        say('수료 시험 문항을 수정했어요.');
      } else {
        await lectureApi.opsExamQuestionCreate(course.id, body);
        say('수료 시험 문항을 추가했어요.');
      }
      setForm(null);
      load();
    } catch (e) {
      setErr(errorDetail(e, '수료 시험 문항 저장에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  // 이미지 첨부/삭제 — 저장된 문항(form.id)에만. 응답(갱신된 문항)으로 이미지 뷰·목록을 갱신한다.
  const attachImg = async (slot: 'prompt' | 'option', optionIndex: number | undefined, file: File) => {
    if (!form?.id) return;
    try {
      const updated = await lectureApi.opsExamImageAttach(course.id, form.id, { slot, optionIndex, file });
      setEditImages({ prompt: updated.prompt_image_url, options: updated.option_image_urls });
      load();
    } catch (e) {
      setErr(errorDetail(e, '이미지 업로드에 실패했어요(png/jpg/gif/webp).'));
    }
  };
  const deleteImg = async (slot: 'prompt' | 'option', optionIndex?: number) => {
    if (!form?.id) return;
    try {
      const updated = await lectureApi.opsExamImageDelete(course.id, form.id, { slot, optionIndex });
      setEditImages({ prompt: updated.prompt_image_url, options: updated.option_image_urls });
      load();
    } catch (e) {
      setErr(errorDetail(e, '이미지 삭제에 실패했어요.'));
    }
  };

  const remove = async (q: OpsExamQuestion) => {
    if (!window.confirm('이 수료 시험 문항을 삭제할까요? 학생 응답 기록은 보존돼요.')) return;
    try {
      await lectureApi.opsExamQuestionDelete(course.id, q.id);
      say('수료 시험 문항을 삭제했어요.');
      if (form?.id === q.id) setForm(null);
      load();
    } catch (e) {
      say(errorDetail(e, '수료 시험 문항 삭제에 실패했어요.'));
    }
  };

  // 2단계 문항 채우기 가속 — 가져온/생성한 문항은 모두 draft라 강사 검수 후 공개한다.
  const [bulkBusy, setBulkBusy] = useState<'import' | 'gen' | null>(null);

  const importFromLectures = async () => {
    setBulkBusy('import');
    try {
      const r = await lectureApi.opsExamImportFromLectures(course.id);
      say(
        r.imported > 0
          ? `강의 문항 ${r.imported}개를 수료 시험 문항 초안으로 가져왔어요${r.skipped ? ` (${r.skipped}개 건너뜀)` : ''}. 검수 후 공개하세요.`
          : `가져올 새 강의 문항이 없어요${r.skipped ? ` (${r.skipped}개는 이미 가져왔거나 미지원)` : ''}.`,
      );
      load();
    } catch (e) {
      say(errorDetail(e, '강의 문항 가져오기에 실패했어요.'));
    } finally {
      setBulkBusy(null);
    }
  };

  const generateLlm = async () => {
    const raw = window.prompt('AI로 만들 수료 시험 문항 개수 (1~20)', '5');
    if (raw == null) return;
    const n = Math.max(1, Math.min(20, parseInt(raw, 10) || 5));
    setBulkBusy('gen');
    try {
      const r = await lectureApi.opsExamGenerate(course.id, n);
      const trNote = r.used_transcripts > 0
        ? `강의 자막 ${r.used_transcripts}개 기반`
        : '강의 제목·설명 기반(자막을 넣으면 더 깊은 문항이 나와요)';
      say(`${trNote}로 AI가 수료 시험 문항 ${r.created}개를 초안으로 만들었어요. 검수 후 공개하세요.`);
      load();
    } catch (e) {
      say(errorDetail(e, 'AI 문항 생성에 실패했어요. (운영 콘솔 설정에서 모델·키를 확인하세요)'));
    } finally {
      setBulkBusy(null);
    }
  };

  const mRef = useModalA11y<HTMLDivElement>(() => { if (!saving) onClose(); });
  return (
    <div className="op-bh-overlay" onClick={() => !saving && onClose()}>
      <div
        className="op-formmodal op-lect-widemodal"
        onClick={(e) => e.stopPropagation()}
        ref={mRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="수료 시험 문항"
      >
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-exam" /> 수료 시험 문항 · {course.title}
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={saving}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="op-lect-qtools">
          {/* 문항 저작(추가·가져오기·AI)은 강사 전용 — 운영자는 통계·문항 조회만(ops 권한 B) */}
          {!isOps && (
            <div className="op-lect-qbtns">
              <button
                className="op-btn op-btn--approve"
                onClick={() => { setErr(''); setForm(newForm()); setEditImages({ prompt: null, options: [] }); }}
                disabled={bulkBusy !== null}
              >
                <i className="ph-bold ph-plus" /> 문항 추가
              </button>
              <button
                className="op-btn op-btn--soft"
                onClick={importFromLectures}
                disabled={bulkBusy !== null}
                title="이 코스 강의의 확인 문항을 수료 시험 문항 초안으로 가져와요(이미 가져온 건 건너뜀)"
              >
                <i className="ph-bold ph-download-simple" />{' '}
                {bulkBusy === 'import' ? '가져오는 중…' : '강의 문항 가져오기'}
              </button>
              <button
                className="op-btn op-btn--soft"
                onClick={generateLlm}
                disabled={bulkBusy !== null}
                title="AI가 코스 강의 구성으로 수료 시험 문항 초안을 만들어요(운영 콘솔 설정의 생성 모델 사용)"
              >
                <i className="ph-bold ph-magic-wand" />{' '}
                {bulkBusy === 'gen' ? '생성 중…' : 'AI로 생성'}
              </button>
            </div>
          )}
          <span className="lu-help">
            {isOps
              ? `공개 문항 ${activeCount}개 — 운영자는 통과율·수료율 통계와 문항을 검수만 해요(저작은 강사).`
              : activeCount > 0
              ? `공개 문항 ${activeCount}개 — 학생이 강의를 전부 완주하면 이 문항들을 다 맞혀야 수료해요(틀린 건 다시).`
              : '공개 문항이 없어요 — 활성 문항이 0개면 학생에게 수료 시험이 보이지 않아요. (가져오기·AI 생성 문항은 초안이라 검수 후 공개하세요.)'}
          </span>
        </div>

        {/* 코스 시험 지표 — 응시가 있을 때만(0명이면 의미 없는 0% 밴드 숨김). 운영자=수료율,
            강사=문항별 통과율(아래 행)로 약한 대목 파악. */}
        {stats && stats.attempted_students > 0 && (
          <div className="op-exam-stats" role="group" aria-label="코스 시험 지표">
            <div className="op-exam-stat">
              <span className="op-exam-stat-num">{stats.attempted_students}</span>
              <span className="op-exam-stat-lb">응시 학생</span>
            </div>
            <div className="op-exam-stat">
              <span className="op-exam-stat-num">{stats.completions}</span>
              <span className="op-exam-stat-lb">수료</span>
            </div>
            <div className="op-exam-stat">
              <span className="op-exam-stat-num">
                {stats.completion_rate != null ? `${Math.round(stats.completion_rate * 100)}%` : '—'}
              </span>
              <span className="op-exam-stat-lb">수료율</span>
            </div>
            <div className="op-exam-stat">
              <span className="op-exam-stat-num">{stats.perfects}</span>
              <span className="op-exam-stat-lb">완벽 통과</span>
            </div>
          </div>
        )}

        {form && (
          <div className="op-lect-qform">
            <label className="ox-field op-form-span2">
              문제
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="예: 다음 중 이차함수의 그래프가 위로 볼록한 경우는?"
                rows={2}
              />
            </label>

            {/* 이미지 문항 — 저장된 문항에만 붙는다(이미지는 문항 id에 즉시 첨부). 새 문항은 저장 후. */}
            {form.id ? (
              <div className="op-exam-imgrow op-form-span2">
                <span className="op-exam-imglabel"><i className="ph-bold ph-image" /> 문제 이미지</span>
                {editImages.prompt && (
                  <img className="op-exam-imgthumb" src={API_ORIGIN + editImages.prompt} alt="문제 이미지" />
                )}
                <label className="op-btn op-btn--soft">
                  <i className="ph-bold ph-upload-simple" /> {editImages.prompt ? '교체' : '이미지 추가'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) attachImg('prompt', undefined, f); e.target.value = ''; }}
                  />
                </label>
                {editImages.prompt && (
                  <button className="op-btn op-btn--reject op-lect-danger" onClick={() => deleteImg('prompt')}>
                    <i className="ph-bold ph-trash" /> 제거
                  </button>
                )}
              </div>
            ) : (
              <p className="op-exam-imghint op-form-span2">
                <i className="ph-bold ph-info" /> 문항을 먼저 저장하면 문제·보기에 이미지를 붙일 수 있어요.
              </p>
            )}

            <div className="op-exam-opts">
              <div className="op-exam-opts-head">
                <span>보기 · 정답 체크(복수 가능)</span>
                {form.options.length < 6 && (
                  <button className="op-btn op-btn--reject" onClick={addOpt}>
                    <i className="ph-bold ph-plus" /> 보기 추가
                  </button>
                )}
              </div>
              {form.options.map((o, i) => (
                <div key={i} className="op-exam-optrow">
                  <button
                    className={`op-exam-ansbtn${form.answerIdx.includes(i) ? ' op-exam-ansbtn--on' : ''}`}
                    onClick={() => toggleAnswer(i)}
                    title="정답으로 표시"
                  >
                    <i className={form.answerIdx.includes(i) ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'} />
                  </button>
                  <input
                    value={o}
                    onChange={(e) => setOpt(i, e.target.value)}
                    placeholder={`보기 ${i + 1}`}
                  />
                  {form.id && (editImages.options[i]
                    ? (
                      <>
                        <img className="op-exam-optthumb" src={API_ORIGIN + editImages.options[i]!} alt="" />
                        <button
                          className="op-btn op-btn--reject op-lect-danger"
                          title="보기 이미지 제거"
                          onClick={() => deleteImg('option', i)}
                        >
                          <i className="ph-bold ph-image-broken" />
                        </button>
                      </>
                    ) : (
                      <label className="op-btn op-btn--reject" title="보기 이미지 추가">
                        <i className="ph-bold ph-image" />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          hidden
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) attachImg('option', i, f); e.target.value = ''; }}
                        />
                      </label>
                    ))}
                  {form.options.length > 2 && (
                    <button className="op-btn op-btn--reject op-lect-danger" onClick={() => removeOpt(i)}>
                      <i className="ph-bold ph-x" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="op-form-grid">
              <label className="ox-field">
                출제 유형
                <select
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value as ExamOrigin })}
                >
                  <option value="manual">자작</option>
                  <option value="past_exam">기출</option>
                </select>
              </label>
              <label className="ox-field">
                공개 상태
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">공개(응시 대상)</option>
                  <option value="draft">임시(검수 중)</option>
                </select>
              </label>
              <label className="ox-field op-form-span2">
                출처 {form.origin === 'past_exam' && <span className="op-exam-req">필수</span>}
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="예: 2024학년도 대학수학능력시험 수학 15번"
                />
                <span className="lu-help">
                  기출은 비영리 교육용으로만 쓰고 출처를 항상 표시해요(학생 결과지에도 노출).
                </span>
              </label>
              <label className="ox-field op-form-span2">
                해설 (선택)
                <textarea
                  value={form.explain}
                  onChange={(e) => setForm({ ...form, explain: e.target.value })}
                  placeholder="채점 후 학생에게 보여줄 풀이"
                  rows={2}
                />
              </label>
            </div>

            {err && (
              <div className="op-form-err">
                <i className="ph-fill ph-warning-circle" /> {err}
              </div>
            )}
            <div className="op-form-actions">
              <button className="op-btn op-btn--reject" disabled={saving} onClick={() => setForm(null)}>
                취소
              </button>
              <button className="op-btn op-btn--approve" disabled={saving} onClick={save}>
                <i className="ph-bold ph-check" /> {saving ? '저장 중…' : form.id ? '저장' : '추가'}
              </button>
            </div>
          </div>
        )}

        <div className="op-logcard">
          {loadErr && <div className="op-form-err">{loadErr}</div>}
          {rows === null && !loadErr && <div className="op-logrow">불러오는 중…</div>}
          {rows !== null && rows.length === 0 && (
            <div className="op-logrow">
              아직 수료 시험 문항이 없어요. &lsquo;문항 추가&rsquo;로 첫 문항을 만드세요.
            </div>
          )}
          {(rows ?? []).map((q, i) => (
            <div key={q.id} className="op-logrow op-exam-qrow">
              <span className="op-exam-qnum">{i + 1}</span>
              <span className="op-exam-qbody">
                <b>{q.prompt}</b>
                {(q.prompt_image_url || (q.option_image_urls ?? []).some(Boolean)) && (
                  <span className="op-exam-qthumbs">
                    {q.prompt_image_url && (
                      <img className="op-exam-qthumb" src={API_ORIGIN + q.prompt_image_url} alt="문제 이미지" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    {(q.option_image_urls ?? []).map((u, i) =>
                      u ? <img key={i} className="op-exam-qthumb op-exam-qthumb--opt" src={API_ORIGIN + u} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null,
                    )}
                  </span>
                )}
                <small className="op-aimodel-desc">
                  <span className={`op-exam-tag op-exam-tag--${q.origin}`}>{EXAM_ORIGIN_LABEL[q.origin]}</span>
                  {q.status !== 'active' && <span className="op-exam-tag op-exam-tag--draft">임시</span>}
                  정답 {q.answer_indexes.length}개 · 보기 {q.options.length}개
                  {q.source ? ` · 출처: ${q.source}` : ''}
                </small>
                {(() => {
                  // 문항별 지표 — 시도 학생이 있을 때만. 통과율 낮음=약한 문항(강의 부족/오출제),
                  // 첫 시도 정답률 낮음=어려운 문항(최종 통과율은 완전학습이라 ~100% 수렴),
                  // 오답 재시도 많음=재시도 부담, 오답 선택지 분석=어느 보기가 학생을 낚나.
                  const s = statByQ.get(q.id);
                  if (!s || s.students_attempted === 0) return null;
                  const pr = s.pass_rate ?? 0;
                  const tone = pr >= 0.85 ? 'ok' : pr >= 0.6 ? 'mid' : 'low';
                  const ftr = s.first_try_rate;
                  const ftTone = ftr == null ? 'mid' : ftr >= 0.7 ? 'ok' : ftr >= 0.4 ? 'mid' : 'low';
                  // 낚인 오답 보기 — wrong_picks 많은 순(정답 보기가 부분정답으로 섞여도 표시)
                  const distractors = (s.options ?? [])
                    .filter((o) => o.wrong_picks > 0)
                    .sort((a, b) => b.wrong_picks - a.wrong_picks);
                  return (
                    <>
                      <small className="op-exam-qstat">
                        <span className={`op-exam-pass op-exam-pass--${tone}`} title="정복 학생 / 시도 학생(최종)">
                          <i className="ph-fill ph-target" /> 통과율 {Math.round(pr * 100)}%
                          <span className="op-exam-pass-sub"> ({s.students_mastered}/{s.students_attempted})</span>
                        </span>
                        {ftr != null && (
                          <span className={`op-exam-pass op-exam-pass--${ftTone}`} title="첫 시도에 맞힌 학생 / 시도 학생 — 실제 난이도·변별 신호">
                            <i className="ph-fill ph-flag-checkered" /> 첫시도 {Math.round(ftr * 100)}%
                            <span className="op-exam-pass-sub"> ({s.first_try_correct}/{s.students_attempted})</span>
                          </span>
                        )}
                        {s.wrong_attempts > 0 && (
                          <span className="op-exam-qstat-b" title="누적 오답 시도 수(재시도 부담)">
                            <i className="ph-fill ph-x-circle" /> 오답 {s.wrong_attempts}
                          </span>
                        )}
                        {s.avg_solve_ms > 0 && (
                          <span className="op-exam-qstat-b" title="평균 소요(근사: 회차 시간/문항 수)">
                            <i className="ph-fill ph-clock" /> ~{Math.round(s.avg_solve_ms / 1000)}초
                          </span>
                        )}
                      </small>
                      {distractors.length > 0 && (
                        <small className="op-exam-distractors" title="틀린 학생이 고른 보기 — 자주 낚이면 헷갈리는 보기(검토 대상)">
                          <i className="ph-fill ph-magnet" /> 낚인 보기:
                          {distractors.map((o) => (
                            <span
                              key={o.index}
                              className={`op-exam-distr${o.is_answer ? ' op-exam-distr--ans' : ''}`}
                            >
                              {o.text || `보기 ${o.index + 1}`}
                              <b> ×{o.wrong_picks}</b>
                              {o.is_answer && <span className="op-exam-distr-tag">정답</span>}
                            </span>
                          ))}
                        </small>
                      )}
                    </>
                  );
                })()}
              </span>
              {!isOps && (
                <span className="op-col-right op-lect-actions">
                  <button
                    className="op-btn op-btn--reject"
                    onClick={() => {
                      setErr('');
                      setForm(editForm(q));
                      setEditImages({ prompt: q.prompt_image_url, options: q.option_image_urls ?? [] });
                    }}
                  >
                    <i className="ph-bold ph-pencil-simple" /> 수정
                  </button>
                  <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(q)}>
                    <i className="ph-bold ph-trash" />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= 확인 문항 모달 ================= */
interface QForm {
  id: string | null; // null = 새 문항(저장하면 이미지 첨부가 열린다)
  /** 출제 시점 — 모든 문항이 이 시점 정각의 고정 핀(구간 모드는 제거됨 — 서버 lecture_pin_03) */
  position_sec: string;
  /** 내용 시작(되감기 지점) 입력 — '' = 미지정(서버 폴백: 출제 시점-30초) */
  content_start_sec: string;
  /** AI가 제안한 시점(강사 미확정) — 편집 시작 시 서버값, 강사가 시점을 바꾸면 false로(확정) */
  positionSuggested: boolean;
  prompt: string;
  /* 보기를 줄바꿈 textarea가 아니라 행 배열로 다룬다 — 이미지가 붙은 보기는 텍스트를
     비울 수 있는데(그림 전용 보기), textarea는 빈 줄을 표현·보존할 수 없고 빈 줄을
     걸러내면 보기 인덱스가 밀려 서버의 이미지(인덱스 키)와 어긋난다. */
  options: string[];
  /** 정답 보기 인덱스 목록(다중 선택 가능, 최소 1개) — 학생은 전부 담아야 정답(부분 정답 없음) */
  answer_indexes: number[];
  explain: string;
  status: string;
  /** 서버 재조회로 확인된 이미지 URL만 담는다(옵티미스틱 반영 금지 — 가짜 성공 방지) */
  promptImageUrl: string | null;
  optionImageUrls: (string | null)[];
  /** 서버와 인덱스가 일치하는 선두 보기 수 — 이 미만의 행만 이미지 첨부/표시가 안전하다.
      서버는 이미지를 '몇 번째 보기'로 기억한다: 행 추가(끝에 붙음)는 기존 행을 밀지 않지만,
      행 삭제는 그 뒤 행을 한 칸씩 당겨 저장 전 첨부가 엉뚱한 보기에 붙는다. 시작값은
      저장된 보기 수(그 밖은 서버에 없어 첨부 시 400), 삭제 시 삭제 지점까지 줄인다. */
  alignedUpTo: number;
}
const emptyQ = (): QForm => ({
  id: null,
  position_sec: '',
  content_start_sec: '',
  positionSuggested: false,
  prompt: '',
  options: ['', ''],
  answer_indexes: [0],
  explain: '',
  status: 'active',
  promptImageUrl: null,
  optionImageUrls: [null, null],
  alignedUpTo: 0,
});

/* 강사 제공 자막(전사) 바 — 확인 문항 모달 안. 자막이 있으면 AI 생성이 자동 STT 대신
   이 자막을 쓴다(품질↑·비용↓·OpenAI 키·25MB 한계 우회). SRT/VTT 업로드 + 붙여넣기. */
const _TR_SRC_LABEL: Record<string, string> = {
  srt: '강사 제공 SRT', vtt: '강사 제공 VTT', paste: '강사 붙여넣기', stt: '소리 자동 변환',
};
function TranscriptBar({
  lectureId,
  note,
}: {
  lectureId: string;
  note: (ok: boolean, msg: string) => void;
}) {
  const [st, setSt] = useState<TranscriptStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  // 전체 보기(전사 끝까지 검수) — 목록엔 preview 3개만, '전체 보기' 누르면 전체를 따로 로드.
  const [fullOpen, setFullOpen] = useState(false);
  const [fullSegs, setFullSegs] = useState<TranscriptSegment[] | null>(null);
  const [fullBusy, setFullBusy] = useState(false);

  const load = () => {
    lectureApi.opsTranscriptGet(lectureId).then(setSt).catch(() => setSt(null));
  };
  useEffect(load, [lectureId]);

  const openFull = async () => {
    setFullBusy(true);
    try {
      const r = await lectureApi.opsTranscriptGet(lectureId, true);
      setFullSegs(r.segments ?? []);
      setFullOpen(true);
    } catch (e) {
      note(false, errorDetail(e, '전사를 불러오지 못했어요.'));
    } finally {
      setFullBusy(false);
    }
  };

  const onUpload = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await lectureApi.opsTranscriptUpload(lectureId, f);
      setSt(r);
      note(true, `자막을 저장했어요 (${(r.source ?? '').toUpperCase()} · ${r.segment_count}개 구간). 이제 AI 생성이 이 자막을 써요.`);
    } catch (e) {
      note(false, errorDetail(e, '자막 업로드에 실패했어요. (SRT/VTT 파일)'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const savePaste = async () => {
    if (!pasteText.trim()) return;
    setBusy(true);
    try {
      const r = await lectureApi.opsTranscriptPut(lectureId, pasteText, 'auto');
      setSt(r);
      setPasteOpen(false);
      setPasteText('');
      note(true, `자막을 저장했어요 (붙여넣기 · ${r.segment_count}개 구간). 이제 AI 생성이 이 자막을 써요.`);
    } catch (e) {
      note(false, errorDetail(e, '자막 저장에 실패했어요. (SRT/VTT 내용이거나 "00:12 내용" 형식이어야 해요)'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('저장된 자막을 삭제할까요? 다음 AI 생성부터 소리 자동 변환으로 돌아가요.')) return;
    setBusy(true);
    try {
      await lectureApi.opsTranscriptDelete(lectureId);
      setSt({ has_transcript: false, source: null, segment_count: 0, preview: [], updated_at: null });
      note(true, '자막을 삭제했어요 — 다음 생성은 소리 자동 변환을 써요.');
    } catch (e) {
      note(false, errorDetail(e, '자막 삭제에 실패했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="op-lect-transcript">
      <div className="op-lect-tr-row">
        <div className="op-lect-tr-status">
          <i className="ph-fill ph-closed-captioning" />
          {st?.has_transcript ? (
            <span>
              <b>자막 있음</b> · {_TR_SRC_LABEL[st.source ?? ''] ?? st.source} · {st.segment_count}개 구간
              {' '}— AI 생성이 이 자막을 써요(소리 자동 변환 안 함).
            </span>
          ) : (
            <span>
              자막 없음 — AI 생성 시 강의 소리를 <b>자막으로 자동 변환</b>해요(자체 STT 워커, 무료).
              강사가 직접 자막을 올리면 정확도가 더 높아요.
            </span>
          )}
        </div>
        <div className="op-lect-tr-actions">
          <input
            ref={fileRef} type="file" accept=".srt,.vtt,text/plain" hidden
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
          />
          <button className="op-btn op-btn--soft" disabled={busy} onClick={() => fileRef.current?.click()}>
            <i className="ph-bold ph-upload-simple" /> 자막 파일
          </button>
          <button className="op-btn op-btn--soft" disabled={busy} onClick={() => setPasteOpen((v) => !v)}>
            <i className="ph-bold ph-clipboard-text" /> 붙여넣기
          </button>
          {st?.has_transcript && (
            <button className="op-btn op-btn--soft" disabled={fullBusy} onClick={openFull}>
              <i className="ph-bold ph-list-magnifying-glass" />{' '}
              {fullBusy ? '불러오는 중…' : '전체 보기'}
            </button>
          )}
          {st?.has_transcript && (
            <button className="op-btn op-btn--soft" disabled={busy} onClick={clear}>
              <i className="ph-bold ph-trash" /> 삭제
            </button>
          )}
        </div>
      </div>
      {pasteOpen && (
        <div className="op-lect-tr-paste">
          <textarea
            value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} spellCheck={false}
            placeholder={'자막 붙여넣기 — SRT/VTT 내용 또는 줄마다 "시각 내용" 형식:\n00:05 오늘은 분수를 배워요\n01:30 분모와 분자'}
          />
          <div className="op-lect-tr-paste-act">
            <button className="op-btn op-btn--reject" disabled={busy} onClick={() => { setPasteOpen(false); setPasteText(''); }}>
              취소
            </button>
            <button className="op-btn op-btn--approve" disabled={busy || !pasteText.trim()} onClick={savePaste}>
              {busy ? '저장 중…' : '자막 저장'}
            </button>
          </div>
        </div>
      )}
      {fullOpen && (
        <div className="op-bh-overlay" onClick={() => setFullOpen(false)}>
          <div className="op-formmodal op-lect-trfull" onClick={(e) => e.stopPropagation()}>
            <div className="op-bh-modal-h">
              <span>
                <i className="ph-fill ph-closed-captioning" /> 전사 전체 보기 ·{' '}
                {_TR_SRC_LABEL[st?.source ?? ''] ?? st?.source} · {st?.segment_count ?? 0}개 구간
              </span>
              <button className="op-bh-modal-x" onClick={() => setFullOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="op-lect-trfull-body">
              {(fullSegs ?? []).length === 0 ? (
                <p className="op-lect-trfull-empty">전사 내용이 없어요.</p>
              ) : (
                <ol className="op-lect-trfull-list">
                  {(fullSegs ?? []).map((s, i) => (
                    <li key={i}>
                      <span className="op-lect-trfull-time">{fmtMMSS(s.start)}</span>
                      <span className="op-lect-trfull-text">{s.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 확인 문항 모달 — '강의 관리' 목록에서 여는 것과 완전히 같은 컴포넌트를 '문항 검수' 화면
 *  (OpsQuestionReview.tsx)의 '수정' 버튼에서도 그대로 재사용한다(중복 구현 대신 export).
 *  initialEditId를 주면 목록 로드 후 그 문항의 편집 폼을 자동으로 연다(딥링크 진입점). */
export function QuestionsModal({
  lec,
  onClose,
  onChanged,
  initialEditId,
}: {
  lec: OpsLecture;
  onClose: () => void;
  onChanged: () => void;
  initialEditId?: string;
}) {
  const { me } = useAuth();
  const isOps = me?.role === 'ops'; // 운영자는 문항 조회(검수)만, 저작(추가·AI·자막·수정/삭제) 숨김
  const [items, setItems] = useState<OpsLectureQuestion[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState<QForm | null>(null); // null = 편집 폼 닫힘
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState(''); // LLM 생성 등 서버 에러 배너(503 정직 표시)
  const [bannerOk, setBannerOk] = useState(false); // true = 성공 안내(에러 스타일과 구분)
  const [saving, setSaving] = useState(false);
  const [genN, setGenN] = useState('3');
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState<string | null>(null); // 생성 중 세부 단계 라벨용
  // 고급 설정(되감기 지점) 펼침 여부 — 대개 자동이라 기본 접어 폼을 단순하게(초심자 부담↓).
  const [showAdvanced, setShowAdvanced] = useState(false);
  // '이 화면 사용법' 접힘 상태를 기억한다(localStorage) — 처음엔 펼쳐 안내하되, 익숙해진 강사가
  // 한 번 접으면 다음 방문에도 접힌 채로(재방문 시 길지 않게). 사용자 요청.
  const [guideOpen, setGuideOpen] = useState(() => {
    try { return localStorage.getItem('catchap_qguide_collapsed') !== '1'; } catch { return true; }
  });
  const changedRef = useRef(false);
  // 생성 폴링 활성 플래그 — 모달이 닫히면(unmount) false로 만들어 폴링 루프를 멈춘다
  // (잡은 서버에서 계속되고, 다시 열면 초안이 보인다). setState-after-unmount 방지.
  const genPollRef = useRef(false);
  useEffect(() => () => { genPollRef.current = false; }, []);
  // 진행 중인 생성 잡을 강의별로 기억한다(localStorage) — 창을 닫거나 뒤로 나갔다 다시 열어도
  // '생성 중'을 이어서 보여주고 폴링을 재개하기 위함(사용자 제보: 나갔다 오면 진행 상태가 안 보임).
  const GENJOB_KEY = `catchap_genjob_${lec.id}`;
  const [genElapsed, setGenElapsed] = useState(0); // 생성 경과(초) — 멈춘 것처럼 안 보이게 표시
  const genStartRef = useRef(0);
  // 경과 타이머 — 생성 중 매초 갱신
  useEffect(() => {
    if (!generating) return;
    const t = window.setInterval(() => {
      setGenElapsed(Math.max(0, Math.round((Date.now() - genStartRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(t);
  }, [generating]);
  const clearGenJob = () => {
    try { localStorage.removeItem(GENJOB_KEY); } catch { /* 저장소 접근 불가여도 무해 */ }
  };
  /* 이미지 업로드/삭제 in-flight 슬롯('prompt' | 'opt-{i}') — 동시에 하나만 */
  const [imgBusy, setImgBusy] = useState<string | null>(null);
  const [imgProgress, setImgProgress] = useState<number | null>(null);
  const [imgDragOver, setImgDragOver] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const imgTargetRef = useRef<{ slot: 'prompt' | 'option'; optionIndex?: number; key: string } | null>(null);
  /* 강의 화면 따오기 모달 — slot=position이면 시점 선택 전용(문항 저장 전에도 열 수 있다).
     prompt/option 첨부는 문항 id가 필요해 저장된 문항에서만 연다. */
  const [capture, setCapture] = useState<{
    slot: 'prompt' | 'option' | 'position';
    optionIndex?: number;
  } | null>(null);

  const load = () => {
    setLoadErr('');
    lectureApi
      .opsQuestions(lec.id)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setLoadErr(errorDetail(e, '문항 목록을 불러오지 못했어요.'));
      });
  };
  useEffect(load, [lec.id]);

  const close = () => {
    // 동기 저장(save)·이미지 업로드 중에만 닫힘을 막는다(중단 시 데이터 유실). 생성(generating)은
    // 서버 백그라운드 잡이라 닫아도 계속되므로 막지 않는다 — 막으면 몇 분간 창에 갇힌다(사용자 제보).
    if (saving || imgBusy != null) return;
    genPollRef.current = false; // 폴링만 멈춤(잡은 서버서 계속·job_id는 남겨 재진입 시 이어봄)
    if (changedRef.current) onChanged(); // 문항 수 변경을 목록에 반영
    onClose();
  };
  const modalRef = useModalA11y<HTMLDivElement>(close); // ESC 닫기·포커스 트랩·포커스 이동/복원

  const openEdit = (q: OpsLectureQuestion) => {
    setErr('');
    setShowAdvanced(q.content_start_sec != null); // 되감기 값이 있으면 고급 자동 펼침
    setForm({
      id: q.id,
      position_sec: String(q.position_sec),
      content_start_sec: q.content_start_sec != null ? fmtMMSS(q.content_start_sec) : '',
      positionSuggested: !!q.position_suggested,
      prompt: q.prompt ?? '',
      options: [...q.options],
      // 구버전 서버는 answer_indexes를 안 준다 — [answer_index]로 본다(하위호환)
      answer_indexes: q.answer_indexes ?? [q.answer_index],
      explain: q.explain ?? '',
      status: q.status,
      promptImageUrl: q.prompt_image_url ?? null,
      optionImageUrls: q.options.map((_, i) => q.option_image_urls?.[i] ?? null),
      alignedUpTo: q.options.length,
    });
  };

  // 딥링크 진입 — '문항 검수' 화면에서 특정 문항의 '수정'을 눌러 들어오면, 목록이 로드되는
  // 대로 그 문항의 편집 폼을 자동으로 연다(한 번만 — ref로 재적용 방지, 저장 후 재로드에서
  // 다시 튀어 열리지 않게).
  const appliedInitialEditRef = useRef(false);
  useEffect(() => {
    if (!initialEditId || appliedInitialEditRef.current || !items) return;
    const target = items.find((q) => q.id === initialEditId);
    if (target) {
      appliedInitialEditRef.current = true;
      openEdit(target);
    }
  }, [items, initialEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form) return;
    const options = form.options.map((s) => s.trim());
    const pos = parseSecInput(form.position_sec);
    const ans = [...form.answer_indexes].sort((a, b) => a - b);
    if (!form.prompt.trim()) return setErr('문제는 꼭 적어야 해요.');
    if (options.length < 2 || options.length > 6) return setErr('보기는 2~6개여야 해요.');
    // 이미지가 붙은 보기만 텍스트 생략 허용(그림 전용 보기) — 서버 규칙과 동일
    const missing = options.findIndex((o, i) => !o && !form.optionImageUrls[i]);
    if (missing >= 0)
      return setErr(`${missing + 1}번 보기가 비어 있어요 — 텍스트를 쓰거나 이미지를 붙인 뒤 비우세요.`);
    if (ans.length === 0) return setErr('정답 보기를 최소 1개 지정하세요.');
    if (ans.some((a) => !(a >= 0 && a < options.length)))
      return setErr('정답으로 지정된 보기가 없어요.');
    if (pos == null || pos < 0)
      return setErr('출제 시점은 초(예: 200) 또는 분:초(예: 3:20) 형태로 입력하세요.');
    /* 시점 범위는 서버(400)와 같은 규칙으로 제출 전에 막는다 — 문구도 서버와 동일하게.
       둘 다 공개(active)만 강제: draft는 '시점 미배치·후보'라 범위 밖도 저장된다(영상
       길이 축소로 밖에 남은 draft의 프롬프트 수정이 막히지 않게 — 활성화 때 걸러진다). */
    if (form.status === 'active' && pos >= lec.duration_sec)
      return setErr(
        `출제 시점이 영상 길이를 벗어났습니다. 영상 안의 시점을 지정해 주세요. (영상 길이 ${fmtMMSS(lec.duration_sec)})`,
      );
    // 서버와 동일 규칙: 공개(active)만 1초 이상 강제 — draft는 '시점 미배치'(0)로 저장 가능
    if (form.status === 'active' && pos < 1)
      return setErr(
        '공개 문항은 출제 시점이 1초 이상이어야 합니다(0초는 아직 아무것도 보지 않은 지점이라 뜰 수 없어요).',
      );
    // 내용 시작(되감기 지점) — 빈 값 = 미지정(서버 폴백). 지정 시 서버와 같은 규칙으로 선차단.
    let contentStart: number | null = null;
    if (form.content_start_sec.trim() !== '') {
      contentStart = parseSecInput(form.content_start_sec);
      if (contentStart == null || contentStart < 0)
        return setErr('내용 시작 시점은 초(예: 170) 또는 분:초(예: 2:50) 형태로 입력하세요.');
      if (contentStart >= pos)
        return setErr(
          '내용 시작(되감기) 시점은 출제 시점보다 앞이어야 합니다. 문항이 다루는 내용이 시작되는 시점을 지정해 주세요.',
        );
    }
    setSaving(true);
    setErr('');
    try {
      const body = {
        position_sec: pos,
        // 항상 명시로 보낸다 — null이면 서버가 지정 해제(폴백 복귀). 미전송(변경 없음)과 구분.
        content_start_sec: contentStart,
        prompt: form.prompt.trim(),
        options,
        // 목록이 정본 — answer_index는 첫 값으로 함께 보내 구버전 서버에서도 깨지지 않는다
        answer_indexes: ans,
        answer_index: ans[0],
        explain: form.explain,
        status: form.status,
      };
      if (form.id) {
        await lectureApi.opsQuestionUpdate(lec.id, form.id, body);
        changedRef.current = true;
        setForm(null);
        load();
      } else {
        /* 신규 문항: 이미지 첨부에는 문항 id가 필요하다 — 저장 후 폼을 닫는 대신,
           재조회로 실재를 확인한 그 문항의 편집 폼으로 바로 전환해 이미지 첨부 단계를 잇는다
           (강사가 "저장→목록에서 다시 수정 클릭"을 안 해도 되게). */
        const created = await lectureApi.opsQuestionCreate(lec.id, body);
        changedRef.current = true;
        let fresh: OpsLectureQuestion[];
        try {
          fresh = await lectureApi.opsQuestions(lec.id);
        } catch {
          throw new Error(
            '저장은 됐을 수 있지만 목록 확인에 실패했어요 — 다시 저장하지 말고 모달을 닫았다 열어 확인하세요.',
          );
        }
        setItems(fresh);
        // 재조회가 성공했으니 이전 로드 실패 배너는 스테일 — 지워야 활성 0개 경고도 정확히 뜬다
        setLoadErr('');
        const mine = fresh.find((x) => x.id === created.id);
        if (!mine) throw new Error('저장 후 목록에서 문항을 확인하지 못했어요 — 새로고침 후 확인하세요.');
        openEdit(mine);
        setBannerOk(true);
        setBanner('문항을 저장했어요 — 이제 문제·보기에 이미지를 붙일 수 있어요.');
      }
    } catch (e) {
      setErr(e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '문항 저장에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  /* ---- 이미지 첨부/삭제 — 저장된 문항에서만, 성공 표기는 재조회 확인 후에만 ---- */
  const pickImage = (slot: 'prompt' | 'option', optionIndex?: number) => {
    imgTargetRef.current = {
      slot,
      optionIndex,
      key: slot === 'prompt' ? 'prompt' : `opt-${optionIndex}`,
    };
    imgInputRef.current?.click();
  };

  /** 첨부 + 재조회 확인. 반환: null = 검증된 성공, string = 사용자에게 보여준 실패 사유
   *  (캡처 모달이 결과를 보고 닫을지/에러를 띄울지 정한다 — 성공 위장 금지) */
  const attachImage = async (
    slot: 'prompt' | 'option',
    optionIndex: number | undefined,
    file: File,
    key: string,
  ): Promise<string | null> => {
    if (!form?.id) return '문항을 먼저 저장해야 이미지를 붙일 수 있어요.';
    if (imgBusy != null) return '다른 이미지를 올리는 중이에요 — 끝난 뒤 다시 시도하세요.';
    const qid = form.id;
    setErr('');
    setImgBusy(key);
    setImgProgress(0);
    try {
      await lectureApi.attachQuestionImage(lec.id, qid, { slot, optionIndex, file }, (e) => {
        if (e.total) setImgProgress(Math.round((e.loaded / e.total) * 100));
      });
      // 성공 표기는 서버 재조회로 이미지가 실재함을 확인한 뒤에만 — 응답만 믿지 않는다.
      let fresh: OpsLectureQuestion[];
      try {
        fresh = await lectureApi.opsQuestions(lec.id);
      } catch {
        throw new Error(
          '업로드는 됐을 수 있지만 확인 재조회에 실패했어요 — 다시 올리지 말고 모달을 닫았다 열어 확인하세요.',
        );
      }
      setItems(fresh);
      const mine = fresh.find((x) => x.id === qid);
      const freshUrl =
        slot === 'prompt' ? mine?.prompt_image_url : mine?.option_image_urls?.[optionIndex ?? -1];
      if (!mine || !freshUrl)
        throw new Error('업로드 후 서버에서 이미지를 확인하지 못했어요 — 다시 시도하세요.');
      setForm((f) =>
        f && f.id === qid
          ? {
              ...f,
              promptImageUrl: slot === 'prompt' ? freshUrl : f.promptImageUrl,
              optionImageUrls:
                slot === 'option'
                  ? f.optionImageUrls.map((u, i) => (i === optionIndex ? freshUrl : u))
                  : f.optionImageUrls,
            }
          : f,
      );
      return null;
    } catch (e) {
      const msg =
        e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '이미지 업로드에 실패했어요.');
      setErr(msg);
      return msg;
    } finally {
      setImgBusy(null);
      setImgProgress(null);
    }
  };

  const removeImage = async (slot: 'prompt' | 'option', optionIndex: number | undefined, key: string) => {
    if (!form?.id || imgBusy != null) return;
    /* 텍스트가 빈 보기의 이미지 삭제는 서버가 400으로 거부한다(보기가 통째로 빈다).
       서버에 보내기 전에 같은 규칙으로 막고 탈출 순서까지 안내한다 — 서버 문구만 보여주면
       "텍스트를 채워 주세요 → (폼에 입력) → 또 400" 순환에 빠진다(폼 입력은 저장 전이라 서버가 모른다). */
    if (slot === 'option' && optionIndex != null && !form.options[optionIndex]?.trim()) {
      setErr(
        '텍스트가 없는 보기의 이미지는 지울 수 없어요(보기가 통째로 비어요). 먼저 텍스트를 입력하고 "문항 저장"을 누른 뒤 삭제하세요.',
      );
      return;
    }
    if (!window.confirm(slot === 'prompt' ? '문제 이미지를 삭제할까요?' : '이 보기의 이미지를 삭제할까요?'))
      return;
    const qid = form.id;
    setErr('');
    setImgBusy(key);
    try {
      await lectureApi.deleteQuestionImage(lec.id, qid, { slot, optionIndex });
      // 삭제도 재조회로 확인 — 서버에 남아 있으면 사라졌다고 표시하지 않는다.
      let fresh: OpsLectureQuestion[];
      try {
        fresh = await lectureApi.opsQuestions(lec.id);
      } catch {
        throw new Error('삭제 확인 재조회에 실패했어요 — 모달을 닫았다 열어 확인하세요.');
      }
      setItems(fresh);
      const mine = fresh.find((x) => x.id === qid);
      const freshUrl =
        slot === 'prompt' ? mine?.prompt_image_url : mine?.option_image_urls?.[optionIndex ?? -1];
      if (!mine || freshUrl) throw new Error('삭제 후에도 서버에 이미지가 남아 있어요 — 다시 시도하세요.');
      setForm((f) =>
        f && f.id === qid
          ? {
              ...f,
              promptImageUrl: slot === 'prompt' ? null : f.promptImageUrl,
              optionImageUrls:
                slot === 'option'
                  ? f.optionImageUrls.map((u, i) => (i === optionIndex ? null : u))
                  : f.optionImageUrls,
            }
          : f,
      );
    } catch (e) {
      // 서버 거부 문구 그대로 노출. 단 '빈 텍스트 보기' 400인데 폼에는 텍스트가 있다면,
      // 그 텍스트가 아직 저장 전이라는 뜻 — 서버 문구만으로는 순환에 빠지므로 탈출 경로를 덧붙인다.
      let msg =
        e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '이미지 삭제에 실패했어요.');
      if (slot === 'option' && msg.includes('텍스트가 빈 보기'))
        msg += ' 입력한 텍스트는 아직 저장 전이에요 — 먼저 "문항 저장"을 누른 뒤 다시 삭제하세요.';
      setErr(msg);
    } finally {
      setImgBusy(null);
    }
  };

  /* ---- 보기 행 추가/삭제 ---- */
  const addOption = () => {
    if (!form || form.options.length >= 6) return;
    // 끝에 붙이는 추가는 기존 행을 밀지 않는다 — alignedUpTo 유지(기존 행 첨부 계속 가능)
    setForm({
      ...form,
      options: [...form.options, ''],
      optionImageUrls: [...form.optionImageUrls, null],
    });
  };

  const removeOption = (i: number) => {
    if (!form) return;
    setErr('');
    if (form.options.length <= 2) return setErr('보기는 최소 2개예요.');
    /* 서버는 보기 이미지를 '몇 번째 보기'로 기억한다. 이 행을 지우면 뒤 보기들이 한 칸씩
       당겨져 이미지가 다른 보기에 붙거나 저장 시 삭제된다 — 어긋난 상태를 만들지 않게
       이 행(및 뒤 행)에 이미지가 있으면 먼저 이미지를 지우게 안내한다. */
    if (form.optionImageUrls.some((u, j) => u != null && j >= i))
      return setErr(
        `${i + 1}번 보기를 지우려면 그 보기부터 뒤쪽 보기의 이미지를 먼저 삭제하세요 — 보기가 당겨지면 이미지가 다른 보기에 붙어버려요.`,
      );
    // 지운 행은 정답 목록에서 빼고 뒤 행은 한 칸씩 당긴다 — 다 빠지면 1번 보기로 폴백(최소 1개 유지)
    const shifted = form.answer_indexes.filter((a) => a !== i).map((a) => (a > i ? a - 1 : a));
    setForm({
      ...form,
      options: form.options.filter((_, j) => j !== i),
      optionImageUrls: form.optionImageUrls.filter((_, j) => j !== i),
      answer_indexes: shifted.length > 0 ? shifted : [0],
      alignedUpTo: Math.min(form.alignedUpTo, i), // 삭제 지점 뒤 행은 당겨져 서버 인덱스와 어긋난다
    });
  };

  const approve = async (q: OpsLectureQuestion) => {
    try {
      await lectureApi.opsQuestionUpdate(lec.id, q.id, { status: 'active' });
      changedRef.current = true;
      load();
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, '승인에 실패했어요.'));
    }
  };

  const toBank = async (q: OpsLectureQuestion) => {
    if (!window.confirm('이 문항을 전체학습 문제 은행으로 보낼까요? (확인 문항이 아닌 일반 학습 문제로 쓰여요)'))
      return;
    try {
      const res = await lectureApi.opsQuestionToBank(lec.id, q.id);
      setBannerOk(true);
      // runtime_visible=false = DB엔 들어갔지만 런타임 반영 실패(재기동 필요) — 숨기지 않는다
      const demoteNote = res.demoted_from_active
        ? ' (이 문항은 확인 문항 출제에서 빠졌어요 — 상식으로 풀려 시청 검증엔 부적합)'
        : '';
      setBanner(
        (res.runtime_visible
          ? `은행에 배치했어요(${res.bank_id}) — 오늘의퀴즈·은행 풀에 바로 반영됩니다.`
          : `은행 DB에는 저장됐지만 즉시 반영에 실패했어요(${res.bank_id}) — 서버 재기동 후 나타납니다.`) +
          demoteNote,
      );
      load();
    } catch (e) {
      // 다답형·이미지 400, 은행 미적재·중복 409 — 서버 사유를 그대로 노출
      setBannerOk(false);
      setBanner(errorDetail(e, '은행 배치에 실패했어요.'));
    }
  };

  // 은행 적합 문항 대량 승격 — 강사가 '다중 선택'한 것만(선택=검토, 자동 무검토 아님).
  // 후보 = verdict=bank·미배치(draft·active 모두 — 은행 문항은 확인 문항으로 안 쓰여 보통 draft로 남는다).
  const bankCandidates = (items ?? []).filter(
    (q) => q.suggested_placement === 'bank' && !q.bank_placed && q.status === 'draft',
  );
  const [bankSel, setBankSel] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState(false);
  const toggleBankSel = (id: string) =>
    setBankSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedBankIds = bankCandidates.filter((q) => bankSel.has(q.id)).map((q) => q.id);
  const allBankSelected =
    bankCandidates.length > 0 && bankCandidates.every((q) => bankSel.has(q.id));
  const toggleSelectAllBank = () =>
    setBankSel(allBankSelected ? new Set() : new Set(bankCandidates.map((q) => q.id)));
  const promoteBank = async () => {
    if (selectedBankIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 '은행 적합' 문항 ${selectedBankIds.length}개를 전체학습 은행으로 보낼까요?\n(상식으로 풀려 시청 검증엔 부적합 — 연습 문제로 재활용. 고른 문항만 옮겨요)`,
      )
    )
      return;
    setPromoting(true);
    try {
      const res = await lectureApi.opsPromoteBankCandidates(lec.id, selectedBankIds);
      setBannerOk(res.placed > 0);
      const skips = Object.entries(res.skipped || {})
        .map(([k, n]) => `${k === 'multi_answer' ? '다답형' : k === 'image' ? '이미지' : k} ${n}개`)
        .join(', ');
      setBanner(
        `은행에 ${res.placed}개 배치했어요` +
          (skips ? ` (형식 미지원 건너뜀: ${skips})` : '') +
          (res.placed > 0 ? ' — 배치된 문항은 확인 문항 출제에서 빠집니다.' : '') +
          (res.placed > 0 && !res.runtime_visible ? ' 즉시 반영 실패(재기동 필요).' : ''),
      );
      setBankSel(new Set());
      load();
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, '일괄 승격에 실패했어요.'));
    } finally {
      setPromoting(false);
    }
  };

  const remove = async (q: OpsLectureQuestion) => {
    if (!window.confirm('이 문항을 삭제할까요?')) return;
    try {
      await lectureApi.opsQuestionDelete(lec.id, q.id);
      changedRef.current = true;
      load();
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  // 진행 중인 생성 잡을 done/error까지 폴링(2초 간격·최대 5분). 시작·재진입 모두 이걸 쓴다.
  const pollGenJob = async (jobId: string) => {
    genPollRef.current = true;
    try {
      for (let i = 0; i < 150 && genPollRef.current; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!genPollRef.current) return; // 창 닫힘 — 폴링만 멈춤(잡은 서버서 계속·job_id 남겨 재진입 시 이어봄)
        let job;
        try {
          job = await lectureApi.opsQuestionGenJob(lec.id, jobId);
        } catch {
          // 잡 조회 실패(삭제·만료 등) — 무한 로딩 방지: 자국 지우고 종료
          clearGenJob();
          setGenerating(false);
          return;
        }
        setGenPhase(job.phase); // 세부 단계 표시(자막 변환/문항 생성/검증)
        if (job.status === 'done') {
          changedRef.current = true;
          setBannerOk(true);
          // 전사 출처를 정직하게 앞에 밝힌다 — 강사 자막 / 소리 자동 변환 / 자막 없음(메타)
          const trNote = job.transcript_source
            ? job.transcript_source === 'stt'
              ? '소리 자동 변환 자막 기반'
              : '강사 제공 자막 기반'
            : '자막 없이 제목·설명 기반';
          if (job.self_verified) {
            const discardNote = job.discard_candidates
              ? ` · 불량 의심 ${job.discard_candidates}개(자막을 줘도 안 풀림 — 폐기 검토)`
              : '';
            setBanner(
              `${trNote}로 AI가 ${job.created}개 생성 → 확인 문항 적합 ${job.captcha_candidates}개(강의를 봐야 풀림)·` +
                `은행 적합 ${job.bank_candidates}개(상식으로 풀림)${discardNote}. 각 문항 배지를 보고 검수·배치하세요.`,
            );
          } else {
            setBanner(
              `${trNote}로 AI가 ${job.created}개 문항을 생성했어요(draft) — 검수 후 승인하세요.` +
                (job.verify_error ? ` (자기검증 미수행: ${job.verify_error})` : ''),
            );
          }
          clearGenJob();
          load();
          setGenerating(false);
          return;
        }
        if (job.status === 'error') {
          // 러너가 남긴 실패 원인을 그대로 노출(STT·생성 실패 등) — 조용한 실패 없음
          setBannerOk(false);
          setBanner(job.error || 'AI 문항 생성에 실패했어요.');
          clearGenJob();
          setGenerating(false);
          return;
        }
        // pending|running → 계속 폴링
      }
      if (genPollRef.current) {
        // 5분 초과 — 잡은 계속 돌 수 있으니 폴링만 멈추고 안내(job_id 남겨 재진입 시 이어봄)
        setBannerOk(true);
        setBanner('생성이 오래 걸리고 있어요 — 창을 닫아도 백그라운드에서 계속돼요. 완료되면 알림·이메일로 알려드리고, 이 창을 다시 열면 상태가 이어져요.');
        setGenerating(false);
      }
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, 'AI 문항 생성 상태 확인에 실패했어요.'));
      setGenerating(false);
    }
  };

  const generate = async () => {
    const n = Number(genN);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      setBannerOk(false);
      setBanner('생성 개수는 1~20 사이 정수예요.');
      return;
    }
    setGenerating(true);
    setGenPhase(null);
    setBanner('');
    genStartRef.current = Date.now();
    setGenElapsed(0);
    try {
      // 비동기: 서버가 잡을 만들고 즉시 반환. 키 미설정이면 바로 503 throw(성공 위장 없음).
      const started = await lectureApi.opsQuestionGenerate(lec.id, n);
      try {
        localStorage.setItem(GENJOB_KEY, JSON.stringify({ id: started.job_id, at: Date.now() }));
      } catch { /* 저장 실패해도 진행엔 지장 없음(재진입 이어보기만 안 됨) */ }
      await pollGenJob(started.job_id);
    } catch (e) {
      setBannerOk(false);
      setBanner(errorDetail(e, 'AI 문항 생성에 실패했어요.'));
      clearGenJob();
      setGenerating(false);
    }
  };

  // 재진입 이어보기 — 모달을 다시 열었을 때 이 강의에 진행 중인 생성 잡이 남아 있으면
  // '생성 중'을 이어 보여주고 폴링을 재개한다(나갔다 와도 진행 상태가 보이게 — 사용자 제보).
  useEffect(() => {
    let saved: { id: string; at: number } | null = null;
    try {
      const raw = localStorage.getItem(GENJOB_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }
    if (saved?.id) {
      setGenerating(true);
      setGenPhase(null);
      genStartRef.current = saved.at || Date.now();
      setBannerOk(true);
      setBanner('이 강의의 문항 생성이 진행 중이에요 — 완료되면 목록에 초안이 뜨고 알림이 와요.');
      void pollGenJob(saved.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lec.id]);

  /* 입력 중 실시간 환산·범위 안내용 — 저장 검증(save)과 같은 파서를 쓴다 */
  const posPreview = form ? parseSecInput(form.position_sec) : null;
  /* 공개(active) 문항 수 — 0이면 이 강의는 확인이 아예 안 떠서 시청 검증이 조용히 꺼진다 */
  const activeCount = (items ?? []).filter((q) => q.status === 'active').length;
  /* 캡처 모달의 첨부 대상 — 시점 선택 전용(position)이면 null(선택·첨부 UI 숨김) */
  const capTarget =
    capture && capture.slot !== 'position'
      ? { slot: capture.slot, optionIndex: capture.optionIndex }
      : null;

  return (
    <div className="op-bh-overlay" onClick={close}>
      <div
        className="op-formmodal op-lect-widemodal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qmodal-title"
      >
        <div className="op-bh-modal-h">
          <span id="qmodal-title">
            <i className="ph-fill ph-seal-question" /> 확인 문항 — {lec.title}
          </span>
          <button className="op-bh-modal-x" onClick={close}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        {/* 처음 보는 강사를 위한 한 줄 정의 — '확인 문항'이 무엇인지 여기서 바로 알려준다. */}
        <p className="op-lect-whatis">
          영상 시청 중간에 뜨는 질문이에요 — 학생이 그 대목을 실제로 보고 이해했는지 확인해요(못
          맞히면 그 대목을 다시 보고 재도전). 확인 문항이 없으면 시청 검증이 걸리지 않아요.
        </p>

        {/* 문항·자막 저작은 강사 전용 — 운영자는 문항 조회(검수)만(ops 권한 B) */}
        {isOps ? (
          <div className="op-lect-qtools">
            <span className="lu-help">
              <i className="ph-fill ph-shield-check" /> 운영자는 확인 문항을 검수(조회)만 해요 — 문항·자막 저작은 강사가 합니다.
            </span>
          </div>
        ) : (
          <>
            <div className="op-lect-qtools">
              <button className="op-btn op-btn--soft" onClick={() => { setErr(''); setShowAdvanced(false); setForm(emptyQ()); }}>
                <i className="ph-bold ph-plus" />
                문항 추가
              </button>
              <div className="op-lect-gen">
                <label className="op-lect-gen-lb">
                  문항
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={genN}
                    onChange={(e) => setGenN(e.target.value)}
                    className="op-lect-gen-n"
                    aria-label="AI로 만들 문항 개수 (1~20)"
                  />
                  개
                </label>
                <button
                  className="op-btn op-btn--approve"
                  disabled={generating}
                  onClick={generate}
                  title="자막(없으면 강의 소리를 자막으로 자동 변환)을 바탕으로 확인 문항 초안을 AI가 만들어요"
                >
                  <i className="ph-bold ph-sparkle" />
                  {generating ? '생성 중…' : 'AI 문항 생성'}
                </button>
              </div>
              {bankCandidates.length > 0 && (
                <div className="op-lect-bankbulk">
                  <span className="op-lect-bankbulk-lb" title="봇이 상식으로 풀어 확인 문항엔 부적합 — 아래 체크로 골라 전체학습 은행으로 보내세요(선택=검토)">
                    <i className="ph-bold ph-brain" /> 은행 적합 {bankCandidates.length}개
                  </span>
                  <button className="op-btn op-btn--soft" onClick={toggleSelectAllBank}>
                    {allBankSelected ? '선택 해제' : '전체 선택'}
                  </button>
                  <button
                    className="op-btn op-btn--soft"
                    disabled={promoting || selectedBankIds.length === 0}
                    onClick={promoteBank}
                    title="체크한 '은행 적합' 문항을 전체학습 은행으로. 고른 문항만 옮겨요(선택이 곧 검토). 형식은 서버가 변환·미지원은 건너뜀."
                  >
                    <i className="ph-bold ph-tray-arrow-up" />
                    {promoting ? '보내는 중…' : `선택 ${selectedBankIds.length}개 은행으로`}
                  </button>
                </div>
              )}
            </div>
            {/* 사용 시점 안내 — 왼쪽 숫자(개수)와 'AI 문항 생성'이 무엇을 하는지 강사에게 명시.
                온보딩 모달에도 있지만, 실제 누르는 자리에서 한 번 더 알려줘야 처음 강사도 헤매지 않는다. */}
            <p className="op-lect-genhint">
              <i className="ph-bold ph-info" />
              <span>
                정한 <b>문항 수</b>만큼 AI가 <b>확인 문항 초안</b>을 만들어요 — 강의 소리를 자막으로
                자동 변환해 그 내용으로(강사 자막을 올리면 더 정확해요). 만든 문항은 <b>검수 후
                ‘공개’</b>해야 학생에게 출제돼요. (운영 콘솔 설정의 생성 모델 사용)
              </span>
            </p>
            {/* 생성 중 안내 — 백그라운드(비동기)라 강사가 기다리지 않아도 된다. 실시간 %는 없지만
                지금 무슨 단계인지(자막 변환/문항 생성/검증)를 보여줘 '멈춘 것처럼' 보이지 않게 한다. */}
            {generating && (
              <p className="op-lect-genwait">
                <i className="ph-bold ph-spinner-gap" />
                {genPhase === 'transcribing'
                  ? '① 강의 소리를 자막으로 변환하는 중… (가장 오래 걸려요)'
                  : genPhase === 'generating'
                    ? '② 자막을 읽고 문항을 만드는 중…'
                    : genPhase === 'verifying'
                      ? '③ 봇 저항(자기검증)을 확인하는 중…'
                      : 'AI가 문항을 만드는 중이에요 — 긴 영상은 몇 분 걸릴 수 있어요.'}
                {' '}
                <b className="op-lect-genelapsed">
                  경과 {Math.floor(genElapsed / 60)}:{String(genElapsed % 60).padStart(2, '0')}
                </b>
                <br />
                창을 닫아도 백그라운드에서 계속돼요 — 끝나면 목록에 초안이 뜨고, <b>알림·이메일</b>로도
                알려드려요. (이 창을 다시 열면 진행 상태가 이어져요.)
              </p>
            )}
            {/* 강사 제공 자막 — 있으면 위 'AI 문항 생성'이 자동 STT 대신 이 자막을 쓴다 */}
            <TranscriptBar lectureId={lec.id} note={(ok, msg) => { setBannerOk(ok); setBanner(msg); }} />
          </>
        )}
        {banner && (
          <div className={`op-lect-banner ${bannerOk ? 'op-lect-banner-ok' : 'op-form-err'}`}>
            <i className={bannerOk ? 'ph-fill ph-check-circle' : 'ph-fill ph-info'} /> {banner}
          </div>
        )}
        {loadErr && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning-circle" /> {loadErr}
          </div>
        )}
        {/* 활성 문항 0개 = 확인 문항이 아예 안 떠서 시청 검증이 조용히 꺼진다 — 모달 안에서도 경고 */}
        {items !== null && !loadErr && activeCount === 0 && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning" /> 공개(active) 문항이 없어 이 강의는 시청 검증이
            동작하지 않아요 — 학생이 확인 없이 끝까지 볼 수 있어요. 문항을 추가하거나 draft 문항을
            승인하세요.
          </div>
        )}
        {form && (
          <div className="op-lect-qform">
            <div className="op-form-grid">
              {/* 출제 시점 — 모든 문항이 이 시점 정각의 고정 핀. "방금 본 내용"을 그 대목
                  직후에 묻는다(오답 3회면 이 시점 기준으로 그 대목을 다시 보게 되감는다).
                  구간(무작위 초) 모드는 제거 — 되감기 기준과 내용 시점이 어긋난다. */}
              <label className="ox-field">
                출제 시점
                {form.positionSuggested && (
                  <span className="lu-aisug lu-aisug--inline" title="AI가 자막 기준으로 제안한 시점이에요 — 영상에서 확인하세요. 시점을 바꾸거나 저장하면 확정됩니다.">
                    <i className="ph-bold ph-sparkle" /> AI 제안 · 확인하세요
                  </span>
                )}
                <span
                  className={`lu-help${
                    posPreview != null &&
                    form.status === 'active' &&
                    (posPreview >= lec.duration_sec || posPreview < 1)
                      ? ' lu-help--bad'
                      : ''
                  }`}
                >
                  {posPreview == null
                    ? '초(예: 200) 또는 분:초(예: 3:20)로 입력하세요'
                    : form.status === 'active' && posPreview >= lec.duration_sec
                      ? `영상 길이(${fmtMMSS(lec.duration_sec)})를 벗어났어요 — 영상 안의 시점으로 지정하세요`
                      : form.status === 'active' && posPreview < 1
                        ? '공개 문항은 1초 이상이어야 해요 — 0초는 아직 아무것도 보지 않은 지점이에요'
                        : `${fmtMMSS(posPreview)}에 반드시 출제 · 영상 길이 ${fmtMMSS(lec.duration_sec)}`}
                </span>
                <input
                  value={form.position_sec}
                  onChange={(e) => setForm({ ...form, position_sec: e.target.value, positionSuggested: false })}
                  placeholder="예: 3:20 또는 200"
                />
                <button
                  type="button"
                  className="lu-capbtn"
                  onClick={() => setCapture({ slot: 'position' })}
                >
                  <i className="ph-bold ph-monitor-play" /> 영상 보면서 시점 고르기
                </button>
              </label>
              {/* 고급 설정 토글 — '되감기 지점'은 대개 자동(출제 시점 30초 전)이라 기본 접어
                  폼을 단순하게 한다(초심자 부담↓). 기존 값이 있으면 openEdit에서 자동 펼침. */}
              <div className="ox-field op-form-span2 op-lect-advrow">
                <button
                  type="button"
                  className="op-lect-advtoggle"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                >
                  <i className={`ph-bold ${showAdvanced ? 'ph-caret-up' : 'ph-caret-down'}`} />
                  고급: 되감기 지점 {showAdvanced ? '접기' : '설정 (선택)'}
                </button>
                <span className="op-lect-advhint">비우면 오답 3회 시 출제 시점 30초 전으로 자동 되감아요</span>
              </div>
              {/* 되감기 지점 — 오답 3회 시 학생이 여기부터 다시 본다. 대목 길이는 문항마다
                  달라(풀이 2~3분 vs 단어 10초) 상수가 아니라 강사가 아는 사실을 기록한다. */}
              {showAdvanced && (
              <label className="ox-field op-form-span2">
                내용 시작 (되감기 지점)
                <span
                  className={`lu-help${
                    (() => {
                      const cs = form.content_start_sec.trim() === '' ? null : parseSecInput(form.content_start_sec);
                      const p = posPreview;
                      return cs != null && p != null && cs >= p;
                    })()
                      ? ' lu-help--bad'
                      : ''
                  }`}
                >
                  {(() => {
                    if (form.content_start_sec.trim() === '')
                      return '비우면 출제 시점 30초 전으로 되감아요 — 이 문항의 설명이 시작되는 시점을 지정하면 더 정확해요';
                    const cs = parseSecInput(form.content_start_sec);
                    if (cs == null) return '초(예: 170) 또는 분:초(예: 2:50)로 입력하세요';
                    if (posPreview != null && cs >= posPreview)
                      return '출제 시점보다 앞이어야 해요 — 내용이 시작되는 시점을 지정하세요';
                    return `오답 3회면 ${fmtMMSS(cs)}부터 다시 보게 돼요`;
                  })()}
                </span>
                <input
                  value={form.content_start_sec}
                  onChange={(e) => setForm({ ...form, content_start_sec: e.target.value })}
                  placeholder="예: 2:50 (비우면 자동)"
                />
                <button
                  type="button"
                  className="lu-capbtn"
                  onClick={() => setCapture({ slot: 'position' })}
                >
                  <i className="ph-bold ph-monitor-play" /> 영상 보면서 시점 고르기
                </button>
              </label>
              )}
              <label className="ox-field">
                상태
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">공개(active)</option>
                  <option value="draft">검수 대기(draft)</option>
                </select>
              </label>
              <label className="ox-field op-form-span2">
                문제
                <input value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="예: 방금 화면에 나온 도형은 무엇이었나요?" />
              </label>

              {/* 문제 이미지 — 강의 화면 캡처를 붙이면 '실제로 본 사람만' 맞힐 수 있는 문제가 된다 */}
              <div className="ox-field op-form-span2">
                문제 이미지 (선택)
                <span className="lu-help">
                  강의 화면을 캡처해 붙이면 &ldquo;방금 화면에 나온 것&rdquo;을 물을 수 있어요 — 강의를 본
                  학생만 맞힐 수 있어요.
                </span>
                {!form.id ? (
                  <div className="lu-imgdrop lu-imgdrop--off">
                    <i className="ph-fill ph-image" />
                    <span>문항을 먼저 저장하면 이미지를 붙일 수 있어요</span>
                  </div>
                ) : form.promptImageUrl ? (
                  <div className="lu-imgthumb">
                    <img src={API_ORIGIN + form.promptImageUrl} alt="문제 이미지" />
                    <div className="lu-imgthumb-actions">
                      <button
                        type="button"
                        className="op-btn op-btn--reject"
                        disabled={imgBusy != null}
                        onClick={() => pickImage('prompt')}
                      >
                        <i className="ph-bold ph-arrows-clockwise" />
                        {imgBusy === 'prompt' ? `올리는 중… ${imgProgress ?? 0}%` : '교체'}
                      </button>
                      <button
                        type="button"
                        className="op-btn op-btn--reject op-lect-danger"
                        disabled={imgBusy != null}
                        onClick={() => removeImage('prompt', undefined, 'prompt')}
                      >
                        <i className="ph-bold ph-trash" />
                        삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`lu-imgdrop${imgDragOver ? ' lu-imgdrop--over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setImgDragOver(true); }}
                    onDragLeave={() => setImgDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImgDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) attachImage('prompt', undefined, f, 'prompt');
                    }}
                    onClick={() => imgBusy == null && pickImage('prompt')}
                  >
                    <i className="ph-fill ph-image" />
                    <span>
                      {imgBusy === 'prompt'
                        ? `올리는 중… ${imgProgress ?? 0}%`
                        : '이미지를 끌어다 놓거나 클릭해서 첨부 — PNG·JPG·GIF·WebP, 최대 5MB'}
                    </span>
                  </div>
                )}
                {/* 파일 대신 강의 영상에서 직접 따오기 — 실제 화면 조각은 그 강의를 본
                    사람만 고를 수 있다(텍스트 보기는 상식으로 찍힌다). 이미 이미지가 있으면 교체. */}
                {form.id && (
                  <button
                    type="button"
                    className="lu-capbtn"
                    disabled={imgBusy != null}
                    onClick={() => setCapture({ slot: 'prompt' })}
                  >
                    <i className="ph-bold ph-crop" /> 강의 화면에서 따오기
                  </button>
                )}
              </div>

              {/* 보기 — 행마다 정답 라디오·텍스트·이미지 버튼. 이미지가 있으면 텍스트를 비워도
                  된다(그림 전용 보기 — 텍스트 라벨이 정답을 알려주는 걸 막는다). */}
              <div className="ox-field op-form-span2">
                보기 (2~6개)
                <span className="lu-help">
                  {form.id
                    ? '보기마다 이미지를 붙일 수 있어요. 이미지가 있는 보기는 텍스트를 지워도 돼요 — 그림만으로 낼 수 있어요.'
                    : '보기 이미지는 문항을 먼저 저장한 뒤 붙일 수 있어요.'}
                </span>
                <span className="lu-help">
                  정답을 여러 개 고를 수 있어요 — 학생은 고른 보기를 전부 담아야 정답이에요(부분 정답 없음).
                </span>
                <div className="lu-optlist">
                  {form.options.map((opt, i) => (
                    <div key={i} className={`lu-optrow${form.answer_indexes.includes(i) ? ' lu-optrow--ans' : ''}`}>
                      <label className="lu-optans" title="이 보기를 정답으로 지정 — 여러 개 지정 가능">
                        <input
                          type="checkbox"
                          checked={form.answer_indexes.includes(i)}
                          onChange={() =>
                            setForm({
                              ...form,
                              answer_indexes: form.answer_indexes.includes(i)
                                ? form.answer_indexes.filter((a) => a !== i)
                                : [...form.answer_indexes, i],
                            })
                          }
                        />
                        정답
                      </label>
                      <input
                        className="lu-optinput"
                        value={opt}
                        onChange={(e) =>
                          setForm({ ...form, options: form.options.map((o, j) => (j === i ? e.target.value : o)) })
                        }
                        placeholder={form.optionImageUrls[i] ? '(그림 보기 — 텍스트 없이 낼 수 있어요)' : `${i + 1}번 보기`}
                      />
                      {form.id && i < form.alignedUpTo ? (
                        form.optionImageUrls[i] ? (
                          <span className="lu-optimg">
                            <img src={API_ORIGIN + form.optionImageUrls[i]} alt={`${i + 1}번 보기 이미지`} />
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="이미지 교체"
                              disabled={imgBusy != null}
                              onClick={() => pickImage('option', i)}
                            >
                              <i className="ph-bold ph-arrows-clockwise" />
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="강의 화면에서 따와 교체"
                              disabled={imgBusy != null}
                              onClick={() => setCapture({ slot: 'option', optionIndex: i })}
                            >
                              <i className="ph-bold ph-crop" />
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn lu-imgbtn--danger"
                              title="이미지 삭제"
                              disabled={imgBusy != null}
                              onClick={() => removeImage('option', i, `opt-${i}`)}
                            >
                              <i className="ph-bold ph-trash" />
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="이 보기에 이미지 첨부"
                              disabled={imgBusy != null}
                              onClick={() => pickImage('option', i)}
                            >
                              {imgBusy === `opt-${i}` ? (
                                <span className="lu-imgbtn-busy">{imgProgress ?? 0}%</span>
                              ) : (
                                <i className="ph-bold ph-image" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="lu-imgbtn"
                              title="강의 화면에서 따오기"
                              disabled={imgBusy != null}
                              onClick={() => setCapture({ slot: 'option', optionIndex: i })}
                            >
                              <i className="ph-bold ph-crop" />
                            </button>
                          </>
                        )
                      ) : form.id ? (
                        <span className="lu-optimg-note">저장 후 이미지 첨부</span>
                      ) : null}
                      <button
                        type="button"
                        className="lu-imgbtn lu-imgbtn--danger"
                        title="이 보기 삭제"
                        /* 업로드 in-flight 중 행 삭제 금지 — 삭제로 행이 당겨진 뒤 업로드가
                           완료되면 이미지가 엉뚱한 보기에 붙는다(alignedUpTo 가드를 우회하는 레이스) */
                        disabled={imgBusy != null}
                        onClick={() => removeOption(i)}
                      >
                        <i className="ph-bold ph-x" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="lu-optadd" onClick={addOption} disabled={form.options.length >= 6}>
                  <i className="ph-bold ph-plus" /> 보기 추가
                </button>
              </div>

              <label className="ox-field op-form-span2">
                해설
                <span className="lu-help">
                  해설은 학생에게 표시되지 않아요(운영자 기록용) — 학생 게이트는 검증이라 정답·해설을 내려보내지 않아요.
                </span>
                <input value={form.explain} onChange={(e) => setForm({ ...form, explain: e.target.value })} />
              </label>
            </div>
            {/* 이미지 파일 선택 — 문제/보기 공용(imgTargetRef가 붙을 자리를 기억) */}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => {
                const t = imgTargetRef.current;
                const f = e.target.files?.[0];
                e.target.value = ''; // 같은 파일 재선택도 change가 뜨게 초기화
                if (t && f) attachImage(t.slot, t.optionIndex, f, t.key);
              }}
            />
            {err && (
              <div className="op-form-err">
                <i className="ph-fill ph-warning-circle" /> {err}
              </div>
            )}
            <div className="op-form-actions">
              <button
                className="op-btn op-btn--reject"
                disabled={saving || imgBusy != null}
                onClick={() => setForm(null)}
              >
                {form.id ? '닫기' : '취소'}
              </button>
              <button className="op-btn op-btn--approve" disabled={saving || imgBusy != null} onClick={save}>
                <i className="ph-bold ph-check" />
                {saving ? '저장 중…' : form.id ? '문항 저장' : '문항 저장 후 이미지 첨부'}
              </button>
            </div>
          </div>
        )}

        {/* 검토 가이드 — 강사가 '무엇을·어디로' 하는지 한눈에(실무 리뷰 UI: 자동판정→권장행동).
            접이식이라 익숙해지면 접어둘 수 있다. */}
        {!isOps && items !== null && items.length > 0 && (
          <details
            className="op-lect-guide2"
            open={guideOpen}
            onToggle={(e) => {
              const open = (e.currentTarget as HTMLDetailsElement).open;
              setGuideOpen(open);
              try { localStorage.setItem('catchap_qguide_collapsed', open ? '0' : '1'); } catch { /* localStorage 불가 무시 */ }
            }}
          >
            <summary>
              <i className="ph-fill ph-question" /> 이 화면 사용법 — 문항을 어떻게 처리하나요?
            </summary>
            <div className="op-lect-guide2-body">
              <p>
                AI가 만든 문항은 <b>‘검수 대기’</b> 상태예요(아직 학생에게 안 떠요). 각 문항의 AI
                판정 배지를 보고 아래 중 하나를 하세요:
              </p>
              <ul>
                <li>
                  <span className="op-sys-status op-sys-status--ok"><i className="ph-bold ph-shield-check" /> 확인 문항 적합</span>
                  <b>‘공개하기’</b> → 학생 강의에 출제되는 <b>시청 검증 문항(확인 문항)</b>이 돼요. 강의를 봐야 풀려요.
                </li>
                <li>
                  <span className="op-sys-status op-sys-status--warn"><i className="ph-bold ph-brain" /> 은행 적합</span>
                  <b>‘문제 은행으로’</b> → 봇도 상식으로 푸니 시청 검증엔 부적합. 전체학습 문제 은행으로 보내요.
                </li>
                <li>
                  <span className="op-sys-status op-sys-status--no"><i className="ph-bold ph-warning" /> 불량 의심</span>
                  <b>‘수정’ 또는 ‘삭제’</b> → 자막을 줘도 AI가 못 푼 문항(정답 오류·모호 의심)이에요.
                </li>
              </ul>
              <p className="op-lect-guide2-foot">
                <i className="ph-bold ph-lightbulb" /> 정리하면 — <b>공개하기 = 확인 문항로 출제</b>,
                <b> 문제 은행으로 = 별도 학습 문제로 보관</b>. 두 곳은 서로 다른 목적지라, 은행으로
                보낸 문항은 확인 문항로 승인할 필요가 없어요.
              </p>
            </div>
          </details>
        )}

        <div className="op-lect-qlist">
          {items === null && <div className="op-logrow">불러오는 중…</div>}
          {items !== null && items.length === 0 && !loadErr && (
            <div className="op-logrow">등록된 문항이 없어요.</div>
          )}
          {(items ?? []).map((q) => (
            <div key={q.id} className="op-lect-qrow">
              <div className="op-lect-qmeta">
                {/* 은행 적합 문항 다중 선택 체크 — 체크한 것만 '선택 N개 은행으로'로 보낸다(선택=검토) */}
                {q.suggested_placement === 'bank' && !q.bank_placed && q.status === 'draft' && (
                  <label className="op-lect-qcheck" title="은행으로 보낼 문항 선택">
                    <input
                      type="checkbox"
                      checked={bankSel.has(q.id)}
                      onChange={() => toggleBankSel(q.id)}
                    />
                  </label>
                )}
                {/* 고정 핀 = 그 시점 정각에 출제. draft 0초 = 시점 미배치 */}
                {q.status === 'draft' && q.position_sec < 1 ? (
                  <span className="op-mono" title="아직 출제 시점이 없어요 — 수정에서 시점을 지정한 뒤 승인하세요">
                    시점 미배치
                  </span>
                ) : (
                  <span className="op-mono lu-pinbadge" title="이 시점에 닿는 순간 반드시 출제돼요">
                    <i className="ph-fill ph-push-pin" /> {fmtMMSS(q.position_sec)} 고정
                  </span>
                )}
                {/* AI가 제안한 시점(강사 미확정) — 수정/승인하면 사라진다. 확인을 유도하는 표식 */}
                {q.position_suggested && (
                  <span
                    className="op-sys-status op-sys-status--warn lu-aisug"
                    title="AI가 자막 기준으로 제안한 출제 시점이에요 — 영상에서 확인하고 수정/승인하면 확정됩니다."
                  >
                    <i className="ph-bold ph-sparkle" /> AI 제안 시점
                  </span>
                )}
                {q.content_start_sec != null && (
                  <span
                    className="op-mono"
                    title="오답 3회면 학생이 이 시점부터 다시 봐요(되감기 지점 — 이 문항이 다루는 내용의 시작)"
                  >
                    <i className="ph-bold ph-rewind" /> {fmtMMSS(q.content_start_sec)}부터 다시
                  </span>
                )}
                {/* 상태 배지 — 문제 은행으로 보낸 문항은 '검수 대기'가 아니라 '문제 은행'으로 표시한다
                    (은행으로 처리 완료된 것을 계속 '검수 대기'로 보여줘 혼란을 준다는 제보 반영). */}
                {q.bank_placed ? (
                  <span
                    className="op-sys-status op-sys-status--neutral"
                    title="문제 은행으로 보냈어요 — 확인 문항 검수 대상이 아니에요"
                  >
                    문제 은행
                  </span>
                ) : (
                  <span
                    className={`op-sys-status op-sys-status--${q.status === 'active' ? 'ok' : 'warn'}`}
                    title={q.status === 'active' ? '학생 강의에 출제되는 중이에요' : '아직 학생에게 안 떠요 — 공개해야 출제돼요'}
                  >
                    {q.status === 'active' ? '공개 중' : '검수 대기'}
                  </span>
                )}
                <span className="op-sys-status op-sys-status--neutral">{q.source === 'llm' ? 'AI 생성' : '직접 작성'}</span>
                {/* 자기검증(2번째 LLM) 배지 — 봇 저항성 판정으로 배치를 돕는다(3분류).
                    판정 근거는 suggested_placement. 왜 3분류인지는 배지 title에 요약. */}
                {q.suggested_placement === 'captcha' && (
                  <span
                    className="op-sys-status op-sys-status--ok"
                    title="블라인드 AI(봇)는 못 풀고 자막을 주면 풀리는 문제 — 강의를 봐야 답할 수 있어요. 강의 확인 문항에 이상적입니다."
                  >
                    <i className="ph-bold ph-shield-check" /> 확인 문항 적합
                  </span>
                )}
                {q.suggested_placement === 'bank' && (
                  <span
                    className="op-sys-status op-sys-status--warn"
                    title="블라인드 AI(봇)도 상식으로 푼 문제 — 확인 문항엔 부적합(봇이 그냥 통과). 전체학습 문제 은행에 어울려요."
                  >
                    <i className="ph-bold ph-brain" /> 은행 적합
                  </span>
                )}
                {q.suggested_placement === 'discard' && (
                  <span
                    className="op-sys-status op-sys-status--no"
                    title="자막을 줘도 AI가 못 푼 문제 — 문항 자체가 모호하거나 정답이 틀렸을 수 있어요(환각 의심). 폐기하거나 직접 고쳐 주세요."
                  >
                    <i className="ph-bold ph-warning" /> 불량 의심
                  </span>
                )}
              </div>
              <div className="op-lect-qbody">
                <b>{q.prompt}</b>
                {q.prompt_image_url && (
                  <img
                    className="lu-qthumb"
                    src={API_ORIGIN + q.prompt_image_url}
                    alt="문제 이미지"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="op-lect-qopts">
                  {q.options.map((o, i) => (
                    <span
                      key={i}
                      className={`op-lect-qopt${(q.answer_indexes ?? [q.answer_index]).includes(i) ? ' op-lect-qopt-ans' : ''}`}
                    >
                      {i}.{' '}
                      {q.option_image_urls?.[i] && (
                        <img
                          className="lu-optchip-img"
                          src={API_ORIGIN + q.option_image_urls[i]!}
                          alt={`${i + 1}번 보기 이미지`}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      {o || (q.option_image_urls?.[i] ? '(그림 보기)' : '')}
                    </span>
                  ))}
                </div>
                {q.explain && <small className="op-aimodel-desc">해설: {q.explain}</small>}
                {/* 권장 행동 — AI 판정(suggested_placement)을 강사가 바로 할 일로 번역(쉬운 말).
                    이미 공개/은행배치된 건 안내를 생략(할 일 없음). */}
                {!isOps && q.status !== 'active' && !q.bank_placed && (
                  q.suggested_placement === 'captcha' ? (
                    <div className="op-lect-rec op-lect-rec--ok">
                      <i className="ph-fill ph-shield-check" />
                      <span><b>시청 검증에 적합해요.</b> ‘공개하기’를 누르면 강의 {fmtMMSS(q.position_sec)} 지점에서 이 문항이 출제돼요(강의를 봐야 답할 수 있어요).</span>
                    </div>
                  ) : q.suggested_placement === 'bank' ? (
                    <div className="op-lect-rec op-lect-rec--warn">
                      <i className="ph-fill ph-brain" />
                      <span><b>봇도 상식으로 풀어요</b> — 시청 검증엔 부적합해요(안 보고도 통과). ‘문제 은행으로’ 보내 전체학습에 쓰세요.</span>
                    </div>
                  ) : q.suggested_placement === 'discard' ? (
                    <div className="op-lect-rec op-lect-rec--no">
                      <i className="ph-fill ph-warning" />
                      <span><b>불량 의심.</b> 자막을 줘도 AI가 못 풀었어요(정답 오류·모호 의심). ‘수정’으로 고치거나 ‘삭제’하세요.</span>
                    </div>
                  ) : (
                    <div className="op-lect-rec op-lect-rec--neutral">
                      <i className="ph-fill ph-info" />
                      <span>검토한 뒤 <b>공개</b>(강의에 출제)하거나 <b>문제 은행</b>으로 보내세요.</span>
                    </div>
                  )
                )}
              </div>
              {!isOps && (
              <div className="op-lect-actions">
                {/* 공개하기(확인 문항으로 출제)는 아직 어디로도 안 보낸 검수 대기 문항에만.
                    문제 은행으로 보낸 문항은 '한 문항=한 목적지' 원칙상 공개하기를 숨긴다
                    (은행 문항은 봇이 상식으로 풀어 확인 문항엔 부적합 — 둘 다 보내지는 것 방지). */}
                {q.status === 'draft' && !q.bank_placed && (
                  <button
                    className="op-btn op-btn--approve"
                    onClick={() => approve(q)}
                    title="이 문항을 학생 강의에 출제해요(공개=확인 문항으로 확정). 되돌리려면 수정에서 '검수 대기'로 바꾸면 돼요."
                  >
                    <i className="ph-bold ph-check-circle" /> 공개하기
                  </button>
                )}
                {/* 목적지 상태 표시(3분기, 서로 배타 — '한 문항=한 목적지'):
                    ① 은행 배치됨 → '🏦 은행 배치됨' 배지
                    ② 검수 대기(draft) → '문제 은행으로' 버튼(AI 판정 무관 — 강사가 직접 고르게.
                       백엔드 to-bank는 suggested_placement를 안 따지고 다답형·이미지·중복만
                       거른다. 캡차 부적합 문항이 일반 은행에 가면 학생 전체학습에서 강의 맥락
                       없이 나오므로 toBank confirm이 경고). 공개하기 버튼과 나란히.
                    ③ 공개 중(active) → '공개 중' 배지(은행 배치됨과 대칭으로 상태를 명시). */}
                {q.bank_placed ? (
                  <span className="op-sys-status op-sys-status--neutral" title={`전체학습 은행에 배치됨 (${q.bank_placed.bank_id})`}>
                    <i className="ph-bold ph-bank" /> 은행 배치됨
                  </span>
                ) : q.status === 'draft' ? (
                  <button
                    className="op-btn op-btn--soft"
                    title="이 문항을 전체학습 문제 은행으로 보냅니다(확인 문항 대신 일반 학습 문제로 보관). 형식은 서버가 변환해요."
                    onClick={() => toBank(q)}
                  >
                    <i className="ph-bold ph-brain" /> 문제 은행으로
                  </button>
                ) : (
                  <span className="op-sys-status op-sys-status--ok" title="학생 강의에 확인 문항으로 출제되는 중이에요">
                    <i className="ph-bold ph-check-circle" /> 공개 중
                  </span>
                )}
                <button className="op-btn op-btn--soft" onClick={() => openEdit(q)}>
                  수정
                </button>
                <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(q)}>
                  삭제
                </button>
              </div>
              )}
            </div>
          ))}
        </div>

        {capture && (
          <FrameCaptureModal
            lec={lec}
            attachTarget={capTarget}
            onAttach={
              capTarget
                ? (file: File) =>
                    attachImage(
                      capTarget.slot,
                      capTarget.optionIndex,
                      file,
                      capTarget.slot === 'prompt' ? 'prompt' : `opt-${capTarget.optionIndex}`,
                    )
                : null
            }
            onAttached={() => {
              setCapture(null);
              setBannerOk(true);
              setBanner('강의 화면에서 따온 이미지를 첨부했어요 — 서버 저장까지 확인됐어요.');
            }}
            onUsePosition={(sec) => setForm((f) => (f ? { ...f, position_sec: fmtMMSS(sec), positionSuggested: false } : f))}
            onUseContentStart={(sec) =>
              setForm((f) => (f ? { ...f, content_start_sec: fmtMMSS(sec) } : f))
            }
            onClose={() => setCapture(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ================= 강의 화면 따오기 모달 ================= */
/** 운영자 미리보기 스트림을 재생하며 ① 현재 시점을 출제 시점으로 가져오고
 *  ② 화면 위를 드래그해 그 영역을 잘라 문항 이미지로 첨부한다.
 *
 *  왜 화면을 따오나: 텍스트 보기("삼각형/사각형")는 강의를 안 본 사람도 상식으로 찍지만,
 *  실제 강의 화면 조각은 그 강의를 본 사람만 고를 수 있다 — 시청 검증의 가장 강한 무기.
 *
 *  크롭은 브라우저 canvas로 한다(ffmpeg 불필요). 좌표 변환: 드래그 사각형은 표시 크기
 *  (CSS px) 기준이고 원본 프레임(videoWidth/Height)은 보통 더 크므로 축마다 스케일을
 *  곱해 원본 좌표로 옮긴다. 영상을 width 고정·height auto로 그려 표시 상자가 원본
 *  비율과 정확히 일치한다(레터박스 없음 → 선형 변환만으로 충분).
 *
 *  canvas 오염(taint): 서버 CORS 헤더가 기대대로 안 붙으면 toBlob이 SecurityError를
 *  던진다 — 성공 위장 없이 "보안 정책으로 따올 수 없다"고 정직하게 실패 처리한다. */
function FrameCaptureModal({
  lec,
  attachTarget,
  onAttach,
  onAttached,
  onUsePosition,
  onUseContentStart,
  onClose,
}: {
  lec: OpsLecture;
  /** null = 시점 선택 전용(문항 저장 전) — 영역 선택·첨부 UI를 숨긴다 */
  attachTarget: { slot: 'prompt' | 'option'; optionIndex?: number } | null;
  /** 첨부 실행 — null 반환 = 서버 재조회까지 확인된 성공, string = 실패 사유 */
  onAttach: ((file: File) => Promise<string | null>) | null;
  onAttached: () => void;
  onUsePosition: (sec: number) => void;
  /** 되감기 지점(내용 시작) 입력에 현재 시점 채우기 — 시점 두 개를 한 재생 흐름에서 고른다 */
  onUseContentStart: (sec: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMsg, setLoadMsg] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [selecting, setSelecting] = useState(false);
  /** 드래그 사각형 — 오버레이(=영상 표시 상자) 기준 CSS px */
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [capErr, setCapErr] = useState('');
  const [note, setNote] = useState('');

  const loadPreview = () => {
    setPhase('loading');
    setLoadMsg('');
    lectureApi
      .opsPreview(lec.id)
      .then((d) => {
        setStreamUrl(d.stream_url);
        setPhase('ready');
      })
      .catch((e) => {
        setLoadMsg(errorDetail(e, '미리보기 스트림을 발급받지 못했어요.'));
        setPhase('error');
      });
  };
  useEffect(loadPreview, [lec.id]);

  /* ---- 드래그 영역 선택 (pointer capture — 마우스가 빠르게 움직여도 놓치지 않는다) ---- */
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - box.left, y: e.clientY - box.top };
    dragRef.current = p;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s) return;
    const box = e.currentTarget.getBoundingClientRect();
    const cx = Math.min(Math.max(e.clientX - box.left, 0), box.width);
    const cy = Math.min(Math.max(e.clientY - box.top, 0), box.height);
    setSel({ x: Math.min(s.x, cx), y: Math.min(s.y, cy), w: Math.abs(cx - s.x), h: Math.abs(cy - s.y) });
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // 클릭 수준의 미세 사각형은 의도가 아니다 — 버린다
    setSel((r) => (r && r.w >= 8 && r.h >= 8 ? r : null));
  };

  const beginSelect = () => {
    videoRef.current?.pause(); // 프레임이 흐르면 지정한 영역과 따온 화면이 어긋난다
    setSelecting(true);
    setSel(null);
    setCapErr('');
    setNote('');
  };

  const usePosition = () => {
    const v = videoRef.current;
    if (!v) return;
    const sec = Math.floor(v.currentTime);
    onUsePosition(sec);
    setNote(`출제 시점 입력에 ${fmtMMSS(sec)}을 채웠어요 — 모달을 닫으면 폼에서 확인할 수 있어요.`);
  };

  const useContentStart = () => {
    const v = videoRef.current;
    if (!v) return;
    const sec = Math.floor(v.currentTime);
    onUseContentStart(sec);
    setNote(
      `내용 시작(되감기 지점) 입력에 ${fmtMMSS(sec)}을 채웠어요 — 오답 3회면 학생이 여기부터 다시 봐요.`,
    );
  };

  /* ---- 선택 영역을 원본 프레임 좌표로 변환 → canvas 크롭 → 첨부 ---- */
  const attachSelection = async () => {
    const v = videoRef.current;
    if (!v || !sel || !onAttach || busy) return;
    setCapErr('');
    setNote('');
    if (!v.videoWidth || !v.videoHeight) {
      setCapErr('영상 프레임을 아직 읽지 못했어요 — 잠시 재생한 뒤 다시 시도하세요.');
      return;
    }
    /* 표시 크기(CSS px) → 원본 프레임 좌표. 축마다 독립 스케일 — 표시 상자가 원본
       비율과 일치하면 두 값이 같고, 혹시 달라도 축별 선형 변환이라 결과는 여전히 정확하다. */
    const scaleX = v.videoWidth / v.clientWidth;
    const scaleY = v.videoHeight / v.clientHeight;
    let sx = Math.round(sel.x * scaleX);
    let sy = Math.round(sel.y * scaleY);
    let sw = Math.round(sel.w * scaleX);
    let sh = Math.round(sel.h * scaleY);
    // 반올림·경계 드래그로 프레임을 벗어나지 않게 클램프
    sx = Math.min(Math.max(sx, 0), v.videoWidth - 1);
    sy = Math.min(Math.max(sy, 0), v.videoHeight - 1);
    sw = Math.min(Math.max(sw, 1), v.videoWidth - sx);
    sh = Math.min(Math.max(sh, 1), v.videoHeight - sy);
    // 첨부 API 5MB 상한 대비 — 긴 변 1280px로 제한(문항 이미지 용도로 충분)
    const outScale = Math.min(1, 1280 / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * outScale));
    const dh = Math.max(1, Math.round(sh * outScale));
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCapErr('이 브라우저에서 캔버스를 사용할 수 없어 화면을 따올 수 없어요.');
      return;
    }
    let blob: Blob | null = null;
    try {
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, dw, dh);
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    } catch {
      // canvas 오염(taint) — CORS 헤더가 기대대로 안 붙은 경우. 가짜 성공 금지, 정직한 실패.
      setCapErr(
        '브라우저 보안 정책으로 화면을 따올 수 없습니다 — 서버 CORS 설정(자사 오리진 허용)을 확인해 주세요.',
      );
      return;
    }
    if (!blob) {
      setCapErr('화면을 이미지로 변환하지 못했어요 — 다시 시도해 주세요.');
      return;
    }
    if (blob.size > 5 * 1024 * 1024) {
      setCapErr('따온 이미지가 5MB를 넘어요 — 더 작은 영역을 지정해 주세요.');
      return;
    }
    const file = new File([blob], `lecture-frame-${Math.floor(v.currentTime)}s.png`, {
      type: 'image/png',
    });
    setBusy(true);
    const fail = await onAttach(file); // null = 서버 재조회까지 확인된 성공
    setBusy(false);
    if (fail) setCapErr(fail);
    else onAttached();
  };

  const title = attachTarget
    ? attachTarget.slot === 'prompt'
      ? '문제 이미지 — 강의 화면에서 따오기'
      : `${(attachTarget.optionIndex ?? 0) + 1}번 보기 — 강의 화면에서 따오기`
    : '강의 미리보기 — 출제 시점 고르기';

  return (
    /* 문항 모달 위에 겹쳐 뜬다 — 배경 클릭이 바깥 모달 close로 새지 않게 전파를 끊는다 */
    <div
      className="op-bh-overlay"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <div className="op-formmodal lu-cap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-crop" /> {title}
          </span>
          <button className="op-bh-modal-x" onClick={onClose} disabled={busy}>
            <i className="ph-bold ph-x" />
          </button>
        </div>
        <span className="lu-help">
          {lec.title} · 영상 길이 {fmtMMSS(lec.duration_sec)}
          {attachTarget
            ? ' — 원하는 장면에서 멈추고 영역을 드래그하면 그 부분이 이미지로 첨부돼요.'
            : ' — 원하는 장면에서 멈추고 시점을 가져오세요.'}
        </span>

        {phase === 'loading' && <div className="op-logrow">미리보기 스트림을 여는 중…</div>}
        {phase === 'error' && (
          <div className="op-form-err lu-cap-gap">
            <i className="ph-fill ph-warning-circle" /> {loadMsg}
            <button className="op-btn op-btn--reject" onClick={loadPreview}>
              다시 시도
            </button>
          </div>
        )}
        {phase === 'ready' && (
          <>
            <div className="lu-cap-stage">
              <video
                ref={videoRef}
                className="lu-cap-video"
                src={API_ORIGIN + streamUrl}
                crossOrigin="anonymous"
                controls={!selecting}
                preload="metadata"
                onError={() => {
                  setPhase('error');
                  setLoadMsg(
                    '영상을 불러오지 못했어요 — 미리보기 토큰이 만료됐거나 서버 CORS 설정 문제일 수 있어요. 다시 시도해 주세요.',
                  );
                }}
              />
              {selecting && (
                <div
                  className="lu-cap-select"
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                >
                  {sel ? (
                    <div
                      className="lu-cap-rect"
                      style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
                    />
                  ) : (
                    <span className="lu-cap-hint">드래그해서 따올 영역을 지정하세요</span>
                  )}
                </div>
              )}
            </div>
            <div className="lu-cap-tools">
              {/* 시점 두 개를 한 재생 흐름에서 — 내용이 시작되는 장면에서 '내용 시작',
                  물을 장면(설명이 끝난 직후)에서 '출제 시점'을 차례로 누른다 */}
              <button
                type="button"
                className="op-btn op-btn--reject"
                onClick={useContentStart}
                disabled={busy}
              >
                <i className="ph-bold ph-rewind" /> 이 시점을 내용 시작으로
              </button>
              <button type="button" className="op-btn op-btn--reject" onClick={usePosition} disabled={busy}>
                <i className="ph-bold ph-timer" /> 이 시점을 출제 시점으로
              </button>
              {attachTarget ? (
                !selecting ? (
                  <button type="button" className="op-btn op-btn--approve" onClick={beginSelect}>
                    <i className="ph-bold ph-crop" /> 이 장면에서 영역 지정
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="op-btn op-btn--reject"
                      disabled={busy}
                      onClick={() => {
                        setSelecting(false);
                        setSel(null);
                      }}
                    >
                      <i className="ph-bold ph-arrow-counter-clockwise" /> 다시 재생·이동
                    </button>
                    <button
                      type="button"
                      className="op-btn op-btn--approve"
                      disabled={busy || !sel}
                      onClick={attachSelection}
                    >
                      <i className="ph-bold ph-check" />
                      {busy ? '올리는 중…' : '선택 영역 첨부'}
                    </button>
                  </>
                )
              ) : (
                <span className="lu-cap-note">
                  이미지 첨부는 문항을 먼저 저장한 뒤에 할 수 있어요 — 여기서는 시점만 가져올 수 있어요.
                </span>
              )}
            </div>
            {note && (
              <div className="op-lect-banner-ok lu-cap-gap">
                <i className="ph-fill ph-check-circle" /> {note}
              </div>
            )}
            {capErr && (
              <div className="op-form-err lu-cap-gap">
                <i className="ph-fill ph-warning-circle" /> {capErr}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ================= 자료실 모달 ================= */
function MaterialsModal({ lec, onClose }: { lec: OpsLecture; onClose: () => void }) {
  const { me } = useAuth();
  const isOps = me?.role === 'ops'; // 운영자는 자료 조회·다운로드(검수)만, 추가·삭제 숨김
  const [items, setItems] = useState<OpsLectureMaterial[] | null>(null);
  const [banner, setBanner] = useState('');
  const [mode, setMode] = useState<'link' | 'file'>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const load = () => {
    lectureApi
      .opsMaterials(lec.id)
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setBanner(errorDetail(e, '자료 목록을 불러오지 못했어요.'));
      });
  };
  useEffect(load, [lec.id]);

  const add = async () => {
    if (!title.trim()) return setBanner('자료 제목은 필수예요.');
    setSaving(true);
    setBanner('');
    try {
      if (mode === 'link') {
        if (!/^https?:\/\//.test(url.trim())) throw new Error('http(s)로 시작하는 URL을 입력하세요.');
        await lectureApi.opsMaterialCreateLink(lec.id, { title: title.trim(), url: url.trim() });
      } else {
        if (!file) throw new Error('업로드할 파일을 선택하세요.');
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('file', file);
        setProgress(0);
        await lectureApi.opsMaterialCreateFile(lec.id, fd, (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      setTitle('');
      setUrl('');
      setFile(null);
      setProgress(null);
      load();
    } catch (e) {
      setProgress(null);
      setBanner(e instanceof Error && !('response' in e) ? e.message : errorDetail(e, '자료 등록에 실패했어요.'));
    } finally {
      setSaving(false);
    }
  };

  const rename = async (m: OpsLectureMaterial) => {
    const next = window.prompt('자료 제목 수정', m.title);
    if (next == null || !next.trim() || next.trim() === m.title) return;
    try {
      await lectureApi.opsMaterialUpdate(lec.id, m.id, { title: next.trim() });
      load();
    } catch (e) {
      setBanner(errorDetail(e, '수정에 실패했어요.'));
    }
  };

  const remove = async (m: OpsLectureMaterial) => {
    if (!window.confirm(`'${m.title}' 자료를 삭제할까요?`)) return;
    try {
      await lectureApi.opsMaterialDelete(lec.id, m.id);
      load();
    } catch (e) {
      setBanner(errorDetail(e, '삭제에 실패했어요.'));
    }
  };

  const mRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div className="op-bh-overlay" onClick={onClose}>
      <div
        className="op-formmodal op-lect-widemodal"
        onClick={(e) => e.stopPropagation()}
        ref={mRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="강의 자료실"
      >
        <div className="op-bh-modal-h">
          <span>
            <i className="ph-fill ph-folder-open" /> 자료실 — {lec.title}
          </span>
          <button className="op-bh-modal-x" onClick={onClose}>
            <i className="ph-bold ph-x" />
          </button>
        </div>

        {/* 자료 추가는 강사 전용 — 운영자는 자료 조회·다운로드(검수)만(ops 권한 B) */}
        {isOps && (
          <div className="op-lect-qtools">
            <span className="lu-help">
              <i className="ph-fill ph-shield-check" /> 운영자는 자료를 검수(조회·다운로드)만 해요 — 추가·수정은 강사가 합니다.
            </span>
          </div>
        )}
        {!isOps && (
        <div className="op-lect-matform">
          <div className="op-lect-matmode">
            <button className={`op-btn ${mode === 'link' ? 'op-btn--approve' : 'op-btn--reject'}`} onClick={() => setMode('link')}>
              <i className="ph-bold ph-link" /> 링크
            </button>
            <button className={`op-btn ${mode === 'file' ? 'op-btn--approve' : 'op-btn--reject'}`} onClick={() => setMode('file')}>
              <i className="ph-bold ph-file-arrow-up" /> 파일
            </button>
          </div>
          <div className="op-form-grid">
            <label className="ox-field op-form-span2">
              제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1강 학습지" />
            </label>
            {mode === 'link' ? (
              <label className="ox-field op-form-span2">
                URL
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </label>
            ) : (
              <label className="ox-field op-form-span2">
                파일 (pdf/zip/이미지/문서, 최대 50MB)
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          {progress != null && (
            <div className="op-lect-progress">
              <div className="op-lect-progress-track">
                <div className="op-lect-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span>{progress < 100 ? `업로드 중… ${progress}%` : '서버에서 저장 확인 중…'}</span>
            </div>
          )}
          <div className="op-form-actions">
            <button className="op-btn op-btn--approve" disabled={saving} onClick={add}>
              <i className="ph-bold ph-plus" />
              {saving ? '등록 중…' : '자료 등록'}
            </button>
          </div>
        </div>
        )}

        {banner && (
          <div className="op-form-err op-lect-banner">
            <i className="ph-fill ph-warning-circle" /> {banner}
          </div>
        )}

        <div className="op-lect-qlist">
          {items === null && <div className="op-logrow">불러오는 중…</div>}
          {items !== null && items.length === 0 && <div className="op-logrow">등록된 자료가 없어요.</div>}
          {(items ?? []).map((m) => (
            <div key={m.id} className="op-lect-qrow">
              <div className="op-lect-qmeta">
                <span className="op-sys-status op-sys-status--neutral">{m.kind === 'link' ? '링크' : '파일'}</span>
              </div>
              <div className="op-lect-qbody">
                <b>{m.title}</b>
                <small className="op-aimodel-desc">
                  {m.kind === 'link' ? m.url : `${m.file_ext ?? ''} · ${fmtBytes(m.file_bytes)}`}
                </small>
              </div>
              {!isOps && (
                <div className="op-lect-actions">
                  <button className="op-btn op-btn--reject" onClick={() => rename(m)}>
                    수정
                  </button>
                  <button className="op-btn op-btn--reject op-lect-danger" onClick={() => remove(m)}>
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
