/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { teacherApi } from '../../api/teacher';
import TeacherLayout from '../../layouts/TeacherLayout';
import './TeacherClass.css';

/** handoff `CatChap 우리반.dc.html` 포팅 — 우리반 학생 관리 */

type Today = 'done' | 'none';
type Filter = 'all' | 'good' | 'slow' | 'help';

interface TcStudent {
  id: string;
  name: string;
  age: number;
  code: string;
  avatarBg: string;
  today: Today;
  acc: number;
  streak: number;
  status: string;
  solved: number;
  c1: string;
  c2: string;
}

interface DirEntry {
  code: string;
  name: string;
  age: number;
}

type TcModal =
  | { mode: 'add'; code: string }
  | { mode: 'edit'; id: string; name: string; age: number; status: string }
  | null;

/** GET /teacher/class/students/{id} 상세 — skills/comment (없으면 로컬 합성 fallback) */
interface TcDetail {
  id: string;
  skills: { label: string; pct: string; color: string }[] | null;
  comment: string | null;
}

const PALETTE = [
  { avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)', c1: '#FFB43C', c2: '#FF922E' },
  { avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)', c1: '#A98CFF', c2: '#8B6BFF' },
  { avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)', c1: '#4AA6FF', c2: '#2E7BFF' },
  { avatarBg: 'linear-gradient(135deg,#33C892,#17B0A0)', c1: '#33C892', c2: '#17B0A0' },
  { avatarBg: 'linear-gradient(135deg,#FF93BE,#FF6DA6)', c1: '#FF93BE', c2: '#FF6DA6' },
];

const DIRECTORY: DirEntry[] = [
  { code: 'CAT-7001', name: '한지우', age: 7 },
  { code: 'CAT-7002', name: '오서준', age: 6 },
  { code: 'CAT-7003', name: '배하윤', age: 8 },
  { code: 'CAT-7004', name: '신도현', age: 7 },
];

// TODO(api): teacherApi.myClassStudents 실패/로딩 시 원본 하드코딩 학생 데이터 유지
const FALLBACK: TcStudent[] = [
  { id: 's1', name: '김하은', age: 7, code: 'CAT-4823', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)', today: 'done', acc: 96, streak: 12, status: '좋음', solved: 86, c1: '#FF7A7A', c2: '#FF5A6E' },
  { id: 's2', name: '박도윤', age: 7, code: 'CAT-5119', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)', today: 'done', acc: 62, streak: 3, status: '도움 필요', solved: 54, c1: '#FFB43C', c2: '#FF922E' },
  { id: 's3', name: '최서아', age: 6, code: 'CAT-6042', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)', today: 'none', acc: 81, streak: 0, status: '학습 뜸함', solved: 22, c1: '#A98CFF', c2: '#8B6BFF' },
  { id: 's4', name: '김하람', age: 7, code: 'CAT-6188', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)', today: 'done', acc: 78, streak: 5, status: '도움 필요', solved: 61, c1: '#4AA6FF', c2: '#2E7BFF' },
  { id: 's5', name: '이준서', age: 8, code: 'CAT-6205', avatarBg: 'linear-gradient(135deg,#33C892,#17B0A0)', today: 'done', acc: 93, streak: 8, status: '좋음', solved: 74, c1: '#33C892', c2: '#17B0A0' },
  { id: 's6', name: '정유나', age: 7, code: 'CAT-6317', avatarBg: 'linear-gradient(135deg,#FF93BE,#FF6DA6)', today: 'done', acc: 88, streak: 6, status: '좋음', solved: 69, c1: '#FF93BE', c2: '#FF6DA6' },
  { id: 's7', name: '강시우', age: 6, code: 'CAT-6402', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)', today: 'none', acc: 74, streak: 1, status: '좋음', solved: 40, c1: '#4AA6FF', c2: '#2E7BFF' },
  { id: 's8', name: '윤아린', age: 7, code: 'CAT-6588', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)', today: 'done', acc: 91, streak: 9, status: '좋음', solved: 80, c1: '#A98CFF', c2: '#8B6BFF' },
];

