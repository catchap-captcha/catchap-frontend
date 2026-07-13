/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { teacherApi } from '../../api/teacher';
import TeacherLayout from '../../layouts/TeacherLayout';
import './TeacherStudents.css';

/** handoff `CatChap 전체학생조회.dc.html` 포팅 — 전체 학생 조회(전교 명단) */

interface TsStudent {
  name: string;
  code?: string; // 실데이터(API)만 보유 — FALLBACK 데모엔 없음
  g: number;
  c: number;
  acc: number;
  sessions: string;
  weekMin?: number; // 이번 주 학습 시간(분) — 실데이터(API)만 보유
  weak: string;
  status: string;
}

// TODO(api): teacherApi.allStudents 실패/로딩 시 원본 DCLogic 하드코딩 학생 목록 유지
const FALLBACK: TsStudent[] = [
  { name: '강하은', g: 1, c: 2, acc: 96, sessions: '14회', weak: '숫자 놀이터', status: '좋음' },
  { name: '박도현', g: 1, c: 2, acc: 58, sessions: '6회', weak: '숫자 놀이터', status: '도움 필요' },
  { name: '이서아', g: 1, c: 2, acc: 74, sessions: '3회', weak: '끌어놓기', status: '학습 뜸함' },
  { name: '정민지', g: 1, c: 2, acc: 91, sessions: '12회', weak: '안전 지킴이', status: '좋음' },
  { name: '최유준', g: 1, c: 2, acc: 88, sessions: '11회', weak: '끌어놓기', status: '좋음' },
  { name: '김준우', g: 1, c: 2, acc: 69, sessions: '7회', weak: '끌어놓기', status: '도움 필요' },
  { name: '윤서연', g: 1, c: 3, acc: 93, sessions: '13회', weak: '한글 낱말', status: '좋음' },
  { name: '장민석', g: 1, c: 3, acc: 81, sessions: '9회', weak: '숫자 놀이터', status: '좋음' },
  { name: '한지호', g: 1, c: 3, acc: 64, sessions: '4회', weak: '그림 찾기', status: '학습 뜸함' },
  { name: '오수빈', g: 1, c: 3, acc: 87, sessions: '10회', weak: '안전 지킴이', status: '좋음' },
  { name: '배주은', g: 2, c: 1, acc: 90, sessions: '12회', weak: '끌어놓기', status: '좋음' },
  { name: '신재원', g: 2, c: 1, acc: 72, sessions: '6회', weak: '숫자 놀이터', status: '도움 필요' },
  { name: '문가온', g: 2, c: 1, acc: 95, sessions: '15회', weak: '그림 찾기', status: '좋음' },
  { name: '조은채', g: 2, c: 1, acc: 83, sessions: '8회', weak: '한글 낱말', status: '좋음' },
  { name: '임도윤', g: 2, c: 3, acc: 78, sessions: '7회', weak: '끌어놓기', status: '좋음' },
  { name: '권시우', g: 2, c: 3, acc: 61, sessions: '3회', weak: '숫자 놀이터', status: '학습 뜸함' },
  { name: '남하율', g: 2, c: 3, acc: 89, sessions: '11회', weak: '안전 지킴이', status: '좋음' },
  { name: '서지안', g: 3, c: 1, acc: 94, sessions: '13회', weak: '그림 찾기', status: '좋음' },
  { name: '홍예준', g: 3, c: 1, acc: 76, sessions: '6회', weak: '끌어놓기', status: '도움 필요' },
  { name: '고나윤', g: 3, c: 1, acc: 92, sessions: '12회', weak: '한글 낱말', status: '좋음' },
  { name: '백주호', g: 3, c: 2, acc: 85, sessions: '10회', weak: '숫자 놀이터', status: '좋음' },
  { name: '유채원', g: 3, c: 2, acc: 67, sessions: '5회', weak: '그림 찾기', status: '학습 뜸함' },
  { name: '전시윤', g: 3, c: 2, acc: 88, sessions: '11회', weak: '안전 지킴이', status: '좋음' },
  { name: '노아린', g: 3, c: 2, acc: 90, sessions: '12회', weak: '끌어놓기', status: '좋음' },
];

