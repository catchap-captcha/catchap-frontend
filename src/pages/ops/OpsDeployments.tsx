import { useCallback, useEffect, useState } from 'react';
import { deploymentApi, type DeploymentSnapshot } from '../../api/deployments';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css'; // 표준 콘솔 셸(op-root/op-main)·테마 토큰 — 다른 페이지와 폭·색을 맞춘다
import './OpsDeployments.css';

/**
 * 배포 현황 — 지금 무엇이 떠 있나.
 *
 * 왜 있나: 배포된 코드가 어느 커밋인지 아는 방법이 「서버에 들어가 kubectl 을 치는 것」뿐이었다.
 * 그 방법을 아는 사람이 한 명이라, 장애가 나면 그 한 명을 기다려야 했다.
 * 이미지 태그가 커밋 해시라서, 여기서 태그만 보면 `git show <태그>` 로 그 코드를 볼 수 있다.
 *
 * ★읽기만 한다: 배포·롤백 버튼은 일부러 없다. 그건 ArgoCD 화면에서 한다.
 * 여기에 두면 운영자 계정 하나가 뚫렸을 때 클러스터를 바꿀 수 있게 된다.
 *
 * ★가짜를 그리지 않는다: 못 불러오면 못 불러왔다고 적는다. 빈 목록을 「배포 없음」처럼
 * 보이게 하지 않는다 — 수집이 끊긴 것과 진짜로 파드가 0개인 것은 다르다.
 */

/** ISO 시각을 「몇 분 전」으로. 아주 오래된 것은 날짜로 보여 준다. */
function ago(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

/** 서비스 이름을 사람이 읽는 말로. 모르는 이름은 그대로 둔다. */
const LABEL: Record<string, string> = {
  'backend-api': '백엔드 API',
  frontend: '화면',
  'captcha-api': '캡차',
  'behavior-ai': '행동 판별 AI',
};

export default function OpsDeployments() {
  const [snap, setSnap] = useState<DeploymentSnapshot | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnap(await deploymentApi.list());
      setError('');
    } catch (e: unknown) {
      // ★사유를 그대로 보여 준다. "불러오지 못했습니다" 한 줄로 뭉개면
      //   권한 문제인지 클러스터가 안 붙는지 알 수 없어 고칠 데를 못 찾는다.
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as Error)?.message ??
        '알 수 없는 오류';
      setError(String(detail));
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // 30초마다 새로 고친다 — 배포 중에 눈으로 따라갈 수 있게.
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <header className="dep-head">
          <div>
            <h1>배포 현황</h1>
            <p className="dep-sub">
              지금 클러스터에 떠 있는 것입니다. <strong>읽기 전용</strong>이라
              여기서 배포하거나 되돌릴 수는 없습니다 — 그건 ArgoCD 화면에서 합니다.
            </p>
          </div>
          <button type="button" className="dep-refresh" onClick={() => void load()} disabled={loading}>
            {loading ? '불러오는 중…' : '새로 고침'}
          </button>
        </header>

        {error && (
          <div className="dep-error" role="alert">
            <strong>배포 상태를 불러오지 못했습니다.</strong>
            <p className="dep-error-detail">{error}</p>
            <p className="dep-error-hint">
              ⚠️ 이 화면이 비어 있다고 해서 배포가 없는 것은 아닙니다.
              읽기에 실패한 것이니 <strong>서비스는 돌고 있을 수 있습니다.</strong>
            </p>
          </div>
        )}

        {!error && snap && (
          <>
            <div className="dep-summary">
              <span className="dep-chip ok">정상 {snap.summary.healthy}</span>
              {snap.summary.unhealthy > 0 && (
                <span className="dep-chip bad">확인 필요 {snap.summary.unhealthy}</span>
              )}
              <span className="dep-meta">
                {snap.namespace} · {ago(snap.collected_at)} 기준
              </span>
            </div>

            {snap.deployments.length === 0 ? (
              <p className="dep-empty">
                이 네임스페이스에 배포가 없습니다. (읽기는 성공했습니다)
              </p>
            ) : (
              <table className="dep-table">
                <thead>
                  <tr>
                    <th>서비스</th>
                    <th>버전(커밋)</th>
                    <th>파드</th>
                    <th>마지막 변경</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.deployments.map((d) => (
                    <tr key={d.name} className={d.healthy ? '' : 'bad'}>
                      <td>
                        <span className="dep-name">{LABEL[d.name] ?? d.name}</span>
                        <span className="dep-raw">{d.name}</span>
                      </td>
                      <td>
                        <code className="dep-tag" title={d.image}>{d.tag}</code>
                      </td>
                      <td>
                        {d.replicas_ready} / {d.replicas_desired}
                      </td>
                      <td>{ago(d.updated_at)}</td>
                      <td>
                        {d.healthy ? (
                          <span className="dep-chip ok">정상</span>
                        ) : (
                          <span className="dep-chip bad">확인 필요</span>
                        )}
                        {d.conditions.length > 0 && (
                          <ul className="dep-conds">
                            {d.conditions.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="dep-foot">
              <strong>버전(커밋)</strong> 은 이미지 태그입니다. 그 값으로{' '}
              <code>git show &lt;커밋&gt;</code> 하면 지금 떠 있는 코드를 그대로 볼 수 있습니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
