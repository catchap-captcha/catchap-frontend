/**
 * 포인터 움직임을 **숫자 몇 개로 줄여서** 내보낸다. 좌표는 서버로 보내지 않는다.
 *
 * 왜 요약만 보내나
 * ----------------
 * 캡차 안에서는 좌표를 그대로 보낸다 — 몇 초짜리라 양이 적고, 재생 공격을 잡으려면
 * 경로 모양 자체가 필요하기 때문이다. 강의는 다르다. 40분을 40ms 마다 찍으면 1.8MB 고,
 * 그걸 서버에 쌓으면 하루 수백만 행이 된다.
 *
 * 더 중요한 이유는 따로 있다. 마우스 궤적은 **그것만으로 사람이 구분된다**
 * (2026-08-12 실측: 같은 사람 4명 전원 식별, 다른 사람 오인 0.040%). 사이트 전체에서
 * 원본 좌표를 모으는 것은 다루기 어려운 자료를 만드는 일이다. 브라우저 안에서 세고
 * 숫자만 내보내면 그 문제가 대부분 사라진다.
 *
 * 무엇을 세나
 * -----------
 * 0813 에 사람과 짧은-궤적 봇을 실제로 가른 특징들에서 골랐다.
 *
 *     turns   방향 전환      AUC 0.87   사람 손은 계속 미세하게 꺾인다
 *     micro   미세 이동 비율  AUC 0.83   기계는 필요한 만큼만 움직인다
 *     gaps    간격 불규칙     AUC 0.86   기계는 일정한 주기로 움직인다
 *     pauses  멈춤 횟수                  사람은 멈칫한다
 *
 * `linearity`(span/dist)도 함께 낸다. 직선으로 곧장 가는지 보는 값이다.
 *
 * 무동작은 판단하지 않는다
 * ------------------------
 * `n = 0` 은 봇 신호가 **아니다**. 강의를 집중해서 보는 사람이 정확히 그렇게 행동한다.
 * 그걸 벌하면 성실한 사용자만 걸린다. 여기서는 "움직임이 있었을 때 그게 사람의
 * 움직임인가" 만 본다. 시뮬레이션 봇은 출석 검증을 통과하려고 **일부러 움직이므로**
 * 그때 이 숫자들이 어긋난다.
 */

/** 이 간격보다 길게 끊기면 멈춘 것으로 본다. 캡차 쪽 `aim_segment` 와 같은 값. */
const PAUSE_MS = 400;
/** 표본 간격. 캡차 위젯과 같게 둔다 — 다른 주기로 재면 값이 비교가 안 된다. */
const SAMPLE_MS = 40;
/** 이 거리(화면 비율) 미만의 이동은 '미세 이동'. 손떨림·보정 움직임을 잡는다. */
const MICRO = 0.004;

export interface MotionSummary {
  /** 표본 수. 0 이면 그 구간에 움직임이 없었다는 뜻이고, 그 자체는 판단하지 않는다. */
  n: number;
  /** 이동 거리 합 (화면 비율). */
  dist: number;
  /** 시작점에서 끝점까지 직선 거리 (화면 비율). `span / dist` 가 곧음의 척도다. */
  span: number;
  /** 방향이 꺾인 횟수. */
  turns: number;
  /** 미세 이동의 비율 (0~1). */
  micro: number;
  /** 멈춘 횟수 (표본 간격이 PAUSE_MS 를 넘은 횟수). */
  pauses: number;
  /** 표본 간격의 변동계수 — 클수록 불규칙하다. 기계는 0 에 가깝다. */
  gaps: number;
}

const EMPTY: MotionSummary = { n: 0, dist: 0, span: 0, turns: 0, micro: 0, pauses: 0, gaps: 0 };

const round = (value: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * 화면 하나에 붙여 쓰는 수집기.
 *
 * 좌표는 **여기 안에서만** 살아 있고 `take()` 하는 순간 숫자로 접힌다. 밖으로 나가는
 * 것은 `MotionSummary` 뿐이다.
 */
export class MotionCollector {
  private points: { x: number; y: number; t: number }[] = [];
  private last = 0;

  /** 창 크기로 나눠 0~1 로 만든다 — 화면이 달라도 값이 비교되게. */
  observe(event: { clientX: number; clientY: number }): void {
    const now = Date.now();
    if (now - this.last < SAMPLE_MS) return;
    this.last = now;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.points.push({ x: event.clientX / w, y: event.clientY / h, t: now });
    // 한 구간이 길어져도 메모리가 늘지 않게 자른다. 5초 하트비트면 125개면 충분하다.
    if (this.points.length > 600) this.points.splice(0, this.points.length - 600);
  }

  /** 요약을 내고 버퍼를 비운다. 다음 구간은 처음부터 다시 센다. */
  take(): MotionSummary {
    const pts = this.points;
    this.points = [];
    if (pts.length < 2) return { ...EMPTY, n: pts.length };

    let dist = 0;
    let micro = 0;
    let pauses = 0;
    let turns = 0;
    const gaps: number[] = [];
    let prevAngle: number | null = null;

    for (let i = 1; i < pts.length; i += 1) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const step = Math.hypot(dx, dy);
      dist += step;
      if (step < MICRO) micro += 1;

      const gap = pts[i].t - pts[i - 1].t;
      gaps.push(gap);
      if (gap > PAUSE_MS) pauses += 1;

      if (step > 0) {
        const angle = Math.atan2(dy, dx);
        if (prevAngle !== null) {
          // 각도는 -π~π 라 그냥 빼면 한 바퀴 도는 지점에서 튄다. 짧은 쪽으로 접는다.
          const diff = Math.abs(((angle - prevAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
          if (diff > Math.PI / 6) turns += 1;
        }
        prevAngle = angle;
      }
    }

    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
    const first = pts[0];
    const last = pts[pts.length - 1];

    return {
      n: pts.length,
      dist: round(dist),
      span: round(Math.hypot(last.x - first.x, last.y - first.y)),
      turns,
      micro: round(micro / (pts.length - 1)),
      pauses,
      gaps: mean > 0 ? round(Math.sqrt(variance) / mean) : 0,
    };
  }
}

/**
 * 화면 전체의 포인터 이동을 수집기에 물린다. 해제 함수를 돌려준다.
 *
 * `pointermove` 만 듣는다 — 키 입력은 보지 않는다. 간격만으로도 판단이 되는데 내용까지
 * 보면 성격이 완전히 달라진다.
 */
export function watchPointer(collector: MotionCollector): () => void {
  const handler = (event: PointerEvent) => collector.observe(event);
  window.addEventListener('pointermove', handler, { passive: true });
  return () => window.removeEventListener('pointermove', handler);
}
