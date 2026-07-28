import OpsNav from '../../components/ops/OpsNav';
import OpsSubTabs, { LLM_TABS } from '../../components/ops/OpsSubTabs';
import OpsAiRuntimeSection from './OpsAiRuntimeSection';
import './OpsApproval.css';
import './OpsSettings.css';

/** LLM · 모델 — 문항 '생성'과 '자기검증'에 실제로 호출하는 모델을 2슬롯으로 고른다.
 *  '설정' 한 페이지에 키·프롬프트와 뒤섞여 있던 것을 LLM 전용 메뉴로 분리한 첫 화면. */
export default function OpsLlmModels() {
  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">LLM 모델</h1>
            <p className="op-sub">
              문항 <b>생성</b>과 <b>자기검증</b>에 실제로 호출하는 모델을 슬롯별로 골라요. 바꾸면{' '}
              <b>재시작 없이</b> 다음 요청부터 적용되고, 켜둔 모델이 실패하면 자동으로 다른 모델로
              대체돼요.
            </p>
          </div>
        </div>
        <OpsSubTabs tabs={LLM_TABS} />
        <OpsAiRuntimeSection />
      </main>
    </div>
  );
}
