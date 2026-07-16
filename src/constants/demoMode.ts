/**
 * 시연용 임시 게이트 — 기관에 강사 도입 시 되돌릴 것.
 *
 * 주제를 시청 검증형 인강으로 전환하면서 학부모·기관 역할을 당분간 쓰지 않는다.
 * 이 플래그가 true인 동안:
 *  - 로그인 화면 역할 탭에서 학부모·기관 숨김 (pages/auth/LoginPage.tsx)
 *  - 학부모·교사·기관 라우트 비활성 — 직접 URL 입력도 404 (routes/index.tsx)
 *  - 랜딩의 학부모·기관 안내 섹션·문구 숨김 (pages/public/MainPage.tsx)
 *  - 공개 FAQ·문의 유형의 학부모·기관 항목 숨김 (SupportPage/ContactPage)
 *
 * 페이지 파일은 전부 그대로 남아 있다 — 이 값을 false로 바꾸면 모두 복원된다.
 * 참고: 학생 가입은 별도의 영구 전환(2026-07-16, 이메일 가입)으로 기관 선택·코드가
 * 아예 빠졌다 — 그 부분은 이 플래그와 무관하다(LoginPage의 '학생 이메일 가입 전환' 주석 참고).
 */
export const DEMO_STUDENT_ONLY = true;
