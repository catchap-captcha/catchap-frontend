import { useState } from 'react';
import './InterestOnboardModal.css';

/**
 * 관심사 선택(온보딩) 모달 — 최초 학생 로그인 시 한 번 뜬다(StudentProfile.interests가 null일 때).
 * 고른 분야(코스 category)를 부모(StudentHome)가 저장하고, 홈 '관심사 추천'에 반영한다.
 * 건너뛰기도 빈 배열로 저장해 온보딩을 끝낸다(다시 안 뜨게).
 */
export default function InterestOnboardModal({
  categories,
  onDone,
}: {
  categories: string[];
  onDone: (interests: string[]) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (c: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const submit = async (interests: string[]) => {
    if (saving) return;
    setSaving(true);
    try {
      await onDone(interests);
    } catch {
      setSaving(false); // 실패 시 다시 시도할 수 있게(성공하면 부모가 모달을 닫는다)
    }
  };

  return (
    <div className="iom-overlay">
      <div className="iom-modal" role="dialog" aria-modal="true" aria-label="관심사 선택">
        <div className="iom-head">
          <span className="iom-badge">
            <i className="ph-fill ph-sparkle" /> 환영해요
          </span>
          <h2 className="iom-title">어떤 분야에 관심 있어요?</h2>
          <p className="iom-sub">
            고른 분야에 맞는 강의를 홈에서 먼저 보여드릴게요. 나중에 언제든 바꿀 수 있어요.
          </p>
        </div>

        {categories.length === 0 ? (
          <p className="iom-empty">아직 고를 분야가 없어요. 건너뛰어도 괜찮아요.</p>
        ) : (
          <div className="iom-chips">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`iom-chip${sel.has(c) ? ' iom-chip--on' : ''}`}
                onClick={() => toggle(c)}
                aria-pressed={sel.has(c)}
              >
                {sel.has(c) && <i className="ph-bold ph-check" />}
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="iom-actions">
          <button className="iom-skip" disabled={saving} onClick={() => submit([])}>
            건너뛰기
          </button>
          <button
            className="iom-done"
            disabled={saving || sel.size === 0}
            onClick={() => submit([...sel])}
          >
            {saving ? '저장 중…' : sel.size > 0 ? `${sel.size}개 선택 완료` : '선택 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
