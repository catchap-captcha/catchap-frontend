import { useEffect, useState } from 'react';

import { client } from '../../api/client';
import DragObjectCaptcha from './DragObjectCaptcha';
import ForestCaptchaLegacy from './ForestCaptchaLegacy';

interface Props {
  onToken: (token: string) => void;
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
