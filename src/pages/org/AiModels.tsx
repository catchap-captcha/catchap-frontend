import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import './AiModels.css';

/** handoff `CatChap AI모델.dc.html` 포팅 — 사용 중인 AI 모델 (읽기전용) */

interface AmModel {
  cat: string;
  name: string;
  provider: string;
  version: string;
  use: string;
  updated: string;
  icon: string;
  c: string;
  bg: string;
  status: string;
}

interface AmLog {
  model: string;
  version: string;
  note: string;
  when: string;
  dot: string;
}

// TODO(api): orgApi.aiModels 실패 시 원본 하드코딩 목록 유지
const FALLBACK_MODELS: AmModel[] = [
  { cat: '대화·설명 AI', name: 'Claude Sonnet', provider: 'Anthropic · KakaoCloud AIaaS', version: '2026.06-r3', use: 'AI 선생님 대화, 학습 코멘트, 학부모 상담 답변을 생성해요.', updated: '오늘', icon: 'ph-fill ph-robot', c: '#2E7BFF', bg: '#E6F0FF', status: '정상' },
  { cat: '문제·힌트 생성', name: 'Claude Haiku', provider: 'Anthropic · KakaoCloud', version: '2026.05-r7', use: '낱말·숫자 문제와 쉬운 힌트 문장을 자동으로 만들어요.', updated: '3일 전', icon: 'ph-fill ph-sparkle', c: '#8B6BFF', bg: '#EDE6FF', status: '정상' },
  { cat: '이미지 인식', name: 'Vision OCR', provider: 'KakaoCloud Vision', version: 'v3.2.1', use: '그림 찾기 정답 이미지 태깅과 손글씨 인식을 담당해요.', updated: '어제', icon: 'ph-fill ph-image', c: '#17B08C', bg: '#DFF6ED', status: '정상' },
  { cat: '음성 안내 (TTS)', name: 'Kakao TTS', provider: 'KakaoCloud Speech', version: 'v2.4.0', use: '문제와 힌트를 저학년도 알아듣게 읽어줘요.', updated: '1주 전', icon: 'ph-fill ph-speaker-high', c: '#FF922E', bg: '#FFEDE0', status: '정상' },
  { cat: 'CAPTCHA 검증', name: 'CatChap Guard', provider: '자체 모델 · On-prem', version: 'v1.8.2', use: '사람과 봇을 구분하고 부정 사용을 탐지해요.', updated: '2일 전', icon: 'ph-fill ph-shield-check', c: '#FF5A4D', bg: '#FFE7E2', status: '정상' },
  { cat: '학습 추천', name: 'Recsys Engine', provider: 'KakaoCloud ML', version: 'v0.9.4-beta', use: '다음 학습 놀이와 난이도를 아이마다 개인화해 추천해요.', updated: '오늘', icon: 'ph-fill ph-target', c: '#E0475E', bg: '#FFE3E9', status: '베타' },
];

const FALLBACK_CHANGELOG: AmLog[] = [
  { model: 'Claude Sonnet', version: '2026.06-r3', note: '한국어 저학년 말투와 존댓말 톤을 개선했어요.', when: '오늘 09:12', dot: '#2E7BFF' },
  { model: 'Recsys Engine', version: 'v0.9.4', note: '놀이 추천 정확도를 높이는 베타 업데이트를 적용했어요.', when: '오늘 08:40', dot: '#E0475E' },
  { model: 'Vision OCR', version: 'v3.2.1', note: '손글씨 숫자 인식률이 약 4%p 향상됐어요.', when: '어제', dot: '#17B08C' },
  { model: 'CatChap Guard', version: 'v1.8.2', note: '반복 오답을 악용하는 자동 클릭 패턴 탐지를 추가했어요.', when: '2일 전', dot: '#FF5A4D' },
];

const FALLBACK_REGISTRY = 'v2026.07.02';

function syncText(s: number) {
  if (s < 3) return '방금 전';
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  return `${m}분 전`;
}

