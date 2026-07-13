/* =========================================================================
   captcha.js — the Three.js "forest village" scene engine.

   This is a near-verbatim port of the 3D scene from the original Claude Design
   Canvas. It is deliberately ANSWER-FREE:
     * It does NOT generate or know target_object / target_direction.
     * The "found" animal is shown from an image URL handed in by app.js
       (which comes from the backend's opaque /reveal/{object} endpoint).
   The engine only knows how to render the scene, zoom to an object, and peek
   an animal out from behind it.
   ========================================================================= */

/* -------------------------------------------------------------------------
   Animal asset config — supports individual PNG frames OR a spritesheet.

   Each animal exposes 8 directions (0..7):
     0 정면 / 1 왼쪽앞 / 2 왼쪽 / 3 왼쪽뒤 / 4 뒤 / 5 오른쪽뒤 / 6 오른쪽 / 7 오른쪽앞
   `frameMap` lets an animal whose sheet is ordered differently remap indices.
   ------------------------------------------------------------------------- */
// 동물 목록은 animal-config.js(ANIMAL_CONFIG)에서 단일 관리한다. 여기서는 그
// 설정을 스프라이트시트(2행 4열) 렌더 형식으로 변환한다. 컨트롤(드래그) 스프라이트는
// 시트(image)를 CSS background-position 으로 슬라이싱하고, 서버 opaque reveal 은
// 분할 프레임(base + dirN.png)을 사용한다.
const ANIMALS = (() => {
  const cfg = (typeof window !== 'undefined' && window.ANIMAL_CONFIG) || {};
  const out = {};
  for (const id in cfg) {
    const a = cfg[id];
    // 처음 5마리(dog/rabbit…)와 동일한 '방향별 낱장 프레임' 방식.
    // 각 프레임은 land/{id}/dir{n}.png (투명·512², 발선 정렬됨). 시트 슬라이싱을
    // 쓰지 않으므로 옆칸 노출/정사각 눌림/발 흔들림이 없다.
    out[id] = {
      id: a.id, name: a.nameKo, type: 'frames',
      base: a.base, ext: '.png',
      frameMap: [0, 1, 2, 3, 4, 5, 6, 7],
    };
  }
  return out;
})();

// 안전한 폴백 동물 id (첫 등록 동물)
const FALLBACK_ANIMAL = Object.keys(ANIMALS)[0];

/**
 * Returns a CSS style object for showing `animal` facing `dir` (0..7) in a
 * .control-sprite div — works for both frame-PNGs and spritesheets.
 */
