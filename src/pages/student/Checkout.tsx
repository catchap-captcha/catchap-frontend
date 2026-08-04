import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { StudentNav } from '../../layouts/StudentLayout';
import CourseCover from '../../components/course/CourseCover';
import { errorDetail, lectureApi } from '../../api/lectures';
import {
  paymentApi,
  fmtWon,
  type CheckoutInfo,
  type CreatedOrder,
  type PaymentProvider,
} from '../../api/payments';
import './Checkout.css';

/** 결제 수단 — 서버가 키 설정으로 정한 available_providers 만 노출한다(없는 수단은 아예 안 보임). */
const PROVIDER_UI: Record<PaymentProvider, { label: string; sub: string; icon: string }> = {
  kakaopay: {
    label: '카카오페이',
    sub: 'PC에서 QR을 스캔해 휴대폰으로 결제',
    icon: 'ph-fill ph-qr-code',
  },
  toss: {
    label: '토스페이먼츠',
    sub: '신용·체크카드 · 계좌이체 · 간편결제',
    icon: 'ph-fill ph-credit-card',
  },
  portone: {
    label: '카드·간편결제',
    sub: '카드 · 계좌이체 · 간편결제 · 해외카드',
    icon: 'ph-fill ph-wallet',
  },
  mock: {
    label: '모의 결제',
    sub: '실제 결제 없이 승인 — 개발·데모 전용',
    icon: 'ph-fill ph-flask',
  },
};

/** 토스 결제창에 넘길 세부 수단 — 토스를 골랐을 때만 노출한다. */
const TOSS_METHODS = [
  { key: '간편결제', sdk: 'EASY_PAY' as const },
  { key: '신용·체크카드', sdk: 'CARD' as const },
  { key: '계좌이체', sdk: 'TRANSFER' as const },
];

type Phase = 'loading' | 'ready' | 'confirming' | 'done' | 'error';

/**
 * 화면에 띄울 오류 문구.
 *
 * errorDetail 은 서버 응답(detail)만 읽어서, 우리가 직접 던진 Error("코스를 하나씩…")나
 * 결제 SDK가 던진 원문("채널 정보를 조회하는데 실패…")을 통째로 버리고 기본 문구로 덮어썼다.
 * 서버 detail 이 있으면 그걸 쓰고, 없으면 예외 자신의 메시지를 살린다.
 */
