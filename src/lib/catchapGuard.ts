import { solveCatchapPow, type PowChallenge } from './catchapGuardPow';

/**
 * CatChap Guard(성원·민서 캡차) API — 화면은 우리가 그리고 문제·판정만 저쪽에서 받는다.
 *
 * 이 경로를 쓰는 이유와 실측 근거는 `catchapGuardPow.ts` 헤더에 적어뒀다. 요약하면
 * iframe 임베드는 캡차 서버의 오리진 검사에 막히고(403), www 에서 API 로 부르면 통과한다.
 *
 * 기존 로그인 캡차(`/captcha/drag/*`, 백엔드 자체 구현)와 응답 모양이 같다 — 그쪽이
 * 이 캡차를 본떠 만들어졌기 때문이다. 그래서 화면 컴포넌트는 그대로 쓰고 호출부만 바꾼다.
 *
 * 다른 점 셋:
 *   · `X-Captcha-Site-Key` 헤더가 필요하다(공개값).
 *   · 궤적은 verify 에 실어 보내지 않는다. `behavior-batches` 로 따로 보내고,
 *     배치마다 영수증을 받아 다음 배치에 이어 붙인다(끊기면 서버가 거부한다).
 *   · verify 에 PoW 해답이 필요하다.
 */

const GUARD_ORIGIN =
  (import.meta.env.VITE_COLLECT_CAPTCHA_ORIGIN as string | undefined) ?? 'https://captcha.catchap5.com';

/** 공개값이다. 비밀값은 site secret 이고 그건 백엔드에만 있다. */
const SITE_KEY =
  (import.meta.env.VITE_CATCHAP_GUARD_SITE_KEY as string | undefined) ??
  'site_ENd3JivVHLliFXYaEG3bAiDx3eFd2PNd';

const SESSION_KEY = 'catchap-guard-session';

export interface GuardObject {
  object_id: string;
  hit_region: [number, number, number, number];
  preview_url: string;
}

export interface GuardChallenge {
  challenge_id: string;
  type: string;
  instruction: string;
  image_url: string;
  width: number;
  height: number;
  objects: GuardObject[];
  expires_at: string;
  behavior_event_transport?: string;
  behavior_batch_max_events?: number;
  behavior_nonce?: string;
  pow?: PowChallenge;
}

/** 토큰만으로는 백엔드 검증이 실패한다 — 발급 당시의 session_id·purpose 를 함께 넘긴다. */
export interface GuardVerification {
  token: string;
  sessionId: string;
  purpose: string;
}

export interface GuardVerifyResult {
  success: boolean;
  captcha_token?: string;
  session_id: string;
  remaining_attempts?: number;
  pow_failed?: boolean;
}

/**
 * 세션 ID 는 발급과 검증이 **같아야** 한다 — 백엔드가 `POST /api/verify-token` 으로
 * 토큰을 확인할 때 발급 당시의 session_id 와 대조하고, 다르면 유효한 토큰도 거부된다.
 * 로그인은 실패→캡차→재시도 사이에 페이지 상태가 갈릴 수 있어 sessionStorage 에 고정한다.
 */