const TEACHERS: Record<string, string> = {
  '1-2': '이수진',
  '1-3': '최유나',
  '2-1': '박민호',
  '2-3': '강도현',
  '3-1': '정하늘',
  '3-2': '김보람',
};

const GROUP_COLORS = [
  { bg: '#EDE9FF', color: '#8B6BFF' },
  { bg: '#FFE9F1', color: '#FF6DA6' },
  { bg: '#E1F5EC', color: '#17B08C' },
  { bg: '#E6F0FF', color: '#2E7BFF' },
  { bg: '#FFEDE0', color: '#FF922E' },
  { bg: '#FFE7E2', color: '#FF5A4D' },
];

const AVATARS = [
  'linear-gradient(135deg,#8B6BFF,#B08AFF)',
  'linear-gradient(135deg,#FF9FC0,#FF6DA6)',
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
  'linear-gradient(135deg,#33C892,#17B0A0)',
];

/** 원본 statusTag — 스타일 문자열은 클래스 변형으로 이동(값 동일) */
function statusTag(st: string) {
  if (st === '도움 필요')
    return { tag: '도움 필요', tagIcon: 'ph-fill ph-hand-heart', tagClass: 'ts-tag-help' };
  if (st === '학습 뜸함')
    return { tag: '학습 뜸함', tagIcon: 'ph-fill ph-moon', tagClass: 'ts-tag-idle' };
  return { tag: '좋음', tagIcon: 'ph-fill ph-check-circle', tagClass: 'ts-tag-good' };
}

/** 원본 accColor 그대로 */
function accColor(a: number) {
  return a >= 85 ? '#17B08C' : a >= 70 ? '#F0A400' : '#E0475E';
}

const GRADES = [1, 2, 3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6];

/**
 * API 응답을 평탄한 명단으로 매핑.
 * GET /teacher/students: { total, filtered, groups[{label:'1학년 2반', badge:'1-2',
 * teacher, count, students[{id,name,acc,sessions,weak,status}]}] } —
 * 화면은 평탄한 목록(g/c)에서 다시 그룹핑하므로 badge/label에서 학년·반을 파싱한다.
 */
function mapRoster(res: any): { rows: TsStudent[]; teachers: Record<string, string> } | null {
  const apiGroups = Array.isArray(res?.groups) ? res.groups : null;
  if (!apiGroups) return null;
  const rows: TsStudent[] = [];
  const teachers: Record<string, string> = {};
  apiGroups.forEach((grp: any) => {
    const m =
      String(grp.badge ?? '').match(/^(\d+)-(\d+)$/) ??
      String(grp.label ?? '').match(/(\d+)학년\s*(\d+)반/);
    const g = m ? Number(m[1]) : 0;
    const c = m ? Number(m[2]) : 0;
    if (m && grp.teacher) teachers[`${g}-${c}`] = String(grp.teacher);
    (Array.isArray(grp.students) ? grp.students : []).forEach((s: any) => {
      rows.push({
        name: String(s.name ?? ''),
        code: String(s.code ?? s.student_code ?? ''),
        g,
        c,
        acc: Number(s.acc ?? s.accuracy) || 0,
        sessions: String(s.sessions ?? `${s.session_count ?? 0}회`),
        weekMin: typeof s.week_min === 'number' ? s.week_min : undefined,
        weak: String(s.weak ?? s.weak_game ?? ''),
        status: String(s.status ?? '좋음'),
      });
    });
  });
  return rows.length ? { rows, teachers } : null;
}

