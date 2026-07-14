import { useEffect, useState } from 'react';
import { opsApi } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 운영자 연습장 필기 익명 집계 — 원본(필적)은 절대 노출하지 않고 통계만.
 * 실무 대시보드(0714 업그레이드): KPI 4종 · 14일 수집 추이 · 과목별 상세 표 ·
 * 개인정보 지표(파기/보존동의). 아동 필적은 재식별 가능 → 운영자는 원본 미열람.
 */

const SUBJECT_COLOR: Record<string, string> = {
  국어: '#FF5A4D', 영어: '#FF922E', 수학: '#17B08C', 과학: '#2E7BFF', 사회: '#8B6BFF', 생활: '#FF6DA6',
};
const colorOf = (s: string) => SUBJECT_COLOR[s] || '#8A8175';

interface Row {
  subject: string;
  records: number;
  week_records: number;
  students: number;
  avg_strokes: number;
  total_strokes: number;
  avg_distance_px: number;
  avg_draw_ms: number;
}
interface Daily {
  date: string;
  count: number;
}

function fmtSec(ms: number): string {
  const s = (ms || 0) / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초` : `${s.toFixed(1)}초`;
}

export default function OpsScratch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [total, setTotal] = useState(0);
  const [week, setWeek] = useState(0);
  const [students, setStudents] = useState(0);
  const [privacy, setPrivacy] = useState({ purged: 0, consent_retain: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(false);
    opsApi
      .scratchAggregate()
      .then((d: any) => {
        setRows(Array.isArray(d?.by_subject) ? d.by_subject : []);
        setDaily(Array.isArray(d?.daily) ? d.daily : []);
        setTotal(Number(d?.total_records) || 0);
        setWeek(Number(d?.week_records) || 0);
        setStudents(Number(d?.total_students) || 0);
        setPrivacy({
          purged: Number(d?.privacy?.purged) || 0,
          consent_retain: Number(d?.privacy?.consent_retain) || 0,
        });
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const dailyMax = Math.max(1, ...daily.map((d) => d.count));
  const avgDrawAll = rows.length
    ? rows.reduce((n, r) => n + r.avg_draw_ms * r.records, 0) / Math.max(1, total)
    : 0;

  return (
    <div className="op-root">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">필기 집계</h1>
            <p className="op-sub">
              학생들이 연습장에 쓴 풀이 필기의 익명 집계예요. 개인의 필적(원본)은 재식별 위험이
              있어 운영자에게 노출하지 않고, 통계 지표만 제공해요.
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8EE', border: '1px solid #F3E4CC',
            color: '#8A6D3B', borderRadius: 12, padding: '11px 15px', fontSize: 13, fontWeight: 600, margin: '4px 0 18px',
          }}
        >
          <i className="ph-fill ph-lock-key" />
          운영자는 원본 필기(필적)를 열람할 수 없습니다. 원본 재생은 학생 본인·기관 교사(열람 감사)에게만 허용됩니다.
        </div>

        {/* KPI */}
        <div className="op-kpis">
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--log"><i className="ph-fill ph-pencil-line" /></div>
            <div className="op-kpi-num">{total.toLocaleString()}</div>
            <div className="op-kpi-lb">수집된 필기 기록</div>
          </div>
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--stu"><i className="ph-fill ph-trend-up" /></div>
            <div className="op-kpi-num">{week.toLocaleString()}</div>
            <div className="op-kpi-lb">최근 7일 수집</div>
          </div>
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--org"><i className="ph-fill ph-users-three" /></div>
            <div className="op-kpi-num">{students.toLocaleString()}</div>
            <div className="op-kpi-lb">필기 남긴 학생(익명)</div>
          </div>
          <div className="op-kpi">
            <div className="op-kpi-ic op-kpi-ic--key"><i className="ph-fill ph-timer" /></div>
            <div className="op-kpi-num">{fmtSec(avgDrawAll)}</div>
            <div className="op-kpi-lb">평균 필기 시간</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#B0A79B' }}>불러오는 중…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#E0475E', fontWeight: 700 }}>
            집계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        ) : (
          <>
            {/* 14일 수집 추이 */}
            <div
              style={{
                background: '#fff', border: '1px solid #EFE7DA', borderRadius: 16, padding: '16px 18px 12px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 800, color: '#3A342C', fontSize: 14, marginBottom: 10 }}>
                <i className="ph-fill ph-chart-bar" style={{ color: '#2E7BFF', marginRight: 6 }} />
                최근 14일 수집 추이
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 84 }}>
                {daily.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${d.date} · ${d.count}건`}>
                    <span style={{ fontSize: 10, color: '#8A8175', fontWeight: 700 }}>{d.count > 0 ? d.count : ''}</span>
                    <div
                      style={{
                        width: '100%', maxWidth: 34, borderRadius: '6px 6px 2px 2px',
                        height: Math.max(3, Math.round((d.count / dailyMax) * 56)),
                        background: d.count > 0 ? 'linear-gradient(180deg,#4AA6FF,#2E7BFF)' : '#F1EADF',
                      }}
                    />
                    <span style={{ fontSize: 10, color: '#B0A79B' }}>{d.date.slice(5).replace('-', '/')}</span>
                  </div>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
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
              <div style={{ background: '#fff', border: '1px solid #EFE7DA', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#8A8175', fontSize: 12.5, background: '#FAF7F2' }}>
                        <th style={{ padding: '11px 14px' }}>과목</th>
                        <th style={{ padding: '11px 14px' }}>기록 수</th>
                        <th style={{ padding: '11px 14px' }}>최근 7일</th>
                        <th style={{ padding: '11px 14px' }}>학생 수(익명)</th>
                        <th style={{ padding: '11px 14px' }}>총 획수</th>
                        <th style={{ padding: '11px 14px' }}>평균 획수</th>
                        <th style={{ padding: '11px 14px' }}>평균 거리(px)</th>
                        <th style={{ padding: '11px 14px' }}>평균 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.subject} style={{ borderTop: '1px solid #F1EADF' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44,
                                height: 28, padding: '0 10px', borderRadius: 8, background: colorOf(r.subject),
                                color: '#fff', fontWeight: 800, fontSize: 13,
                              }}
                            >
                              {r.subject}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 800 }}>{r.records.toLocaleString()}</td>
                          <td style={{ padding: '11px 14px', color: r.week_records > 0 ? '#17B08C' : '#B0A79B', fontWeight: 700 }}>
                            {r.week_records > 0 ? `+${r.week_records}` : '0'}
                          </td>
                          <td style={{ padding: '11px 14px' }}>{r.students.toLocaleString()}</td>
                          <td style={{ padding: '11px 14px' }}>{r.total_strokes.toLocaleString()}</td>
                          <td style={{ padding: '11px 14px' }}>{r.avg_strokes}</td>
                          <td style={{ padding: '11px 14px' }}>{r.avg_distance_px.toLocaleString()}</td>
                          <td style={{ padding: '11px 14px' }}>{fmtSec(r.avg_draw_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 개인정보 지표 — 파기·보존동의 운영 현황 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid #EFE7DA', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: '#FDEEF0', color: '#E0475E', display: 'grid', placeItems: 'center', fontSize: 18 }}>
                  <i className="ph-fill ph-eraser" />
                </span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: '#3A342C' }}>{privacy.purged.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#8A8175', fontWeight: 700 }}>원본 파기된 기록 (탈퇴·보존만료)</div>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #EFE7DA', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: '#E7F8F1', color: '#12876C', display: 'grid', placeItems: 'center', fontSize: 18 }}>
                  <i className="ph-fill ph-shield-check" />
                </span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: '#3A342C' }}>{privacy.consent_retain.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#8A8175', fontWeight: 700 }}>보존 동의된 기록 (탈퇴 후에도 유지)</div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
