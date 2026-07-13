import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { studentApi } from '../../api/students';
import { RANKING_ENABLED } from '../../config/features';
import { playSfx } from '../../utils/feedback';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './ProfileCustomize.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Cat = 'hat' | 'bg' | 'sticker';

interface ShopItem {
  /** 매칭 키(wallet.owned/avatar가 key 문자열 기준: 'cap', 'peach' …) */
  id: string;
  /** 서버 카탈로그 UUID — 구매 API(item_id)에 사용 */
  apiId?: string;
  name: string;
  icon: string;
  color: string;
  price: number;
  css?: string;
}

interface RankRow {
  name: string;
  score: number;
  me?: boolean;
}

// TODO(api): studentApi.shopCatalog() 실패 시 원본 하드코딩 상점 목록 유지
const FALLBACK_CATALOG: Record<Cat, ShopItem[]> = {
  hat: [
    { id: 'none', name: '없음', icon: 'ph-fill ph-prohibit-inset', color: '#C0B6A9', price: 0 },
    { id: 'cap', name: '야구모자', icon: 'ph-fill ph-baseball-cap', color: '#FF5A4D', price: 0 },
    { id: 'crown', name: '왕관', icon: 'ph-fill ph-crown', color: '#F0A400', price: 120 },
    { id: 'party', name: '파티모자', icon: 'ph-fill ph-confetti', color: '#8B6BFF', price: 80 },
    { id: 'grad', name: '학사모', icon: 'ph-fill ph-graduation-cap', color: '#2E7BFF', price: 200 },
    { id: 'flower', name: '꽃', icon: 'ph-fill ph-flower', color: '#FF6DA6', price: 60 },
    { id: 'santa', name: '눈꽃', icon: 'ph-fill ph-snowflake', color: '#4AA6FF', price: 90 },
    { id: 'detective', name: '탐정모자', icon: 'ph-fill ph-detective', color: '#8A6D3B', price: 150 },
  ],
  bg: [
    { id: 'peach', name: '복숭아', icon: 'ph-fill ph-circle', color: '#FF8A5B', price: 0, css: 'linear-gradient(150deg,#FFE6BE,#FFCFC9)' },
    { id: 'sky', name: '하늘', icon: 'ph-fill ph-circle', color: '#4AA6FF', price: 0, css: 'linear-gradient(150deg,#DDEEFF,#C2DBFF)' },
    { id: 'mint', name: '민트', icon: 'ph-fill ph-circle', color: '#17B08C', price: 50, css: 'linear-gradient(150deg,#C7F0E2,#B3E8D8)' },
    { id: 'grape', name: '포도', icon: 'ph-fill ph-circle', color: '#8B6BFF', price: 50, css: 'linear-gradient(150deg,#E7DAFF,#D6C7FF)' },
    { id: 'star', name: '별밤', icon: 'ph-fill ph-circle', color: '#3A3340', price: 150, css: 'linear-gradient(150deg,#4A4258,#2E2A3A)' },
    { id: 'rose', name: '장미', icon: 'ph-fill ph-circle', color: '#FF6DA6', price: 90, css: 'linear-gradient(150deg,#FFDCE8,#FFC2D6)' },
    { id: 'ocean', name: '바다', icon: 'ph-fill ph-circle', color: '#0EA5B5', price: 120, css: 'linear-gradient(150deg,#C2F0F5,#9DE0EA)' },
    { id: 'sunset', name: '노을', icon: 'ph-fill ph-circle', color: '#FF7A5B', price: 130, css: 'linear-gradient(150deg,#FFD9B0,#FFB0C4)' },
  ],
  sticker: [
    { id: 'none', name: '없음', icon: 'ph-fill ph-prohibit-inset', color: '#C0B6A9', price: 0 },
    { id: 'star', name: '별', icon: 'ph-fill ph-star', color: '#F0A400', price: 0 },
    { id: 'heart', name: '하트', icon: 'ph-fill ph-heart', color: '#FF5A6E', price: 40 },
    { id: 'fish', name: '생선', icon: 'ph-fill ph-fish', color: '#2E7BFF', price: 40 },
    { id: 'medal', name: '메달', icon: 'ph-fill ph-medal', color: '#17B08C', price: 100 },
    { id: 'rainbow', name: '무지개', icon: 'ph-fill ph-rainbow', color: '#8B6BFF', price: 110 },
    { id: 'butterfly', name: '나비', icon: 'ph-fill ph-butterfly', color: '#FF6DA6', price: 70 },
    { id: 'lightning', name: '번개', icon: 'ph-fill ph-lightning', color: '#F0A400', price: 90 },
  ],
};

// TODO(api): studentApi.wallet() 실패 시 원본 하드코딩 지갑 유지
const FALLBACK_COINS = 340;
const FALLBACK_OWNED: Record<Cat, string[]> = {
  hat: ['none', 'cap'],
  bg: ['peach', 'sky'],
  sticker: ['none', 'star'],
};

