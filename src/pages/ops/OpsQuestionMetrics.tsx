import { useEffect, useState } from 'react';
import OpsNav from '../../components/ops/OpsNav';
import { opsApi, type OpsQuestionMetricsResp, type OpsQuestionMetricsParams } from '../../api/ops';
import './OpsApproval.css';
import './OpsQuestionMetrics.css';
import { questionTypeLabel } from '../../constants/questionTypes';

/**
 * 문항 지표 — 문제은행 각 문항의 노출수·정답률(문제은행 2단계).
 *
 * 왜: 강의 자막→LLM으로 문항이 대량 유입되면 품질 편차가 생긴다. 운영자가 너무 쉬운(변별력↓)·
 * 너무 어려운(오류·난이도 점검)·표본 적은 문항을 한눈에 찾아 재검수·교체하도록 돕는다.
 * 근거는 graded(서버 채점) 시도만 — 자기신고(비검증)는 위조 가능이라 품질 지표에서 제외한다.
 */

const SUBJECTS = ['국어', '영어', '수학', '과학', '사회', '생활'];
const LIMIT = 50;

const SORTS: { key: NonNullable<OpsQuestionMetricsParams['sort']>; label: string }[] = [
  { key: 'most_shown', label: '노출 많은 순' },
  { key: 'hardest', label: '어려운 순 (정답률↓)' },
  { key: 'easiest', label: '쉬운 순 (정답률↑)' },
  { key: 'least_shown', label: '노출 적은 순' },
];

const FLAG_LABEL: Record<string, string> = {
  too_hard: '너무 어려움',
  too_easy: '너무 쉬움',
  low_sample: '표본 적음',
};

function accClass(acc: number, lowSample: boolean): string {
  if (lowSample) return 'qm-acc--low';
  if (acc <= 40) return 'qm-acc--hard';
  if (acc >= 90) return 'qm-acc--easy';
  return 'qm-acc--ok';
}

export default function OpsQuestionMetrics() {
  const [data, setData] = useState<OpsQuestionMetricsResp | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [subject, setSubject] = useState<string>(''); // '' = 전체
  const [sort, setSort] = useState<OpsQuestionMetricsParams['sort']>('most_shown');
  const [offset, setOffset] = useState(0);

  const load = () => {
    setState('loading');
    opsApi
      .questionMetrics({ subject: subject || undefined, sort, limit: LIMIT, offset })
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  // 필터·정렬·페이지 바뀔 때마다 다시 불러온다
  useEffect(load, [subject, sort, offset]);

  // 필터/정렬 바꾸면 첫 페이지로
  const changeSubject = (s: string) => {
    setOffset(0);
    setSubject(s);
  };
  const changeSort = (s: OpsQuestionMetricsParams['sort']) => {
    setOffset(0);
    setSort(s);
  };

  const total = data?.page.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + LIMIT, total);

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">문항 지표</h1>
            <p className="op-sub">
              문제은행 각 문항의 노출수·정답률. 서버 채점(graded) 시도만 집계합니다. 너무 쉬운(변별력↓)·
              너무 어려운·표본 적은 문항을 찾아 재검수·교체하세요.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" /> 새로고침
          </button>
        </div>

        {/* 요약 */}
        {data && (
          <div className="qm-summary">
            <div className="qm-sumcard">
              <span className="qm-sumval">{data.summary.questions.toLocaleString()}</span>
              <span className="qm-sumlbl">집계 문항</span>
            </div>
            <div className="qm-sumcard">
              <span className="qm-sumval">{data.summary.attempts.toLocaleString()}</span>
              <span className="qm-sumlbl">총 노출(시도)</span>
            </div>
            <div className="qm-sumcard">
              <span className="qm-sumval">
                {data.summary.avg_accuracy != null ? `${data.summary.avg_accuracy}%` : '—'}
              </span>
              <span className="qm-sumlbl">평균 정답률</span>
            </div>
            <div className="qm-sumcard qm-sumcard--hard">
              <span className="qm-sumval">{data.summary.too_hard.toLocaleString()}</span>
              <span className="qm-sumlbl">너무 어려움</span>
            </div>
            <div className="qm-sumcard qm-sumcard--easy">
              <span className="qm-sumval">{data.summary.too_easy.toLocaleString()}</span>
              <span className="qm-sumlbl">너무 쉬움</span>
            </div>
            <div className="qm-sumcard qm-sumcard--low">
              <span className="qm-sumval">{data.summary.low_sample.toLocaleString()}</span>
              <span className="qm-sumlbl">표본 적음</span>
            </div>
          </div>
        )}

        {/* 필터·정렬 */}
        <div className="qm-controls">
          <div className="qm-tabs">
            <button className={`qm-tab${subject === '' ? ' qm-tab-on' : ''}`} onClick={() => changeSubject('')}>
              전체
            </button>
            {SUBJECTS.map((s) => (
              <button
                key={s}
                className={`qm-tab${subject === s ? ' qm-tab-on' : ''}`}
                onClick={() => changeSubject(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            className="qm-sort"
            value={sort}
            onChange={(e) => changeSort(e.target.value as OpsQuestionMetricsParams['sort'])}
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {state === 'loading' && <div className="op-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="op-empty">
            문항 지표를 불러오지 못했어요.
            <button className="qm-retry" onClick={load}>
              다시 시도
            </button>
          </div>
        )}
        {state === 'ready' && data && data.items.length === 0 && (
          <div className="op-empty">아직 채점된 문항 풀이 기록이 없어요.</div>
        )}

        {state === 'ready' && data && data.items.length > 0 && (
          <>
            <div className="qm-tablewrap">
              <table className="qm-table">
                <thead>
                  <tr>
                    <th className="qm-th-q">문항</th>
                    <th>과목</th>
                    <th>유형</th>
                    <th className="qm-th-num">노출</th>
                    <th className="qm-th-acc">정답률</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((q) => {
                    const low = q.flags.includes('low_sample');
                    return (
                      <tr key={q.id}>
                        <td className="qm-td-q">
                          <span className="qm-prompt" title={q.prompt}>
                            {q.prompt}
                          </span>
                          {q.topic && <span className="qm-topic">{q.topic}</span>}
                        </td>
                        <td>{q.subject}</td>
                        <td className="qm-type">{questionTypeLabel(q.type)}</td>
                        <td className="qm-num">{q.attempts.toLocaleString()}</td>
                        <td>
                          <div className="qm-acc">
                            <div className="qm-acc-track">
                              <div
                                className={`qm-acc-fill ${accClass(q.accuracy, low)}`}
                                style={{ width: `${q.accuracy}%` }}
                              />
                            </div>
                            <span className="qm-acc-val">{q.accuracy}%</span>
                          </div>
                        </td>
                        <td>
                          {q.flags.length === 0 ? (
                            <span className="qm-flag qm-flag--ok">양호</span>
                          ) : (
                            q.flags.map((f) => (
                              <span key={f} className={`qm-flag qm-flag--${f}`}>
                                {FLAG_LABEL[f] ?? f}
                              </span>
                            ))
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="qm-pager">
              <span className="op-pageinfo">
                {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} / 총 {total.toLocaleString()}개
              </span>
              <div className="op-pagebtns">
                <button
                  className="op-pagebtn"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                >
                  <i className="ph-bold ph-caret-left" /> 이전
                </button>
                <button
                  className="op-pagebtn"
                  disabled={offset + LIMIT >= total}
                  onClick={() => setOffset(offset + LIMIT)}
                >
                  다음 <i className="ph-bold ph-caret-right" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
