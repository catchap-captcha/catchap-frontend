import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgClasses.css';

/** handoff `CatChap 학급학생관리.dc.html` 포팅 — 학급·학생 관리(조회 전용) */

interface OcClass {
  key: string;
  name: string;
  teacher: string;
  count: number;
  acc: number;
  risk: string;
  icon: string;
}

interface OcStudent {
  name: string;
  initial: string;
  age: number;
  cls: string;
  code: string;
  link: boolean;
  acc: number;
  risk: string;
  avatarBg: string;
}

// TODO(api): orgApi.classes 실패 시 원본 하드코딩 목록 유지
const FALLBACK_CLASSES: OcClass[] = [
  { key: '1-2', name: '1-2반', teacher: '이수진', count: 22, acc: 90, risk: '낮음', icon: 'ph-fill ph-number-circle-one' },
  { key: '1-3', name: '1-3반', teacher: '최유나', count: 25, acc: 84, risk: '주의', icon: 'ph-fill ph-number-circle-one' },
  { key: '2-1', name: '2-1반', teacher: '박민호', count: 24, acc: 92, risk: '낮음', icon: 'ph-fill ph-number-circle-two' },
  { key: '2-2', name: '2-2반', teacher: '한지원', count: 23, acc: 88, risk: '낮음', icon: 'ph-fill ph-number-circle-two' },
  { key: '3-1', name: '3-1반', teacher: '오세훈', count: 26, acc: 79, risk: '주의', icon: 'ph-fill ph-number-circle-three' },
  { key: '3-2', name: '3-2반', teacher: '정하늘', count: 27, acc: 95, risk: '낮음', icon: 'ph-fill ph-number-circle-three' },
  { key: '4-1', name: '4-1반', teacher: '김도현', count: 28, acc: 91, risk: '낮음', icon: 'ph-fill ph-number-circle-four' },
  { key: '5-2', name: '5-2반', teacher: '서다은', count: 29, acc: 86, risk: '낮음', icon: 'ph-fill ph-number-circle-five' },
  { key: '6-1', name: '6-1반', teacher: '장민석', count: 30, acc: 93, risk: '낮음', icon: 'ph-fill ph-number-circle-six' },
];

