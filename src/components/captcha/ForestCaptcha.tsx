import { useEffect, useState } from 'react';

import { client } from '../../api/client';
import DragObjectCaptcha from './DragObjectCaptcha';
import type { GuardVerification } from '../../lib/catchapGuard';
import ForestCaptchaLegacy from './ForestCaptchaLegacy';

interface Props {
  /** `meta` 는 CatChap Guard 로 전환했을 때만 온다. 기존 캡차는 토큰만 준다. */
  onToken: (token: string, meta?: GuardVerification) => void;
  onClose?: () => void;
}

/**
 * ForestCaptcha — 메인 캡차(로그인/회원가입 5회 실패 스텝업) 진입점 겸 디스패처.
 *
 * 왜 이렇게(팀 학습용): 메인 캡차를 기존 forest(3D)에서 "다중 객체 드래그" 캡차로 교체 중이다.
 * 백엔드는 DRAG_CAPTCHA_ENABLED 플래그로 활성 여부를 제어하는데, 플래그가 꺼진 동안 프론트가
 * 무조건 드래그 위젯을 띄우면 드래그 엔드포인트가 404라 스텝업 캡차가 깨진다. 그래서 여기서
 * 백엔드 플래그(GET /captcha/drag/config)를 먼저 보고 — 켜져 있으면 드래그 캡차, 꺼져 있으면
 * 기존 forest 캡차를 렌더한다. 호출부(LoginPage/OpsLogin)는 이 컴포넌트만 쓰므로 무변경으로
 * 플래그 하나로 전환된다.
 *
 * 세 번째 갈래 — `VITE_LOGIN_CAPTCHA=catchap`:
 * 로그인 캡차를 CatChap Guard(성원/민서, `captcha.catchap5.com`)로 바꾸는 전환용이다.
 * **백엔드가 `POST /api/verify-token` 을 붙이기 전에는 켜면 안 된다.** 그 위젯의 토큰은
 * 캡차 서버에 물어봐야 유효해지는데, 지금 로그인 API 는 자기가 발급한 토큰만 알아본다.
 * 그래서 기본값은 꺼짐이고, 켜지 않는 한 아래 두 갈래는 지금과 완전히 동일하게 돈다.
 * 규약: `ai-service/docs/SPEC_BACKEND_CAPTCHA_20260804.md`
 */
export default function ForestCaptcha({ onToken, onClose }: Props) {
  const [useDrag, setUseDrag] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    client
      .get('/captcha/drag/config')
      .then((r) => {
        if (alive) setUseDrag(!!r.data?.enabled);
      })
      .catch(() => {
        if (alive) setUseDrag(false); // 확인 실패 시 안전하게 기존 forest로
      });
    return () => {
      alive = false;
    };
  }, []);

  if (useDrag === null) return null; // 플래그 확인 중(1회, 짧음)
  return useDrag ? (
    <DragObjectCaptcha onToken={onToken} onClose={onClose} />
  ) : (
    <ForestCaptchaLegacy onToken={onToken} onClose={onClose} />
  );
}
