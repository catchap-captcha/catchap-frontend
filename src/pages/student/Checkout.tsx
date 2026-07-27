import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { StudentNav } from '../../layouts/StudentLayout';
import CourseCover from '../../components/course/CourseCover';
import { errorDetail } from '../../api/lectures';
import {
  paymentApi,
  fmtWon,
  type CheckoutInfo,
  type CreatedOrder,
} from '../../api/payments';
import './Checkout.css';

/** 결제 수단(데모) — mock 결제에선 표시·기록용 선택값. 실제 토스 결제창은 자체 UI로 수단을 고른다. */
const METHODS = [
  { key: '간편결제', label: '간편결제', sub: '카카오페이 · 네이버페이 · 토스페이', icon: 'ph-fill ph-lightning' },
  { key: '신용·체크카드', label: '신용 · 체크카드', sub: '국내 모든 카드', icon: 'ph-fill ph-credit-card' },
  { key: '계좌이체', label: '계좌이체', sub: '실시간 계좌이체', icon: 'ph-fill ph-bank' },
];

type Phase = 'loading' | 'ready' | 'confirming' | 'done' | 'error';

/**
 * 코스 수강 결제 페이지 — 주문 → 승인 → 수강신청.
 *
 * 진입: `?course=`(단일) 또는 `?cart=id1,id2`(장바구니 다중). 각 코스의 checkout 요약을 불러와
 * 주문 상품 목록·합계를 그린다. '결제하기'는 코스마다 주문을 만들고(금액은 서버 확정) mock이면 그
 * 자리에서 confirm(모의 승인), 단일 코스가 toss면 토스 결제창을 띄운다(다중 toss는 미지원 — 데모는
 * mock). 결제 금액은 서버가 확정·대조하므로 화면 값은 표시용이다(위변조는 서버가 막는다).
 */
