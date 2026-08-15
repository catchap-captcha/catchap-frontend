import { Link, useLocation } from 'react-router-dom';

import { PATHS } from '../../routes/paths';
import './SystemScreenGuide.css';

/**
 * 「시스템」 메뉴의 세 화면이 서로 무엇이 다른지 밝히고 오갈 수 있게 한다.
 *
 * ★왜 필요한가 — 세 화면은 ★같은 앱(캡차 API·행동 AI·프론트·STT 워커)을 다 보여준다.
 *   실무에서 상태판(지금 되나)과 모니터링(얼마나 쓰나)이 겹치는 것은 정상이지만,
 *   화면이 그 차이를 아무 데도 밝히지 않아 "이거 겹치는 거 아니야?" 로 읽혔다(0815 지적).
 *
 * 겹치는 것을 줄이는 대신 ★무엇을 보러 어디에 왔는지를 적는다 — 목적이 다르면 둘 다 필요하다.
 */
const SCREENS = [
  {
    to: PATHS.OPS_SYSTEM_STATUS,
    label: '시스템 상태',
    when: '지금 되나?',
    what: '한 번에 정상·이상만. 이상하면 여기서 먼저 본다.',
  },
  {
    to: PATHS.OPS_MONITORING,
    label: '모니터링',
    when: '얼마나 쓰나?',
    what: 'CPU·메모리·디스크·GPU 수치와 추세. 왜 느린지 파고들 때.',
  },
  {
    to: PATHS.OPS_ALERTS,
    label: '시스템 경보',
    when: '무슨 일이 있었나?',
    what: '지나간 경보 이력. 자는 사이에 무슨 일이 있었는지.',
  },
] as const;

export default function SystemScreenGuide() {
  const { pathname } = useLocation();
  return (
    <nav className="ssg" aria-label="시스템 화면 안내">
      {SCREENS.map((s) => {
        const here = pathname === s.to;
        const body = (
          <>
            <span className="ssg-when">{s.when}</span>
            <span className="ssg-label">
              {s.label}
              {here && <span className="ssg-here">지금 보는 곳</span>}
            </span>
            <span className="ssg-what">{s.what}</span>
          </>
        );
        return here ? (
          <div key={s.to} className="ssg-item ssg-item--here" aria-current="page">
            {body}
          </div>
        ) : (
          <Link key={s.to} to={s.to} className="ssg-item">
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
