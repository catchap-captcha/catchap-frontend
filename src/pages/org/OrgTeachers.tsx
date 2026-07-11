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
  isGradeHead?: boolean;
  managedGrade?: number | null;
}

const PALETTE = [
  'linear-gradient(135deg,#8B6BFF,#B08AFF)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
  'linear-gradient(135deg,#33C892,#17B0A0)',
  'linear-gradient(135deg,#FF93BE,#FF6DA6)',
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
];

// 역할: '교사'(일반, 담당 없음)를 포함해 담임/교과/보조 중 선택. '교사'는 특정 담당이 없는
// 기본 상태로, 예전엔 이 선택지가 없어 편집 시 전원 '담임'으로 바뀌던 문제가 있었다.
// 학급 배정은 실제 존재하는 학급(GET /orgs/{id}/classes)에서 고른다 — 정적 '1-2반' 등을 쓰면
// 학급 현황(OrgClasses)에서 만든 학급과 연동이 안 돼 없는 반을 배정할 수 있다. 학생 수도 실데이터를 쓴다.
const ROLES = ['교사', '담임', '교과', '보조'];
const GRADES = [1, 2, 3, 4, 5, 6];

function parseCls(cls: string) {
  // 담당 반이 없으면(미배정) grade=0 — 1학년으로 잘못 묶이지 않게 한다.
  const m = /^(\d+)\s*-\s*(\d+)/.exec(cls || '');
  return { grade: m ? +m[1] : 0, ban: m ? +m[2] : 0 };
}

