import { useEffect, useMemo, useRef, useState } from 'react';
import OpsNav from '../../components/ops/OpsNav';
import {
  monitoringApi,
  METRIC_RANGES,
  type MetricRange,
  type MonitoringData,
  type ServerMetric,
} from '../../api/monitoring';
import { fmtKrw } from '../../utils/currency';
import './OpsApproval.css';
import './OpsMonitoring.css';

/**
 * 서버 자원 모니터링 — 각 VM(백엔드·DB·GPU STT·프론트)의 CPU/메모리/디스크/GPU + LLM 사용량.
 *
 * 데이터: GET /ops/monitoring. 백엔드는 요청 시 psutil로 자기 자신을 즉시 측정(실측). 다른
 * 서버는 각 VM의 에이전트(scripts/metrics_agent.py)가 밀어넣은 최신값(미배포면 '미수집').
 * 10초마다 자동 새로고침(현황판). 시계열/추이 그래프는 v2.
 */

const fmtInt = (n: number) => n.toLocaleString('ko-KR');
const usageClass = (pct: number) => (pct >= 85 ? 'mon-bad' : pct >= 60 ? 'mon-warn' : 'mon-ok');

function Bar({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="mon-metric">
      <div className="mon-metric-top">
        <span className="mon-metric-lb">{label}</span>
        <span className={`mon-metric-val ${usageClass(p)}`}>{p.toFixed(0)}%</span>
      </div>
      <div className="mon-bar">
        <div className={`mon-bar-fill ${usageClass(p)}`} style={{ width: `${p}%` }} />
      </div>
      <span className="mon-metric-sub">{sub}</span>
    </div>
  );
}

/** 서버 자원 추이(최근 구간) — CPU/메모리/GPU 라인. y=0~100%, 외부 의존 없는 SVG. */
function Trend({ h }: { h: NonNullable<ServerMetric['history']> }) {
  const n = h.cpu.length;
  const rangeLabel = METRIC_RANGES.find((r) => r.key === h.range)?.label ?? h.range;
  if (n < 2) {
    return (
      <div className="mon-trend-empty">
        최근 {rangeLabel} 추이를 모으는 중… (표본이 더 쌓이면 그려져요)
      </div>
    );
  }
  const poly = (vals: (number | null)[]) =>
    vals
      .map((v, i) =>
        v == null ? null : `${(i / (n - 1)) * 100},${100 - Math.max(0, Math.min(100, v))}`,
      )
      .filter(Boolean)
      .join(' ');
  const hasGpu = h.gpu.some((g) => g != null);
  return (
    <div className="mon-trend">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mon-trend-svg" aria-hidden="true">
        {[25, 50, 75].map((y) => (
          <line key={y} x1={0} x2={100} y1={100 - y} y2={100 - y} className="mon-trend-grid" />
        ))}
        <polyline className="mon-line mon-line--mem" points={poly(h.mem)} />
        {hasGpu && <polyline className="mon-line mon-line--gpu" points={poly(h.gpu)} />}
        <polyline className="mon-line mon-line--cpu" points={poly(h.cpu)} />
      </svg>
      <div className="mon-trend-legend">
        <span className="mon-lg mon-lg--cpu">CPU</span>
        <span className="mon-lg mon-lg--mem">메모리</span>
        {hasGpu && <span className="mon-lg mon-lg--gpu">GPU</span>}
        <span className="mon-trend-span">최근 {rangeLabel} · {n}개</span>
      </div>
    </div>
  );
}

