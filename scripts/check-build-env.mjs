/**
 * 빌드 전 환경변수 검사 — 값이 없으면 ★빌드를 멈춘다.
 *
 * ★왜 필요한가 (2026-08-06 실제로 당함)
 *   교육 위젯은 `{EDU_SITE_KEY ? <CatchapWidget/> : …}` 로 감싸여 있다. 값이 비면
 *   Vite 가 그 가지를 ★통째로 지운다 — 오류도 경고도 없이 빌드가 성공한다.
 *   그렇게 구운 이미지를 올리면 ★학생 화면에서 위젯이 사라진 채 배포된다.
 *   빌드 로그만 봐서는 알 수 없다. 그래서 여기서 미리 막는다.
 *
 * ★이 값들은 비밀이 아니다 — VITE_* 는 브라우저 JS 에 평문으로 박힌다.
 *   (실측: dist/assets/GameScreen-*.js 안에 site key 가 그대로 들어 있다)
 *   그래서 금고(Secrets Manager)에 넣을 이유가 없다. 넣어도 결국 공개된다.
 *   진짜 비밀인 secret_key 는 고객 서버만 쓰고 브라우저에 오지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';

/** 없으면 빌드를 멈출 것 — 이름과 '없으면 무슨 일이 나는가'. */
const REQUIRED = [
  {
    key: 'VITE_API_BASE_URL',
    why: '앱이 백엔드를 못 찾습니다. 모든 화면이 빈 채로 뜹니다.',
    looks: (v) => /^https?:\/\//.test(v),
    hint: 'https://api.catchap5.com (끝에 /api/v1 을 붙이지 않습니다)',
  },
  {
    key: 'VITE_CATCHAP_EDU_SITE_KEY',
    why: '★교육 위젯이 통째로 빠집니다(조건부 렌더라 Vite 가 지웁니다). 오류가 안 납니다.',
    looks: (v) => v.startsWith('ck_edu_'),
    hint: 'ck_edu_… (운영 콘솔에서 발급한 교육형 키. 로컬에서 만든 키는 클라우드 DB에 없습니다)',
  },
];

/** .env 파일을 읽어 { KEY: value } 로. 따옴표·주석·빈 줄을 걷어낸다. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const root = process.cwd();
// Vite 우선순위와 같은 순서로 겹쳐 읽는다(뒤가 이긴다). 실제 주입은 process.env 가 최우선.
const merged = {
  ...readEnvFile(path.join(root, '.env')),
  ...readEnvFile(path.join(root, `.env.${mode}`)),
  ...readEnvFile(path.join(root, '.env.local')),
  ...readEnvFile(path.join(root, `.env.${mode}.local`)),
  ...process.env,
};

const problems = [];
for (const { key, why, looks, hint } of REQUIRED) {
  const v = (merged[key] ?? '').trim();
  if (!v) problems.push({ key, msg: '비어 있습니다', why, hint });
  else if (looks && !looks(v)) problems.push({ key, msg: `모양이 이상합니다 (${v.slice(0, 24)}…)`, why, hint });
}

if (problems.length) {
  const B = '[1m';
  const R = '[31m';
  const X = '[0m';
  console.error(`\n${R}${B}빌드를 멈춥니다 — 필요한 값이 없습니다.${X}\n`);
  for (const p of problems) {
    console.error(`  ${B}${p.key}${X} — ${p.msg}`);
    console.error(`     없으면: ${p.why}`);
    console.error(`     넣을 값: ${p.hint}\n`);
  }
  console.error(`  ${B}어디에 넣나${X}`);
  console.error(`     · 로컬 빌드      ${path.join(root, `.env.${mode}`)}`);
  console.error(`     · 도커 빌드      docker build --build-arg VITE_… (Dockerfile 이 ARG 로 받습니다)`);
  console.error(`     ★비밀이 아닙니다 — VITE_* 는 브라우저 JS 에 그대로 박힙니다.`);
  console.error(`       금고에 넣을 필요가 없고, 넣어도 결국 공개됩니다.\n`);
  process.exit(1);
}

console.log(`  환경변수 검사 통과 (${mode}) — ${REQUIRED.map((r) => r.key).join(', ')}`);