function roleClass(r: string) {
  if (r === '담임') return 'ot-roleBadge ot-roleHomeroom';
  if (r === '교과') return 'ot-roleBadge ot-roleSubject';
  if (r === '보조') return 'ot-roleBadge ot-roleAssist';
  if (r.includes('학년부장')) return 'ot-roleBadge ot-roleHead';
  return 'ot-roleBadge ot-roleTeacher'; // 교사(일반)
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
  // 학년부장 임명/해제는 교장(org_admin)만. 학년부장 본인이 이 화면을 봐도 임명 버튼은 숨김.
  const isPrincipal = me?.role === 'org_admin';

  const [teachers, setTeachers] = useState<OtTeacher[]>([]);
  // 실제 학급 목록·학생 수 — 학급 현황(OrgClasses)과 동일 소스(GET /orgs/{id}/classes).
  // 담당 학급 배정 드롭다운·삭제 차단 학생 수 계산에 쓴다(하드코딩 COUNTS 제거).
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // 담당 학급 정렬: 기본이 asc(1반→6반). 헤더 클릭으로 asc→desc→off 토글. 미배정은 항상 끝으로.
  const [clsSort, setClsSort] = useState<'off' | 'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<OtModal | null>(null);
  const [inviteModal, setInviteModal] = useState<{ email: string; name: string; role: string; cls: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [block, setBlock] = useState<OtBlock | null>(null);
  const [seq, setSeq] = useState(100);
  // 학년부장 임명 모달: 대상 교사 + 담당 학년 선택
  const [ghModal, setGhModal] = useState<{ id: string; name: string; grade: number } | null>(null);
  const [toast, setToast] = useState('');

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const appointGradeHead = () => {
    if (!ghModal) return;
    const { id, grade } = ghModal;
    setGhModal(null);
    if (!orgId) {
      // 데모(로컬)에서도 화면 반영
      setTeachers((ts) =>
        ts.map((x) =>
          x.id === id
            ? { ...x, isGradeHead: true, managedGrade: grade }
            : x.managedGrade === grade
              ? { ...x, isGradeHead: false, managedGrade: null }
              : x,
        ),
      );
      flashToast(`${grade}학년 학년부장으로 임명했어요.`);
      return;
    }
    orgApi
      .appointGradeHead(orgId, id, grade)
      .then(() => {
        setTeachers((ts) =>
          ts.map((x) =>
            x.id === id
              ? { ...x, isGradeHead: true, managedGrade: grade }
              : x.managedGrade === grade
                ? { ...x, isGradeHead: false, managedGrade: null }
                : x,
          ),
        );
        flashToast(`${grade}학년 학년부장으로 임명했어요.`);
      })
      .catch(() => flashToast('임명에 실패했어요. 다시 시도해 주세요.'));
  };

  const dismissGradeHead = (id: string) => {
    if (!orgId) {
      setTeachers((ts) => ts.map((x) => (x.id === id ? { ...x, isGradeHead: false, managedGrade: null } : x)));
      flashToast('학년부장을 해제했어요.');
      return;
    }
    orgApi
      .dismissGradeHead(orgId, id)
      .then(() => {
        setTeachers((ts) => ts.map((x) => (x.id === id ? { ...x, isGradeHead: false, managedGrade: null } : x)));
        flashToast('학년부장을 해제했어요.');
      })
      .catch(() => flashToast('해제에 실패했어요. 다시 시도해 주세요.'));
  };

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    // 실제 학급 목록·학생 수 로드 — 담당 학급 드롭다운/삭제 차단 판정에 사용
    orgApi
      .classes(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.classes;
        if (!on || !Array.isArray(list)) return;
        const names: string[] = [];
        const counts: Record<string, number> = {};
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        list.forEach((c: any) => {
          const name = c.name ?? (c.key ? `${String(c.key).replace('반', '')}반` : '');
          if (!name) return;
          names.push(name);
          counts[name] = c.count ?? c.student_count ?? 0;
        });
        setClassOptions(names);
        setClassCounts(counts);
      })
      .catch(() => {
        /* 실패 시 빈 목록 유지 — 가짜 학급/학생수를 만들지 않는다 */
      });
    orgApi
      .teachers(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.teachers;
        if (!on || !Array.isArray(list)) return;
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
            isGradeHead: !!t.is_grade_head,
            managedGrade: t.managed_grade ?? null,
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

  const openAdd = () =>
    setModal({ mode: 'add', name: '', cls: classOptions[0] ?? '', role: '담임', email: '', code: '' });

  const openInvite = () => setInviteModal({ email: '', name: '', role: 'teacher', cls: '' });
  const sendInvite = () => {
    const im = inviteModal;
    if (!im || !orgId) return;
    const email = im.email.trim();
    if (!email || !email.includes('@')) {
      flashToast('올바른 이메일을 입력해 주세요.');
      return;
    }
    if (!im.name.trim()) {
      flashToast('선생님 이름을 입력해 주세요.');
      return;
    }
    setInviteBusy(true);
    orgApi
      .inviteTeacher(orgId, {
        email,
        name: im.name.trim() || undefined,
        role: im.role,
        class_name: im.cls || undefined,
      })
      .then(() => {
        setInviteModal(null);
        flashToast(
          im.cls
            ? `초대 메일을 보냈어요. 가입하면 ${im.cls} 담임으로 자동 배정돼요.`
            : '초대 메일을 보냈어요. 링크로 가입하면 기관·코드가 자동 입력돼요.',
        );
      })
      .catch(() => flashToast('초대 발송에 실패했어요. 이메일을 확인해 주세요.'))
      .finally(() => setInviteBusy(false));
  };

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
              count: detail.count ?? detail.student_count ?? classCounts[t.cls] ?? 0,
            });
            return;
          }
          // 실패 시 로컬 판정: 담임 + 실제 학생 수>0 → 차단
          const count = classCounts[t.cls] || 0;
          if (t.role === '담임' && count > 0) {
            setBlock({ name: t.name, cls: t.cls, count });
            return;
          }
          removeLocal(id);
        });
      return;
    }
    const count = classCounts[t.cls] || 0;
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
    const email = (m.email || '').trim();
    // 백엔드 스키마에 맞춘 필드명: class_name / teacher_code, email 은 유효할 때만 전송(EmailStr)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const apiBody: any = { name, class_name: m.cls, role: m.role };
    if (email && email.includes('@')) apiBody.email = email;
    if (m.mode === 'add') {
      const code = (m.code || '').trim();
      if (!code) return;
      // 실제 학급이 없으면 배정할 수 없음 — 학급을 먼저 만들도록 안내(없는 반 배정 금지)
      if (!m.cls) {
        flashToast('먼저 학급 현황에서 학급을 만든 뒤 배정해 주세요.');
        return;
      }
      apiBody.teacher_code = code;
      const pal = PALETTE[teachers.length % PALETTE.length];
      const localId = `n${seq}`;
      setTeachers((ts) => [...ts, { id: localId, name, cls: m.cls, role: m.role, email: email || '미입력', code, years: 0, status: 'pending', avatarBg: pal }]);
      setSeq((s) => s + 1);
      setModal(null);
      if (orgId) {
        orgApi
          .addTeacher(orgId, apiBody)
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          .then((res: any) => {
            const nid = res?.teacher?.id ?? res?.id;
            if (nid) setTeachers((ts) => ts.map((x) => (x.id === localId ? { ...x, id: String(nid) } : x)));
            else throw new Error('no id');
          })
          .catch(() => {
            // 서버에 저장 안 됐으면 낙관적 행 제거 + 실제 오류 노출 (거짓 성공 금지)
            setTeachers((ts) => ts.filter((x) => x.id !== localId));
            flashToast('선생님 추가에 실패했어요. 교사 코드·이메일을 확인해 주세요.');
          });
      }
    } else {
      setTeachers((ts) =>
        ts.map((x) => (x.id === m.id ? { ...x, name, cls: m.cls, role: m.role, email: email || x.email } : x)),
      );
      setModal(null);
      if (orgId && m.id) {
        orgApi.updateTeacher(orgId, m.id, apiBody).catch(() => {
          flashToast('수정 저장에 실패했어요. 다시 시도해 주세요.');
        });
      }
    }
  };

  // 학년 필터 칩은 고정 1~6학년이 아니라 실제 교사가 배정된 학년만 노출한다(빈 학년 버튼 제거).
  // 담당 반이 없는 교사가 있으면 '미배정' 칩을 덧붙인다.
  const teacherCount = (key: string) =>
    teachers.filter((t) => {
      const g = parseCls(t.cls).grade;
      if (key === 'none') return !(g >= 1 && g <= 6);
      return String(g) === key;
    }).length;
  const gradesPresent = GRADES.filter((g) => teacherCount(String(g)) > 0);
  const chips = [{ key: 'all', label: '전체' }]
    .concat(gradesPresent.map((g) => ({ key: String(g), label: `${g}학년` })))
    .concat(teacherCount('none') > 0 ? [{ key: 'none', label: '미배정' }] : []);
  // 담당 학급 정렬 키 — 학년·반 순. 미배정(파싱 불가)은 큰 값으로 밀어 항상 끝에 둔다.
  const clsKey = (cls: string) => {
    const { grade, ban } = parseCls(cls);
    return grade >= 1 && grade <= 6 ? grade * 100 + ban : 9999;
  };
  const filtered = teachers
    .filter((t) => {
      if (filter === 'all') return true;
      const g = parseCls(t.cls).grade;
      if (filter === 'none') return !(g >= 1 && g <= 6); // 미배정
      return String(g) === filter;
    })
    .filter((t) => !search.trim() || t.name.includes(search.trim()));
  if (clsSort !== 'off') {
    filtered.sort((a, b) => {
      const ka = clsKey(a.cls);
      const kb = clsKey(b.cls);
      // 미배정은 정렬 방향과 무관하게 항상 맨 끝
      if (ka === 9999 && kb !== 9999) return 1;
      if (kb === 9999 && ka !== 9999) return -1;
      return clsSort === 'asc' ? ka - kb : kb - ka;
    });
  }

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
          <button
            className="ot-addBtn"
            onClick={openInvite}
            style={{ background: '#fff', color: '#e85b2a', border: '1.5px solid #FFD9C7' }}
          >
            <i className="ph-fill ph-paper-plane-tilt" />교사 초대
          </button>
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
              {c.key === 'all' ? teachers.length : teacherCount(c.key)}
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
              <th>
                <button
                  type="button"
                  className="ot-sortBtn"
                  onClick={() => setClsSort((s) => (s === 'off' ? 'asc' : s === 'asc' ? 'desc' : 'off'))}
                  title="담당 학급 순으로 정렬"
                >
                  담당 학급
                  <i
                    className={
                      clsSort === 'asc'
                        ? 'ph-bold ph-sort-ascending'
                        : clsSort === 'desc'
                          ? 'ph-bold ph-sort-descending'
                          : 'ph-bold ph-arrows-down-up'
                    }
                  />
                </button>
              </th>
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
                      <div className="ot-teacherName">
                        {t.name} 선생님
                        {t.isGradeHead && (
                          <span className="ot-ghBadge" title={`${t.managedGrade}학년 학년부장`}>
                            <i className="ph-fill ph-star" />
                            {t.managedGrade ? `${t.managedGrade}학년 ` : ''}학년부장
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={'ot-clsBadge' + (t.cls ? '' : ' ot-clsBadge--none')}>
                    {t.cls || '미배정'}
                  </span>
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
                  {/* 상태: 초대만 하고 아직 가입 전이면 '가입 대기', 가입했지만 담당 반이 없으면
                      '미배정', 가입 + 반 배정까지 끝났으면 '배정 완료'. */}
                  {(() => {
                    const st =
                      t.status !== 'active'
                        ? { cls: 'ot-statusPending', icon: 'ph-clock', label: '가입 대기' }
                        : t.cls
                          ? { cls: 'ot-statusActive', icon: 'ph-check-circle', label: '배정 완료' }
                          : { cls: 'ot-statusUnassigned', icon: 'ph-user-circle', label: '미배정' };
                    return (
                      <span className={`ot-statusBadge ${st.cls}`}>
                        <i className={`ph-fill ${st.icon}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </td>
                <td>
                  <div className="ot-actions">
                    {isPrincipal &&
                      (t.isGradeHead ? (
                        <button
                          className="ot-ghBtn ot-ghBtnOn"
                          title="학년부장 해제"
                          onClick={() => dismissGradeHead(t.id)}
                        >
                          <i className="ph-fill ph-star" />
                        </button>
                      ) : (
                        <button
                          className="ot-ghBtn"
                          title="학년부장 임명"
                          disabled={t.status !== 'active'}
                          onClick={() =>
                            setGhModal({ id: t.id, name: t.name, grade: parseCls(t.cls).grade || t.managedGrade || 1 })
                          }
                        >
                          <i className="ph-bold ph-star" />
                        </button>
                      ))}
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
              {classOptions.length === 0 ? (
                <div className="ot-blockInfo">
                  <i className="ph-fill ph-info" />
                  <span>
                    아직 만든 학급이 없어요. 먼저 <b>학급 현황</b>에서 학급을 만든 뒤 선생님을 배정해 주세요.
                  </span>
                </div>
              ) : (
                <div className="ot-selectWrap">
                  <select
                    className="ot-select"
                    value={modal.cls}
                    onChange={(e) => setModal((m) => (m ? { ...m, cls: e.target.value } : m))}
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {/* 기존 배정이 현재 학급 목록에 없으면(예: 해체된 반) 그 값도 유지 */}
                    {modal.cls && !classOptions.includes(modal.cls) && (
                      <option value={modal.cls}>{modal.cls}</option>
                    )}
                  </select>
                  <i className="ph-bold ph-caret-down ot-selectCaret" />
                </div>
              )}

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
                <button
                  className="ot-saveBtn"
                  onClick={saveModal}
                  disabled={modal.mode === 'add' && classOptions.length === 0}
                >
                  <i className="ph-fill ph-check" />
                  {modal.mode === 'edit' ? '저장하기' : '선생님 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 교사 초대 모달 */}
      {inviteModal && (
        <div className="ot-overlay" onClick={() => setInviteModal(null)}>
          <div className="ot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modalHead">
              <div className="ot-modalHeadIcon">
                <i className="ph-fill ph-paper-plane-tilt" />
              </div>
              <div className="ot-modalHeadText">
                <div className="ot-modalTitle">교사 초대</div>
                <div className="ot-modalSub">이메일로 초대 링크를 보내요. 링크로 가입하면 기관·코드가 자동 입력돼요.</div>
              </div>
              <button className="ot-modalClose" onClick={() => setInviteModal(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="ot-modalBody">
              <label className="ot-label">이메일</label>
              <input
                className="ot-nameInput"
                type="email"
                value={inviteModal.email}
                placeholder="teacher@example.com"
                onChange={(e) => setInviteModal((m) => (m ? { ...m, email: e.target.value } : m))}
              />

              <label className="ot-label">이름</label>
              <input
                className="ot-nameInput"
                value={inviteModal.name}
                maxLength={10}
                placeholder="예) 이수진"
                onChange={(e) => setInviteModal((m) => (m ? { ...m, name: e.target.value.slice(0, 10) } : m))}
              />

              <label className="ot-label">역할</label>
              <div className="ot-roleRow">
                {[
                  { k: 'teacher', l: '교사' },
                  { k: 'grade_head', l: '학년부장' },
                ].map(({ k, l }) => (
                  <button
                    key={k}
                    className={inviteModal.role === k ? 'ot-roleBtn ot-roleBtnOn' : 'ot-roleBtn'}
                    onClick={() => setInviteModal((m) => (m ? { ...m, role: k } : m))}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <label className="ot-label">담당 학급 <span style={{ color: '#b0a79b', fontWeight: 600 }}>(선택 — 미리 배정)</span></label>
              <select
                className="ot-nameInput"
                value={inviteModal.cls}
                onChange={(e) => setInviteModal((m) => (m ? { ...m, cls: e.target.value } : m))}
              >
                <option value="">가입 후 배정 (지금 안 정함)</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>{c} 담임</option>
                ))}
              </select>
              {inviteModal.cls && (
                <p style={{ fontSize: 12, color: '#8a8072', margin: '6px 0 0' }}>
                  이 선생님이 링크로 가입하면 <b>{inviteModal.cls} 담임</b>으로 자동 배정돼요.
                </p>
              )}

              <div className="ot-modalBtns">
                <button className="ot-cancelBtn" onClick={() => setInviteModal(null)}>취소</button>
                <button className="ot-saveBtn" onClick={sendInvite} disabled={inviteBusy}>
                  <i className="ph-fill ph-paper-plane-tilt" />
                  {inviteBusy ? '보내는 중…' : '초대 보내기'}
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

      {/* 학년부장 임명 모달 (교장 전용) */}
      {ghModal && (
        <div className="ot-overlay" onClick={() => setGhModal(null)}>
          <div className="ot-modal ot-ghModal" onClick={(e) => e.stopPropagation()}>
            <div className="ot-modalHead">
              <div className="ot-modalHeadIcon ot-ghModalIcon">
                <i className="ph-fill ph-star" />
              </div>
              <div className="ot-modalHeadText">
                <div className="ot-modalTitle">학년부장 임명</div>
                <div className="ot-modalSub">담당 학년의 반·선생님 배정을 맡깁니다</div>
              </div>
              <button className="ot-modalClose" onClick={() => setGhModal(null)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="ot-modalBody">
              <p className="ot-ghModalName">
                <b>{ghModal.name} 선생님</b>을 학년부장으로 임명해요.
              </p>
              <label className="ot-label">담당 학년</label>
              <div className="ot-selectWrap">
                <select
                  className="ot-select"
                  value={String(ghModal.grade)}
                  onChange={(e) => setGhModal((g) => (g ? { ...g, grade: +e.target.value } : g))}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={String(g)}>{g}학년</option>
                  ))}
                </select>
                <i className="ph-bold ph-caret-down ot-selectCaret" />
              </div>
              <div className="ot-blockInfo">
                <i className="ph-fill ph-info" />
                <span>학년부장은 담당 학년의 학급·학생·선생님 배정만 관리할 수 있어요. 한 학년에 한 명이며, 이미 있으면 교체됩니다.</span>
              </div>
              <div className="ot-modalBtns">
                <button className="ot-cancelBtn" onClick={() => setGhModal(null)}>취소</button>
                <button className="ot-saveBtn" onClick={appointGradeHead}>
                  <i className="ph-fill ph-check" />임명하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ot-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
    </OrgLayout>
  );
}
