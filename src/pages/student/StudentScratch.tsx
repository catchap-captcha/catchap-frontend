import { useEffect, useMemo, useState } from 'react';
import { studentApi } from '../../api/students';
import StrokePlayback, { type ScratchStroke } from '../../components/scratch/StrokePlayback';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUBJECT_COLOR: Record<string, string> = {
  국어: '#FF5A4D', 영어: '#FF922E', 수학: '#17B08C', 과학: '#2E7BFF', 사회: '#8B6BFF', 생활: '#FF6DA6',
};
const colorOf = (s: string) => SUBJECT_COLOR[s] || '#8A8175';

interface Meta {
  id: string;
  subject: string;
  content_id: string | null;
  stroke_count: number;
  distance_px: number;
  first_write_ms: number;
  draw_ms: number;
  purged: boolean;
  created_at: string | null;
}

function fmtMs(ms: number): string {
  const sec = Math.round((ms || 0) / 1000);
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export default function StudentScratch() {
  const [subjects, setSubjects] = useState<{ subject: string; count: number; strokes: number }[]>([]);
  const [items, setItems] = useState<Meta[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  // 재생 패널
  const [selected, setSelected] = useState<Meta | null>(null);
  const [strokes, setStrokes] = useState<ScratchStroke[] | null>(null);
  const [detailPurged, setDetailPurged] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = (subject: string | null) => {
    setLoading(true);
    setErr(false);
    studentApi
      .scratchList(subject ?? undefined)
      .then((d: any) => {
        setSubjects(Array.isArray(d?.subjects) ? d.subjects : []);
        setItems(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openRecord = (m: Meta) => {
    setSelected(m);
    setStrokes(null);
    setDetailPurged(false);
    if (m.purged) {
      setDetailPurged(true);
      setStrokes([]);
      return;
    }
    setDetailLoading(true);
    studentApi
      .scratchDetail(m.id)
      .then((d: any) => {
        setDetailPurged(!!d?.purged);
        setStrokes(Array.isArray(d?.strokes) ? d.strokes : []);
      })
      .catch(() => setStrokes([]))
      .finally(() => setDetailLoading(false));
  };

  const totalCount = useMemo(() => subjects.reduce((n, s) => n + s.count, 0), [subjects]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '18px 14px 60px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#3A342C', margin: 0 }}>
          <i className="ph-fill ph-pencil-line" style={{ color: '#2E7BFF', marginRight: 8 }} />
          필기 다시보기
        </h1>
        <p style={{ color: '#8A8175', fontSize: 14, margin: '6px 0 0' }}>
          문제를 풀며 연습장에 쓴 풀이 과정을 과목별로 다시 볼 수 있어요.
        </p>
      </div>

      {/* 과목 필터 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setFilter(null)}
          style={chipStyle(filter === null, '#3A342C')}
        >
          전체 {totalCount > 0 && <b style={{ marginLeft: 4 }}>{totalCount}</b>}
        </button>
        {subjects.map((s) => (
          <button
            key={s.subject}
            type="button"
            onClick={() => setFilter(s.subject)}
            style={chipStyle(filter === s.subject, colorOf(s.subject))}
          >
            {s.subject} <b style={{ marginLeft: 4 }}>{s.count}</b>
          </button>
        ))}
      </div>

      {/* 재생 패널 */}
      {selected && (
        <div
          style={{
            background: '#fff', border: '1px solid #EFE7DA', borderRadius: 18, padding: 16, marginBottom: 18,
            boxShadow: '0 10px 24px -18px rgba(0,0,0,.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={badgeStyle(colorOf(selected.subject))}>{selected.subject}</span>
              <div>
                <div style={{ fontWeight: 800, color: '#3A342C', fontSize: 15 }}>
                  {selected.content_id ? `문항 ${selected.content_id}` : '연습장 필기'}
                </div>
                <div style={{ color: '#B0A79B', fontSize: 12 }}>{fmtDate(selected.created_at)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: '#B0A79B', fontSize: 22, cursor: 'pointer' }}
              aria-label="닫기"
            >
              <i className="ph-bold ph-x" />
            </button>
          </div>

          {detailLoading ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0A79B' }}>
              불러오는 중…
            </div>
          ) : (
            <StrokePlayback strokes={strokes ?? []} purged={detailPurged} />
          )}

          {/* 필기 지표 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, color: '#5A5248', fontSize: 13 }}>
            <span><i className="ph-fill ph-scribble-loop" style={{ marginRight: 4, color: '#2E7BFF' }} />획 {selected.stroke_count}개</span>
            <span><i className="ph-fill ph-ruler" style={{ marginRight: 4, color: '#17B08C' }} />필기 거리 {selected.distance_px}px</span>
            <span><i className="ph-fill ph-timer" style={{ marginRight: 4, color: '#FF922E' }} />쓴 시간 {fmtMs(selected.draw_ms)}</span>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#B0A79B' }}>불러오는 중…</div>
      ) : err ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#E0475E', fontWeight: 700 }}>
          필기 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: '48px 20px', textAlign: 'center', color: '#8A8175', background: '#FAF7F2',
            border: '1px dashed #E4DCD0', borderRadius: 16,
          }}
        >
          <i className="ph-fill ph-pencil-slash" style={{ fontSize: 34, color: '#D6CDBF' }} />
          <div style={{ fontWeight: 800, marginTop: 8 }}>아직 저장된 연습장 필기가 없어요</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>수학처럼 계산이 필요한 문제에서 연습장에 풀이를 쓰면 여기에 모여요.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => openRecord(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
                background: selected?.id === m.id ? '#F1F6FF' : '#fff',
                border: `1px solid ${selected?.id === m.id ? '#B9D4FF' : '#EFE7DA'}`,
                borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
              }}
            >
              <span style={badgeStyle(colorOf(m.subject))}>{m.subject}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: '#3A342C', fontSize: 14 }}>
                  {m.content_id ? `문항 ${m.content_id}` : '연습장 필기'}
                  {m.purged && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#B0A79B', fontWeight: 700 }}>
                      <i className="ph-fill ph-eraser" /> 원본 파기됨
                    </span>
                  )}
                </div>
                <div style={{ color: '#B0A79B', fontSize: 12, marginTop: 2 }}>
                  {fmtDate(m.created_at)} · 획 {m.stroke_count}개 · {fmtMs(m.draw_ms)}
                </div>
              </div>
              <i className="ph-bold ph-play-circle" style={{ fontSize: 24, color: '#2E7BFF' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: 'pointer',
    border: `2px solid ${active ? color : '#E4DCD0'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#5A5248',
  };
}
function badgeStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, height: 30,
    padding: '0 10px', borderRadius: 8, background: color, color: '#fff', fontWeight: 800, fontSize: 13,
  };
}
