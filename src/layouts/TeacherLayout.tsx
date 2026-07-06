import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PATHS } from '../routes/paths';
import { useAuth } from '../hooks/useAuth';
import { teacherApi } from '../api/teacher';
import mascot from '../assets/characters/catchap-logo.png';
import './TeacherLayout.css';

/**
 * 선생님 콘솔 공통 좌측 사이드바(236px sticky) — CatChap 선생님.dc.html 사이드바 원본 그대로.
 * - 활성 메뉴는 route 기준으로 자동 결정.
 * - 마이페이지 route에서는 상단 프로필 카드가 원본의 강조(보라) 카드로 바뀐다.
 * - children은 각 페이지의 <main>(원본 padding: 24px 30px 44px — 페이지 CSS가 정의).
 */

const MENU = [
  { label: '우리 학급 요약', icon: 'ph-fill ph-squares-four', to: PATHS.TEACHER_HOME },
  { label: '우리반 학생', icon: 'ph-fill ph-users-three', to: PATHS.TEACHER_CLASS },
  { label: '전체 학생 조회', icon: 'ph-fill ph-list-magnifying-glass', to: PATHS.TEACHER_STUDENTS },
  { label: '학습 분석', icon: 'ph-fill ph-chart-bar', to: PATHS.TEACHER_ANALYTICS },
  { label: '가정 안내', icon: 'ph-fill ph-chats-circle', to: PATHS.TEACHER_FAMILY_NOTICE },
];

interface TeacherLayoutProps {
  children: ReactNode;
  /** 마이페이지에서 저장된 프로필 이름을 실시간 반영할 때 사용 */
  profileName?: string;
  /** 프로필 카드 보조 라벨(기본 '1-2반 담임') */
  profileSub?: string;
  /**
   * 사이드바 하단 카드 — 미지정: "이번 주 과제"(선생님/마이페이지 원본),
   * ReactNode: 내용 교체(전체학생조회 "전체 학생" / 학습분석 "이번 주 인사이트"),
   * null: 카드 없음(우리반/가정안내 원본).
   */
  bottomCard?: ReactNode | null;
}

/** 담당 학급 라벨 캐시 — 페이지 이동마다 재요청하지 않도록 모듈 레벨 보관 */
let cachedHomeroom: string | null = null;

export default function TeacherLayout({
  children,
  profileName,
  profileSub,
  bottomCard,
}: TeacherLayoutProps) {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [homeroom, setHomeroom] = useState<string | null>(cachedHomeroom);

  // profileSub 미지정 페이지: 담당 학급(classes 실테이블)으로 '1-2반 담임' 기본값 대체
  useEffect(() => {
    if (profileSub || cachedHomeroom) return;
    let mounted = true;
    teacherApi
      .profile()
      .then((p: { class_name?: string | null }) => {
        if (!mounted || !p?.class_name) return;
        cachedHomeroom = `${p.class_name} 담임`;
        setHomeroom(cachedHomeroom);
      })
      .catch(() => {
        /* API 실패 시 기본 라벨 유지 */
      });
    return () => {
      mounted = false;
    };
  }, [profileSub]);

  const name = profileName || me?.name || '이수진';
  const sub = profileSub || homeroom || '1-2반 담임';
  const onMyPage = pathname === PATHS.TEACHER_MYPAGE;

  return (
    <div className="tl-root">
      <aside className="tl-side">
        <Link to={PATHS.TEACHER_HOME} className="tl-logo">
          <img src={mascot} alt="CatChap" />
          <div className="tl-logo-text">
            <div className="tl-logo-name">CatChap</div>
            <div className="tl-logo-sub">선생님 콘솔</div>
          </div>
        </Link>
        {onMyPage ? (
          <div className="tl-prof tl-prof-active">
            <span className="tl-prof-avatar">{name.charAt(0)}</span>
            <div className="tl-prof-info">
              <div className="tl-prof-name">{name} 선생님</div>
              <div className="tl-prof-sub">{sub}</div>
            </div>
          </div>
        ) : (
          <Link to={PATHS.TEACHER_MYPAGE} className="tl-prof">
            <span className="tl-prof-avatar">{name.charAt(0)}</span>
            <div className="tl-prof-info">
              <div className="tl-prof-name">{name} 선생님</div>
              <div className="tl-prof-sub">{sub}</div>
            </div>
          </Link>
        )}
        {MENU.map((m) => (
          <Link
            key={m.label}
            to={m.to}
            className={'tl-menu-link' + (pathname === m.to ? ' tl-active' : '')}
          >
            <i className={m.icon} />
            {m.label}
          </Link>
        ))}
        {bottomCard !== null && (
          <div className="tl-task">
            {bottomCard ?? (
              <>
                <div className="tl-task-title">이번 주 과제</div>
                <div className="tl-task-desc">숫자 놀이터 배정 · 22명 중 16명 완료</div>
                <div className="tl-task-bar">
                  <div className="tl-task-fill" />
                </div>
              </>
            )}
          </div>
        )}
      </aside>
      {children}
    </div>
  );
}
