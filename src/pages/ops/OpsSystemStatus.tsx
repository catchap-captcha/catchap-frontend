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
  'ai-server': { icon: 'ph-cpu', label: 'AI 판정 서버', desc: '행동 기반 봇 판정 모델' },
};

const STATUS_META: Record<string, { accent: string; soft: string; label: string; icon: string }> = {
  ok: { accent: 'var(--ok)', soft: 'var(--ok-soft)', label: '정상', icon: 'ph-check-circle' },
  degraded: { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '저하', icon: 'ph-warning-circle' },
  'dry-run': { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '미설정', icon: 'ph-flask' },
  error: { accent: 'var(--brand)', soft: 'var(--brand-soft)', label: '오류', icon: 'ph-x-circle' },
  not_deployed: { accent: 'var(--ink-3)', soft: 'var(--bg)', label: '미배포', icon: 'ph-prohibit' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

/**
 * 시스템 상태 — CatChap '시스템 상태' 리뉴얼 화면 그대로. 전부 서버 실측(DB 왕복시간·
 * 캡차엔진·SMTP·디스크·AI서버). 기존 GET /ops/system을 그대로 재사용한다(신규 백엔드 불필요).
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
              전부 서버 실측입니다 — DB 왕복시간, 문제은행 로드, 최근 24시간 이메일 발송 결과, 디스크.
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
