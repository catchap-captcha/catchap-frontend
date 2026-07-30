import { client } from './client';

/** 결제 수단 — 서버가 키 설정 여부로 사용 가능 목록을 정한다(mock은 개발 환경에서만). */
export type PaymentProvider = 'toss' | 'kakaopay' | 'portone' | 'mock';

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  toss: '토스페이먼츠',
  kakaopay: '카카오페이 QR',
  portone: '카드·간편결제',
  mock: '모의 결제(개발용)',
};

/** 결제 화면 요약 — GET /courses/{id}/checkout. 금액은 서버 확정값(주문 생성 시와 동일). */
export interface CheckoutInfo {
  course_id: string;
  course_title: string;
  instructor_name: string | null;
  lecture_count: number;
  amount: number;
  /** 이미 수강 중이면 결제 대신 '이미 수강 중' 안내로 분기 */
  already_enrolled: boolean;
  /** 서버가 고른 기본 결제 경로 */
  provider: PaymentProvider;
  /** 지금 쓸 수 있는 결제 경로 전체 — 화면의 수단 선택지를 이 값으로 만든다 */
  available_providers: PaymentProvider[];
  /** 토스 결제창 초기화용 공개 키(토스가 꺼져 있으면 빈 문자열) */
  toss_client_key: string;
  customer_key: string;
  /** 포트원 브라우저 SDK 초기화용 공개값 — 꺼져 있으면 빈 문자열.
   *  API Secret은 서버 전용이라 내려오지 않는다. */
  portone_store_id: string;
  portone_channel_key: string;
}

/** 주문 생성 응답 — 서버가 금액을 확정해 order_uid를 발급(pending). */
export interface CreatedOrder {
  order_uid: string;
  amount: number;
  provider: PaymentProvider;
  available_providers: PaymentProvider[];
  course_title: string;
  toss_client_key: string;
  customer_key: string;
  portone_store_id: string;
  portone_channel_key: string;
}

/** 카카오페이 결제 준비 — PC URL을 열면 카카오페이가 QR을 띄운다. */
export interface KakaoReady {
  order_uid: string;
  amount: number;
  tid: string;
  next_redirect_pc_url: string;
  next_redirect_mobile_url: string;
  next_redirect_app_url: string;
}

export interface ConfirmResult {
  ok: boolean;
  enrolled: boolean;
  course_id: string;
  order_uid: string;
  amount: number;
  provider: PaymentProvider;
  method: string | null;
  receipt_url: string | null;
}

/** 주문 상태 — 결제 성공 리다이렉트 뒤 결과 확인·영수증·취소에 쓴다. */
export interface OrderStatus {
  order_uid: string;
  course_id: string;
  amount: number;
  /** pending | paid | failed | cancelled | refunded */
  status: string;
  provider: PaymentProvider;
  method: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  fail_reason: string | null;
}

/** 결제 내역 한 줄 — GET /payments/orders. 환불 화면의 원천. */
export interface MyOrder extends OrderStatus {
  course_title: string;
  /** 서버 환불 정책의 결과. 프런트가 상태·날짜를 보고 따로 추론하지 않는다. */
  refundable: boolean;
  /** 불가 사유 — 문구는 화면이 고른다 */
  refund_blocked: 'not_paid' | 'window_over' | 'already_watched' | null;
  /** 환불 기한(ISO). 남은 기간 안내용 */
  refund_deadline: string | null;
  /** 환불하면 잃는 것 — 누르기 전에 보여준다 */
  enrolled: boolean;
  completed: boolean;
}

export const paymentApi = {
  /** 내 결제 내역(최근순). pending·failed 는 서버가 제외한다. */
  myOrders: () => client.get<MyOrder[]>('/payments/orders').then((r) => r.data),

  /** 결제 화면 요약(코스명·강사·강의 수·금액·이미 수강 여부·사용 가능한 결제수단). */
  checkoutInfo: (courseId: string) =>
    client.get<CheckoutInfo>(`/courses/${courseId}/checkout`).then((r) => r.data),

  /** 주문 생성 — 서버가 금액을 확정하고 order_uid를 발급한다(pending). 같은 코스의 살아있는
   *  pending 주문이 있으면 그대로 재사용(연타·새로고침에 주문이 쌓이지 않음).
   *  provider를 주면 그 수단으로, 안 주면 서버 기본값으로 만든다. */
  createOrder: (courseId: string, provider?: PaymentProvider) =>
    client
      .post<CreatedOrder>('/payments/checkout', { course_id: courseId, provider })
      .then((r) => r.data),

  /** 카카오페이 결제 준비 — 응답의 next_redirect_pc_url을 열면 QR 화면이 뜬다.
   *  이후 승인은 카카오페이가 백엔드 approval_url로 리다이렉트해 서버가 처리한다. */
  kakaopayReady: (orderUid: string) =>
    client
      .post<KakaoReady>('/payments/kakaopay/ready', { order_uid: orderUid })
      .then((r) => r.data),

  /** 결제 확정(토스·포트원·mock) — 서버가 금액을 대조(위변조 방어)한 뒤 승인하고 수강신청을
   *  활성화한다. 포트원은 payment_key 없이 order_uid만 보내면 서버가 그 번호로 PG를 조회해
   *  검증한다. 카카오페이는 이 경로를 쓰지 않는다(서버 리다이렉트 콜백에서 승인). */
  confirm: (body: {
    order_uid: string;
    amount: number;
    payment_key?: string;
    method?: string;
  }) => client.post<ConfirmResult>('/payments/confirm', body).then((r) => r.data),

  /** 주문 상태 조회 — 결제 결과 페이지가 order_uid로 성공/실패를 확인한다. */
  orderStatus: (orderUid: string) =>
    client.get<OrderStatus>(`/payments/${orderUid}`).then((r) => r.data),

  /** 결제 취소(전액 환불) — PG 취소가 성공해야 수강권이 회수된다. */
  cancelOrder: (orderUid: string, reason: string) =>
    client.post<OrderStatus>(`/payments/${orderUid}/cancel`, { reason }).then((r) => r.data),
};

/** ₩ 표기 — 정수 원화를 콤마로. 예: 49000 → "49,000원" */
export const fmtWon = (won: number): string => `${(won || 0).toLocaleString('ko-KR')}원`;