// TODO(api): studentApi.classRanking() 실패 시 원본 하드코딩 랭킹 유지
const RANK_OTHERS: RankRow[] = [
  { name: '윤서준', score: 2485 },
  { name: '이도아', score: 2410 },
  { name: '박시우', score: 2295 },
  { name: '최유나', score: 2240 },
  { name: '정민재', score: 2185 },
  { name: '강예린', score: 2120 },
  { name: '한지호', score: 2060 },
  { name: '오세아', score: 1990 },
];
const RANK_CLASS_SIZE = 24;
const RANK_COLORS = ['#FFC24B', '#C9D1DE', '#E6A56B'];

// TODO(api): useAuth().me 미로딩/미보유 시 원본 프로필 유지
const FALLBACK_PROFILE = { nick: '하은', age: 7, school: '햇살초등학교', klass: '2학년 3반' };

/* ---- API 응답 → 화면 상태 변환 ----
 * GET /shop/catalog 항목: {id:UUID, key, name, icon, price, color, css|null}
 * wallet.owned·avatar는 key 문자열이므로 화면 매칭용 id에는 key를 쓰고 UUID는 apiId로 보관 */
function mapCatalogList(list: any, prev: ShopItem[]): ShopItem[] {
  if (!Array.isArray(list) || !list.length) return prev;
  const mapped = list
    .map((it: any): ShopItem | null => {
      if (!it || typeof it.key !== 'string') return null;
      return {
        id: it.key,
        apiId: typeof it.id === 'string' ? it.id : undefined,
        name: typeof it.name === 'string' ? it.name : it.key,
        icon: typeof it.icon === 'string' ? it.icon : 'ph-fill ph-circle',
        color: typeof it.color === 'string' ? it.color : '#C0B6A9',
        price: typeof it.price === 'number' ? it.price : 0,
        css: typeof it.css === 'string' ? it.css : undefined,
      };
    })
    .filter((x: ShopItem | null): x is ShopItem => x !== null);
  return mapped.length ? mapped : prev;
}

const TABS: { key: Cat; label: string; icon: string }[] = [
  { key: 'hat', label: '모자', icon: 'ph-fill ph-baseball-cap' },
  { key: 'bg', label: '배경', icon: 'ph-fill ph-image' },
  { key: 'sticker', label: '스티커', icon: 'ph-fill ph-sticker' },
];

// TODO(api): wallet.week_summary 실패 시 원본 하드코딩 값 유지
const WEEK_STATS = [
  { icon: 'ph-fill ph-fire', value: '12일', label: '연속 학습', color: '#FF922E', bg: '#FFEDD6' },
  { icon: 'ph-fill ph-check-circle', value: '48개', label: '푼 문제', color: '#17B08C', bg: '#DFF6ED' },
  { icon: 'ph-fill ph-coins', value: '+85', label: '모은 냥코인', color: '#F0A400', bg: '#FFF3D6' },
  { icon: 'ph-fill ph-game-controller', value: '9판', label: '완료한 놀이', color: '#8B6BFF', bg: '#EDE6FF' },
];

/** wallet.week_summary(실집계) → 주간 활동 요약 카드 값 */
function mapWeekStats(w: any): typeof WEEK_STATS | null {
  if (!w || typeof w !== 'object') return null;
  const { streak_days, solved, coins_earned, games_done } = w;
  if ([streak_days, solved, coins_earned, games_done].some((v) => typeof v !== 'number')) return null;
  return [
    { ...WEEK_STATS[0], value: `${streak_days}일` },
    { ...WEEK_STATS[1], value: `${solved}개` },
    { ...WEEK_STATS[2], value: `+${coins_earned}` },
    { ...WEEK_STATS[3], value: `${games_done}판` },
  ];
}

interface MiniBadge {
  icon: string;
  name: string;
  color: string;
  bg: string;
  locked: boolean;
}

// TODO(api): studentApi.badges() 실패 시 원본 하드코딩 배지 유지
const FALLBACK_BADGES: MiniBadge[] = [
  { icon: 'ph-fill ph-cat', name: '첫 걸음', color: '#FF5A4D', bg: '#FFE7E2', locked: false },
  { icon: 'ph-fill ph-fire', name: '열흘 연속', color: '#FF922E', bg: '#FFEDD6', locked: false },
  { icon: 'ph-fill ph-text-aa', name: '한글 마스터', color: '#2E7BFF', bg: '#E6F0FF', locked: false },
  { icon: 'ph-fill ph-shield-check', name: '안전 지킴이', color: '#17B08C', bg: '#DFF6ED', locked: false },
  { icon: 'ph-fill ph-star', name: '숫자 왕', color: '#C7BBAD', bg: '#F4F1EC', locked: true },
];

