import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import { dateSuffix, downloadCSV } from '../../utils/download';
import { tableToPdf } from '../../utils/pdf';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgClasses.css';

/** handoff `CatChap 학급학생관리.dc.html` 포팅 — 학급·학생 관리(조회 전용) */

interface OcClass {
  id?: string;
  key: string;
  name: string;
  teacher: string;
  assistant?: string | null;
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

  const [classList, setClassList] = useState<OcClass[]>([]);
  const [rosterList, setRosterList] = useState<OcStudent[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [orgCode, setOrgCode] = useState('');
  const [cls, setCls] = useState('all');
  const [copied, setCopied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [gradeSel, setGradeSel] = useState<number[]>([1]);
  const [clsPage, setClsPage] = useState(0);
  // 새 반 만들기 (교장=전 학년, 학년부장=담당 학년 고정)
  const isGradeHead = me?.role === 'grade_head';
  const isPrincipal = me?.role === 'org_admin'; // 코드 재발급은 교장 전용
  const lockedGrade = isGradeHead ? me?.managed_grade ?? 1 : null;
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [newClass, setNewClass] = useState<{ grade: number; ban: number } | null>(null);
  const [dissolveTarget, setDissolveTarget] = useState<OcClass | null>(null);
  const [dissolveBlocked, setDissolveBlocked] = useState<{ name: string; count: number } | null>(null);
  const [toast, setToast] = useState('');

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const openNewClass = () => setNewClass({ grade: lockedGrade ?? 1, ban: 1 });

  const submitNewClass = () => {
    if (!newClass) return;
    const name = `${newClass.grade}-${newClass.ban}반`;
    if (classList.some((c) => c.name === name)) {
      flashToast('이미 있는 반 이름이에요.');
      return;
    }
    setNewClass(null);
    if (!orgId) {
      flashToast(`${name}을(를) 만들었어요.`);
      return;
    }
    orgApi
      .createClass(orgId, name)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const c = res?.class;
        const grade = Number(c?.grade) || newClass.grade;
        setClassList((list) => [
          {
            id: c?.id,
            key: `${grade}-${newClass.ban}`,
            name: c?.name ?? name,
            teacher: '미배정',
            count: 0,
            acc: 0,
            risk: '낮음',
            icon: `ph-fill ph-number-circle-${GRADE_ICONS[Math.min(6, Math.max(1, grade)) - 1]}`,
          },
          ...list,
        ]);
        flashToast(`${name}을(를) 만들었어요.`);
      })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .catch((err: any) => {
        const msg = err?.response?.status === 409 ? '이미 있는 반 이름이에요.' : '반 만들기에 실패했어요.';
        flashToast(msg);
      });
  };

