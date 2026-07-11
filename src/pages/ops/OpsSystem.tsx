import { useEffect, useState } from 'react';
import { opsApi, type OpsSystemHealth, type OpsSystemService } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

/** 시스템 상태 — 전부 서버 실측(DB 왕복·문제은행 로드·SMTP 실집계·디스크).
 * 가짜 상수를 보여주지 않는다: 실패하면 실패로, 미배포는 미배포로 표시. */

const SERVICE_META: Record<string, { label: string; icon: string; desc: string }> = {
  db: { label: '데이터베이스', icon: 'ph-database', desc: 'MySQL 연결 왕복시간' },
  'captcha-engine': { label: '캡차 엔진', icon: 'ph-puzzle-piece', desc: '6과목 문제은행 로드·출제 가능 여부' },
  smtp: { label: '이메일(SMTP)', icon: 'ph-envelope-simple', desc: '최근 24시간 실제 발송 결과' },
  disk: { label: '디스크', icon: 'ph-hard-drives', desc: '백엔드 컨테이너 저장공간' },
  'ai-server': { label: 'AI 판정 서버', icon: 'ph-cpu', desc: '행동 기반 봇 판정 모델' },
};

const STATUS_META: Record<string, { label: string; cls: string; icon: string }> = {
  ok: { label: '정상', cls: 'ok', icon: 'ph-check-circle' },
  degraded: { label: '주의', cls: 'warn', icon: 'ph-warning-circle' },
  error: { label: '오류', cls: 'no', icon: 'ph-x-circle' },
  'dry-run': { label: '미설정', cls: 'warn', icon: 'ph-flask' },
  not_deployed: { label: '미배포', cls: 'neutral', icon: 'ph-prohibit' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19); // 서버가 KST 벽시계를 보낸다
}

export default function OpsSystem() {
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

  const overall = (() => {
    if (!data) return null;
    const svc = data.services.filter((s) => s.status !== 'not_deployed');
    if (svc.some((s) => s.status === 'error')) return STATUS_META.error;
    if (svc.some((s) => s.status === 'degraded' || s.status === 'dry-run')) return STATUS_META.degraded;
    return STATUS_META.ok;
  })();

  const card = (s: OpsSystemService) => {
    const m = SERVICE_META[s.name] ?? { label: s.name, icon: 'ph-circle', desc: '' };
    const st = STATUS_META[s.status] ?? { label: s.status, cls: 'neutral', icon: 'ph-question' };
    return (
      <div key={s.name} className={`op-sys-card op-sys-card--${st.cls}`}>
        <div className="op-sys-head">
          <span className="op-sys-ic"><i className={`ph-fill ${m.icon}`} /></span>
          <div className="op-sys-title">
            <b>{m.label}</b>
            <small>{m.desc}</small>
          </div>
          <span className={`op-sys-status op-sys-status--${st.cls}`}>
            <i className={`ph-fill ${st.icon}`} />
            {st.label}
          </span>
        </div>
        <div className="op-sys-body">
          {s.latency_ms != null && <span className="op-sys-lat">{s.latency_ms}ms</span>}
          {s.detail && <span className="op-sys-detail">{s.detail}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">시스템 상태</h1>
            <p className="op-sub">
              전부 서버 실측이에요 — DB 왕복시간, 문제은행 로드, 최근 24시간 이메일 발송 결과, 디스크.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" />
            {state === 'loading' ? '점검 중…' : '다시 점검'}
          </button>
        </div>

        {state === 'error' && (
          <div className="op-empty">
            <i className="ph-duotone ph-warning" />
            <p>상태 점검에 실패했어요 — API 서버 자체가 응답하지 않을 수 있어요. 새로고침해 주세요.</p>
          </div>
        )}
        {state === 'loading' && !data && (
          <div className="op-empty"><i className="ph-duotone ph-spinner-gap" /><p>점검 중…</p></div>
        )}

        {data && state !== 'error' && (
          <>
            {overall && (
              <div className={`op-sys-overall op-sys-overall--${overall.cls}`}>
                <i className={`ph-fill ${overall.icon}`} />
                <b>전체 상태: {overall.label}</b>
                <span className="op-sys-checked">마지막 점검 {fmt(data.checked_at)} (KST)</span>
              </div>
            )}
            <div className="op-sys-grid">{data.services.map(card)}</div>
          </>
        )}
      </main>
    </div>
  );
}
