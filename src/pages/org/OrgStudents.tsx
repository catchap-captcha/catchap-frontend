import { useEffect, useMemo, useState } from 'react';
import OrgLayout from '../../layouts/OrgLayout';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import './OrgStudents.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface StudentRow {
  id: string;
  realName: string; // 선생님이 입력한 실명(기관 화면 표시용, 학생이 별명 바꿔도 유지)
  nickname: string; // 학생이 정한 별명(게임 내 이름) — 보조 표시
  code: string; // 학생 코드(CAT-xxxx) — 동명이인 구분용 고유 번호(로그인 자격증명 아님)
  className: string;
  status: 'active' | 'pending'; // 활성 | 가입 대기(코드 미사용)
  join_code: string | null; // 1회용 가입 코드 (미가입 학생만)
  invite_code: string | null; // 학부모 초대 코드
}

// 데모 행(실제 학생 아님) 전용 예시 초대코드 — 가입코드는 서버만 발급한다(위조 금지)
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const seg = (n: number) => Array.from({ length: n }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
const genInvite = () => `LINK-${seg(4)}-${seg(4)}`;

export default function OrgStudents() {
  const { me } = useAuth();
  const [rows, setRows] = useState<StudentRow[]>([]);
  // 실제 학급 목록 — 학급 현황(OrgClasses)에서 만든 것과 동일한 소스(GET /orgs/{id}/classes).
  // 정적 하드코딩('1-2반' 등)을 쓰면 학급 현황과 연동이 안 돼 실제 만든 학급이 안 보인다.
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addClass, setAddClass] = useState('');
  const [addCount, setAddCount] = useState(1);
  const [addNames, setAddNames] = useState(''); // 학생 실명 목록 (줄바꿈 구분, 교사·기관 화면 전용)
  // 입력한 이름 순서대로의 성별(선생님 입력, 아이가 안 고름). ''=미정 → 서버엔 null로 보냄.
  const [addGenders, setAddGenders] = useState<('' | 'male' | 'female')[]>([]);
  // 발급 결과 모달 — 학생 이름 + 가입 코드(로그인 아이디는 노출 안 함)
  const [issued, setIssued] = useState<{ name: string; join_code: string }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  // 교장 비상 초기화 결과(임시비번) 또는 담임에게 넘기라는 안내 메시지
  const [resetInfo, setResetInfo] = useState<{ name: string; temp?: string; msg?: string } | null>(null);
  // 학부모 초대 코드 결과 모달(학생 코드 창처럼 복사) — 발급/재발급 공용
  const [inviteReveal, setInviteReveal] = useState<{ name: string; code: string } | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2000);
  };
  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    flash(`${label} 복사됨: ${v}`);
  };

  // 실제 학생 명단 로드 — GET /orgs/{id}/roster. 빈 기관이면 빈 배열이 그대로 반영돼 데모가 남지 않는다.
  useEffect(() => {
    const orgId = me?.organization_id;
    if (!orgId) return;
    let on = true;
    // 실제 학급 목록 로드 — 학급 현황과 동일 소스. 드롭다운·필터가 실제 만든 학급을 쓴다.
    orgApi
      .classes(orgId)
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : res?.classes;
        if (!on || !Array.isArray(arr)) return;
        const names = arr.map((c: any) => c.name ?? (c.key ? `${c.key}반` : '')).filter(Boolean);
        setClassOptions(names);
        setAddClass((prev) => prev || names[0] || '');
      })
      .catch(() => {
        /* 실패 시 빈 목록 유지 */
      });
    orgApi
      .roster(orgId)
      .then((res: any) => {
        // 응답 형태: { total, shown, students: [...] } 또는 배열
        const arr = Array.isArray(res) ? res : res?.students ?? res?.roster;
        if (!on || !Array.isArray(arr)) return;
        setRows(
          arr.map((r: any): StudentRow => {
            const status: 'active' | 'pending' = r.status === 'pending' ? 'pending' : 'active';
            return {
              id: String(r.id ?? ''),
              // 표시 이름은 실명 우선(백엔드 name = student_display_name, 실명 최우선). 별명은 보조.
              realName: r.name ?? r.nickname ?? (status === 'pending' ? '(가입 대기)' : ''),
              nickname: r.nickname ?? '',
              // 학생 코드(CAT-xxxx) — 동명이인 구분용. 활성 학생만 있고(가입 시 부여), 미가입은 빈값.
              code: status === 'active' ? (r.code ?? '') : '',
              className: r.cls ?? r.class_name ?? '',
              status,
              join_code: status === 'pending' ? (r.join_code ?? null) : null,
              invite_code: r.invite_code ?? null,
            };
          }),
        );
      })
      .catch(() => {
        /* 실패 시 빈 목록 유지 — 가짜 학생을 만들지 않는다 */
      });
    return () => {
      on = false;
    };
  }, [me?.organization_id]);

  const list = useMemo(
    () =>
      filter === 'all'
        ? rows
        : filter === '__unassigned'
          ? rows.filter((r) => !r.className) // 미배정(반 없는 학생)
          : rows.filter((r) => r.className === filter),
    [rows, filter],
  );
  const unassignedCount = useMemo(() => rows.filter((r) => !r.className).length, [rows]);
  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    pending: rows.filter((r) => r.status === 'pending').length,
  };
  // 추가 모달에서 입력한 실명(줄바꿈/쉼표 구분) — 성별 선택 행을 이 순서로 그린다.
  const parsedAddNames = addNames.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

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
      // 성별은 이름 순서(슬롯 순서)에 맞춰 전송 — 미정('')은 null. 서버가 male|female|other만 반영.
      const genders = names.length ? names.map((_, i) => addGenders[i] || null) : undefined;
      const res = await orgApi.registerStudents(orgId, {
        count: addCount,
        class_label: addClass,
        names: names.length ? names : undefined,
        genders,
      });
      const made: StudentRow[] = (res.issued ?? []).map(
        (it: { login_id: string; join_code: string; real_name?: string | null }, k: number) => ({
          id: `srv-${it.login_id}-${k}`,
          realName: it.real_name || '(이름 미입력)',
          nickname: '',
          code: '', // 학생 코드는 활성화 시 부여 — 미가입 단계엔 없음
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
      setIssued(made.map((m) => ({ name: m.realName, join_code: m.join_code! })));
    } catch {
      setCreateErr('가입 코드 발급에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setCreating(false);
    }
  };

  const isRealId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id);

  // 미가입 학생 가입 코드 재발급 — roster의 대기 행 id는 'jc-<코드id>' 형태
  const reissueCode = async (rowId: string) => {
    const orgId = me?.organization_id;
    if (!orgId) return;
    const codeId = rowId.startsWith('jc-') ? rowId.slice(3) : rowId;
    try {
      const res = await orgApi.reissueJoinCode(orgId, codeId);
      const made = (res.issued ?? []).map((it: { real_name?: string | null; join_code: string }) => ({
        name: it.real_name || '(이름 미입력)',
        join_code: it.join_code,
      }));
      if (made.length) {
        setIssued(made); // 기존 '가입 코드 발급됨' 모달 재사용해 새 코드 노출·복사
        setAddOpen(true);
        flash('새 가입 코드를 발급했어요. 옛 코드는 이제 못 써요.');
      }
    } catch {
      flash('코드 재발급에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const issueInvite = async (row: StudentRow) => {
    const orgId = me?.organization_id;
    if (orgId && isRealId(row.id)) {
      try {
        const res = await orgApi.issueInvite(orgId, row.id);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, invite_code: res.invite_code } : r)));
        // 학생 코드 창처럼 결과 모달로 노출·복사
        setInviteReveal({ name: row.realName, code: res.invite_code });
      } catch {
        // 서버가 거부(권한 없음 등)하면 가짜 코드를 보여주지 않는다 — 실제 상황 안내
        flash('초대코드 발급에 실패했어요. 담당(담임/학년부장/교장)만 발급할 수 있어요.');
      }
      return;
    }
    // 데모 행(실제 학생 아님)만 예시 코드 표시
    const code = genInvite();
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, invite_code: code } : r)));
    setInviteReveal({ name: row.realName, code });
  };
  // 학생 비번 초기화 — 원칙은 담임 교사. 교장은 '담임 없는 반'만 서버가 허용(그 외 403 안내).
  const emergencyReset = async (r: StudentRow) => {
    const orgId = me?.organization_id;
    if (!orgId || !isRealId(r.id)) {
      flash('데모 학생은 초기화할 수 없어요.');
      return;
    }
    try {
      const res = await orgApi.resetStudentPassword(orgId, r.id);
      setResetInfo({ name: r.realName, temp: res.temp_password });
    } catch (e: any) {
      // 담임이 있는 반 → 403 + "담임 X 선생님께 요청" 안내를 그대로 보여준다
      const msg = e?.response?.data?.detail || '초기화할 수 없어요. 담당 선생님에게 요청해 주세요.';
      setResetInfo({ name: r.nickname, msg });
    }
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


  return (
    <OrgLayout active="students" widget="none">
      <div className="os-wrap">
        <div className="os-head">
          <div>
            <h1 className="os-title">학생 관리</h1>
            <p className="os-sub">학교가 학생 계정을 만들고, 학생별 <b>1회용 가입 코드</b>를 배부해요. 아이는 코드로 별명·비밀번호만 정하면 가입 완료.</p>
          </div>
          <button className="os-addbtn" onClick={() => { setAddOpen(true); setIssued(null); setCreateErr(''); setAddNames(''); setAddGenders([]); }}>
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
          {classOptions.map((c) => (
            <button key={c} className={`os-chip${filter === c ? ' os-chip--on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
          {unassignedCount > 0 && (
            <button
              className={`os-chip os-chip--unassigned${filter === '__unassigned' ? ' os-chip--on' : ''}`}
              onClick={() => setFilter('__unassigned')}
            >
              미배정 {unassignedCount}
            </button>
          )}
        </div>

        <div className="os-tablecard">
          <div className="os-thead">
            <span className="os-col-name">학생</span>
            <span className="os-col-code">가입 코드</span>
            <span className="os-col-act">관리</span>
          </div>
          {list.map((r) => (
            <div key={r.id} className="os-row">
              <span className="os-col-name">
                <span className={`os-avatar os-avatar--${r.status}`}>{r.status === 'active' ? r.realName[0] || '?' : '?'}</span>
                <span className="os-name-wrap">
                  <span className="os-nick">
                    {r.realName}
                    {/* 학생이 정한 별명(게임 내 이름)은 실명 옆에 보조로 — 실명으로 식별 우선 */}
                    {r.status === 'active' && r.nickname && r.nickname !== r.realName && (
                      <span className="os-subnick">별명 {r.nickname}</span>
                    )}
                    {/* 동명이인 구분용 학생 코드(로그인 아이디 아님) */}
                    {r.code && <span className="os-subcode os-mono">{r.code}</span>}
                  </span>
                  <span className={`os-badge os-badge--${r.status}`}>{r.status === 'active' ? '가입 완료' : '가입 대기'}</span>
                  <select
                    className="os-clssel"
                    value={r.className}
                    onChange={(e) => changeClass(r.id, e.target.value)}
                    disabled={r.status === 'pending'}
                    title={r.status === 'pending' ? '가입 후 반을 옮길 수 있어요' : '반 배정/이동'}
                  >
                    {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    {!classOptions.includes(r.className) && <option value={r.className}>{r.className}</option>}
                  </select>
                </span>
              </span>
              <span className="os-col-code">
                {r.join_code ? (
                  <button className="os-code" onClick={() => copy(r.join_code!, '가입 코드')} title="복사">
                    <i className="ph-bold ph-ticket" />{r.join_code}<i className="ph-bold ph-copy os-code-copy" />
                  </button>
                ) : r.status === 'pending' ? (
                  // 코드 원문은 발급 시 1회만 볼 수 있어 재열람 불가 — 대기 상태만 표시
                  <span className="os-code-used os-code-pending" title="가입 코드는 발급 시에만 볼 수 있어요">
                    <i className="ph-fill ph-hourglass-medium" />미가입
                  </span>
                ) : (
                  <span className="os-code-used"><i className="ph-fill ph-check" />사용됨</span>
                )}
              </span>
              <span className="os-col-act">
                {/* 미가입 학생: 코드를 잊었으면 재발급(옛 코드 무효, 새 코드 1회 노출) */}
                {r.status === 'pending' && (
                  <button className="os-mini" onClick={() => reissueCode(r.id)} title="새 가입 코드 발급(옛 코드는 무효)">
                    <i className="ph-fill ph-arrows-clockwise" />코드 재발급
                  </button>
                )}
                {/* 학부모 초대·비번 초기화는 학생이 가입한 뒤에만 의미가 있다(대기 학생은 아직 계정이 없음) */}
                {r.status === 'active' && (
                  <button className="os-mini" onClick={() => issueInvite(r)} title="학부모 초대코드">
                    <i className="ph-fill ph-user-circle-plus" />{r.invite_code ? '초대코드 재발급' : '학부모 초대'}
                  </button>
                )}
                {/* 비번 초기화는 원칙적으로 담임 교사. 교장은 '담임 없는 반'만 비상 초기화(그 외 서버가 담임에게 안내) */}
                {r.status === 'active' && isRealId(r.id) && (
                  <button className="os-mini os-mini--warn" onClick={() => emergencyReset(r)} title="담임 없는 반 학생만 비상 초기화">
                    <i className="ph-fill ph-key" />비번 초기화
                  </button>
                )}
              </span>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9AA0B0', fontSize: 14 }}>
              아직 등록된 학생이 없어요. ‘학생 추가’로 계정을 만들고 가입 코드를 배부해 주세요.
            </div>
          )}
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
                {classOptions.length === 0 ? (
                  <p className="os-names-hint" style={{ color: '#E23D3D' }}>
                    <i className="ph-fill ph-warning-circle" /> 아직 만든 학급이 없어요. 먼저 <b>학급 현황</b>에서 학급을 만든 뒤 학생을 추가해 주세요.
                  </p>
                ) : (
                  <select className="os-select" value={addClass} onChange={(e) => setAddClass(e.target.value)}>
                    {classOptions.map((c) => <option key={c}>{c}</option>)}
                  </select>
                )}
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
                  onChange={(e) => {
                    setAddNames(e.target.value);
                    // 파싱된 이름 수에 맞춰 성별 배열 길이 동기화(기존 선택은 인덱스로 보존)
                    const n = e.target.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;
                    setAddGenders((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
                  }}
                />
                <p className="os-names-hint">
                  실명은 <b>선생님·기관 화면에만</b> 보여요. 학생이 닉네임을 바꿔도 선생님은 실명으로 찾을 수 있어요.
                </p>
                {parsedAddNames.length > 0 && (
                  <>
                    <label className="os-lbl">성별 (선생님이 지정 — 아이는 못 바꿔요)</label>
                    <div className="os-genderList">
                      {parsedAddNames.map((nm, i) => (
                        <div key={i} className="os-genderRow">
                          <span className="os-genderName">{nm}</span>
                          <div className="os-genderBtns">
                            {([['male', '남'], ['female', '여'], ['', '미정']] as const).map(([val, lbl]) => (
                              <button
                                key={lbl}
                                type="button"
                                className={(addGenders[i] ?? '') === val ? 'os-gBtn os-gBtnOn' : 'os-gBtn'}
                                onClick={() =>
                                  setAddGenders((g) => {
                                    const c = [...g];
                                    c[i] = val;
                                    return c;
                                  })
                                }
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {createErr && (
                  <p className="os-names-hint" style={{ color: '#E23D3D' }}>
                    <i className="ph-fill ph-warning-circle" /> {createErr}
                  </p>
                )}
                <div className="os-modal-actions">
                  <button className="os-btn-ghost" onClick={() => setAddOpen(false)} disabled={creating}>취소</button>
                  <button className="os-btn-primary" onClick={createStudents} disabled={creating || classOptions.length === 0}>
                    <i className="ph-bold ph-ticket" />{creating ? '발급 중…' : '코드 발급'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="os-modal-title"><i className="ph-fill ph-check-circle" />가입 코드 {issued.length}개 발급됨</h3>
                <p className="os-modal-sub">아래 코드를 아이에게 전달해 주세요. 코드는 <b>1회용</b>이라 가입하면 사라져요.</p>
                <div className="os-issued">
                  {issued.map((it, i) => (
                    <div key={`${it.join_code}-${i}`} className="os-issued-row">
                      <span className="os-issued-name">{it.name}</span>
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

      {/* 비번 초기화 결과 — 임시비번(비상 초기화 성공) 또는 담임에게 요청 안내 */}
      {resetInfo && (
        <div className="os-modal-bg" onClick={() => setResetInfo(null)}>
          <div className="os-modal" onClick={(e) => e.stopPropagation()}>
            {resetInfo.temp ? (
              <>
                <h3 className="os-modal-title"><i className="ph-fill ph-key" />{resetInfo.name} 비번 초기화됨</h3>
                <p className="os-modal-sub">
                  담임이 없는 반이라 <b>교장 권한으로 비상 초기화</b>했어요. 아래 임시 비밀번호를 학생에게 전달하세요.
                  학생은 다음 로그인 때 <b>새 비밀번호를 스스로 정하게</b> 됩니다. 이 초기화는 감사 기록에 남습니다.
                </p>
                <div className="os-issued">
                  <div className="os-issued-row">
                    <span className="os-mono">임시 비밀번호</span>
                    <button className="os-code" onClick={() => copy(resetInfo.temp!, '임시 비밀번호')}>
                      <i className="ph-bold ph-key" />{resetInfo.temp}<i className="ph-bold ph-copy os-code-copy" />
                    </button>
                  </div>
                </div>
                <div className="os-modal-actions">
                  <button className="os-btn-primary" onClick={() => setResetInfo(null)}>완료</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="os-modal-title"><i className="ph-fill ph-info" />담임 선생님에게 요청하세요</h3>
                <p className="os-modal-sub">{resetInfo.msg}</p>
                <div className="os-modal-actions">
                  <button className="os-btn-primary" onClick={() => setResetInfo(null)}>확인</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 학부모 초대 코드 결과 모달 (학생 코드 창처럼 복사) */}
      {inviteReveal && (
        <div className="os-modal-bg" onClick={() => setInviteReveal(null)}>
          <div className="os-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="os-modal-title"><i className="ph-fill ph-user-circle-plus" />{inviteReveal.name} 학부모 초대 코드</h3>
            <p className="os-modal-sub">
              이 코드를 학부모님께 전달하세요. 학부모 가입 화면에서 코드를 넣으면 이 학생과 연결돼요.
              <b> 최대 2회</b> 쓸 수 있고(부모 두 분), <b>14일</b> 뒤 만료됩니다.
            </p>
            <div className="os-issued">
              <div className="os-issued-row">
                <span className="os-mono">초대 코드</span>
                <button className="os-code" onClick={() => copy(inviteReveal.code, '학부모 초대 코드')}>
                  <i className="ph-bold ph-ticket" />{inviteReveal.code}<i className="ph-bold ph-copy os-code-copy" />
                </button>
              </div>
            </div>
            <div className="os-modal-actions">
              <button className="os-btn-primary" onClick={() => setInviteReveal(null)}>완료</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="os-toast"><i className="ph-fill ph-check-circle" />{toast}</div>}
    </OrgLayout>
  );
}
