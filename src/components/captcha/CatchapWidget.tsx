import { useEffect, useRef } from 'react';

/**
 * CatchapWidget — 우리가 만든 교육형/캡차 API의 임베드 위젯(catchap-widget.js)을
 * 우리 앱 안에 그대로 붙이는 1st-party 소비자(dogfooding) 래퍼.
 *
 * 위젯은 바닐라 JS로 컨테이너 DOM을 직접 조작하므로, React가 관리하지 않는
 * 격리된 자식 노드에 명령형으로 마운트한다(리액트 재조정과 충돌 방지).
 */

interface CatchapGlobal {
  mount: (el: HTMLElement) => void;
  init: () => void;
}
declare global {
  interface Window {
    CatChap?: CatchapGlobal;
  }
}

let scriptPromise: Promise<void> | null = null;
// 앱 로드 1회 고정된 버전 토큰 — 위젯 <script> 캐시버스트용(페이지 새로고침마다 갱신).
const WIDGET_VERSION = Math.floor(performance.timeOrigin);

/** 위젯 스크립트를 1회만 로드하고 window.CatChap 준비를 보장한다. */
function ensureScript(api: string): Promise<void> {
  if (window.CatChap) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    // 캐시버스트: 페이지 로드 시각을 버전으로 붙여, 백엔드가 위젯을 갱신하면 다음 방문에
    // 최신본을 받는다(브라우저가 옛 위젯을 무기한 캐시하던 문제 방지). SPA 내 재마운트는
    // 아래 existing 재사용으로 재요청 없음.
    const src = `${api.replace(/\/$/, '')}/widget/catchap-widget.js?v=${WIDGET_VERSION}`;
    const existing = document.querySelector<HTMLScriptElement>(`script[data-catchap-widget]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject());
      if (window.CatChap) resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.setAttribute('data-catchap-widget', '1');
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject());
    document.head.appendChild(el);
  });
  return scriptPromise;
}

interface Props {
  siteKey: string;
  api: string; // 예: http://localhost:8000/api/v1
  subject?: string; // 교육형: 과목별 챌린지 요청
  size?: 'full' | 'compact';
  className?: string;
  /* 인앱(1st-party) 학습 세션 전용 — 외부 임베드 데모에선 생략 */
  // 학생 access token → 서버가 채점 결과를 학습기록에 적립.
  // 함수를 주면 위젯이 매 요청 전에 호출해 항상 유효한 토큰을 쓴다(만료 자동 갱신).
  auth?: string | (() => Promise<string | null>) | null;
  day?: number; // 커리큘럼 일차 (생활)
  chapter?: number; // 전체학습 주간 챕터 — 그 챕터 문항만 + 오늘의퀴즈 미오염
  stage?: number; // 챕터 단계(1~5)
  replay?: boolean; // 복습 — 코인·퀴즈 상태 미반영
  total?: number; // 세션 문항 수 — 채우면 위젯이 catchap:finished 발신
}

export default function CatchapWidget({
  siteKey, api, subject, size = 'full', className, auth, day, chapter, stage, replay, total,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    // 격리 컨테이너 생성 — React는 이 div의 자식을 건드리지 않는다(명령형 소유).
    const box = document.createElement('div');
    box.className = 'catchap';
    box.setAttribute('data-site-key', siteKey);
    box.setAttribute('data-api', api);
    box.setAttribute('data-size', size);
    if (subject) box.setAttribute('data-subject', subject);
    if (typeof auth === 'function') {
      // 함수형 토큰: DOM 속성에 못 실으므로 프로퍼티로 전달 — 위젯이 요청마다 호출
      (box as HTMLDivElement & { catchapAuth?: () => Promise<string | null> }).catchapAuth = auth;
    } else if (auth) {
      box.setAttribute('data-auth', auth);
    }
    if (day) box.setAttribute('data-day', String(day));
    if (chapter) box.setAttribute('data-chapter', String(chapter));
    if (stage) box.setAttribute('data-stage', String(stage));
    if (replay) box.setAttribute('data-replay', '1');
    if (total) box.setAttribute('data-total', String(total));
    // 인앱은 게임 화면이 학생 설정(효과음 토글)에 따라 직접 재생 — 위젯 자체 효과음은 꺼서
    // 이중 재생을 막는다. (외부 임베드는 이 속성이 없어 기본 켜짐)
    box.setAttribute('data-sfx', '0');
    host.appendChild(box);

    ensureScript(api)
      .then(() => {
        if (cancelled) return;
        window.CatChap?.mount(box);
      })
      .catch(() => {
        if (cancelled) return;
        box.textContent = '위젯을 불러오지 못했어요.';
      });

    return () => {
      cancelled = true;
      // 마운트 노드 제거(구독/타이머 없는 순수 DOM 위젯이라 노드 제거로 충분)
      if (box.parentNode) box.parentNode.removeChild(box);
    };
    // subject/siteKey 등이 바뀌면 재마운트
  }, [siteKey, api, subject, size, auth, day, chapter, stage, replay, total]);

  return <div ref={hostRef} className={className} />;
}
