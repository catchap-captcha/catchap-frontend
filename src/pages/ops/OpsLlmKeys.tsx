import { useEffect, useState } from 'react';
import OpsNav from '../../components/ops/OpsNav';
import { KeyCard } from './OpsLlmParts';
import { opsSettingsApi, type AiSettings } from '../../api/ops';
import { errorDetail } from '../../api/lectures';
import './OpsApproval.css';
import './OpsSettings.css';

/** LLM · API 키 — 문항 생성 LLM(Anthropic)과 OpenAI(GPT 모델·STT 폴백) 키를 관리한다.
 *  키를 입력하면 재기동 없이 즉시 기능이 켜진다. 원문 키는 저장 요청에만 실리고, 조회는
 *  항상 마스킹(설정 여부·끝 4자리)이다. 성공 표기는 서버 응답을 받은 뒤에만(가짜 성공 금지). */
export default function OpsLlmKeys() {
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
            <h1 className="op-title">API 키</h1>
            <p className="op-sub">
              AI 문항 생성에 쓰는 <b>API 키</b>를 관리해요. 저장하면 <b>재시작 없이</b> 다음
              요청부터 적용되고, 키는 암호화되어 서버에만 보관돼요(화면엔 끝 4자리만 표시).
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

        {data?.stt_worker?.configured && (
          <div className="ops-set-banner ops-set-banner--ok">
            <i className="ph-fill ph-check-circle" /> 자체 STT 워커(faster-whisper·GPU)로 강의 자막을{' '}
            <b>무료</b>로 전사 중이에요 — 아래 OpenAI 키는 STT에 필수가 아니에요(GPT 모델·폴백용).
          </div>
        )}

        <KeyCard
          title="LLM — 문항 생성 (Anthropic)"
          /* ★"사용 모델: claude-opus-4-8" 이라고 찍고 있었는데 ★그건 폴백(.env LLM_MODEL)이고
              실제 생성은 claude-opus-5 로 돌고 있었다(0816 실측). 지금 실제로 부르는 것을 말한다.
              슬롯이 하나도 없을 때만 폴백을 쓰므로, 그때는 그렇다고 밝힌다. */
          desc={
            data?.llm_model_in_use
              ? `강의 확인 문항을 자동 생성하는 언어 모델이에요. 지금 쓰는 모델: ${data.llm_model_in_use} (「LLM 모델」에서 바꿔요)`
              : `강의 확인 문항을 자동 생성하는 언어 모델이에요. 「LLM 모델」에 고른 것이 없어 기본값 ${data?.llm_model ?? '—'} 으로 동작해요.`
          }
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
          title="OpenAI 키 — (선택) GPT 모델 · STT 폴백"
          desc={
            data?.stt_worker?.configured
              ? "STT(자막 전사)는 위 자체 워커가 무료로 처리하므로 이 키는 필수가 아니에요. 'LLM 모델'에서 GPT 모델을 쓰거나, 자체 워커가 멈췄을 때 OpenAI Whisper로 폴백하려면 입력하세요."
              : '강의 음성을 자막으로 바꾸는 STT와 GPT 모델에 써요. 자체 STT 워커가 없을 때 이 키로 OpenAI Whisper 전사(25MB 이하)를 해요.'
          }
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
      </main>
    </div>
  );
}
