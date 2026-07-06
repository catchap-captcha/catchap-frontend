export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 8자 이상 + 영문 + 숫자 (handoff 비밀번호 규칙 체크리스트 기준) */
export const passwordRules = (v: string) => ({
  length: v.length >= 8,
  letter: /[a-zA-Z]/.test(v),
  number: /\d/.test(v),
});

export const isValidPassword = (v: string) => {
  const r = passwordRules(v);
  return r.length && r.letter && r.number;
};

export const isSixDigitCode = (v: string) => /^\d{6}$/.test(v.trim());
