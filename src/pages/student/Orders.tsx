import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { StudentNav } from '../../layouts/StudentLayout';
import { errorDetail } from '../../api/lectures';
import { paymentApi, fmtWon, PROVIDER_LABEL, type MyOrder } from '../../api/payments';
import './Orders.css';

/**
 * 결제 내역 · 수강 환불.
 *
 * 취소 가능 여부는 서버(`refundable`)가 정한다 — 프런트가 status 를 보고 나름대로 판단하면
 * 서버 규칙이 바뀔 때 화면만 어긋난다. 환불은 되돌릴 수 없으므로 확인 단계를 한 번 두고,
 * 그 자리에서 '무엇을 잃는지'(수강권·수료 기록)를 명시한다.
 *
 * 실제 환불은 PG 취소가 성공해야 수강권이 회수된다(서버 cancel_payment). 그래서 화면은
 * 낙관적 갱신을 하지 않고 서버 응답으로만 상태를 바꾼다 — 실패했는데 환불된 것처럼
 * 보이면 학생이 두 번 누른다.
 */
export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [err, setErr] = useState('');
  // 확인 단계에 올라온 주문. null 이면 확인창 없음.
  const [confirming, setConfirming] = useState<MyOrder | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = () => {
    paymentApi
      .myOrders()
      .then(setOrders)
      .catch((e) => {
        setErr(errorDetail(e, '결제 내역을 불러오지 못했어요.'));
        setOrders([]);
      });
  };
  useEffect(load, []);

  const refund = async () => {
    if (!confirming) return;
    setBusy(true);
    setErr('');
    try {
      const amt = confirming.refund_amount;
      const partial = confirming.refund_ratio < 1;
      await paymentApi.cancelOrder(confirming.order_uid, reason.trim() || '학습자 요청');
      setDone(
        partial
          ? `'${confirming.course_title}' 결제를 부분 환불했어요. 수강 진행률에 따라 ${fmtWon(amt)} 환불돼요(결제수단에 따라 며칠 걸릴 수 있어요).`
          : `'${confirming.course_title}' 결제를 환불했어요. ${fmtWon(amt)} 환불돼요(결제수단에 따라 며칠 걸릴 수 있어요).`,
      );
      setConfirming(null);
      setReason('');
      load(); // 서버 상태로만 갱신
    } catch (e) {
      setErr(errorDetail(e, '환불하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (o: MyOrder) =>
    o.status === 'paid'
      ? '결제 완료'
      : o.status === 'refunded'
        ? '환불됨'
        : o.status === 'partially_refunded'
          ? '부분 환불됨'
          : '취소됨';

  /** 환불이 안 되는 이유 — 사유 코드는 서버가 주고 문구는 화면이 고른다. */
  const blockedText = (o: MyOrder) => {
    if (o.refund_blocked === 'completed')
      return '수료증이 발급된 코스는 환불되지 않아요.';
    if (o.refund_blocked === 'progress_over')
      return `수강 진행률이 ${o.refund_progress}%로 절반을 넘어 환불되지 않아요.`;
    if (o.refund_blocked === 'window_over')
      return '환불 가능 기간(결제 후 7일)이 지났어요. 문의가 필요하면 고객 지원을 이용해 주세요.';
    return null;
  };

  /** 지금 환불하면 얼마 돌려받는지 — 진행률 기반 비율 환불 안내(서버 계산값). */
  const refundNote = (o: MyOrder) =>
    o.refund_ratio >= 1
      ? `지금 환불하면 전액 ${fmtWon(o.refund_amount)} 돌려받아요.`
      : `수강 진행률 ${o.refund_progress}% — 지금 환불하면 ${Math.round(o.refund_ratio * 100)}%(${fmtWon(o.refund_amount)}) 돌려받아요.`;

  /** 환불 마감까지 남은 일수 — 아직 가능한 건에만 붙인다. */
  const daysLeft = (iso: string | null) => {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return null;
    return Math.max(1, Math.ceil(ms / 86_400_000));
  };

  return (
    <div className="od-root">
      <StudentNav />
      <div className="od-container">
        <button className="od-back" onClick={() => navigate(PATHS.STUDENT_MYPAGE)}>
          <i className="ph-bold ph-arrow-left" /> 마이페이지로
        </button>

        <header className="od-head">
          <h1 className="od-title">결제 내역</h1>
          <p className="od-sub">수강 결제 기록이에요. 결제한 코스는 여기서 환불할 수 있어요.</p>
        </header>

        {done && (
          <div className="od-done">
            <i className="ph-fill ph-check-circle" /> {done}
          </div>
        )}
        {err && (
          <div className="od-err">
            <i className="ph-fill ph-warning-circle" /> {err}
          </div>
        )}

        {orders === null ? (
          <div className="od-state">
            <span className="od-spinner" /> 불러오는 중…
          </div>
        ) : orders.length === 0 ? (
          <div className="od-empty">
            <i className="ph-fill ph-receipt" />
            <p className="od-empty-title">아직 결제한 코스가 없어요</p>
            <p className="od-empty-sub">코스를 수강 신청하면 결제 내역이 여기에 남아요.</p>
            <button className="od-btn od-btn--primary" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              강의 둘러보기
            </button>
          </div>
        ) : (
          <ul className="od-list">
            {orders.map((o) => (
              <li key={o.order_uid} className={`od-row${o.status !== 'paid' ? ' od-row--past' : ''}`}>
                <div className="od-main">
                  <div className="od-row-top">
                    <span className="od-course">{o.course_title}</span>
                    <span className={`od-badge od-badge--${o.status}`}>{statusLabel(o)}</span>
                  </div>
                  <div className="od-meta">
                    <span className="od-amount">{fmtWon(o.amount)}</span>
                    <span className="od-dot" />
                    <span>{PROVIDER_LABEL[o.provider] ?? o.provider}</span>
                    {o.method && (
                      <>
                        <span className="od-dot" />
                        <span>{o.method}</span>
                      </>
                    )}
                    {o.paid_at && (
                      <>
                        <span className="od-dot" />
                        <span>{new Date(o.paid_at).toLocaleDateString('ko-KR')}</span>
                      </>
                    )}
                  </div>
                  {o.status === 'paid' && !o.refundable && blockedText(o) && (
                    <p className="od-note">
                      <i className="ph-fill ph-info" />
                      {blockedText(o)}
                    </p>
                  )}
                  {o.status === 'paid' && o.refundable && (
                    <p className="od-note od-note--ok">
                      <i className="ph-fill ph-info" />
                      {refundNote(o)}
                      {daysLeft(o.refund_deadline)
                        ? ` 환불 가능 기간은 ${daysLeft(o.refund_deadline)}일 남았어요.`
                        : ''}
                    </p>
                  )}
                </div>
                <div className="od-actions">
                  {o.receipt_url && (
                    <a className="od-btn od-btn--ghost" href={o.receipt_url} target="_blank" rel="noreferrer">
                      영수증
                    </a>
                  )}
                  {o.refundable && (
                    <button className="od-btn od-btn--danger" onClick={() => setConfirming(o)}>
                      환불 요청
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="od-policy">
          <h2 className="od-policy-title">환불 규정</h2>
          <ul className="od-policy-list">
            <li>
              <strong>결제 후 7일 이내</strong>이고 <strong>아직 강의를 재생하지 않았다면</strong>{' '}
              전액 환불돼요. (1분 미만 재생은 시청으로 보지 않아요.)
            </li>
            <li>
              강의를 시청한 뒤에는 <strong>수강 진행률에 따라 비율 환불</strong>돼요:
              <ul className="od-policy-sub">
                <li>
                  진행률 <strong>1/3 미만</strong> → 결제액의 <strong>2/3</strong> 환불
                </li>
                <li>
                  진행률 <strong>1/3 이상 ~ 1/2 미만</strong> → 결제액의 <strong>1/2</strong> 환불
                </li>
                <li>
                  진행률 <strong>1/2 이상</strong> → 환불 불가
                </li>
              </ul>
              진행률은 완료한 강의 수 ÷ 전체 강의 수예요.
            </li>
            <li>
              <strong>수료증이 발급된 코스</strong>는 진행률과 관계없이 환불되지 않아요.
            </li>
            <li>
              <strong>결제 후 7일이 지나면</strong> 환불되지 않아요.
            </li>
            <li>
              환불하면 이 코스의 <strong>시청·문제 풀이 기록과 수료 정보가 삭제</strong>돼요.
            </li>
            <li>환불은 결제하신 수단으로 돌려드려요. 카드는 3~5영업일이 걸릴 수 있어요.</li>
            <li>
              위 조건에 해당하지 않아도 사정이 있다면 <Link to={PATHS.CONTACT}>문의하기</Link>로
              문의해 주세요.
            </li>
          </ul>
        </div>
      </div>

      {confirming && (
        <div className="od-overlay" onClick={() => !busy && setConfirming(null)}>
          <div
            className="od-modal"
            role="dialog"
            aria-modal="true"
            aria-label="환불 확인"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="od-modal-title">이 결제를 환불할까요?</h2>
            <div className="od-modal-course">
              <span>{confirming.course_title}</span>
              <strong>{fmtWon(confirming.amount)}</strong>
            </div>
            {/* 진행률 기반 환불 금액 — 얼마 돌려받는지 누르기 전에 명시 */}
            <div className="od-modal-refund">
              <span>돌려받는 금액</span>
              <strong>
                {fmtWon(confirming.refund_amount)}
                {confirming.refund_ratio < 1 && (
                  <span className="od-modal-ratio">
                    {' '}
                    · {Math.round(confirming.refund_ratio * 100)}% (진행률 {confirming.refund_progress}%)
                  </span>
                )}
              </strong>
            </div>
            {/* 되돌릴 수 없는 동작이라, 무엇을 잃는지 누르기 전에 적는다 */}
            <ul className="od-modal-lose">
              <li>
                <i className="ph-bold ph-x" /> 이 코스의 강의를 더 이상 볼 수 없어요
              </li>
              <li>
                <i className="ph-bold ph-x" /> 시청·문제 풀이 기록과 수료 정보가 삭제돼요
              </li>
              <li>
                <i className="ph-bold ph-x" /> 다시 들으려면 새로 결제해야 해요
              </li>
            </ul>
            <label className="od-modal-label">
              환불 사유 <span className="od-optional">(선택)</span>
              <input
                className="od-modal-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 내용이 기대와 달라요"
                maxLength={200}
                disabled={busy}
              />
            </label>
            <div className="od-modal-actions">
              <button className="od-btn od-btn--ghost" onClick={() => setConfirming(null)} disabled={busy}>
                그대로 둘게요
              </button>
              <button className="od-btn od-btn--danger" onClick={refund} disabled={busy}>
                {busy ? '환불 처리 중…' : '환불 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