export default function AiModels() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;

  const [models, setModels] = useState<AmModel[]>(FALLBACK_MODELS);
  // 변경이력은 실제 업데이트 이벤트라 빈 상태로 시작 — API가 주면 채움(가짜 이력 표시 금지)
  const [changelog, setChangelog] = useState<AmLog[]>([]);
  const [registryVersion, setRegistryVersion] = useState(FALLBACK_REGISTRY);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const fetchModels = useCallback(() => {
    if (!orgId) return;
    orgApi
      .aiModels(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!res || typeof res !== 'object') return;
        if (Array.isArray(res.models) && res.models.length > 0) {
          setModels(
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            res.models.map((m: any, i: number): AmModel => ({
              ...FALLBACK_MODELS[i % FALLBACK_MODELS.length],
              ...m,
            })),
          );
        }
        if (Array.isArray(res.changelog) && res.changelog.length > 0) {
          setChangelog(
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            res.changelog.map((c: any, i: number): AmLog => ({
              ...FALLBACK_CHANGELOG[i % FALLBACK_CHANGELOG.length],
              ...c,
            })),
          );
        }
        if (typeof res.registry_version === 'string') setRegistryVersion(res.registry_version);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
  }, [orgId]);

  // 원본: 마지막 동기화 초 카운트 setInterval
  useEffect(() => {
    const timer = window.setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const refresh = () => {
    setSpinning(true);
    setSecondsAgo(0);
    fetchModels();
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <OrgLayout active="ai" widget="none">
      {/* HEADER */}
      <div className="am-header">
        <div>
          <div className="am-breadcrumb">
            <a href="#" onClick={(e) => e.preventDefault()}>API·사이트</a>
            <i className="ph-bold ph-caret-right" />
            <span>AI 모델</span>
          </div>
          <h1 className="am-title">사용 중인 AI 모델</h1>
          <p className="am-subtitle">CatChap이 어떤 AI 모델을 쓰는지 안내해요. 모델 버전은 자동으로 최신 상태로 유지돼요.</p>
        </div>
      </div>

      {/* LIVE SYNC BAR */}
      <div className="am-syncBar">
        <span className="am-syncLive">
          <span className="am-syncDot" />모델 레지스트리 실시간 연결됨
        </span>
        <span className="am-syncMeta">
          KakaoCloud Model Registry · 마지막 동기화 <b>{syncText(secondsAgo)}</b>
        </span>
        <div className="am-syncRight">
          <span className="am-registry">레지스트리 {registryVersion}</span>
          <button className="am-refreshBtn" onClick={refresh}>
            <i className={spinning ? 'ph-bold ph-arrows-clockwise am-spinning' : 'ph-bold ph-arrows-clockwise'} />
            지금 동기화
          </button>
        </div>
      </div>

      {/* MODEL CARDS */}
      <div className="am-modelGrid">
        {models.map((m) => (
          <div className="am-modelCard" key={m.name}>
            <div className="am-modelHead">
              <span className="am-modelIcon" style={{ background: m.bg, color: m.c }}>
                <i className={m.icon} />
              </span>
              <span className={m.status === '베타' ? 'am-modelStatus am-statusBeta' : 'am-modelStatus am-statusOk'}>
                <i className={m.status === '베타' ? 'ph-fill ph-flask' : 'ph-fill ph-check-circle'} />
                {m.status === '베타' ? '베타' : '정상 운영'}
              </span>
            </div>
            <div className="am-modelCat">{m.cat}</div>
            <div className="am-modelName">{m.name}</div>
            <div className="am-modelProvider">{m.provider}</div>
            <p className="am-modelUse">{m.use}</p>
            <div className="am-modelFoot">
              <span className="am-modelVersion">
                <i className="ph-fill ph-git-branch" />
                {m.version}
              </span>
              <span className="am-modelUpdated">업데이트 {m.updated}</span>
            </div>
          </div>
        ))}
      </div>

      {/* CHANGELOG + PRINCIPLES */}
      <div className="am-bottomGrid">
        <div className="am-card">
          <div className="am-cardHead">
            <span className="am-cardHeadIcon">
              <i className="ph-fill ph-clock-counter-clockwise" />
            </span>
            <h3 className="am-cardTitle">최근 버전 업데이트</h3>
          </div>
          <div className="am-logList">
            {changelog.length === 0 && (
              <div style={{ padding: '20px 4px', color: '#9AA0B0', fontSize: 14 }}>최근 업데이트 내역이 없어요.</div>
            )}
            {changelog.map((c) => (
              <div className="am-logItem" key={`${c.model}-${c.version}`}>
                <span className="am-logDot" style={{ background: c.dot }} />
                <div className="am-logBody">
                  <div className="am-logHead">
                    <span className="am-logModel">{c.model}</span>
                    <span className="am-logVersion">{c.version}</span>
                  </div>
                  <div className="am-logNote">{c.note}</div>
                </div>
                <span className="am-logWhen">{c.when}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="am-principles">
          <div className="am-principlesHead">
            <span className="am-principlesIcon">
              <i className="ph-fill ph-shield-check" />
            </span>
            <h3 className="am-principlesTitle">데이터 사용 원칙</h3>
          </div>
          <div className="am-principleList">
            <div className="am-principle">
              <i className="ph-fill ph-check-circle" />
              <span>어린이 학습 데이터는 모델 학습에 사용되지 않아요.</span>
            </div>
            <div className="am-principle">
              <i className="ph-fill ph-check-circle" />
              <span>개인정보는 가명 처리 후 국내 리전에서만 처리돼요.</span>
            </div>
            <div className="am-principle">
              <i className="ph-fill ph-check-circle" />
              <span>모델 응답은 아동 안전 필터를 거쳐 제공돼요.</span>
            </div>
            <div className="am-principle">
              <i className="ph-fill ph-check-circle" />
              <span>새 버전은 검증 후 자동 배포되며 이 페이지에 즉시 반영돼요.</span>
            </div>
          </div>
        </div>
      </div>
    </OrgLayout>
  );
}