// TODO(api): orgApi.roster 실패 시 원본 하드코딩 명단 유지
const FALLBACK_ROSTER: OcStudent[] = [
  { name: '김하은', initial: '하', age: 7, cls: '1-2반', code: 'CAT-4823', link: true, acc: 96, risk: '낮음', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)' },
  { name: '박도윤', initial: '박', age: 7, cls: '1-2반', code: 'CAT-5119', link: true, acc: 62, risk: '주의', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)' },
  { name: '최서아', initial: '최', age: 6, cls: '1-3반', code: 'CAT-6042', link: false, acc: 81, risk: '주의', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
  { name: '김하람', initial: '람', age: 7, cls: '1-2반', code: 'CAT-6188', link: true, acc: 78, risk: '낮음', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)' },
  { name: '이준서', initial: '준', age: 8, cls: '3-2반', code: 'CAT-6205', link: true, acc: 93, risk: '낮음', avatarBg: 'linear-gradient(135deg,#33C892,#17B0A0)' },
  { name: '정유나', initial: '유', age: 7, cls: '2-1반', code: 'CAT-6317', link: false, acc: 88, risk: '낮음', avatarBg: 'linear-gradient(135deg,#FF93BE,#FF6DA6)' },
  { name: '강시우', initial: '시', age: 6, cls: '1-3반', code: 'CAT-6402', link: true, acc: 74, risk: '낮음', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)' },
  { name: '윤아린', initial: '아', age: 7, cls: '2-1반', code: 'CAT-6588', link: true, acc: 91, risk: '낮음', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
];

const AVATAR_PALETTE = [
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
  'linear-gradient(135deg,#8B6BFF,#B08AFF)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
  'linear-gradient(135deg,#33C892,#17B0A0)',
  'linear-gradient(135deg,#FF93BE,#FF6DA6)',
];

const GRADE_ICONS = ['one', 'two', 'three', 'four', 'five', 'six'];

const CARD_PALETTE = [
  { iconBg: '#FFF0EE', iconColor: '#FF5A4D' },
  { iconBg: '#E6F0FF', iconColor: '#2E7BFF' },
  { iconBg: '#FFF3D6', iconColor: '#F0A400' },
  { iconBg: '#E1F5EC', iconColor: '#17B08C' },
];

const ORG_CODE = 'HS-EDU-2041';
const PAGE = 4;

function accColor(a: number) {
  return a >= 90 ? '#17B08C' : a >= 75 ? '#2E7BFF' : '#F0A400';
}

function riskStyle(r: string) {
  return r === '낮음'
    ? { bg: '#E1F5EC', color: '#158A6E' }
    : r === '주의'
      ? { bg: '#FFF3D6', color: '#C98A00' }
      : { bg: '#FFE3E9', color: '#E0475E' };
}

type FilterType = 'all' | 'grade' | 'unlinked' | 'risk';

export default function OrgClasses() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;

  const [classList, setClassList] = useState<OcClass[]>(FALLBACK_CLASSES);
  const [rosterList, setRosterList] = useState<OcStudent[]>(FALLBACK_ROSTER);
  const [rosterTotal, setRosterTotal] = useState(248);
  // TODO(api): roster(class_count/teacher_count) 로딩 전·실패 시 원본 하드코딩 수치 유지
  const [classCount, setClassCount] = useState(12);
  const [teacherCount, setTeacherCount] = useState(16);
  const [orgCode, setOrgCode] = useState(ORG_CODE);
  const [cls, setCls] = useState('all');
  const [copied, setCopied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [gradeSel, setGradeSel] = useState<number[]>([1]);
  const [clsPage, setClsPage] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .classes(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.classes;
        if (!on || !Array.isArray(list) || list.length === 0) return;
        setClassList(
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          list.map((c: any): OcClass => {
            const key = String(c.key ?? c.name ?? '').replace('반', '');
            const grade = Number(c.grade) || parseInt(key, 10) || 1;
            return {
              key,
              name: c.name ?? `${key}반`,
              teacher: c.teacher ?? '',
              count: c.count ?? c.student_count ?? 0,
              acc: c.acc ?? c.accuracy ?? 0,
              risk: c.risk ?? '낮음',
              icon: `ph-fill ph-number-circle-${GRADE_ICONS[Math.min(6, Math.max(1, grade)) - 1]}`,
            };
          }),
        );
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_CLASSES 유지
      });
    orgApi
      .roster(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        // API 응답 형태: { total, shown, students: [...], org_join_code }
        const list = Array.isArray(res) ? res : res?.students ?? res?.roster;
        if (!on) return;
        if (typeof res?.total === 'number') setRosterTotal(res.total);
        if (typeof res?.class_count === 'number') setClassCount(res.class_count);
        if (typeof res?.teacher_count === 'number') setTeacherCount(res.teacher_count);
        if (typeof res?.org_join_code === 'string' && res.org_join_code) setOrgCode(res.org_join_code);
        if (!Array.isArray(list) || list.length === 0) return;
        setRosterList(
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          list.map((r: any, i: number): OcStudent => ({
            name: r.name ?? '',
            initial: r.initial ?? [...String(r.name ?? '')][0] ?? '',
            age: r.age ?? 0,
            cls: r.cls ?? r.class_name ?? '',
            code: r.code ?? r.student_code ?? '',
            link: !!(r.link ?? r.parent_linked),
            acc: r.acc ?? r.accuracy ?? 0,
            risk: r.risk ?? '낮음',
            avatarBg: r.avatarBg ?? AVATAR_PALETTE[i % AVATAR_PALETTE.length],
          })),
        );
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_ROSTER 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  const copyCode = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(orgCode);
    } catch {
      /* 원본과 동일하게 무시 */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const classesSrc = classList.filter((c) => gradeSel.length === 0 || gradeSel.includes(parseInt(c.key, 10)));
  const pageCount = Math.max(1, Math.ceil(classesSrc.length / PAGE));
  const page = Math.max(0, Math.min(clsPage, pageCount - 1));
  const classesPage = classesSrc.slice(page * PAGE, page * PAGE + PAGE);

  const roster = rosterList
    .filter((r) => cls === 'all' || r.cls === `${cls}반`)
    .filter((r) => {
      if (filterType === 'grade') return parseInt(r.cls, 10) === filterGrade;
      if (filterType === 'unlinked') return !r.link;
      if (filterType === 'risk') return r.risk !== '낮음';
      return true;
    });

  const activeClass = classList.find((c) => c.key === cls);
  const filterActive = filterType !== 'all';
  const filterLabel =
    filterType === 'grade'
      ? `${filterGrade}학년`
      : filterType === 'unlinked'
        ? '보호자 미연결'
        : filterType === 'risk'
          ? '위험 신호 높음'
          : '';

  const clearFilter = () => {
    setFilterType('all');
    setFilterGrade(null);
    setFilterOpen(false);
    setGradeOpen(false);
  };

  return (
    <OrgLayout active="classes" widget="none">
      {/* ORG CODE */}
      <div className="oc-codeBanner">
        <span className="oc-codeIcon">
          <i className="ph-fill ph-buildings" />
        </span>
        <div>
          <div className="oc-codeLabel">우리 기관 코드</div>
          <div className="oc-codeValue">{orgCode}</div>
        </div>
        <span className="oc-codeHint">학생·선생님이 회원가입할 때 입력하는 코드예요. 외부에 노출되지 않도록 주의해 주세요.</span>
        <button className="oc-copyBtn" onClick={copyCode}>
          <i className={copied ? 'ph-fill ph-check' : 'ph-fill ph-copy'} />
          {copied ? '복사됨' : '코드 복사'}
        </button>
      </div>

      {/* HEADER */}
      <div className="oc-header">
        <div>
          <h1 className="oc-title">학급 · 학생 관리</h1>
          <p className="oc-subtitle">
            {me?.organization_name || '햇살초등학교'} · {classCount}개 학급 · {rosterTotal}명 · 교사 {teacherCount}명
          </p>
        </div>
        <div className="oc-headerRight">
          <span className="oc-readonlyBadge">
            <i className="ph-fill ph-lock-simple" />조회 전용 · 학생 편집은 담당 선생님 권한
          </span>
          <button className="oc-exportBtn">
            <i className="ph-fill ph-export" />현황 내보내기
          </button>
        </div>
      </div>

      {/* GRADE FILTER */}
      <div className="oc-gradeFilter">
        <span className="oc-gradeFilterLabel">학년별 보기</span>
        <button
          className={gradeSel.length === 0 ? 'oc-chip oc-chipOn' : 'oc-chip'}
          onClick={() => {
            setGradeSel([]);
            setClsPage(0);
          }}
        >
          전체
        </button>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className={gradeSel.includes(n) ? 'oc-chip oc-chipOn' : 'oc-chip'}
            onClick={() => {
              setGradeSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
              setClsPage(0);
            }}
          >
            {n}학년
          </button>
        ))}
        {classesSrc.length > PAGE && (
          <div className="oc-clsPager">
            <span className="oc-clsPagerLabel">{page + 1} / {pageCount}</span>
            <button
              className={page === 0 ? 'oc-clsPagerBtn oc-clsPagerBtnOff' : 'oc-clsPagerBtn'}
              onClick={() => setClsPage(Math.max(0, page - 1))}
            >
              <i className="ph-bold ph-caret-left" />
            </button>
            <button
              className={page >= pageCount - 1 ? 'oc-clsPagerBtn oc-clsPagerBtnOff' : 'oc-clsPagerBtn'}
              onClick={() => setClsPage(Math.min(pageCount - 1, page + 1))}
            >
              <i className="ph-bold ph-caret-right" />
            </button>
          </div>
        )}
      </div>

      {/* CLASS CARDS */}
      <div className="oc-classGrid">
        {classesPage.map((c, i) => {
          const on = cls === c.key;
          const rs = riskStyle(c.risk);
          const pal = CARD_PALETTE[i % CARD_PALETTE.length];
          return (
            <button
              key={c.key}
              className={on ? 'oc-classCard oc-classCardOn' : 'oc-classCard'}
              onClick={() => setCls(on ? 'all' : c.key)}
            >
              <div className="oc-classCardHead">
                <span className="oc-classIcon" style={{ background: pal.iconBg, color: pal.iconColor }}>
                  <i className={c.icon} />
                </span>
                <span className="oc-riskBadge" style={{ background: rs.bg, color: rs.color }}>{c.risk}</span>
              </div>
              <div className="oc-className">{c.name}</div>
              <div className="oc-classTeacher">{c.teacher} · {c.count}명</div>
              <div className="oc-classAccRow">
                <span>정답률</span>
                <span style={{ color: accColor(c.acc) }}>{c.acc}%</span>
              </div>
              <div className="oc-classAccTrack">
                <div className="oc-classAccFill" style={{ width: `${c.acc}%`, background: accColor(c.acc) }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ROSTER */}
      <div className="oc-roster">
        <div className="oc-rosterHead">
          <div className="oc-rosterHeadLeft">
            <h3 className="oc-rosterTitle">{activeClass ? `${activeClass.name} 학생 명단` : '전체 학생 명단'}</h3>
            <span className="oc-rosterCount">{activeClass ? activeClass.count : rosterTotal}명</span>
            {filterActive && (
              <button className="oc-filterTag" onClick={clearFilter}>
                {filterLabel}
                <i className="ph-bold ph-x" />
              </button>
            )}
          </div>
          <div className="oc-rosterHeadRight">
            {/* 원본대로 검색 input은 미연동 */}
            <div className="oc-searchWrap">
              <i className="ph-bold ph-magnifying-glass oc-searchIcon" />
              <input className="oc-searchInput" placeholder="이름·코드 검색" />
            </div>
            <div className="oc-filterWrap">
              <button
                className={filterActive ? 'oc-filterBtn oc-filterBtnOn' : 'oc-filterBtn'}
                onClick={() => {
                  setFilterOpen((o) => !o);
                  setGradeOpen(false);
                }}
              >
                <i className="ph-fill ph-funnel" />필터
                {filterActive && <span className="oc-filterDot" />}
              </button>
              {filterOpen && (
                <>
                  <div
                    className="oc-popOverlay"
                    onClick={() => {
                      setFilterOpen(false);
                      setGradeOpen(false);
                    }}
                  />
                  <div className="oc-pop">
                    <button
                      className={
                        filterType === 'grade'
                          ? 'oc-popRow oc-popRowBetween oc-popRowOn'
                          : 'oc-popRow oc-popRowBetween'
                      }
                      onClick={() => setGradeOpen((g) => !g)}
                    >
                      <span className="oc-popRowLeft">
                        <i className="ph-fill ph-graduation-cap" style={{ fontSize: 16, color: '#2E7BFF' }} />학년별
                      </span>
                      <i
                        className={gradeOpen ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down'}
                        style={{ fontSize: 14, color: '#B7BBCB' }}
                      />
                    </button>
                    {gradeOpen && (
                      <div className="oc-popGradeGrid">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            className={
                              filterType === 'grade' && filterGrade === n
                                ? 'oc-popGradeBtn oc-popGradeBtnOn'
                                : 'oc-popGradeBtn'
                            }
                            onClick={() => {
                              setFilterType('grade');
                              setFilterGrade(n);
                              setFilterOpen(false);
                              setGradeOpen(false);
                            }}
                          >
                            {n}학년
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className={filterType === 'unlinked' ? 'oc-popRow oc-popRowOn' : 'oc-popRow'}
                      onClick={() => {
                        setFilterType('unlinked');
                        setFilterGrade(null);
                        setFilterOpen(false);
                        setGradeOpen(false);
                      }}
                    >
                      <i className="ph-fill ph-link-break" style={{ fontSize: 16, color: '#F0A400' }} />보호자 미연결 학생만
                    </button>
                    <button
                      className={filterType === 'risk' ? 'oc-popRow oc-popRowOn' : 'oc-popRow'}
                      onClick={() => {
                        setFilterType('risk');
                        setFilterGrade(null);
                        setFilterOpen(false);
                        setGradeOpen(false);
                      }}
                    >
                      <i className="ph-fill ph-warning" style={{ fontSize: 16, color: '#E0475E' }} />위험 신호가 높은 학생
                    </button>
                    <div className="oc-popDivider" />
                    <button className="oc-popReset" onClick={clearFilter}>
                      <i className="ph-bold ph-arrows-counter-clockwise" />전체 보기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <table className="oc-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>학급</th>
              <th>학생 코드</th>
              <th>보호자 연결</th>
              <th>정답률</th>
              <th>위험 신호</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => {
              const rs = riskStyle(r.risk);
              return (
                <tr key={r.code}>
                  <td>
                    <div className="oc-student">
                      <span className="oc-avatar" style={{ background: r.avatarBg }}>{r.initial}</span>
                      <div>
                        <div className="oc-studentName">{r.name}</div>
                        <div className="oc-studentAge">{r.age}세</div>
                      </div>
                    </div>
                  </td>
                  <td className="oc-cellCls">{r.cls}</td>
                  <td className="oc-cellCode">{r.code}</td>
                  <td>
                    <span className={r.link ? 'oc-linkBadge oc-linkOn' : 'oc-linkBadge oc-linkOff'}>
                      <i className={r.link ? 'ph-fill ph-link' : 'ph-fill ph-link-break'} />
                      {r.link ? '연결됨' : '미연결'}
                    </span>
                  </td>
                  <td>
                    <span className="oc-cellAcc" style={{ color: accColor(r.acc) }}>{r.acc}%</span>
                  </td>
                  <td>
                    <span className="oc-riskBadge" style={{ background: rs.bg, color: rs.color }}>{r.risk}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="oc-rosterFoot">
          <span className="oc-rosterFootNote">
            {activeClass ? activeClass.count : rosterTotal}명 중 {roster.length}명 표시 · 개인정보는 가명 처리되어 표시됩니다
          </span>
          {/* 원본대로 정적 1/2 페이지네이션 */}
          <div className="oc-pageBtns">
            <button className="oc-pageArrow">
              <i className="ph-bold ph-caret-left" />
            </button>
            <button className="oc-pageNum oc-pageNumOn">1</button>
            <button className="oc-pageNum">2</button>
            <button className="oc-pageArrow">
              <i className="ph-bold ph-caret-right" />
            </button>
          </div>
        </div>
      </div>
    </OrgLayout>
  );
}
