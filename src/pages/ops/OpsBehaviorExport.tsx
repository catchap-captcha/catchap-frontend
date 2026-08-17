import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  behaviorExportsApi,
  type BehaviorExportJob,
  type BehaviorExportMode,
  type BehaviorExportPreview,
} from '../../api/behaviorExports';
import OpsNav from '../../components/ops/OpsNav';
import OpsSubTabs, { BEHAVIOR_TABS } from '../../components/ops/OpsSubTabs';
import { BEHAVIOR_SOURCE_OPTIONS } from '../../constants/behaviorSources';
import './OpsApproval.css';
import './OpsBehaviorExport.css';
import './OpsBehaviorExportAsync.css';

const DATASETS = [
  { v: 'included', label: '학습셋 포함' },
  { v: 'candidate', label: '후보' },
  { v: 'excluded', label: '제외' },
  { v: 'all', label: '전체' },
];

const STATUS: Record<string, string> = {
  pending: '대기',
  running: '생성 중',
  succeeded: '완료',
  failed: '실패',
  expired: '만료',
};

const PHASE: Record<string, string> = {
  queued: '작업 대기',
  querying: '데이터 조회',
  writing: 'CSV 생성',
  uploading: '비공개 저장소 업로드',
  completed: '완료',
  failed: '실패',
  expired: '보관 만료',
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('ko-KR') : '—';

const formatBytes = (value: number | null) => {
  if (value === null) return '—';
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / 1024 / 1024).toFixed(1) + ' MB';
};