export default function ProfileCustomize() {
  const { me, reloadMe } = useAuth();
  const { toast, flash } = useToast(); // 원본 flash(2.2초)와 동일 패턴

  const [tab, setTab] = useState<Cat>('hat');
  const [coins, setCoins] = useState(FALLBACK_COINS);
  const [owned, setOwned] = useState<Record<Cat, string[]>>(FALLBACK_OWNED);
  const [sel, setSel] = useState<Record<Cat, string>>({ hat: 'cap', bg: 'peach', sticker: 'star' });
  const [catalog, setCatalog] = useState<Record<Cat, ShopItem[]>>(FALLBACK_CATALOG);
  const [profile, setProfile] = useState(FALLBACK_PROFILE);
  /* wallet 응답의 student_code/level/함께한 일수 (me보다 우선) */
  const [walletInfo, setWalletInfo] = useState<{
    code?: string;
    level?: number;
    daysTogether?: number;
  }>({});
  const [weekStats, setWeekStats] = useState(WEEK_STATS);
  /* 주간 목표 — wallet.week_goal 실집계 (실패 시 원본 하드코딩 유지) */
  const [weekGoal, setWeekGoal] = useState<{ done: number; total: number; hint: string }>({
    done: 4,
    total: 5,
    hint: '하루만 더 하면 이번 주 목표를 채워요! 🎯',
  });
  const nickTouched = useRef(false);

  const [myScore, setMyScore] = useState(2360);
  const [scoreKey, setScoreKey] = useState(0);
  const [bonusMsg, setBonusMsg] = useState(''); // 상위 3위 일일 보너스 코인 안내
  const [others, setOthers] = useState<RankRow[]>(RANK_OTHERS);
  const [classSize, setClassSize] = useState(RANK_CLASS_SIZE);
  const apiLive = useRef(false);

  /* 내가 모은 배지: badges+student_badges 실데이터 */
  const [badges, setBadges] = useState<MiniBadge[]>(FALLBACK_BADGES);
  const [earnedBadges, setEarnedBadges] = useState<number | null>(null);
  useEffect(() => {
    studentApi
      .badges()
      .then((d: any) => {
        if (!d || !Array.isArray(d.badges) || !d.badges.length) return;
        const rows: MiniBadge[] = d.badges.slice(0, 5).map((b: any): MiniBadge => {
          const locked = !b?.earned;
          const color = typeof b?.color === 'string' && b.color ? b.color : '#FF5A4D';
          return {
            icon: typeof b?.icon === 'string' && b.icon ? b.icon : 'ph-fill ph-medal',
            name: typeof b?.name === 'string' ? b.name : '',
            color: locked ? '#C7BBAD' : color,
            bg: locked ? '#F4F1EC' : `${color}22`,
            locked,
          };
        });
        setBadges(rows);
        if (typeof d.earned === 'number') setEarnedBadges(d.earned);
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — 원본 배지 유지 */
      });
  }, []);

  /* 지갑 + 상점 카탈로그 */
  useEffect(() => {
    studentApi
      .wallet()
      .then((d: any) => {
        if (!d) return;
        if (typeof d.coins === 'number') setCoins(d.coins);
        if (d.owned) {
          setOwned((prev) => ({
            hat: Array.isArray(d.owned.hat) ? d.owned.hat : prev.hat,
            bg: Array.isArray(d.owned.bg) ? d.owned.bg : prev.bg,
            sticker: Array.isArray(d.owned.sticker) ? d.owned.sticker : prev.sticker,
          }));
        }
        /* avatar: {hat, sticker, background} — background 키 → sel.bg */
        if (d.avatar && typeof d.avatar === 'object') {
          setSel((prev) => ({
            hat: typeof d.avatar.hat === 'string' ? d.avatar.hat : prev.hat,
            bg: typeof d.avatar.background === 'string' ? d.avatar.background : prev.bg,
            sticker: typeof d.avatar.sticker === 'string' ? d.avatar.sticker : prev.sticker,
          }));
        }
        setProfile((p) => ({
          ...p,
          nick:
            !nickTouched.current && typeof d.nickname === 'string' && d.nickname
              ? d.nickname.slice(0, 8)
              : p.nick,
          age: typeof d.age === 'number' ? d.age : p.age,
        }));
        setWalletInfo({
          code: typeof d.student_code === 'string' ? d.student_code : undefined,
          level: typeof d.level === 'number' ? d.level : undefined,
          daysTogether: typeof d.days_together === 'number' ? d.days_together : undefined,
        });
        /* 주간 활동 요약 — 실집계(learning_attempts/coin_transactions) */
        const ws = mapWeekStats(d.week_summary);
        if (ws) setWeekStats(ws);
        /* 주간 목표 — 이번 주 학습일 실집계 */
        const wg = d.week_goal;
        if (wg && typeof wg.done === 'number' && typeof wg.total === 'number' && wg.total > 0) {
          setWeekGoal({
            done: wg.done,
            total: wg.total,
            hint: typeof wg.hint === 'string' && wg.hint ? wg.hint : '',
          });
        }
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — 원본 지갑 유지 */
      });
    studentApi
      .shopCatalog()
      .then((d: any) => {
        if (!d) return;
        setCatalog((prev) => ({
          hat: mapCatalogList(d.hat, prev.hat),
          bg: mapCatalogList(d.bg, prev.bg),
          sticker: mapCatalogList(d.sticker, prev.sticker),
        }));
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — 원본 카탈로그 유지 */
      });
  }, []);

  /* 반 랭킹: 원본 setInterval(2800ms) 점수 상승 시뮬레이션(fallback) + 5초 API 폴링 */
  useEffect(() => {
    if (!RANKING_ENABLED) return; // 랭킹 비활성('준비중') — API 폴링·점수 시뮬레이션·보너스 안내 모두 중단
    const simT = window.setInterval(() => {
      if (apiLive.current) {
        // API가 살아있으면 시뮬레이션은 다시 쓸 일이 없다 — 유휴 타이머로 남기지 않고 종료
        window.clearInterval(simT);
        return;
      }
      setMyScore((s) => s + Math.floor(Math.random() * 22) + 4);
      setScoreKey((k) => k + 1);
    }, 2800);
    const poll = () => {
      studentApi
        .classRanking()
        .then((d: any) => {
          if (!d) return;
          const score =
            typeof d.score === 'number' ? d.score : typeof d.my_score === 'number' ? d.my_score : null;
          /* API는 나를 포함한 board[{rank,name,score,me}] — 화면 상태는 "나를 제외한" others */
          const boardSrc = Array.isArray(d.board) && d.board.length ? d.board : d.others;
          if (Array.isArray(boardSrc) && boardSrc.length) {
            const rows: RankRow[] = boardSrc
              .filter((o: any) => o && typeof o.name === 'string' && typeof o.score === 'number' && !o.me)
              .map((o: any) => ({ name: o.name, score: o.score }));
            if (rows.length) setOthers(rows);
          }
          if (typeof d.class_size === 'number') setClassSize(d.class_size);
          else if (typeof d.classSize === 'number') setClassSize(d.classSize);
          if (score !== null) {
            apiLive.current = true;
            setMyScore(score);
            setScoreKey((k) => k + 1);
          }
          // 상위 3위 보너스 코인 지급 안내 (하루 1회 서버 지급분)
          if (typeof d.bonus_coins === 'number' && d.bonus_coins > 0) {
            setBonusMsg(`오늘의 랭킹 보상! ${d.rank}위 +${d.bonus_coins}코인 🎉`);
            window.setTimeout(() => setBonusMsg(''), 4000);
          }
        })
        .catch(() => {
          /* TODO(api): 백엔드 미구현 — 원본 시뮬레이션 유지 */
        });
    };
    poll();
    const pollT = window.setInterval(poll, 5000);
    return () => {
      window.clearInterval(simT);
      window.clearInterval(pollT);
    };
  }, []);

  /* 프로필: useAuth().me 기반 (fallback 원본 이름) */
  useEffect(() => {
    if (!me) return;
    setProfile((p) => ({
      ...p,
      nick: nickTouched.current ? p.nick : (me.student?.nickname || me.name || p.nick).slice(0, 8),
      school: me.organization_name || p.school,
      klass: me.student?.class_name || p.klass,
    }));
  }, [me]);

  /* 서버 지갑으로 상태 동기화 (구매 성공/실패 후 정합성 회복) */
  const syncWallet = () => {
    studentApi
      .wallet()
      .then((d: any) => {
        if (d && typeof d.coins === 'number') setCoins(d.coins);
        if (d?.owned) {
          setOwned((prev) => ({
            hat: Array.isArray(d.owned.hat) ? d.owned.hat : prev.hat,
            bg: Array.isArray(d.owned.bg) ? d.owned.bg : prev.bg,
            sticker: Array.isArray(d.owned.sticker) ? d.owned.sticker : prev.sticker,
          }));
        }
      })
      .catch(() => {
        /* 재조회 실패 시 현재 상태 유지 */
      });
  };

  /* 미보유 유료 아이템: 클릭 = 구매 후보 선택 → 아래 '구매하기' 버튼으로 확정.
     성공 처리는 서버 응답 후에만 한다 — 낙관 차감·선(先) "구매 완료" 표시(가짜 성공) 금지. */
  const [buying, setBuying] = useState<{ cat: Cat; item: ShopItem } | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const buyOrEquip = (cat: Cat, item: ShopItem) => {
    const isFree = item.price <= 0;
    const has =
      owned[cat].includes(item.id) ||
      (item.apiId ? owned[cat].includes(item.apiId) : false) ||
      sel[cat] === item.id; // 현재 착용 중인 아이템은 보유로 간주 (기본 지급품)

    if (has || isFree) {
      if (!owned[cat].includes(item.id)) {
        setOwned((o) => ({ ...o, [cat]: [...o[cat], item.id] }));
        // 무료/기본 아이템 보유를 서버에도 영속화 (이미 보유면 서버가 무시)
        studentApi.purchase(item.apiId ?? item.id).catch(() => {});
      }
      setSel((s) => ({ ...s, [cat]: item.id }));
      setBuying(null);
      return;
    }
    setBuying({ cat, item }); // 구매는 명시적 버튼으로만
  };

  const confirmPurchase = () => {
    if (!buying || purchasing) return;
    const { cat, item } = buying;
    setPurchasing(true);
    studentApi
      .purchase(item.apiId ?? item.id)
      .then((res: any) => {
        if (res && typeof res.coins === 'number') setCoins(res.coins);
        setOwned((o) => ({ ...o, [cat]: [...o[cat], item.id] }));
        setSel((s) => ({ ...s, [cat]: item.id }));
        setBuying(null);
        playSfx('reward'); // 설정 '효과음' on일 때만
        flash(item.name + ' 구매 완료! 🎉');
        syncWallet();
      })
      .catch((e: any) => {
        const status = e?.response?.status;
        if (status === 409) {
          // 이미 보유(기기 간 동기화 어긋남) — 보유로 반영하고 착용
          setOwned((o) => ({ ...o, [cat]: [...o[cat], item.id] }));
          setSel((s) => ({ ...s, [cat]: item.id }));
          setBuying(null);
          flash('이미 보유한 아이템이에요 — 바로 착용했어요!');
        } else {
          const detail = e?.response?.data?.detail;
          flash(typeof detail === 'string' && detail ? detail : '구매에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        syncWallet();
      })
      .finally(() => setPurchasing(false));
  };

  /* 원본 persistAvatar 그대로 + API 동기화 */
  const persistAvatar = () => {
    const selHat = catalog.hat.find((h) => h.id === sel.hat);
    const selBg = catalog.bg.find((b) => b.id === sel.bg);
    const selSt = catalog.sticker.find((s) => s.id === sel.sticker);
    const savedNick = (profile.nick || '').trim() || '냥이';
    const data = {
      bgCss: selBg?.css ?? 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
      hasHat: !!(selHat && selHat.id !== 'none'),
      hatIcon: selHat ? selHat.icon : '',
      hatColor: selHat ? selHat.color : '#FF5A4D',
      hasSticker: !!(selSt && selSt.id !== 'none'),
      stickerIcon: selSt ? selSt.icon : '',
      stickerColor: selSt ? selSt.color : '#F0A400',
      nick: savedNick,
      initial: [...savedNick][0] || '냥',
    };
    try {
      localStorage.setItem('catchap_avatar', JSON.stringify(data));
    } catch {
      /* 원본과 동일: 저장 실패 무시 */
    }
    studentApi.saveAvatar(data as unknown as Record<string, string | null>).catch(() => {
      /* TODO(api): 백엔드 미구현 — localStorage 저장으로 화면 동작 유지 */
    });
    studentApi
      .updateProfile({ nickname: savedNick })
      .then(() => {
        /* 닉네임 저장 성공 → me 갱신 → 홈/NAV 이름 즉시 반영 */
        reloadMe();
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 */
      });
    flash('저장되었습니다.');
  };

  const reset = () => setSel({ hat: 'none', bg: 'peach', sticker: 'none' });

  /* 원본 renderVals() 파생값 */
  const nick = (profile.nick || '').trim() || '냥이';
  const hat = catalog.hat.find((h) => h.id === sel.hat);
  const bg = catalog.bg.find((b) => b.id === sel.bg);
  const sticker = catalog.sticker.find((s) => s.id === sel.sticker);
  const bgValue = bg?.css ?? '#FFE6BE';
  const hasHat = !!hat && hat.id !== 'none';
  const hasSticker = !!sticker && sticker.id !== 'none';

  const rank = 1 + others.filter((o) => o.score > myScore).length;
  const allRanked: RankRow[] = [...others, { name: nick, score: myScore, me: true }].sort(
    (a, b) => b.score - a.score,
  );
  const topScore = allRanked[0].score;
  const topPct = (topScore ? Math.round((myScore / topScore) * 100) : 0) + '%'; // 전원 0점이면 NaN% 방지
  const board = allRanked.slice(0, 3);
  const mine = allRanked.find((x) => x.me);
  if (!board.some((x) => x.me) && mine) board.push(mine);
  const up = 3 - rank;
  const deltaText = up > 0 ? up + '계단 상승' : up < 0 ? -up + '계단' : '지난주와 같아요';
  const deltaIcon = up > 0 ? 'ph-fill ph-caret-up' : up < 0 ? 'ph-fill ph-caret-down' : 'ph-fill ph-minus';

  /* 주간 목표 — wallet.week_goal(이번 주 학습일 실집계) */
  const goalDone = weekGoal.done;
  const goalTotal = weekGoal.total;
  const goalPct = (goalTotal ? Math.round((goalDone / goalTotal) * 100) : 0) + '%'; // total 0이면 NaN% 방지
  const goalLabel = goalDone + '/' + goalTotal + '일 달성';
  const goalHint = weekGoal.hint;
  const badgeCount = earnedBadges ?? badges.filter((b) => !b.locked).length;

  const code = walletInfo.code || me?.student?.student_code || 'CAT-4823';
  const level = walletInfo.level ?? me?.student?.level ?? 7;
  const daysTogether = walletInfo.daysTogether ?? 42; // student_profiles.created_at 실데이터

  return (
    <div className="pf-root">
      {/* NAV — 원본 NAV(코인 칩 + 라이브 아바타 칩, 알림 없음)라 페이지 자체 구현 */}
      <div className="pf-nav">
        <div className="pf-navin">
          <Link to={PATHS.STUDENT_HOME} className="pf-logo">
            <img src={mascot} alt="CatChap" className="pf-logoimg" />
            <div className="pf-logotext">
              <span className="pf-logotitle">CatChap</span>
              <span className="pf-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="pf-menu">
            <Link to={PATHS.STUDENT_HOME} className="pf-navlink">홈</Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="pf-navlink">전체 학습</Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="pf-navlink">개념 설명</Link>
            <Link to={PATHS.STUDENT_AI_TEACHER} className="pf-navlink">AI 선생님</Link>
            <Link to={PATHS.STUDENT_RECORDS} className="pf-navlink">나의 기록</Link>
          </nav>
          <div className="pf-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="pf-searchbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <div className="pf-coins">
              <i className="ph-fill ph-coins" />
              <span className="pf-coinsnum">{coins}</span>
              <span className="pf-coinslabel">냥코인</span>
            </div>
            <div className="pf-navprofile">
              <div className="pf-navavatar" style={{ background: bgValue }}>
                <img src={mascot} alt="" />
                {hasHat && hat && (
                  <i className={`${hat.icon} pf-navhat`} style={{ color: hat.color }} />
                )}
              </div>
              <span className="pf-navnick">{nick}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <section className="pf-head">
        <div className="pf-headrow">
          <span className="pf-headicon">
            <i className="ph-fill ph-user-circle-gear" />
          </span>
          <div>
            <h1 className="pf-title">마이 페이지</h1>
            <p className="pf-sub">내 프로필을 수정하고, 모은 냥코인으로 나만의 냥이를 꾸며요</p>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="pf-main">
        {/* AVATAR PREVIEW */}
        <div className="pf-avcard">
          <div className="pf-avstage" style={{ background: bgValue }}>
            <div className="pf-avdeco1" />
            <div className="pf-avdeco2" />
            <div className="pf-avfloat">
              {hasHat && hat && (
                <div className="pf-avhat">
                  <i className={hat.icon} style={{ color: hat.color }} />
                </div>
              )}
              <img src={mascot} alt="내 냥이" className="pf-avimg" />
              {hasSticker && sticker && (
                <div className="pf-avsticker">
                  <i className={sticker.icon} style={{ color: sticker.color }} />
                </div>
              )}
            </div>
          </div>
          <div className="pf-avmeta">
            <div className="pf-avname">{nick}의 냥이</div>
            <div className="pf-avinfo">{profile.age}세 · 레벨 {level} · 함께한 지 {daysTogether}일</div>
            <div className="pf-codebox">
              <div className="pf-codehead">
                <i className="ph-fill ph-link-simple" />개별 코드
              </div>
              <div className="pf-codeval">{code}</div>
              <div className="pf-codehint">다른 사람에게 알려주지 말고 유출되지 않도록 조심해요!</div>
            </div>
          </div>
          <div className="pf-actions">
            <button onClick={reset} className="pf-resetbtn">
              <i className="ph-bold ph-arrow-counter-clockwise" />초기화
            </button>
            <button onClick={persistAvatar} className="pf-savebtn">
              <i className="ph-fill ph-check-circle" />저장하기
            </button>
          </div>

          {/* CLASS RANKING */}
          {!RANKING_ENABLED ? (
            <div className="pf-rank">
              <div className="pf-rankdeco" />
              <div className="pf-rankhead">
                <div className="pf-ranktitle">
                  <span className="pf-rankicon">
                    <i className="ph-fill ph-trophy" />
                  </span>
                  <span className="pf-ranktext">우리 학년 랭킹</span>
                </div>
              </div>
              <div className="pf-rankbody">
                <div className="pf-ranksub">학년 랭킹은 준비중이에요. 곧 만나요 🐾</div>
              </div>
            </div>
          ) : (
          <div className="pf-rank">
            <div className="pf-rankdeco" />
            <div className="pf-rankhead">
              <div className="pf-ranktitle">
                <span className="pf-rankicon">
                  <i className="ph-fill ph-trophy" />
                </span>
                <span className="pf-ranktext">우리 학년 랭킹</span>
              </div>
              <span className="pf-live">
                <span className="pf-livedotwrap">
                  <span className="pf-livedot" />
                </span>
                실시간
              </span>
            </div>
            <div className="pf-rankbody">
              <div className="pf-ranknumwrap">
                <div className="pf-ranknum">
                  {rank}
                  <span className="pf-rankunit">위</span>
                </div>
                <div className="pf-ranksub">우리 학년 {classSize}명 중</div>
              </div>
              <div className="pf-scorecol">
                <div className="pf-scorehead">
                  <span className="pf-scorelabel">전과목 합산 점수</span>
                  <span className={`pf-delta ${up >= 0 ? 'pf-delta-up' : 'pf-delta-down'}`}>
                    <i className={deltaIcon} />
                    {deltaText}
                  </span>
                </div>
                <div key={scoreKey} className="pf-score">
                  {myScore}
                  <span className="pf-scoreunit">점</span>
                </div>
                <div className="pf-scorebar">
                  <div className="pf-scorefill" style={{ width: topPct }} />
                </div>
              </div>
            </div>
            <div className="pf-board">
              {board.map((r) => {
                const rk = allRanked.indexOf(r) + 1;
                const isMe = !!r.me;
                return (
                  <div key={rk + '-' + r.name} className={`pf-rrow${isMe ? ' pf-rrow-me' : ''}`}>
                    <span
                      className={`pf-rbadge ${rk <= 3 ? 'pf-rbadge-top' : 'pf-rbadge-etc'}`}
                      style={rk <= 3 ? { background: RANK_COLORS[rk - 1] } : undefined}
                    >
                      {rk}
                    </span>
                    <span className={`pf-rname${isMe ? ' pf-rname-me' : ''}`}>
                      {isMe ? nick + ' (나)' : r.name}
                    </span>
                    <span className={`pf-rscore${isMe ? ' pf-rscore-me' : ''}`}>{r.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* SETTINGS ENTRY */}
          <Link to={PATHS.STUDENT_SETTINGS} className="pf-settings">
            <span className="pf-setticon">
              <i className="ph-fill ph-gear-six" />
            </span>
            <span className="pf-settext">
              <span className="pf-settitle">CatChap 설정</span>
              <span className="pf-setsub">알림·소리·화면·개인정보를 바꿀 수 있어요</span>
            </span>
            <i className="ph-bold ph-caret-right pf-setcaret" />
          </Link>
        </div>

        {/* CUSTOMIZE PANEL */}
        <div className="pf-col">
          {/* PROFILE EDIT */}
          <div className="pf-card">
            <div className="pf-cardhead">
              <span className="pf-cardicon">
                <i className="ph-fill ph-pencil-simple-line" />
              </span>
              <h2 className="pf-cardtitle">내 프로필 수정</h2>
            </div>
            <div>
              <label className="pf-label">이름 · 별명</label>
              <input
                value={profile.nick}
                onChange={(e) => {
                  nickTouched.current = true;
                  const v = e.target.value.slice(0, 8);
                  setProfile((p) => ({ ...p, nick: v }));
                }}
                maxLength={8}
                placeholder="별명을 입력해요"
                className="pf-input"
              />
            </div>
            <div className="pf-infogrid">
              <div className="pf-infocell">
                <div className="pf-infohead">
                  <i className="ph-fill ph-buildings pf-i-school" />학교
                </div>
                <div className="pf-infoval">{profile.school}</div>
              </div>
              <div className="pf-infocell">
                <div className="pf-infohead">
                  <i className="ph-fill ph-chalkboard-teacher pf-i-class" />우리 반
                </div>
                <div className="pf-infoval">{profile.klass}</div>
              </div>
              <div className="pf-infocell">
                <div className="pf-infohead">
                  <i className="ph-fill ph-cake pf-i-age" />나이
                </div>
                <div className="pf-infoval">{profile.age}세</div>
              </div>
            </div>
            <div className="pf-note">
              <i className="ph-fill ph-info" />
              <span>학교·반·나이는 소속 기관에서 관리해요. 별명만 직접 바꿀 수 있고, 실제 이름은 보호자만 볼 수 있어요.</span>
            </div>
          </div>

          {/* SHOP */}
          <div className="pf-card">
            <div className="pf-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pf-tab ${tab === t.key ? 'pf-tab-on' : 'pf-tab-off'}`}
                >
                  <i className={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="pf-items">
              {catalog[tab].map((it) => {
                const isOwned = owned[tab].includes(it.id);
                const selected = sel[tab] === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => buyOrEquip(tab, it)}
                    className={`pf-item${selected ? ' pf-item-sel' : ''}${isOwned ? '' : ' pf-item-locked'}${
                      buying && buying.cat === tab && buying.item.id === it.id ? ' pf-item-buying' : ''
                    }`}
                  >
                    <span className="pf-itempreview" style={{ background: it.css || '#fff' }}>
                      <i className={it.icon} style={{ color: it.color }} />
                    </span>
                    <span className="pf-itemname">{it.name}</span>
                    <span className={`pf-itemprice ${isOwned ? 'pf-itemprice-owned' : 'pf-itemprice-buy'}`}>
                      <i className={isOwned ? 'ph-fill ph-check' : 'ph-fill ph-coins'} />
                      {isOwned ? '보유' : it.price}
                    </span>
                    {selected && (
                      <span className="pf-itemcheck">
                        <i className="ph-bold ph-check" />
                      </span>
                    )}
                    {!isOwned && (
                      <span className="pf-itemlock">
                        <i className="ph-fill ph-lock-simple" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {buying && buying.cat === tab && (
              <div className="pf-buybar">
                <span className="pf-buybar-preview" style={{ background: buying.item.css || '#fff' }}>
                  <i className={buying.item.icon} style={{ color: buying.item.color }} />
                </span>
                <div className="pf-buybar-info">
                  <b>{buying.item.name}</b>
                  <span className="pf-buybar-price">
                    <i className="ph-fill ph-coins" /> {buying.item.price}냥
                    {coins < buying.item.price && <em> · 냥코인이 부족해요 😿</em>}
                  </span>
                </div>
                <button
                  className="pf-buybar-cancel"
                  onClick={() => setBuying(null)}
                  disabled={purchasing}
                >
                  취소
                </button>
                <button
                  className="pf-buybar-buy"
                  onClick={confirmPurchase}
                  disabled={purchasing || coins < buying.item.price}
                >
                  <i className="ph-fill ph-shopping-cart-simple" />
                  {purchasing ? '구매 중…' : '아이템 구매하기'}
                </button>
              </div>
            )}
          </div>

          {/* MY ACTIVITY SUMMARY */}
          <div className="pf-card">
            <div className="pf-acthead">
              <span className="pf-acticon">
                <i className="ph-fill ph-chart-line-up" />
              </span>
              <div>
                <h2 className="pf-h2">나의 활동 요약</h2>
                <p className="pf-h2sub">이번 주 {nick}이의 발자국이에요 🐾</p>
              </div>
            </div>
            <div className="pf-stats">
              {weekStats.map((s) => (
                <div key={s.label} className="pf-stat">
                  <span className="pf-staticon" style={{ background: s.bg, color: s.color }}>
                    <i className={s.icon} />
                  </span>
                  <div className="pf-statval">{s.value}</div>
                  <div className="pf-statlabel">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="pf-goal">
              <div className="pf-goalhead">
                <span className="pf-goaltitle">
                  <i className="ph-fill ph-target" />이번 주 학습 목표
                </span>
                <span className="pf-goalpct">{goalLabel}</span>
              </div>
              <div className="pf-goalbar">
                <div className="pf-goalfill" style={{ width: goalPct }} />
              </div>
              <p className="pf-goalhint">{goalHint}</p>
            </div>
          </div>

          {/* MY BADGES */}
          <div className="pf-card">
            <div className="pf-bhead">
              <span className="pf-bicon">
                <i className="ph-fill ph-medal" />
              </span>
              <div className="pf-bheadtext">
                <h2 className="pf-h2">내가 모은 배지</h2>
                <p className="pf-h2sub">지금까지 {badgeCount}개를 모았어요</p>
              </div>
              <Link to={PATHS.STUDENT_BADGES} className="pf-ball">
                전체 보기<i className="ph-bold ph-arrow-right" />
              </Link>
            </div>
            <div className="pf-badges">
              {badges.map((b) => (
                <div key={b.name} className={`pf-badge${b.locked ? ' pf-badge-locked' : ''}`}>
                  <span className="pf-bmedal" style={{ background: b.bg, color: b.color }}>
                    <i className={b.icon} />
                  </span>
                  <span className={`pf-bname${b.locked ? ' pf-bname-locked' : ''}`}>{b.name}</span>
                  {b.locked && (
                    <span className="pf-block">
                      <i className="ph-fill ph-lock-simple" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SAVE TOAST */}
      {toast !== null && (
        <div className="pf-toast">
          <span className="pf-toastcheck">
            <i className="ph-bold ph-check" />
          </span>
          {toast}
        </div>
      )}

      {/* 랭킹 상위 3위 보너스 코인 안내 */}
      {bonusMsg && (
        <div className="pf-toast" style={{ background: '#F0A400' }}>
          <span className="pf-toastcheck">
            <i className="ph-fill ph-coins" />
          </span>
          {bonusMsg}
        </div>
      )}

      <ScreenTimeReminder />
    </div>
  );
}
