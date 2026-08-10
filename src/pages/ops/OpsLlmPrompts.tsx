import { useEffect, useState } from 'react';
import OpsNav from '../../components/ops/OpsNav';
import { PromptEditor } from './OpsLlmParts';
import { opsSettingsApi } from '../../api/ops';
import { errorDetail } from '../../api/lectures';
import './OpsApproval.css';
import './OpsSettings.css';

/** LLM · 프롬프트 — LLM에 주는 지침을 편집한다.
 *  - 생성('출제 규칙'): 문항을 만드는 규칙(전역 + 강사·과목별 전용).
 *  - 검증('판정 지침'): 만든 문항을 '강의를 안 본 봇'으로 풀어 봇저항을 판정하는 태도.
 *  둘 다 구조부(형식·근거 소스)는 서버가 고정하고 '규칙'만 편집해 파서·판정이 안 깨진다. */

type ScopedData = {
  overrides: { instructor_id: string; instructor_name: string; subject: string; rules: string }[];
  pairs: { instructor_id: string; instructor_name: string; subject: string }[];
};

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--line)',
  borderRadius: '10px',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontSize: '14px',
};

/** 강사 계정 × 코스 과목별 '전용 출제 규칙'. 전역 규칙은 그대로 두고, 특정 조합에만 다른 규칙을
 *  준다 — 생성 때 그 강의의 (강사, 과목)에 맞는 전용본이 있으면 전역 대신 그걸 쓴다. */
function ScopedGenPrompts() {
  const [data, setData] = useState<ScopedData | null>(null);
  const [sel, setSel] = useState(''); // "instructor_id|subject"
  const [rules, setRules] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    opsSettingsApi
      .getScopedPrompts()
      .then(setData)
      .catch((e) => setMsg({ ok: false, text: errorDetail(e, '전용 규칙을 불러오지 못했어요.') }));
  };
  useEffect(load, []);

  const overrideMap = new Map((data?.overrides ?? []).map((o) => [`${o.instructor_id}|${o.subject}`, o.rules]));

  const onSelect = (key: string) => {
    setSel(key);
    setRules(overrideMap.get(key) ?? '');
    setMsg(null);
  };

  const save = async (override?: string) => {
    if (!sel) return;
    const val = override ?? rules;
    const [iid, subject] = sel.split('|');
    setSaving(true);
    setMsg(null);
    try {
      await opsSettingsApi.putScopedPrompt(iid, subject, val);
      setRules(val);
      setMsg({
        ok: true,
        text: val.trim()
          ? '전용 규칙을 저장했어요 — 그 강사·과목의 다음 문항 생성부터 적용돼요.'
          : '전용 규칙을 지웠어요 — 그 조합은 전역/기본값을 써요.',
      });
      load();
    } catch (e) {
      setMsg({ ok: false, text: errorDetail(e, '저장에 실패했어요.') });
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;
  return (
    <section className="ops-set-card">
      <div className="ops-set-head">
        <h2>강사·과목별 출제 규칙 (선택)</h2>
        <span className={`ops-set-chip ${data.overrides.length ? 'ops-set-chip--ok' : 'ops-set-chip--off'}`}>
          <i className="ph-fill ph-user-focus" /> 전용본 {data.overrides.length}개
        </span>
      </div>
      <p className="ops-set-desc">
        특정 <b>강사 계정 × 코스 과목</b> 조합에만 다른 출제 규칙을 줄 수 있어요. 문항을 생성할 때 그
        강의의 강사·과목에 맞는 전용 규칙이 있으면 <b>위 전역 규칙 대신 그걸</b> 쓰고, 없으면 전역·기본값을
        써요. (목록의 <b>✓</b>는 이미 전용본이 있는 조합)
      </p>
      {data.pairs.length === 0 ? (
        <p className="ops-set-src">아직 코스가 없어 설정할 (강사, 과목) 조합이 없어요.</p>
      ) : (
        <>
          <div className="ops-set-row">
            <select value={sel} onChange={(e) => onSelect(e.target.value)} style={SELECT_STYLE} aria-label="강사·과목 선택">
              <option value="">강사 · 과목 선택…</option>
              {data.pairs.map((p) => {
                const key = `${p.instructor_id}|${p.subject}`;
                return (
                  <option key={key} value={key}>
                    {p.instructor_name} · {p.subject}
                    {overrideMap.has(key) ? '  ✓' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {sel && (
            <>
              <textarea
                className="ops-set-prompt"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder="비우면 이 조합은 전역 규칙을 써요. 여기에 규칙을 넣으면 이 강사·과목에만 적용됩니다."
              />
              {msg && (
                <p className={`ops-set-src${msg.ok ? ' ops-set-src--ok' : ' ops-set-src--bad'}`}>{msg.text}</p>
              )}
              <div className="ops-set-row">
                <button className="op-btn op-btn--approve" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '전용 규칙 저장'}
                </button>
                <button
                  className="op-btn op-btn--soft"
                  disabled={saving || !overrideMap.has(sel)}
                  onClick={() => void save('')}
                  title="이 조합의 전용 규칙을 지우고 전역/기본값으로 되돌려요"
                >
                  전용 규칙 삭제
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function OpsLlmPrompts() {
  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">프롬프트</h1>
            <p className="op-sub">
              LLM에 주는 지침을 직접 편집해요. <b>생성</b>은 문항을 만드는 규칙, <b>검증</b>은 만든
              문항을 봇으로 풀어 봇저항을 판정하는 태도예요. 둘 다 형식·근거 같은 <b>구조부는 서버가
              고정</b>하고 규칙만 바꿔 안전하며, 저장하면 다음 문항 생성부터 바로 반영돼요.
            </p>
          </div>
        </div>

        <PromptEditor
          title="문항 생성 프롬프트 — 출제 규칙 (전역)"
          saveLabel="규칙 저장"
          savedText="출제 규칙을 저장했어요 — 다음 문항 생성부터 적용돼요."
          hint={
            <>
              LLM에 주는 <b>출제 규칙</b>을 바꿔요(난이도·문체·언어 등). JSON 형식·변수 주입·출제
              시점 지침 같은 <b>구조부는 서버가 고정</b>하니 이 규칙만 바꿔도 생성이 안전하게
              동작해요. 아래에서 <b>강사·과목별 전용 규칙</b>을 두면 그 조합엔 이 전역 대신 전용본이 쓰여요.
            </>
          }
          load={opsSettingsApi.getAiPrompt}
          save={opsSettingsApi.putAiPrompt}
        />

        <ScopedGenPrompts />

        <PromptEditor
          title="자기검증 프롬프트 — 판정 지침"
          saveLabel="지침 저장"
          savedText="판정 지침을 저장했어요 — 다음 문항 생성의 자기검증부터 적용돼요."
          hint={
            <>
              생성된 문항을 <b>강의를 전혀 안 본 봇</b>으로 풀어 봇저항을 판정하는 <b>태도</b>를
              바꿔요(얼마나 엄격히 볼지 등). 무엇을 근거로 푸는지(블라인드/자막)와 출력 형식은
              서버가 고정하니 판정 로직은 안 깨져요.
            </>
          }
          load={opsSettingsApi.getAiVerifyPrompt}
          save={opsSettingsApi.putAiVerifyPrompt}
        />
      </main>
    </div>
  );
}
