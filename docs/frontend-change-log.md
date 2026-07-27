# 프론트엔드 수정 기록

UI/UX 변경 이력. 화면-라우트 대응은 `screen-route-map.md`, 모션 값 규약은
`motion-implementation-checklist.md` 참고.

최신화: 2026-07-27

---

## 2026-07-27 · 학생/공개 화면

### 1. 게임 화면 상단바 · 방치 게이트 — 코드 변경 없음(진단만)

`∞ 무한 연습` 우측 정렬, `계속하기` 버튼 검은색 + 연한 회색 바탕 요청.

**소스에는 이미 반영돼 있던 상태**였다(직전 세션 적용분). 라이브에 안 보인 건
캐시/스테일 빌드 때문으로, 당시 `Checkout.tsx`의 기존 TS 오류로 **프로덕션 빌드 자체가
막혀 있어** 새 번들이 나가지 못한 것이 원인이었다(→ 4번에서 해소).

- 확인만: `src/pages/student/GameScreen.css`, `public/catchap-widget.js`

### 2. 강의 영상 페이지 상단바 재구성

학습 중 이탈 동선을 줄이려고 전역 nav를 걷어내고 현재 위치만 남겼다.

- 홈/강의/문제은행/나의기록 nav 제거
- 로고 왼쪽에 `← 학습 홈`, 로고 바로 오른쪽에 경로(`🏠 › 일반 › 강의명`) 배치
  - 최초엔 경로를 우측 끝에 뒀다가(`margin-left: auto`) 로고 옆으로 이동
- `src/pages/student/LecturePlayer.tsx`, `LecturePlayer.css`

### 3. 강의 홈 개편 + 메뉴 이름 변경

- 상단 nav: `홈` → **강의 홈**, `강의` → **강의 신청**
- 홈의 `내 코스`(수강 중) · `이런 코스는 어때요`(미신청) 섹션을 **강의 카드 그리드**로 교체
- 미신청 카드는 미리보기 잠금 — 설명·시청 버튼 제거, `수강신청 후 시청 가능` 표기
- `src/layouts/StudentLayout.tsx`, `src/pages/student/StudentHome.tsx`, `StudentHome.css`,
  `LectureList.tsx`(히어로 문구)

### 4. 강의 신청 = 장바구니 구매 페이지

- 미신청 코스만 노출, 코스별 체크박스 다중 선택 → 하단 장바구니 바 → `구매하기`
- `Checkout`을 다중 코스(`?cart=id1,id2`)로 확장 — 아이템 목록·합계, mock 결제 루프.
  단일 `?course=` 진입도 유지
- **기존 `Checkout.tsx` TS 오류 2건 수정 → `tsc` 통과, 프로덕션 빌드 정상화**(1번 원인 해소)
- `src/pages/student/LectureList.tsx`, `LectureList.css`, `Checkout.tsx`, `Checkout.css`
- 결제 설계 메모: 메모리 `catchap-course-payment.md` 갱신

### 5. 장바구니 담기 버튼 강조 + 검색/필터 툴바 제거

- `장바구니 담기`를 꽉 찬 브랜드 버튼으로(선택 시 `담김` 확인 pill)
- 강의 신청 페이지의 검색 + 필터칩 + 정렬 + 초기화 툴바 제거 및 관련 상태/핸들러 정리
- `src/pages/student/LectureList.tsx`, `LectureList.css`

### 6. 검색 페이지 UI 꽉 차게

- 중앙 컬럼 폭 축소 해제, 히어로 헤더 + 큰 히어로 검색창 추가
- 바로가기를 리치 카드(2열, 아이콘 + 제목 + 설명)로 교체
- `src/pages/student/SearchPage.tsx`, `SearchPage.css`

### 7. 학생 상단바 애니메이션

- nav 항목에 호버/활성 알약 페이드·스케일 인 + 로드 시 순차 등장(stagger), 부드러운 이징
- `prefers-reduced-motion: reduce` 대응
- `src/layouts/StudentLayout.css` (`.sl-navlink`, `@keyframes sl-navlink-in`)

> 이 모션이 이후 운영/강사 콘솔 상단바의 기준이 된다(10번).

### 8. 오늘의 Q 시작 버튼 색상

