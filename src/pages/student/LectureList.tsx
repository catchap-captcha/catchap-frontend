import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { lectureApi, type LectureItem } from '../../api/lectures';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import { StudentNav } from '../../layouts/StudentLayout';
import { LECTURE_SUBJECTS, LECTURE_SUBJECT_ORDER } from './lectureSubjects';
import './Concepts.css'; // 개념 설명과 같은 카탈로그 디자인(cp-*)을 그대로 재사용
import './LectureList.css';

/** 과목별 기본 노출 개수 — 그 이상은 '더보기' 카드로 접는다(목업 동일) */
const VISIBLE_PER_SUBJECT = 5;

type WatchState = 'new' | 'watching' | 'done';

function watchState(l: LectureItem): WatchState {
  if (l.progress?.status === 'done') return 'done';
  if ((l.progress?.watched_max_sec ?? 0) > 0) return 'watching';
  return 'new';
}

export default function LectureList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<string>(() => {
    const t = searchParams.get('subject');
    if (t && LECTURE_SUBJECTS[t]) return t;
    return '전체';
  });
  const [rows, setRows] = useState<LectureItem[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = () => {
    setState('loading');
    lectureApi
      .list()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error')); // 실패를 빈 목록처럼 보이지 않게 — 에러 상태로 정직 노출
  };
  useEffect(load, []);

  const grouped = useMemo(() => {
    const g: Record<string, LectureItem[]> = {};
    (rows ?? []).forEach((l) => {
      (g[l.subject] = g[l.subject] ?? []).push(l);
    });
    return g;
  }, [rows]);

  const total = rows?.length ?? 0;
  const watched = (rows ?? []).filter((l) => watchState(l) === 'done').length;

  const tabDefs = [{ key: '전체', icon: 'ph-fill ph-squares-four' }].concat(
    LECTURE_SUBJECT_ORDER.map((sub) => ({ key: sub, icon: LECTURE_SUBJECTS[sub].icon })),
  );
  const visibleSubjects = tab === '전체' ? LECTURE_SUBJECT_ORDER : [tab];

  const goWatch = (id: string) => navigate(PATHS.STUDENT_LECTURE, { state: { id } });

  return (
    <div className="cp-root">
      <StudentNav />

      <div className="cp-container">
        {/* HEADER — 개념 설명 히어로와 동일 골격 */}
        <section className="cp-herosec">
          <div className="cp-hero">
            <div className="cp-herocircle" />
            <div className="cp-heroleft">
              <span className="cp-herobadge">
                <i className="ph-fill ph-video-camera" />
                오늘의 강의
              </span>
              <h1 className="cp-herotitle">오늘의 강의를 편하게 들어봐요 📺</h1>
              <p className="cp-herodesc">
                각 과목의 핵심 개념을 냥냥이 선생님 인강으로 쉽고 편하게 배워요. 하루 한 편이면
                충분해요.
              </p>
              <div className="cp-heroprog">
                <span className="cp-heroprogicon">
                  <i className="ph-fill ph-check-circle" />
                </span>
                <span className="cp-heroprogtext">
                  {state === 'ready' ? (
                    <>
                      {total}편 중 <span className="cp-heroprognum">{watched}편</span> 봤어요
                    </>
                  ) : state === 'loading' ? (
                    '내 시청 기록을 불러오는 중…'
                  ) : (
                    '시청 기록을 불러오지 못했어요'
                  )}
                </span>
              </div>
            </div>
            <div className="cp-heroright">
              <div className="cp-herobubble">
                오늘은 이 강의부터
                <br />
                들어볼까요?
                <div className="cp-herobubbletail" />
              </div>
              <img src={mascot} alt="냥냥이" className="cp-heromascot" />
            </div>
          </div>
        </section>

        {/* SUBJECT FILTER TABS */}
        <section className="cp-tabssec">
          <div className="cp-tabsrow">
            {tabDefs.map((t) => {
              const active = tab === t.key;
              const c = t.key === '전체' ? '#FF5A4D' : LECTURE_SUBJECTS[t.key].color;
              return (
                <button
                  key={t.key}
                  className={`cp-tab${active ? ' cp-tab-on' : ''}`}
                  style={{ '--cp-c': c } as CSSProperties}
                  onClick={() => setTab(t.key)}
                >
                  <i className={t.icon} />
                  {t.key}
                </button>
              );
            })}
          </div>
        </section>

        {state === 'loading' && (
          <div className="ll-state">
            <i className="ph-fill ph-hourglass-medium" />
            강의 목록을 불러오고 있어요…
          </div>
        )}
        {state === 'error' && (
          <div className="ll-state ll-state-err">
            <i className="ph-fill ph-warning-circle" />
            강의 목록을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.
            <button className="ll-retry" onClick={load}>
              다시 불러오기
            </button>
          </div>
        )}

        {state === 'ready' &&
          visibleSubjects.map((sub) => {
            const s = LECTURE_SUBJECTS[sub];
            const items = grouped[sub] ?? [];
            if (items.length === 0 && tab === '전체') return null; // 전체 탭에선 빈 과목 생략
            const showAll = !!expanded[sub];
            const shown = showAll ? items : items.slice(0, VISIBLE_PER_SUBJECT);
            const hidden = items.length - shown.length;
            return (
              <section key={sub} className="cp-section">
                <div className="cp-sechead">
                  <span className="cp-secicon" style={{ background: s.soft, color: s.color }}>
                    <i className={s.icon} />
                  </span>
                  <div>
                    <h2 className="cp-sectitle">{sub}</h2>
                    <p className="cp-secsub">{items.length}강 구성의 강의</p>
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="ll-state">
                    <i className="ph-fill ph-video-camera-slash" />
                    아직 등록된 {sub} 강의가 없어요. 조금만 기다려 주세요!
                  </div>
                ) : (
                  <div className="cp-grid">
                    {shown.map((l, i) => {
                      const st = watchState(l);
                      const num = l.order_no > 0 ? l.order_no : i + 1;
                      return (
                        <div key={l.id} className="cp-card" onClick={() => goWatch(l.id)}>
                          <div className="cp-cardband" style={{ background: s.band }}>
                            <span className="cp-cardbandicon" style={{ color: s.color }}>
                              <i className={s.icon} />
                            </span>
                            {st === 'done' ? (
                              <span className="cp-cardbadge cp-cardbadge-read">봤어요</span>
                            ) : st === 'watching' ? (
                              <span className="cp-cardbadge ll-badge-watching">학습중</span>
                            ) : (
                              <span
                                className="cp-cardbadge"
                                style={{ background: '#fff', color: s.color, boxShadow: `0 6px 12px -6px ${s.color}` }}
                              >
                                새 강의
                              </span>
                            )}
                          </div>
                          <div className="cp-cardbody">
                            <div className="cp-cardchiprow">
                              <span className="cp-cardchip" style={{ color: s.color, background: s.soft }}>
                                {num}강
                              </span>
                            </div>
                            <div className="cp-cardname">{l.title}</div>
                            <p className="cp-cardsummary">
                              {l.description || `${sub} 개념을 배우는 강의예요.`}
                            </p>
                            <div className="cp-cardfoot">
                              <span
                                className="cp-cardstatus"
                                style={{ color: st === 'done' ? '#17B08C' : s.color }}
                              >
                                <i
                                  className={
                                    st === 'done'
                                      ? 'ph-fill ph-check-circle'
                                      : st === 'watching'
                                        ? 'ph-fill ph-play-circle'
                                        : 'ph-fill ph-sparkle'
                                  }
                                />
                                {st === 'done' ? '다시 보기' : st === 'watching' ? '이어서 보기' : '새 강의'}
                              </span>
                              <button
                                className="cp-quizbtn"
                                style={{ background: s.color }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  goWatch(l.id);
                                }}
                              >
                                인강 보기
                                <i className="ph-bold ph-arrow-right" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {hidden > 0 && (
                      <button
                        className="ll-more"
                        style={{ '--ll-c': s.color } as CSSProperties}
                        onClick={() => setExpanded((prev) => ({ ...prev, [sub]: true }))}
                      >
                        <span className="ll-more-icon">
                          <i className="ph-bold ph-caret-down" />
                        </span>
                        <span className="ll-more-title">더보기</span>
                        <span className="ll-more-sub">강의 {hidden}개 더 있어요</span>
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
      </div>

      <ScreenTimeReminder />
    </div>
  );
}
