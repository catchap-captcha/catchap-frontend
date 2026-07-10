import { useEffect, useRef, useState } from 'react';

/**
 * handoff `screen-time-reminder.js` 포팅.
 * 로그인 후 "실제 활동 시간"이 60분 쌓일 때마다 눈 휴식 팝업을 띄운다.
 * 벽시계 경과가 아니라 탭이 실제로 보이는 동안(document.visibilityState==='visible')만
 * 누적한다 — 탭을 백그라운드에 두거나 기기가 절전이면 시간이 흐르지 않는다.
 * 누적치는 현재 로그인(login_ts)에 귀속되며 새 로그인마다 0으로 초기화된다. 15초 tick.
 */
const PERIOD = 60 * 60 * 1000; // 실제 활동 60분마다 팝업
const TICK = 15000; // 15초 간격 누적 tick
const TS_KEY = 'catchap_login_ts'; // 현재 로그인 세션 식별자 (authStore가 관리)
const ACTIVE_KEY = 'catchap_active_ms'; // 이 세션의 누적 실제 활동 시간(ms)
const FOR_KEY = 'catchap_active_for'; // 위 누적치가 귀속된 login_ts
const SHOWN_KEY = 'catchap_break_shown'; // 이미 팝업을 띄운 블록 수

const MESSAGES = [
  '눈이 피곤하지 않나요? 20초만 먼 곳을 바라보세요 👀',
  '{n}시간 동안 열공했어요! 잠시 눈을 쉬어줄까요?',
  '잠깐! 자리에서 일어나 기지개를 쭉 펴볼까요? 🙆',
  '물 한 잔 마시고 다시 시작해요. 몸도 쉬어야 해요 💧',
  '냥냥이도 잠깐 쉬는 중이에요~ 20초만 함께 쉬어가요 🐾',
];

function readInt(key: string): number {
  return parseInt(localStorage.getItem(key) ?? '0', 10) || 0;
}

function fmt(ms: number): string {
  let m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  m = m % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

let lastIdx = -1;
function pickMessage(hours: number): string {
  let i = Math.floor(Math.random() * MESSAGES.length);
  if (i === lastIdx) i = (i + 1) % MESSAGES.length;
  lastIdx = i;
  return MESSAGES[i].replace('{n}', String(hours));
}

export default function ScreenTimeReminder() {
  const [popup, setPopup] = useState<{ msg: string; elapsed: number } | null>(null);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [restDone, setRestDone] = useState(false);
  const restTimer = useRef<number | null>(null);

  useEffect(() => {
    // 새 로그인(login_ts 변경) 시 누적치·표시기록을 초기화한다.
    const session = localStorage.getItem(TS_KEY) ?? '';
    if (localStorage.getItem(FOR_KEY) !== session) {
      localStorage.setItem(FOR_KEY, session);
      localStorage.setItem(ACTIVE_KEY, '0');
      localStorage.setItem(SHOWN_KEY, '0');
    }

    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;
      // 탭이 실제로 보이는 동안만 누적. 절전/백그라운드로 인한 큰 점프(> TICK*3)는 버린다.
      if (document.visibilityState !== 'visible' || delta <= 0 || delta > TICK * 3) return;

      const active = readInt(ACTIVE_KEY) + delta;
      localStorage.setItem(ACTIVE_KEY, String(active));

      const block = Math.floor(active / PERIOD);
      if (block > readInt(SHOWN_KEY)) {
        localStorage.setItem(SHOWN_KEY, String(block));
        setPopup({ msg: pickMessage(block), elapsed: active });
      }
    };

    const iv = window.setInterval(tick, TICK);
    // 탭을 다시 볼 때 기준 시각을 리셋 → 숨겨져 있던 동안의 시간은 누적되지 않는다.
    const onVis = () => {
      if (document.visibilityState === 'visible') lastTick = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(
    () => () => {
      if (restTimer.current) window.clearInterval(restTimer.current);
    },
    [],
  );

  if (!popup) return null;

  const close = () => {
    if (restTimer.current) window.clearInterval(restTimer.current);
    setPopup(null);
    setRestLeft(null);
    setRestDone(false);
  };

  const startRest = () => {
    setRestLeft(20);
    restTimer.current = window.setInterval(() => {
      setRestLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (restTimer.current) window.clearInterval(restTimer.current);
          setRestDone(true);
          window.setTimeout(close, 900);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resting = restLeft !== null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: 'rgba(58,46,42,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Pretendard, system-ui, sans-serif',
        animation: 'ccStOv .2s ease',
      }}
    >
      <style>{`@keyframes ccStOv{from{opacity:0}to{opacity:1}}@keyframes ccStPop{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 28,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4)',
          padding: '30px 26px 24px',
          textAlign: 'center',
          animation: 'ccStPop .3s ease',
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#FFE6BE,#FFCFC9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 38,
          }}
        >
          👀
        </div>
        <div
          style={{
            display: 'inline-block',
            background: '#FFF1E9',
            color: '#C0715A',
            fontWeight: 800,
            fontSize: 12,
            padding: '5px 13px',
            borderRadius: 20,
            marginBottom: 12,
          }}
        >
          {fmt(popup.elapsed)} 학습 중 · 쉬는 시간
        </div>
        <h2
          style={{
            fontFamily: 'Jua, sans-serif',
            fontSize: 21,
            color: '#3A3340',
            margin: '0 0 20px',
            lineHeight: 1.4,
          }}
        >
          {popup.msg}
        </h2>
        <div
          style={{
            background: '#FFF8F0',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: 12,
              background: '#E1F5EC',
              color: '#17B08C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🌿
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7A7266', lineHeight: 1.5 }}>
            20초 동안 창밖이나 먼 곳을 바라보면 눈이 편안해져요.
          </span>
        </div>
        <button
          disabled={resting}
          onClick={startRest}
          style={{
            width: '100%',
            border: 'none',
            cursor: resting ? 'default' : 'pointer',
            background: resting ? '#17B08C' : '#FF5A4D',
            color: '#fff',
            fontFamily: 'Jua, sans-serif',
            fontSize: 16,
            padding: 14,
            borderRadius: 15,
            boxShadow: resting
              ? '0 12px 24px -8px rgba(23,176,140,0.5)'
              : '0 12px 24px -8px rgba(255,90,77,0.6)',
          }}
        >
          {restDone
            ? '참 잘했어요! 🎉'
            : resting
              ? `먼 곳을 바라봐요… ${restLeft}초`
              : '20초 눈 쉬기 시작'}
        </button>
        {!resting && (
          <button
            onClick={close}
            style={{
              width: '100%',
              marginTop: 10,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#9B9086',
              fontFamily: 'Pretendard, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              padding: 6,
            }}
          >
            나중에 할게요
          </button>
        )}
      </div>
    </div>
  );
}
