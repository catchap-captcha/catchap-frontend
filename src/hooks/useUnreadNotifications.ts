import { useEffect, useState } from 'react';
import { notificationApi } from '../api/notifications';

const EVENT = 'catchap:notifications-updated';

/** 읽음 처리 후 벨 배지 갱신을 알림 (알림 페이지 → NAV) */
export function notifyNotificationsUpdated() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * 읽지 않은 알림 개수 — 상단바 벨 빨간 점 표시용.
 * 서버 read_at 기준이므로 로그아웃/재로그인해도 상태가 유지된다.
 */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let on = true;
    const load = () => {
      notificationApi
        .list()
        .then((list) => {
          if (on) setCount(list.filter((n) => !n.read_at).length);
        })
        .catch(() => {
          /* 실패 시 현재 값 유지 */
        });
    };
    load();
    window.addEventListener(EVENT, load);
    return () => {
      on = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);

  return count;
}
