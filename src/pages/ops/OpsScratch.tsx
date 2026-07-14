import { useEffect, useState } from 'react';
import { opsApi } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 운영자 연습장 필기 익명 집계 — 원본(필적)은 절대 노출하지 않고 과목별 통계만.
 * 아동 필적은 재식별 가능하므로 운영자는 원본 재생을 못 하고 이 집계만 본다(개인정보 보호).
 */

const SUBJECT_COLOR: Record<string, string> = {
  국어: '#FF5A4D', 영어: '#FF922E', 수학: '#17B08C', 과학: '#2E7BFF', 사회: '#8B6BFF', 생활: '#FF6DA6',
};
const colorOf = (s: string) => SUBJECT_COLOR[s] || '#8A8175';

interface Row {
  subject: string;
  records: number;
  avg_strokes: number;
  avg_distance_px: number;
  avg_draw_ms: number;
}

export default function OpsScratch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(false);
    opsApi
      .scratchAggregate()
      .then((d: any) => {
        setRows(Array.isArray(d?.by_subject) ? d.by_subject : []);
        setTotal(Number(d?.total_records) || 0);
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="op-root">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">필기 집계</h1>
            <p className="op-sub">
              학생들이 연습장에 쓴 풀이 필기의 익명 집계예요. 개인의 필적(원본)은 재식별 위험이
              있어 운영자에게 노출하지 않고, 과목별 통계 지표만 제공해요.
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        {/* 개인정보 고지 */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8EE', border: '1px solid #F3E4CC',
            color: '#8A6D3B', borderRadius: 12, padding: '11px 15px', fontSize: 13, fontWeight: 600, margin: '4px 0 18px',
          }}
        >
          <i className="ph-fill ph-lock-key" />
          운영자는 원본 필기(필적)를 열람할 수 없습니다. 원본 재생은 학생 본인·담당 교사·보호자에게만 허용됩니다.
        </div>

        <div className="op-kpis">
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--log"><i className="ph-fill ph-pencil-line" /></div>
            <div className="op-kpi-num">{total.toLocaleString()}</div>
            <div className="op-kpi-lb">수집된 필기 기록</div>
          </div>
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--stu"><i className="ph-fill ph-books" /></div>
            <div className="op-kpi-num">{rows.length}</div>
            <div className="op-kpi-lb">필기가 있는 과목</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#B0A79B' }}>불러오는 중…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#E0475E', fontWeight: 700 }}>
            집계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: '48px 20px', textAlign: 'center', color: '#8A8175', background: '#FAF7F2',
              border: '1px dashed #E4DCD0', borderRadius: 16,
            }}
          >
            <i className="ph-fill ph-pencil-slash" style={{ fontSize: 34, color: '#D6CDBF' }} />
            <div style={{ fontWeight: 800, marginTop: 8 }}>아직 집계할 필기 데이터가 없어요</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="op-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#8A8175', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>과목</th>
                  <th style={{ padding: '10px 12px' }}>필기 기록 수</th>
                  <th style={{ padding: '10px 12px' }}>평균 획수</th>
                  <th style={{ padding: '10px 12px' }}>평균 필기 거리(px)</th>
                  <th style={{ padding: '10px 12px' }}>평균 필기 시간</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subject} style={{ borderTop: '1px solid #EFE7DA' }}>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44,
                          height: 30, padding: '0 10px', borderRadius: 8, background: colorOf(r.subject),
                          color: '#fff', fontWeight: 800, fontSize: 13,
                        }}
                      >
                        {r.subject}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{r.records.toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>{r.avg_strokes}</td>
                    <td style={{ padding: '12px' }}>{r.avg_distance_px.toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>{(r.avg_draw_ms / 1000).toFixed(1)}초</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