export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // 단일(?course=)과 장바구니(?cart=id1,id2)를 모두 받는다(중복·공백 제거).
  const cartParam = params.get('cart') || '';
  const singleCourse = params.get('course') || '';
  const courseIds = useMemo(() => {
    const raw = cartParam ? cartParam.split(',') : singleCourse ? [singleCourse] : [];
    return [...new Set(raw.map((s) => s.trim()).filter(Boolean))];
  }, [cartParam, singleCourse]);

  // 토스 결제창 성공 리다이렉트 파라미터 — 있으면 '결제 승인 확정' 경로로 진입한다(단일 코스 전용).
  const returnedPaymentKey = params.get('paymentKey');
  const returnedOrderId = params.get('orderId');
  const returnedAmount = params.get('amount');
  const tossFailCode = params.get('code'); // 토스 실패 리다이렉트

  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<CheckoutInfo[]>([]);
  const [method, setMethod] = useState(METHODS[0].key);
  const [agreeAll, setAgreeAll] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [paidMethod, setPaidMethod] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  // 결제 대상(이미 수강 중인 코스는 제외) + 합계
  const payable = useMemo(() => items.filter((i) => !i.already_enrolled), [items]);
  const total = useMemo(() => payable.reduce((n, i) => n + (i.amount || 0), 0), [payable]);
  const allEnrolled = items.length > 0 && payable.length === 0;

  // 토스 성공 리다이렉트 확정 — 되돌아온 값으로 서버 승인 확정(금액 대조는 서버가 한다).
  const confirmToss = useCallback(async () => {
    setPhase('confirming');
    try {
      const res = await paymentApi.confirm({
        order_uid: returnedOrderId!,
        amount: Number(returnedAmount),
        payment_key: returnedPaymentKey!,
      });
      setPaidMethod(res.method);
      setPaidAmount(Number(returnedAmount));
      setPaidCount(1);
      setPhase('done');
    } catch (e) {
      setErrMsg(errorDetail(e, '결제 승인에 실패했어요. 다시 시도해 주세요.'));
      setPhase('error');
    }
  }, [returnedOrderId, returnedAmount, returnedPaymentKey]);

  useEffect(() => {
    let alive = true;
    // 1) 토스 결제창에서 되돌아온 성공 리다이렉트 → 바로 승인 확정
    if (returnedPaymentKey && returnedOrderId && returnedAmount) {
      confirmToss();
      return;
    }
    // 2) 토스 실패 리다이렉트
    if (tossFailCode) {
      setErrMsg(params.get('message') || '결제가 취소되었거나 실패했어요.');
      setPhase('error');
      return;
    }
    // 3) 일반 진입 — 코스별 checkout 요약 로드
    if (courseIds.length === 0) {
      setErrMsg('결제할 코스를 찾을 수 없어요.');
      setPhase('error');
      return;
    }
    setPhase('loading');
    Promise.all(courseIds.map((id) => paymentApi.checkoutInfo(id)))
      .then((list) => {
        if (!alive) return;
        setItems(list);
        setPhase('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setErrMsg(errorDetail(e, '결제 정보를 불러오지 못했어요.'));
        setPhase('error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseIds.join(',')]);

  const canPay = phase === 'ready' && payable.length > 0 && agreeAll;

  /** 결제하기 — 결제 대상 코스마다 주문 생성 후 mock 승인. 단일 코스가 toss면 토스 결제창으로. */
  const pay = async () => {
    if (!canPay) return;
    setErrMsg('');
    setPhase('confirming');
    try {
      let paidSum = 0;
      let lastMethod: string | null = null;
      for (const it of payable) {
        let order: CreatedOrder;
        try {
          order = await paymentApi.createOrder(it.course_id);
        } catch (e) {
          throw new Error(errorDetail(e, '주문을 만들지 못했어요. 다시 시도해 주세요.'));
        }
        if (order.provider === 'toss') {
          // 실제 토스 결제창 — 단일 코스만. 성공하면 successUrl로 리다이렉트되어 confirmToss로 이어진다.
          if (payable.length > 1) {
            throw new Error('여러 코스 동시 결제는 데모(mock) 환경에서만 지원돼요. 코스를 하나씩 결제해 주세요.');
          }
          await startTossPayment(order, method);
          return; // 결제창으로 전환(리다이렉트)
        }
        // mock 승인 — 실제 돈 이동 없이 결제 UX만 재현. 서버가 금액을 대조·확정하고 수강신청을 연다.
        const res = await paymentApi.confirm({
          order_uid: order.order_uid,
          amount: order.amount,
          method,
        });
        paidSum += res.amount;
        lastMethod = res.method;
      }
      setPaidAmount(paidSum);
      setPaidMethod(lastMethod);
      setPaidCount(payable.length);
      setPhase('done');
    } catch (e) {
      setErrMsg(errorDetail(e, '결제 승인에 실패했어요. 다시 시도해 주세요.'));
      setPhase('error');
    }
  };

  const multi = courseIds.length > 1;

  return (
    <div className="co-root">
      <StudentNav />
      <div className="co-container">
        <button className="co-back" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
          <i className="ph-bold ph-arrow-left" /> 강의 신청으로
        </button>

        {phase === 'done' ? (
          <SuccessCard
            count={paidCount}
            firstTitle={payable[0]?.course_title ?? items[0]?.course_title ?? null}
            amount={paidAmount}
            method={paidMethod}
            onWatch={() => navigate(PATHS.STUDENT_HOME)}
            onMy={() => navigate(PATHS.STUDENT_MYPAGE)}
          />
        ) : phase === 'error' ? (
          <div className="co-state co-state--error">
            <i className="ph-fill ph-warning-circle" />
            <p>{errMsg}</p>
            <button className="co-btn co-btn--ghost" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              강의 신청으로 돌아가기
            </button>
          </div>
        ) : phase === 'loading' ? (
          <div className="co-state">
            <span className="co-spinner" />
            <p>결제 정보를 불러오는 중…</p>
          </div>
        ) : allEnrolled ? (
          <div className="co-state">
            <i className="ph-fill ph-check-circle co-state-ok" />
            <p>이미 수강 중인 코스예요.</p>
            <button className="co-btn" onClick={() => navigate(PATHS.STUDENT_HOME)}>
              지금 학습하러 가기
            </button>
          </div>
        ) : items.length > 0 ? (
          <>
            <h1 className="co-title">수강 결제</h1>
            <p className="co-subtitle">
              {multi
                ? `선택한 ${payable.length}개 코스를 결제하면 모든 강의를 바로 볼 수 있어요.`
                : '결제를 완료하면 이 코스의 모든 강의를 바로 볼 수 있어요.'}
            </p>

            <div className="co-grid">
              {/* 왼쪽 — 주문 상품 + 결제 수단 + 약관 */}
              <div className="co-main">
                <section className="co-card">
                  <h2 className="co-cardhead">
                    주문 상품 {multi && <span className="co-cardhead-count">{items.length}</span>}
                  </h2>
                  <div className="co-courses">
                    {items.map((it) => (
                      <div
                        key={it.course_id}
                        className={`co-course${it.already_enrolled ? ' co-course--enrolled' : ''}`}
                      >
                        <CourseCover seed={it.course_id} label={it.course_title} size="md" className="co-cover" />
                        <div className="co-course-meta">
                          <span className="co-course-badge">
                            <i className="ph-fill ph-stack" /> 코스
                          </span>
                          <h3 className="co-course-title">{it.course_title}</h3>
                          <div className="co-course-sub">
                            {it.instructor_name && (
                              <span>
                                <i className="ph-fill ph-chalkboard-teacher" /> {it.instructor_name} 선생님
                              </span>
                            )}
                            <span>
                              <i className="ph-fill ph-play-circle" /> 강의 {it.lecture_count}개
                            </span>
                          </div>
                        </div>
                        <div className="co-course-price">
                          {it.already_enrolled ? (
                            <span className="co-course-owned">이미 수강 중</span>
                          ) : (
                            fmtWon(it.amount)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="co-card">
                  <h2 className="co-cardhead">결제 수단</h2>
                  <div className="co-methods">
                    {METHODS.map((m) => (
                      <label
                        key={m.key}
                        className={`co-method${method === m.key ? ' co-method--on' : ''}`}
                      >
                        <input
                          type="radio"
                          name="method"
                          value={m.key}
                          checked={method === m.key}
                          onChange={() => setMethod(m.key)}
                        />
                        <i className={m.icon} />
                        <span className="co-method-body">
                          <span className="co-method-label">{m.label}</span>
                          <span className="co-method-sub">{m.sub}</span>
                        </span>
                        <span className="co-method-dot" aria-hidden="true" />
                      </label>
                    ))}
                  </div>
                  {items.some((i) => i.provider === 'mock') && (
                    <p className="co-note">
                      <i className="ph-fill ph-info" />
                      데모 환경이라 실제 결제 없이 승인돼요(테스트 모드).
                    </p>
                  )}
                </section>

                <section className="co-card">
                  <label className="co-agree">
                    <input
                      type="checkbox"
                      checked={agreeAll}
                      onChange={(e) => setAgreeAll(e.target.checked)}
                    />
                    <span className="co-agree-box" aria-hidden="true">
                      <i className="ph-bold ph-check" />
                    </span>
                    <span className="co-agree-text">
                      주문 내용을 확인했으며,{' '}
                      <a href={PATHS.TERMS} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        이용약관
                      </a>{' '}
                      및 결제 진행에 동의합니다. (필수)
                    </span>
                  </label>
                </section>
              </div>

              {/* 오른쪽 — 결제 요약(스티키) */}
              <aside className="co-summary">
                <div className="co-summary-card">
                  <h2 className="co-cardhead">결제 금액</h2>
                  <div className="co-sumrow">
                    <span>수강료 ({payable.length}개 코스)</span>
                    <span>{fmtWon(total)}</span>
                  </div>
                  <div className="co-sumrow co-sumrow--muted">
                    <span>할인</span>
                    <span>0원</span>
                  </div>
                  <div className="co-sumtotal">
                    <span>총 결제금액</span>
                    <strong>{fmtWon(total)}</strong>
                  </div>
                  <button
                    className="co-btn co-pay"
                    disabled={phase === 'confirming' || !canPay}
                    onClick={pay}
                  >
                    {phase === 'confirming' ? (
                      <>
                        <span className="co-spinner co-spinner--sm" /> 결제 처리 중…
                      </>
                    ) : (
                      <>
                        <i className="ph-fill ph-lock-simple" /> {fmtWon(total)} 결제하기
                      </>
                    )}
                  </button>
                  {!agreeAll && phase === 'ready' && (
                    <p className="co-hint">약관에 동의하면 결제할 수 있어요.</p>
                  )}
                  <p className="co-secure">
                    <i className="ph-fill ph-shield-check" /> 결제 금액은 서버에서 검증됩니다.
                  </p>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** 결제 완료 카드 — 수강신청까지 끝난 상태. 여러 코스면 'N개 코스'로 표기. */
function SuccessCard({
  count,
  firstTitle,
  amount,
  method,
  onWatch,
  onMy,
}: {
  count: number;
  firstTitle: string | null;
  amount: number;
  method: string | null;
  onWatch: () => void;
  onMy: () => void;
}) {
  const label =
    count > 1
      ? `‘${firstTitle}’ 외 ${count - 1}개 코스`
      : firstTitle
        ? `‘${firstTitle}’`
        : '';
  return (
    <div className="co-success">
      <div className="co-success-check">
        <i className="ph-fill ph-check-fat" />
      </div>
      <h1 className="co-success-title">결제가 완료됐어요</h1>
      <p className="co-success-sub">
        {label && `${label} `}수강신청이 완료됐어요. 지금 바로 학습을 시작할 수 있어요.
      </p>
      <div className="co-receipt">
        <div className="co-sumrow">
          <span>결제 금액</span>
          <strong>{fmtWon(amount)}</strong>
        </div>
        {method && (
          <div className="co-sumrow co-sumrow--muted">
            <span>결제 수단</span>
            <span>{method}</span>
          </div>
        )}
      </div>
      <div className="co-success-actions">
        <button className="co-btn co-pay" onClick={onWatch}>
          <i className="ph-fill ph-play-circle" /> 지금 학습하러 가기
        </button>
        <button className="co-btn co-btn--ghost" onClick={onMy}>
          내 코스 보기
        </button>
      </div>
    </div>
  );
}

/**
 * 토스페이먼츠 결제창 — 실제 PG 경로(provider==='toss'). 서버가 TOSS 키를 갖고 있을 때만 탄다.
 * SDK를 동적 로드해 결제를 요청하고, 성공하면 successUrl(이 페이지 + paymentKey/orderId/amount)로
 * 리다이렉트된다. 되돌아오면 useEffect가 confirm으로 승인을 확정한다.
 * (데모 환경은 provider='mock'이라 이 함수를 타지 않는다.)
 */
async function startTossPayment(order: CreatedOrder, method: string): Promise<void> {
  const sdk = await loadTossSdk();
  const toss = sdk(order.toss_client_key);
  const payment = toss.payment({ customerKey: order.customer_key });
  const base = `${window.location.origin}${PATHS.STUDENT_CHECKOUT}`;
  await payment.requestPayment({
    method: method === '계좌이체' ? 'TRANSFER' : method === '간편결제' ? 'EASY_PAY' : 'CARD',
    amount: { currency: 'KRW', value: order.amount },
    orderId: order.order_uid,
    orderName: order.course_title,
    successUrl: `${base}?course=${order.order_uid}`, // 토스가 paymentKey/orderId/amount를 덧붙인다
    failUrl: base,
  });
}

/** 토스 SDK(v2) 동적 로드 — 한 번만 주입한다. */
function loadTossSdk(): Promise<(clientKey: string) => any> {
  const w = window as any;
  if (w.TossPayments) return Promise.resolve(w.TossPayments);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.tosspayments.com/v2/standard';
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error('SDK 로드 실패')));
    s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했어요.'));
    document.head.appendChild(s);
  });
}