function payErrorMessage(e: unknown, fallback: string): string {
  const detail = errorDetail(e, '');
  if (detail) return detail;
  const msg = (e as Error)?.message;
  return typeof msg === 'string' && msg ? msg : fallback;
}

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
  // 결제 경로(PG)와, 토스를 골랐을 때 결제창에 넘길 세부 수단.
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [method, setMethod] = useState(TOSS_METHODS[0].key);
  const [agreeAll, setAgreeAll] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [paidMethod, setPaidMethod] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  // 결제 대상(이미 수강 중인 코스는 제외) + 합계
  const payable = useMemo(() => items.filter((i) => !i.already_enrolled), [items]);
  const total = useMemo(() => payable.reduce((n, i) => n + (i.amount || 0), 0), [payable]);
  const allEnrolled = items.length > 0 && payable.length === 0;

  // 사용 가능한 결제수단 — 서버 설정이므로 코스마다 같지만, 안전하게 교집합을 쓴다.
  const providers = useMemo<PaymentProvider[]>(() => {
    if (!items.length) return [];
    return items
      .map((i) => i.available_providers ?? [])
      .reduce((acc, list) => acc.filter((p) => list.includes(p)));
  }, [items]);
  // 서버 기본값을 초기 선택으로. 목록이 바뀌어 선택이 사라지면 첫 항목으로 되돌린다.
  useEffect(() => {
    if (!providers.length) return;
    setProvider((cur) => (cur && providers.includes(cur) ? cur : items[0]?.provider ?? providers[0]));
  }, [providers, items]);
  // 카카오페이는 결제창이 주문 1건 단위라 장바구니 다중 결제와 함께 쓸 수 없다.
  const kakaoMultiBlocked =
    (provider === 'kakaopay' || provider === 'portone') && payable.length > 1;

  // 무료 코스(합계 0원)는 PG를 거치지 않는다 — 서버도 0원 주문을 400(free_course)으로 막고
  // "무료 코스는 결제 없이 수강신청해 주세요"라고 답한다. 결제수단이 하나도 설정되지 않은
  // 환경에서도 무료 코스 수강신청은 막히면 안 되므로, 이 경우 수강신청 API로 바로 간다.
  const freeOnly = payable.length > 0 && total === 0;

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

  const canPay =
    phase === 'ready' &&
    payable.length > 0 &&
    agreeAll &&
    (freeOnly || (!!provider && !kakaoMultiBlocked));

  /**
   * 결제하기 — 고른 PG에 따라 갈린다.
   *  - kakaopay: 주문 생성 → ready → 카카오페이 QR 화면으로 이동(승인은 서버 콜백이 처리)
   *  - toss    : 주문 생성 → 토스 결제창(리다이렉트) → 돌아와서 confirm
   *  - mock    : 주문 생성 → 바로 confirm(개발·데모)
   * 금액은 어느 경로든 서버가 확정·대조하므로 화면 값은 표시용이다.
   */
  const pay = async () => {
    if (!canPay) return;
    setErrMsg('');
    setPhase('confirming');

    // 무료 코스 — 결제를 만들지 않고 바로 수강신청한다(PG 설정과 무관하게 항상 가능).
    if (freeOnly) {
      try {
        for (const it of payable) {
          await lectureApi.enrollCourse(it.course_id);
        }
        setPaidAmount(0);
        setPaidMethod(null);
        setPaidCount(payable.length);
        setPhase('done');
      } catch (e) {
        setErrMsg(errorDetail(e, '수강신청에 실패했어요. 다시 시도해 주세요.'));
        setPhase('error');
      }
      return;
    }

    if (!provider) return;
    try {
      let paidSum = 0;
      let lastMethod: string | null = null;
      for (const it of payable) {
        let order: CreatedOrder;
        try {
          order = await paymentApi.createOrder(it.course_id, provider);
        } catch (e) {
          throw new Error(errorDetail(e, '주문을 만들지 못했어요. 다시 시도해 주세요.'));
        }

        if (order.provider === 'kakaopay') {
          // 카카오페이 — PC URL이 QR 화면이다. 승인은 카카오가 서버 approval_url로 리다이렉트해
          // 서버가 처리하고, 서버가 다시 /student/payment/success 로 보내 준다.
          const ready = await paymentApi.kakaopayReady(order.order_uid);
          window.location.href = ready.next_redirect_pc_url;
          return;
        }

        if (order.provider === 'toss') {
          // 실제 토스 결제창 — 단일 코스만. 성공하면 successUrl로 리다이렉트되어 confirmToss로 이어진다.
          if (payable.length > 1) {
            throw new Error('토스 결제는 코스를 하나씩 결제해 주세요. 결제창이 주문 1건 단위로 열려요.');
          }
          await startTossPayment(order, method);
          return; // 결제창으로 전환(리다이렉트)
        }

        if (order.provider === 'portone') {
          // 포트원 — 결제창은 SDK가 띄우고, 승인 검증은 서버가 order_uid로 조회해서 한다.
          // 결제창도 주문 1건 단위라 다중 결제는 막는다(토스와 같은 이유).
          if (payable.length > 1) {
            throw new Error('이 결제수단은 코스를 하나씩 결제해 주세요. 결제창이 주문 1건 단위로 열려요.');
          }
          await startPortOnePayment(order);
          // 결제창이 성공으로 닫혔을 뿐 아직 승인 전이다 — 서버가 PG를 조회해 확정한다.
          const res = await paymentApi.confirm({
            order_uid: order.order_uid,
            amount: order.amount,
          });
          setPaidAmount(res.amount);
          setPaidMethod(res.method);
          setPaidCount(1);
          setPhase('done');
          return;
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
      setErrMsg(payErrorMessage(e, '결제 승인에 실패했어요. 다시 시도해 주세요.'));
      setPhase('error');
    }
  };

  const multi = courseIds.length > 1;

  return (
    <div className="co-root">
      <StudentNav />
      <div className="co-container">
        <button className="co-back" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
          <i className="ph-bold ph-arrow-left" /> 코스 둘러보기로
        </button>

        {phase === 'done' ? (
          <SuccessCard
            count={paidCount}
            firstTitle={payable[0]?.course_title ?? items[0]?.course_title ?? null}
            amount={paidAmount}
            method={paidMethod}
            free={paidAmount === 0}
            onWatch={() => navigate(PATHS.STUDENT_HOME)}
            onMy={() => navigate(PATHS.STUDENT_MYPAGE)}
          />
        ) : phase === 'error' ? (
          <div className="co-state co-state--error">
            <i className="ph-fill ph-warning-circle" />
            <p>{errMsg}</p>
            <button className="co-btn co-btn--ghost" onClick={() => navigate(PATHS.STUDENT_LECTURES)}>
              코스 둘러보기로
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

                {/* 무료 코스는 결제수단 자체가 필요 없다 — 결제 UI 대신 안내만 둔다 */}
                {freeOnly ? (
                  <section className="co-card">
                    <h2 className="co-cardhead">결제 수단</h2>
                    <p className="co-note">
                      <i className="ph-fill ph-gift" />
                      무료 코스예요. 결제 없이 바로 수강신청됩니다.
                    </p>
                  </section>
                ) : (
                <section className="co-card">
                  <h2 className="co-cardhead">결제 수단</h2>
                  {providers.length === 0 ? (
                    <p className="co-note">
                      <i className="ph-fill ph-warning-circle" />
                      지금 사용할 수 있는 결제수단이 없어요. 잠시 후 다시 시도해 주세요.
                    </p>
                  ) : (
                    <div className="co-methods">
                      {providers.map((p) => (
                        <label
                          key={p}
                          className={`co-method${provider === p ? ' co-method--on' : ''}`}
                        >
                          <input
                            type="radio"
                            name="provider"
                            value={p}
                            checked={provider === p}
                            onChange={() => setProvider(p)}
                          />
                          <i className={PROVIDER_UI[p].icon} />
                          <span className="co-method-body">
                            <span className="co-method-label">{PROVIDER_UI[p].label}</span>
                            <span className="co-method-sub">{PROVIDER_UI[p].sub}</span>
                          </span>
                          <span className="co-method-dot" aria-hidden="true" />
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 토스는 결제창에 넘길 세부 수단을 여기서 고른다(카카오페이는 자체 화면) */}
                  {provider === 'toss' && (
                    <div className="co-submethods">
                      {TOSS_METHODS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className={`co-submethod${method === m.key ? ' co-submethod--on' : ''}`}
                          onClick={() => setMethod(m.key)}
                        >
                          {m.key}
                        </button>
                      ))}
                    </div>
                  )}

                  {provider === 'kakaopay' && (
                    <p className="co-note">
                      <i className="ph-fill ph-qr-code" />
                      결제하기를 누르면 카카오페이 화면으로 이동해요. PC에 뜬 QR을 휴대폰으로 스캔해
                      결제를 마치면 자동으로 돌아옵니다.
                    </p>
                  )}
                  {provider === 'portone' && (
                    <p className="co-note">
                      <i className="ph-fill ph-shield-check" />
                      결제하기를 누르면 결제창이 열려요. 카드·계좌이체·간편결제 중에서 고를 수 있고,
                      결제가 끝나면 서버가 결제 내역을 직접 확인한 뒤 수강신청이 열립니다.
                    </p>
                  )}
                  {kakaoMultiBlocked && (
                    <p className="co-note co-note--warn">
                      <i className="ph-fill ph-warning-circle" />
                      {PROVIDER_UI[provider!].label}는 코스를 하나씩 결제해 주세요. 결제창이 주문 1건
                      단위로 열려요.
                    </p>
                  )}
                  {provider === 'mock' && (
                    <p className="co-note">
                      <i className="ph-fill ph-info" />
                      개발 환경이라 실제 결제 없이 승인돼요(테스트 모드).
                    </p>
                  )}
                </section>
                )}

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
                        <span className="co-spinner co-spinner--sm" />{' '}
                        {freeOnly ? '수강신청 중…' : '결제 처리 중…'}
                      </>
                    ) : freeOnly ? (
                      <>
                        <i className="ph-fill ph-check-circle" /> 무료로 수강신청
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

/** 완료 카드 — 수강신청까지 끝난 상태. 여러 코스면 'N개 코스'로 표기.
 *  free=true(무료 코스)면 결제하지 않았으므로 '결제 완료'라고 말하지 않는다. */
function SuccessCard({
  count,
  firstTitle,
  amount,
  method,
  free,
  onWatch,
  onMy,
}: {
  count: number;
  firstTitle: string | null;
  amount: number;
  method: string | null;
  free: boolean;
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
      <h1 className="co-success-title">{free ? '수강신청이 완료됐어요' : '결제가 완료됐어요'}</h1>
      <p className="co-success-sub">
        {label && `${label} `}
        {free
          ? '무료 코스라 결제 없이 바로 신청됐어요. 지금 바로 학습을 시작할 수 있어요.'
          : '수강신청이 완료됐어요. 지금 바로 학습을 시작할 수 있어요.'}
      </p>
      <div className="co-receipt">
        <div className="co-sumrow">
          <span>{free ? '수강료' : '결제 금액'}</span>
          <strong>{free ? '무료' : fmtWon(amount)}</strong>
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
    method: TOSS_METHODS.find((m) => m.key === method)?.sdk ?? 'CARD',
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

/**
 * 포트원(PortOne) V2 결제창 — 여러 PG를 한 연동으로 부르는 중개 레이어.
 *
 * 토스 직접 연동과 다른 점: 결제 요청은 브라우저 SDK가 하고 **승인은 서버가 조회로 검증**한다.
 * paymentId 를 우리 order_uid 로 그대로 쓰기 때문에, 결제가 끝나면 서버가 그 번호로
 * PortOne API를 조회해 금액·상태를 확인한다(프런트가 보낸 값을 신뢰하지 않는다).
 *
 * 반환값: 결제창이 성공으로 끝나면 true. 사용자가 닫거나 실패하면 예외를 던진다.
 */
async function startPortOnePayment(order: CreatedOrder): Promise<void> {
  const sdk = await loadPortOneSdk();
  let res: any;
  try {
    res = await sdk.requestPayment({
      storeId: order.portone_store_id,
      channelKey: order.portone_channel_key,
      // paymentId = 서버 주문번호. 서버가 이 값으로 결제를 조회·검증한다.
      paymentId: order.order_uid,
      orderName: order.course_title,
      totalAmount: order.amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      // 모바일은 결제창이 브라우저를 넘겨받아 이 주소로 되돌아온다. 그때는 아래 confirm 이
      // 실행되지 않으므로 결과 페이지(PaymentResult)가 대신 승인을 요청한다.
      redirectUrl: `${window.location.origin}${PATHS.STUDENT_PAYMENT_SUCCESS}?orderId=${order.order_uid}`,
    });
  } catch (e) {
    // 채널 설정 오류 등은 예외로 올라온다(실측). 원문이 진단에 필요해 그대로 살린다.
    throw new Error(
      (e as Error)?.message || '결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
  // 사용자가 창을 닫거나 결제가 거절되면 code/message 로 돌아온다 — 성공을 지어내지 않는다.
  if (res?.code) {
    throw new Error(res.message || '결제가 취소되었거나 실패했어요.');
  }
}

/** 포트원 브라우저 SDK(v2) 동적 로드 — 한 번만 주입한다. */
function loadPortOneSdk(): Promise<any> {
  const w = window as any;
  if (w.PortOne) return Promise.resolve(w.PortOne);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    s.onload = () => (w.PortOne ? resolve(w.PortOne) : reject(new Error('SDK 로드 실패')));
    s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했어요.'));
    document.head.appendChild(s);
  });
}
