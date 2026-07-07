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

/** 위젯 스크립트를 1회만 로드하고 window.CatChap 준비를 보장한다. */
function ensureScript(api: string): Promise<void> {
  if (window.CatChap) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const src = `${api.replace(/\/$/, '')}/widget/catchap-widget.js`;
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
}

export default function CatchapWidget({ siteKey, api, subject, size = 'full', className }: Props) {
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
    // subject/siteKey가 바뀌면 재마운트
  }, [siteKey, api, subject, size]);

  return <div ref={hostRef} className={className} />;
}
