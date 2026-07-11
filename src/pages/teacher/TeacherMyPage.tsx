/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { teacherApi } from '../../api/teacher';
import { settingsApi } from '../../api/settings';
import { parseServerDate } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import TeacherLayout from '../../layouts/TeacherLayout';
import './TeacherMyPage.css';
import PasswordInput from '../../components/common/PasswordInput';

/**
 * handoff `CatChap 선생님 마이페이지.dc.html` 포팅.
 * 사이드바는 TeacherLayout이 렌더 — 마이페이지 route에서 프로필 카드가 자동 강조(보라).
 * 저장된 프로필 이름/담당 학급은 profileName/profileSub로 사이드바에 실시간 반영.
 */

type TabKey = 'profile' | 'classes' | 'notif' | 'prefs' | 'security';
type NotifKey = 'complete' | 'missing' | 'risk' | 'parent' | 'weekly';
type ChannelKey = 'push' | 'email';
type PrefKey = 'period' | 'nameMode' | 'sensitivity' | 'theme';

interface Prof {
  name: string;
  role: string;
  klass: string;
  phone: string;
  email: string;
}

interface ClassRow {
  name: string;
  role: string;
  count: string;
  initial: string;
  avatarBg: string;
  roleBg: string;
  roleColor: string;
}

interface TeacherSettings {
  notif: Record<NotifKey, boolean>;
  channels: Record<ChannelKey, boolean>;
  prefs: Record<PrefKey, string>;
}

// TODO(api): teacherApi.profile() 실패 시 원본 prof 하드코딩 유지
const FALLBACK_PROF: Prof = {
  name: '이수진',
  role: '담임 교사',
  klass: '1-2반',
  phone: '010-3456-7890',
  email: 'sujin.lee@haetsal.es.kr',
};

interface OrgInfo {
  orgName: string;
  orgCode: string;
  teacherCode: string;
  codeRemainDays: number | null;
  codeExpiresAt: string;
}

// 원본 하드코딩 값 그대로 — GET /teacher/profile의 org_name/org_code/teacher_code/
// code_remain_days/code_expires_at으로 덮어씀
const FALLBACK_ORG: OrgInfo = {
  orgName: '햇살초등학교',
  orgCode: 'HS-EDU-2041',
  teacherCode: 'T-4821',
  codeRemainDays: null,
  codeExpiresAt: '2026-12-30',
};

// TODO(api): teacherApi.myClasses() 실패 시 원본 classes 하드코딩 유지
const FALLBACK_CLASSES: ClassRow[] = [
  {
    name: '1-2반',
    role: '담임',
    count: '학생 22명 · 숫자·한글 학습',
    initial: '2',
    avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)',
    roleBg: '#EDE9FF',
    roleColor: '#6A55C0',
  },
  {
    name: '1-3반',
    role: '수학 전담',
    count: '학생 24명 · 숫자 놀이터',
    initial: '3',
    avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
    roleBg: '#E6F0FF',
    roleColor: '#2168D8',
  },
];

// TODO(api): settingsApi.get() 실패 시 원본 기본값 유지
const FALLBACK_SETTINGS: TeacherSettings = {
  notif: { complete: true, missing: true, risk: true, parent: true, weekly: true },
  channels: { push: true, email: true },
  prefs: { period: 'week', nameMode: 'real', sensitivity: 'mid', theme: 'light' },
};

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: '프로필', icon: 'ph-fill ph-user' },
  { key: 'classes', label: '담당 학급', icon: 'ph-fill ph-users-three' },
  { key: 'notif', label: '알림 설정', icon: 'ph-fill ph-bell-ringing' },
  { key: 'prefs', label: '수업 환경', icon: 'ph-fill ph-sliders-horizontal' },
  { key: 'security', label: '로그인·보안', icon: 'ph-fill ph-lock-key' },
];