`#1a1a1a` → `#2b2b2b` → 최종 `rgba(255, 255, 255, 0.12)`(홈 `이어보기` 태그와 동일 값).

- `src/pages/student/AllLearning.css`

### 9. 메인 캡차 UI 정리 (냥이 제거)

로그인 캡차 팝업에서 고양이 마스코트·`냥이 지킴이`·🐱/🐾/🧭·`냥이` 문구 제거 →
방패 아이콘 + `보안 확인`, 중립 카피. **챌린지 기능 자체는 유지.**

- `src/pages/auth/LoginPage.tsx`, `LoginPage.css`

---

## 2026-07-27 · 운영/강사 콘솔

### 10. 콘솔 상단 카테고리 애니메이션

학생 상단 메뉴(`.sl-navlink`, 7번)와 **같은 모션 언어**로 맞췄다. 키프레임 값·이징·
stagger 간격(0.04 / 0.11 / 0.18 / 0.25s)이 동일하다. 색·모양은 기존 그대로 두고 전환만 입힘.

- 진입 stagger — 카테고리가 위에서 순차로 내려옴
- 호버·활성 알약 — 배경을 `::before`로 옮겨 뒤에서 `scale(0.82) → 1`로 떠오름
- 캐럿 회전 — 열릴 때 180°.
  종전엔 `ph-caret-up`/`ph-caret-down` 글리프를 **교체**해서 순간이동이라 모션이 안 붙었다
  → `ph-caret-down` 하나만 두고 CSS로 회전
- 드롭다운 펼침 페이드+슬라이드, 항목 순차 등장, 활성 체크 아이콘 pop
- 강사 탭 아이콘 호버 시 살짝 들림
- `prefers-reduced-motion: reduce` 전부 대응
- `src/components/ops/OpsNav.tsx`, `src/pages/ops/OpsApproval.css`
  (`.op-top-*` 규칙은 ops 페이지 22개가 공유하는 파일에 있음)

**진입 애니메이션 재생 시점** — `OpsNav`는 공용 레이아웃이 아니라 각 ops 페이지가 개별
렌더한다. 즉 라우팅마다 통째로 재마운트되고, 게이트가 없으면 페이지를 옮길 때마다
상단바가 다시 흘러내린다(ops 페이지엔 `.cc-page-enter` 페이드도 없어 더 눈에 띔).

| 대상 | 재생 시점 | 근거 |
| --- | --- | --- |
| 운영자 드롭다운 그룹 | 콘솔 **첫 진입에만** | `OpsNav.tsx`의 `introGate` — 경로 변화로 판별해 StrictMode 이중 렌더·재마운트에는 안 걸림 |
| 강사 탭 | **이동할 때마다** | 학생 콘솔과 동일하게. `StudentNav`도 페이지마다 렌더되고 `.sl-navlink`엔 게이트가 없어 매번 재생된다 |

### 11. 콘솔 드롭다운 호버로 열기

클릭 토글은 터치·키보드 진입로로 남기고, 마우스에선 갖다 대면 열리게 했다.
그냥 `onMouseEnter`만 붙이면 안 되는 두 가지를 같이 처리:

- 버튼과 메뉴 사이 빈 구간 때문에 포인터를 내리다 그룹에서 벗어나 닫히는 문제
  → `.op-top-menu::before` 브릿지가 덮음(메뉴의 자식이라 그룹 `mouseleave`가 안 뜸)
- 닫힘을 **140ms 지연** — 그룹 사이를 가로지를 때 다음 그룹의 enter가 타이머를 취소해
  메뉴바처럼 이어진다
- 터치 기기에선 탭이 `mouseenter`로도 잡혀 클릭 토글과 충돌 → `(hover: hover)`일 때만 동작
- `src/components/ops/OpsNav.tsx`, `src/pages/ops/OpsApproval.css`

### 12. 강사 홈 — 표본 검수 설명 문구 제거

`검수 대기 문항 중 무작위 표본이에요 — …` 한 줄 삭제.

- `.ih-card-sub` 클래스는 다른 두 카드가 계속 쓰므로 CSS는 유지
- `.ih-sample-list`의 `margin-top: 12px`가 있어 제목-목록 간격은 그대로
- `src/pages/ops/OpsInstructorHome.tsx`

