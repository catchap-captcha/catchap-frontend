import { useState } from 'react';
import { kstDateString } from '../../utils/format';

import { opsApi, type BehaviorExportPreview } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OpsBehaviorExport — 외부 업체(학습지사) 제공용 **익명** 행동데이터 내보내기.
 *
 * 두 모드: 집계(개인 0·k-익명성, 판매 최안전) / 행단위(가명 anon_code, 모델학습용).
 * 학교명·학생 식별정보는 서버가 전부 제거한다. 내보낼 때마다 감사로그가 남는다.
 */
type Mode = 'aggregate' | 'rows';

const SOURCES = [
  { v: '', label: '전체' },
  { v: 'edu-api', label: '교육형 위젯' },
  { v: 'game', label: '인앱 게임' },
  { v: 'forest', label: '메인 캡차' },
  { v: 'scratchpad', label: '연습장' },
];
const DATASETS = [
  { v: 'included', label: '학습셋 포함(큐레이션됨)' },
  { v: 'candidate', label: '후보' },
  { v: 'all', label: '전체' },
];

export default function OpsBehaviorExport() {
  const [mode, setMode] = useState<Mode>('aggregate');
  const [dataset, setDataset] = useState('included');
  const [source, setSource] = useState('');
  const [risk, setRisk] = useState('');
  const [result, setResult] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [preview, setPreview] = useState<BehaviorExportPreview | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [downloading, setDownloading] = useState(false);
  const [dlErr, setDlErr] = useState('');

  const params = () => ({
    mode,
    dataset,
    ...(source ? { source_type: source } : {}),
    ...(risk ? { risk } : {}),
    ...(result ? { result_filter: result } : {}),
    ...(fFrom ? { date_from: fFrom } : {}),
    ...(fTo ? { date_to: fTo } : {}),
  });

  const loadPreview = () => {
    setState('loading');
    setPreview(null);
    opsApi
      .behaviorExportPreview(params())
      .then((d) => {
        setPreview(d);
        setState('idle');
      })
      .catch(() => setState('error'));
  };

  const download = () => {
    // 외부 업체 제공용 반출 — 익명이지만 반출 자체가 민감 행위라 확인을 받는다
    if (!window.confirm(`익명 행동데이터(${mode === 'aggregate' ? '집계' : '행단위 가명'})를 CSV로 반출할까요? 반출은 감사 로그에 기록돼요.`)) return;
    setDlErr('');
    setDownloading(true);
    opsApi
      .behaviorExportCsv(params())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = kstDateString().replace(/-/g, ''); // KST 날짜 — toISOString(UTC)은 한국 새벽에 전날로 찍힘
        a.download = `catchap_behavior_${mode}_${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        // 실패를 무음으로 넘기지 않는다 — 에러 응답이 파일로 저장되거나 성공으로 보이면 안 됨
        setDlErr('CSV 반출에 실패했어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => setDownloading(false));
  };

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">외부 내보내기</h1>
            <p className="op-sub">
              외부 업체(학습지사)에 제공할 <b>익명</b> 행동데이터예요. 학교명·학생 식별정보는 빠지고,
              내보내기는 모두 감사 로그에 남아요.
            </p>
          </div>
          <button className="op-refresh" onClick={loadPreview}>
            <i className="ph-bold ph-eye" />
            미리보기
          </button>
        </div>

        {/* 익명화 안내 */}
        <div className="ox-note">
          <i className="ph-fill ph-shield-check" />
          <span>
            <b>집계 모드</b>는 개인 데이터가 0건인 집단 통계예요(소집단은 k-익명성으로 제외). <b>행단위</b>는
            가명(anon_code)이라 외부에서 되돌릴 수 없지만, <b>재식별·재판매 금지 계약(DUA)</b> 후에만
            제공하세요.
          </span>
        </div>

        {/* 옵션 */}
        <div className="ox-controls">
          <div className="ox-seg">
            <button
              className={`ox-segbtn${mode === 'aggregate' ? ' ox-segbtn-on' : ''}`}
              onClick={() => setMode('aggregate')}
            >
              집계 (판매용·최안전)
            </button>
            <button
              className={`ox-segbtn${mode === 'rows' ? ' ox-segbtn-on' : ''}`}
              onClick={() => setMode('rows')}
            >
              행단위 (가명·모델학습용)
            </button>
          </div>
          <label className="ox-field">
            데이터셋
            <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
              {DATASETS.map((d) => (
                <option key={d.v} value={d.v}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ox-field">
            수집 경로
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ox-field">
            위험도
            <select value={risk} onChange={(e) => setRisk(e.target.value)}>
              <option value="">전체</option>
              <option value="low">낮음</option>
              <option value="review">검토</option>
              <option value="elevated">높음</option>
            </select>
          </label>
          <label className="ox-field">
            결과
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">전체</option>
              <option value="pass">통과</option>
              <option value="fail">실패</option>
            </select>
          </label>
          <label className="ox-field">
            기간
            <span className="ox-daterange">
              <input type="date" value={fFrom} max={fTo || undefined} onChange={(e) => setFFrom(e.target.value)} />
              ~
              <input type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFTo(e.target.value)} />
            </span>
          </label>
          <button className="ox-download" onClick={download} disabled={downloading}>
            <i className="ph-bold ph-download-simple" />
            {downloading ? '내보내는 중…' : 'CSV 다운로드'}
          </button>
          {dlErr && (
            <span className="ox-dlerr"><i className="ph-fill ph-warning-circle" /> {dlErr}</span>
          )}
        </div>

        {/* 미리보기 */}
        <div className="op-logcard">
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">불러오지 못했어요. 운영자 로그인이 유효한지 확인하고 새로고침하세요.</div>
          )}
          {state === 'idle' && !preview && (
            <div className="op-logrow">미리보기를 눌러 내보낼 데이터를 확인하세요.</div>
          )}
          {preview && (
            <>
              <div className="ox-meta">
                {preview.count.toLocaleString()}행
                {mode === 'aggregate' && preview.k_dropped > 0 && (
                  <span className="ox-drop">
                    · k-익명성으로 소집단 {preview.k_dropped}개 제외(고유 학생 {preview.k_anon_min}명 미만)
                  </span>
                )}
              </div>
              <div className="ox-tablewrap">
                <table className="ox-table">
                  <thead>
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        {preview.columns.map((c) => (
                          <td key={c}>{r[c] as any}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 50 && (
                <div className="op-logrow">…미리보기는 50행까지. 전체는 CSV로 받으세요.</div>
              )}
              {preview.rows.length === 0 && (
                <div className="op-logrow">조건에 맞는 데이터가 없어요(데이터셋/경로 필터를 바꿔보세요).</div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