const NOTIF_DEFS: { key: NotifKey; title: string; desc: string; icon: string; bg: string; color: string }[] = [
  { key: 'complete', title: '학생 학습 완료', desc: '학생이 배정 과제를 마치면 알려드려요', icon: 'ph-fill ph-check-circle', bg: '#E1F5EC', color: '#17B08C' },
  { key: 'missing', title: '과제 미제출', desc: '마감까지 학습하지 않은 학생이 있을 때', icon: 'ph-fill ph-clock-countdown', bg: '#FFF3D6', color: '#F0A400' },
  { key: 'risk', title: '위험 신호 감지', desc: '부정행위 의심·비정상 조작이 감지되면', icon: 'ph-fill ph-warning', bg: '#FFECEC', color: '#FF5A4D' },
  { key: 'parent', title: '학부모 메시지', desc: '학부모가 남긴 상담·문의 알림', icon: 'ph-fill ph-chats-circle', bg: '#EDE9FF', color: '#8B6BFF' },
  { key: 'weekly', title: '주간 학급 리포트', desc: '매주 우리 반 학습 요약을 보내드려요', icon: 'ph-fill ph-chart-line-up', bg: '#E6F0FF', color: '#2E7BFF' },
];

const PREF_GROUPS: { key: PrefKey; title: string; desc: string; options: { label: string; val: string }[] }[] = [
  {
    key: 'period',
    title: '대시보드 기본 기간',
    desc: '분석 화면을 열 때 기본으로 보여줄 범위',
    options: [{ label: '주간', val: 'week' }, { label: '월간', val: 'month' }, { label: '학기', val: 'term' }],
  },
  {
    key: 'nameMode',
    title: '학생 이름 표시',
    desc: '대시보드와 리포트에 학생을 표시하는 방식',
    options: [{ label: '실명', val: 'real' }, { label: '닉네임', val: 'nick' }],
  },
  {
    key: 'sensitivity',
    title: '위험 신호 민감도',
    desc: '부정행위·비정상 조작 감지 기준',
    options: [{ label: '낮음', val: 'low' }, { label: '보통', val: 'mid' }, { label: '높음', val: 'high' }],
  },
  {
    key: 'theme',
    title: '콘솔 테마',
    desc: '관리 화면 색상 모드',
    options: [{ label: '라이트', val: 'light' }, { label: '다크', val: 'dark' }],
  },
];

