import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import './OrgTeachers.css';

/** handoff `CatChap 선생님관리.dc.html` 포팅 — 선생님 관리 CRUD */

interface OtTeacher {
  id: string;
  name: string;
  cls: string;
  role: string;
  email: string;
  code: string;
  years: number;
  status: 'active' | 'pending';
  avatarBg: string;
}

const PALETTE = [
  'linear-gradient(135deg,#8B6BFF,#B08AFF)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
  'linear-gradient(135deg,#33C892,#17B0A0)',
  'linear-gradient(135deg,#FF93BE,#FF6DA6)',
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
];

const ROLES = ['담임', '교과', '보조'];
const GRADES = [1, 2, 3, 4, 5, 6];
const BANS = [1, 2, 3, 4, 5, 6];
const COUNTS: Record<string, number> = { '1-2반': 22, '2-1반': 24, '1-3반': 25, '3-2반': 27 };

// TODO(api): orgApi.teachers 실패 시 원본 하드코딩 목록 유지
const FALLBACK_TEACHERS: OtTeacher[] = [
  { id: 't1', name: '이수진', cls: '1-2반', role: '담임', email: 'sujin.lee@haetsal.kr', code: 'T-4821', years: 8, status: 'active', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
  { id: 't2', name: '박민호', cls: '2-1반', role: '담임', email: 'minho.park@haetsal.kr', code: 'T-5093', years: 5, status: 'active', avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)' },
  { id: 't3', name: '최유나', cls: '1-3반', role: '담임', email: 'yuna.choi@haetsal.kr', code: 'T-6270', years: 3, status: 'active', avatarBg: 'linear-gradient(135deg,#33C892,#17B0A0)' },
  { id: 't4', name: '정하늘', cls: '3-2반', role: '담임', email: 'haneul.jung@haetsal.kr', code: 'T-3388', years: 11, status: 'active', avatarBg: 'linear-gradient(135deg,#FF93BE,#FF6DA6)' },
  { id: 't5', name: '김서연', cls: '1-2반', role: '교과', email: 'seoyeon.kim@haetsal.kr', code: 'T-7145', years: 2, status: 'pending', avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)' },
  { id: 't6', name: '오지훈', cls: '2-1반', role: '보조', email: 'jihoon.oh@haetsal.kr', code: 'T-8802', years: 1, status: 'active', avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
];

function parseCls(cls: string) {
  const m = /^(\d+)\s*-\s*(\d+)/.exec(cls || '');
  return { grade: m ? +m[1] : 1, ban: m ? +m[2] : 1 };
}

function roleClass(r: string) {
  if (r === '담임') return 'ot-roleBadge ot-roleHomeroom';
  if (r === '교과') return 'ot-roleBadge ot-roleSubject';
  return 'ot-roleBadge ot-roleAssist';
}

interface OtModal {
  mode: 'add' | 'edit';
  id?: string;
  name: string;
  cls: string;
  role: string;
  email: string;
  code: string;
}

interface OtBlock {
  name: string;
  cls: string;
  count: number;
}

export default function OrgTeachers() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;

  const [teachers, setTeachers] = useState<OtTeacher[]>(FALLBACK_TEACHERS);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<OtModal | null>(null);
  const [block, setBlock] = useState<OtBlock | null>(null);
  const [seq, setSeq] = useState(100);

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .teachers(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.teachers;
        if (!on || !Array.isArray(list) || list.length === 0) return;
        setTeachers(
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          list.map((t: any, i: number): OtTeacher => ({
            id: String(t.id ?? `r${i}`),
            name: t.name ?? '',
            cls: t.cls ?? t.class_name ?? '',
            role: t.role ?? '담임',
            email: t.email ?? '미입력',
            code: t.code ?? t.teacher_code ?? '—',
            years: t.years ?? t.career_years ?? 0,
            status: t.status === 'pending' ? 'pending' : 'active',
            avatarBg: t.avatarBg ?? PALETTE[i % PALETTE.length],
          })),
        );
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK_TEACHERS 유지
      });
    return () => {
      on = false;
    };
  }, [orgId]);

  const openAdd = () => setModal({ mode: 'add', name: '', cls: '1-2반', role: '담임', email: '', code: '' });

  const openEdit = (id: string) => {
    const t = teachers.find((x) => x.id === id);
    if (!t) return;
    setModal({ mode: 'edit', id: t.id, name: t.name, cls: t.cls, role: t.role, email: t.email, code: t.code || '—' });
  };

  const removeLocal = (id: string) => setTeachers((ts) => ts.filter((x) => x.id !== id));

  const deleteTeacher = (id: string) => {
    const t = teachers.find((x) => x.id === id);
    if (!t) return;
    if (orgId) {
      orgApi
        .deleteTeacher(orgId, id)
        .then(() => removeLocal(id))
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        .catch((err: any) => {
          if (err?.response?.status === 409) {
            // 백엔드 409 detail: {message, count, cls} 객체 (과거엔 문자열) — 둘 다 처리
            const raw = err.response?.data?.detail ?? err.response?.data ?? {};
            const detail = typeof raw === 'string' ? { message: raw } : raw;
            setBlock({
              name: detail.name ?? t.name,
              cls: detail.cls ?? detail.class_name ?? t.cls,
              count: detail.count ?? detail.student_count ?? COUNTS[t.cls] ?? 0,
            });
            return;
          }
          // TODO(api): 실패 시 원본 로컬 로직 유지 (담임 + 학생>0 → 차단)
          const count = COUNTS[t.cls] || 0;
          if (t.role === '담임' && count > 0) {
            setBlock({ name: t.name, cls: t.cls, count });
            return;
          }
          removeLocal(id);
        });
      return;
    }
    const count = COUNTS[t.cls] || 0;
    if (t.role === '담임' && count > 0) {
      setBlock({ name: t.name, cls: t.cls, count });
      return;
    }
    removeLocal(id);
  };

  const saveModal = () => {
    const m = modal;
    if (!m) return;
    const name = (m.name || '').trim();
    if (!name) return;
    if (m.mode === 'add') {
      const code = (m.code || '').trim();
      if (!code) return;
      const body = { name, cls: m.cls, role: m.role, email: (m.email || '').trim() || '미입력', code };
      const pal = PALETTE[teachers.length % PALETTE.length];
      const localId = `n${seq}`;
      setTeachers((ts) => [...ts, { id: localId, ...body, years: 0, status: 'pending', avatarBg: pal }]);
      setSeq((s) => s + 1);
      setModal(null);
      if (orgId) {
        orgApi
          .addTeacher(orgId, body)
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          .then((res: any) => {
            if (res?.id) setTeachers((ts) => ts.map((x) => (x.id === localId ? { ...x, id: String(res.id) } : x)));
          })
          .catch(() => {
            // TODO(api): 실패 시 로컬 추가 유지 (원본 동작)
          });
      }
    } else {
      const body = { name, cls: m.cls, role: m.role, email: (m.email || '').trim() };
      setTeachers((ts) =>
        ts.map((x) => (x.id === m.id ? { ...x, name, cls: m.cls, role: m.role, email: body.email || x.email } : x)),
      );
      setModal(null);
      if (orgId && m.id) {
        orgApi.updateTeacher(orgId, m.id, body).catch(() => {
          // TODO(api): 실패 시 로컬 수정 유지 (원본 동작)
        });
      }
    }
  };

  const chips = [{ key: 'all', label: '전체' }].concat(GRADES.map((g) => ({ key: String(g), label: `${g}학년` })));
  const filtered = teachers
    .filter((t) => filter === 'all' || String(parseCls(t.cls).grade) === filter)
    .filter((t) => !search.trim() || t.name.includes(search.trim()));

  const cur = modal ? parseCls(modal.cls) : { grade: 1, ban: 1 };

  return (
    <OrgLayout active="teachers" widget="semester">
      {/* HEADER */}
      <div className="ot-header">
        <div>
          <div className="ot-breadcrumb">
            <Link to={PATHS.ORG_HOME}>기관 콘솔</Link>
            <i className="ph-bold ph-caret-right" />
            <span>선생님 관리</span>
          </div>
          <h1 className="ot-title">
            선생님 관리 <span className="ot-titleCount">{teachers.length}명</span>
          </h1>
        </div>
        <div className="ot-headerRight">
          <div className="ot-searchWrap">
            <i className="ph-bold ph-magnifying-glass ot-searchIcon" />
            <input
              className="ot-searchInput"
              placeholder="선생님 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="ot-addBtn" onClick={openAdd}>
            <i className="ph-fill ph-user-plus" />선생님 추가
          </button>
        </div>
      </div>

      {/* NEW SEMESTER NOTICE */}
      <div className="ot-notice">
        <i className="ph-fill ph-arrows-clockwise ot-noticeIcon" />
        <span className="ot-noticeText">
          새 학기마다 담임·담당 선생님이 바뀝니다. 학기 시작 전 학급별 배정을 확인하고 추가·수정·삭제해 주세요.
        </span>
      </div>

      {/* CLASS FILTER */}
      <div className="ot-chips">
        {chips.map((c) => (
          <button
            key={c.key}
            className={filter === c.key ? 'ot-chip ot-chipOn' : 'ot-chip'}
            onClick={() => setFilter(c.key)}
          >
            {c.label}{' '}
            <span className="ot-chipCount">
              {c.key === 'all' ? teachers.length : teachers.filter((t) => String(parseCls(t.cls).grade) === c.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* TEACHER TABLE */}
      <div className="ot-tableCard">
        <table className="ot-table">
          <thead>
            <tr>
              <th>선생님</th>
              <th>담당 학급</th>
              <th>역할</th>
              <th>개별 코드</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="ot-teacher">
                    <span className="ot-avatar" style={{ background: t.avatarBg }}>{[...t.name][0] || '샘'}</span>
                    <div>
                      <div className="ot-teacherName">{t.name} 선생님</div>
                      <div className="ot-teacherYears">경력 {t.years}년</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="ot-clsBadge">{t.cls}</span>
                </td>
                <td>
                  <span className={roleClass(t.role)}>{t.role}</span>
                </td>
                <td>
                  <span className="ot-codeBadge">
                    <i className="ph-fill ph-identification-badge" />
                    {t.code || '—'}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      t.status === 'active' ? 'ot-statusBadge ot-statusActive' : 'ot-statusBadge ot-statusPending'
                    }
                  >
                    <i className={t.status === 'active' ? 'ph-fill ph-check-circle' : 'ph-fill ph-clock'} />
                    {t.status === 'active' ? '배정 완료' : '승인 대기'}
                  </span>
                </td>
                <td>
                  <div className="ot-actions">
                    <button className="ot-editBtn" title="수정" onClick={() => openEdit(t.id)}>
                      <i className="ph-fill ph-pencil-simple" />
                    </button>
                    <button className="ot-deleteBtn" title="삭제" onClick={() => deleteTeacher(t.id)}>
                      <i className="ph-fill ph-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="ot-empty">
            배정된 선생님이 없어요.{' '}
            <button className="ot-emptyAdd" onClick={openAdd}>선생님 추가하기</button>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modal && (
        <div className="ot-overlay" onClick={() => setModal(null)}>
          <div className="ot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modalHead">
              <div className="ot-modalHeadIcon">
                <i className={modal.mode === 'edit' ? 'ph-fill ph-pencil-simple' : 'ph-fill ph-user-plus'} />
              </div>
              <div className="ot-modalHeadText">
                <div className="ot-modalTitle">{modal.mode === 'edit' ? '선생님 정보 수정' : '새 선생님 추가'}</div>
                <div className="ot-modalSub">학급별 담당 선생님을 배정해요</div>
              </div>
              <button className="ot-modalClose" onClick={() => setModal(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="ot-modalBody">
              <label className="ot-label">선생님 이름</label>
              <input
                className="ot-nameInput"
                value={modal.name}
                maxLength={10}
                placeholder="예) 이수진"
                onChange={(e) => setModal((m) => (m ? { ...m, name: e.target.value.slice(0, 10) } : m))}
              />

              <label className="ot-label">담당 학급</label>
              <div className="ot-selectRow">
                <div className="ot-selectWrap">
                  <select
                    className="ot-select"
                    value={String(cur.grade)}
                    onChange={(e) =>
                      setModal((m) => (m ? { ...m, cls: `${e.target.value}-${parseCls(m.cls).ban}반` } : m))
                    }
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={String(g)}>{g}학년</option>
                    ))}
                  </select>
                  <i className="ph-bold ph-caret-down ot-selectCaret" />
                </div>
                <div className="ot-selectWrap">
                  <select
                    className="ot-select"
                    value={String(cur.ban)}
                    onChange={(e) =>
                      setModal((m) => (m ? { ...m, cls: `${parseCls(m.cls).grade}-${e.target.value}반` } : m))
                    }
                  >
                    {BANS.map((b) => (
                      <option key={b} value={String(b)}>{b}반</option>
                    ))}
                  </select>
                  <i className="ph-bold ph-caret-down ot-selectCaret" />
                </div>
              </div>

              <label className="ot-label">역할</label>
              <div className="ot-roleRow">
                {ROLES.map((label) => (
                  <button
                    key={label}
                    className={modal.role === label ? 'ot-roleBtn ot-roleBtnOn' : 'ot-roleBtn'}
                    onClick={() => setModal((m) => (m ? { ...m, role: label } : m))}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="ot-label">개별 코드</label>
              {modal.mode === 'add' ? (
                <>
                  <div className="ot-codeInputWrap">
                    <i className="ph-fill ph-identification-badge ot-codeInputIcon" />
                    <input
                      className="ot-codeInput"
                      value={modal.code}
                      placeholder="예) T-4821"
                      onChange={(e) =>
                        setModal((m) => (m ? { ...m, code: e.target.value.toUpperCase().slice(0, 12) } : m))
                      }
                    />
                  </div>
                  <p className="ot-codeHint">선생님에게 발급된 개별 코드를 입력해 주세요.</p>
                </>
              ) : (
                <>
                  <div className="ot-codeLocked">
                    <i className="ph-fill ph-identification-badge" />
                    <span className="ot-codeLockedValue">{modal.code}</span>
                    <span className="ot-codeLockedBadge">
                      <i className="ph-fill ph-lock-simple" />수정 불가
                    </span>
                  </div>
                  <p className="ot-codeHint">개별 코드는 계정에 자동 발급되어 변경할 수 없어요.</p>
                </>
              )}

              <div className="ot-modalBtns">
                <button className="ot-cancelBtn" onClick={() => setModal(null)}>취소</button>
                <button className="ot-saveBtn" onClick={saveModal}>
                  <i className="ph-fill ph-check" />
                  {modal.mode === 'edit' ? '저장하기' : '선생님 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BLOCK MODAL */}
      {block && (
        <div className="ot-blockOverlay" onClick={() => setBlock(null)}>
          <div className="ot-blockModal">
            <div className="ot-blockHead">
              <div className="ot-blockHeadIcon">
                <i className="ph-fill ph-warning" />
              </div>
              <div className="ot-blockHeadText">
                <div className="ot-blockTitle">삭제할 수 없어요</div>
                <div className="ot-blockSub">담당 학생이 있는 담임 선생님이에요</div>
              </div>
            </div>
            <div className="ot-blockBody">
              <p className="ot-blockText">
                <b className="ot-blockHot">{block.name} 선생님</b>은 <b>{block.cls}</b>의 담임이에요. 이 반에는 현재{' '}
                <b className="ot-blockHot">학생 {block.count}명</b>이 있어서 바로 삭제할 수 없어요.
              </p>
              <div className="ot-blockInfo">
                <i className="ph-fill ph-info" />
                <span>먼저 학생을 다른 반으로 옮기거나, 새 담임을 배정한 뒤 삭제해 주세요.</span>
              </div>
              <button className="ot-blockOk" onClick={() => setBlock(null)}>알겠어요</button>
            </div>
          </div>
        </div>
      )}
    </OrgLayout>
  );
}
