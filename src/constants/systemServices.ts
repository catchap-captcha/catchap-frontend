// 시스템 구성요소의 사람이 읽는 이름 — ★두 화면이 같은 것을 다르게 부르지 않게 한다.
//
// ★왜 상수로 뺐나 — 0815 확인: 운영 홈의 「시스템 상태」 카드는 서버가 준 service_name 을
//   그대로 찍어서 "db"·"captcha-engine"·"stt-worker" 같은 ★영문 코드가 그대로 보였다.
//   같은 데이터를 쓰는 상세 화면(OpsSystemStatus)에는 이미 한글 이름이 있었는데
//   ★두 곳이 매핑을 공유하지 않아서 생긴 일이다.
//
// ⚠️서버가 새 구성요소를 보내기 시작하면 여기에도 이름을 붙여야 한다.
//   안 붙이면 화면이 '미등록'이라고 밝힌다(조용히 영문 코드를 내보내지 않는다).
export const SERVICE_NAME_META: Record<string, { icon: string; label: string; desc: string }> = {
  db: { icon: 'ph-database', label: '데이터베이스', desc: 'MySQL 연결 왕복시간' },
  'captcha-engine': { icon: 'ph-puzzle-piece', label: '캡차 엔진', desc: '문제은행 로드·출제 가능 여부' },
  smtp: { icon: 'ph-envelope-simple', label: '이메일(SMTP)', desc: '최근 24시간 발송 결과' },
  disk: { icon: 'ph-hard-drives', label: '디스크', desc: '백엔드 컨테이너 저장공간' },
  // 클러스터 앱 — 서버가 server_metrics(프로메테우스 수집분)에서 읽어 보낸다.
  // ★종전의 'ai-server' 카드는 아무것도 점검하지 않는 고정 문자열이었다. behavior-ai가
  //   그 자리를 대신한다 — 이제 실제로 도는 파드의 값이 뜬다.
  'captcha-api': { icon: 'ph-puzzle-piece', label: '캡차 API', desc: '캡차 발급·검증 서버' },
  'behavior-ai': { icon: 'ph-cpu', label: '행동 AI', desc: '행동 기반 봇 위험도 판정' },
  frontend: { icon: 'ph-browser', label: '프론트', desc: '웹 화면 서버' },
  'stt-worker': { icon: 'ph-waveform', label: 'STT 워커', desc: '강의 자막 생성(GPU)' },
};