  const confirmDissolve = () => {
    const c = dissolveTarget;
    if (!c) return;
    setDissolveTarget(null);
    const removeLocal = () => {
      setClassList((list) => list.filter((x) => x !== c));
      setCls('all');
    };
    if (!orgId || !c.id) {
      // 데모(로컬) — 학생 있으면 차단, 없으면 해체
      if ((c.count ?? 0) > 0) {
        setDissolveBlocked({ name: c.name, count: c.count });
        return;
      }
      removeLocal();
      flashToast(`${c.name}을(를) 해체했어요.`);
      return;
    }
    orgApi
      .dissolveClass(orgId, c.id)
      .then(() => {
        removeLocal();
        flashToast(`${c.name}을(를) 해체했어요.`);
      })
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .catch((err: any) => {
        if (err?.response?.status === 409) {
          const raw = err.response?.data?.detail ?? {};
          const detail = typeof raw === 'string' ? { message: raw } : raw;
          setDissolveBlocked({ name: detail.cls ?? c.name, count: detail.count ?? c.count ?? 0 });
          return;
        }
        flashToast('반 해체에 실패했어요.');
      });
  };

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .classes(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.classes;
        if (!on || !Array.isArray(list)) return;
        setClassList(
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          list.map((c: any): OcClass => {
            const key = String(c.key ?? c.name ?? '').replace('반', '');
            const grade = Number(c.grade) || parseInt(key, 10) || 1;
            return {
              id: c.id,
              key,
              name: c.name ?? `${key}반`,
              teacher: c.teacher ?? '',
              assistant: c.assistant ?? null,
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
        if (!Array.isArray(list)) return;
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

  const doRotateCode = () => {
    setRotateConfirm(false);
    if (!orgId) {
      flashToast('데모에서는 코드가 실제로 바뀌지 않아요.');
      return;
    }
    orgApi
      .rotateCode(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (res?.code) setOrgCode(res.code);
        flashToast('새 기관 코드를 발급했어요. 이전 코드는 더 이상 쓸 수 없어요.');
      })
      .catch(() => flashToast('코드 재발급에 실패했어요.'));
  };

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
        {isPrincipal && (
          <button className="oc-rotateBtn" onClick={() => setRotateConfirm(true)}>
            <i className="ph-fill ph-arrows-clockwise" />재발급
          </button>
        )}
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
            {me?.organization_name || ''} · {classCount}개 학급 · {rosterTotal}명 · 교사 {teacherCount}명
          </p>
        </div>
        <div className="oc-headerRight">
          <span className="oc-readonlyBadge">
            <i className="ph-fill ph-lock-simple" />학생 편집은 담당 선생님 권한
          </span>
          <button className="oc-newClassBtn" onClick={openNewClass}>
            <i className="ph-fill ph-plus-circle" />새 반 만들기
          </button>
          {(() => {
            // 학급 현황 + 학생 명단 (화면 실데이터 그대로 — CSV/PDF 공용)
            const exportRows = [
              ['[학급 현황]'],
              ['반', '담임', '보조', '학생 수', '정답률(%)', '위험 신호'],
              ...classList.map((c) => [c.name, c.teacher, c.assistant ?? '', c.count, c.acc, c.risk]),
              [],
              ['[학생 명단]'],
              ['이름', '나이', '학급', '학생 코드', '보호자 연결', '정답률(%)', '위험 신호'],
              ...rosterList.map((r) => [r.name, r.age, r.cls, r.code, r.link ? '연결됨' : '미연결', r.acc, r.risk]),
            ];
            return (
              <>
                <button
                  className="oc-exportBtn"
                  onClick={() => {
                    downloadCSV(`학급학생현황_${dateSuffix()}.csv`, exportRows);
                    flashToast('학급·학생 현황 CSV를 저장했어요.');
                  }}
                >
                  <i className="ph-fill ph-export" />CSV
                </button>
                <button
                  className="oc-exportBtn"
                  onClick={() => {
                    // 성공 토스트는 실제 저장 후에만 — 실패를 성공처럼 보이지 않게(가짜 성공 금지)
                    tableToPdf(`학급학생현황_${dateSuffix()}.pdf`, '학급 · 학생 현황', exportRows).then(
                      () => flashToast('학급·학생 현황 PDF를 저장했어요.'),
                      () => flashToast('PDF 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'),
                    );
                  }}
                >
                  <i className="ph-fill ph-file-pdf" />PDF
                </button>
              </>
            );
          })()}
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
              {c.assistant && (
                <div className="oc-classAssistant">
                  <i className="ph-fill ph-user-switch" />보조 {c.assistant}
                </div>
              )}
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
        {classesPage.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
            아직 학급이 없어요. ‘새 반 만들기’로 학급을 추가해 보세요.
          </div>
        )}
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
            {activeClass && (
              <button
                className="oc-dissolveBtn"
                title={`${activeClass.name} 해체`}
                onClick={() => setDissolveTarget(activeClass)}
              >
                <i className="ph-fill ph-trash" />반 해체
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
        {roster.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
            아직 등록된 학생이 없어요.
          </div>
        )}
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

      {/* 새 반 만들기 모달 */}
      {newClass && (
        <div className="oc-ncOverlay" onClick={() => setNewClass(null)}>
          <div className="oc-ncModal" onClick={(e) => e.stopPropagation()}>
            <div className="oc-ncHead">
              <span className="oc-ncHeadIcon">
                <i className="ph-fill ph-chalkboard" />
              </span>
              <div>
                <div className="oc-ncTitle">새 반 만들기</div>
                <div className="oc-ncSub">
                  {isGradeHead ? `${lockedGrade}학년 안에서 새 반을 추가해요` : '학년과 반 번호를 골라 새 반을 추가해요'}
                </div>
              </div>
              <button className="oc-ncClose" onClick={() => setNewClass(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="oc-ncBody">
              <div className="oc-ncRow">
                <div className="oc-ncField">
                  <label className="oc-ncLabel">학년</label>
                  <div className="oc-ncSelectWrap">
                    <select
                      className="oc-ncSelect"
                      value={String(newClass.grade)}
                      disabled={isGradeHead}
                      onChange={(e) => setNewClass((n) => (n ? { ...n, grade: +e.target.value } : n))}
                    >
                      {[1, 2, 3, 4, 5, 6].map((g) => (
                        <option key={g} value={String(g)}>{g}학년</option>
                      ))}
                    </select>
                    <i className="ph-bold ph-caret-down oc-ncCaret" />
                  </div>
                </div>
                <div className="oc-ncField">
                  <label className="oc-ncLabel">반</label>
                  <div className="oc-ncSelectWrap">
                    <select
                      className="oc-ncSelect"
                      value={String(newClass.ban)}
                      onChange={(e) => setNewClass((n) => (n ? { ...n, ban: +e.target.value } : n))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => (
                        <option key={b} value={String(b)}>{b}반</option>
                      ))}
                    </select>
                    <i className="ph-bold ph-caret-down oc-ncCaret" />
                  </div>
                </div>
              </div>
              <div className="oc-ncPreview">
                만들 반: <b>{newClass.grade}-{newClass.ban}반</b>
              </div>
              {isGradeHead && (
                <div className="oc-ncInfo">
                  <i className="ph-fill ph-info" />
                  <span>학년부장은 담당 학년({lockedGrade}학년) 반만 만들 수 있어요.</span>
                </div>
              )}
              <div className="oc-ncBtns">
                <button className="oc-ncCancel" onClick={() => setNewClass(null)}>취소</button>
                <button className="oc-ncSave" onClick={submitNewClass}>
                  <i className="ph-fill ph-check" />만들기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 반 해체 확인 모달 */}
      {dissolveTarget && (
        <div className="oc-ncOverlay" onClick={() => setDissolveTarget(null)}>
          <div className="oc-ncModal" onClick={(e) => e.stopPropagation()}>
            <div className="oc-ncHead oc-ncHeadDanger">
              <span className="oc-ncHeadIcon">
                <i className="ph-fill ph-warning" />
              </span>
              <div>
                <div className="oc-ncTitle">{dissolveTarget.name} 해체</div>
                <div className="oc-ncSub">학년말 반 정리 — 되돌리려면 같은 이름으로 다시 만들면 돼요</div>
              </div>
              <button className="oc-ncClose" onClick={() => setDissolveTarget(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="oc-ncBody">
              <p className="oc-ncPreview">
                <b>{dissolveTarget.name}</b>을(를) 해체할까요? 담임 연결이 풀리고 목록에서 사라져요.
              </p>
              <div className="oc-ncInfo">
                <i className="ph-fill ph-info" />
                <span>학생이 남아 있으면 해체할 수 없어요. 먼저 담당 선생님이 학생을 다른 반으로 옮겨 주세요.</span>
              </div>
              <div className="oc-ncBtns">
                <button className="oc-ncCancel" onClick={() => setDissolveTarget(null)}>취소</button>
                <button className="oc-ncSave oc-ncSaveDanger" onClick={confirmDissolve}>
                  <i className="ph-fill ph-trash" />해체하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 해체 차단 (학생 남음) */}
      {dissolveBlocked && (
        <div className="oc-ncOverlay" onClick={() => setDissolveBlocked(null)}>
          <div className="oc-ncModal" onClick={(e) => e.stopPropagation()}>
            <div className="oc-ncHead oc-ncHeadDanger">
              <span className="oc-ncHeadIcon">
                <i className="ph-fill ph-users-three" />
              </span>
              <div>
                <div className="oc-ncTitle">해체할 수 없어요</div>
                <div className="oc-ncSub">아직 학생이 남아 있는 반이에요</div>
              </div>
            </div>
            <div className="oc-ncBody">
              <p className="oc-ncPreview">
                <b>{dissolveBlocked.name}</b>에 <b>학생 {dissolveBlocked.count}명</b>이 남아 있어요. 먼저 학생을 다른 반으로 옮기거나 뺀 뒤 해체해 주세요.
              </p>
              <div className="oc-ncBtns">
                <button className="oc-ncSave" onClick={() => setDissolveBlocked(null)}>알겠어요</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기관 코드 재발급 확인 모달 (교장 전용) */}
      {rotateConfirm && (
        <div className="oc-ncOverlay" onClick={() => setRotateConfirm(false)}>
          <div className="oc-ncModal" onClick={(e) => e.stopPropagation()}>
            <div className="oc-ncHead">
              <span className="oc-ncHeadIcon">
                <i className="ph-fill ph-arrows-clockwise" />
              </span>
              <div>
                <div className="oc-ncTitle">기관 코드 재발급</div>
                <div className="oc-ncSub">새 코드를 만들고 만료일을 1년 연장해요</div>
              </div>
              <button className="oc-ncClose" onClick={() => setRotateConfirm(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="oc-ncBody">
              <p className="oc-ncPreview">
                지금 코드 <b>{orgCode}</b>는 <b>즉시 무효</b>가 되고 새 코드가 발급돼요.
              </p>
              <div className="oc-ncInfo">
                <i className="ph-fill ph-warning" />
                <span>이미 가입한 학생·선생님은 영향 없지만, <b>새로 가입할 사람</b>에게는 새 코드를 알려줘야 해요. 학년이 바뀌는 새 학기에 한 번씩 바꾸는 걸 권장해요.</span>
              </div>
              <div className="oc-ncBtns">
                <button className="oc-ncCancel" onClick={() => setRotateConfirm(false)}>취소</button>
                <button className="oc-ncSave" onClick={doRotateCode}>
                  <i className="ph-fill ph-arrows-clockwise" />재발급하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="oc-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </OrgLayout>
  );
}
