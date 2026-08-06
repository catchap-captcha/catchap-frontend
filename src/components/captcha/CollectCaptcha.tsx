import { useEffect, useRef, useState } from 'react';
import './CollectCaptcha.css';

/**
 * CollectCaptcha — 외부 "CatChap Guard"(성원/민서) 캡차 위젯을 **행동데이터 수집 전용**으로
 * 붙이는 래퍼.
 *
 * 우리 학습 위젯(CatchapWidget · class="catchap" · ck_edu_* site key · api.catchap5.com)과는
 * **완전히 별개 서비스**다. 키 체계도 호스트도 다르고, 학습 위젯을 아무리 풀어도 저쪽
 * 모델 데이터로는 한 건도 안 쌓인다. 그래서 이 위젯을 "추가로" 띄운다(학습 위젯은 그대로 둔다).
 * 참여자 코드(data-participant)를 학습 위젯에 넣으면 안 된다 — 속성 체계가 다르다.
 *
 * 지금 두 화면(강의 시청·문제은행)에서는 **수집만** 한다. 봇 판정(verify)은 켜지 않으므로
 * `window.catchapOnVerified`를 정의하지 않는다. 나중에 판정을 붙일 때 그 전역을 쓰게 되는데,
 * 위젯 로더가 문서 전역에 하나만 두는 콜백이라 여러 화면이 공유한다는 점에 주의.
 *
 * 위젯 로더(widget.js) 계약 — 실제 배포본 확인(2026-08-06):
 *   · `document.currentScript`의 data-* 속성으로 설정을 읽는다 → 스크립트 태그에 실어야 한다.
 *   · `data-target` 셀렉터를 **document 전역**에서 찾아 그 안에 iframe을 넣는다.
 *     못 찾으면 스크립트 바로 앞에 컨테이너를 만들어 넣는다.
 *   · iframe src = `<origin>/?embed=1&lecture=<data-lecture-id>[&participant=<data-participant>]`
 *     — participant가 비면 파라미터 자체가 안 붙는다.
 *   · iframe은 `max-width:620px; height:760px` 인라인 스타일로 고정된다.
 *
 * 마운트 노드와 <script>를 하나의 wrapper 안에 함께 넣고 wrapper째 떼는 이유:
 * 리마운트(StrictMode 이중 호출 포함) 시 아직 실행 전인 옛 스크립트가 살아 있어도,
 * 떨어져 나간 wrapper 안에서 자기 컨테이너를 찾다 끝난다 — 화면의 살아 있는 마운트를
 * 가로채 iframe을 두 개 만들지 않는다. data-target id를 인스턴스마다 유일하게 주는 것도 같은 이유.
 */

const COLLECT_ORIGIN =
  (import.meta.env.VITE_COLLECT_CAPTCHA_ORIGIN as string | undefined) ?? 'https://captcha.catchap5.com';

/** 스테이지가 온전히 나오는 최소 컨테이너 폭.
 *
 *  iframe 인라인 스타일의 max-width 는 620px 이지만, 그 안의 캡차 카드가
 *  `.cc-card { width: 560px }` 고정이라 620px 을 다 줘도 카드는 560px 이고 나머지는 여백이다.
 *  즉 컨테이너가 560 이상이면 스테이지 크기가 늘 같고(캡차팀 DB 기준 500px), 560 아래로
 *  내려갈 때만 줄어든다.
 *
 *  처음에 620 으로 잡았다가 캡차팀 실측 분포로 정정했다(2026-08-06). 그쪽 DB 에서 스테이지
 *  폭이 500px 591건으로 천장을 치고 그 위가 없다 — 620 기준으로 두면 컨테이너 560~619 구간이
 *  멀쩡한데도 경고가 뜬다. */
const FULL_STAGE_PX = 560;

let seq = 0;

interface Props {
  /** 수집 참여자 코드 — URL `?collect=` 값. 비면 아무것도 렌더하지 않는다. */
  participant: string;
  /** 실제 강의 ID. 강의가 없는 화면(문제은행)에서는 생략한다. */
  lectureId?: string;
  /** 위젯 위에 붙는 설명 — 한 화면에 캡차가 둘 보이므로 어느 쪽인지 알려준다. */
  note?: string;
  className?: string;
}

export default function CollectCaptcha({ participant, lectureId, note, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** 스테이지가 620px 미만으로 찌그러졌을 때의 실제 폭. 정상이면 null. */
  const [narrowPx, setNarrowPx] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !participant) return;

    const mountId = `collect-mount-${++seq}`;

    const wrap = document.createElement('div');
    wrap.className = 'cc-wrap';

    const mount = document.createElement('div');
    mount.id = mountId;
    mount.setAttribute('data-collect-mount', '1');
    wrap.appendChild(mount);

    const script = document.createElement('script');
    script.src = `${COLLECT_ORIGIN}/widget.js`;
    script.async = true;
    script.setAttribute('data-target', `#${mountId}`);
    script.setAttribute('data-participant', participant);
    // 강의가 없는 화면에서는 속성을 아예 안 붙인다(로더는 빈 문자열로 처리한다).
    if (lectureId) script.setAttribute('data-lecture-id', lectureId);
    script.addEventListener('error', () => {
      mount.textContent = '수집용 캡차를 불러오지 못했습니다.';
    });
    // <script>도 wrapper 안에 둔다 — 위에 적은 리마운트 안전장치.
    wrap.appendChild(script);

    host.appendChild(wrap);

    return () => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    };
  }, [participant, lectureId]);

  /* 스테이지 폭 감시 — 수집 품질 방어선.
     컨테이너가 FULL_STAGE_PX 아래로 내려가면 캡차 카드가 같이 찌그러진다. 같은 사람이
     화면(또는 창 크기)에 따라 다른 크기로 풀면 그게 그대로 표면 차이가 되고, 7월에 옛 수집
     화면 오탐 0.11%가 메인에서 33.3%로 튄 원인이 정확히 이것이었다. 현재 모델 특징 55개 중
     16개가 픽셀 기반이라 섞이면 영향을 받는다.
     조용히 어긋나는 게 제일 나쁘므로, 줄어들면 푸는 사람에게 바로 보여준다. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !participant) return;
    const measure = () => {
      const w = Math.round(host.getBoundingClientRect().width);
      setNarrowPx(w > 0 && w < FULL_STAGE_PX ? w : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [participant]);

  if (!participant) return null;

  return (
    <section className={`cc-block${className ? ` ${className}` : ''}`}>
      <div className="cc-head">
        <span className="cc-badge">
          <i className="ph-fill ph-waveform" />
          행동데이터 수집
        </span>
        <span className="cc-who">참여자 {participant}</span>
      </div>
      <p className="cc-note">
        {note ?? '이 캡차는 통과 여부를 판정하지 않습니다. 푸는 동안의 조작 데이터만 수집합니다.'}
      </p>
      {narrowPx != null && (
        <p className="cc-warn" role="status">
          <i className="ph-fill ph-arrows-out-line-horizontal" />
          창이 좁아 문제 영역이 <b>{narrowPx}px</b>로 줄었습니다(정상 {FULL_STAGE_PX}px 이상). 이대로
          풀면 다른 화면에서 모은 데이터와 크기가 어긋납니다 — 창을 넓혀 주세요.
        </p>
      )}
      <div ref={hostRef} className="cc-host" />
    </section>
  );
}