function spriteFrameStyle(animalId, dir) {
  const a = ANIMALS[animalId] || ANIMALS[FALLBACK_ANIMAL];
  const frame = a.frameMap[dir % 8];
  if (a.type === 'spritesheet') {
    const col = frame % a.columns;
    const row = Math.floor(frame / a.columns);
    return {
      backgroundImage: `url(${a.path})`,
      backgroundSize: `${a.columns * 100}% ${a.rows * 100}%`,
      backgroundPosition: `${(col / (a.columns - 1)) * 100}% ${(row / (a.rows - 1)) * 100}%`,
    };
  }
  return {
    backgroundImage: `url(${a.base}${frame}${a.ext})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center bottom',
  };
}

/* ========================================================================= */
class ForestScene {
  constructor(hostId) {
    this.hostId = hostId;
    this.view = 'find';          // 'find' | 'zoom'
    this._alive = true;
    this._pickCb = null;
    this.activeObjectId = null;
  }

  onPick(cb) { this._pickCb = cb; }

  init() {
    this._waitThree();
  }

  _waitThree() {
    if (!this._alive) return;
    if (window.THREE) this._initThree();
    else setTimeout(() => this._waitThree(), 60);
  }

  destroy() {
    this._alive = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._clearTimers();
    if (this.renderer) {
      this.renderer.dispose();
      const c = this.renderer.domElement;
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    if (this._ro) this._ro.disconnect();
    window.removeEventListener('resize', this._onResize);
  }

  _clearTimers() { if (this._rt) clearTimeout(this._rt); if (this._rt2) clearTimeout(this._rt2); }

  // ---------- build helpers (verbatim) ----------
  mat(color, rough) { return new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.9 : rough, metalness: 0 }); }
  addBox(parent, w, h, d, color, x, y, z, rough) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, rough)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  addSphere(parent, r, color, x, y, z, rough) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), this.mat(color, rough)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  addCyl(parent, rt, rb, h, color, x, y, z, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 26), this.mat(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  addCone(parent, r, h, color, x, y, z, seg) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 24), this.mat(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

  bushAt(parent, x, z, s) {
    const g = new THREE.Group();
    this.addSphere(g, s * 0.62, 0x77a35d, -s * 0.46, s * 0.5, 0.05, 0.95);
    this.addSphere(g, s * 0.7, 0x88b46b, s * 0.42, s * 0.55, 0.12, 0.95);
    this.addSphere(g, s * 0.58, 0x98c079, 0, s * 0.9, -0.08, 0.95);
    this.addSphere(g, s * 0.42, 0xa6ca88, -s * 0.2, s * 0.72, 0.34, 0.95);
    g.rotation.y = Math.random() * Math.PI * 2; g.scale.set(1 + (Math.random() * 0.28 - 0.14), 1 + (Math.random() * 0.24 - 0.1), 1 + (Math.random() * 0.28 - 0.14));
    g.position.set(x, 0, z); parent.add(g); return g;
  }

  buildTree() {
    const g = new THREE.Group();
    this.addCyl(g, 0.72, 1.15, 0.55, 0x8a5a34, 0, 0.26, 0, 16);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = this.addSphere(g, 0.26, 0x7c5030, Math.cos(a) * 0.92, 0.14, Math.sin(a) * 0.92, 0.95); r.scale.set(1, 0.55, 1); }
    this.addCyl(g, 0.4, 0.68, 2.5, 0xac7a4d, 0, 1.42, 0, 18);
    this.addCyl(g, 0.34, 0.42, 0.5, 0x9a6a40, 0.05, 2.7, 0.02, 14);
    const can = new THREE.Group(); can.position.set(0, 3.35, 0);
    const dark = 0x66a043, mid = 0x79b451, light = 0x8fc862, hi = 0xa6d675;
    const blob = (r, x, y, z, c) => this.addSphere(can, r, c, x, y, z, 0.9);
    blob(1.7, 0, 0.1, 0, mid); blob(1.5, -1.02, -0.25, 0.45, dark); blob(1.55, 1.05, -0.15, -0.3, dark);
    blob(1.42, -0.55, 1.1, 0.3, light); blob(1.34, 0.78, 1.0, -0.32, light); blob(1.15, 0.1, 1.68, 0.15, hi); blob(1.05, -0.9, 0.85, -0.55, mid);
    g.add(can);
    this.bushAt(g, 1.25, 0.7, 0.95); this.bushAt(g, -1.15, -0.5, 0.8);
    return g;
  }
  buildHouse() {
    const g = new THREE.Group();
    const wall = 0xf6eccf, timber = 0xba8a52, roofc = 0xe07a44;
    this.addBox(g, 2.8, 2.0, 2.6, wall, 0, 1.0, 0);
    [[-1.42, -1.32], [1.42, -1.32], [-1.42, 1.32], [1.42, 1.32]].forEach(([x, z]) => this.addBox(g, 0.18, 2.0, 0.18, timber, x, 1.0, z));
    this.addBox(g, 2.86, 0.16, 2.66, timber, 0, 1.98, 0);
    const shp = new THREE.Shape(); shp.moveTo(-1.78, 0); shp.lineTo(1.78, 0); shp.lineTo(0, 1.5); shp.lineTo(-1.78, 0);
    const rg = new THREE.ExtrudeGeometry(shp, { depth: 3.05, bevelEnabled: false });
    const roof = new THREE.Mesh(rg, this.mat(roofc, 0.82)); roof.position.set(0, 2.06, -1.525); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    this.addBox(g, 0.16, 0.16, 3.15, 0x9a5a34, 0, 3.55, 0);
    this.addBox(g, 0.44, 1.15, 0.44, 0xd6a468, 0.82, 3.1, -0.15); this.addBox(g, 0.54, 0.18, 0.54, 0x8a6a44, 0.82, 3.7, -0.15);
    this.addBox(g, 0.82, 1.3, 0.14, timber, 0, 0.65, 1.31);
    this.addBox(g, 0.62, 1.1, 0.1, 0x9a6a3c, 0, 0.62, 1.37);
    this.addSphere(g, 0.055, 0xffd873, 0.2, 0.64, 1.44);
    this.addBox(g, 1.05, 0.2, 0.44, 0xdac89a, 0, 0.1, 1.5);
    this.addBox(g, 1.35, 0.1, 0.62, 0xc9b689, 0, 0.03, 1.72);
    this.addBox(g, 0.76, 0.76, 0.1, timber, -0.85, 1.32, 1.31);
    this.addBox(g, 0.6, 0.6, 0.08, 0xbfe7ee, -0.85, 1.32, 1.36, 0.35);
    this.addBox(g, 0.64, 0.1, 0.12, timber, -0.85, 1.32, 1.4); this.addBox(g, 0.1, 0.64, 0.12, timber, -0.85, 1.32, 1.4);
    this.addBox(g, 0.82, 0.2, 0.24, 0x9a6a3c, -0.85, 0.88, 1.46);
    [[-1.05, 0xf4849a], [-0.85, 0xffd45e], [-0.65, 0xf29bc0]].forEach(([x, c]) => this.addSphere(g, 0.11, c, x, 1.05, 1.46, 0.7));
    return g;
  }
  buildMushroom() {
    const g = new THREE.Group();
    this.addCyl(g, 0.66, 0.92, 2.0, 0xf3e7cf, 0, 1.0, 0, 26);
    this.addCyl(g, 0.98, 1.16, 0.36, 0xe8dbbe, 0, 0.18, 0, 26);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xf0596f, 0.5));
    cap.position.set(0, 2.0, 0); cap.castShadow = true; g.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 16, 40), this.mat(0xe24d63, 0.5)); rim.rotation.x = Math.PI / 2; rim.position.set(0, 2.0, 0); rim.castShadow = true; g.add(rim);
    const gill = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.02, 0.2, 32), this.mat(0xdcc7a6)); gill.position.set(0, 1.98, 0); g.add(gill);
    const gs = new THREE.Mesh(new THREE.CircleGeometry(1.42, 32), new THREE.MeshBasicMaterial({ color: 0x7a3a44, transparent: true, opacity: 0.22 })); gs.rotation.x = Math.PI / 2; gs.position.set(0, 1.92, 0); g.add(gs);
    const spotMat = this.mat(0xfff3e6, 0.7);
    const sp = (r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), spotMat); m.scale.set(1, 0.45, 1); m.position.set(x, y, z); m.lookAt(x * 3, y + 2.2, z * 3); g.add(m); };
    sp(0.34, 0.0, 3.35, 0.15); sp(0.26, 0.95, 2.72, 0.5); sp(0.24, -0.9, 2.72, 0.5); sp(0.22, 0.32, 2.55, 1.28); sp(0.2, -0.55, 2.85, -0.95); sp(0.19, 0.72, 2.5, -0.92);
    this.addBox(g, 0.66, 1.1, 0.12, 0x9a6a3c, 0, 0.55, 0.86); this.addBox(g, 0.5, 0.92, 0.08, 0x7c4f2c, 0, 0.55, 0.92);
    this.addSphere(g, 0.05, 0xffd873, 0.16, 0.57, 0.98);
    this.addBox(g, 0.82, 0.2, 0.4, 0xdac89a, 0, 0.1, 1.02);
    this.addBox(g, 0.4, 0.4, 0.1, 0x8a5a34, -0.52, 1.2, 0.72); this.addBox(g, 0.3, 0.3, 0.08, 0xbfe7ee, -0.52, 1.2, 0.77, 0.35);
    this.addCyl(g, 0.2, 0.16, 0.26, 0x9a6a3c, 0.62, 0.13, 0.82, 16); this.addSphere(g, 0.17, 0x63b23f, 0.62, 0.32, 0.82); this.addSphere(g, 0.08, 0xffd45e, 0.62, 0.44, 0.82, 0.7);
    return g;
  }

  // ---------- small detail helpers (verbatim) ----------
  grassTuft(parent, x, z, s, c) { const g = new THREE.Group(); const col = c || 0x7c9a5a; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const bl = this.addCyl(g, 0.008, 0.05, 0.3 * s, col, Math.cos(a) * 0.06 * s, 0.15 * s, Math.sin(a) * 0.06 * s, 5); bl.rotation.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); bl.castShadow = false; } g.position.set(x, 0, z); parent.add(g); return g; }
  leaf(parent, x, z, c) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8), this.mat(c || 0xd8a24a, 0.9)); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.scale.set(1, 0.55, 1); m.position.set(x, 0.045, z); parent.add(m); return m; }
  footprints(parent, x0, z0, dx, dz, n) { const mat = new THREE.MeshBasicMaterial({ color: 0x6a4a28, transparent: true, opacity: 0.16 }); for (let i = 0; i < n; i++) { const side = (i % 2) ? 0.14 : -0.14; const px = x0 + dx * i + (-dz) * side, pz = z0 + dz * i + (dx) * side; const m = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), mat); m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.5, 1); m.rotation.z = Math.atan2(dz, dx); m.position.set(px, 0.05, pz); parent.add(m); } }
  smallMushroom(parent, x, z, s) { const g = new THREE.Group(); this.addCyl(g, 0.06 * s, 0.09 * s, 0.24 * s, 0xf3e7cf, 0, 0.12 * s, 0, 12); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xef5f74, 0.5)); cap.position.set(0, 0.24 * s, 0); cap.castShadow = true; g.add(cap); this.addSphere(g, 0.04 * s, 0xfff3e6, 0.05 * s, 0.3 * s, 0.05 * s, 0.7); this.addSphere(g, 0.03 * s, 0xfff3e6, -0.06 * s, 0.28 * s, 0.02 * s, 0.7); g.position.set(x, 0, z); parent.add(g); return g; }
  mailbox(parent, x, z, rot) { const g = new THREE.Group(); this.addBox(g, 0.1, 0.9, 0.1, 0x9a6a3c, 0, 0.45, 0); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 16, 1, false, 0, Math.PI), this.mat(0xe25b6a, 0.6)); body.rotation.z = Math.PI / 2; body.position.set(0, 0.96, 0); body.castShadow = true; g.add(body); this.addBox(g, 0.02, 0.3, 0.42, 0xf6eccf, 0, 0.85, 0); this.addBox(g, 0.04, 0.24, 0.04, 0xf6c14f, 0.02, 1.02, 0.24); g.position.set(x, 0, z); g.rotation.y = rot || 0; parent.add(g); return g; }
  doormat(parent, x, z, c) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), this.mat(c || 0x8a6a44, 0.98)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.055, z); m.receiveShadow = true; parent.add(m); const b = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), this.mat(0xb89056, 0.98)); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.06, z); parent.add(b); return m; }

  // ---------- procedural textures (verbatim) ----------
  makePathTex() {
    const N = 1400, span = 40, off = 20; const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    const P = (wx, wz) => [(wx + off) / span * N, (wz + off) / span * N];
    const routes = [
      [[-4.8, 0.4], [-3.2, 1.6], [-1.2, 2.6], [1.4, 2.7], [3.4, 1.4], [5.0, -0.6], [6.0, -2.6]],
      [[0.6, 12.5], [0.8, 8.5], [1.1, 5.0], [1.4, 2.9]],
    ];
    const stroke = (w, style, blur) => {
      x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = style; x.lineWidth = w; x.filter = blur ? ('blur(' + blur + 'px)') : 'none';
      routes.forEach(r => {
        x.beginPath(); const p0 = P(r[0][0], r[0][1]); x.moveTo(p0[0], p0[1]);
        for (let i = 1; i < r.length - 1; i++) { const a = P(r[i][0], r[i][1]), b = P(r[i + 1][0], r[i + 1][1]); x.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        const last = P(r[r.length - 1][0], r[r.length - 1][1]); x.lineTo(last[0], last[1]); x.stroke();
      });
    };
    const R = 64;
    stroke(R * 1.3, 'rgba(150,124,84,0.5)', 14); stroke(R, '#d9c49a', 0); stroke(R * 0.88, '#e4d3ac', 0); stroke(R * 0.55, '#efe1c2', 7);
    const hp = P(1.4, 2.8); x.filter = 'blur(9px)'; x.fillStyle = 'rgba(150,120,74,0.4)'; x.beginPath(); x.ellipse(hp[0], hp[1], R * 0.95, R * 0.8, 0, 0, 7); x.fill();
    x.filter = 'none'; x.fillStyle = '#ddc59a'; x.beginPath(); x.ellipse(hp[0], hp[1], R * 0.7, R * 0.55, 0, 0, 7); x.fill();
    const img = x.getImageData(0, 0, N, N).data; const isPath = (px, py) => img[((py | 0) * N + (px | 0)) * 4 + 3] > 40;
    for (let i = 0; i < 5200; i++) { const px = Math.random() * N, py = Math.random() * N; if (!isPath(px, py)) continue; const r = Math.random(); x.fillStyle = r < 0.5 ? 'rgba(120,96,58,0.35)' : r < 0.8 ? 'rgba(160,132,86,0.4)' : 'rgba(244,232,206,0.5)'; x.beginPath(); x.arc(px, py, 0.6 + Math.random() * 2.2, 0, 7); x.fill(); }
    for (let i = 0; i < 26; i++) { const px = Math.random() * N, py = Math.random() * N; if (!isPath(px, py)) continue; x.fillStyle = 'rgba(180,172,150,0.7)'; x.beginPath(); x.ellipse(px, py, 3 + Math.random() * 4, 2 + Math.random() * 3, Math.random() * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  makeGrassTex() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#a6c07a'; x.fillRect(0, 0, 512, 512);
    const patch = ['#b2c986', '#c1d48f', '#93ad6b', '#a0b975', '#849c5e'];
    for (let i = 0; i < 30; i++) { const r = 60 + Math.random() * 150; x.globalAlpha = 0.14 + Math.random() * 0.14; x.fillStyle = patch[i % patch.length]; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 12; i++) { const r = 40 + Math.random() * 95; x.globalAlpha = 0.07 + Math.random() * 0.07; x.fillStyle = Math.random() < 0.5 ? '#c8bd94' : '#b6a878'; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, r, r * (0.6 + Math.random() * 0.4), Math.random() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 340; i++) { const r = 6 + Math.random() * 40; x.globalAlpha = 0.05 + Math.random() * 0.08; x.fillStyle = Math.random() < 0.5 ? '#b3c885' : '#7d9358'; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, r, 0, 7); x.fill(); }
    for (let i = 0; i < 440; i++) { x.globalAlpha = 0.08 + Math.random() * 0.12; x.strokeStyle = Math.random() < 0.5 ? '#bdcf90' : '#6f8a4d'; x.lineWidth = 1 + Math.random(); const px = Math.random() * 512, py = Math.random() * 512; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() * 4 - 2), py - 3 - Math.random() * 4); x.stroke(); }
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.encoding = THREE.sRGBEncoding; return t;
  }
  makeGlowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 36, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,242,170,0)'); g.addColorStop(0.5, 'rgba(255,236,150,0.55)'); g.addColorStop(0.78, 'rgba(255,244,190,0.16)'); g.addColorStop(1, 'rgba(255,244,190,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  makeStarTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,246,200,0.85)'); g.addColorStop(1, 'rgba(255,232,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 2.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(32, 7); x.lineTo(32, 57); x.moveTo(7, 32); x.lineTo(57, 32); x.stroke();
    return new THREE.CanvasTexture(c);
  }

  addRing(x, z, topY) {
    const grp = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7), new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.06, z); grp.add(disc);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
    sp.scale.set(0.62, 0.62, 1); sp.position.set(x + 0.95, topY, z); grp.add(sp);
    this.scene.add(grp);
    return { grp, disc, sparkle: sp, baseY: topY };
  }

  scatterProps() {
    const S = this.scene;
    const crate = (x, z, s) => { this.addBox(S, s, s, s, 0xcb9a52, x, s / 2, z); const e = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.14, s * 1.02), this.mat(0xa4763b)); e.position.set(x, s * 0.5, z); S.add(e); this.addBox(S, s * 1.03, s * 0.1, s * 0.1, 0xa4763b, x, s * 0.35, 0); };
    crate(-3.0, 1.6, 0.9); crate(9.3, -3.0, 0.8); crate(4.6, 3.6, 0.75);
    const fence = (x, z, rot) => { const g = new THREE.Group(); this.addBox(g, 0.16, 0.9, 0.16, 0xcaa06a, -0.7, 0.45, 0); this.addBox(g, 0.16, 0.9, 0.16, 0xcaa06a, 0.7, 0.45, 0); this.addBox(g, 1.7, 0.14, 0.12, 0xdcb277, 0, 0.62, 0); this.addBox(g, 1.7, 0.14, 0.12, 0xdcb277, 0, 0.34, 0); g.position.set(x, 0, z); g.rotation.y = rot || 0; S.add(g); };
    fence(-8.4, 2.2, 0.2); fence(-6.7, 2.5, 0.2); fence(3.2, 4.6, -0.1); fence(4.9, 4.5, -0.1);
    const rock = (x, z, s) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this.mat(0xb8b3a6)); m.position.set(x, s * 0.6, z); m.rotation.set(Math.random(), Math.random(), Math.random()); m.castShadow = true; m.receiveShadow = true; S.add(m); };
    rock(-9.5, -1.5, 0.5); rock(8.0, 3.2, 0.6); rock(0.5, 5.2, 0.45);
    this.bushAt(S, -4.5, 4.2, 1.0); this.bushAt(S, 10.8, 0.5, 0.95); rock(7.2, 1.2, 0.5); this.smallMushroom(S, -1.5, -3.0, 0.9);
    const sign = (x, z) => { const g = new THREE.Group(); this.addBox(g, 0.13, 1.15, 0.13, 0x9a6a3c, 0, 0.57, 0); this.addBox(g, 0.9, 0.44, 0.1, 0xcaa06a, 0, 1.0, 0.04); this.addBox(g, 0.78, 0.32, 0.04, 0xf3e7cf, 0, 1.0, 0.11); g.position.set(x, 0, z); g.rotation.y = -0.2; S.add(g); };
    sign(5.4, 5.4);
    const flower = (x, z, c) => { const g = new THREE.Group(); this.addCyl(g, 0.03, 0.03, 0.28, 0x4f9a3f, 0, 0.14, 0, 6); const p = this.addSphere(g, 0.13, c, 0, 0.32, 0); p.scale.set(1, 0.6, 1); this.addSphere(g, 0.05, 0xf6c14f, 0, 0.36, 0, 0.7); g.position.set(x, 0, z); S.add(g); };
    const fc = [0xf4849a, 0xf6c14f, 0xe56d84, 0xffffff, 0xf29bc0];
    for (let i = 0; i < 26; i++) { const x = (Math.random() * 24 - 12), z = (Math.random() * 10 - 1.5); if (Math.hypot(x + 6, z + 2) < 2.6 || Math.hypot(x - 6, z + 4) < 3 || Math.hypot(x - 2.5, z - 3) < 2.6) continue; flower(x, z, fc[i % fc.length]); }
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshStandardMaterial({ color: 0x5ec2ea, roughness: 0.12, metalness: 0.25 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-9.2, 0.03, -1.0); pond.receiveShadow = true; S.add(pond);
    const pondRim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 10, 40), this.mat(0xa89a72, 0.95)); pondRim.rotation.x = Math.PI / 2; pondRim.position.set(-9.2, 0.06, -1.0); S.add(pondRim);
    const dirtPatch = (x, z, s) => { const m = new THREE.Mesh(new THREE.CircleGeometry(s, 20), new THREE.MeshStandardMaterial({ color: 0xcbb489, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.scale.set(1, 0.7, 1); m.receiveShadow = true; S.add(m); const m2 = new THREE.Mesh(new THREE.CircleGeometry(s * 0.6, 18), new THREE.MeshStandardMaterial({ color: 0xdccaa0, roughness: 1 })); m2.rotation.x = -Math.PI / 2; m2.position.set(x + s * 0.12, 0.025, z); m2.scale.set(1, 0.7, 1); S.add(m2); };
    const stonePatch = (x, z, s) => { const m = new THREE.Mesh(new THREE.CircleGeometry(s, 20), new THREE.MeshStandardMaterial({ color: 0xaea791, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.scale.set(1, 0.72, 1); S.add(m); for (let i = 0; i < 7; i++) { const a = Math.random() * 7, rr = Math.random() * s * 0.7; const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.14, 0), this.mat(0xa8a291)); p.position.set(x + Math.cos(a) * rr, 0.07, z + Math.sin(a) * rr); p.castShadow = true; S.add(p); } };
    dirtPatch(-3.4, 3.2, 1.3); dirtPatch(8.6, 1.4, 1.1); dirtPatch(-7.8, 2.4, 1.0); dirtPatch(4.2, 5.4, 0.9);
    stonePatch(-6.3, 4.4, 1.0); stonePatch(9.8, -1.2, 0.9);
    const pineGreens = [[0x5c8a4e, 0x679553, 0x72a05e], [0x527f47, 0x5d8c4f, 0x6a9a5a], [0x638f56, 0x6f9b60, 0x7aa76a], [0x577f4c, 0x628c54, 0x6f9a5e]];
    const pine = (x, z, s, pal, lean) => { const g = new THREE.Group(); this.addCyl(g, 0.12, 0.16, 0.5, 0x8a5a34, 0, 0.25, 0, 8); this.addCone(g, 0.72 * s, 1.4 * s, pal[0], 0, 0.9 * s, 0, 12); this.addCone(g, 0.9 * s, 1.5 * s, pal[1], 0, 1.6 * s, 0, 12); this.addCone(g, 0.6 * s, 1.1 * s, pal[2], 0, 2.3 * s, 0, 12); g.position.set(x, 0, z); g.rotation.z = lean || 0; g.rotation.y = Math.random() * 6; S.add(g); };
    const roundTree = (x, z, s, c1, c2) => { const g = new THREE.Group(); this.addCyl(g, 0.14, 0.2, 0.8 * s, 0x8a5a34, 0, 0.4 * s, 0, 8); this.addSphere(g, 0.95 * s, c1, 0, 1.2 * s, 0, 0.95); this.addSphere(g, 0.62 * s, c2, 0.42 * s, 1.65 * s, 0.05, 0.95); this.addSphere(g, 0.56 * s, c2, -0.42 * s, 1.5 * s, -0.05, 0.95); this.addSphere(g, 0.5 * s, c1, 0, 1.9 * s, 0, 0.95); g.position.set(x, 0, z); g.rotation.y = Math.random() * 6; S.add(g); };
    const shrub = (x, z, s) => { const g = new THREE.Group(); this.addSphere(g, 0.6 * s, 0x6f9a55, -0.4 * s, 0.5 * s, 0, 0.95); this.addSphere(g, 0.7 * s, 0x7ea863, 0.35 * s, 0.55 * s, 0.1, 0.95); this.addSphere(g, 0.55 * s, 0x8db273, 0, 0.85 * s, -0.1, 0.95); g.position.set(x, 0, z); S.add(g); };
    const roundPals = [[0x6f9a52, 0x8ab567], [0x678f4c, 0x82ae60], [0x76a259, 0x92bb6f]];
    let tx = -19;
    for (let i = 0; i < 14; i++) {
      const s = 0.8 + Math.random() * 1.15, z = -12.5 - Math.random() * 7, r = Math.random();
      if (r < 0.55) pine(tx, z, s, pineGreens[i % pineGreens.length], (Math.random() * 0.12 - 0.06));
      else if (r < 0.85) { const p = roundPals[i % roundPals.length]; roundTree(tx, z, s * 0.85, p[0], p[1]); }
      else shrub(tx, z + 1.2, 0.9 + Math.random() * 0.6);
      tx += 2.2 + Math.random() * 2.4;
    }
    pine(11.5, -6.5, 1.3, pineGreens[1], 0.03); roundTree(13.6, -4.2, 1.15, roundPals[0][0], roundPals[0][1]); shrub(9.6, -6.8, 1.1);
    fence(-13.5, -8.4, 0.12); fence(-11.5, -8.7, 0.12); fence(-9.5, -8.9, 0.12);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; flower(-6.5 + Math.cos(a) * 0.8, -7.4 + Math.sin(a) * 0.6, fc[i % fc.length]); }
    rock(0.2, 0.5, 0.55); rock(1.1, 0.1, 0.4); this.addSphere(S, 0.3, 0x5aa838, 0.55, 0.24, 0.35, 0.9).scale.set(1, 0.4, 1);
    this.grassTuft(S, -0.7, 0.7, 0.95); this.grassTuft(S, -0.2, 1.4, 1.0); this.grassTuft(S, 1.2, -0.5, 1.05);
    this.smallMushroom(S, -0.3, 0.1, 0.9); this.smallMushroom(S, 0.9, 1.5, 0.8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; flower(0.4 + Math.cos(a) * 1.05, 0.6 + Math.sin(a) * 0.8, fc[i % fc.length]); }
    this.bushAt(S, -7.7, -0.5, 0.95); this.grassTuft(S, -4.5, -0.3, 1.0);
    this.grassTuft(S, -7.0, 0.7, 1.0); this.grassTuft(S, -4.7, 1.1, 0.9);
    this.smallMushroom(S, -7.2, 0.3, 0.95); this.smallMushroom(S, -4.6, -0.2, 0.8);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; flower(-6.7 + Math.cos(a) * 0.95, -0.1 + Math.sin(a) * 0.7, fc[i % fc.length]); }
    [[0.2, 3.5, 1.0], [0.6, 4.3, 0.85], [2.4, 3.7, 0.95], [2.8, 2.9, 0.8], [0.0, 2.7, 0.9]].forEach(p => this.smallMushroom(S, p[0], p[1], p[2]));
    this.grassTuft(S, 3.0, 2.4, 1.0); this.grassTuft(S, -0.1, 3.9, 1.0);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; flower(1.4 + Math.cos(a) * 1.15, 3.5 + Math.sin(a) * 0.85, fc[i % fc.length]); }
    this.bushAt(S, 8.1, -1.3, 0.9); this.smallMushroom(S, 4.0, -1.6, 0.85);
    this.grassTuft(S, 7.6, -0.5, 1.0); this.smallMushroom(S, 4.4, -1.2, 0.85);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; flower(7.3 + Math.cos(a) * 0.95, -0.7 + Math.sin(a) * 0.7, fc[i % fc.length]); }
    rock(11.5, -1.5, 0.7); this.bushAt(S, 12.5, 1.0, 1.0); this.grassTuft(S, 10.2, -0.6, 1.15); this.grassTuft(S, 11.0, 0.2, 1.1);
    const blocked = (x, z) => Math.hypot(x + 6, z + 2) < 3 || Math.hypot(x - 6, z + 4) < 3.4 || Math.hypot(x - 1.4, z - 1.9) < 3.2 || Math.hypot(x - 0.4, z - 0.6) < 2.4;
    const tuftCols = [0x7c9a5a, 0x8aa96a, 0x6b8a4e];
    for (let i = 0; i < 24; i++) { const x = Math.random() * 24 - 12, z = Math.random() * 11 - 2.5; if (blocked(x, z)) continue; this.grassTuft(S, x, z, 0.6 + Math.random() * 0.6, tuftCols[i % 3]); }
    const leafCols = [0xd8a24a, 0xe0b24f, 0xc98a3c, 0xd97e4a];
    for (let i = 0; i < 14; i++) { const x = Math.random() * 22 - 11, z = Math.random() * 10 - 2; if (blocked(x, z)) continue; this.leaf(S, x, z, leafCols[i % 4]); }
    this.footprints(S, 1.0, 10.0, -0.03, -0.6, 7);
    this.footprints(S, -8.4, 6.2, 0.5, -0.7, 6);
  }
  addClouds() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x556677, emissiveIntensity: 0.06 });
    const cloud = (x, y, z, s) => { const g = new THREE.Group();[[-1, 0, 0, 1], [0.9, 0.1, 0, 1.1], [0, 0.5, 0, 1.2], [0.3, -0.1, 0.4, 0.8]].forEach(([a, b, c, r]) => { const p = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); p.position.set(a, b, c); g.add(p); }); g.position.set(x, y, z); g.scale.setScalar(s); this.scene.add(g); };
    cloud(-10, 10, -16, 1.2); cloud(8, 12, -18, 1.5); cloud(2, 9, -14, 1.0); cloud(-15, 13, -20, 1.3);
    cloud(16, 11, -22, 1.1); cloud(-4, 14.5, -24, 1.6); cloud(-20, 9, -19, 0.9); cloud(22, 13.5, -26, 1.35); cloud(11, 8.5, -15, 0.85); cloud(-12, 15.5, -28, 1.2);
  }

  // ---------- init ----------
  _initThree() {
    if (this._inited) return; this._inited = true;
    const host = document.getElementById(this.hostId); if (!host) return;
    const W = host.clientWidth || innerWidth, H = host.clientHeight || innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement); this.renderer = renderer;

    const scene = new THREE.Scene(); this.scene = scene;
    this.glowTex = this.makeGlowTex(); this.starTex = this.makeStarTex(); this.grassTex = this.makeGrassTex();
    const sc = document.createElement('canvas'); sc.width = 2; sc.height = 256;
    const g2 = sc.getContext('2d'); const grd = g2.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#4aa6ee'); grd.addColorStop(0.5, '#93d4f2'); grd.addColorStop(0.8, '#cfe4c6'); grd.addColorStop(1, '#d2e0b0');
    g2.fillStyle = grd; g2.fillRect(0, 0, 2, 256);
    scene.background = new THREE.CanvasTexture(sc);
    scene.fog = new THREE.Fog(0xc4d3a6, 62, 135);

    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 200); this.camera = cam;
    this.basePos = new THREE.Vector3(0, 7.2, 14.5); this.baseTarget = new THREE.Vector3(0, 1.3, -1.5);
    cam.position.copy(this.basePos); this.curTarget = this.baseTarget.clone(); cam.lookAt(this.curTarget);

    scene.add(new THREE.HemisphereLight(0xcdeaff, 0x6a8a44, 0.42));
    const sun = new THREE.DirectionalLight(0xfff3d2, 1.5); sun.position.set(10, 16, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const s2 = sun.shadow.camera; s2.left = -22; s2.right = 22; s2.top = 22; s2.bottom = -22; s2.near = 1; s2.far = 60; sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.32); fill.position.set(-8, 6, -5); scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: this.grassTex, color: 0xffffff, roughness: 0.96, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    this.pathTex = this.makePathTex();
    const path = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: this.pathTex, transparent: true, roughness: 0.98, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
    path.rotation.x = -Math.PI / 2; path.position.y = 0.02; path.receiveShadow = true; scene.add(path);
    const smoothHill = (z, crestY, amp, width, color, ph) => {
      const shape = new THREE.Shape(); const hw = width / 2, steps = 110, bottom = -26;
      const top = (t) => crestY + amp * (0.6 * Math.sin(t * Math.PI * 2 * 1.15 + ph) + 0.4 * Math.sin(t * Math.PI * 2 * 0.55 + ph * 1.7));
      shape.moveTo(-hw, bottom); shape.lineTo(-hw, top(0));
      for (let i = 1; i <= steps; i++) { const t = i / steps; shape.lineTo(-hw + t * width, top(t)); }
      shape.lineTo(hw, bottom); shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: true }));
      m.position.set(0, 0, z); scene.add(m); return m;
    };
    smoothHill(-52, 7.6, 1.6, 150, 0xbccca6, 0.7);
    smoothHill(-41, 5.0, 2.0, 140, 0xa8bd8c, 2.3);
    const flatBlob = (x, y, z, r, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color, fog: true })); m.position.set(x, y, z); m.scale.set(1.05, 0.95, 0.35); scene.add(m); };
    for (let i = 0; i < 18; i++) { const x = -46 + i * 5.2 + (Math.random() * 2.6 - 1.3); const r = 0.8 + Math.random() * 0.7; const y = 5.0 + Math.sin(i * 0.9) * 0.5 + Math.random() * 0.4; flatBlob(x, y, -47, r, 0x8ba173); if (Math.random() < 0.35) flatBlob(x + 0.5 * r, y + 0.6 * r, -47, r * 0.6, 0x8ba173); }

    // build objects (id must match backend OBJECTS list)
    const tree = this.buildTree(); tree.position.set(-6, 0, -2);
    const house = this.buildHouse(); house.position.set(6, 0, -4);
    const mush = this.buildMushroom(); mush.position.set(1.4, 0, 1.9); mush.scale.setScalar(0.88);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.objects = [
      { id: 'tree', name: '큰 나무', group: tree, spot: V(-5.0, 0, 0.3), focus: { pos: V(-4.7, 1.95, 4.7), tgt: V(-5.0, 0.45, 0.3) } },
      { id: 'house', name: '집', group: house, spot: V(6.3, 0, -1.8), focus: { pos: V(6.5, 1.95, 2.6), tgt: V(6.3, 0.45, -1.8) } },
      { id: 'mushroom', name: '버섯집', group: mush, spot: V(1.5, 0, 3.4), focus: { pos: V(1.6, 1.85, 7.8), tgt: V(1.5, 0.42, 3.4) } },
    ];
    this.objects.forEach((o, i) => { o.group.traverse(n => { n.userData.objIndex = i; }); scene.add(o.group); });
    this.objGroups = this.objects.map(o => o.group);
    const topYs = { tree: 5.4, house: 3.9, mushroom: 3.3 };
    this.rings = this.objects.map(o => { const p = o.group.position; return this.addRing(p.x, p.z + (o.id === 'mushroom' ? 0.4 : -1.3), topYs[o.id] || 3.8); });

    this.scatterProps(); this.addClouds();

    // foreground occluders → found animal peeks out from behind them
    this.bushAt(scene, -5.0, 1.35, 0.95);
    { const s = 0.92; this.addBox(scene, s, s, s, 0xcb9a52, 6.3, s / 2, -0.5); const e = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.14, s * 1.02), this.mat(0xa4763b)); e.position.set(6.3, s * 0.5, -0.5); scene.add(e); }
    this.addCyl(scene, 0.46, 0.34, 0.66, 0xcb9a52, 1.5, 0.33, 4.5, 18); this.bushAt(scene, 1.5, 4.5, 0.5);

    this.mailbox(scene, 7.9, -2.3, -0.3);
    this.doormat(scene, 6, -2.65, 0x8a6a44);
    this.doormat(scene, 1.4, 2.9, 0x9a5f6a);
    { const g = new THREE.Group(); this.addBox(g, 0.12, 1.0, 0.12, 0x9a6a3c, 0, 0.5, 0); this.addBox(g, 0.86, 0.4, 0.1, 0xcaa06a, 0, 0.9, 0.03); this.addBox(g, 0.74, 0.28, 0.04, 0xf3e7cf, 0, 0.9, 0.1); this.addSphere(g, 0.08, 0xf4849a, -0.22, 0.9, 0.13, 0.7); this.addSphere(g, 0.06, 0xffd45e, 0.2, 0.9, 0.13, 0.7); g.position.set(4.5, 0, -0.6); g.rotation.y = 0.3; scene.add(g); }

    this.bushAt(scene, -11.5, 9.5, 1.7); this.bushAt(scene, 12.0, 9.2, 1.8);
    this.grassTuft(scene, -9, 9.8, 2.4); this.grassTuft(scene, 9.5, 10.0, 2.6); this.grassTuft(scene, 0, 11.0, 2.2);
    { const flowerF = (x, z, c, s) => { const g = new THREE.Group(); this.addCyl(g, 0.05, 0.05, 0.5 * s, 0x4f9a3f, 0, 0.25 * s, 0, 6); const p = this.addSphere(g, 0.22 * s, c, 0, 0.55 * s, 0); p.scale.set(1, 0.6, 1); this.addSphere(g, 0.09 * s, 0xf6c14f, 0, 0.62 * s, 0, 0.7); g.position.set(x, 0, z); scene.add(g); };
      const fc = [0xf4849a, 0xf6c14f, 0xe56d84, 0xffffff, 0xf29bc0];
      [[-7.5, 10.6], [-5.2, 10.9], [6.8, 10.7], [8.6, 10.5], [-2, 11.1], [2.5, 11.0]].forEach((p, i) => flowerF(p[0], p[1], fc[i % fc.length], 1.3)); }
    { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { const fx = k * 1.5; this.addBox(g, 0.2, 1.15, 0.2, 0xcaa06a, fx - 0.7, 0.57, 0); this.addBox(g, 0.2, 1.15, 0.2, 0xcaa06a, fx + 0.7, 0.57, 0); } this.addBox(g, 4.4, 0.18, 0.14, 0xdcb277, 0.5, 0.78, 0); this.addBox(g, 4.4, 0.18, 0.14, 0xdcb277, 0.5, 0.44, 0); g.position.set(-11, 0, 10.6); g.rotation.y = 0.15; scene.add(g); }

    // the FOUND animal billboard + contact shadow (texture set later from server image)
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: true, opacity: 0 }));
    spr.center.set(0.5, 0); spr.visible = false; scene.add(spr); this.sprite = spr;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: 0x2f5a22, transparent: true, opacity: 0.24 })); sh.renderOrder = 1;
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; sh.visible = false; scene.add(sh); this.shadow = sh;

    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this._onDown = (e) => this._onPointer(e); renderer.domElement.addEventListener('pointerdown', this._onDown);
    this._onResize = () => this.resize(); window.addEventListener('resize', this._onResize);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(host); }

    this._t = 0; this.animate();
    if (this._onReady) this._onReady();
  }

  onReady(cb) { if (this._inited) cb(); else this._onReady = cb; }

  resize() { const host = document.getElementById(this.hostId); if (!host || !this.renderer) return; const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return; this.renderer.setSize(W, H); this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }

  _onPointer(e) {
    if (this.view !== 'find' || !this.camera) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.objGroups, true);
    if (hits.length) { let o = hits[0].object; while (o && o.userData.objIndex === undefined) o = o.parent; if (o) { const obj = this.objects[o.userData.objIndex]; if (this._pickCb) this._pickCb(obj.id); } }
  }

  startTween(pos, tgt, cb) { this.tween = { fromP: this.camera.position.clone(), toP: pos.clone(), fromT: this.curTarget.clone(), toT: tgt.clone(), t0: performance.now(), dur: 640, cb }; }
  ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  _findObject(id) { return this.objects.find(o => o.id === id) || this.objects[0]; }

  /** Zoom the camera in on an object. Returns a Promise that resolves on arrival. */
  zoomToObject(objectId) {
    return new Promise(resolve => {
      const o = this._findObject(objectId);
      this.activeObjectId = objectId;
      this.view = 'zoom';
      this.rings.forEach(r => r.grp.visible = false);
      this.startTween(o.focus.pos, o.focus.tgt, () => resolve());
    });
  }

  /**
   * Reveal a "found" animal peeking out from behind the currently zoomed object.
   * `imageUrl` is the OPAQUE target-pose image from the backend — the engine
   * never knows which direction index it is.
   */
  showFoundAnimal(imageUrl) {
    const o = this._findObject(this.activeObjectId);
    const spot = o.spot;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(imageUrl, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      const iw = (tex.image && tex.image.width) || 1, ih = (tex.image && tex.image.height) || 1;
      const Hh = 1.7, w = Hh * (iw / ih);
      this.sprite.material.map = tex; this.sprite.material.opacity = 1; this.sprite.material.needsUpdate = true;
      this._spriteW = w; this._spriteH = Hh;
      this.sprite.scale.set(w, Hh, 1); this.sprite.position.copy(spot);
      this.shadow.position.set(spot.x, 0.05, spot.z); this.shadow.scale.setScalar(w * 0.9);
      this._revealT0 = performance.now(); this._revealSpotY = spot.y;
      this.sprite.visible = true; this.shadow.visible = true;
    });
  }

  /** Return to the "find" overview: hide the animal, restore rings. */
  resetView() {
    this._clearTimers();
    if (this.sprite) { this.sprite.visible = false; this.shadow.visible = false; }
    this.activeObjectId = null;
    this.view = 'find';
    this._revealT0 = null;
    if (this.camera) this.startTween(this.basePos, this.baseTarget, () => { this.rings.forEach(r => r.grp.visible = true); });
  }

  animate() {
    if (!this._alive) return;
    this._raf = requestAnimationFrame(() => this.animate());
    const now = performance.now(); this._t += 0.016;
    if (this.tween) {
      const tw = this.tween; const p = Math.min(1, (now - tw.t0) / tw.dur); const e = this.ease(p);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, e); this.curTarget.lerpVectors(tw.fromT, tw.toT, e);
      if (p >= 1) { const cb = tw.cb; this.tween = null; if (cb) cb(); }
    }
    this.camera.lookAt(this.curTarget);
    if (this.view === 'find' && this.rings) {
      this.rings.forEach((r, k) => {
        r.grp.visible = true; const ph = this._t * 2.0 + k * 1.6;
        r.disc.material.opacity = 0.34 + 0.2 * (0.5 + 0.5 * Math.sin(ph));
        const sc = 1 + 0.05 * Math.sin(ph); r.disc.scale.set(sc, sc, 1);
        if (r.sparkle) { r.sparkle.position.y = r.baseY + 0.14 * Math.sin(ph); r.sparkle.material.rotation += 0.02; r.sparkle.material.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(ph + 1)); }
      });
      this.objGroups.forEach((o, k) => { o.position.y = Math.sin(this._t * 1.4 + k * 1.3) * 0.05; });
    } else if (this.objGroups) { this.objGroups.forEach(o => o.position.y = 0); }
    if (this.sprite && this.sprite.visible && this._revealT0) {
      const p = Math.min(1, (now - this._revealT0) / 520); const b = p < 1 ? (1.7 * p * p - 0.7 * p * p * p) : 1;
      const w = this._spriteW || 1, Hh = this._spriteH || 1.7;
      const k = 0.4 + 0.6 * b; this.sprite.scale.set(w * k, Hh * k, 1);
      this.sprite.position.y = this._revealSpotY - 0.55 * (1 - b);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

window.ForestScene = ForestScene;
window.ANIMALS = ANIMALS;
window.spriteFrameStyle = spriteFrameStyle;
