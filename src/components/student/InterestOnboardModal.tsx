import { useState } from 'react';
import './InterestOnboardModal.css';
import { INTEREST_GROUPS, AGE_BANDS, AGE_PREFIX, MAX_INTEREST_FIELDS } from './interestTaxonomy';

/**
 * 관심사 선택(온보딩) 모달 — 최초 학생 로그인 시 한 번 뜬다(StudentProfile.interests가 null일 때).
 * 분야를 잘게 나눈 데모 태그(interestTaxonomy)를 그룹별로 보여주고, 연령대도 고른다.
 * 고른 태그 + 연령대(1칸, AGE_PREFIX)를 부모(StudentHome)가 저장하고, 홈 '관심사 추천'에
 * 반영한다(단, 추천엔 실제 코스가 있는 분야만 뜬다). 건너뛰기도 빈 배열로 저장해 온보딩을 끝낸다.
 */
export default function InterestOnboardModal({
  onDone,
}: {
  onDone: (interests: string[]) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [age, setAge] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const atCap = sel.size >= MAX_INTEREST_FIELDS;

  const toggle = (t: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (next.size < MAX_INTEREST_FIELDS) next.add(t);
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

  const finish = () => {
    const arr = [...sel];
    if (age) arr.push(AGE_PREFIX + age); // 연령대는 접두사 1칸으로 저장(추천 매칭엔 무시)
    submit(arr);
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
            고른 분야에 맞는 코스를 홈에서 먼저 보여드릴게요. 최대 {MAX_INTEREST_FIELDS}개까지 골라주세요.
          </p>
        </div>

        <div className="iom-body">
          {INTEREST_GROUPS.map((g) => (
            <section className="iom-group" key={g.key}>
              <h3 className="iom-group-label">
                <i className={g.icon} />
                {g.label}
              </h3>
              <div className="iom-chips">
                {g.tags.map((t) => {
                  const on = sel.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`iom-chip${on ? ' iom-chip--on' : ''}`}
                      onClick={() => toggle(t)}
                      disabled={!on && atCap}
                      aria-pressed={on}
                    >
                      {on && <i className="ph-bold ph-check" />}
                      {t}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="iom-group">
            <h3 className="iom-group-label">
              <i className="ph-fill ph-user-circle" />
              연령대 <span className="iom-opt">선택</span>
            </h3>
            <div className="iom-chips">
              {AGE_BANDS.map((a) => {
                const on = age === a;
                return (
                  <button
                    key={a}
                    type="button"
                    className={`iom-chip${on ? ' iom-chip--on' : ''}`}
                    onClick={() => setAge(on ? null : a)}
                    aria-pressed={on}
                  >
                    {on && <i className="ph-bold ph-check" />}
                    {a}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {atCap && (
          <p className="iom-cap">관심 분야는 최대 {MAX_INTEREST_FIELDS}개까지 고를 수 있어요.</p>
        )}

        <div className="iom-actions">
          <button
            className="iom-reset"
            disabled={saving || (sel.size === 0 && !age)}
            onClick={() => {
              setSel(new Set());
              setAge(null);
            }}
          >
            선택 초기화
          </button>
          <div className="iom-actions-r">
            <button className="iom-skip" disabled={saving} onClick={() => submit([])}>
              건너뛰기
            </button>
            <button
              className="iom-done"
              disabled={saving || sel.size === 0}
              onClick={finish}
            >
              {saving ? '저장 중…' : sel.size > 0 ? `${sel.size}개 선택 완료` : '선택 완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
