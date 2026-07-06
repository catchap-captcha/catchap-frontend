import { useEffect, useRef, useState } from 'react';
import './EyeRestToast.css';

/**
 * handoff `CatChap 눈쉬기팝업.dc.html` 포팅 — 우하단 눈 쉬기 토스트 조각.
 * ccSlideIn(→ ertSlideIn) 등장, 5초 자동 숨김, 닫기 버튼.
 *
 * StudentLayout에는 이미 ScreenTimeReminder(60분 오버레이)가 있으므로
 * 이 토스트는 컴포넌트로만 구현해 두고 export 한다 (화면 임의 추가 금지).
 */
const MESSAGES = [
  '눈이 피곤하지 않나요? 20초만 먼 곳을 바라보세요 👀',
  '{n}시간 동안 열공했어요! 잠시 눈을 쉬어줄까요? 😺',
  '잠깐! 일어나서 기지개를 쭉 펴볼까요? 🙆',
  '물 한 잔 마시고 올까요? 몸도 쉬어야 해요 💧',
  '냥냥이도 쉬는 중이에요~ 같이 쉬어가요 🐾',
];

export default function EyeRestToast({
  hours = 2,
  onClose,
}: {
  /** 원본 props.hours (기본 2) — "{n}시간 학습 중" 라벨 */
  hours?: number;
  onClose?: () => void;
}) {
  const [idx] = useState(() => Math.floor(Math.random() * MESSAGES.length));
  const [open, setOpen] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // 원본 startAutoHide(): 5초 뒤 자동 숨김
    hideTimer.current = window.setTimeout(() => {
      setOpen(false);
      onCloseRef.current?.();
    }, 5000);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!open) return null;

  const close = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setOpen(false);
    onClose?.();
  };

  const message = MESSAGES[idx].replace('{n}', String(hours));

  return (
    <div className="ert-toast">
      <button onClick={close} title="닫기" className="ert-close">
        <i className="ph-bold ph-x" />
      </button>
      <div className="ert-row">
        <div className="ert-emoji">👀</div>
        <div className="ert-body">
          <div className="ert-badge">{hours}시간 학습 중</div>
          <p className="ert-message">{message}</p>
        </div>
      </div>
    </div>
  );
}
