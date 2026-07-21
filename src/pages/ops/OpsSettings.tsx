import { useEffect, useState } from 'react';
import OpsNav from '../../components/ops/OpsNav';
import OpsAiRuntimeSection from './OpsAiRuntimeSection';
import { opsSettingsApi, type AiSettings, type AiKeyStatus } from '../../api/ops';
import { errorDetail } from '../../api/lectures';
import './OpsApproval.css';
import './OpsSettings.css';

/** 서비스 설정 — AI API 키(STT·LLM). 키를 입력하면 재기동 없이 즉시 기능이 켜진다.
 *  원문 키는 저장 요청에만 실리고, 조회는 항상 마스킹(설정 여부·끝 4자리)이다.
 *  성공 표기는 서버 응답(마스킹 상태 갱신)을 받은 뒤에만 한다 — 가짜 성공 금지. */

const SOURCE_LABEL: Record<string, string> = {
  console: '콘솔에서 입력됨',
  env: '서버 환경변수(.env) — 콘솔에서 입력하면 이 값보다 우선해요',
  stale: '서버 시크릿이 바뀌어 복호화할 수 없어요 — 다시 입력해 주세요',
};

function KeyCard({
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

/** 문항 생성 프롬프트(출제 규칙) 편집 — 운영자가 LLM 지침을 직접 손본다. 구조부(JSON 형식·
 *  변수 주입)는 서버가 고정하고 여기선 '규칙'만 바꿔, 생성 파서가 깨지지 않게 한다. */
function PromptEditor() {
  const [rules, setRules] = useState('');
  const [defaultRules, setDefaultRules] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    opsSettingsApi
      .getAiPrompt()
      .then((d) => {
        setRules(d.rules);
        setDefaultRules(d.default_rules);
        setIsCustom(d.is_custom);
      })
      .catch(() => setMsg({ ok: false, text: '프롬프트를 불러오지 못했어요.' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (value: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const d = await opsSettingsApi.putAiPrompt(value);
      setRules(d.rules);
      setIsCustom(d.is_custom);
      setMsg({
        ok: true,
        text: d.is_custom
          ? '출제 규칙을 저장했어요 — 다음 문항 생성부터 적용돼요.'
          : '기본값으로 되돌렸어요.',
      });
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
        <h2>문항 생성 프롬프트 — 출제 규칙</h2>
        <span className={`ops-set-chip ${isCustom ? 'ops-set-chip--ok' : 'ops-set-chip--off'}`}>
          <i className={`ph-fill ${isCustom ? 'ph-pencil-simple' : 'ph-check-circle'}`} />{' '}
          {isCustom ? '사용자 지정' : '기본값'}
        </span>
      </div>
      <p className="ops-set-desc">
        LLM에 주는 <b>출제 규칙</b>을 직접 바꿀 수 있어요(난이도·문체·언어 등). JSON 형식·변수
        주입·출제 시점 지침 같은 <b>구조부는 서버가 고정</b>하니, 이 규칙만 바꿔도 생성이 안전하게
        동작해요.
      </p>
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
        <button className="op-btn op-btn--approve" disabled={saving} onClick={() => save(rules)}>
          {saving ? '저장 중…' : '규칙 저장'}
        </button>
        <button
          className="op-btn op-btn--soft"
          disabled={saving || !isCustom}
          onClick={() => {
            setRules(defaultRules);
            void save('');
          }}
          title="서버 기본 규칙으로 되돌려요"
        >
          기본값으로 복원
        </button>
      </div>
    </section>
  );
}

export default function OpsSettings() {
  const [data, setData] = useState<AiSettings | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [sttKey, setSttKey] = useState('');
  const [saving, setSaving] = useState<'llm' | 'stt' | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoadErr('');
    opsSettingsApi
      .getAi()
      .then(setData)
      .catch((e) => setLoadErr(errorDetail(e, '설정을 불러오지 못했어요.')));
  };
  useEffect(load, []);

  const save = async (which: 'llm' | 'stt', value: string) => {
    setSaving(which);
    setBanner(null);
    try {
      const res = await opsSettingsApi.putAi(
        which === 'llm' ? { anthropic_api_key: value } : { openai_api_key: value },
      );
      setData(res); // 서버가 돌려준 마스킹 상태로만 성공을 표기한다
      if (which === 'llm') setLlmKey('');
      else setSttKey('');
      const st = which === 'llm' ? res.llm : res.stt;
      setBanner({
        ok: true,
        text: value.trim()
          ? `저장됐어요 (····${st.last4}) — 다음 AI 문항 생성부터 바로 쓰여요.`
          : '키를 삭제했어요 — 해당 기능은 미설정 상태가 됐어요.',
      });
    } catch (e) {
      setBanner({ ok: false, text: errorDetail(e, '저장에 실패했어요.') });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1>설정</h1>
            <p>
              AI 문항 생성에 쓰는 <b>모델</b>과 <b>API 키</b>를 관리해요. 모델·키를 바꾸면{' '}
              <b>재시작 없이</b> 다음 요청부터 바로 적용돼요. 키는 암호화되어 서버에만 보관되고,
              화면에는 끝 4자리만 표시돼요.
            </p>
          </div>
        </div>

        {loadErr && (
          <div className="op-form-err ops-set-banner">
            <i className="ph-fill ph-warning-circle" /> {loadErr}
            <button className="op-btn op-btn--reject" onClick={load}>
              다시 시도
            </button>
          </div>
        )}
        {banner && (
          <div className={`ops-set-banner ${banner.ok ? 'ops-set-banner--ok' : 'op-form-err'}`}>
            <i className={`ph-fill ${banner.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} />{' '}
            {banner.text}
          </div>
        )}

        {/* AI 모델 선택(#26) — 실제 호출 모델. 키보다 먼저 둔다("모델 먼저, 키는 맨 나중"). */}
        <OpsAiRuntimeSection />

        <div className="ops-set-flow">
          <i className="ph-fill ph-magic-wand" />
          <div>
            <b>AI 문항 자동 생성이 동작하는 방식</b>
            <span>
              강의 영상 음성을 <b>STT</b>로 전사(자막화)하고, 그 자막을 근거로 <b>LLM</b>이
              확인 문항과 출제 시점(되감기 지점 포함)을 초안(draft)으로 만들어요 — 운영자가
              검수 후 공개해요. STT 키가 없으면 제목·설명만으로 생성되고 시점 제안은 빠져요.
            </span>
          </div>
        </div>

        <KeyCard
          title="LLM — 문항 생성 (Anthropic)"
          desc={`강의 확인 문항을 자동 생성하는 언어 모델이에요. 사용 모델: ${data?.llm_model ?? '—'}`}
          status={data?.llm ?? null}
          provider="anthropic"
          placeholder="sk-ant-…"
          value={llmKey}
          onChange={setLlmKey}
          onSave={() => save('llm', llmKey)}
          onClear={() => save('llm', '')}
          saving={saving === 'llm'}
        />
        <KeyCard
          title="OpenAI 키 — 음성 전사(STT) + GPT 모델"
          desc="강의 음성을 타임스탬프 있는 자막으로 바꾸는 Whisper 전사에 써요(25MB 이하). 위 'AI 모델 선택'에서 GPT 모델을 슬롯에 넣으면 이 키로 문항 생성·검증도 호출해요 — OpenAI는 이 키 하나로 둘 다 동작해요."
          status={data?.stt ?? null}
          provider="openai"
          placeholder="sk-…"
          value={sttKey}
          onChange={setSttKey}
          onSave={() => save('stt', sttKey)}
          onClear={() => save('stt', '')}
          saving={saving === 'stt'}
        />

        <p className="ops-set-note">
          <i className="ph-bold ph-shield-check" /> 키는 서버 DB에 암호화(Fernet)로 저장되고,
          조회 API·감사 로그 어디에도 원문이 남지 않아요. 저장 후 <b>‘연결 테스트’</b>로 키가
          유효한지 바로 확인하세요 — 잘못된 키는 인증 실패(401 등)로 정직하게 표시돼요.
        </p>

        <PromptEditor />
      </main>
    </div>
  );
}
