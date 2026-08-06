# catchap-frontend

CatChap 의 **화면**입니다. 학생·강사·운영자 콘솔을 담고 있습니다.

```
React 19 · TypeScript · Vite 8 · 페이지 62개
```

---

## 빠른 시작

```bash
npm ci
cp .env.example .env          # VITE_API_BASE_URL 등을 채웁니다
npm run dev
```

## 폴더

```
src/pages/
   public/    로그인 전 화면
   auth/      로그인·가입·비밀번호 재설정
   student/   학생 — 강의·문항·기록·마이페이지
   ops/       운영자 콘솔 — 강의·문항·결제·알림·시스템 상태
   system/    오류·점검 화면

src/components/  공용 부품          src/features/   기능 단위 묶음
src/api/         백엔드 호출        src/stores/     상태
src/routes/      경로 정의          src/hooks/      공용 훅
src/layouts/     화면 틀            src/styles/     스타일·토큰
```

## ⚠️`VITE_` 변수는 비밀값을 담을 수 없습니다

```
Vite 는 VITE_* 를 ★빌드할 때 브라우저 JS 안에 그대로 박아 넣습니다
→ 누구나 개발자도구로 볼 수 있습니다
```

★**API 키·시크릿을 `VITE_` 로 넣지 마세요.** 공개돼도 되는 값(공개 사이트 키, API 주소)만
넣습니다. 비밀이 필요한 일은 **백엔드가 대신** 합니다.

★프로덕션 빌드에 필요한 값은 `.env.production` 에 있고 **일부러 커밋돼 있습니다.**
빠지면 빌드가 조용히 잘못된 결과를 내기 때문에, `prebuild` 가 값이 있는지 먼저 검사합니다.

## 검사

```bash
npm run lint          # 문법·규칙
npm run build         # 타입검사 + 빌드 (prebuild 가 환경변수를 먼저 확인)
```

⚠️★**CI 에 동작 시험이 없습니다.** `lint + 타입검사 + 빌드`까지만 봅니다.
**버튼이 안 눌려도, 화면이 비어도 초록불이 뜹니다.**

★**그래서 배포 뒤에 화면을 한 번 열어 봐 주세요.** 이 저장소에서 "CI 초록"은
"코드가 빌드된다"는 뜻이지 "동작한다"는 뜻이 아닙니다.

## 배포

```
이미지 태그 = ★커밋 해시    catchap-frontend:c48cdec
매니페스트   ★catchap-infra 저장소의 k8s/frontend/
```

## 작업 방법

`main` 에 직접 push 하지 않습니다. 브랜치를 따서 PR 로 올립니다.

```bash
git switch main && git pull
git switch -c feature/<요약>
git commit -m "feat(ops): 경보 목록에 읽지 않음 필터"
git push -u origin HEAD
gh pr create --fill && gh pr merge --auto --squash
```

```
feature/<요약>  새 기능      fix/<요약>    버그
hotfix/<요약>   급한 수정    chore/<요약>  설정·문서
```

★**사람 이름 브랜치는 만들지 않습니다.** 옛 브랜치는 `catchap-legacy` 에 보관돼 있습니다.

★리뷰 승인은 **0명**입니다. 본인이 열고 본인이 병합할 수 있습니다.

## 함께 보는 저장소

```
catchap-backend       API
catchap-captcha       캡차 (교육형 위젯·공개 캡차 API)
catchap-behavior-ai   행동 기반 봇 판별 AI
catchap-infra         쿠버네티스 매니페스트·인프라 문서
catchap-legacy        지난 작업 보관 (읽기용)
```
