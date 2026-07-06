# 모션/애니메이션 구현 체크리스트

원칙: handoff의 @keyframes/transition 값(duration/easing/delay)을 그대로 구현. 공용 `cc*`(animations.css)는 **원본과 값이 동일할 때만** 재사용, 다르면 페이지 접두사 버전으로 재정의 (전역 keyframes 충돌 방지).

## 공용 keyframes (src/styles/animations.css)
| 이름 | 용도 | 상태 |
| --- | --- | --- |
| ccIn | 등장 (fade+translateY 16px, .5s ease 등) | ✅ |
| ccPop | 팝인 (scale .85→1) | ✅ |
| ccPulse | 라이브 표시등 (scale 1→1.4, opacity) | ✅ |
| ccSpin | 로딩/동기화 회전 | ✅ |
| ccToast | 토스트 슬라이드업 | ✅ |

## 화면별 모션 (원본 → 구현)
| 화면 | 모션 | 구현 |
| --- | --- | --- |
| 404 | ccFloat(마스코트 부유 4.5s), ccTwinkle(별 2.6s+delay .8s), ccIn | ✅ nf- 접두사 |
| 메인 | ccFloat(HERO), ccMarquee(파트너 32s 무한) | ✅ |
| 로그인 | ccFloat/ccIn/ccSpin(캡차 로딩)/ccBounce(퍼즐)/ccPop(가입성공, cubic-bezier 바운스), 탭 transition .18s | ✅ lg- |
| 비밀번호 재설정 | 4단계 전환, ccPop(완료 체크) | ✅ pr- |
| 보안캡챠 | ccFloat/ccIn/ccPulse/ccShake(실패)/ccPop(성공 seal)/ccSpin/ccBounce, phase 상태머신 | ✅ cp- |
| 학습홈 | ccFloat(마스코트)/ccFloatSlow/ccPop(말풍선)/shRise(응원 팝업), 진행바 width .6s | ✅ sh- |
| 챕터지도 | ccPulseRing(현재 노드)/ccBob(마스코트)/cmToast(잠금 토스트 2.4s) | ✅ cm- |
| 게임화면 | ccFloat/ccBounce(슬롯)/ccPulse(Guard 추적), 진행바 width .4s, 과목 테마 전환 | ✅ gs- |
| 학습결과 | grFall(색종이 12개 개별 delay)/grRing(원형 링 stroke-dashoffset 339.29)/ccPop/ccFloat | ✅ gr- |
| 개념설명 | cpOverlay+cpSheet(모달)/ccFloat/ccWiggle/ccPop | ✅ |
| 프로필꾸미기 | ccFloat(아바타)/pfPop(구매·점수)/pfToast(저장), 배경 transition .3s, 랭킹 폴링 | ✅ pf- |
| 나의기록 | 막대 height .5s, SVG 라인차트(원본 좌표 계산식) | ✅ mr- |
| AI선생님/상담AI | ccFloatSlow(아바타), atIn/메시지 등장, 자동 스크롤 | ✅ |
| 학부모 홈 | ccToastIn(실시간 알림)/ccBellShake(벨)/ccDrop(드롭다운)/ccIn·ccPop(연결 모달 2-state) | ✅ ph- |
| 학부모 리포트 | ccTrendFill(SVG 영역 gradient), 기간/과목 전환 재계산 | ✅ prt- |
| 학부모 마이페이지 | CAPTCHA 모달(3×3), 강도미터, ccToast | ✅ pm- |
| 교사 콘솔 | 사이드바 hover, 칩 transition .15s, tcSlide(상세패널 340px↔0), otIn·tcIn(모달), fnToast(가정안내) | ✅ |
| 기관 콘솔 | buildBot SVG 라인, conic-gradient 도넛, 스택막대 슬라이드, ocPop(팝오버), csIn(캡차 미리보기), amPulse(연결등)+초 카운트, omToast | ✅ |
| 눈쉬기 | ScreenTimeReminder(60분 오버레이, 20초 카운트다운 — screen-time-reminder.js 포팅), EyeRestToast(ertSlideIn, 5초 자동숨김) | ✅ |

## hover/focus/active/transition
- [x] style-hover 464곳 → :hover (배경/색/translateY/그림자 원본 값)
- [x] style-focus 80곳 → :focus (border-color 등)
- [x] style-active — 원본에 없음 (0곳)
- [x] 모달/드롭다운/탭/페이지 전환 모두 원본 방식

## 미구현/보류
- EyeRestToast는 컴포넌트로만 존재 (원본에서도 독립 조각 — 어느 화면에 상시 노출할지 디자인에 명시 없음. 60분 리마인더는 ScreenTimeReminder가 담당)
- 원본에서 정의만 되고 미사용인 keyframes(ccPawWiggle 등)는 원본과 동일하게 미적용