const COMMENTS: Record<string, string> = {
  s2: '개념 이해는 좋으나 숫자 놀이터에서 덧셈 개념 혼동이 반복돼요. 사과 세기 활동을 추천해요.',
  s3: '최근 3일 학습 기록이 없어요. 짧은 그림 찾기부터 다시 시작하도록 독려해 주세요.',
  s4: '드래그 시 목표 칸 근처에서 자주 놓쳐요. 큰 카드 모드로 조작 연습이 도움돼요.',
};

// API 학생은 UUID id로 오므로 이름으로도 원본 코멘트를 찾을 수 있게 매핑
const COMMENTS_BY_NAME: Record<string, string> = {
  박도윤: COMMENTS.s2,
  최서아: COMMENTS.s3,
  김하람: COMMENTS.s4,
};

function statusStyle(st: string) {
  if (st === '학습 뜸함') return { bg: '#FFF3D6', color: '#B5720B' };
  if (st === '도움 필요') return { bg: '#FFE3E9', color: '#E0475E' };
  return { bg: '#E1F5EC', color: '#158A6E' };
}

function accColor(a: number) {
  return a >= 90 ? '#17B08C' : a >= 75 ? '#2E7BFF' : '#FF922E';
}

/**
 * API 응답을 화면 학생 모델로 매핑.
 * GET /teacher/class/students: { class_id, class_name, total,
 * students[{id,name,nickname,age,code,today:'done'|'none',acc,streak,status,solved}],
 * directory_codes[] } — 색상(avatarBg/c1/c2)은 API에 없어 이름 일치 시 FALLBACK 색,
 * 아니면 팔레트 순환으로 보정.
 */
function mapStudents(res: any): TcStudent[] | null {
  const rows = Array.isArray(res) ? res : Array.isArray(res?.students) ? res.students : null;
  if (!rows) return null;
  return rows.map((r: any, i: number): TcStudent => {
    const pal = PALETTE[i % PALETTE.length];
    const fb = FALLBACK.find((f) => f.name === r.name);
    return {
      id: String(r.id ?? r.student_id ?? `s${i + 1}`),
      name: String(r.name ?? ''),
      age: Number(r.age ?? 7),
      code: String(r.code ?? r.student_code ?? ''),
      avatarBg: r.avatarBg ?? r.avatar_bg ?? fb?.avatarBg ?? pal.avatarBg,
      today: r.today === 'done' || r.today_done ? 'done' : 'none',
      acc: Number(r.acc ?? r.accuracy ?? 0),
      streak: Number(r.streak ?? 0),
      status: String(r.status ?? '좋음'),
      solved: Number(r.solved ?? 0),
      c1: r.c1 ?? fb?.c1 ?? pal.c1,
      c2: r.c2 ?? fb?.c2 ?? pal.c2,
    };
  });
}

