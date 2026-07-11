import { useEffect, useRef, useState } from 'react';
import {
  opsApi,
  type BehaviorOverview,
  type BehaviorRecord,
  type BehaviorRecordsFilter,
  type BehaviorTraceDetail,
} from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import { dateSuffix, downloadCSV } from '../../utils/download';
import './OpsApproval.css';

const PAGE_SIZE = 50;
const EXPORT_CAP = 2000; // CSV 내보내기 상한 (서버 페이지 200 × 10회)

const SOURCE_LABEL: Record<string, string> = {
  game: '인앱 게임',
  'edu-api': '교육형 API',
  forest: '메인 캡차(숲)', // 로그인 게이트 forest 캡차 — 원시 문자열 노출 방지
  captcha: '캡차 API',
};
const RISK_LABEL: Record<string, string> = { low: '낮음', review: '검토', elevated: '높음' };
const GROUP_LABEL: Record<string, string> = {
  child: '아동 (학생 계정)',
  anonymous: '익명 (외부 임베드)',
};
// interaction_result는 수집 경로에 따라 correct/pass·incorrect/fail로 갈린다 — 표시 통합
const RESULT_META: Record<string, { label: string; cls: string }> = {
  correct: { label: '통과', cls: 'ok' },
  pass: { label: '통과', cls: 'ok' },
  incorrect: { label: '실패', cls: 'no' },
  fail: { label: '실패', cls: 'no' },
};
const GRADE_BAND_LABEL: Record<string, string> = {
  kindergarten: '유아',
  elementary_low: '초등 저학년',
  elementary_high: '초등 고학년',
};
const LABEL_META: Record<string, { label: string; cls: string }> = {
  organic: { label: '미검증', cls: 'org' },
  human: { label: '사람', cls: 'hum' },
  bot: { label: '봇', cls: 'bot' },
};
const DATASET_OPTS = [
  { key: 'candidate', label: '후보', cls: 'cand' },
  { key: 'included', label: '포함', cls: 'inc' },
  { key: 'excluded', label: '제외', cls: 'exc' },
] as const;

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

function metricsText(r: BehaviorRecord): string {
  return (
    `${(r.solve_time_ms / 1000).toFixed(1)}s · 경로 ${Math.round(r.path_length)}` +
    ` · 속도 ${r.avg_speed.toFixed(2)} · 멈춤 ${r.pause_count} · 재시도 ${r.retry_count}`
  );
}

// 목록 인라인 궤적 미리보기 — 운영자가 클릭 없이 드래그 모양을 한눈에 보고
// 학습셋(후보/포함/제외)을 판단하도록 돕는다. 서버가 내려준 다운샘플 [x,y]를 그린다.
function TraceSparkline({ points }: { points: [number, number][] }) {
  const W = 76;
  const H = 32;
  const pad = 3;
  const map = (v: number, size: number) => pad + v * (size - 2 * pad);
  const d = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${map(pt[0], W).toFixed(1)},${map(pt[1], H).toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <svg className="op-bh-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} fill="none" stroke="#7a5bd6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={map(first[0], W)} cy={map(first[1], H)} r="2" fill="#17b08c" />
      <circle cx={map(last[0], W)} cy={map(last[1], H)} r="2" fill="#ff5a4d" />
    </svg>
  );
}

/** 최근 7일 시간대(0~23시) 분포 — 봇은 심야에 몰리는 경향이 보인다 */
function HourBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="op-bh-hourbars">
      {data.map((v, h) => (
        <div key={h} className="op-bh-hourcol" title={`${h}시 · ${v}건`}>
          <div
            className={'op-bh-hourbar' + (h < 6 ? ' op-bh-hourbar--night' : '')}
            style={{ height: `${Math.max(2, Math.round((v / max) * 44))}px` }}
          />
          {h % 6 === 0 && <span className="op-bh-hourlb">{h}시</span>}
        </div>
      ))}
    </div>
  );
}