export default function OpsBehaviorExport() {
  const [mode, setMode] = useState<BehaviorExportMode>('aggregate');
  const [dataset, setDataset] = useState('included');
  const [source, setSource] = useState('');
  const [risk, setRisk] = useState('');
  const [result, setResult] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dua, setDua] = useState(false);

  const [preview, setPreview] = useState<BehaviorExportPreview | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [jobs, setJobs] = useState<BehaviorExportJob[]>([]);
  const [activeJob, setActiveJob] = useState<BehaviorExportJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [notice, setNotice] = useState('');
  const idempotencyKey = useRef('');

  const filters = useMemo(
    () => ({
      mode,
      dataset,
      ...(source ? { source_type: source } : {}),
      ...(risk ? { risk } : {}),
      ...(result ? { result_filter: result } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    }),
    [mode, dataset, source, risk, result, dateFrom, dateTo],
  );

  const loadJobs = useCallback(async () => {
    const items = await behaviorExportsApi.list();
    setJobs(items);
    const running = items.find((job) => job.status === 'pending' || job.status === 'running');
    if (running) setActiveJob(running);
  }, []);

  useEffect(() => {
    loadJobs().catch(() => setNotice('최근 작업 이력을 불러오지 못했습니다.'));
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJob || !['pending', 'running'].includes(activeJob.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await behaviorExportsApi.get(activeJob.id);
        setActiveJob(next);
        setJobs((current) => [next, ...current.filter((job) => job.id !== next.id)]);
        if (!['pending', 'running'].includes(next.status)) {
          window.clearInterval(timer);
          setNotice(next.status === 'succeeded' ? '내보내기 파일 생성이 완료되었습니다.' : '내보내기 작업을 확인해 주세요.');
        }
      } catch {
        setNotice('작업 상태를 확인하지 못했습니다. 잠시 후 자동으로 다시 확인합니다.');
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeJob?.id, activeJob?.status]);

  const loadPreview = async () => {
    setPreviewState('loading');
    setPreview(null);
    setNotice('');
    try {
      setPreview(await behaviorExportsApi.preview(filters));
      setPreviewState('idle');
    } catch {
      setPreviewState('error');
    }
  };

  const createExport = async () => {
    const trimmedPurpose = purpose.trim();
    if (trimmedPurpose.length < 5) {
      setNotice('반출 목적을 5자 이상 입력해 주세요.');
      return;
    }
    if (mode === 'rows' && !dua) {
      setNotice('행 단위 원자료는 데이터 이용 조건을 확인해야 생성할 수 있습니다.');
      return;
    }

    setCreating(true);
    setNotice('');
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    try {
      const job = await behaviorExportsApi.create({
        ...filters,
        purpose: trimmedPurpose,
        dua_acknowledged: mode === 'rows' ? dua : false,
        idempotency_key: idempotencyKey.current,
      });
      idempotencyKey.current = '';
      setActiveJob(job);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setNotice('요청을 접수했습니다. 화면을 닫아도 서버에서 계속 생성합니다.');
    } catch (error: unknown) {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as { response?: { data?: { detail?: string | { message?: string } } } }).response?.data?.detail
          : null;
      setNotice(
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail?.message
            ? detail.message
            : '내보내기 요청을 접수하지 못했습니다.',
      );
    } finally {
      setCreating(false);
    }
  };

  const download = async (job: BehaviorExportJob) => {
    setDownloadingId(job.id);
    setNotice('');
    try {
      const link = await behaviorExportsApi.downloadLink(job.id);
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.download = link.file_name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice('5분 동안 유효한 다운로드 링크를 발급했습니다.');
    } catch {
      setNotice('다운로드 링크를 발급하지 못했습니다. 파일 만료 여부를 확인해 주세요.');
    } finally {
      setDownloadingId('');
    }
  };

  const progress =
    activeJob && activeJob.row_count > 0
      ? Math.min(100, Math.round((activeJob.processed_count / activeJob.row_count) * 100))
      : activeJob?.status === 'succeeded'
        ? 100
        : 0;

  return (
    <div className="op-root ops-export">
      <OpsNav />
      <main className="op-main">
        <div className="op-head ox-head">
          <div>
            <div className="ox-eyebrow">운영 데이터 · 통제된 반출</div>
            <h1 className="op-title">행동데이터 내보내기</h1>
            <p className="op-sub">
              조건 확인은 미리보기로, 실제 파일은 서버 작업으로 분리합니다. 결과는 비공개 저장소에 24시간 보관됩니다.
            </p>
          </div>
          <button className="op-refresh" onClick={loadPreview} disabled={previewState === 'loading'}>
            <i className="ph-bold ph-eye" />
            {previewState === 'loading' ? '확인 중…' : '미리보기'}
          </button>
        </div>

        <OpsSubTabs tabs={BEHAVIOR_TABS} />

        <section className="ox-workflow" aria-label="내보내기 처리 흐름">
          {['조건·목적 확인', '서버에서 CSV 생성', '비공개 저장소 24시간 보관', '5분 링크로 다운로드'].map((label, index) => (
            <div className="ox-workflow-step" key={label}>
              <span>{index + 1}</span>
              <b>{label}</b>
            </div>
          ))}
        </section>

        <div className="ox-note">
          <i className="ph-fill ph-shield-check" />
          <span>
            <b>집계</b>는 고유 학생 5명 미만 그룹을 제외합니다. <b>행 단위</b>는 가명 자료이며 데이터 이용 조건 확인 후에만 생성됩니다.
            미리보기·생성·다운로드 링크 발급은 서로 다른 감사 이벤트로 남습니다.
          </span>
        </div>

        <section className="ox-panel">
          <div className="ox-section-title">
            <span>1</span>
            <div><b>범위 설정</b><small>파일 생성 시점의 조건과 데이터 스냅샷을 고정합니다.</small></div>
          </div>

          <div className="ox-seg">
            <button
              className={'ox-segbtn' + (mode === 'aggregate' ? ' ox-segbtn-on' : '')}
              onClick={() => { setMode('aggregate'); setDua(false); }}
            >
              집계 통계 <small>권장 · 개인 행 없음</small>
            </button>
            <button
              className={'ox-segbtn' + (mode === 'rows' ? ' ox-segbtn-on' : '')}
              onClick={() => setMode('rows')}
            >
              행 단위 가명 자료 <small>추가 통제 필요</small>
            </button>
          </div>

          <div className="ox-filtergrid">
            <label className="ox-field"><span>데이터셋</span>
              <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
                {DATASETS.map((item) => <option key={item.v} value={item.v}>{item.label}</option>)}
              </select>
            </label>
            <label className="ox-field"><span>수집 경로</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                {BEHAVIOR_SOURCE_OPTIONS.map((item) => <option key={item.v} value={item.v}>{item.label}</option>)}
              </select>
            </label>
            <label className="ox-field"><span>위험도</span>
              <select value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option value="">전체</option><option value="low">낮음</option>
                <option value="review">검토</option><option value="elevated">높음</option>
              </select>
            </label>
            <label className="ox-field"><span>결과</span>
              <select value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">전체</option><option value="pass">통과</option><option value="fail">실패</option>
              </select>
            </label>
            <label className="ox-field ox-date"><span>기간</span>
              <div className="ox-daterange">
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
                <em>–</em>
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </label>
          </div>
        </section>

        <section className="ox-panel">
          <div className="ox-section-title">
            <span>2</span>
            <div><b>목적·통제 확인</b><small>감사 로그에 남을 업무 목적을 구체적으로 입력합니다.</small></div>
          </div>
          <div className="ox-requestrow">
            <label className="ox-purpose">
              <span>반출 목적 <b>필수</b></span>
              <input
                value={purpose}
                maxLength={255}
                placeholder="예: 2026년 8월 모델 품질 분석용 집계"
                onChange={(e) => setPurpose(e.target.value)}
              />
              <small>{purpose.trim().length}/255</small>
            </label>
            {mode === 'rows' && (
              <label className="ox-dua">
                <input type="checkbox" checked={dua} onChange={(e) => setDua(e.target.checked)} />
                <span><b>데이터 이용 조건 확인</b><small>재식별·재판매 금지 및 목적 외 사용 제한</small></span>
              </label>
            )}
            <button className="ox-create" onClick={createExport} disabled={creating || Boolean(activeJob && ['pending', 'running'].includes(activeJob.status))}>
              <i className="ph-bold ph-file-arrow-down" />
              {creating ? '요청 중…' : '내보내기 생성'}
            </button>
          </div>
          {notice && <div className="ox-notice" role="status">{notice}</div>}
        </section>

        {activeJob && (
          <section className="ox-current">
            <div className="ox-current-top">
              <div>
                <small>현재 작업</small>
                <b>{PHASE[activeJob.phase || ''] || activeJob.phase || STATUS[activeJob.status]}</b>
              </div>
              <span className={'ox-status ox-status-' + activeJob.status}>{STATUS[activeJob.status]}</span>
            </div>
            <div className="ox-progress"><span style={{ width: progress + '%' }} /></div>
            <div className="ox-jobfacts">
              <span>모드 <b>{activeJob.mode === 'aggregate' ? '집계' : '행 단위'}</b></span>
              <span>처리 <b>{activeJob.processed_count.toLocaleString()} / {activeJob.row_count.toLocaleString()}</b></span>
              <span>생성 <b>{formatDate(activeJob.created_at)}</b></span>
              <span>보관 만료 <b>{formatDate(activeJob.expires_at)}</b></span>
            </div>
            {activeJob.error_detail && <div className="ox-error">{activeJob.error_detail}</div>}
            {activeJob.status === 'succeeded' && (
              <button className="ox-download" onClick={() => download(activeJob)} disabled={downloadingId === activeJob.id}>
                <i className="ph-bold ph-link-simple" />
                {downloadingId === activeJob.id ? '링크 발급 중…' : '5분 다운로드 링크 발급'}
              </button>
            )}
          </section>
        )}

        <section className="ox-preview">
          <div className="ox-preview-head">
            <div><b>미리보기</b><small>최대 50행만 조회하며 파일은 만들지 않습니다.</small></div>
            {preview && <span>{preview.count.toLocaleString()}행 · 기준 {formatDate(preview.snapshot_at)}</span>}
          </div>
          {previewState === 'loading' && <div className="ox-empty">조건에 맞는 데이터를 확인하는 중입니다.</div>}
          {previewState === 'error' && <div className="ox-empty ox-error">미리보기를 불러오지 못했습니다.</div>}
          {previewState === 'idle' && !preview && <div className="ox-empty">상단의 ‘미리보기’를 눌러 생성 전 범위를 확인하세요.</div>}
          {preview && (
            <>
              {mode === 'aggregate' && preview.k_dropped > 0 && (
                <div className="ox-kdrop">고유 학생 {preview.k_anon_min}명 미만 그룹 {preview.k_dropped}개는 결과에서 제외됩니다.</div>
              )}
              <div className="ox-tablewrap">
                <table className="ox-table">
                  <thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                  <tbody>
                    {preview.rows.map((row, index) => (
                      <tr key={index}>{preview.columns.map((column) => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length === 0 && <div className="ox-empty">조건에 맞는 데이터가 없습니다.</div>}
            </>
          )}
        </section>

        <section className="ox-history">
          <div className="ox-preview-head"><div><b>최근 내보내기</b><small>본인이 요청한 최근 작업과 보관 상태입니다.</small></div></div>
          <div className="ox-history-list">
            {jobs.length === 0 && <div className="ox-empty">내보내기 이력이 없습니다.</div>}
            {jobs.map((job) => (
              <article key={job.id} className="ox-history-row">
                <span className={'ox-status ox-status-' + job.status}>{STATUS[job.status]}</span>
                <div className="ox-history-main">
                  <b>{job.mode === 'aggregate' ? '집계 통계' : '행 단위 가명 자료'} · {job.purpose}</b>
                  <small>{formatDate(job.created_at)} · {job.row_count.toLocaleString()}행 · {formatBytes(job.file_size)}</small>
                  {job.sha256 && <code title={job.sha256}>SHA-256 {job.sha256.slice(0, 12)}…</code>}
                </div>
                {job.status === 'succeeded' && (
                  <button className="ox-mini-download" onClick={() => download(job)} disabled={downloadingId === job.id}>
                    링크 발급
                  </button>
                )}
                {job.status === 'expired' && <span className="ox-expired">파일 삭제됨</span>}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
