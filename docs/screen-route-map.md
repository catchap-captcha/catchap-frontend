# CatChap 화면-라우트 맵

역할별 접근 제한은 `src/routes/ProtectedRoute.tsx` + `roleRoutes.ts`에서 적용.
handoff 원본: `어린이 교육 웹사이트 디자인-handoff.zip` → `untitled/project/*.dc.html`

## 공개 (비로그인)
| 화면 | Route | 연결 API | handoff 원본 |
| --- | --- | --- | --- |
| 메인(랜딩) | `/` | — (정적) | CatChap 메인.dc.html |
| 문의하기 | `/contact` | POST /inquiries | CatChap 문의하기.dc.html |
| 고객지원(FAQ) | `/support` | POST /inquiries | CatChap 고객지원.dc.html |
| 이용약관 | `/terms` | — | CatChap 이용약관.dc.html |
| 개인정보처리방침 | `/privacy` | — | CatChap 개인정보처리방침.dc.html |
| 로그인+회원가입+기관등록 | `/login` | /auth/* (login, student-login, register 4종, email code, org/teacher code) | CatChap 로그인.dc.html |
| 비밀번호 재설정 | `/password-reset` | /auth/password-reset/* | CatChap 비밀번호 재설정.dc.html |
| 보안 캡차 위젯 | `/captcha` | GET /captcha/challenge (stub) | CatChap 보안캡챠.dc.html |
| 404 | `*` | — | CatChap 404.dc.html |

공용 컴포넌트: InstitutionPicker (`src/components/auth/`) — GET /institutions/search·regions ← InstitutionPicker.dc.html

## 학생 (role: student)
| 화면 | Route | 연결 API | handoff 원본 |
| --- | --- | --- | --- |
| 학습 홈 | `/student/home` | /students/me/dashboard | CatChap 학습 홈.dc.html |
| 챕터지도 | `/student/chapters?subject=` | /students/me/progress | CatChap 챕터지도.dc.html |
| 게임화면 | `/student/game?subject=&chapter=` | /students/me/game-state (+#captcha-mount stub) | CatChap 게임화면.dc.html |
| 학습결과 | `/student/result?subject=` | /students/me/result | CatChap 학습결과.dc.html |
| 오늘의퀴즈 | `/student/daily-quiz` | /students/me/daily-quiz | CatChap 오늘의퀴즈.dc.html |
| 전체학습 | `/student/all-learning` | /students/me/progress | CatChap 전체학습.dc.html |
| 개념설명 | `/student/concepts?tab=` | /students/me/concepts/read | CatChap 개념설명.dc.html |
| 나의기록 | `/student/records` | /students/me/records | CatChap 나의기록.dc.html |
| 오답노트 | `/student/wrong-notes` | /students/me/wrong-notes | CatChap 오답노트.dc.html |
| 배지 | `/student/badges` | /students/me/badges | CatChap 배지.dc.html |
| 프로필 꾸미기 | `/student/profile` | /students/me/wallet·avatar·shop, /shop/catalog, class-ranking | CatChap 프로필 꾸미기.dc.html |
| 취약문제추천 | `/student/recommended` | /students/me/recommendations | CatChap 취약문제추천.dc.html |
| AI선생님 | `/student/ai-teacher` | POST /ai/student-chat (stub) | CatChap AI선생님.dc.html |
| 검색 | `/student/search` | GET /contents/search | CatChap 검색.dc.html |
| 알림 | `/student/notifications` | /notifications | CatChap 알림.dc.html |
| 설정 | `/student/settings` | /settings/me | CatChap 설정.dc.html |

눈쉬기: ScreenTimeReminder(60분 오버레이 — screen-time-reminder.js 포팅) + EyeRestToast(눈쉬기팝업.dc.html)

## 학부모 (role: parent)
| 화면 | Route | 연결 API | handoff 원본 |
| --- | --- | --- | --- |
| 주간 요약(홈) | `/parent/home?child=` | /parents/me/children, children/{id}/summary, link-request | CatChap 학부모.dc.html + 학부모 도윤.dc.html |
| 상세 리포트 | `/parent/reports` | children/{id}/report | CatChap 학부모리포트.dc.html (+학부모-print의 @media print 반영) |
| 상담 AI | `/parent/counsel-ai` | POST /ai/parent-chat (stub) | CatChap 학부모 상담 AI.dc.html |
| 알림 | `/parent/notifications` | /notifications | CatChap 학부모알림.dc.html |
| 마이페이지 | `/parent/mypage` | /settings/me, children CRUD, change-password | CatChap 학부모 마이페이지.dc.html |

## 교사 (role: teacher, org_admin 접근 가능)
| 화면 | Route | 연결 API | handoff 원본 |
| --- | --- | --- | --- |
| 학급 요약(홈) | `/teacher/home` | /teacher/dashboard | CatChap 선생님.dc.html |
| 우리반 | `/teacher/class` | /teacher/class/students CRUD | CatChap 우리반.dc.html |
| 전체 학생 조회 | `/teacher/students` | /teacher/students | CatChap 전체학생조회.dc.html |
| 학습 분석 | `/teacher/analytics` | /teacher/analytics | CatChap 선생님 학습분석.dc.html |
| 가정 안내 | `/teacher/family-notice` | /teacher/family-messages | CatChap 가정안내.dc.html |
| 마이페이지 | `/teacher/mypage` | /teacher/profile·classes, /settings/me | CatChap 선생님 마이페이지.dc.html |

## 기관 관리자 (role: org_admin, ops 접근 가능)
| 화면 | Route | 연결 API | handoff 원본 |
| --- | --- | --- | --- |
| 기관 요약(홈) | `/org/home` | /orgs/{id}/dashboard, site-status | CatChap 기관.dc.html |
| 학급·학생 | `/org/classes` | /orgs/{id}/classes, roster | CatChap 학급학생관리.dc.html |
| 선생님 관리 | `/org/teachers` | /orgs/{id}/teachers CRUD | CatChap 선생님관리.dc.html |
| 학습 분석 | `/org/analytics` | /orgs/{id}/analytics | CatChap 학습분석.dc.html |
| 캡차 설정 | `/org/captcha-settings` | /orgs/{id}/captcha-settings | CatChap 캡차설정.dc.html |
| AI 모델 | `/org/ai-models` | /orgs/{id}/ai-models | CatChap AI모델.dc.html |
| 보안·정책 | `/org/security-policy` | — (정적) | CatChap 보안정책.dc.html |
| 학생 관리 | `/org/students` | /orgs/{id}/students/register·invite-code·reset-password | (온보딩 재설계 · handoff 외 신규) |
| 마이페이지 | `/org/mypage` | /orgs/{id}/billing·admins, /settings/me | CatChap 기관 마이페이지.dc.html |

## 운영자 (role: ops · 온보딩 재설계로 신규, handoff 외)
| 화면 | Route | 연결 API |
| --- | --- | --- |
| 기관 가입 승인 | `/ops/approvals` | /ops/registration-requests(list·approve·reject) |
| 감사 로그 | `/ops/logs` | /ops/logs |

## 구현 제외 (사용자 승인)
- `Canvas.dc.html` (빈 파일), `CatChap 검색-print-*.dc.html` (디자인 검토용 3-state 데모), `CatChap 학부모-print-*.dc.html` (자동 인쇄 파생물 — print CSS로 흡수)
- 그 외 운영자(OPS) 상세 화면 — handoff에 디자인 없음. 위 승인/로그 2종만 자체 구현, 나머지 `/ops/*`는 백엔드 API만.
- 깨진 링크(`한글낱말`, `그림찾기` 등 개별 게임 파일) → `/student/game?subject=` 로 통일.
