import { useEffect, useState } from 'react';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  opsApi,
  opsAccountApi,
  type OpsDashboard,
  type OpsSystemHealth,
  type OpsAuditLog,
} from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import { AUDIT_ACTION_META, AUDIT_TARGET_LABEL } from '../../constants/auditActions';
import { SERVICE_NAME_META } from '../../constants/systemServices';
import { PATHS } from '../../routes/paths';
import CountUp from '../../components/motion/CountUp';
import './OpsApproval.css';
import './OpsHome.css';

/**
 * 운영 홈(운영자 착지 대시보드) — 종전엔 로그인하면 곧장 '기관 승인' 목록으로 떨어져
 * "오늘 뭘 처리하고 시스템이 괜찮은지"를 한눈에 볼 화면이 없었다. 처리 대기(승인·문의·
 * 잠금·행동 검토) + 시스템 헬스 + 서비스 규모 + 최근 감사 로그를 한 장으로 모은다.
 *
 * 데이터는 전부 기존 엔드포인트 재사용(신규 백엔드 없음) — 하나가 실패해도 나머지는
 * 뜨도록 allSettled로 부분 로딩하고, 못 불러온 값은 0으로 위장하지 않고 '—'로 둔다.
 */
interface HomeData {
  dashboard: OpsDashboard | null;
  // 기관 승인(가입 승인)은 별도 페이지라 운영 홈엔 싣지 않는다(사용자 결정) — 승인 대기 KPI 제외.
  locked: number | null; // 로그인 잠금(캡차 임계 초과) 계정
  behaviorReview: number | null; // 행동 데이터 검토 대기(risk=review/elevated)
  health: OpsSystemHealth | null;
  logs: OpsAuditLog[] | null;
}

const EMPTY: HomeData = {
  dashboard: null,
  locked: null,
  behaviorReview: null,
  health: null,
  logs: null,
};

/** 서비스 상태 → 점 색/문구. 헬스 카드에서만 쓴다. */
function healthTone(status: string): { cls: string; label: string } {
  switch (status) {
    case 'ok':
      return { cls: 'oh-dot--ok', label: '정상' };
    case 'degraded':
      return { cls: 'oh-dot--warn', label: '주의' };
    case 'error':
      return { cls: 'oh-dot--err', label: '오류' };
    case 'dry-run':
      return { cls: 'oh-dot--warn', label: '드라이런' };
    default:
      return { cls: 'oh-dot--muted', label: '미배포' };
  }
}

/** 감사 로그 시각 — 오늘이면 'HH:mm', 아니면 'M/D HH:mm'(파싱 실패 시 빈 문자열) */
function fmtLogTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** 처리 대기 KPI 한 장 — 담당 페이지로 이동하는 링크 카드. 값이 null이면 '—'. */
function TriageKpi({
  to, icon, tone, value, label,
}: {
  to: string; icon: string; tone: string; value: number | null; label: string;
}) {
  return (
    <Link to={to} className={`oh-kpi oh-kpi--${tone}`}>
      <span className={`oh-kpi-ic oh-kpi-ic--${tone}`}>
        <i className={icon} />
      </span>
      <span className="oh-kpi-num">{value === null ? '—' : <CountUp value={value} />}</span>
      <span className="oh-kpi-lb">
        {label}
        <i className="ph-bold ph-arrow-right oh-kpi-go" />
      </span>
    </Link>
  );
}

/** 서비스 규모 미니 지표 한 칸 */
function ScaleStat({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="oh-scale">
      <span className="oh-scale-num">
        {value === null || value === undefined ? '—' : <CountUp value={value} />}
      </span>
      <span className="oh-scale-lb">{label}</span>
    </div>
  );
}

