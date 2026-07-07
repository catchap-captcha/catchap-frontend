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
  }, [source, result, group, dataset, risk]);

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
      // 모델 학습용 — 아동 개인정보 최소화: 실명·닉네임·정확한 나이는 넣지 않는다 (가명 코드·학년밴드만)
      const header = [
        '수집시각', '출처', '그룹', '학생코드', '학년밴드', '기관',
        '풀이시간ms', '경로길이', '평균속도', '멈춤수', '재시도수', '드롭거리norm',
        '결과', '위험도', '학습셋',
      ];
      downloadCSV(`catchap-behavior-${dateSuffix()}.csv`, [
        header,
        ...capped.map((r) => [
          r.occurred_at ?? r.created_at, r.source_type, r.student ? 'child' : 'anonymous',
          r.student?.student_code, r.student?.grade_band, r.organization_name,
          r.solve_time_ms, r.path_length, r.avg_speed, r.pause_count, r.retry_count,
          r.drop_distance_norm, r.interaction_result, r.risk_level, r.dataset_status,
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

        <div className="op-bh-filters">
          <select className="op-bh-select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">출처 전체</option>
            <option value="game">인앱 게임</option>
            <option value="edu-api">교육형 API</option>
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
          <span className="op-bh-total">
            총 {total.toLocaleString()}건
            {ov ? ` · 궤적 ${ov.trace_count.toLocaleString()}건` : ''}
          </span>
        </div>

        <div className="op-logcard">
          <div className="op-bh-head-row">
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
                <div key={r.id} className="op-bh-row">
                  <span className="op-logcol-time">{fmt(r.occurred_at ?? r.created_at)}</span>
                  <span className={`op-bh-src op-bh-src--${r.source_type === 'edu-api' ? 'edu' : 'game'}`}>
                    {SOURCE_LABEL[r.source_type] ?? r.source_type}
                  </span>
                  <span className="op-bh-who">
                    {r.student ? (
                      <>
                        <b>{r.student.nickname}</b>
                        <small>
                          {r.student.student_code}
                          {r.student.age != null ? ` · ${r.student.age}세` : ''}
                        </small>
                      </>
                    ) : (
                      <>
                        <b>익명</b>
                        <small>{r.organization_name ?? '외부 임베드'}</small>
                      </>
                    )}
                  </span>
                  <span className="op-mono">
                    {metricsText(r)}
                    {r.trace_points != null && (
                      <button
                        className="op-bh-tracebtn"
                        onClick={() => openTrace(r)}
                        title="원시 포인터 궤적 보기"
                      >
                        <i className="ph-fill ph-wave-sine" /> 궤적 {r.trace_points}점
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
                  <span className={`op-bh-risk op-bh-risk--${r.risk_level}`}>
                    {RISK_LABEL[r.risk_level] ?? r.risk_level}
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
          const pts = trace.points;
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
                  {rec.student ? `${rec.student.nickname} (${rec.student.student_code})` : '익명'} ·{' '}
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
                  <circle cx={first[1] * W} cy={first[2] * H} r="5" fill="#17b08c" />
                  <circle cx={last[1] * W} cy={last[2] * H} r="5" fill="#ff5a4d" />
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
