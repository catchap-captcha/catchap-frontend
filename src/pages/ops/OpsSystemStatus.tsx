import { useEffect, useState } from 'react';
import { opsApi, type OpsSystemHealth } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsSystemStatus.css';

const NAME_META: Record<string, { icon: string; label: string; desc: string }> = {
  db: { icon: 'ph-database', label: '데이터베이스', desc: 'MySQL 연결 왕복시간' },
  'captcha-engine': { icon: 'ph-puzzle-piece', label: '캡차 엔진', desc: '문제은행 로드·출제 가능 여부' },
  smtp: { icon: 'ph-envelope-simple', label: '이메일(SMTP)', desc: '최근 24시간 발송 결과' },
  disk: { icon: 'ph-hard-drives', label: '디스크', desc: '백엔드 컨테이너 저장공간' },
  // 클러스터 앱 — 서버가 server_metrics(프로메테우스 수집분)에서 읽어 보낸다.
  // ★종전의 'ai-server' 카드는 아무것도 점검하지 않는 고정 문자열이었다. behavior-ai가
  //   그 자리를 대신한다 — 이제 실제로 도는 파드의 값이 뜬다.
  'captcha-api': { icon: 'ph-puzzle-piece', label: '캡차 API', desc: '캡차 발급·검증 서버' },
  'behavior-ai': { icon: 'ph-cpu', label: '행동 AI', desc: '행동 기반 봇 위험도 판정' },
  frontend: { icon: 'ph-browser', label: '프론트', desc: '웹 화면 서버' },
  'stt-worker': { icon: 'ph-waveform', label: 'STT 워커', desc: '강의 자막 생성(GPU)' },
};

const STATUS_META: Record<string, { accent: string; soft: string; label: string; icon: string }> = {
  ok: { accent: 'var(--ok)', soft: 'var(--ok-soft)', label: '정상', icon: 'ph-check-circle' },
  degraded: { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '저하', icon: 'ph-warning-circle' },
  'dry-run': { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '미설정', icon: 'ph-flask' },
  error: { accent: 'var(--brand)', soft: 'var(--brand-soft)', label: '오류', icon: 'ph-x-circle' },
  not_deployed: { accent: 'var(--ink-3)', soft: 'var(--bg)', label: '미배포', icon: 'ph-prohibit' },
  // ★'모름'과 '고장'은 다른 사실이다. 수집이 안 될 뿐인 것을 빨갛게 칠하면 진짜 장애를
  //   못 알아본다 — 회색으로 두고 사유를 detail 에 적는다.
  unknown: { accent: 'var(--ink-3)', soft: 'var(--bg)', label: '모름', icon: 'ph-question' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

/**
 * 시스템 상태 — 전부 서버 실측이다(DB 왕복시간·캡차엔진·SMTP·디스크 + 클러스터 앱 4종).
 *
 * ★'실측'이라는 말을 지키는 것이 이 화면의 전부다. 종전엔 "AI 판정 서버: 미배포"가
 *   서버에 고정된 문자열이라, 그 앱이 클러스터에 실제로 뜬 뒤에도 영영 미배포라고 말했다
 *   (0809 컷오버). 점검하지 않으면서 단언하는 카드는 없느니만 못하다 — 볼 때마다 사실
 *   확인을 다시 해야 하기 때문이다. 지금은 k8s가 보고 있는 값을 그대로 읽어 온다.
 *
 * 카드 이름·설명은 여기가 갖는다(서버는 키만 보낸다). 모르는 키가 와도 깨지지 않게
 * 기본값으로 떨어진다.
 */
export default function OpsSystemStatus() {
  const [data, setData] = useState<OpsSystemHealth | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    opsApi
      .system()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const worst = data?.services.reduce<'ok' | 'warn' | 'bad'>((acc, s) => {
    if (s.status === 'error') return 'bad';
    if ((s.status === 'degraded' || s.status === 'dry-run') && acc !== 'bad') return 'warn';
    return acc;
  }, 'ok');

  return (
    // 헤더 셸은 콘솔 공통 규격(op-*)을 쓴다 — 이 화면만 orn-* 셸이라 본문 폭(1400 제한 없음)·
    // 여백(32/36 vs 26/28)·제목 크기(32/700 vs 30/800)가 다른 시스템 페이지들과 어긋났다.
    <div className="op-root">
      <OpsNav />
      <main className="op-main sys-page">
        <div className="op-head">
          <div>
            <h1 className="op-title">시스템 상태</h1>
            <p className="op-sub" style={{ maxWidth: 560 }}>
              전부 서버 실측입니다 — DB 왕복시간, 문제은행 로드, 최근 24시간 이메일 발송 결과,
              디스크, 그리고 클러스터 앱(캡차 API·행동 AI·프론트·STT 워커)의 최신 지표.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" />다시 점검
          </button>
        </div>

        {state === 'loading' && <div className="orn-loading"><i className="ph-duotone ph-spinner-gap" />불러오는 중…</div>}
        {state === 'error' && (
          <div className="orn-card orn-empty"><i className="ph ph-warning-circle" /><p>시스템 상태를 불러오지 못했어요.</p></div>
        )}

        {state === 'ready' && data && (
          <>
            <div className={`sys-banner sys-banner--${worst}`}>
              <i className={`ph ${worst === 'ok' ? 'ph-check-circle' : worst === 'warn' ? 'ph-warning-circle' : 'ph-x-circle'}`} />
              <b>전체 상태: {worst === 'ok' ? '정상' : worst === 'warn' ? '주의' : '오류'}</b>
              <span className="sys-checked">마지막 점검 {fmt(data.checked_at)} (KST)</span>
            </div>

            <div className="sys-grid">
              {data.services.map((s) => {
                const nm = NAME_META[s.name] ?? { icon: 'ph-heartbeat', label: s.name, desc: '' };
                const sm = STATUS_META[s.status] ?? STATUS_META.not_deployed;
                return (
                  <div key={s.name} className="sys-card" style={{ borderLeftColor: sm.accent }}>
                    <div className="sys-card-top">
                      <span className="sys-icbox"><i className={`ph ${nm.icon}`} /></span>
                      <div className="sys-card-title">
                        <div className="sys-card-name">{nm.label}</div>
                        <div className="sys-card-desc">{nm.desc}</div>
                      </div>
                      <span className="sys-pill" style={{ color: sm.accent, background: sm.soft }}>
                        <i className={`ph ${sm.icon}`} />{sm.label}
                      </span>
                    </div>
                    <div className="sys-card-bottom">
                      {s.latency_ms != null && <span className="sys-latency">{s.latency_ms}ms</span>}
                      <span className="sys-detail">{s.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