export default function OpsHome() {
  const navigate: NavigateFunction = useNavigate();
  const [d, setD] = useState<HomeData>(EMPTY);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    Promise.allSettled([
      opsApi.dashboard(),
      opsAccountApi.throttles(true),
      opsApi.system(),
      opsApi.logs({ page: 1, page_size: 6 }),
      opsApi.behaviorOverview(),
    ]).then(([dash, thr, sys, logs, beh]) => {
      const review =
        beh.status === 'fulfilled'
          ? (beh.value.by_risk?.review ?? 0) + (beh.value.by_risk?.elevated ?? 0)
          : null;
      setD({
        dashboard: dash.status === 'fulfilled' ? dash.value : null,
        locked: thr.status === 'fulfilled' ? (thr.value.items?.length ?? 0) : null,
        behaviorReview: review,
        health: sys.status === 'fulfilled' ? sys.value : null,
        logs: logs.status === 'fulfilled' ? (logs.value.items ?? []) : null,
      });
      // 하나라도 성공하면 화면을 세운다. 전부 실패면(로그인 만료 등) 에러 카드.
      setState(
        [dash, thr, sys, logs, beh].some((r) => r.status === 'fulfilled') ? 'ready' : 'error',
      );
    });
  };
  useEffect(load, []);

  const dash = d.dashboard;

  return (
    <div className="op-root">
      <OpsNav />
      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">운영 홈</h1>
            <p className="op-sub">오늘 처리할 일과 시스템 상태를 한눈에 봅니다.</p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        {state === 'loading' && (
          <div className="op-empty">
            <i className="ph-fill ph-spinner-gap" />
            <p>불러오는 중…</p>
          </div>
        )}
        {state === 'error' && (
          <div className="op-empty">
            <i className="ph-fill ph-warning-circle" />
            <p>운영 지표를 불러오지 못했어요. 로그인이 만료됐을 수 있어요.</p>
          </div>
        )}

        {state === 'ready' && (
          <>
            {/* 처리 대기 — 지금 손봐야 할 것. 각 카드는 담당 페이지로 이동. */}
            <p className="oh-sec-label">처리 대기</p>
            <div className="oh-kpis">
              <TriageKpi
                to={PATHS.OPS_INQUIRIES}
                icon="ph-fill ph-chat-circle-dots"
                tone="info"
                value={dash ? dash.open_inquiries : null}
                label="미답변 문의 · 고객·강사"
              />
              <TriageKpi
                to={PATHS.OPS_ACCOUNT_UNLOCK}
                icon="ph-fill ph-lock-key-open"
                tone="danger"
                value={d.locked}
                label="잠금 계정 · 로그인 해제"
              />
              <TriageKpi
                to={PATHS.OPS_BEHAVIOR}
                icon="ph-fill ph-fingerprint"
                tone="review"
                value={d.behaviorReview}
                label="행동 데이터 검토 · 봇 의심"
              />
            </div>

            <div className="oh-cols">
              {/* 시스템 헬스 — 구성요소 상태 + 오늘 호출·오류율 */}
              <section className="oh-card">
                <div className="oh-card-head">
                  <i className="ph-fill ph-heartbeat" />
                  <h2 className="oh-card-title">시스템 상태</h2>
                  <Link to={PATHS.OPS_SYSTEM_STATUS} className="oh-card-more">
                    자세히 <i className="ph-bold ph-arrow-right" />
                  </Link>
                </div>
                {d.health?.services?.length ? (
                  <div className="oh-health">
                    {d.health.services.map((s) => {
                      const t = healthTone(s.status);
                      return (
                        <div key={s.name} className="oh-health-row">
                          {/* ★서버가 준 코드(db·captcha-engine…)를 그대로 찍지 않는다.
                            0815 확인: 여기만 매핑을 안 써서 ★영문이 그대로 보이고 있었다.
                            상세 화면과 ★같은 이름을 쓴다. 미등록이면 밝힌다(조용히 코드를 내보내지 않는다). */}
                        <span className="oh-health-name">
                          {SERVICE_NAME_META[s.name]?.label ?? `미등록 (${s.name})`}
                        </span>
                          <span className="oh-health-state">
                            <span className={`oh-dot ${t.cls}`} />
                            {t.label}
                            {typeof s.latency_ms === 'number' && (
                              <span className="oh-health-lat">{s.latency_ms}ms</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="oh-none">상태 정보를 불러오지 못했어요.</p>
                )}
                {dash && (
                  <div className="oh-health-foot">
                    <div className="oh-health-foot-row">
                      <span title="발급한 API 키로 외부에서 부른 횟수(오늘 0시부터). 학생이 콘솔에서 캡차를 푸는 것은 여기 안 들어갑니다.">
                        오늘 외부 API 호출
                      </span>
                      <b>{dash.api_calls_today.toLocaleString()}</b>
                    </div>
                    <div className="oh-health-foot-row">
                      <span title="위 호출 중 서버 잘못(500 이상)으로 실패한 비율. 잘못된 요청(4xx)은 세지 않습니다.">
                        그중 서버 오류
                      </span>
                      <b>{dash.error_rate}</b>
                    </div>
                  </div>
                )}
              </section>

              {/* 서비스 규모 — 기관·사용자·학생·활성 키 */}
              <section className="oh-card">
                <div className="oh-card-head">
                  <i className="ph-fill ph-chart-pie-slice" />
                  <h2 className="oh-card-title">서비스 현황</h2>
                </div>
                <div className="oh-scales">
                  <ScaleStat value={dash?.organizations} label="기관" />
                  <ScaleStat value={dash?.users} label="운영자·강사" />
                  <ScaleStat value={dash?.students} label="학생" />
                  <ScaleStat value={dash?.active_api_keys} label="활성 API 키" />
                </div>
                <button
                  type="button"
                  className="oh-card-cta"
                  onClick={() => navigate(PATHS.OPS_ORGS)}
                >
                  <i className="ph-fill ph-buildings" /> 기관 관리로 이동
                </button>
              </section>
            </div>

            {/* 최근 감사 로그 — 중요 이벤트 몇 줄 */}
            <section className="oh-card">
              <div className="oh-card-head">
                <i className="ph-fill ph-scroll" />
                <h2 className="oh-card-title">최근 감사 로그</h2>
                <Link to={PATHS.OPS_LOGS} className="oh-card-more">
                  전체 보기 <i className="ph-bold ph-arrow-right" />
                </Link>
              </div>
              {d.logs === null ? (
                <p className="oh-none">감사 로그를 불러오지 못했어요.</p>
              ) : d.logs.length === 0 ? (
                <p className="oh-none">최근 기록이 없어요.</p>
              ) : (
                <div className="oh-logs">
                  {d.logs.map((l) => (
                    <div key={l.id} className="oh-log-row">
                      <span className="oh-log-time">{fmtLogTime(l.created_at)}</span>
                      <span className="oh-log-action">
                        {AUDIT_ACTION_META[l.action]?.label ?? `기록 종류 미등록 (${l.action})`}
                      </span>
                      <span className="oh-log-target">
                        {l.org_name ||
                          (l.target_type
                            ? AUDIT_TARGET_LABEL[l.target_type] ?? `미등록 (${l.target_type})`
                            : null) ||
                          l.target_id ||
                          '—'}
                      </span>
                      <span className="oh-log-actor">{l.actor_name ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