export default function TeacherStudents() {
  const [roster, setRoster] = useState<TsStudent[]>(FALLBACK);
  const [teachers, setTeachers] = useState<Record<string, string>>(TEACHERS);
  const [grade, setGrade] = useState<number | '전체'>('전체');
  const [cls, setCls] = useState<number | '전체'>('전체');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let on = true;
    teacherApi
      .allStudents()
      .then((res: any) => {
        if (!on) return;
        // 실제 API 형태: groups[] (그룹별 명단 + 담임)
        const grouped = mapRoster(res);
        if (grouped) {
          setRoster(grouped.rows);
          if (Object.keys(grouped.teachers).length) setTeachers((t) => ({ ...t, ...grouped.teachers }));
          return;
        }
        // 예비: 평탄한 배열 형태 응답 지원
        const rows = Array.isArray(res) ? res : res?.students ?? res?.items;
        if (!Array.isArray(rows) || rows.length === 0) return;
        setRoster(
          rows.map((s: any) => ({
            name: String(s.name ?? ''),
            g: Number(s.g ?? s.grade) || 0,
            c: Number(s.c ?? s.cls ?? s.class_no ?? s.classroom) || 0,
            acc: Number(s.acc ?? s.accuracy) || 0,
            sessions: s.sessions ?? `${s.session_count ?? 0}회`,
            weak: s.weak ?? s.weak_game ?? '',
            status: s.status ?? '좋음',
          })),
        );
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, []);

  const q = query.trim();

  // 원본 renderVals 필터/그룹핑 로직 그대로 (클라이언트 필터링).
  // 명단이 커지면 그룹핑이 렌더마다 도는 비용이 커서 입력값이 바뀔 때만 재계산한다.
  const { filtered, groups } = useMemo(() => {
    const filtered = roster.filter(
      (s) =>
        (grade === '전체' || s.g === grade) &&
        (cls === '전체' || s.c === cls) &&
        (q === '' || s.name.includes(q)),
    );

    const keys: string[] = [];
    filtered.forEach((s) => {
      const k = s.g + '-' + s.c;
      if (!keys.includes(k)) keys.push(k);
    });
    keys.sort();
    let ai = 0;
    const groups = keys.map((k, gi) => {
      const [g, c] = k.split('-');
      const list = filtered
        .filter((s) => s.g + '-' + s.c === k)
        .map((s) => {
          const av = AVATARS[ai++ % AVATARS.length];
          return {
            name: s.name,
            code: s.code,
            initial: [...s.name][0],
            avatarBg: av,
            acc: s.acc + '%',
            accColor: accColor(s.acc),
            sessions: s.sessions,
            // 이번 주 학습 시간 — API 실데이터에만 존재(FALLBACK 데모는 '—')
            weekTime: typeof s.weekMin === 'number' ? `${s.weekMin}분` : '—',
            weak: s.weak,
            ...statusTag(s.status),
          };
        });
      const col = GROUP_COLORS[gi % GROUP_COLORS.length];
      return {
        label: g + '학년 ' + c + '반',
        badge: g + '-' + c,
        teacher: teachers[k] || '미배정',
        count: list.length,
        students: list,
        bg: col.bg,
        color: col.color,
      };
    });
    return { filtered, groups };
  }, [roster, grade, cls, q, teachers]);

  const filterLabel =
    (grade === '전체' ? '전체 학년' : grade + '학년') +
    ' · ' +
    (cls === '전체' ? '전체 반' : cls + '반') +
    (q ? ' · "' + q + '" 검색' : '');

  const gradeChips = [
    { label: '전체', active: grade === '전체', onClick: () => setGrade('전체') },
    ...GRADES.map((g) => ({
      label: g + '학년',
      active: grade === g,
      onClick: () => setGrade(g),
    })),
  ];
  const clsChips = [
    { label: '전체', active: cls === '전체', onClick: () => setCls('전체') },
    ...CLASSES.map((c) => ({
      label: c + '반',
      active: cls === c,
      onClick: () => setCls(c),
    })),
  ];

  return (
    <TeacherLayout
      bottomCard={
        <>
          <div className="tl-task-title">전체 학생</div>
          <div className="tl-task-desc">
            {new Set(roster.map((s) => s.g)).size}개 학년 · {roster.length}명이 학습 중이에요.
          </div>
        </>
      }
    >
      <main className="ts-main">
        {/* HEADER */}
        <div className="ts-header">
          <div className="ts-crumbs">
            <Link to={PATHS.TEACHER_HOME} className="ts-crumb-link">
              선생님 콘솔
            </Link>
            <i className="ph-bold ph-caret-right" />
            <span>전체 학생 조회</span>
          </div>
          <h1 className="ts-title">전체 학생 조회</h1>
          <p className="ts-subtitle">
            학년·반으로 나눠 전교 학생 명단을 살펴봐요. <b>개인정보는 담당 교사에게만 보여요.</b>
          </p>
        </div>

        {/* FILTER BAR */}
        <div className="ts-filter-card">
          <div className="ts-filter-row">
            <div>
              <div className="ts-filter-label">학년</div>
              <div className="ts-chip-row">
                {gradeChips.map((c) => (
                  <button
                    key={c.label}
                    className={'ts-chip ' + (c.active ? 'ts-chip-on' : 'ts-chip-off')}
                    onClick={c.onClick}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ts-divider" />
            <div>
              <div className="ts-filter-label">반</div>
              <div className="ts-chip-row">
                {clsChips.map((c) => (
                  <button
                    key={c.label}
                    className={'ts-chip ' + (c.active ? 'ts-chip-on' : 'ts-chip-off')}
                    onClick={c.onClick}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ts-search">
              <div className="ts-filter-label">이름 검색</div>
              <i className="ph-bold ph-magnifying-glass" />
              <input
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                placeholder="학생 이름"
              />
            </div>
          </div>
        </div>

        {/* RESULT SUMMARY */}
        <div className="ts-summary">
          <span className="ts-count-pill">
            <i className="ph-fill ph-users" />
            {filtered.length}명
          </span>
          <span>{filterLabel}</span>
        </div>

        {/* GROUPED ROSTER */}
        {groups.length > 0 && (
          <div className="ts-groups">
            {groups.map((g) => (
              <div key={g.badge} className="ts-group-card">
                <div className="ts-group-head">
                  <div className="ts-group-left">
                    <span
                      className="ts-group-badge"
                      style={{ background: g.bg, color: g.color }}
                    >
                      {g.badge}
                    </span>
                    <h3 className="ts-group-title">{g.label}</h3>
                    <span className="ts-group-teacher">담임 {g.teacher}</span>
                  </div>
                  <span className="ts-group-count">{g.count}명</span>
                </div>
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th>학생</th>
                      <th>정답률</th>
                      <th>최근 학습</th>
                      <th>주간 학습</th>
                      <th>최다 오답</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.students.map((s) => (
                      <tr key={s.name}>
                        <td className="ts-cell-student">
                          <span className="ts-student">
                            <span className="ts-avatar" style={{ background: s.avatarBg }}>
                              {s.initial}
                            </span>
                            <span className="ts-student-info">
                              <b>{s.name}</b>
                              {s.code ? <span className="ts-student-code">{s.code}</span> : null}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="ts-acc" style={{ color: s.accColor }}>
                            {s.acc}
                          </span>
                        </td>
                        <td>{s.sessions}</td>
                        <td>{s.weekTime}</td>
                        <td>
                          <span className="ts-weak">{s.weak}</span>
                        </td>
                        <td>
                          <span className={'ts-tag ' + s.tagClass}>
                            <i className={s.tagIcon} />
                            {s.tag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        {groups.length === 0 && (
          <div className="ts-empty">
            <span className="ts-empty-icon">
              <i className="ph-fill ph-user-list" />
            </span>
            <h3 className="ts-empty-title">조건에 맞는 학생이 없어요</h3>
            <p className="ts-empty-text">필터를 바꾸거나 다른 이름으로 검색해 보세요.</p>
          </div>
        )}
      </main>
    </TeacherLayout>
  );
}