function ServerCard({
  s,
  onDragStart,
  onDrop,
}: {
  s: ServerMetric;
  onDragStart?: () => void;
  onDrop?: () => void;
}) {
  if (s.no_data) {
    return (
      <article
        className="mon-card mon-card--empty mon-card--drag"
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="mon-card-head">
          <h3 className="mon-card-title">{s.label}</h3>
          <span className="mon-fresh mon-fresh--none">미수집</span>
        </div>
        <p className="mon-nodata">
          아직 지표가 없어요 — 이 서버(VM)에 메트릭 에이전트를 배포하면 여기에 표시됩니다.
        </p>
      </article>
    );
  }
  const fresh =
    s.stale
      ? { cls: 'mon-fresh--stale', txt: `${s.age_sec}s 전 · 오래됨` }
      : { cls: 'mon-fresh--ok', txt: `${s.age_sec ?? 0}s 전` };
  const alerts = s.alerts ?? [];
  const resAlerts = alerts.filter((a) => a.metric !== '수집'); // 자원 초과(오래됨 제외)
  return (
    <article
      className={`mon-card mon-card--drag${alerts.length > 0 ? ' mon-card--alert' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="mon-card-head">
        <div>
          <h3 className="mon-card-title">{s.label}</h3>
          {s.host && <span className="mon-card-host">{s.host}</span>}
        </div>
        <div className="mon-card-badges">
          {resAlerts.length > 0 && (
            <span className="mon-alert-badge" title={resAlerts.map((a) => `${a.metric} ${a.value}%`).join(', ')}>
              <i className="ph-fill ph-warning" /> 경보 {resAlerts.length}
            </span>
          )}
          <span className={`mon-fresh ${fresh.cls}`}>{fresh.txt}</span>
        </div>
      </div>
      <Bar
        label="CPU"
        pct={s.cpu_pct ?? 0}
        // ★cpu_cores 는 카드에 따라 뜻이 다르다 — 서버 카드는 ★코어 수,
        //   앱 카드(node: 접두사가 없는 것)는 ★몇 벌 떠 있는지다(백엔드 _service_snapshots).
        //   그전에는 둘 다 "2 core" 로 찍혀서 ★파드 2벌을 "2코어"라고 거짓말하고 있었다.
        sub={
          s.server_key.startsWith('node:')
            ? `${s.cpu_cores ?? 0}코어${s.load1 != null ? ` · 부하 ${s.load1}` : ''}`
            : `${s.cpu_cores ?? 0}벌 실행 중`
        }
      />
      <Bar
        label="메모리"
        pct={s.mem_pct ?? 0}
        sub={`${fmtInt(s.mem_used_mb ?? 0)} / ${fmtInt(s.mem_total_mb ?? 0)} MB`}
      />
      <Bar
        label="디스크"
        pct={s.disk_pct ?? 0}
        sub={`${s.disk_used_gb ?? 0} / ${s.disk_total_gb ?? 0} GB`}
      />
      {s.gpu_present ? (
        <div className="mon-gpu">
          <div className="mon-gpu-name">
            <i className="ph-fill ph-graphics-card" /> {s.gpu_name ?? 'GPU'}
          </div>
          <Bar label="GPU 사용률" pct={s.gpu_util_pct ?? 0} sub="util" />
          <Bar
            label="VRAM"
            pct={
              s.gpu_mem_total_mb
                ? ((s.gpu_mem_used_mb ?? 0) / s.gpu_mem_total_mb) * 100
                : 0
            }
            sub={`${fmtInt(s.gpu_mem_used_mb ?? 0)} / ${fmtInt(s.gpu_mem_total_mb ?? 0)} MB`}
          />
        </div>
      ) : (
        <div className="mon-gpu mon-gpu--none">
          <i className="ph-bold ph-minus-circle" /> GPU 없음
        </div>
      )}
      {s.history && <Trend h={s.history} />}
    </article>
  );
}

export default function OpsMonitoring() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const timer = useRef<number | null>(null);
  // 서버 카드 순서 — 운영자가 드래그로 정한 순서를 브라우저(localStorage)에 저장(server_key 배열).
  // 서버가 여러 대일 때 관심 있는 서버를 앞으로 끌어다 두게(사용자 요청).
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('catchap-mon-order') || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const dragKey = useRef<string | null>(null);
  // 추이 그래프 기간(6h/24h/7d/30d) — 서버가 raw/롤업 소스를 가른다.
  const [range, setRange] = useState<MetricRange>('6h');

  const load = () => {
    monitoringApi
      .get(range)
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };

  useEffect(() => {
    load();
    // 현황판 — 10초마다 자동 새로고침(백엔드는 매 호출 self-collect라 값이 갱신됨).
    // range가 바뀌면 재로드 + 타이머 갱신(load가 현재 range를 클로저로 잡는다).
    timer.current = window.setInterval(load, 10000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const llm = data?.llm;
  const maxCost = Math.max(1e-9, ...(llm?.providers.map((p) => p.cost_usd) ?? [0]));

  // 저장된 순서로 정렬 — order에 없는(새로 등장한) 서버는 뒤에 원래 순서로 둔다.
  const orderedServers = useMemo(() => {
    const servers = data?.servers ?? [];
    const rank = (k: string) => {
      const i = order.indexOf(k);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...servers].sort((a, b) => rank(a.server_key) - rank(b.server_key));
  }, [data?.servers, order]);

  const handleDrop = (targetKey: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    if (!from || from === targetKey) return;
    const keys = orderedServers.map((s) => s.server_key).filter((k) => k !== from);
    const ti = keys.indexOf(targetKey);
    keys.splice(ti < 0 ? keys.length : ti, 0, from); // targetKey '앞'에 삽입
    setOrder(keys);
    try {
      localStorage.setItem('catchap-mon-order', JSON.stringify(keys));
    } catch {
      /* localStorage 불가(프라이빗 모드 등) — 저장만 생략, 이번 세션 정렬은 유지 */
    }
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">서버 모니터링</h1>
            <p className="op-sub">
              각 서버의 CPU·메모리·디스크·GPU와 LLM API 사용량을 한눈에 봐요. 10초마다 자동 갱신.
            </p>
          </div>
          <div className="mon-head-actions">
            <div className="mon-range" role="group" aria-label="추이 기간">
              {METRIC_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`mon-range-btn${range === r.key ? ' mon-range-btn--on' : ''}`}
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
              새로고침
            </button>
          </div>
        </div>

        {state === 'error' && (
          <div className="op-empty">
            <i className="ph-fill ph-warning-circle" />
            <p>모니터링 데이터를 불러오지 못했어요.</p>
          </div>
        )}

        {/* 임계 경보 배너 — 하나라도 임계 초과면 상단에 요약(운영 개입 신호) */}
        {data && data.alert_count > 0 && (
          <div className="mon-alertbar">
            <i className="ph-fill ph-warning" />
            <b>경보 {data.alert_count}건</b>
            <div className="mon-alertbar-list">
              {data.servers
                .filter((s) => (s.alerts?.length ?? 0) > 0)
                .map((s) => (
                  <span key={s.server_key} className="mon-alertbar-item">
                    <b>{s.label}</b>{' '}
                    {s.alerts!
                      .map((a) => (a.metric === '수집' ? '오래됨(수집 중단?)' : `${a.metric} ${a.value}%`))
                      .join(' · ')}
                  </span>
                ))}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* LLM 사용량·비용 */}
            {llm && (
              <section className="mon-llm">
                <div className="mon-llm-head">
                  <h2 className="mon-llm-title">
                    <i className="ph-fill ph-brain" /> LLM API 사용량 · 추정 비용
                  </h2>
                  <span className="mon-llm-note">누적 토큰 × 공시 단가 · 환율 1,380원 기준 (실비용 아닌 운영 참고치)</span>
                </div>
                <div className="mon-llm-kpis">
                  <div className="mon-llm-kpi">
                    <span className="mon-llm-num">{fmtKrw(llm.est_cost_usd)}</span>
                    <span className="mon-llm-lb">추정 누적 비용</span>
                  </div>
                  <div className="mon-llm-kpi">
                    <span className="mon-llm-num">{fmtInt(llm.tokens_in)}</span>
                    <span className="mon-llm-lb">입력 토큰</span>
                  </div>
                  <div className="mon-llm-kpi">
                    <span className="mon-llm-num">{fmtInt(llm.tokens_out)}</span>
                    <span className="mon-llm-lb">출력 토큰</span>
                  </div>
                </div>
                {llm.providers.length > 0 ? (
                  <ul className="mon-prov">
                    {llm.providers.map((p) => (
                      <li key={p.provider} className="mon-prov-row">
                        <span className="mon-prov-name">{p.provider}</span>
                        <div className="mon-bar mon-prov-bar">
                          <div
                            className="mon-bar-fill mon-ok"
                            style={{ width: `${(p.cost_usd / maxCost) * 100}%` }}
                          />
                        </div>
                        <span className="mon-prov-cost">
                          {fmtKrw(p.cost_usd)} ·{' '}
                          {fmtInt(p.tokens_in + p.tokens_out)} 토큰
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mon-nodata">아직 LLM 호출 기록이 없어요.</p>
                )}
              </section>
            )}

            {/* 서버 자원 — 카드를 드래그해 순서를 바꿀 수 있다(순서는 이 브라우저에 저장됨) */}
            <p className="mon-drag-hint">
              <i className="ph-bold ph-dots-six-vertical" /> 카드를 끌어다 순서를 바꿀 수 있어요
              (이 브라우저에 저장돼요).
            </p>
            <div className="mon-grid">
              {orderedServers.map((s) => (
                <ServerCard
                  key={s.server_key}
                  s={s}
                  onDragStart={() => (dragKey.current = s.server_key)}
                  onDrop={() => handleDrop(s.server_key)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
