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

/** 마지막으로 값이 들어온 지 얼마나 됐나 — "0s 전" 은 운영자가 읽는 말이 아니다. */
const ago = (sec: number | null | undefined) => {
  const n = sec ?? 0;
  if (n < 5) return '방금';
  if (n < 60) return `${n}초 전`;
  const m = Math.floor(n / 60);
  return m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
};

/** 카드 기본 순서 — 운영자가 드래그로 바꾸기 전에 보이는 순서.
 *
 *  그전에는 기본 순서가 아예 없어서 백엔드가 준 대로(=DB 조회 순) 나왔다. 그래서
 *  노드가 "일반 2-a → GPU 2-a → GPU 2-b → 일반 2-b" 처럼 뒤죽박죽이고, VM 도
 *  점프·운영이 섞여 ★짝이 안 보였다.
 *
 *  ★보는 순서대로 세운다 — "서비스가 살아 있나"(앱) → "그 앱이 도는 서버"(노드)
 *    → "뒷단"(VM). 같은 역할은 묶고 그 안에서 2-a → 2-b 로 둬 짝이 나란히 보이게.
 *  ⚠️노드 키는 IP 기반이라 노드가 재생성되면 바뀐다 — 그래서 노드만 이름표로 정렬한다.
 */
const APP_ORDER = ['frontend', 'backend-api', 'captcha-api', 'behavior-ai', 'stt-worker'];
const VM_ORDER = ['vm-jump', 'vm-jump-2b', 'vm-ops', 'vm-ops-2b', 'vm-nat-2a', 'vm-nat-2b'];

/** 카드를 세 묶음으로 나눈다 — 그전에는 15개가 죽 늘어서 있었다.
 *
 *  ★기준이 섞여 있어서 오해를 만든다:
 *    노드·VM 카드는 "서버 한 대 = 카드 하나" 인데,
 *    앱 카드는 "서비스 한 종류 = 카드 하나"(각각 2벌씩 떠 있다)다.
 *  그래서 합이 15개(홀수)가 되고, 보는 사람이 ★"이중화가 안 됐나" 로 읽는다.
 *  묶고 제목을 달아 무엇이 무엇인지, 몇 벌씩인지 한눈에 보이게 한다.
 */
const CARD_GROUPS = [
  {
    key: 'app',
    title: '서비스',
    hint: '사용자가 직접 쓰는 것들 — 각각 2벌씩 떠 있어서 한 벌이 죽어도 이어집니다.',
    match: (s: ServerMetric) => APP_ORDER.includes(s.server_key),
  },
  {
    key: 'node',
    title: '서비스 서버',
    hint: '위 서비스가 실제로 도는 곳 — 두 영역(2-a·2-b)에 나눠 둡니다.',
    match: (s: ServerMetric) => s.server_key.startsWith('node:'),
  },
  {
    key: 'vm',
    title: '뒷단 서버',
    hint: '접속(점프)·작업(운영)·인터넷 출구(NAT) — 영역마다 짝을 맞춰 둡니다.',
    match: (s: ServerMetric) => s.server_key.startsWith('vm-'),
  },
] as const;

const defaultRank = (s: ServerMetric): [number, number, string] => {
  const a = APP_ORDER.indexOf(s.server_key);
  if (a >= 0) return [0, a, ''];
  if (s.server_key.startsWith('node:')) return [1, 0, s.label ?? s.server_key];
  const v = VM_ORDER.indexOf(s.server_key);
  if (v >= 0) return [2, v, ''];
  return [3, 0, s.label ?? s.server_key]; // 명단에 없는 새 서버는 맨 뒤
};

const byDefault = (a: ServerMetric, b: ServerMetric) => {
  const [ga, ia, la] = defaultRank(a);
  const [gb, ib, lb] = defaultRank(b);
  return ga - gb || ia - ib || la.localeCompare(lb, 'ko');
};

/** 카드 부제의 호스트명을 읽을 수 있게 — "host-10-0-1-241" → "10.0.1.241".
 *
 *  VM 카드의 host 는 metrics_agent 가 socket.gethostname() 으로 보낸 값이라
 *  카카오가 붙인 "host-<IP를 하이픈으로>" 형태로 온다. 운영자에게는 읽히지 않는다.
 *  ★형태가 정확히 맞을 때만 바꾼다 — 노드 카드의 host("쿠버네티스 클러스터 안")나
 *  앞으로 다른 문구가 와도 건드리지 않는다. */
const prettyHost = (h: string) =>
  /^host(-\d{1,3}){4}$/.test(h) ? h.slice(5).replace(/-/g, '.') : h;