export function guardSessionId(): string {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return cached;
    const made = `guard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, made);
    return made;
  } catch {
    return `guard-${Date.now()}`;
  }
}

/**
 * 궤적 밖 자동화 신호. 캡차 서버가 `automation_score()` 로 위험도에 더한다.
 *
 * 비워 보내면 안 된다 — 신호가 없는 것과 "봇이 아님"이 구분되지 않아 위험도 게이트에
 * 걸린다(2026-08-12 에 이걸로 정답이 실패 처리됐다). 캡차 위젯(main.jsx)의
 * clientSignals() 를 그대로 옮긴 것이라 값 구성을 임의로 바꾸지 않는다.
 */
function clientSignals(): Record<string, unknown> {
  try {
    const n = navigator as Navigator & { webdriver?: boolean };
    return {
      webdriver: n.webdriver === true,
      headlessUA: /headless/i.test(n.userAgent || ''),
      languages: (n.languages || []).length,
      cores: n.hardwareConcurrency || 0,
    };
  } catch {
    return {};
  }
}

export const guardAssetSrc = (url: string): string =>
  url.startsWith('http') ? url : GUARD_ORIGIN + url;

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(GUARD_ORIGIN + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Captcha-Site-Key': SITE_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`guard_${res.status}`);
  return (await res.json()) as T;
}

export function createGuardChallenge(purpose = 'login'): Promise<GuardChallenge> {
  return call<GuardChallenge>('/api/captcha/challenges', {
    purpose,
    session_id: guardSessionId(),
  });
}

/**
 * 궤적 전송기. 영수증 체인을 들고 있어야 해서 챌린지마다 하나씩 만든다.
 *
 * 한 번 거부되면 그 뒤 배치는 체인이 끊겨 전부 거부되므로, 실패하면 조용히 멈춘다.
 * 궤적이 없어도 캡차 자체는 풀려야 한다 — 수집 실패가 로그인을 막으면 안 된다.
 */
export class GuardBehaviorSender {
  private seq = 0;
  /** 챌린지 전체에서 이어지는 이벤트 번호. 배치를 넘어가도 이어져야 한다. */
  private sent = 0;
  private previousReceipt: string | null = null;
  private dead = false;
  private readonly max: number;

  private readonly challengeId: string;
  private readonly nonce: string | undefined;

  constructor(challengeId: string, nonce: string | undefined, maxEvents: number | undefined) {
    this.challengeId = challengeId;
    this.nonce = nonce;
    this.max = maxEvents && maxEvents > 0 ? maxEvents : 32;
  }

  get disabled(): boolean {
    return this.dead || !this.nonce;
  }

  /**
   * 큐를 비울 때까지 배치를 보낸다. 보낸 만큼 큐에서 지운다.
   *
   * `seq` 는 서버 **필수** 필드인데 화면 쪽 기록기는 붙이지 않는다. 없으면 배치가
   * 통째로 422 로 반려되고, 그러면 궤적이 하나도 안 쌓인 채 "행동이 없는 사용자"로
   * 보여 위험도 게이트에 걸린다(2026-08-12 에 정답이 실패 처리된 원인). 여기서 붙인다.
   */
  async flush(queue: unknown[]): Promise<void> {
    if (this.disabled || !queue.length) return;
    try {
      while (queue.length) {
        const batch = queue.slice(0, this.max).map((e, i) => ({
          seq: this.sent + i,
          ...(e as Record<string, unknown>),
        }));
        const result = await call<{ accepted?: boolean; receipt?: string }>(
          `/api/captcha/challenges/${this.challengeId}/behavior-batches`,
          {
            session_id: guardSessionId(),
            nonce: this.nonce,
            batch_seq: this.seq,
            previous_receipt: this.previousReceipt,
            events: batch,
          },
        );
        if (!result.accepted || !result.receipt) throw new Error('behavior_batch_rejected');
        queue.splice(0, batch.length);
        this.sent += batch.length;
        this.seq += 1;
        this.previousReceipt = result.receipt;
      }
    } catch (error) {
      // 체인이 끊기면 회복이 안 된다. 더 보내지 않는다 — 캡차 풀이는 계속된다.
      //
      // 다만 **조용히 죽으면 안 된다.** 2026-08-12 에 seq 누락으로 모든 배치가 422 였는데
      // 이 catch 가 삼켜서, 화면에는 "정답인데 실패" 로만 보이고 원인이 안 드러났다.
      this.dead = true;
      console.warn('[catchap] 행동 배치 전송 실패 — 궤적이 쌓이지 않습니다', error);
    }
  }
}

export async function verifyGuardChallenge(
  challenge: GuardChallenge,
  selectedObjectIds: string[],
  durationMs: number,
): Promise<GuardVerifyResult> {
  // PoW 는 문제를 푸는 동안 미리 계산해두는 게 이상적이지만(위젯이 그렇게 한다),
  // 17비트는 실측 25ms 라 제출 시점에 풀어도 체감되지 않는다.
  const powNonce = await solveCatchapPow(challenge.pow);
  const out = await call<GuardVerifyResult>(
    `/api/captcha/challenges/${challenge.challenge_id}/verify`,
    {
      selected_object_ids: selectedObjectIds,
      session_id: guardSessionId(),
      duration_ms: Math.max(100, Math.round(durationMs)),
      pow_nonce: powNonce,
      client_signals: clientSignals(),
    },
  );
  return { ...out, session_id: guardSessionId() };
}
