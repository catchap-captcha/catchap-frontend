// 시스템 구성요소의 사람이 읽는 이름 — ★두 화면이 같은 것을 다르게 부르지 않게 한다.
//
// ★왜 상수로 뺐나 — 0815 확인: 운영 홈의 「시스템 상태」 카드는 서버가 준 service_name 을
//   그대로 찍어서 "db"·"captcha-engine"·"stt-worker" 같은 ★영문 코드가 그대로 보였다.
//   같은 데이터를 쓰는 상세 화면(OpsSystemStatus)에는 이미 한글 이름이 있었는데
//   ★두 곳이 매핑을 공유하지 않아서 생긴 일이다.
//
// ⚠️서버가 새 구성요소를 보내기 시작하면 여기에도 이름을 붙여야 한다.
//   안 붙이면 화면이 '미등록'이라고 밝힌다(조용히 영문 코드를 내보내지 않는다).
export type ServiceKind = 'serving' | 'working' | 'backing';

/** 묶음 제목·설명.
 *
 * ★그전에는 "우리 서버 / 백엔드 안쪽 / 바깥 서비스" 로 ★어디에 있는가로 갈랐다.
 *   그러니 두 가지가 이상해졌다(0816 지적) —
 *     ① 「우리 서버」에 백엔드만 없다 → "백엔드는 서버가 아닌가?" 로 읽힌다
 *     ② 「백엔드 안쪽」에 저장공간이 있다 → 저장공간은 '안에서 도는 부분' 이 아니다
 *
 * 운영자가 이 화면에서 알고 싶은 것은 ★"지금 뭐가 안 되나" 다.
 * 그래서 있는 곳이 아니라 ★무엇을 확인한 것인가로 가른다.
 */
export const SERVICE_KIND_META: Record<ServiceKind, { title: string; hint: string }> = {
  serving: {
    title: '서비스가 도나',
    hint: '사용자가 쓰는 것들이 떠 있는지 — 각각 2벌씩이라 한 벌이 죽어도 이어집니다.',
  },
  working: {
    title: '기능이 되나',
    hint: '실제로 시켜 보고 되는지 확인한 것 — 되는지 안 되는지가 바로 나옵니다.',
  },
  backing: {
    title: '받쳐 주는 것',
    hint: '이게 흔들리면 위가 전부 멈춥니다 — 데이터가 있는 곳과 남은 자리.',
  },
};

export const SERVICE_NAME_META: Record<
  string,
  { icon: string; label: string; desc: string; kind: ServiceKind }
> = {
  // ── 서비스가 도나 (따로 뜬 서버들) ─────────────────────────────
  'captcha-api': {
    icon: 'ph-shield-check',
    label: '캡차 API',
    desc: '캡차를 만들어 주고 맞았는지 확인하는 서버',
    kind: 'serving',
  },
  'behavior-ai': {
    icon: 'ph-cpu',
    label: '행동 AI',
    desc: '마우스·터치 움직임으로 사람인지 봇인지 판정하는 서버',
    kind: 'serving',
  },
  frontend: {
    icon: 'ph-browser',
    label: '프론트',
    desc: '사용자가 보는 웹 화면을 내려 주는 서버',
    kind: 'serving',
  },
  'stt-worker': {
    icon: 'ph-waveform',
    label: 'STT 워커',
    desc: '강의 영상에서 자막을 뽑는 서버 (GPU 사용)',
    kind: 'serving',
  },
  // ── 기능이 되나 (실제로 시켜 본 것) ────────────────────────────
  'captcha-engine': {
    icon: 'ph-books',
    label: '캡차 문제 출제',
    desc: '문제은행에서 실제로 문제를 꺼내 봤을 때 나오는지',
    kind: 'working',
  },
  smtp: {
    icon: 'ph-envelope-simple',
    label: '이메일 발송',
    desc: '비밀번호 재설정·알림 메일이 실제로 나갔는지 (최근 24시간)',
    kind: 'working',
  },
  // ── 받쳐 주는 것 ──────────────────────────────────────────────
  db: {
    icon: 'ph-database',
    label: '데이터베이스',
    desc: '학생·강의·문항이 저장된 곳 (카카오클라우드 관리형 MySQL)',
    kind: 'backing',
  },
  disk: {
    icon: 'ph-hard-drives',
    label: '저장공간',
    desc: '영상·자막·이미지를 쌓는 곳의 남은 자리',
    kind: 'backing',
  },
};