function Bar({
  label,
  pct,
  sub,
  subTitle,
}: {
  label: string;
  pct: number;
  sub: string;
  subTitle?: string;
}) {
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
      <span className="mon-metric-sub" title={subTitle}>
        {sub}
      </span>
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
  // 앱 카드(=서비스 한 종류에 여러 벌)인지 — 노드·VM 은 서버 한 대가 카드 하나다.
  const isApp = !s.server_key.startsWith('node:') && !s.server_key.startsWith('vm-');
  const fresh =
    s.stale
      ? { cls: 'mon-fresh--stale', txt: `${ago(s.age_sec)} · 오래됨` }
      : { cls: 'mon-fresh--ok', txt: ago(s.age_sec) };
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
          <h3 className="mon-card-title">
            {s.label}
            {isApp && s.cpu_cores ? <span className="mon-card-copies">{s.cpu_cores}벌</span> : null}
          </h3>
          {s.host && <span className="mon-card-host">{prettyHost(s.host)}</span>}
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
        // ★cpu_cores 는 카드에 따라 뜻이 다르다.
        //   ① 클러스터 노드(node:) — 실제 코어 수 (node-exporter)
        //   ② VM(vm-)           — 실제 코어 수 (metrics_agent 가 psutil 로 센다)
        //   ③ 그 밖의 앱 카드     — ★몇 벌 떠 있는지 (백엔드 _service_snapshots)
        //   ①②는 코어, ③만 '벌'이다. 그전에는 셋 다 "2 core" 로 찍혀서
        //   ★파드 2벌을 "2코어"라고 거짓말하고 있었다.
        //   ⚠️키 접두사로 가르므로 ★키 규칙을 바꾸면 여기도 바꿔야 한다.
        sub={
          s.server_key.startsWith('node:') || s.server_key.startsWith('vm-')
            ? `${s.cpu_cores ?? 0}코어${s.load1 != null ? ` · 부하 ${s.load1}` : ''}`
            : `${s.cpu_cores ?? 0}벌 실행 중`
        }
        subTitle={
          s.server_key.startsWith('node:') || s.server_key.startsWith('vm-')
            ? '부하 = 차례를 기다리는 작업 수. 코어 수보다 크면 일이 밀리고 있다는 뜻이에요.'
            : '이 서비스가 몇 벌 떠 있는지. 한 벌이 죽어도 나머지가 받아 줍니다.'
        }
      />
      <Bar
        label="메모리"
        pct={s.mem_pct ?? 0}
        sub={`${fmtInt(s.mem_used_mb ?? 0)} / ${fmtInt(s.mem_total_mb ?? 0)} MB`}
      />
      {s.disk_total_gb ? (
        <Bar
          label="디스크"
          pct={s.disk_pct ?? 0}
          sub={`${s.disk_used_gb ?? 0} / ${s.disk_total_gb} GB`}
        />
      ) : null}
      {s.gpu_present ? (
        <div className="mon-gpu">
          <div className="mon-gpu-name">
            <i className="ph-fill ph-graphics-card" /> {s.gpu_name ?? 'GPU'}
          </div>
          <Bar label="GPU 사용률" pct={s.gpu_util_pct ?? 0} sub="장별 평균" />
          <Bar
            label="VRAM"
            pct={
              s.gpu_mem_total_mb
                ? ((s.gpu_mem_used_mb ?? 0) / s.gpu_mem_total_mb) * 100
                : 0
            }
            sub={`${fmtInt(s.gpu_mem_used_mb ?? 0)} / ${fmtInt(s.gpu_mem_total_mb ?? 0)} MB · 합계`}
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

  // ★먼저 기본 순서(byDefault)로 세우고, 운영자가 드래그로 정한 순서가 있으면 그것을 덮는다.
  //   Array.sort 는 안정 정렬이라, order 에 없는 서버들은 ★기본 순서를 그대로 유지한다.
  const orderedServers = useMemo(() => {
    const base = [...(data?.servers ?? [])].sort(byDefault);
    if (order.length === 0) return base;
    const rank = (k: string) => {
      const i = order.indexOf(k);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return base.sort((a, b) => rank(a.server_key) - rank(b.server_key));
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
              각 서버가 지금 얼마나 바쁜지(CPU·메모리·디스크·GPU)와 AI 사용량을 봐요. 10초마다
              저절로 갱신돼요.
            </p>
            {/* 화면에 그대로 쓸 수밖에 없는 말만 골라 한 줄로 푼다 — 운영자는 개발자가 아니다.
                (카드 안에서 풀어 쓰면 숫자보다 설명이 길어져 오히려 안 읽힌다) */}
            <p className="op-sub mon-glossary">
              <b>부하</b> 차례를 기다리는 작업 수(코어 수보다 크면 밀리는 중) ·{' '}
              <b>토큰</b> AI 가 읽고 쓴 글자 묶음, 요금이 매겨지는 단위 ·{' '}
              <b>2-a · 2-b</b> 서버가 놓인 두 곳(한쪽이 죽어도 다른 쪽이 버팁니다)
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
            {CARD_GROUPS.map((g) => {
              const items = orderedServers.filter(g.match);
              if (!items.length) return null;
              return (
                <section key={g.key} className="mon-group">
                  <h2 className="mon-group-title">
                    {g.title} <span className="mon-group-count">{items.length}</span>
                  </h2>
                  <p className="mon-group-hint">{g.hint}</p>
                  <div className="mon-grid">
                    {items.map((s) => (
                      <ServerCard
                        key={s.server_key}
                        s={s}
                        onDragStart={() => (dragKey.current = s.server_key)}
                        onDrop={() => handleDrop(s.server_key)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            {/* 위 묶음 어디에도 안 들어가는 카드(새로 생긴 종류)는 빠뜨리지 않고 아래에 둔다 */}
            <div className="mon-grid">
              {orderedServers
                .filter((s) => !CARD_GROUPS.some((g) => g.match(s)))
                .map((s) => (
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
