import { useEffect, useRef, useState } from 'react';

/**
 * handoff `screen-time-reminder.js` 포팅.
 * 로그인 시점(localStorage 'catchap_login_ts')부터 60분마다 눈 휴식 팝업을 띄운다.
 * 탭 포커스와 무관하게 경과 시간 기준(원본 스펙 유지). 15초 간격 재확인.
 */
const PERIOD = 60 * 60 * 1000;
const TS_KEY = 'catchap_login_ts';
const SHOWN_KEY = 'catchap_break_shown';

const MESSAGES = [
  '눈이 피곤하지 않나요? 20초만 먼 곳을 바라보세요 👀',
  '{n}시간 동안 열공했어요! 잠시 눈을 쉬어줄까요?',
  '잠깐! 자리에서 일어나 기지개를 쭉 펴볼까요? 🙆',
  '물 한 잔 마시고 다시 시작해요. 몸도 쉬어야 해요 💧',
  '냥냥이도 잠깐 쉬는 중이에요~ 5분만 함께 쉬어가요 🐾',
];

function ensureLoginTs(): number {
  let v = localStorage.getItem(TS_KEY);
  if (!v) {
    localStorage.setItem(TS_KEY, String(Date.now()));
    v = localStorage.getItem(TS_KEY);
  }
  return parseInt(v ?? '', 10) || Date.now();
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
    ensureLoginTs();
    const check = () => {
      const elapsed = Date.now() - ensureLoginTs();
      const block = Math.floor(elapsed / PERIOD);
      if (block < 1) return;
      const shown = parseInt(localStorage.getItem(SHOWN_KEY) ?? '0', 10);
      if (block > shown) {
        localStorage.setItem(SHOWN_KEY, String(block));
        setPopup({ msg: pickMessage(block), elapsed });
      }
    };
    check();
    const iv = window.setInterval(check, 15000);
    return () => window.clearInterval(iv);
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
