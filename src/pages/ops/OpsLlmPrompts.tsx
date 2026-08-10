import OpsNav from '../../components/ops/OpsNav';
import { PromptEditor } from './OpsLlmParts';
import { opsSettingsApi } from '../../api/ops';
import './OpsApproval.css';
import './OpsSettings.css';

/** LLM · 프롬프트 — LLM에 주는 지침 2개를 각각 편집한다.
 *  - 생성('출제 규칙'): 문항을 만드는 규칙(난이도·문체 등).
 *  - 검증('판정 지침'): 만든 문항을 '강의를 안 본 봇'으로 풀어 봇저항을 판정하는 태도.
 *  둘 다 구조부(형식·근거 소스)는 서버가 고정하고 '규칙'만 편집해 파서·판정이 안 깨진다.
 *  종전엔 생성 규칙 하나만 편집 가능했는데, 검증 프롬프트도 함께 열어 2개를 다 다룬다. */
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
          title="문항 생성 프롬프트 — 출제 규칙"
          saveLabel="규칙 저장"
          savedText="출제 규칙을 저장했어요 — 다음 문항 생성부터 적용돼요."
          hint={
            <>
              LLM에 주는 <b>출제 규칙</b>을 바꿔요(난이도·문체·언어 등). JSON 형식·변수 주입·출제
              시점 지침 같은 <b>구조부는 서버가 고정</b>하니 이 규칙만 바꿔도 생성이 안전하게
              동작해요.
            </>
          }
          load={opsSettingsApi.getAiPrompt}
          save={opsSettingsApi.putAiPrompt}
        />

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
