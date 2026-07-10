import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { studentApi } from '../../api/students';
import { dateSuffix, downloadCanvasPng } from '../../utils/download';
import { canvasToPdf } from '../../utils/pdf';
import { drawCertificate } from '../../utils/certificate';
import { RANKING_ENABLED } from '../../config/features';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './Badges.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterKey = 'all' | 'earned' | 'locked';

interface BadgeItem {
  name: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  earned?: boolean;
  locked?: boolean;
  foot: string;
}

// TODO(api): studentApi.badges() 실패 시 원본 하드코딩 데이터 유지
const FALLBACK: BadgeItem[] = [
  { name: '첫 걸음', desc: '첫 학습을 완료했어요', icon: 'ph-fill ph-sneaker-move', color: '#FF5A6E', bg: '#FFE3E9', earned: true, foot: '6월 12일 획득' },
  { name: '매의 눈', desc: '그림 찾기 정답률 85%', icon: 'ph-fill ph-eye', color: '#2E7BFF', bg: '#E6F0FF', earned: true, foot: '오늘 획득' },
  { name: '한글 박사', desc: '낱말 50개 맞히기', icon: 'ph-fill ph-text-aa', color: '#FF922E', bg: '#FFEDE0', earned: true, foot: '6월 28일 획득' },
  { name: '계산 왕', desc: '숫자 놀이터 30문제', icon: 'ph-fill ph-plus-minus', color: '#17B08C', bg: '#DFF6ED', earned: true, foot: '6월 25일 획득' },
  { name: '드래그 마스터', desc: '끌어놓기 100% 달성', icon: 'ph-fill ph-hand-grabbing', color: '#33C892', bg: '#DFF6ED', earned: true, foot: '6월 30일 획득' },
  { name: '꾸준왕', desc: '7일 연속 학습', icon: 'ph-fill ph-calendar-check', color: '#8B6BFF', bg: '#EDE6FF', earned: true, foot: '6월 20일 획득' },
  { name: '하트 부자', desc: '하트 잃지 않고 클리어', icon: 'ph-fill ph-heart', color: '#FF5A6E', bg: '#FFE3E9', earned: true, foot: '6월 22일 획득' },
  { name: '별 수집가', desc: '별 500개 모으기', icon: 'ph-fill ph-star', color: '#F0A400', bg: '#FFF3D6', earned: true, foot: '어제 획득' },
  { name: '불꽃 학습왕', desc: '14일 연속 학습', icon: 'ph-fill ph-fire', color: '#FF922E', bg: '#FFEDE0', locked: true, foot: '12/14일' },
  { name: '안전 지킴이', desc: '생활 안전 전부 완료', icon: 'ph-fill ph-shield-check', color: '#8B6BFF', bg: '#EDE6FF', locked: true, foot: '0/4 단계' },
  { name: '미로 탐험가', desc: '냥이 미로 클리어', icon: 'ph-fill ph-path', color: '#FF6DA6', bg: '#FFE9F1', locked: true, foot: '곧 열려요' },
  { name: '완벽주의자', desc: '정답률 100% 5번', icon: 'ph-fill ph-crown-simple', color: '#F0A400', bg: '#FFF3D6', locked: true, foot: '2/5 회' },
];

/** 배지 색 → 아이콘 배경(soft) 색. API는 color만 주고 bg는 주지 않아 디자인 페어링으로 파생한다. */
const COLOR_BG: Record<string, string> = {
  '#FF5A6E': '#FFE3E9',
  '#2E7BFF': '#E6F0FF',
  '#FF922E': '#FFEDE0',
  '#17B08C': '#DFF6ED',
  '#33C892': '#DFF6ED',
  '#8B6BFF': '#EDE6FF',
  '#F0A400': '#FFF3D6',
  '#FF6DA6': '#FFE9F1',
};

/** 히어로(최근 획득 배지) / 다음 배지 카드 데이터 — API recent/next 필드 매핑 */
interface HeroBadge {
  title: string;
  desc: string;
  icon: string;
  color: string;
}

interface NextBadge {
  name: string;
  desc: string;
  icon: string;
  chip: string;
  remain: string | null;
  current: number | null;
  total: number | null;
  progress: number;
}

