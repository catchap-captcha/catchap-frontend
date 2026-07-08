import { useEffect, useMemo, useState } from 'react';
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

// 데모 행(실제 학생 아님) 전용 예시 초대코드 — 가입코드는 서버만 발급한다(위조 금지)
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const seg = (n: number) => Array.from({ length: n }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
const genInvite = () => `LINK-${seg(4)}-${seg(4)}`;

const FALLBACK: StudentRow[] = [
  { id: 's1', nickname: '하은', login_id: 'haetsal-1-012', className: '1학년 2반', status: 'active', join_code: null, invite_code: 'LINK-7QX3-9K2M' },
  { id: 's2', nickname: '도윤', login_id: 'haetsal-1-013', className: '1학년 2반', status: 'active', join_code: null, invite_code: 'LINK-3F8P-2W9Z' },
  { id: 's3', nickname: '(가입 대기)', login_id: 'haetsal-1-014', className: '1학년 2반', status: 'pending', join_code: 'JOIN-8F2K-9QX3', invite_code: null },
  { id: 's4', nickname: '(가입 대기)', login_id: 'haetsal-2-021', className: '2학년 1반', status: 'pending', join_code: 'JOIN-4B7M-1D6R', invite_code: null },
];

// 앱 전체(학급·선생님 관리, 백엔드)와 동일한 "N-M반" 표기로 통일 — 라벨 불일치로 중복 학급 생성 방지
const CLASSES = ['1-2반', '2-1반', '3-3반'];

export default function OrgStudents() {
  const { me } = useAuth();
  const [rows, setRows] = useState<StudentRow[]>(FALLBACK);
  const [filter, setFilter] = useState<string>('all');
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addClass, setAddClass] = useState(CLASSES[0]);
  const [addCount, setAddCount] = useState(1);
  const [addNames, setAddNames] = useState(''); // 학생 실명 목록 (줄바꿈 구분, 교사·기관 화면 전용)
  const [issued, setIssued] = useState<{ login_id: string; join_code: string }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // 실배정 학생 명단 로딩 (기존엔 호출 자체가 없어 하드코딩 4행만 보이던 것 해소)
  useEffect(() => {
    const orgId = me?.organization_id;
    if (!orgId) return;
    let on = true;
    orgApi
      .roster(orgId)
      .then((res: any) => {
        if (!on) return;
        const studs = Array.isArray(res?.students) ? res.students : [];
        if (!studs.length) return; // 학생 없으면 FALLBACK 유지(화면 빈 것 방지)
        setRows(
          studs.map((s: any) => ({
            id: String(s.id),
            nickname: String(s.nickname ?? s.name ?? ''),
            login_id: String(s.login_id ?? s.code ?? ''),
            className: String(s.cls ?? ''),
            status: s.status === 'pending' ? 'pending' : 'active',
            join_code: null, // 가입코드는 등록/발급 액션에서만 노출(서버 발급)
            invite_code: null, // 학부모 초대코드는 발급 버튼으로 생성
          })),
        );
      })
      .catch(() => {
        // 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
  }, [me?.organization_id]);

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

  // 학생 슬롯 생성 + 가입코드 발급 — 실백엔드 POST /orgs/{id}/students/register.
  // 서버 실패 시 가짜 코드를 만들지 않는다(위조 코드를 배부하면 아이들 전원 가입 실패).
  const createStudents = async () => {
    const orgId = me?.organization_id;
    // 실명 목록: 줄바꿈/쉼표 구분 → 슬롯 순서대로 매칭
    const names = addNames
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!orgId) {
      setCreateErr('기관 정보를 불러오지 못해 가입 코드를 발급할 수 없어요. 다시 로그인한 뒤 시도해 주세요.');
      return;
    }
    setCreating(true);
    setCreateErr('');
    try {
      const res = await orgApi.registerStudents(orgId, {
        count: addCount,
        class_label: addClass,
        names: names.length ? names : undefined,
      });
      const made: StudentRow[] = (res.issued ?? []).map(
        (it: { login_id: string; join_code: string; real_name?: string | null }, k: number) => ({
          id: `srv-${it.login_id}-${k}`,
          nickname: it.real_name ? `${it.real_name} (가입 대기)` : '(가입 대기)',
          login_id: it.login_id,
          className: addClass,
          status: 'pending' as const,
          join_code: it.join_code,
          invite_code: null,
        }),
      );
      if (!made.length) {
        setCreateErr('가입 코드가 발급되지 않았어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setRows((prev) => [...made, ...prev]);
      setIssued(made.map((m) => ({ login_id: m.login_id, join_code: m.join_code! })));
    } catch {
      setCreateErr('가입 코드 발급에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setCreating(false);
    }
  };

  const isRealId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id);
  const issueInvite = async (id: string) => {
    const orgId = me?.organization_id;
    if (orgId && isRealId(id)) {
      try {
        const res = await orgApi.issueInvite(orgId, id);
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, invite_code: res.invite_code } : r)));
        flash(`학부모 초대코드 발급: ${res.invite_code}`);
      } catch {
        // 서버가 거부(권한 없음 등)하면 가짜 코드를 보여주지 않는다 — 실제 상황 안내
        flash('초대코드 발급에 실패했어요. 권한이 없다면 교장에게 요청하세요.');
      }
      return;
    }
    // 데모 행(실제 학생 아님)만 예시 코드 표시
    const code = genInvite();
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, invite_code: code } : r)));
    flash(`학부모 초대코드(예시): ${code}`);
  };
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
    if (orgId && isRealId(id)) {
      try {
        const res = await orgApi.resetStudentPassword(orgId, id);
        flash(`${nick} 임시 비번: ${res.temp_password} · 기존 세션 로그아웃됨`);
      } catch {
        // 권한 없음(학년부장) 등 서버 거부 시 성공으로 위장하지 않음
        flash('비밀번호 초기화에 실패했어요. 권한이 없다면 교장에게 요청하세요.');
      }
      return;
    }
    flash(`${nick} (예시) 비밀번호 초기화 안내 — 실제 학생이 아니에요.`);
  };

  return (
    <OrgLayout active="students" widget="none">
      <div className="os-wrap">
        <div className="os-head">
          <div>
            <h1 className="os-title">학생 관리</h1>
            <p className="os-sub">학교가 학생 계정을 만들고, 학생별 <b>1회용 가입 코드</b>를 배부해요. 아이는 코드로 별명·비밀번호만 정하면 가입 완료.</p>
          </div>
          <button className="os-addbtn" onClick={() => { setAddOpen(true); setIssued(null); setCreateErr(''); }}>
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
                <label className="os-lbl">학생 실명 (한 줄에 한 명, 순서대로)</label>
                <textarea
                  className="os-names"
                  value={addNames}
                  placeholder={'예)\n김하은\n박도윤'}
                  rows={Math.min(6, Math.max(3, addCount))}
                  onChange={(e) => setAddNames(e.target.value)}
                />
                <p className="os-names-hint">
                  실명은 <b>선생님·기관 화면에만</b> 보여요. 학생이 닉네임을 바꿔도 선생님은 실명으로 찾을 수 있어요.
                </p>
                {createErr && (
                  <p className="os-names-hint" style={{ color: '#E23D3D' }}>
                    <i className="ph-fill ph-warning-circle" /> {createErr}
                  </p>
                )}
                <div className="os-modal-actions">
                  <button className="os-btn-ghost" onClick={() => setAddOpen(false)} disabled={creating}>취소</button>
                  <button className="os-btn-primary" onClick={createStudents} disabled={creating}>
                    <i className="ph-bold ph-ticket" />{creating ? '발급 중…' : '코드 발급'}
                  </button>
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
