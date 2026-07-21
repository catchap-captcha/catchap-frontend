import { useEffect, useState, type ReactNode } from 'react';
import { opsSettingsApi, type AiKeyStatus } from '../../api/ops';
import { errorDetail } from '../../api/lectures';

/** LLM 설정 화면들이 공유하는 조각 — API 키 카드 + (생성·검증 공용) 프롬프트 편집기.
 *  '설정' 한 페이지에 몰려 있던 것을 LLM 전용 페이지(모델/키/프롬프트)로 나누면서,
 *  키·프롬프트 UI를 여기로 추출해 각 페이지가 재사용한다. 스타일은 OpsSettings.css를
 *  그대로 쓰므로(리뉴얼 디자인 토큰을 참조하는 클래스) 색·폰트가 자동으로 계승된다. */

export const SOURCE_LABEL: Record<string, string> = {
  console: '콘솔에서 입력됨',
  env: '서버 환경변수(.env) — 콘솔에서 입력하면 이 값보다 우선해요',
  stale: '서버 시크릿이 바뀌어 복호화할 수 없어요 — 다시 입력해 주세요',
};

/** AI API 키 카드 — 저장·삭제·연결 테스트. 원문 키는 저장 요청에만 실리고 조회는 항상 마스킹. */
export function KeyCard({
  title,
  desc,
  status,
  provider,
  placeholder,
  value,
  onChange,
  onSave,
  onClear,
  saving,
}: {
  title: string;
  desc: string;
  status: AiKeyStatus | null;
  provider: 'anthropic' | 'openai';
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
}) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<{ ok: boolean; detail: string } | null>(null);
  // 저장된 키가 실제로 유효한지 즉시 확인(연결 테스트) — 잘못된 키를 문항 생성 때 가서야 알던 문제 해결
  const runTest = async () => {
    setTesting(true);
    setTestRes(null);
    try {
      setTestRes(await opsSettingsApi.testAi(provider));
    } catch (e) {
      setTestRes({ ok: false, detail: errorDetail(e, '테스트에 실패했어요.') });
    } finally {
      setTesting(false);
    }
  };
  return (
    <section className="ops-set-card">
      <div className="ops-set-head">
        <h2>{title}</h2>
        {status &&
          (status.configured ? (
            <span className="ops-set-chip ops-set-chip--ok">
              <i className="ph-fill ph-check-circle" /> 설정됨 ····{status.last4}
            </span>
          ) : (
            <span className="ops-set-chip ops-set-chip--off">
              <i className="ph-fill ph-warning-circle" /> 미설정
            </span>
          ))}
      </div>
      <p className="ops-set-desc">{desc}</p>
      {status?.source && (
        <p className={`ops-set-src${status.source === 'stale' ? ' ops-set-src--bad' : ''}`}>
          {SOURCE_LABEL[status.source]}
          {status.source === 'console' && status.updated_at
            ? ` · 마지막 변경 ${new Date(status.updated_at).toLocaleString('ko-KR')}`
            : ''}
        </p>
      )}
      <div className="ops-set-row">
        <div className="ops-set-inputwrap">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="ops-set-eye"
            title="입력값 보기"
            onPointerDown={() => setShow(true)}
            onPointerUp={() => setShow(false)}
            onPointerLeave={() => setShow(false)}
          >
            <i className={`ph-bold ${show ? 'ph-eye' : 'ph-eye-slash'}`} />
          </button>
        </div>
        <button
          className="op-btn op-btn--approve"
          disabled={saving || !value.trim()}
          onClick={onSave}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {status?.configured && status.source === 'console' && (
          <button className="op-btn op-btn--reject" disabled={saving} onClick={onClear}>
            키 삭제
          </button>
        )}
        {status?.configured && (
          <button
            type="button"
            className="op-btn op-btn--soft"
            disabled={testing}
            onClick={runTest}
            title="저장된 키로 제공사에 연결해 유효한지 확인해요"
          >
            {testing ? '테스트 중…' : '연결 테스트'}
          </button>
        )}
      </div>
      {testRes && (
        <p className={`ops-set-src${testRes.ok ? ' ops-set-src--ok' : ' ops-set-src--bad'}`}>
          <i className={`ph-fill ${testRes.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} />{' '}
          {testRes.detail}
        </p>
      )}
    </section>
  );
}

type PromptData = { rules: string; default_rules: string; is_custom: boolean };

/** 프롬프트 규칙 편집기 — 생성('출제 규칙')과 검증('판정 지침')이 공용으로 쓴다.
 *  구조부(JSON 형식·근거 소스 등)는 서버가 고정하고 여기선 '규칙'만 바꾼다(파서·판정 보호).
 *  load/save를 주입받아 어떤 프롬프트든 같은 UI로 편집한다. */
export function PromptEditor({
  title,
  hint,
  saveLabel,
  savedText,
  load,
  save,
}: {
  title: string;
  hint: ReactNode;
  saveLabel: string;
  savedText: string;
  load: () => Promise<PromptData>;
  save: (rules: string) => Promise<PromptData>;
}) {
  const [rules, setRules] = useState('');
  const [defaultRules, setDefaultRules] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    load()
      .then((d) => {
        setRules(d.rules);
        setDefaultRules(d.default_rules);
        setIsCustom(d.is_custom);
      })
      .catch(() => setMsg({ ok: false, text: '프롬프트를 불러오지 못했어요.' }))
      .finally(() => setLoading(false));
    // load는 페이지가 넘기는 안정적 참조(모듈 함수)라 마운트 1회만 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = async (value: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const d = await save(value);
      setRules(d.rules);
      setIsCustom(d.is_custom);
      setMsg({ ok: true, text: d.is_custom ? savedText : '기본값으로 되돌렸어요.' });
    } catch (e) {
      setMsg({ ok: false, text: errorDetail(e, '저장에 실패했어요.') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  return (
    <section className="ops-set-card">
      <div className="ops-set-head">
        <h2>{title}</h2>
        <span className={`ops-set-chip ${isCustom ? 'ops-set-chip--ok' : 'ops-set-chip--off'}`}>
          <i className={`ph-fill ${isCustom ? 'ph-pencil-simple' : 'ph-check-circle'}`} />{' '}
          {isCustom ? '사용자 지정' : '기본값'}
        </span>
      </div>
      <p className="ops-set-desc">{hint}</p>
      <textarea
        className="ops-set-prompt"
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        rows={7}
        spellCheck={false}
        placeholder={defaultRules}
      />
      {msg && (
        <p className={`ops-set-src${msg.ok ? ' ops-set-src--ok' : ' ops-set-src--bad'}`}>
          {msg.text}
        </p>
      )}
      <div className="ops-set-row">
        <button className="op-btn op-btn--approve" disabled={saving} onClick={() => doSave(rules)}>
          {saving ? '저장 중…' : saveLabel}
        </button>
        <button
          className="op-btn op-btn--soft"
          disabled={saving || !isCustom}
          onClick={() => {
            setRules(defaultRules);
            void doSave('');
          }}
          title="서버 기본값으로 되돌려요"
        >
          기본값으로 복원
        </button>
      </div>
    </section>
  );
}