/** 풀이시간 히스토그램 — 구간 경계는 위험 스코어링 임계값(0.8s/1.5s/3s)과 정렬 */
function SolveHist({ edges, counts }: { edges: number[]; counts: number[] }) {
  const max = Math.max(1, ...counts);
  const lb = (i: number) => {
    const fmtMs = (v: number) => (v >= 1000 ? `${v / 1000}s` : `${v}ms`);
    return i < edges.length - 1 ? `${fmtMs(edges[i])}~${fmtMs(edges[i + 1])}` : `${fmtMs(edges[i])}+`;
  };
  return (
    <div className="op-bh-hist">
      {counts.map((v, i) => (
        <div key={i} className="op-bh-histcol" title={`${lb(i)} · ${v}건`}>
          <div
            className={'op-bh-histbar' + (i === 0 ? ' op-bh-histbar--danger' : i === 1 ? ' op-bh-histbar--warn' : '')}
            style={{ height: `${Math.max(2, Math.round((v / max) * 44))}px` }}
          />
          <span className="op-bh-histlb">{lb(i)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OpsBehavior() {
  const [ov, setOv] = useState<BehaviorOverview | null>(null);
  const [rows, setRows] = useState<BehaviorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [group, setGroup] = useState('');
  const [dataset, setDataset] = useState('');
  const [risk, setRisk] = useState('');
  const [label, setLabel] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  // 다중 선택 → bot/human 일괄 라벨링 (지도학습 정답표 큐레이션)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labeling, setLabeling] = useState(false);
  const [redteaming, setRedteaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  // 궤적 뷰어 모달 — 목록의 궤적 뱃지 클릭 시 원시 포인터 경로를 그려서 보여준다
  const [traceView, setTraceView] = useState<{ rec: BehaviorRecord; trace: BehaviorTraceDetail } | null>(null);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2600);
  };

  const filters = (): BehaviorRecordsFilter => ({
    ...(source ? { source } : {}),
    ...(result ? { result_filter: result } : {}),
    ...(group ? { group } : {}),
    ...(dataset ? { dataset } : {}),
    ...(risk ? { risk } : {}),
    ...(label ? { label } : {}),
    ...(fFrom ? { date_from: fFrom } : {}),
    ...(fTo ? { date_to: fTo } : {}),
  });

  // 필터 연속 변경 시 먼저 보낸 요청(이전 필터)의 늦은 응답이 최신 화면을 덮어쓰지 않도록 시퀀스 가드
  const loadSeq = useRef(0);

  const load = (off: number) => {
    const seq = ++loadSeq.current;
    setState('loading');
    Promise.all([
      opsApi.behaviorOverview(),
      opsApi.behaviorRecords({ ...filters(), limit: PAGE_SIZE, offset: off }),
    ])
      .then(([o, d]) => {
        if (seq !== loadSeq.current) return; // stale 응답 폐기
        setOv(o);
        setRows(d.items);
        setTotal(d.total);
        setOffset(off);
        setSelected(new Set()); // 목록이 갈리면 선택도 초기화 (엉뚱한 행 라벨링 방지)
        setState('ready');
      })
      .catch(() => {
        if (seq !== loadSeq.current) return;
        setState('error');
      });
  };

  // 필터가 바뀌면 1페이지부터 다시
  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, result, group, dataset, risk, label, fFrom, fTo]);

  const openTrace = (rec: BehaviorRecord) => {
    opsApi
      .behaviorTrace(rec.id)
      .then((trace) => setTraceView({ rec, trace }))
      .catch(() => say('궤적을 불러오지 못했어요.'));
  };

  const mark = (id: string, ds: string) => {
    opsApi
      .markBehaviorDataset(id, ds)
      // 로컬 패치 대신 재조회 — 학습셋 필터가 켜져 있으면 행이 필터에서 빠지는 것과
      // 총 건수·KPI가 함께 맞아야 하므로 목록/overview를 통째로 다시 불러온다
      .then(() => load(offset))
      .catch(() => say('학습셋 상태 변경에 실패했어요. 다시 시도해 주세요.'));
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set<string>() : new Set(rows.map((r) => r.id)),
    );
  };
  const markLabel = (sl: string) => {
    if (selected.size === 0 || labeling) return;
    // bot 라벨은 확정 — 지도학습 정답표 오염 방지를 위해 서버가 재라벨을 거부한다
    if (
      sl === 'bot' &&
      !window.confirm(`${selected.size}건을 '봇'으로 확정할까요? 봇 라벨은 되돌릴 수 없어요.`)
    )
      return;
    setLabeling(true);
    opsApi
      .markBehaviorLabel([...selected], sl)
      .then((d) => {
        const lockedNote = d.locked > 0 ? ` (봇 확정 ${d.locked}건은 변경 불가)` : '';
        say(`${d.changed}건을 '${LABEL_META[sl]?.label ?? sl}'로 라벨링했어요.${lockedNote}`);
        load(offset);
      })
      .catch(() => say('라벨 변경에 실패했어요. 다시 시도해 주세요.'))
      .finally(() => setLabeling(false));
  };
  const genRedteam = () => {
    if (redteaming) return;
    if (!window.confirm('합성 봇 트래픽 100건을 생성할까요? 격리 org에 sample_label=bot으로 적재되고 고객 집계에는 잡히지 않아요.')) return;
    setRedteaming(true);
    opsApi
      .behaviorRedteam(100)
      .then((d) => {
        say(`봇 표본 ${d.created}건을 생성했어요.`);
        load(0);
      })
      .catch(() => say('봇 표본 생성에 실패했어요.'))
      .finally(() => setRedteaming(false));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      // 내보내는 도중 새 레코드가 삽입되면 offset 페이지가 밀려 같은 행이 두 번 올 수 있다 → id로 중복 제거
      const seen = new Set<string>();
      const all: BehaviorRecord[] = [];
      let tot = Infinity;
      let fetched = 0;
      while (fetched < tot && all.length < EXPORT_CAP) {
        const d = await opsApi.behaviorRecords({ ...filters(), limit: 200, offset: fetched });
        tot = d.total;
        if (d.items.length === 0) break;
        fetched += d.items.length;
        for (const r of d.items) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            all.push(r);
          }
        }
      }
      const capped = all.slice(0, EXPORT_CAP);
      // 모델 학습용 — 아동 개인정보 최소화: 실명·닉네임·학생코드·정확한 나이는 넣지 않는다 (익명 코드·학년밴드만)
      const header = [
        '수집시각', '출처', '그룹', '익명코드', '학년밴드', '기관',
        '풀이시간ms', '경로길이', '평균속도', '멈춤수', '재시도수', '드롭거리norm',
        '결과', '위험도', '입력방식', '라벨', '학습셋',
      ];
      downloadCSV(`catchap-behavior-${dateSuffix()}.csv`, [
        header,
        ...capped.map((r) => [
          r.occurred_at ?? r.created_at, r.source_type, r.student ? 'child' : 'anonymous',
          r.student?.anon_code, r.student?.grade_band, r.organization_name,
          r.solve_time_ms, r.path_length, r.avg_speed, r.pause_count, r.retry_count,
          r.drop_distance_norm, r.interaction_result, r.risk_level,
          r.input_type, r.sample_label, r.dataset_status,
        ]),
      ]);
      say(
        capped.length < tot
          ? `상위 ${capped.length}건만 내보냈어요 (전체 ${tot}건).`
          : `${capped.length}건을 내보냈어요.`,
      );
    } catch {
      say('CSV 내보내기에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setExporting(false);
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="op-root">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">행동 데이터</h1>
            <p className="op-sub">
              교육용 API·캡차를 풀 때 쌓이는 행동 데이터예요. 아동용 캡차 판정 모델의 학습셋을
              여기서 살펴보고 관리해요.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="op-refresh" onClick={genRedteam} disabled={redteaming} title="지도학습 음성 클래스(봇) 표본을 격리 org에 생성">
              <i className="ph-bold ph-robot" />
              {redteaming ? '생성 중…' : '봇 표본 생성'}
            </button>
            <button className="op-refresh" onClick={exportCsv} disabled={exporting}>
              <i className="ph-bold ph-download-simple" />
              {exporting ? '내보내는 중…' : 'CSV 내보내기'}
            </button>
            <button className="op-refresh" onClick={() => load(offset)}>
              <i className="ph-bold ph-arrows-clockwise" />
              새로고침
            </button>
          </div>
        </div>

        {ov && (
          <div className="op-kpis">
            <div className="op-kpi">
              <div className="op-kpi-ic op-kpi-ic--log"><i className="ph-fill ph-fingerprint" /></div>
              <div className="op-kpi-num">{ov.total.toLocaleString()}</div>
              <div className="op-kpi-lb">수집된 행동 데이터</div>
            </div>
            <div className="op-kpi">
              <div className="op-kpi-ic op-kpi-ic--stu"><i className="ph-fill ph-trend-up" /></div>
              <div className="op-kpi-num">{ov.week_count.toLocaleString()}</div>
              <div className="op-kpi-lb">최근 7일 수집</div>
            </div>
            <div className="op-kpi">
              <div className="op-kpi-ic op-kpi-ic--inq"><i className="ph-fill ph-graduation-cap" /></div>
              <div className="op-kpi-num">{(ov.by_source['edu-api'] ?? 0).toLocaleString()}</div>
              <div className="op-kpi-lb">교육형 API 수집</div>
            </div>
            <div className="op-kpi">
              <div className="op-kpi-ic op-kpi-ic--org"><i className="ph-fill ph-check-square" /></div>
              <div className="op-kpi-num">{(ov.by_dataset['included'] ?? 0).toLocaleString()}</div>
              <div className="op-kpi-lb">학습셋 포함</div>
            </div>
          </div>
        )}

        {ov && (
          <div className="op-bh-compare">
            <div className="op-bh-compare-h">
              <i className="ph-fill ph-scales" /> 아동 vs 익명 행동 지표 비교
            </div>
            <p className="op-bh-note">
              같은 과제에서 아동(학생 계정)과 익명(외부 임베드·성인 포함) 그룹의 행동이 얼마나
              갈라지는지 보여줘요. 이 차이가 아동용 캡차 판정 모델의 근거가 돼요.
            </p>
            <div className="op-bhc-head">
              <span>그룹</span><span>표본</span><span>평균 풀이시간</span><span>경로 길이</span>
              <span>평균 속도</span><span>멈춤</span><span>재시도</span>
            </div>
            {ov.comparison.map((g) => (
              <div key={g.group} className="op-bhc-row">
                <span className={`op-bh-group op-bh-group--${g.group}`}>
                  <i className={`ph-fill ${g.group === 'child' ? 'ph-baby' : 'ph-globe'}`} />
                  {GROUP_LABEL[g.group] ?? g.group}
                </span>
                <span className="op-mono">{g.count.toLocaleString()}건</span>
                <span className="op-mono">
                  {g.avg_solve_time_ms != null ? `${(g.avg_solve_time_ms / 1000).toFixed(1)}s` : '-'}
                </span>
                <span className="op-mono">{g.avg_path_length ?? '-'}</span>
                <span className="op-mono">{g.avg_speed ?? '-'}</span>
                <span className="op-mono">{g.avg_pause_count ?? '-'}</span>
                <span className="op-mono">{g.avg_retry_count ?? '-'}</span>
              </div>
            ))}
          </div>
        )}

        {ov && (
          <div className="op-bh-charts">
            <div className="op-bh-chart">
              <div className="op-bh-chart-h"><i className="ph-fill ph-clock" /> 최근 7일 시간대 분포 (KST)</div>
              <HourBars data={ov.hourly_week ?? []} />
            </div>
            <div className="op-bh-chart">
              <div className="op-bh-chart-h"><i className="ph-fill ph-chart-bar" /> 풀이시간 분포</div>
              <SolveHist edges={ov.solve_hist?.edges_ms ?? []} counts={ov.solve_hist?.counts ?? []} />
              <div className="op-bh-chart-note">0.8s 미만 정답=강신호 · 라벨: 미검증 {ov.by_label?.organic ?? 0} / 사람 {ov.by_label?.human ?? 0} / 봇 {ov.by_label?.bot ?? 0}</div>
            </div>
          </div>
        )}

        <div className="op-bh-filters">
          <select className="op-bh-select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">출처 전체</option>
            <option value="game">인앱 게임</option>
            <option value="edu-api">교육형 API</option>
            <option value="forest">메인 캡차(숲)</option>
          </select>
          <select className="op-bh-select" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">그룹 전체</option>
            <option value="student">아동 (학생 계정)</option>
            <option value="anonymous">익명 (외부 임베드)</option>
          </select>
          <select className="op-bh-select" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">결과 전체</option>
            <option value="pass">통과</option>
            <option value="fail">실패</option>
          </select>
          <select className="op-bh-select" value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">위험도 전체</option>
            <option value="low">낮음</option>
            <option value="review">검토</option>
            <option value="elevated">높음</option>
          </select>
          <select className="op-bh-select" value={dataset} onChange={(e) => setDataset(e.target.value)}>
            <option value="">학습셋 전체</option>
            <option value="candidate">후보</option>
            <option value="included">포함</option>
            <option value="excluded">제외</option>
          </select>
          <select className="op-bh-select" value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">라벨 전체</option>
            <option value="organic">미검증</option>
            <option value="human">사람</option>
            <option value="bot">봇</option>
          </select>
          <input className="op-bh-date" type="date" value={fFrom} max={fTo || undefined} onChange={(e) => setFFrom(e.target.value)} title="시작일" />
          <span className="op-bh-datedash">~</span>
          <input className="op-bh-date" type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFTo(e.target.value)} title="종료일" />
          <span className="op-bh-total">
            총 {total.toLocaleString()}건
            {ov ? ` · 궤적 ${ov.trace_count.toLocaleString()}건` : ''}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="op-bh-selbar">
            <span className="op-bh-selcount">{selected.size}건 선택됨</span>
            <button className="op-bh-selbtn op-bh-selbtn--hum" disabled={labeling} onClick={() => markLabel('human')}>
              <i className="ph-fill ph-user" /> 사람으로 라벨
            </button>
            <button className="op-bh-selbtn op-bh-selbtn--bot" disabled={labeling} onClick={() => markLabel('bot')}>
              <i className="ph-fill ph-robot" /> 봇으로 라벨
            </button>
            <button className="op-bh-selbtn" disabled={labeling} onClick={() => markLabel('organic')}>
              미검증으로 되돌리기
            </button>
            <button className="op-bh-selbtn" onClick={() => setSelected(new Set())}>선택 해제</button>
          </div>
        )}

        <div className="op-logcard">
          <div className="op-bh-head-row">
            <span>
              <input
                type="checkbox"
                className="op-bh-check"
                checked={rows.length > 0 && selected.size === rows.length}
                onChange={toggleAll}
                title="현재 페이지 전체 선택"
              />
            </span>
            <span>수집 시각</span><span>출처</span><span>대상</span><span>행동 지표</span>
            <span>결과</span><span>위험도</span><span>학습셋</span>
          </div>
          {state === 'loading' && <div className="op-bh-row">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-bh-row">행동 데이터를 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-bh-row">조건에 맞는 데이터가 아직 없어요.</div>
          )}
          {state === 'ready' &&
            rows.map((r) => {
              const res = r.interaction_result ? RESULT_META[r.interaction_result] : null;
              return (
                <div key={r.id} className={'op-bh-row' + (selected.has(r.id) ? ' op-bh-row--sel' : '')}>
                  <span>
                    <input
                      type="checkbox"
                      className="op-bh-check"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSel(r.id)}
                    />
                  </span>
                  <span className="op-logcol-time">{fmt(r.occurred_at ?? r.created_at)}</span>
                  <span className={`op-bh-src op-bh-src--${r.source_type === 'edu-api' ? 'edu' : 'game'}`}>
                    {SOURCE_LABEL[r.source_type] ?? r.source_type}
                  </span>
                  <span className="op-bh-who">
                    {r.student ? (
                      <>
                        {/* 아동 PII 비노출 — 서버가 내려주는 익명 코드만 표시 */}
                        <b>학생 {r.student.anon_code}</b>
                        <small>
                          {GRADE_BAND_LABEL[r.student.grade_band] ?? r.student.grade_band}
                          {r.organization_name ? ` · ${r.organization_name}` : ''}
                        </small>
                      </>
                    ) : (
                      <>
                        <b>익명</b>
                        <small>{r.organization_name ?? '외부 임베드'}</small>
                      </>
                    )}
                  </span>
                  <span className="op-mono op-bh-metrics">
                    <span className="op-bh-metrics-txt">{metricsText(r)}</span>
                    {r.trace_points != null && (
                      <button
                        className="op-bh-tracebtn"
                        onClick={() => openTrace(r)}
                        title="원시 포인터 궤적 크게 보기"
                      >
                        {r.trace_preview && r.trace_preview.length > 1 ? (
                          <TraceSparkline points={r.trace_preview} />
                        ) : (
                          <i className="ph-fill ph-wave-sine" />
                        )}
                        <span className="op-bh-tracen">궤적 {r.trace_points}점</span>
                      </button>
                    )}
                  </span>
                  <span>
                    {res ? (
                      <span className={`op-orgstatus op-orgstatus--${res.cls === 'ok' ? 'active' : 'disabled'} op-bh-res--${res.cls}`}>
                        {res.label}
                      </span>
                    ) : (
                      '-'
                    )}
                  </span>
                  <span className="op-bh-riskcell">
                    <span className={`op-bh-risk op-bh-risk--${r.risk_level}`}>
                      {RISK_LABEL[r.risk_level] ?? r.risk_level}
                    </span>
                    {r.sample_label && r.sample_label !== 'organic' && (
                      <span
                        className={`op-bh-label op-bh-label--${LABEL_META[r.sample_label]?.cls ?? 'org'}`}
                        title={r.sample_label === 'bot' ? '봇 확정 — 변경 불가' : undefined}
                      >
                        {r.sample_label === 'bot' && <i className="ph-fill ph-lock-simple" />}
                        {LABEL_META[r.sample_label]?.label ?? r.sample_label}
                      </span>
                    )}
                  </span>
                  <span className="op-bh-ds">
                    {DATASET_OPTS.map((o) => (
                      <button
                        key={o.key}
                        className={
                          `op-bh-dsbtn op-bh-dsbtn--${o.cls}` +
                          (r.dataset_status === o.key ? ' op-bh-dsbtn--on' : '')
                        }
                        onClick={() => r.dataset_status !== o.key && mark(r.id, o.key)}
                        title={`학습셋 ${o.label}로 표시`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
        </div>

        {total > PAGE_SIZE && (
          <div className="op-bh-foot">
            <button
              className="op-refresh"
              disabled={offset === 0 || state === 'loading'}
              onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            >
              <i className="ph-bold ph-caret-left" /> 이전
            </button>
            <span className="op-bh-total">{page} / {pages} 페이지</span>
            <button
              className="op-refresh"
              disabled={offset + PAGE_SIZE >= total || state === 'loading'}
              onClick={() => load(offset + PAGE_SIZE)}
            >
              다음 <i className="ph-bold ph-caret-right" />
            </button>
          </div>
        )}
      </main>

      {traceView &&
        (() => {
          const { rec, trace } = traceView;
          const W = 460;
          const aspect = trace.box_w > 0 && trace.box_h > 0 ? trace.box_h / trace.box_w : 0.62;
          const H = Math.max(160, Math.min(460, Math.round(W * aspect)));
          // point_count 0인 레코드도 버튼이 보여 빈 배열이 올 수 있다 — first/last 인덱싱 크래시 방지
          const pts = Array.isArray(trace.points) ? trace.points : [];
          const d = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p[1] * W).toFixed(1)},${(p[2] * H).toFixed(1)}`)
            .join(' ');
          const first = pts[0];
          const last = pts[pts.length - 1];
          return (
            <div className="op-bh-overlay" onClick={() => setTraceView(null)}>
              <div className="op-bh-modal" onClick={(e) => e.stopPropagation()}>
                <div className="op-bh-modal-h">
                  <span>
                    <i className="ph-fill ph-wave-sine" /> 포인터 궤적
                  </span>
                  <button className="op-bh-modal-x" onClick={() => setTraceView(null)}>
                    <i className="ph-bold ph-x" />
                  </button>
                </div>
                <div className="op-bh-modal-meta">
                  {rec.student ? `학생 ${rec.student.anon_code}` : '익명'} ·{' '}
                  {SOURCE_LABEL[rec.source_type] ?? rec.source_type} · {trace.point_count}점 ·{' '}
                  {(trace.duration_ms / 1000).toFixed(1)}초
                  {trace.box_w > 0 ? ` · 영역 ${trace.box_w}×${trace.box_h}px` : ''}
                </div>
                <svg className="op-bh-svg" viewBox={`0 0 ${W} ${H}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#7a5bd6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {first && <circle cx={first[1] * W} cy={first[2] * H} r="5" fill="#17b08c" />}
                  {last && <circle cx={last[1] * W} cy={last[2] * H} r="5" fill="#ff5a4d" />}
                </svg>
                <div className="op-bh-modal-legend">
                  <span>
                    <span className="op-bh-dot" style={{ background: '#17b08c' }} /> 시작
                  </span>
                  <span>
                    <span className="op-bh-dot" style={{ background: '#ff5a4d' }} /> 끝
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      {toast && <div className="op-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </div>
  );
}
