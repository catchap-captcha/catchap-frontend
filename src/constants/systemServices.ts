// 시스템 구성요소의 사람이 읽는 이름 — ★두 화면이 같은 것을 다르게 부르지 않게 한다.
//
// ★왜 상수로 뺐나 — 0815 확인: 운영 홈의 「시스템 상태」 카드는 서버가 준 service_name 을
//   그대로 찍어서 "db"·"captcha-engine"·"stt-worker" 같은 ★영문 코드가 그대로 보였다.
//   같은 데이터를 쓰는 상세 화면(OpsSystemStatus)에는 이미 한글 이름이 있었는데
//   ★두 곳이 매핑을 공유하지 않아서 생긴 일이다.
//
// ⚠️서버가 새 구성요소를 보내기 시작하면 여기에도 이름을 붙여야 한다.
//   안 붙이면 화면이 '미등록'이라고 밝힌다(조용히 영문 코드를 내보내지 않는다).
export type ServiceKind = 'server' | 'inside' | 'external';

/** 종류별 묶음 제목·설명 — "이게 서버인가?" 가 화면에서 바로 답이 되게. */
export const SERVICE_KIND_META: Record<ServiceKind, { title: string; hint: string }> = {
  server: {
    title: '우리 서버',
    hint: '우리가 띄운 프로그램 — 각각 2벌씩 돌고 있어서 한 벌이 죽어도 이어집니다.',
  },
  inside: {
    title: '백엔드 안쪽',
    hint: '따로 뜬 서버가 아니라 백엔드 프로그램 안에서 도는 부분 — 백엔드가 살아 있으면 같이 삽니다.',
  },
  external: {
    title: '바깥 서비스',
    hint: '우리가 띄운 것이 아니라 빌려 쓰는 것 — 카카오클라우드 관리형 DB, 메일 발송 업체.',
  },
};

export const SERVICE_NAME_META: Record<
  string,
  { icon: string; label: string; desc: string; kind: ServiceKind }
> = {
  db: {
    icon: 'ph-database',
    label: '데이터베이스',
    desc: '학생·강의·문항이 저장된 곳 (카카오클라우드 관리형 MySQL)',
    kind: 'external',
  },
  smtp: {
    icon: 'ph-envelope-simple',
    label: '이메일 발송',
    desc: '비밀번호 재설정·알림 메일이 실제로 나갔는지 (최근 24시간)',
    kind: 'external',
  },
  // ★"캡차 엔진" 과 "캡차 API" 를 구별할 수 없다는 지적(0815). 하나는 백엔드 안의 부분이고
  //   다른 하나는 따로 뜬 서버다. 이름과 설명에서 그 차이가 바로 보이게 고쳤다.
  'captcha-engine': {
    icon: 'ph-books',
    label: '캡차 문제은행',
    desc: '백엔드 안에서 캡차 문제를 꺼내 오는 부분 — 따로 뜬 서버가 아닙니다',
    kind: 'inside',
  },
  disk: {
    icon: 'ph-hard-drives',
    label: '백엔드 저장공간',
    desc: '백엔드가 올라가 있는 곳의 남은 용량',
    kind: 'inside',
  },
  // 클러스터 앱 — 서버가 server_metrics(프로메테우스 수집분)에서 읽어 보낸다.
  // ★종전의 'ai-server' 카드는 아무것도 점검하지 않는 고정 문자열이었다. behavior-ai가
  //   그 자리를 대신한다 — 이제 실제로 도는 파드의 값이 뜬다.
  'captcha-api': {
    icon: 'ph-shield-check',
    label: '캡차 API',
    desc: '캡차를 만들어 주고 맞았는지 확인하는 ★따로 뜬 서버',
    kind: 'server',
  },
  'behavior-ai': {
    icon: 'ph-cpu',
    label: '행동 AI',
    desc: '마우스·터치 움직임으로 사람인지 봇인지 판정하는 서버',
    kind: 'server',
  },
  frontend: {
    icon: 'ph-browser',
    label: '프론트',
    desc: '사용자가 보는 웹 화면을 내려 주는 서버',
    kind: 'server',
  },
  'stt-worker': {
    icon: 'ph-waveform',
    label: 'STT 워커',
    desc: '강의 영상에서 자막을 뽑는 서버 (GPU 사용)',
    kind: 'server',
  },
};