### 13. 강사 홈 — 2열 카드(검수 대기 · 표본 검수) 정렬 정리

나란히 놓인 두 카드의 규격이 제각각이라 순서대로 맞췄다.

**(a) 하단 CTA 줄맞춤** — 두 카드는 그리드 `stretch`로 높이가 이미 같았지만, 내용 길이가
달라 짧은 쪽 CTA가 떠서 `강의 관리로 이동`과 `강의 관리에서 검수`가 7px 어긋나 있었다.
카드를 세로 flex로 두고 CTA에 `margin-top: auto`.

- `.ih-card` 전역이 아니라 `.ih-cols > .ih-card`에만 적용 — 아래 전폭 카드들은 기존 유지
- `align-self: flex-start` 필요 — `inline-flex`라도 flex 아이템이 되면 `stretch`로 카드 폭
  전체를 차지해 hover 밑줄이 가로로 늘어난다

**(b) 행 규격 통일** — 높이만이 아니라 네 가지가 전부 달랐다.

| | 검수 대기 행(전) | 표본 검수 행(전) | 통일 후 |
| --- | --- | --- | --- |
| 높이 | 42.5px (1줄) | 54.5px (2줄) | **54px** |
| 테두리 | 없음 | 1px `--line` | 없음 |
| 모서리 | 12px | 10px | 12px |
| 배경 | `--surface-2` | `--surface` | `--surface-2` |

`min-height`는 2줄짜리 표본 검수 행 기준(내용 32.5 + 상하 패딩 20). 스타일은 왼쪽 카드의
채움형으로 통일 — 흰 배경 + 테두리는 카드 배경과 같은 색이라 테두리 없으면 안 보이는
형태였는데, 채움형은 그 의존이 없어 두 카드에 그대로 쓸 수 있다.

> 부수 수정: 행 배경이 `--surface-2`가 되면서 `.ih-verdict--bank`(「은행 적합」 칩)가
> 같은 색이라 행에 묻혔다 → 한 단계 밝은 `--surface`로. 현재 시드엔 이 칩이 안 뜨지만
> `suggested_placement: 'bank'` 문항이 오면 바로 드러났을 문제.

**(c) 목록 세로 중앙 정렬** — (a) 때문에 남는 높이가 전부 `목록과 CTA 사이` 한곳에 몰려
목록이 위에 붙고 아래가 크게 비었다(표본 검수 53px). 목록에 `flex-grow: 1` +
`justify-content: center`를 줘 여백이 목록 위아래로 나뉘게 했다.

| 표본 검수 카드 | 전 | 후 |
| --- | --- | --- |
| 제목 → 첫 행 | 12px | 31.5px |
| 마지막 행 → CTA | 53px | 33.5px |

960px 미만 1열에서는 각 카드가 자기 내용 높이를 가져 남는 공간이 없으므로 기존 간격 유지.

- `src/pages/ops/OpsInstructorHome.css`

---

## 조사만 하고 변경하지 않은 것

- 5번에서 제거한 검색/필터 툴바가 다른 페이지엔 없음을 확인.
  문제은행·오답노트·알림의 필터는 성격이 다르고, 검색 페이지는 별개 화면.
- 검색 페이지 진입 경로: 상단바 우측 🔍 아이콘 → `/student/search`.

## 남은 제안 (미적용)

2026-07-27 기준으로 아래 두 건은 그대로 남아 있다.

- **가입 완료 팝업 · `/captcha` 데모 페이지의 냥이 테마** — 9번에서 로그인 캡차 팝업만
  정리했다. 잔존 위치: `LoginPage.tsx`의 `lg-done-*` 팝업(마스코트 이미지,
  `…로그인해서 냥이와 함께 학습을 시작해요!`), `pages/auth/CaptchaPage.tsx`.
  그 밖에 `EyeRestToast.tsx`, `StudentNotifications.tsx`, `studentSettingsStore.tsx`에도
  냥이 표현이 있으나 캡차와 무관한 학생 화면 카피라 별도 판단 필요.
- **`LectureList.css`의 dead CSS** — 5번 툴바 제거로 `.ll-toolbar` 등이 미사용 상태로 남음.
