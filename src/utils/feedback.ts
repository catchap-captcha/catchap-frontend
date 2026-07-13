/** 효과음(WebAudio) + 냥냥이 목소리(SpeechSynthesis) — 학생 설정(sfx/voice)에 따름 */

import { getCachedStudentSettings } from '../stores/studentSettingsStore';

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    // 제스처 밖(위젯 채점 응답 등)에서 처음 생성되면 suspended로 영영 무음이 된다 —
    // 브라우저는 상호작용 이후의 resume은 허용하므로 재생 시도마다 깨운다.
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function beep(freqs: number[], duration = 0.12, type: OscillatorType = 'sine', gain = 0.12) {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(gain, now + i * duration);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (i + 1) * duration);
    osc.connect(g).connect(ac.destination);
    osc.start(now + i * duration);
    osc.stop(now + (i + 1) * duration + 0.02);
  });
}

export type SfxType = 'correct' | 'wrong' | 'click' | 'reward';

/** 효과음 — 설정에서 꺼져 있으면 무음 */
export function playSfx(type: SfxType) {
  if (!getCachedStudentSettings().toggles.sfx) return;
  switch (type) {
    case 'correct':
      beep([523.25, 659.25, 783.99], 0.11, 'sine'); // 도-미-솔 ↑
      break;
    case 'wrong':
      beep([330, 262], 0.16, 'triangle'); // 미-도 ↓
      break;
    case 'reward':
      beep([523.25, 659.25, 783.99, 1046.5], 0.09, 'sine');
      break;
    default:
      beep([700], 0.06, 'sine', 0.08);
  }
}

/** 냥냥이 목소리(TTS) — 설정에서 꺼져 있으면 무음 */
export function speak(text: string) {
  if (!getCachedStudentSettings().toggles.voice) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[🐾✨👏🔍📜🚸🎉🎁😊]/gu, ''));
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    utter.pitch = 1.15; // 밝은 톤
    window.speechSynthesis.speak(utter);
  } catch {
    /* TTS 미지원 브라우저 — 무시 */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
