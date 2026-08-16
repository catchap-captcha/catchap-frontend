// 행동 데이터의 「출처」 — ★두 화면이 같은 것을 다르게 부르지 않게 한 곳에 둔다.
//
// ★왜 상수로 빼나 (0816 실측) — 행동 데이터 화면과 외부 내보내기 화면이 ★각자 표를
//   갖고 있어서 같은 값을 다르게 불렀다.
//
//     edu-api    행동 데이터 「학습 문제 캡차」  ↔  내보내기 「교육형 위젯」
//     forest     행동 데이터 「메인 캡차(숲)」   ↔  내보내기 「메인 캡차」
//     captcha    행동 데이터에만 있음           ↔  내보내기에는 ★아예 없어서 못 고른다
//
//   「교육형」은 0816 에 「학습 문제 캡차」로 통일한 말이라 여기만 옛말로 남아 있었다.
//
// ⚠️키(edu-api·game·forest·captcha)는 DB 에 저장되는 값이라 ★바꾸지 않는다. 이름만 바꾼다.
export const BEHAVIOR_SOURCE_LABEL: Record<string, string> = {
  'edu-api': '학습 문제 캡차',
  captcha: '봇 차단 캡차',
  game: '인앱 게임',
  // ★「메인 캡차(숲)」이었다. 'forest' 는 코드 이름이고 지금 로그인·회원가입에서 실제로
  //   뜨는 것은 드래그 캡차다 — 운영자에게 「숲」은 아무 뜻이 없다. 어디서 푼 것인지로 부른다.
  forest: '로그인 캡차',
};

/** 필터 드롭다운용 — 「전체」가 앞에 온다. 두 화면이 ★같은 차례로 보이게 한다. */
export const BEHAVIOR_SOURCE_OPTIONS: { v: string; label: string }[] = [
  { v: '', label: '전체' },
  ...Object.entries(BEHAVIOR_SOURCE_LABEL).map(([v, label]) => ({ v, label })),
];