// API 실패 시 원본 하드코딩 히어로/다음 배지 유지
const FALLBACK_HERO: HeroBadge = {
  title: '매의 눈 🦅',
  desc: '그림 찾기 퀴즈에서 정답률 85%를 넘겼어요. 정말 날카로운 눈이네요!',
  icon: 'ph-fill ph-eye',
  color: '#2E7BFF',
};

const FALLBACK_NEXT: NextBadge = {
  name: '불꽃 학습왕',
  desc: '14일 연속 학습',
  icon: 'ph-fill ph-fire',
  chip: '거의 다 왔어요!',
  remain: '2일',
  current: 12,
  total: 14,
  progress: 12 / 14,
};

/**
 * GET /students/me/badges 응답 → BadgeItem[] 매핑.
 * 실제 응답 형태: { badges: [{ id, name, desc, icon, color, earned, locked, progress(0..1), foot }],
 *                 earned: n, locked: n, level, recent{name,title,desc,icon,color,foot},
 *                 next{name,desc,icon,color,progress,foot,chip,current,total,unit,remain} }
 * bg는 color에서 파생한다.
 */
function mapBadges(d: any): BadgeItem[] | null {
  const list = Array.isArray(d) ? d : Array.isArray(d.badges) ? d.badges : null;
  if (!list) return null;
  const valid = list.filter((b: any) => b && typeof b.name === 'string' && typeof b.icon === 'string');
  if (!valid.length) return null;
  return valid.map((b: any): BadgeItem => {
    const color = typeof b.color === 'string' ? b.color : '#F0A400';
    return {
      name: b.name,
      desc: b.desc ?? '',
      icon: b.icon,
      color,
      bg: typeof b.bg === 'string' ? b.bg : (COLOR_BG[color.toUpperCase()] ?? `${color}1F`),
      earned: !!b.earned,
      locked: !!b.locked,
      foot: b.foot ?? '',
    };
  });
}

