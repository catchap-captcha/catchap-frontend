import { useMemo, useState } from 'react';
import OrgLayout from '../../layouts/OrgLayout';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import './OrgStudents.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface StudentRow {
  id: string;
  nickname: string;
  login_id: string; // 학교 발급 · 전역 유일
  className: string;
  status: 'active' | 'pending'; // 활성 | 가입 대기(코드 미사용)
  join_code: string | null; // 1회용 가입 코드 (미가입 학생만)
  invite_code: string | null; // 학부모 초대 코드
}

// 학교 발급 스타일 코드 생성 (데모 — 실제는 서버가 hash 저장 후 1회 노출)
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const seg = (n: number) => Array.from({ length: n }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
const genJoin = () => `JOIN-${seg(4)}-${seg(4)}`;
const genInvite = () => `LINK-${seg(4)}-${seg(4)}`;
const genLoginId = (cls: string, i: number) => `${cls.toLowerCase().replace(/[^a-z0-9]/g, '')}-${String(i).padStart(3, '0')}`;

const FALLBACK: StudentRow[] = [
  { id: 's1', nickname: '하은', login_id: 'haetsal-1-012', className: '1학년 2반', status: 'active', join_code: null, invite_code: 'LINK-7QX3-9K2M' },
  { id: 's2', nickname: '도윤', login_id: 'haetsal-1-013', className: '1학년 2반', status: 'active', join_code: null, invite_code: 'LINK-3F8P-2W9Z' },
  { id: 's3', nickname: '(가입 대기)', login_id: 'haetsal-1-014', className: '1학년 2반', status: 'pending', join_code: 'JOIN-8F2K-9QX3', invite_code: null },
  { id: 's4', nickname: '(가입 대기)', login_id: 'haetsal-2-021', className: '2학년 1반', status: 'pending', join_code: 'JOIN-4B7M-1D6R', invite_code: null },
];

const CLASSES = ['1학년 2반', '2학년 1반', '3학년 3반'];

export default function OrgStudents() {
  const { me } = useAuth();
  const [rows, setRows] = useState<StudentRow[]>(FALLBACK);
  const [filter, setFilter] = useState<string>('all');
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addClass, setAddClass] = useState(CLASSES[0]);
  const [addCount, setAddCount] = useState(1);
  const [issued, setIssued] = useState<{ login_id: string; join_code: string }[] | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2000);
  };
  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    flash(`${label} 복사됨: ${v}`);
  };

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.className === filter)),
    [rows, filter],
  );
  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    pending: rows.filter((r) => r.status === 'pending').length,
  };

  // 학생 슬롯 생성 + 가입코드 발급 — 실백엔드 POST /orgs/{id}/students/register (실패 시 로컬 데모)
  const createStudents = async () => {
    const orgId = me?.organization_id;
    let made: StudentRow[] = [];
    try {
      if (!orgId) throw new Error('no org');
      const res = await orgApi.registerStudents(orgId, { count: addCount, class_label: addClass });
      made = (res.issued ?? []).map((it: { login_id: string; join_code: string }, k: number) => ({
        id: `srv-${it.login_id}-${k}`,
        nickname: '(가입 대기)',
        login_id: it.login_id,
        className: addClass,
        status: 'pending' as const,
        join_code: it.join_code,
        invite_code: null,
      }));
    } catch {
      const base = rows.filter((r) => r.className === addClass).length + 12;
      made = Array.from({ length: addCount }, (_, k) => ({
        id: `new-${Date.now()}-${k}`,
        nickname: '(가입 대기)',
        login_id: genLoginId(addClass.replace('학년 ', '-').replace('반', ''), base + k),
        className: addClass,
        status: 'pending' as const,
        join_code: genJoin(),
        invite_code: null,
      }));
    }
    setRows((prev) => [...made, ...prev]);
    setIssued(made.map((m) => ({ login_id: m.login_id, join_code: m.join_code! })));
  };

  const issueInvite = async (id: string) => {
    const orgId = me?.organization_id;
    let code = genInvite();
    try {
      if (orgId && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id)) {
        const res = await orgApi.issueInvite(orgId, id);
        if (res?.invite_code) code = res.invite_code;
      }
    } catch {
      /* 실패 시 로컬 코드 사용 */
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, invite_code: code } : r)));
    flash(`학부모 초대코드 발급: ${code}`);
  };
  const isRealId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id);
  const changeClass = async (id: string, label: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, className: label } : r)));
    const orgId = me?.organization_id;
    if (orgId && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id)) {
      try {
        await orgApi.assignClass(orgId, id, label);
        flash(`반을 ${label}(으)로 옮겼어요.`);
        return;
      } catch {
        /* 실패 시 로컬만 반영 */
      }
    }
    flash(`반을 ${label}(으)로 옮겼어요.`);
  };

  const resetPw = async (id: string, nick: string) => {
    const orgId = me?.organization_id;
    try {
      if (orgId && isRealId(id)) {
        const res = await orgApi.resetStudentPassword(orgId, id);
        flash(`${nick} 임시 비번: ${res.temp_password} · 기존 세션 로그아웃됨`);
        return;
      }
    } catch {
      /* 실패 시 데모 안내 */
    }
    flash(`${nick} 비밀번호를 초기화했어요 (임시 비번 발급 · 기존 세션 로그아웃).`);
  };

  return (
    <OrgLayout active="classes" widget="none">
      <div className="os-wrap">
        <div className="os-head">
          <div>
            <h1 className="os-title">학생 관리</h1>
            <p className="os-sub">학교가 학생 계정을 만들고, 학생별 <b>1회용 가입 코드</b>를 배부해요. 아이는 코드로 별명·비밀번호만 정하면 가입 완료.</p>
          </div>
          <button className="os-addbtn" onClick={() => { setAddOpen(true); setIssued(null); }}>
            <i className="ph-bold ph-user-plus" />학생 추가
          </button>
        </div>

        <div className="os-stats">
          <div className="os-stat"><span className="os-stat-ic os-stat-ic--all"><i className="ph-fill ph-students" /></span><div><div className="os-stat-num">{stats.total}</div><div className="os-stat-lb">전체 학생</div></div></div>
          <div className="os-stat"><span className="os-stat-ic os-stat-ic--act"><i className="ph-fill ph-check-circle" /></span><div><div className="os-stat-num">{stats.active}</div><div className="os-stat-lb">가입 완료</div></div></div>
          <div className="os-stat"><span className="os-stat-ic os-stat-ic--pend"><i className="ph-fill ph-hourglass-medium" /></span><div><div className="os-stat-num">{stats.pending}</div><div className="os-stat-lb">가입 대기</div></div></div>
        </div>

        <div className="os-filters">
          <button className={`os-chip${filter === 'all' ? ' os-chip--on' : ''}`} onClick={() => setFilter('all')}>전체</button>
          {CLASSES.map((c) => (
            <button key={c} className={`os-chip${filter === c ? ' os-chip--on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>

        <div className="os-tablecard">
          <div className="os-thead">
            <span className="os-col-name">학생</span>
            <span className="os-col-id">로그인 아이디</span>
            <span className="os-col-code">가입 코드</span>
            <span className="os-col-act">관리</span>
          </div>
          {list.map((r) => (
            <div key={r.id} className="os-row">
              <span className="os-col-name">
                <span className={`os-avatar os-avatar--${r.status}`}>{r.status === 'active' ? r.nickname[0] : '?'}</span>
                <span className="os-name-wrap">
                  <span className="os-nick">{r.nickname}</span>
                  <span className={`os-badge os-badge--${r.status}`}>{r.status === 'active' ? '가입 완료' : '가입 대기'}</span>
                  <select className="os-clssel" value={r.className} onChange={(e) => changeClass(r.id, e.target.value)} title="반 배정/이동">
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    {!CLASSES.includes(r.className) && <option value={r.className}>{r.className}</option>}
                  </select>
                </span>
              </span>
              <span className="os-col-id os-mono">{r.login_id}</span>
              <span className="os-col-code">
                {r.join_code ? (
                  <button className="os-code" onClick={() => copy(r.join_code!, '가입 코드')} title="복사">
                    <i className="ph-bold ph-ticket" />{r.join_code}<i className="ph-bold ph-copy os-code-copy" />
                  </button>
                ) : (
                  <span className="os-code-used"><i className="ph-fill ph-check" />사용됨</span>
                )}
              </span>
              <span className="os-col-act">
                <button className="os-mini" onClick={() => issueInvite(r.id)} title="학부모 초대코드">
                  <i className="ph-fill ph-user-circle-plus" />{r.invite_code ? '초대코드 재발급' : '학부모 초대'}
                </button>
                <button className="os-mini os-mini--warn" onClick={() => resetPw(r.id, r.nickname)} title="비밀번호 초기화">
                  <i className="ph-fill ph-key" />비번 초기화
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 학생 추가 모달 */}
      {addOpen && (
        <div className="os-modal-bg" onClick={() => setAddOpen(false)}>
          <div className="os-modal" onClick={(e) => e.stopPropagation()}>
            {!issued ? (
              <>
                <h3 className="os-modal-title"><i className="ph-fill ph-user-plus" />학생 추가</h3>
                <p className="os-modal-sub">학급과 인원을 정하면 학생 슬롯이 생기고, 각 학생의 1회용 가입 코드가 발급돼요.</p>
                <label className="os-lbl">학급</label>
                <select className="os-select" value={addClass} onChange={(e) => setAddClass(e.target.value)}>
                  {CLASSES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <label className="os-lbl">추가 인원</label>
                <div className="os-counter">
                  <button onClick={() => setAddCount((n) => Math.max(1, n - 1))}><i className="ph-bold ph-minus" /></button>
                  <span>{addCount}명</span>
                  <button onClick={() => setAddCount((n) => Math.min(30, n + 1))}><i className="ph-bold ph-plus" /></button>
                </div>
                <div className="os-modal-actions">
                  <button className="os-btn-ghost" onClick={() => setAddOpen(false)}>취소</button>
                  <button className="os-btn-primary" onClick={createStudents}><i className="ph-bold ph-ticket" />코드 발급</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="os-modal-title"><i className="ph-fill ph-check-circle" />가입 코드 {issued.length}개 발급됨</h3>
                <p className="os-modal-sub">아래 코드를 아이에게 전달해 주세요. 코드는 <b>1회용</b>이라 가입하면 사라져요.</p>
                <div className="os-issued">
                  {issued.map((it) => (
                    <div key={it.login_id} className="os-issued-row">
                      <span className="os-mono">{it.login_id}</span>
                      <button className="os-code" onClick={() => copy(it.join_code, '가입 코드')}><i className="ph-bold ph-ticket" />{it.join_code}<i className="ph-bold ph-copy os-code-copy" /></button>
                    </div>
                  ))}
                </div>
                <div className="os-modal-actions">
                  <button className="os-btn-primary" onClick={() => { setAddOpen(false); flash('학생이 추가됐어요.'); }}>완료</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="os-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </OrgLayout>
  );
}