export default function TeacherClass() {
  const [students, setStudents] = useState<TcStudent[]>(FALLBACK);
  const [filter, setFilter] = useState<Filter>('all');
  const [selId, setSelId] = useState<string | null>('s2');
  const [modal, setModal] = useState<TcModal>(null);
  const [seq, setSeq] = useState(100);
  const [directory, setDirectory] = useState<DirEntry[]>(DIRECTORY);
  const [clsName, setClsName] = useState('1-2반');
  const [detail, setDetail] = useState<TcDetail | null>(null);
  const [search, setSearch] = useState('');

  // 재조회 시 이전 선택을 이름으로 이어가기 위한 최신 목록 참조
  const studentsRef = useRef<TcStudent[]>(FALLBACK);
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const loadStudents = useCallback(() => {
    teacherApi
      .myClassStudents()
      .then((res: any) => {
        const mapped = mapStudents(res);
        if (mapped && mapped.length) {
          const prev = studentsRef.current;
          setStudents(mapped);
          // FALLBACK id('s2')로 선택돼 있던 학생을 API UUID로 다시 연결 (이름 기준)
          setSelId((sid) => {
            if (sid == null || mapped.some((m) => m.id === sid)) return sid;
            const nm = prev.find((s) => s.id === sid)?.name;
            const hit = nm ? mapped.find((m) => m.name === nm) : undefined;
            return hit ? hit.id : sid;
          });
        }
        // 연동 가능 학생 코드 목록 — 코드가 로컬 디렉터리와 일치하면 이름/나이 유지
        if (Array.isArray(res?.directory_codes) && res.directory_codes.length) {
          setDirectory(
            res.directory_codes.map(
              (code: any): DirEntry =>
                DIRECTORY.find((d) => d.code === String(code)) ?? { code: String(code), name: '새 학생', age: 7 },
            ),
          );
        }
        if (res?.class_name) setClsName(String(res.class_name));
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 선택된 학생 상세(놀이별 정답률/AI 코멘트) — 로딩/실패 시 로컬 합성 fallback 유지
  useEffect(() => {
    if (!selId) {
      setDetail(null);
      return;
    }
    // 실 학생(UUID)일 때만 서버 호출 — FALLBACK 데모 id로 부르면 404
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(selId)) {
      setDetail(null);
      return;
    }
    let on = true;
    teacherApi
      .studentDetail(selId)
      .then((res: any) => {
        if (!on) return;
        const src = res?.data ?? res;
        if (!src || typeof src !== 'object') return;
        const skills = Array.isArray(src.skills)
          ? src.skills.map((k: any) => {
              const v = Number(k.pct ?? 0);
              return { label: String(k.label ?? ''), pct: v + '%', color: accColor(v) };
            })
          : null;
        setDetail({
          id: selId,
          skills: skills && skills.length ? skills : null,
          comment: src.comment != null ? String(src.comment) : null,
        });
      })
      .catch(() => {
        // TODO(api): 실패(FALLBACK id 's2' 등 미존재 학생 포함) 시 로컬 합성 유지
      });
    return () => {
      on = false;
    };
  }, [selId]);

  const matchOf = (m: TcModal): DirEntry | null => {
    if (!m || m.mode !== 'add') return null;
    const code = (m.code || '').trim().toUpperCase();
    if (!code) return null;
    return directory.find((d) => d.code === code) || null;
  };

  const openAdd = () => setModal({ mode: 'add', code: '' });

  const openEdit = (id?: string) => {
    const s = students.find((x) => x.id === (id || selId));
    if (!s) return;
    setSelId(s.id);
    setModal({ mode: 'edit', id: s.id, name: s.name, age: s.age, status: s.status });
  };

  // '학급에서 제외' — 계정/학습기록 삭제가 아니라 우리 반에서 빼는 것(class_id 해제). 확인창으로 오해 방지.
  const deleteStudent = (id: string | null) => {
    if (!id) return;
    const s = students.find((x) => x.id === id);
    const nm = s ? `${s.name} 학생을 ` : '';
    if (
      !window.confirm(
        `${nm}우리 반에서 뺄까요?\n\n계정·학습기록·코인은 삭제되지 않아요. 나중에 학생 코드로 다시 반에 넣을 수 있어요.`,
      )
    )
      return;
    setStudents((prev) => prev.filter((x) => x.id !== id));
    setSelId((prev) => (prev === id ? null : prev));
    teacherApi
      .removeStudent(id)
      .then(() => loadStudents())
      .catch(() => {
        // 실패 시 목록 재로딩으로 원상 복구
        loadStudents();
      });
  };

  // 자기 반 학생 비밀번호 초기화 — 임시 비번을 결과 모달로 1회 노출
  const [resetResult, setResetResult] = useState<
    { name: string; temp: string; error?: string } | null
  >(null);
  const resetPw = (id: string | null) => {
    const s = students.find((x) => x.id === (id || selId));
    if (!s || !id) return;
    teacherApi
      .resetStudentPassword(id)
      .then((r) => setResetResult({ name: s.name, temp: r.temp_password }))
      .catch((e: unknown) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setResetResult({ name: s.name, temp: '', error: detail ?? '초기화에 실패했어요.' });
      });
  };

  // 우리 반 학생의 학부모 초대 코드 발급 — 결과 모달로 1회 노출·복사
  const [inviteResult, setInviteResult] = useState<
    { name: string; code: string; error?: string } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const issueParent = (id: string | null) => {
    const s = students.find((x) => x.id === (id || selId));
    if (!s || !id) return;
    teacherApi
      .issueParentInvite(id)
      .then((r) => {
        setCopied(false);
        setInviteResult({ name: s.name, code: r.invite_code });
      })
      .catch((e: unknown) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setInviteResult({ name: s.name, code: '', error: detail ?? '초대코드 발급에 실패했어요.' });
      });
  };
  // 초대 코드 클립보드 복사 (실패 시 execCommand 폴백)
  const copyInviteCode = (code: string) => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        } catch {
          /* 복사 실패해도 코드는 화면에 보이므로 수동 복사 가능 */
        }
      });
    } else {
      done();
    }
  };

  const saveModal = () => {
    if (!modal) return;
    if (modal.mode === 'add') {
      const match = matchOf(modal);
      if (!match) return;
      // 원본의 로컬 연동 흐름 그대로 반영
      const pal = PALETTE[students.length % PALETTE.length];
      const id = 'n' + seq;
      const student: TcStudent = {
        id,
        name: match.name,
        age: match.age,
        code: match.code,
        avatarBg: pal.avatarBg,
        today: 'none',
        acc: 80,
        streak: 0,
        status: '좋음',
        solved: 0,
        c1: pal.c1,
        c2: pal.c2,
      };
      setStudents((prev) => [...prev, student]);
      setDirectory((prev) => prev.filter((d) => d.code !== match.code));
      setSeq((q) => q + 1);
      setModal(null);
      setSelId(id);
      teacherApi
        .addStudentByCode(match.code)
        .then(() => loadStudents())
        .catch(() => {
          // TODO(api): 실패 시 원본 로컬 연동 흐름 유지
        });
    } else {
      const name = (modal.name || '').trim();
      if (!name) return;
      const { id, status } = modal;
      // 나이는 백엔드 허용 범위(3~13)로 클램프 — 미입력(0)이면 갱신하지 않음
      const age = modal.age && modal.age >= 3 ? Math.min(13, modal.age) : undefined;
      setStudents((prev) => prev.map((x) => (x.id === id ? { ...x, name, age: age ?? x.age, status } : x)));
      setModal(null);
      teacherApi
        // 교사가 고치는 이름은 학교용 실명(real_name) — 학생 닉네임은 학생 소유라 건드리지 않음
        .updateStudent(id, { real_name: name, age, status })
        .then(() => loadStudents())
        .catch(() => {
          // TODO(api): 실패 시 원본 로컬 수정 흐름 유지
        });
    }
  };

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: students.length },
    { key: 'good', label: '좋음', count: students.filter((s) => s.status === '좋음').length },
    { key: 'slow', label: '학습 뜸함', count: students.filter((s) => s.status === '학습 뜸함').length },
    { key: 'help', label: '도움 필요', count: students.filter((s) => s.status === '도움 필요').length },
  ];

  const inFilter = (s: TcStudent) =>
    filter === 'all' ||
    (filter === 'good' && s.status === '좋음') ||
    (filter === 'slow' && s.status === '학습 뜸함') ||
    (filter === 'help' && s.status === '도움 필요');

  const kw = search.trim();
  const filtered = students.filter((s) => inFilter(s) && (kw === '' || s.name.includes(kw) || s.code.includes(kw.toUpperCase())));

  const sel = students.find((s) => s.id === selId) ?? null;
  // API 상세가 현재 선택과 일치하면 사용 — 아니면(로딩/실패) 로컬 합성 fallback
  const selDetail = sel && detail && detail.id === sel.id ? detail : null;
  const selSkills = sel
    ? selDetail?.skills ??
      [
        { label: '한글 낱말', base: sel.acc + 4 },
        { label: '그림 찾기', base: sel.acc + 2 },
        { label: '끌어놓기', base: sel.acc - 8 },
        { label: '숫자 놀이터', base: sel.acc - 14 },
      ].map((k) => {
        const v = Math.max(35, Math.min(99, k.base));
        return { label: k.label, pct: v + '%', color: accColor(v) };
      })
    : [];
  const selComment = sel
    ? selDetail?.comment ??
      (COMMENTS[sel.id] ||
        COMMENTS_BY_NAME[sel.name] ||
        '전반적으로 안정적으로 학습하고 있어요. 새로운 도전 문제를 배정해 보세요.')
    : '';

  const detailCol = sel ? '340px' : '0px';

  const match = matchOf(modal);
  const isAdd = !!modal && modal.mode === 'add';
  const isEdit = !!modal && modal.mode === 'edit';
  const noMatch = isAdd && (modal as { code: string }).code.trim().length > 0 && !match;
  const saveDisabled = isAdd && !match;

  return (
    <TeacherLayout bottomCard={null}>
      <main className="tc-main" style={{ gridTemplateColumns: `1fr ${detailCol}` }}>
        <div className="tc-left">
          {/* HEADER */}
          <div className="tc-header">
            <div>
              <div className="tc-crumbs">
                <Link to={PATHS.TEACHER_HOME} className="tc-crumbLink">선생님 콘솔</Link>
                <i className="ph-bold ph-caret-right" />
                <span>우리반 학생</span>
              </div>
              <h1 className="tc-title">{clsName} 학생 <span className="tc-titleAccent">{students.length}명</span></h1>
            </div>
            <div className="tc-headActions">
              <div className="tc-searchWrap">
                <i className="ph-bold ph-magnifying-glass tc-searchIcon" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="학생 이름·코드 검색"
                  className="tc-searchInput"
                />
              </div>
              <button onClick={openAdd} className="tc-addBtn">
                <i className="ph-fill ph-user-plus" />학생 추가
              </button>
            </div>
          </div>

          {/* FILTER CHIPS */}
          <div className="tc-chips">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`tc-chip ${filter === c.key ? 'tc-chip-on' : 'tc-chip-off'}`}
              >
                {c.label} <span className="tc-chipCount">{c.count}</span>
              </button>
            ))}
          </div>

          {/* STUDENT TABLE */}
          <div className="tc-tableCard">
            <table className="tc-table">
              <thead>
                <tr className="tc-theadRow">
                  <th>학생</th>
                  <th>오늘 학습</th>
                  <th>정답률</th>
                  <th>연속</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const ss = statusStyle(s.status);
                  return (
                    <tr key={s.id} className={`tc-row${s.id === selId ? ' tc-selected' : ''}`}>
                      <td onClick={() => setSelId(s.id)} className="tc-cellStudent">
                        <div className="tc-stuWrap">
                          <span className="tc-avatar" style={{ background: s.avatarBg }}>{[...s.name][0] || '냥'}</span>
                          <div>
                            <div className="tc-stuName">{s.name}</div>
                            <div className="tc-stuMeta">{s.age}세 · {s.code}</div>
                          </div>
                        </div>
                      </td>
                      <td onClick={() => setSelId(s.id)} className="tc-cell">
                        <span className={`tc-today ${s.today === 'done' ? 'tc-today-done' : 'tc-today-none'}`}>
                          {s.today === 'done' ? '완료' : '미학습'}
                        </span>
                      </td>
                      <td onClick={() => setSelId(s.id)} className="tc-cell">
                        <span className="tc-acc" style={{ color: accColor(s.acc) }}>{s.acc}%</span>
                      </td>
                      <td onClick={() => setSelId(s.id)} className="tc-cell tc-cellStreak">
                        <i className="ph-fill ph-fire tc-fire" />{s.streak}
                      </td>
                      <td onClick={() => setSelId(s.id)} className="tc-cell">
                        <span className="tc-status" style={{ background: ss.bg, color: ss.color }}>{s.status}</span>
                      </td>
                      <td className="tc-cellManage">
                        <div className="tc-manage">
                          <button onClick={() => openEdit(s.id)} title="수정" className="tc-btnEdit">
                            <i className="ph-fill ph-pencil-simple" />
                          </button>
                          <button onClick={() => deleteStudent(s.id)} title="학급에서 제외(계정은 삭제 안 됨)" className="tc-btnDel">
                            <i className="ph-fill ph-user-minus" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="tc-empty">
                조건에 맞는 학생이 없어요.{' '}
                <button onClick={openAdd} className="tc-emptyAdd">학생 추가하기</button>
              </div>
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        {sel && (
          <div className="tc-detail">
            <div className="tc-detailHead" style={{ background: `linear-gradient(130deg,${sel.c1},${sel.c2})` }}>
              <button onClick={() => setSelId(null)} className="tc-detailClose">
                <i className="ph-bold ph-x" />
              </button>
              <div className="tc-detailProfile">
                <span className="tc-detailAvatar">{[...sel.name][0] || '냥'}</span>
                <div>
                  <div className="tc-detailName">{sel.name}</div>
                  <div className="tc-detailMeta">{sel.age}세 · {sel.code}</div>
                </div>
              </div>
            </div>
            <div className="tc-detailBody">
              <div className="tc-statGrid">
                <div className="tc-stat">
                  <div className="tc-statVal" style={{ color: accColor(sel.acc) }}>{sel.acc}%</div>
                  <div className="tc-statLabel">정답률</div>
                </div>
                <div className="tc-stat">
                  <div className="tc-statVal tc-statStreak">{sel.streak}</div>
                  <div className="tc-statLabel">연속일</div>
                </div>
                <div className="tc-stat">
                  <div className="tc-statVal tc-statSolved">{sel.solved}</div>
                  <div className="tc-statLabel">주간 문제</div>
                </div>
              </div>
              <div className="tc-skillsTitle">놀이별 정답률</div>
              <div className="tc-skills">
                {selSkills.map((sk) => (
                  <div key={sk.label}>
                    <div className="tc-skillHead">
                      <span>{sk.label}</span>
                      <span style={{ color: sk.color }}>{sk.pct}</span>
                    </div>
                    <div className="tc-skillTrack">
                      <div className="tc-skillFill" style={{ width: sk.pct, background: sk.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="tc-aiBox">
                <div className="tc-aiHead">
                  <i className="ph-fill ph-robot" />
                  <span className="tc-aiLabel">AI 코멘트</span>
                </div>
                <p className="tc-aiText">{selComment}</p>
              </div>
              {/* 맞춤 문제 배정: 아직 백엔드 미연동 — 정직하게 준비 중으로 비활성화 */}
              <button className="tc-assignBtn" disabled title="곧 제공될 기능이에요">
                맞춤 문제 배정 (준비 중)
              </button>
              <div className="tc-detailActions">
                <button onClick={() => openEdit()} className="tc-editBtn">
                  <i className="ph-fill ph-pencil-simple" />정보 수정
                </button>
                <button onClick={() => issueParent(selId)} className="tc-editBtn">
                  <i className="ph-fill ph-user-circle-plus" />학부모 초대
                </button>
                <button onClick={() => resetPw(selId)} className="tc-editBtn">
                  <i className="ph-fill ph-key" />비번 초기화
                </button>
                <button onClick={() => deleteStudent(selId)} className="tc-delBtn" title="우리 반에서 빼기(계정은 삭제 안 됨)">
                  <i className="ph-fill ph-user-minus" />학급에서 제외
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD / EDIT MODAL */}
        {modal && (
          <div onClick={() => setModal(null)} className="tc-overlay">
            <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tc-modalHead">
                <div className="tc-modalIconBox">
                  <i className={isEdit ? 'ph-fill ph-pencil-simple' : 'ph-fill ph-link'} />
                </div>
                <div className="tc-modalTitleWrap">
                  <div className="tc-modalTitle">{isEdit ? '학생 정보 수정' : '학생 코드로 연동'}</div>
                  <div className="tc-modalSub">우리반 학생 정보를 관리해요</div>
                </div>
                <button onClick={() => setModal(null)} className="tc-modalClose">
                  <i className="ph-bold ph-x" />
                </button>
              </div>
              <div className="tc-modalBody">
                {isAdd && modal.mode === 'add' && (
                  <>
                    <label className="tc-label">학생 코드</label>
                    <input
                      value={modal.code}
                      onChange={(e) =>
                        setModal((m) =>
                          m && m.mode === 'add'
                            ? { ...m, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) }
                            : m,
                        )
                      }
                      placeholder="예) CAT-7001"
                      className="tc-codeInput"
                    />
                    {match && (
                      <div className="tc-match">
                        <span
                          className="tc-matchAvatar"
                          style={{ background: PALETTE[students.length % PALETTE.length].avatarBg }}
                        >
                          {[...match.name][0] || '냥'}
                        </span>
                        <div className="tc-matchInfo">
                          <div className="tc-matchName">{match.name}</div>
                          <div className="tc-matchCode">{match.code} · {match.age}세</div>
                        </div>
                        <span className="tc-matchBadge">
                          <i className="ph-fill ph-check-circle" />확인됨
                        </span>
                      </div>
                    )}
                    {noMatch && (
                      <div className="tc-noMatch">
                        <i className="ph-fill ph-warning-circle" />
                        <span>코드를 찾을 수 없어요. 학생이 회원가입 시 받은 코드를 다시 확인해 주세요.</span>
                      </div>
                    )}
                    <div className="tc-infoBox">
                      <i className="ph-fill ph-info" />
                      <span>
                        학생 코드를 입력하면 계정이 자동으로 우리반에 연동돼요.<br />
                        연동 가능한 예시 코드: <b className="tc-infoCodes">{directory.map((d) => d.code).join(', ')}</b>
                      </span>
                    </div>
                  </>
                )}

                {isEdit && modal.mode === 'edit' && (
                  <>
                    <label className="tc-label">학생 이름</label>
                    <input
                      value={modal.name}
                      onChange={(e) =>
                        setModal((m) =>
                          m && m.mode === 'edit' ? { ...m, name: e.target.value.slice(0, 10) } : m,
                        )
                      }
                      maxLength={10}
                      placeholder="예) 김하은"
                      className="tc-nameInput"
                    />

                    <label className="tc-label">나이 (만, 3~13세)</label>
                    <input
                      type="number"
                      min={3}
                      max={13}
                      value={modal.age || ''}
                      onChange={(e) =>
                        setModal((m) =>
                          m && m.mode === 'edit'
                            ? { ...m, age: e.target.value === '' ? 0 : Number(e.target.value) }
                            : m,
                        )
                      }
                      placeholder="예) 10"
                      className="tc-nameInput"
                    />

                    <label className="tc-label">상태</label>
                    <div className="tc-statusRow">
                      {['좋음', '학습 뜸함', '도움 필요'].map((label) => (
                        <button
                          key={label}
                          onClick={() =>
                            setModal((m) => (m && m.mode === 'edit' ? { ...m, status: label } : m))
                          }
                          className={`tc-statusChip ${modal.status === label ? 'tc-st-on' : 'tc-st-off'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="tc-modalActions">
                  <button onClick={() => setModal(null)} className="tc-cancelBtn">취소</button>
                  <button onClick={saveModal} className={`tc-saveBtn${saveDisabled ? ' tc-saveDisabled' : ''}`}>
                    <i className="ph-fill ph-check" />{isEdit ? '저장하기' : '연동하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 비밀번호 초기화 결과 (임시 비번 1회 노출) */}
        {resetResult && (
          <div onClick={() => setResetResult(null)} className="tc-overlay">
            <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tc-modalHead">
                <div className="tc-modalIconBox"><i className="ph-fill ph-key" /></div>
                <div className="tc-modalTitleWrap">
                  <div className="tc-modalTitle">
                    {resetResult.error ? '초기화 실패' : '비밀번호를 초기화했어요'}
                  </div>
                  <div className="tc-modalSub">{resetResult.name}</div>
                </div>
                <button onClick={() => setResetResult(null)} className="tc-modalClose">
                  <i className="ph-bold ph-x" />
                </button>
              </div>
              <div className="tc-modalBody">
                {resetResult.error ? (
                  <div className="tc-noMatch">
                    <i className="ph-fill ph-warning-circle" />
                    <span>{resetResult.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="tc-infoBox">
                      <i className="ph-fill ph-info" />
                      <span>
                        임시 비밀번호를 학생에게 전달하세요. 학생이 다음에 로그인하면
                        <b> 새 비밀번호를 반드시 정하게</b> 돼요.
                      </span>
                    </div>
                    <label className="tc-label">임시 비밀번호</label>
                    <div className="tc-codeInput" style={{ userSelect: 'all', fontWeight: 800 }}>
                      {resetResult.temp}
                    </div>
                  </>
                )}
                <div className="tc-modalActions">
                  <button onClick={() => setResetResult(null)} className="tc-saveBtn">
                    <i className="ph-fill ph-check" />확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 학부모 초대 코드 결과 모달 */}
        {inviteResult && (
          <div onClick={() => setInviteResult(null)} className="tc-overlay">
            <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tc-modalHead">
                <div className="tc-modalIconBox"><i className="ph-fill ph-user-circle-plus" /></div>
                <div className="tc-modalTitleWrap">
                  <div className="tc-modalTitle">
                    {inviteResult.error ? '초대코드 발급 실패' : '학부모 초대 코드'}
                  </div>
                  <div className="tc-modalSub">{inviteResult.name}</div>
                </div>
                <button onClick={() => setInviteResult(null)} className="tc-modalClose">
                  <i className="ph-bold ph-x" />
                </button>
              </div>
              <div className="tc-modalBody">
                {inviteResult.error ? (
                  <div className="tc-noMatch">
                    <i className="ph-fill ph-warning-circle" />
                    <span>{inviteResult.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="tc-infoBox">
                      <i className="ph-fill ph-info" />
                      <span>
                        이 코드를 학부모님께 전달하세요. 학부모 가입 화면에서 코드를 넣으면 이 학생과 연결돼요.
                        <b> 최대 2회</b> 쓸 수 있고 <b>14일</b> 뒤 만료돼요.
                      </span>
                    </div>
                    <label className="tc-label">초대 코드</label>
                    <div className="tc-codeRow">
                      <div
                        className="tc-codeInput"
                        style={{ userSelect: 'all', fontWeight: 800, cursor: 'pointer', flex: 1 }}
                        onClick={() => copyInviteCode(inviteResult.code)}
                        title="클릭하면 복사돼요"
                      >
                        {inviteResult.code}
                      </div>
                      <button
                        type="button"
                        className={'tc-copyBtn' + (copied ? ' tc-copyBtn--done' : '')}
                        onClick={() => copyInviteCode(inviteResult.code)}
                      >
                        <i className={copied ? 'ph-fill ph-check' : 'ph-fill ph-copy'} />
                        {copied ? '복사됨' : '복사'}
                      </button>
                    </div>
                  </>
                )}
                <div className="tc-modalActions">
                  <button onClick={() => setInviteResult(null)} className="tc-saveBtn">
                    <i className="ph-fill ph-check" />확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </TeacherLayout>
  );
}