export default function Badges() {
  const { me } = useAuth();
  const [badges, setBadges] = useState<BadgeItem[]>(FALLBACK);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [hero, setHero] = useState<HeroBadge>(FALLBACK_HERO);
  const [next, setNext] = useState<NextBadge>(FALLBACK_NEXT);
  const [level, setLevel] = useState<number>(7);
  // 상장 (학년 랭킹 상위 3위 · 개근상) — 다운로드 가능
  const [awards, setAwards] = useState<any[]>([]);
  // 랭킹 비활성('준비중') 동안엔 랭킹(rank) 상장은 숨기고 개근상(attendance)만 노출한다.
  const shownAwards = RANKING_ENABLED ? awards : awards.filter((a: any) => a.type !== 'rank');
  const [awardMeta, setAwardMeta] = useState<{ nickname: string; streak: number; target: number }>({
    nickname: '',
    streak: 0,
    target: 30,
  });

  useEffect(() => {
    let mounted = true;
    studentApi
      .awards()
      .then((d: any) => {
        if (!mounted || !d) return;
        if (Array.isArray(d.awards)) setAwards(d.awards);
        setAwardMeta({
          nickname: d.nickname ?? '',
          streak: Number(d.streak_days) || 0,
          target: Number(d.attendance_target) || 30,
        });
      })
      .catch(() => {});
    studentApi
      .badges()
      .then((d: any) => {
        if (!mounted || !d) return;
        const mapped = mapBadges(d);
        if (mapped) setBadges(mapped);
        if (typeof d.level === 'number') setLevel(d.level);
        // 히어로: 가장 최근 획득 배지 (earned_at 실데이터)
        const r = d.recent;
        if (r && typeof r.name === 'string') {
          setHero({
            title: typeof r.title === 'string' && r.title ? r.title : r.name,
            desc: r.desc ?? '',
            icon: typeof r.icon === 'string' ? r.icon : FALLBACK_HERO.icon,
            color: typeof r.color === 'string' ? r.color : FALLBACK_HERO.color,
          });
        }
        // 다음 배지: progress 최고 미획득 배지
        const n = d.next;
        if (n && typeof n.name === 'string') {
          setNext({
            name: n.name,
            desc: n.desc ?? '',
            icon: typeof n.icon === 'string' ? n.icon : FALLBACK_NEXT.icon,
            chip: typeof n.chip === 'string' && n.chip ? n.chip : FALLBACK_NEXT.chip,
            remain: typeof n.remain === 'string' ? n.remain : null,
            current: typeof n.current === 'number' ? n.current : null,
            total: typeof n.total === 'number' ? n.total : null,
            progress: typeof n.progress === 'number' ? n.progress : 0,
          });
        }
      })
      .catch(() => {
        // TODO(api): 백엔드 미구현/실패 시 FALLBACK 유지
      });
    return () => {
      mounted = false;
    };
  }, []);

  const name = (me?.name ?? '하은').trim() || '하은';

  const earnedCount = badges.filter((b) => !b.locked).length;
  const lockedCount = badges.filter((b) => !!b.locked).length;
  const chips: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'earned', label: `획득 (${earnedCount})` },
    { key: 'locked', label: `도전 중 (${lockedCount})` },
  ];

  const visible = badges.filter((b) => filter === 'all' || (filter === 'earned' ? !!b.earned : !!b.locked));

  return (
    <div className="bd-root">
      {/* NAV — 원본 배지 NAV(1160px, 알림 버튼 없음)라 학습 홈 공용 NAV와 구조가 달라 자체 구현 */}
      <div className="bd-navbar">
        <div className="bd-navinner">
          <Link to={PATHS.STUDENT_HOME} className="bd-logo">
            <img src={mascot} alt="CatChap" className="bd-logoimg" />
            <div className="bd-logotext">
              <span className="bd-logotitle">CatChap</span>
              <span className="bd-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="bd-menu">
            <Link to={PATHS.STUDENT_HOME} className="bd-navlink">
              홈
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="bd-navlink">
              전체 학습
            </Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="bd-navlink">
              개념 설명
            </Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="bd-navlink">
              AI 선생님
            </Link>
            <Link to={PATHS.STUDENT_RECORDS} className="bd-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="bd-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="bd-iconbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="bd-profile">
              <div className="bd-avatar">{name.charAt(0)}</div>
              <span className="bd-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* HERO SHOWCASE */}
      <section className="bd-section bd-herowrap">
        <div className="bd-hero">
          <div className="bd-herocircle1" />
          <div className="bd-herocircle2" />
          <div className="bd-heroiconwrap">
            <div className="bd-heroicon">
              <i className={hero.icon} style={{ color: hero.color }} />
            </div>
          </div>
          <div className="bd-herobody">
            <span className="bd-herochip">
              <i className="ph-fill ph-sparkle" />
              가장 최근에 얻은 배지
            </span>
            <h1 className="bd-herotitle">{hero.title}</h1>
            <p className="bd-herodesc">{hero.desc}</p>
            <div className="bd-herostats">
              <div>
                <div className="bd-herostatval">
                  {earnedCount}<span className="bd-herostatunit">개</span>
                </div>
                <div className="bd-herostatlabel">모은 배지</div>
              </div>
              <div className="bd-herodivider" />
              <div>
                <div className="bd-herostatval">레벨 {level}</div>
                <div className="bd-herostatlabel">배지 등급</div>
              </div>
              <div className="bd-herodivider" />
              <div>
                <div className="bd-herostatval">
                  {lockedCount}<span className="bd-herostatunit">개</span>
                </div>
                <div className="bd-herostatlabel">다음 목표</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 상장 — (랭킹 준비중) 개근상 (다운로드 가능). 랭킹 상장은 RANKING_ENABLED 전까지 숨김. */}
      <section className="bd-section">
        <div className="bd-awards">
          <div className="bd-awardshead">
            <span className="bd-awardsicon"><i className="ph-fill ph-certificate" /></span>
            <div>
              <h3 className="bd-awardstitle">나의 상장</h3>
              <p className="bd-awardssub">
                {RANKING_ENABLED
                  ? `학년 랭킹 1~3위와 ${awardMeta.target}일 연속 학습 개근상을 받으면 상장을 내려받을 수 있어요.`
                  : `${awardMeta.target}일 연속 학습 개근상을 받으면 상장을 내려받을 수 있어요. (학년 랭킹 상장은 준비중이에요)`}
              </p>
            </div>
          </div>
          {shownAwards.length === 0 ? (
            <div className="bd-awardsempty">
              <i className="ph-duotone ph-trophy" />
              <p>
                {RANKING_ENABLED
                  ? '아직 받은 상장이 없어요. 매일 오늘의 퀴즈를 완료하면 랭킹이 올라가요!'
                  : '아직 받은 상장이 없어요. 매일 꾸준히 학습하면 개근상을 받을 수 있어요!'}
                {awardMeta.streak > 0 && (
                  <>
                    <br />개근 도전 중: <b>{awardMeta.streak}일</b> / {awardMeta.target}일
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="bd-awardsgrid">
              {shownAwards.map((a: any) => (
                <div key={a.title} className={`bd-award${a.type === 'attendance' ? ' bd-award--green' : ''}`}>
                  <span className="bd-awardmedal">{a.type === 'rank' ? '🏆' : '🌟'}</span>
                  <div className="bd-awardbody">
                    <div className="bd-awardname">{a.title}</div>
                    <div className="bd-awarddetail">{a.detail}</div>
                  </div>
                  {(() => {
                    const makeCanvas = () =>
                      drawCertificate({
                        kind: a.type === 'rank' ? 'rank' : 'attendance',
                        name: awardMeta.nickname || name,
                        title: a.title,
                        detail: a.detail,
                        semester: a.semester ?? '',
                      });
                    return (
                      <div className="bd-awardbtns">
                        <button
                          className="bd-awarddl"
                          onClick={() => canvasToPdf(`상장_${a.title}_${dateSuffix()}.pdf`, makeCanvas()).catch((e) => console.error('PDF 저장 실패', e))}
                        >
                          <i className="ph-fill ph-download-simple" />상장 받기 (PDF)
                        </button>
                        <button
                          className="bd-awarddl bd-awarddl--ghost"
                          title="이미지(PNG)로 저장"
                          onClick={() => downloadCanvasPng(`상장_${a.title}_${dateSuffix()}.png`, makeCanvas())}
                        >
                          <i className="ph-fill ph-image" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* NEXT BADGE PROGRESS */}
      <section className="bd-section bd-nextwrap">
        <div className="bd-next">
          <div className="bd-nexticon">
            <i className={next.icon} />
          </div>
          <div className="bd-nextbody">
            <div className="bd-nexthead">
              <span className="bd-nextname">{next.name}</span>
              <span className="bd-nextchip">{next.chip}</span>
            </div>
            <p className="bd-nextdesc">
              {next.desc}하면 얻을 수 있어요
              {next.remain && (
                <>
                  {' '}· 앞으로 <b>{next.remain}</b> 남았어요
                </>
              )}
            </p>
            <div className="bd-nextbar">
              <div
                className="bd-nextfill"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, next.progress)) * 100)}%` }}
              />
            </div>
          </div>
          {next.current !== null && next.total !== null && (
            <div className="bd-nextcount">
              {next.current}
              <span>/{next.total}</span>
            </div>
          )}
        </div>
      </section>

      {/* FILTER */}
      <section className="bd-section bd-filterwrap">
        <div className="bd-filterrow">
          <div className="bd-filterleft">
            <span className="bd-filtericon">
              <i className="ph-fill ph-medal" />
            </span>
            <h2 className="bd-filtertitle">배지 컬렉션</h2>
          </div>
          <div className="bd-chips">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`bd-chip${filter === c.key ? ' bd-chip-on' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* BADGE GRID */}
      <section className="bd-section bd-gridwrap">
        <div className="bd-grid">
          {visible.map((b) => {
            const locked = !!b.locked;
            return (
              <div key={b.name} className={`bd-badge ${locked ? 'bd-badge-locked' : 'bd-badge-earned'}`}>
                <div
                  className="bd-badgeicon"
                  style={
                    locked
                      ? { background: '#EFE9E1', color: '#B7ADA2' }
                      : { background: b.bg, color: b.color, boxShadow: `0 10px 20px -12px ${b.color}99` }
                  }
                >
                  <i className={b.icon} />
                  {locked ? (
                    <span className="bd-dot bd-dot-lock">
                      <i className="ph-bold ph-lock-simple" />
                    </span>
                  ) : (
                    <span className="bd-dot bd-dot-check">
                      <i className="ph-bold ph-check" />
                    </span>
                  )}
                </div>
                <div className={`bd-badgename${locked ? ' bd-badgename-locked' : ''}`}>{b.name}</div>
                <p className={`bd-badgedesc${locked ? ' bd-badgedesc-locked' : ''}`}>{b.desc}</p>
                <div className={`bd-foot ${locked ? 'bd-foot-locked' : 'bd-foot-earned'}`}>{b.foot}</div>
              </div>
            );
          })}
        </div>
      </section>

      <ScreenTimeReminder />
    </div>
  );
}
