import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * StrokePlayback — 연습장 필기(ScratchRecord.strokes) 캔버스 재생 컴포넌트.
 *
 * 학생 본인·교사·학부모 재생 화면에서 공용으로 쓴다(운영자는 원본을 못 보므로 사용 안 함).
 * 위젯이 저장한 획 스키마: strokes = [{ color, width, points: [[t, x, y], ...] }].
 *   - points[i] = [t_ms(문항 표시 기준), x, y] — x/y는 원본 캔버스 CSS px.
 * 원본 캔버스 크기는 저장하지 않으므로, 전체 획의 바운딩 박스를 재생 캔버스에
 * 비율 유지로 맞춰 그린다(어느 기기에서 쓴 필기든 형태가 그대로 보인다).
 */

export interface ScratchStroke {
  color?: string;
  width?: number;
  points: number[][]; // [[t, x, y], ...]
}

interface Props {
  strokes: ScratchStroke[];
  purged?: boolean; // 파기된 기록 — 원본 획이 비어 있음(집계만 남음)
  height?: number;
}

const PAD = 16;

export default function StrokePlayback({ strokes, purged, height = 260 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // 유효 획(점 1개 이상)만
  const valid = useMemo(
    () => (Array.isArray(strokes) ? strokes.filter((s) => s && Array.isArray(s.points) && s.points.length) : []),
    [strokes],
  );
  const totalPts = useMemo(() => valid.reduce((n, s) => n + s.points.length, 0), [valid]);

  // 전체 바운딩 박스 (x=points[i][1], y=points[i][2])
  const box = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of valid) {
      for (const p of s.points) {
        const x = p[1], y = p[2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }, [valid]);

  /** 재생 캔버스에 비율 유지로 맞추는 변환 계수 */
  const fit = useCallback(
    (cssW: number, cssH: number) => {
      if (!box) return { scale: 1, ox: PAD, oy: PAD };
      const scale = Math.min((cssW - PAD * 2) / box.w, (cssH - PAD * 2) / box.h);
      const drawnW = box.w * scale, drawnH = box.h * scale;
      return {
        scale,
        ox: (cssW - drawnW) / 2 - box.minX * scale,
        oy: (cssH - drawnH) / 2 - box.minY * scale,
      };
    },
    [box],
  );

  /** 앞에서부터 reveal개 점까지만 그린다(reveal=Infinity면 전체) */
  const drawUpTo = useCallback(
    (reveal: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cssW = canvas.clientWidth || 1;
      const cssH = height;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 종이 배경 + 옅은 모눈
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#FFFDF9';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = '#F1EADF';
      ctx.lineWidth = 1;
      for (let gx = 24; gx < cssW; gx += 24) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssH); ctx.stroke();
      }
      for (let gy = 24; gy < cssH; gy += 24) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cssW, gy); ctx.stroke();
      }
      const { scale, ox, oy } = fit(cssW, cssH);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      let seen = 0;
      for (const s of valid) {
        const n = s.points.length;
        const take = Math.max(0, Math.min(n, reveal - seen));
        if (take >= 1) {
          ctx.strokeStyle = s.color || '#2A2A2A';
          ctx.lineWidth = Math.max(1, (s.width || 3) * scale);
          ctx.beginPath();
          for (let i = 0; i < take; i++) {
            const px = s.points[i][1] * scale + ox;
            const py = s.points[i][2] * scale + oy;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          // 점 1개짜리 획은 점을 찍어 표시
          if (take === 1) {
            const px = s.points[0][1] * scale + ox;
            const py = s.points[0][2] * scale + oy;
            ctx.lineTo(px + 0.1, py + 0.1);
          }
          ctx.stroke();
        }
        seen += n;
        if (seen >= reveal) break;
      }
    },
    [valid, fit, height],
  );

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!totalPts) return;
    stop();
    setPlaying(true);
    // 총 점 수와 무관하게 보기 좋은 고정 재생 시간(약 2.6초), 점이 아주 많으면 조금 길게.
    const durMs = Math.min(5000, Math.max(1600, totalPts * 6));
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durMs);
      drawUpTo(Math.ceil(p * totalPts));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [totalPts, drawUpTo, stop]);

  // 최초/데이터 변경 시 전체를 정적으로 그려둔다
  useEffect(() => {
    stop();
    if (totalPts) drawUpTo(Infinity);
    else {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round((canvas.clientWidth || 1) * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#FFFDF9';
        ctx.fillRect(0, 0, canvas.clientWidth || 1, height);
      }
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, totalPts]);

  // 리사이즈 시 정적 다시 그리기
  useEffect(() => {
    const onResize = () => {
      if (!playing && totalPts) drawUpTo(Infinity);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [playing, totalPts, drawUpTo]);

  if (purged) {
    return (
      <div
        style={{
          height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, background: '#FAF7F2', border: '1px dashed #E4DCD0', borderRadius: 14, color: '#8A8175',
          textAlign: 'center', padding: 16,
        }}
      >
        <i className="ph-fill ph-eraser" style={{ fontSize: 28 }} />
        <div style={{ fontWeight: 800 }}>원본 필기가 파기된 기록이에요</div>
        <div style={{ fontSize: 13 }}>탈퇴·보존기간 만료로 원본은 지워지고, 필기 노력 지표만 남아 있어요.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid #EFE7DA' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} />
        {!totalPts && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#B0A79B', fontWeight: 700, fontSize: 14,
            }}
          >
            이 문항에는 연습장 필기가 없어요.
          </div>
        )}
      </div>
      {totalPts > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={playing ? stop : play}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
              border: 'none', background: '#2E7BFF', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            <i className={playing ? 'ph-fill ph-stop' : 'ph-fill ph-play'} />
            {playing ? '멈춤' : '재생'}
          </button>
          <button
            type="button"
            onClick={() => { stop(); drawUpTo(Infinity); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
              border: '2px solid #E4DCD0', background: '#fff', color: '#5A5248', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}
          >
            <i className="ph-fill ph-image" />
            전체 보기
          </button>
        </div>
      )}
    </div>
  );
}
