import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { StudentNav } from '../../layouts/StudentLayout';
import { errorDetail } from '../../api/lectures';
import { paymentApi, fmtWon, PROVIDER_LABEL, type OrderStatus } from '../../api/payments';
import './Checkout.css';

/**
 * 결제 결과 착지 페이지 — 카카오페이 QR 흐름의 종착점.
 *
 * 카카오페이는 결제창이 브라우저를 떠났다가 돌아오는 구조라, 승인은 서버(approve 콜백)가 하고
 * 브라우저는 결과만 보러 온다. 그래서 이 화면은 **주소창의 파라미터를 믿지 않고** order_uid로
 * 서버에 주문 상태를 다시 물어본다(성공을 지어내지 않는다 — 실제 status가 paid일 때만 성공).
 *
 * 토스는 결제창이 Checkout 페이지로 되돌아와 그 자리에서 confirm 하므로 이 페이지를 안 거친다.
 */
export default function PaymentResult({ kind }: { kind: 'success' | 'fail' | 'cancel' }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('orderId') || '';
  const reason = params.get('reason') || '';

  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(!!orderId);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    paymentApi
      .orderStatus(orderId)
      .then((o) => {
        if (alive) setOrder(o);
      })
      .catch((e) => {
        if (alive) setErr(errorDetail(e, '결제 결과를 확인하지 못했어요.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [orderId]);

  // 서버 주문 상태가 최종 판단 — URL이 success여도 paid가 아니면 성공으로 보여주지 않는다.
  const paid = order?.status === 'paid';
  const ok = kind === 'success' && paid;
  // 아직 결과가 확정되지 않은 경우(pending)와, 실패·취소로 끝난 경우를 구분해서 말한다.
  // 주문을 못 읽었을 때(err)도 '실패'로 단정하지 않는다 — 결제가 됐는지 모르는 상태다.
  const pendingUnknown = kind === 'success' && (order?.status === 'pending' || (!order && !!err));

  const title = ok
    ? '결제가 완료됐어요'
    : kind === 'cancel' || order?.status === 'cancelled'
      ? '결제를 취소했어요'
      : pendingUnknown
        ? '결제 결과를 확인하는 중이에요'
        : '결제하지 못했어요';

  const sub = ok
    ? '수강신청이 완료됐어요. 지금 바로 학습을 시작할 수 있어요.'
    : pendingUnknown || reason === 'payment_status_unknown'
      ? '결제 상태를 확인하지 못했어요. 결제가 됐는지 잠시 후 주문 내역에서 확인해 주세요. 중복 결제를 막기 위해 바로 다시 결제하지 마세요.'
      : order?.fail_reason ||
        (kind === 'cancel' || order?.status === 'cancelled'
          ? '결제가 진행되지 않았어요. 다시 시도할 수 있어요.'
          : '결제가 승인되지 않았어요. 다시 시도해 주세요.');

  return (
    <div className="co-root">
      <StudentNav />
      <div className="co-container">
        {loading ? (
          <div className="co-state">
            <span className="co-spinner" />
            <p>결제 결과를 확인하는 중…</p>
          </div>
        ) : (
          <div className={ok ? 'co-success' : 'co-state co-state--error'}>
            {ok ? (
              <div className="co-success-check">
                <i className="ph-fill ph-check-fat" />
              </div>
            ) : (
              <i className="ph-fill ph-warning-circle" />
            )}
            <h1 className={ok ? 'co-success-title' : undefined}>{title}</h1>
            <p className={ok ? 'co-success-sub' : undefined}>{sub}</p>
            {err && <p className="co-hint">{err}</p>}

            {order && (
              <div className="co-receipt">
                <div className="co-sumrow">
                  <span>결제 금액</span>
                  <strong>{fmtWon(order.amount)}</strong>
                </div>
                <div className="co-sumrow co-sumrow--muted">
                  <span>결제 수단</span>
                  <span>{PROVIDER_LABEL[order.provider] ?? order.provider}</span>
                </div>
                <div className="co-sumrow co-sumrow--muted">
                  <span>주문번호</span>
                  <span>{order.order_uid}</span>
                </div>
                {order.receipt_url && (
                  <div className="co-sumrow co-sumrow--muted">
                    <span>영수증</span>
                    <a href={order.receipt_url} target="_blank" rel="noreferrer">
                      영수증 보기
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="co-success-actions">
              {ok ? (
                <>
                  <button className="co-btn co-pay" onClick={() => navigate(PATHS.STUDENT_HOME)}>
                    <i className="ph-fill ph-play-circle" /> 지금 학습하러 가기
                  </button>
                  <button className="co-btn co-btn--ghost" onClick={() => navigate(PATHS.STUDENT_MYPAGE)}>
                    내 코스 보기
                  </button>
                </>
              ) : (
                <>
                  {order?.course_id && (
                    <button
                      className="co-btn co-pay"
                      onClick={() => navigate(`${PATHS.STUDENT_CHECKOUT}?course=${order.course_id}`)}
                    >
                      <i className="ph-fill ph-arrow-counter-clockwise" /> 다시 결제하기
                    </button>
                  )}
                  <button
                    className="co-btn co-btn--ghost"
                    onClick={() => navigate(PATHS.STUDENT_LECTURES)}
                  >
                    강의 신청으로 돌아가기
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
