import { client } from './client';

/** 결제 화면 요약 — GET /courses/{id}/checkout. 금액은 서버 확정값(주문 생성 시와 동일). */
export interface CheckoutInfo {
  course_id: string;
  course_title: string;
  instructor_name: string | null;
  lecture_count: number;
  amount: number;
  /** 이미 수강 중이면 결제 대신 '이미 수강 중' 안내로 분기 */
  already_enrolled: boolean;
  /** 결제 경로 — 'toss'면 실제 결제창, 'mock'이면 모의 승인(로컬·데모) */
  provider: 'toss' | 'mock';
  /** 토스 결제창 초기화용 공개 키(mock이면 빈 문자열) */
  toss_client_key: string;
  customer_key: string;
}

/** 주문 생성 응답 — 서버가 금액을 확정해 order_uid를 발급(pending). */
export interface CreatedOrder {
  order_uid: string;
  amount: number;
  provider: 'toss' | 'mock';
  course_title: string;
  toss_client_key: string;
  customer_key: string;
}

export interface ConfirmResult {
  ok: boolean;
  enrolled: boolean;
  course_id: string;
  order_uid: string;
  amount: number;
  method: string | null;
}

export const paymentApi = {
  /** 결제 화면 요약(코스명·강사·강의 수·금액·이미 수강 여부·결제 경로). */
  checkoutInfo: (courseId: string) =>
    client.get<CheckoutInfo>(`/courses/${courseId}/checkout`).then((r) => r.data),

  /** 주문 생성 — 서버가 금액을 확정하고 order_uid를 발급한다(pending). 같은 코스의 살아있는
   *  pending 주문이 있으면 그대로 재사용(연타·새로고침에 주문이 쌓이지 않음). */
  createOrder: (courseId: string) =>
    client
      .post<CreatedOrder>('/payments/checkout', { course_id: courseId })
      .then((r) => r.data),

  /** 결제 확정 — 서버가 금액을 대조(위변조 방어)한 뒤 실제/모의 승인하고 수강신청을 활성화한다.
   *  mock 결제는 payment_key 없이, 실제 토스는 결제창이 준 paymentKey를 함께 보낸다. */
  confirm: (body: {
    order_uid: string;
    amount: number;
    payment_key?: string;
    method?: string;
  }) => client.post<ConfirmResult>('/payments/confirm', body).then((r) => r.data),
};

/** ₩ 표기 — 정수 원화를 콤마로. 예: 49000 → "49,000원" */
export const fmtWon = (won: number): string => `${(won || 0).toLocaleString('ko-KR')}원`;
