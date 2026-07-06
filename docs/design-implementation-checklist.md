# 디자인 구현 체크리스트

기준: `어린이 교육 웹사이트 디자인-handoff.zip` (Claude Design). 원본 `.dc.html`의 값(색/폰트/간격/문구)을 그대로 옮기는 것이 원칙.

## 구현한 화면 (48 route + 공용 컴포넌트)

> 최신화: 온보딩 재설계로 **운영자 화면 2종**(`/ops/approvals` 기관승인, `/ops/logs` 감사로그)과 **기관 학생관리**(`/org/students` 학생 생성+가입코드) 추가됨.
- 공개 6: 메인, 문의하기, 고객지원, 이용약관, 개인정보처리방침, 404
- 인증 3+1: 로그인(회원가입 4종+기관 등록 5단계 포함), 비밀번호 재설정(4단계), 보안캡챠 위젯, InstitutionPicker(공용)
- 학생 16 + 컴포넌트 2: 학습홈/챕터지도/게임화면/학습결과/오늘의퀴즈/전체학습/개념설명/나의기록/오답노트/배지/프로필꾸미기/취약문제추천/AI선생님/검색/알림/설정 + StudentLayout/EyeRestToast + ScreenTimeReminder
- 학부모 5 + ParentLayout: 주간요약(자녀 전환 통합), 리포트, 상담 AI, 알림, 마이페이지
- 교사 6 + TeacherLayout: 학급요약, 우리반, 전체학생조회, 학습분석, 가정안내, 마이페이지
- 기관 8 + OrgLayout: 기관요약, 학급학생관리, 선생님관리, 학습분석, 캡차설정, AI모델, 보안정책, 마이페이지

## 디자인 유지 확인
- [x] 레이아웃/그리드/최대폭: 원본 값 그대로 (화면별 1080~1320px 등 차이 유지)
- [x] 색상: 브랜드 #FF5A4D, 과목 6색, 콘솔 테마(교사 보라/기관 산호) — tokens.css + 원본 hex 그대로
- [x] 폰트: Jua(제목)/Pretendard(본문)/Noto Serif KR(법률) — index.html 로드
- [x] 간격/radius/그림자: 원본 inline 값 그대로 CSS 클래스로 이전
- [x] 아이콘: Phosphor Icons 동일 클래스(`ph-fill ph-*`)
- [x] 이미지/캐릭터: 마스코트 catchap-logo.png (src/assets/characters + public)
- [x] 문구: 원본 그대로 (U+00A0, 곡선 따옴표 등 문자 단위 보존)
- [x] hover/focus: `style-hover`(464곳)/`style-focus`(80곳) → `:hover`/`:focus` 규칙
- [x] `#captcha-mount` 슬롯(게임화면/보안캡챠/로그인 팝업): 안내 문구 포함 원본 그대로 — CAPTCHA API는 다음 단계

## 원본과 달리 처리한 항목 (사유)
| 항목 | 처리 | 사유 |
| --- | --- | --- |
| 깨진 링크(한글낱말/그림찾기 등 개별 게임 파일) | `/student/game?subject=`로 통일 | 원본 파일 부재 (사용자 승인) |
| Canvas.dc.html, 검색-print, 학부모-print | 제외 / print CSS로 흡수 | 빈 파일·디자인 검토용 파생물 (사용자 승인) |
| 로그인 실패 에러 표시 | 회원가입 formError 박스 스타일 재사용 | 원본에 로그인 에러 UI 없음 (최소 발명) |
| 프로필 이름(하은/김서연/이수진 등) | `useAuth().me` 기반 + 원본 이름 fallback | 실계정 연동, fallback 시 픽셀 동일 |
| 기관코드 복사값 | 표시된 코드를 복사 | 원본 DCLogic이 다른 문자열을 복사하는 버그 |
| 검색 음성인식 startVoice | 로직 보존, 트리거 버튼 없음 | 원본 자체가 dead code (버튼 미노출) |
| 하드코딩 데이터 | 백엔드 API(DB seed) 연결 + 실패 시 원본 값 FALLBACK | 지시서 요구 (화면 모양 동일) |

## 미구현/보류
- 운영자(OPS) 화면 — handoff에 디자인 없음 (백엔드 stub만)
- site_key 발급/도메인 등록 UI — handoff에 없음 (기관 대시보드 읽기전용 위젯만, 백엔드는 완비)
- 실제 CAPTCHA 챌린지 렌더링/교육 게임 로직 — 다음 단계 (마운트 슬롯 준비됨)
