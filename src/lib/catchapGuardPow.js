/* eslint-disable */
/**
 * CatChap Guard(성원·민서 캡차) API 클라이언트.
 *
 * 왜 iframe 이 아니라 API 인가: 캡차 서버의 `ALLOWED_ORIGINS` 에 자기 자신
 * (`captcha.catchap5.com`)이 없어서, 그 주소를 직접 열거나 iframe 으로 띄우면
 * 브라우저가 보내는 Origin 이 목록에 없어 `403 Origin not allowed` 가 난다(실측).
 * 반면 `www.catchap5.com` 에서 부르면 201 이 나오고 CORS 헤더도 www 로 열려 있다.
 * 그래서 화면은 우리가 그리고 데이터만 캡차 서버에서 받는다.
 *
 * 2026-08-11 실측(www 오리진):
 *   문제 생성 201 · 배치 accepted=true(DB 저장 확인) · PoW 25ms · verify 도달
 *
 * PoW: sha256(seed + ":" + nonce) 의 선행 0비트 >= bits 인 nonce. 서버가 강제한다
 * (없이 보내면 `{"success":false,"pow_failed":true}`). 17비트라 수만 번 해시가 필요해
 * WebCrypto(비동기)로는 못 돌린다 — 동기 구현을 워커에서 돌리고, 워커가 막히면
 * 메인 스레드로 떨어진다. 아래 세 함수는 캡차 위젯(main.jsx)에서 그대로 옮긴 것이라
 * 손대지 않는다. 고치려면 양쪽을 같이 고쳐야 한다.
 */

function _rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
function _sha256(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const l = bytes.length, bitLen = l * 8, klen = (((l + 1 + 8) + 63) & ~63);
  const m = new Uint8Array(klen); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(klen - 4, bitLen >>> 0, false); dv.setUint32(klen - 8, Math.floor(bitLen / 0x100000000), false);
  const w = new Uint32Array(64);
  for (let off = 0; off < klen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = _rotr(w[i-15],7) ^ _rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = _rotr(w[i-2],17) ^ _rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = _rotr(e,6) ^ _rotr(e,11) ^ _rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = _rotr(a,2) ^ _rotr(a,13) ^ _rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7];
}
function _lzbits(words) { let n = 0; for (let i = 0; i < words.length; i++) { const x = words[i] >>> 0; if (x === 0) { n += 32; continue; } n += Math.clz32(x); break; } return n; }
function _powSolve(seed, bits, cap) { const enc = new TextEncoder(); const p = seed + ":"; for (let nonce = 0; nonce < cap; nonce++) { if (_lzbits(_sha256(enc.encode(p + nonce))) >= bits) return String(nonce); } return null; }
// 워커 본문의 _powSolve 호출은 "문자열"이라 미니파이 때 함수명과 어긋난다(ReferenceError→워커 throw
// →메인스레드 fallback으로 떨어져 느려짐+콘솔에러). 대입으로 이름을 워커 스코프에 고정한다(named fn expr).
const _powWorkerSrc = `${_rotr.toString()}\n${_sha256.toString()}\n${_lzbits.toString()}\nconst _powSolve = ${_powSolve.toString()};\nself.onmessage=function(e){self.postMessage(_powSolve(e.data.seed,e.data.bits,20000000));};`;
const solvePow = (pow) => new Promise((resolve) => {
  if (!pow || !pow.seed) { resolve(null); return; }
  const { seed, bits } = pow;
  try {
    const url = URL.createObjectURL(new Blob([_powWorkerSrc], { type: "application/javascript" }));
    const worker = new Worker(url); let settled = false;
    worker.onmessage = (e) => { if (settled) return; settled = true; resolve(e.data || null); worker.terminate(); URL.revokeObjectURL(url); };
    worker.onerror = () => { if (settled) return; settled = true; URL.revokeObjectURL(url); try { resolve(_powSolve(seed, bits, 20000000)); } catch (_) { resolve(null); } };
    worker.postMessage({ seed, bits });
  } catch (err) { try { resolve(_powSolve(seed, bits, 20000000)); } catch (_) { resolve(null); } }
});

export const solveCatchapPow = (pow) => solvePow(pow);