export default function TeacherMyPage() {
  const { logout, reloadMe } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('profile');
  const [prof, setProf] = useState<Prof>(FALLBACK_PROF);
  const [org, setOrg] = useState<OrgInfo>(FALLBACK_ORG);
  const [classes, setClasses] = useState<ClassRow[]>(FALLBACK_CLASSES);
  const [settings, setSettings] = useState<TeacherSettings>(FALLBACK_SETTINGS);
  const [twofa, setTwofa] = useState(true);
  // TODO(api): settingsApi.get() 실패 시 원본 문구 유지
  const [device, setDevice] = useState('이 기기 · 서울 · 방금 활동');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const { toast, flash } = useToast(2200);

  useEffect(() => {
    // GET /teacher/profile: { name, email, phone, role, career_years, class_name,
    //   org_name, org_code, teacher_code, code_expires_at, code_remain_days }
    teacherApi
      .profile()
      .then((data: any) => {
        if (data && typeof data === 'object') {
          setProf((p) => ({
            name: data.name ?? p.name,
            role: data.role ?? p.role,
            klass: data.klass ?? data.class_name ?? p.klass,
            phone: data.phone ?? p.phone,
            email: data.email ?? p.email,
          }));
          setOrg((o) => ({
            orgName: data.org_name ?? o.orgName,
            orgCode: data.org_code ?? o.orgCode,
            teacherCode: data.teacher_code ?? o.teacherCode,
            codeRemainDays: data.code_remain_days != null ? Number(data.code_remain_days) : o.codeRemainDays,
            codeExpiresAt: data.code_expires_at ?? o.codeExpiresAt,
          }));
        }
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK_PROF 유지 */
      });
    teacherApi
      .myClasses()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.classes;
        if (Array.isArray(list) && list.length) {
          setClasses(
            list.map((c: any, i: number) => {
              const fb = FALLBACK_CLASSES[i % FALLBACK_CLASSES.length];
              const role = String(c.role ?? '담임');
              return {
                name: String(c.name ?? ''),
                role,
                // GET /teacher/classes는 부가 설명을 caption으로 내려줌
                count: String(c.count ?? c.caption ?? c.description ?? ''),
                initial: String(c.initial ?? [...String(c.name ?? '').replace(/반$/, '')].pop() ?? ''),
                avatarBg: String(c.avatarBg ?? c.avatar_bg ?? fb.avatarBg),
                roleBg: String(c.roleBg ?? (role === '담임' ? '#EDE9FF' : '#E6F0FF')),
                roleColor: String(c.roleColor ?? (role === '담임' ? '#6A55C0' : '#2168D8')),
              };
            }),
          );
        }
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK_CLASSES 유지 */
      });
    settingsApi
      .get()
      .then((data: any) => {
        // GET /settings/me: { settings: {notif, channels, prefs, twofa}, device }
        const src = data?.settings ?? data;
        if (src && typeof src === 'object') {
          setSettings((s) => ({
            notif: { ...s.notif, ...(src.notif ?? {}) },
            channels: { ...s.channels, ...(src.channels ?? {}) },
            prefs: { ...s.prefs, ...(src.prefs ?? {}) },
          }));
          if (src.twofa != null) setTwofa(!!src.twofa);
        }
        if (data?.device) setDevice(String(data.device));
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — FALLBACK_SETTINGS 유지 */
      });
  }, []);

  /** 원본은 변경 즉시 반영 → 변경 시점에 저장 호출 (twofa도 settings 객체에 병합해 저장) */
  const persist = (next: TeacherSettings, nextTwofa: boolean = twofa) => {
    setSettings(next);
    settingsApi.save({ ...next, twofa: nextTwofa }).catch(() => {
      /* TODO(api): 실패해도 로컬 상태는 원본 동작대로 유지 */
    });
  };

  const toggleNotif = (key: NotifKey) =>
    persist({ ...settings, notif: { ...settings.notif, [key]: !settings.notif[key] } });
  const toggleChannel = (key: ChannelKey) =>
    persist({ ...settings, channels: { ...settings.channels, [key]: !settings.channels[key] } });
  const setPref = (key: PrefKey, val: string) =>
    persist({ ...settings, prefs: { ...settings.prefs, [key]: val } });
  const toggleTwofa = () => {
    const next = !twofa;
    setTwofa(next);
    persist(settings, next);
  };

  /* ── 원본 renderVals 파생값 그대로 ── */
  const name = prof.name.trim();
  const initial = [...(name || '이')][0];
  const homeroomLabel = `${prof.klass || ''} 담임`;
  const codeRemain =
    org.codeRemainDays ??
    Math.max(0, Math.ceil((parseServerDate(org.codeExpiresAt).getTime() - Date.now()) / 86400000));
  const canChange =
    !!curPw &&
    newPw.length >= 8 &&
    /[a-zA-Z]/.test(newPw) &&
    /[0-9]/.test(newPw) &&
    newPw !== curPw &&
    newPw === confirmPw;

  const saveProfile = () => {
    teacherApi
      .saveProfile({ name: prof.name, phone: prof.phone, position: prof.role })
      .then(() => {
        /* 저장 성공 → me 갱신 → 상단/대시보드 교사 이름 즉시 반영 */
        reloadMe();
      })
      .catch(() => {
        /* TODO(api): 백엔드 미구현 — 원본과 동일하게 로컬 상태 유지 */
      });
    flash('프로필이 저장됐어요');
  };

  const changePw = async () => {
    if (!canChange) {
      flash('비밀번호 조건을 확인해 주세요');
      return;
    }
    try {
      await settingsApi.changePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      flash('비밀번호가 변경됐어요');
    } catch {
      // 서버에서 실패하면 변경됐다고 거짓 안내하지 않는다
      flash('비밀번호 변경에 실패했어요. 현재 비밀번호를 확인해 주세요');
    }
  };

  const confirmLogout = async () => {
    try {
      await settingsApi.logoutAllDevices();
    } catch {
      /* TODO(api): 백엔드 미구현 — 원본 연출(메인 이동) 유지 */
    }
    await logout();
    navigate(PATHS.HOME);
  };

  const channelDefs: { key: ChannelKey; title: string; desc: string; icon: string; bg: string; color: string }[] = [
    { key: 'push', title: '앱 푸시 알림', desc: '콘솔·모바일 알림으로 받기', icon: 'ph-fill ph-device-mobile', bg: '#EDE9FF', color: '#8B6BFF' },
    { key: 'email', title: '이메일', desc: prof.email, icon: 'ph-fill ph-envelope-simple', bg: '#E6F0FF', color: '#2E7BFF' },
  ];

  return (
    <TeacherLayout profileName={prof.name} profileSub={homeroomLabel}>
      <main className="tp-main">
        {/* HEADER */}
        <div className="tp-head">
          <h1 className="tp-title">마이페이지</h1>
          <p className="tp-subtitle">내 프로필과 담당 학급·알림·수업 환경을 관리해요</p>
        </div>

        {/* TAB BAR */}
        <div className="tp-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={'tp-tab' + (tab === t.key ? ' tp-tab-on' : '')}
            >
              <i className={t.icon} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="tp-content">
          {/* PROFILE */}
          {tab === 'profile' && (
            <div className="tp-card tp-card-26 tp-card-mb">
              <div className="tp-phead">
                <div className="tp-pavatar">{initial}</div>
                <div>
                  <div className="tp-pname">{prof.name} 선생님</div>
                  <div className="tp-pbadges">
                    <div className="tp-badge-purple">
                      <i className="ph-fill ph-chalkboard-teacher" />
                      {homeroomLabel} · {org.orgName}
                    </div>
                    <div className="tp-badge-code">
                      <i className="ph-fill ph-identification-badge" />
                      개별 코드 <span className="tp-code">{org.teacherCode}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tp-grid">
                <div className="tp-col-span">
                  <label className="tp-flabel">기관 코드</label>
                  <div className="tp-org">
                    <i className="ph-fill ph-buildings tp-org-icon" />
                    <span className="tp-org-code">{org.orgCode}</span>
                    <span className="tp-org-valid">
                      <i className="ph-fill ph-clock-countdown" />
                      유효기간 6개월 · 남은 {codeRemain}일
                    </span>
                    <span className="tp-org-school">{org.orgName}</span>
                    <span className="tp-org-cert">
                      <i className="ph-fill ph-seal-check" />
                      기관 인증됨
                    </span>
                  </div>
                </div>
                <div>
                  <label className="tp-flabel">이름</label>
                  <input
                    value={prof.name}
                    onChange={(e) => setProf((p) => ({ ...p, name: e.target.value }))}
                    className="tp-input"
                  />
                </div>
                <div>
                  <label className="tp-flabel">직책·역할</label>
                  <input
                    value={prof.role}
                    onChange={(e) => setProf((p) => ({ ...p, role: e.target.value }))}
                    className="tp-input"
                  />
                </div>
                <div>
                  <label className="tp-flabel">담당 학급</label>
                  <input
                    value={prof.klass}
                    onChange={(e) => setProf((p) => ({ ...p, klass: e.target.value }))}
                    className="tp-input"
                  />
                </div>
                <div>
                  <label className="tp-flabel">연락처</label>
                  <input
                    value={prof.phone}
                    onChange={(e) => setProf((p) => ({ ...p, phone: e.target.value }))}
                    className="tp-input"
                  />
                </div>
                <div className="tp-col-span">
                  <label className="tp-flabel">이메일</label>
                  <input
                    value={prof.email}
                    onChange={(e) => setProf((p) => ({ ...p, email: e.target.value }))}
                    className="tp-input"
                  />
                </div>
              </div>
              <div className="tp-note">
                <i className="ph-fill ph-info" />
                <span>연락처는 학부모 안내와 기관 알림을 받는 데 사용돼요. 학생에게는 공개되지 않아요.</span>
              </div>
              <div className="tp-save-row">
                <button onClick={saveProfile} className="tp-save">
                  <i className="ph-fill ph-check-circle" />
                  프로필 저장
                </button>
              </div>
            </div>
          )}

          {/* CLASSES */}
          {tab === 'classes' && (
            <div className="tp-card tp-card-22">
              <div className="tp-classes-head">
                <div>
                  <div className="tp-card-title">담당 학급</div>
                  <p className="tp-classes-desc">담임·전담 학급을 확인하고 학생 목록으로 이동해요.</p>
                </div>
                <button onClick={() => flash('학급 추가 요청을 기관에 보냈어요')} className="tp-request">
                  <i className="ph-bold ph-plus" />
                  학급 추가 요청
                </button>
              </div>
              <div className="tp-class-list">
                {classes.map((c) => (
                  <div key={c.name} className="tp-class-row">
                    <span className="tp-class-avatar" style={{ background: c.avatarBg }}>
                      {c.initial}
                    </span>
                    <div className="tp-class-body">
                      <div className="tp-class-top">
                        <span className="tp-class-name">{c.name}</span>
                        <span className="tp-class-role" style={{ background: c.roleBg, color: c.roleColor }}>
                          {c.role}
                        </span>
                      </div>
                      <div className="tp-class-count">{c.count}</div>
                    </div>
                    <Link to={PATHS.TEACHER_CLASS} className="tp-class-link">
                      학생 보기 <i className="ph-bold ph-arrow-right" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIF */}
          {tab === 'notif' && (
            <>
              <div className="tp-card tp-card-26 tp-card-mb">
                <div className="tp-card-title tp-card-title-6">받고 싶은 알림</div>
                <p className="tp-card-desc tp-card-desc-18">학급 학습 소식 중 어떤 것을 받을지 선택해요.</p>
                <div className="tp-row-list">
                  {NOTIF_DEFS.map((d) => (
                    <div key={d.key} className="tp-row">
                      <span className="tp-row-icon" style={{ background: d.bg, color: d.color }}>
                        <i className={d.icon} />
                      </span>
                      <div className="tp-row-body">
                        <div className="tp-row-title">{d.title}</div>
                        <div className="tp-row-desc">{d.desc}</div>
                      </div>
                      <button
                        onClick={() => toggleNotif(d.key)}
                        className={'tp-sw' + (settings.notif[d.key] ? ' tp-sw-on' : '')}
                      >
                        <span className="tp-dot" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tp-card tp-card-22">
                <div className="tp-card-title tp-card-title-14">받는 방법</div>
                <div className="tp-row-list">
                  {channelDefs.map((d) => (
                    <div key={d.key} className="tp-row">
                      <span className="tp-row-icon" style={{ background: d.bg, color: d.color }}>
                        <i className={d.icon} />
                      </span>
                      <div className="tp-row-body">
                        <div className="tp-row-title">{d.title}</div>
                        <div className="tp-row-desc">{d.desc}</div>
                      </div>
                      <button
                        onClick={() => toggleChannel(d.key)}
                        className={'tp-sw' + (settings.channels[d.key] ? ' tp-sw-on' : '')}
                      >
                        <span className="tp-dot" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TEACHING PREFS */}
          {tab === 'prefs' && (
            <div className="tp-card tp-card-26">
              <div className="tp-card-title tp-card-title-6">수업 환경</div>
              <p className="tp-card-desc tp-card-desc-20">대시보드와 학생 화면에 적용되는 기본값을 설정해요.</p>
              <div className="tp-pref-list">
                {PREF_GROUPS.map((g) => (
                  <div key={g.key} className="tp-pref-row">
                    <div className="tp-pref-left">
                      <div className="tp-pref-title">{g.title}</div>
                      <div className="tp-pref-desc">{g.desc}</div>
                    </div>
                    <div className="tp-seg-wrap">
                      {g.options.map((o) => (
                        <button
                          key={o.val}
                          onClick={() => setPref(g.key, o.val)}
                          className={'tp-seg' + (settings.prefs[g.key] === o.val ? ' tp-seg-on' : '')}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECURITY */}
          {tab === 'security' && (
            <>
              <div className="tp-card tp-card-26 tp-card-mb">
                <div className="tp-card-title tp-card-title-6">비밀번호 변경</div>
                <p className="tp-card-desc tp-card-desc-18">계정을 안전하게 지키려면 주기적으로 변경하세요.</p>
                <div className="tp-pw-col">
                  <div>
                    <label className="tp-flabel">현재 비밀번호</label>
                    <PasswordInput
                      value={curPw}
                      onChange={(e) => setCurPw(e.target.value)}
                      className="tp-input"
                    />
                  </div>
                  <div>
                    <label className="tp-flabel">새 비밀번호</label>
                    <PasswordInput
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="8자 이상, 숫자와 문자 포함"
                      className="tp-input"
                    />
                  </div>
                  <div>
                    <label className="tp-flabel">새 비밀번호 확인</label>
                    <PasswordInput
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="tp-input"
                    />
                  </div>
                </div>
                <div className="tp-save-row">
                  <button onClick={changePw} className={'tp-change' + (canChange ? ' tp-change-on' : '')}>
                    <i className="ph-fill ph-lock-key" />
                    비밀번호 변경
                  </button>
                </div>
              </div>
              <div className="tp-card tp-card-22">
                <div className="tp-card-title tp-card-title-14">로그인 보안</div>
                <div className="tp-sec-row tp-sec-row-mb">
                  <span className="tp-sec-icon tp-sec-icon-2fa">
                    <i className="ph-fill ph-shield-check" />
                  </span>
                  <div className="tp-row-body">
                    <div className="tp-row-title">2단계 인증</div>
                    <div className="tp-row-desc">로그인 시 인증 코드를 한 번 더 확인해요.</div>
                  </div>
                  <button onClick={toggleTwofa} className={'tp-sw' + (twofa ? ' tp-sw-on' : '')}>
                    <span className="tp-dot" />
                  </button>
                </div>
                <div className="tp-sec-row">
                  <span className="tp-sec-icon tp-sec-icon-dev">
                    <i className="ph-fill ph-devices" />
                  </span>
                  <div className="tp-row-body">
                    <div className="tp-row-title">로그인된 기기</div>
                    <div className="tp-row-desc">{device}</div>
                  </div>
                  <button onClick={() => setLogoutOpen(true)} className="tp-logout-btn">
                    모두 로그아웃
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* LOGOUT CONFIRM */}
      {logoutOpen && (
        <div onClick={() => setLogoutOpen(false)} className="tp-modal-back">
          <div onClick={(e) => e.stopPropagation()} className="tp-modal">
            <div className="tp-modal-icon">
              <i className="ph-fill ph-sign-out" />
            </div>
            <h2 className="tp-modal-title">모든 기기에서 로그아웃할까요?</h2>
            <p className="tp-modal-desc">
              로그인된 모든 기기에서 로그아웃되며, 다시 로그인해야 선생님 콘솔을 이용할 수 있어요.
            </p>
            <div className="tp-modal-actions">
              <button onClick={() => setLogoutOpen(false)} className="tp-modal-cancel">
                취소
              </button>
              <button onClick={confirmLogout} className="tp-modal-confirm">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="tp-toast">
          <i className="ph-fill ph-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </TeacherLayout>
  );
}
