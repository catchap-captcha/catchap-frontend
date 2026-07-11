/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ParentLayout, { ParentBellLink } from '../../layouts/ParentLayout';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { settingsApi } from '../../api/settings';
import { parentApi } from '../../api/parents';
import './ParentMyPage.css';

/**
 * handoff `CatChap 학부모 마이페이지.dc.html` 포팅.
 * NAV는 ParentLayout이 렌더(벨: dot 없는 링크형). 원본의 invoices(결제)는 렌더하는 탭이 없어
 * 원본 그대로 렌더하지 않는다.
 */

type TabKey = 'profile' | 'children' | 'notif' | 'security' | 'privacy';
type NotifKey = 'weekly' | 'teacher' | 'complete' | 'recommend' | 'badge';
type ChannelKey = 'push' | 'email' | 'sms';
type PrivacyKey = 'analytics' | 'marketing';

interface ProfileData {
  name: string;
  phone: string;
  email: string;
}

interface ChildItem {
  id: string | null;
  name: string;
  initial: string;
  code: string;
  cls: string;
  avatarBg: string;
  age: string;
  goal: string;
  goalMin: number | null;
  week: string;
  limitOn: boolean;
}

interface RowDef<K extends string> {
  key: K;
  title: string;
  desc: string;
  icon: string;
  bg: string;
  color: string;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'profile', label: '프로필', icon: 'ph-fill ph-user' },
  { key: 'children', label: '자녀 관리', icon: 'ph-fill ph-users-three' },
  { key: 'notif', label: '알림 설정', icon: 'ph-fill ph-bell-ringing' },
  { key: 'security', label: '로그인·보안', icon: 'ph-fill ph-lock-key' },
  { key: 'privacy', label: '개인정보 보호', icon: 'ph-fill ph-shield-check' },
];

/* 원본 캡차 타일 세트 그대로 */
const TILE_SET = [
  ['ph-fill ph-cat', 'ph-fill ph-dog', 'ph-fill ph-bird', 'ph-fill ph-cat', 'ph-fill ph-fish', 'ph-fill ph-horse', 'ph-fill ph-butterfly', 'ph-fill ph-cat', 'ph-fill ph-rabbit'],
  ['ph-fill ph-dog', 'ph-fill ph-cat', 'ph-fill ph-fish', 'ph-fill ph-cat', 'ph-fill ph-bird', 'ph-fill ph-cat', 'ph-fill ph-rabbit', 'ph-fill ph-horse', 'ph-fill ph-butterfly'],
];

const NOTIF_DEFS: RowDef<NotifKey>[] = [
  { key: 'weekly', title: '주간 리포트', desc: '매주 자녀 학습 요약을 보내드려요', icon: 'ph-fill ph-chart-line-up', bg: '#EDE6FF', color: '#8B6BFF' },
  { key: 'teacher', title: '선생님 메시지', desc: '담임 선생님이 남긴 알림', icon: 'ph-fill ph-chalkboard-teacher', bg: '#E6F0FF', color: '#2E7BFF' },
  { key: 'complete', title: '학습 완료 알림', desc: '자녀가 학습을 마치면 알려드려요', icon: 'ph-fill ph-check-circle', bg: '#E1F5EC', color: '#17B08C' },
  { key: 'recommend', title: '추천 문제 알림', desc: '맞춤 추천 문제가 준비되면', icon: 'ph-fill ph-lightbulb', bg: '#FFF1E9', color: '#FF922E' },
  { key: 'badge', title: '배지 획득 소식', desc: '자녀가 새 배지를 얻었을 때', icon: 'ph-fill ph-medal', bg: '#FFF3D6', color: '#F0A400' },
];

const CHANNEL_DEFS: RowDef<ChannelKey>[] = [
  { key: 'push', title: '앱 푸시 알림', desc: '휴대폰 알림으로 받기', icon: 'ph-fill ph-device-mobile', bg: '#EDE6FF', color: '#8B6BFF' },
  { key: 'email', title: '이메일', desc: '', icon: 'ph-fill ph-envelope-simple', bg: '#E6F0FF', color: '#2E7BFF' },
  { key: 'sms', title: '문자 메시지', desc: '', icon: 'ph-fill ph-chat-circle-text', bg: '#E1F5EC', color: '#17B08C' },
];

const PRIVACY_DEFS: RowDef<PrivacyKey>[] = [
  { key: 'analytics', title: '학습 데이터 분석 이용', desc: '맞춤 추천을 위해 학습 기록을 분석해요', icon: 'ph-fill ph-chart-donut', bg: '#EDE6FF', color: '#8B6BFF' },
  { key: 'marketing', title: '마케팅 정보 수신', desc: '새 기능과 이벤트 소식을 받아요', icon: 'ph-fill ph-megaphone-simple', bg: '#FFF1E9', color: '#FF922E' },
];

const AVATAR_BGS = [
  'linear-gradient(135deg,#FFC24B,#FF8A5B)',
  'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
];

// TODO(api): API 실패 시 원본 하드코딩 데이터 유지
const FALLBACK_PROFILE: ProfileData = {
  name: '김서연',
  phone: '010-2345-6789',
  email: 'seoyeon.k@email.com',
};

const CHILD_META: Record<string, { age: string; goal: string; goalMin: number | null; week: string }> = {
  'CAT-4823': { age: '7세', goal: '하루 15분', goalMin: 15, week: '14회 학습' },
  'CAT-6188': { age: '5세', goal: '하루 10분', goalMin: 10, week: '8회 학습' },
};

// TODO(api): settingsApi.get() 실패 시 원본 기본값 유지
const FALLBACK_NOTIF: Record<NotifKey, boolean> = { weekly: true, teacher: true, complete: true, recommend: false, badge: true };
const FALLBACK_CHANNELS: Record<ChannelKey, boolean> = { push: true, email: true, sms: false };
const FALLBACK_PRIVACY: Record<PrivacyKey, boolean> = { analytics: true, marketing: false };

export default function ParentMyPage() {
  const { me, logout, reloadMe } = useAuth();
  const navigate = useNavigate();
  const { toast, flash } = useToast();

  const [tab, setTab] = useState<TabKey>('profile');
  const [profile, setProfile] = useState<ProfileData>(FALLBACK_PROFILE);
  const [children, setChildren] = useState<ChildItem[] | null>(null); // null=로딩중, []=연결된 자녀 없음
  const [notif, setNotif] = useState(FALLBACK_NOTIF);
  const [channels, setChannels] = useState(FALLBACK_CHANNELS);
  const [privacy, setPrivacy] = useState(FALLBACK_PRIVACY);
  const [twofa, setTwofa] = useState(true);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // TODO(api): settingsApi.get() 실패 시 원본 문구 유지
  const [deviceNote, setDeviceNote] = useState('이 기기 · 서울 · 방금 활동');

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectCode, setConnectCode] = useState('');
  const [connectError, setConnectError] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [tileVariant, setTileVariant] = useState(0);
  const [captchaPicked, setCaptchaPicked] = useState<number[]>([]);
  const [captchaError, setCaptchaError] = useState(false);

  /** 서버 설정 blob(모르는 키 보존용) */
  const blobRef = useRef<any>({});
  const serverProfileRef = useRef(false);

  /* 설정 blob 로드 — 성공 시 프로필/토글 반영 */
  useEffect(() => {
    settingsApi
      .get()
      .then((data) => {
        // 응답은 {settings, device} — device는 '로그인된 기기' 표시 문구
        if (data && typeof data === 'object' && typeof data.device === 'string' && data.device) {
          setDeviceNote(data.device);
        }
        const blob = data && typeof data === 'object' && data.settings ? data.settings : data;
        if (!blob || typeof blob !== 'object') return;
        blobRef.current = blob;
        if (blob.profile && typeof blob.profile === 'object') {
          serverProfileRef.current = true;
          setProfile((p) => ({
            name: blob.profile.name ?? p.name,
            phone: blob.profile.phone ?? p.phone,
            email: blob.profile.email ?? p.email,
          }));
        }
        if (blob.notif) setNotif((n) => ({ ...n, ...blob.notif }));
        if (blob.channels) setChannels((c) => ({ ...c, ...blob.channels }));
        if (blob.privacy) setPrivacy((v) => ({ ...v, ...blob.privacy }));
        if (typeof blob.twofa === 'boolean') setTwofa(blob.twofa);
      })
      .catch(() => {
        /* TODO(api): 실패 시 원본 FALLBACK 유지 */
      });
  }, []);

  /* 로그인 사용자 정보 — 설정 blob에 저장된 프로필이 없을 때만 반영 */
  useEffect(() => {
    if (!me || serverProfileRef.current) return;
    setProfile((p) => ({
      ...p,
      name: me.name || p.name,
      email: me.email ?? p.email,
      phone: me.phone ?? p.phone,
    }));
  }, [me]);

  const childLoaded = children !== null;
  const childList = children ?? [];

  /* 자녀 목록 + 자녀별 설정(목표/시간제한) 로드 — 자녀 연결 후에도 재사용 */
  const fetchChildren = useCallback(async (): Promise<ChildItem[] | null> => {
    const rows = await parentApi.children();
    if (!Array.isArray(rows)) return null;
    const base = rows.map((r: any, i: number) => {
      const code = r.student_code ?? '';
      const meta = CHILD_META[code] ?? { age: '', goal: '-', goalMin: null, week: '-' };
      const name = r.nickname ?? '';
      return {
        id: r.id ?? null,
        name,
        initial: [...(name || '학')][0],
        code,
        cls: r.class_name ?? '',
        avatarBg: AVATAR_BGS[i % AVATAR_BGS.length],
        age: r.age != null ? `${r.age}세` : meta.age,
        goal: r.daily_goal != null ? `하루 ${r.daily_goal}분` : meta.goal,
        goalMin: r.daily_goal ?? meta.goalMin,
        week: r.week_count ? `${r.week_count} 학습` : meta.week,
        limitOn: !!r.time_limit_enabled,
      } as ChildItem;
    });
    return Promise.all(
      base.map((c) =>
        c.id
          ? parentApi
              .childSettings(c.id)
              .then((s: any) => ({
                ...c,
                goal: s?.daily_goal != null ? `하루 ${s.daily_goal}분` : c.goal,
                goalMin: s?.daily_goal ?? c.goalMin,
                limitOn: s?.time_limit_enabled != null ? !!s.time_limit_enabled : c.limitOn,
              }))
              .catch(() => c)
          : Promise.resolve(c),
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchChildren()
      .then((detailed) => {
        if (!cancelled) setChildren(detailed ?? []); // 미연동/실패 시 데모 대신 빈 목록
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchChildren]);

  /** 설정 blob 병합 저장 (settings/me) */
  const persistBlob = (patch: Record<string, any>) => {
    const blob = { ...blobRef.current, profile, notif, channels, privacy, twofa, ...patch };
    blobRef.current = blob;
    return settingsApi.save(blob);
  };

  const saveProfile = () => {
    // 이름/연락처는 users 실테이블에 반영 → me 갱신으로 상단 표시 이름 즉시 갱신
    const profilePatch = parentApi
      .updateProfile({ name: profile.name, phone: profile.phone })
      .then(() => reloadMe());
    Promise.all([persistBlob({ profile }), profilePatch])
      .then(() => flash('프로필이 저장됐어요'))
      .catch(() => flash('프로필 저장에 실패했어요')); // TODO(api)
  };

  const toggleNotif = (k: NotifKey) => {
    const next = { ...notif, [k]: !notif[k] };
    setNotif(next);
    persistBlob({ notif: next }).catch(() => {
      /* TODO(api): 저장 실패해도 원본처럼 로컬 상태 유지 */
    });
  };
  const toggleChannel = (k: ChannelKey) => {
    const next = { ...channels, [k]: !channels[k] };
    setChannels(next);
    persistBlob({ channels: next }).catch(() => {
      /* TODO(api) */
    });
  };
  const togglePrivacy = (k: PrivacyKey) => {
    const next = { ...privacy, [k]: !privacy[k] };
    setPrivacy(next);
    persistBlob({ privacy: next }).catch(() => {
      /* TODO(api) */
    });
  };
  const toggle2fa = () => {
    const next = !twofa;
    setTwofa(next);
    persistBlob({ twofa: next }).catch(() => {
      /* TODO(api) */
    });
  };

  const toggleChildLimit = (child: ChildItem) => {
    const nextOn = !child.limitOn;
    setChildren((cs) => (cs ?? []).map((c) => (c === child ? { ...c, limitOn: nextOn } : c)));
    if (child.id) {
      parentApi
        .saveChildSettings(child.id, { daily_goal: child.goalMin ?? 5, time_limit_enabled: nextOn })
        .catch(() => {
          /* TODO(api): 실패해도 원본처럼 로컬 상태 유지 */
        });
    }
  };

  const unlinkChild = (child: ChildItem) => {
    parentApi
      .unlink(child.id ?? child.code)
      .then(() => {
        // 서버가 실제로 해제한 뒤에만 목록에서 제거 (실패 시 목록에 남아 있는 모순 방지)
        setChildren((cs) => (cs ?? []).filter((c) => c !== child));
        flash(`${child.name} 연결을 해제했어요`);
      })
      .catch(() => {
        flash(`${child.name} 연결 해제에 실패했어요. 잠시 후 다시 시도해 주세요.`);
      });
  };

  /* 자녀 연결: 학교 발급 초대코드(LINK-XXXX-XXXX) 입력 → 실제 linkInvite 호출 */
  const connectChild = () => {
    setConnectOpen(true);
    setConnectCode('');
    setConnectError('');
  };
  const onConnectCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConnectCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14));
    setConnectError('');
  };
  const confirmConnect = () => {
    const c = connectCode.trim();
    if (!c) return;
    setConnectError('');
    parentApi
      .linkInvite(c)
      .then(() => {
        setConnectOpen(false);
        flash('자녀를 연결했어요');
        fetchChildren()
          .then((detailed) => {
            if (detailed) setChildren(detailed);
          })
          .catch(() => {});
      })
      .catch((err: any) => {
        const st = err?.response?.status;
        setConnectError(
          st === 404
            ? '초대코드가 올바르지 않아요. 다시 확인해 주세요.'
            : st === 410
              ? '만료되었거나 이미 다 사용된 초대코드예요.'
              : st === 409
                ? '이미 연결된 자녀예요.'
                : st === 429
                  ? '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
                  : '연결에 실패했어요. 초대코드를 다시 확인해 주세요.',
        );
      });
  };

  /* 비밀번호 검증 — 원본 로직 그대로 */
  const okLen = newPw.length >= 8;
  const okMix = /[a-zA-Z]/.test(newPw) && /[0-9]/.test(newPw);
  const okDiff = newPw.length > 0 && newPw !== curPw;
  const okMatch = newPw.length > 0 && newPw === confirmPw;
  let score = 0;
  if (okLen) score++;
  if (okMix) score++;
  if (newPw.length >= 12) score++;
  const strengthLabel = score >= 3 ? '강함' : score === 2 ? '보통' : '약함';
  const strengthColor = score >= 3 ? '#17B08C' : score === 2 ? '#F0A400' : '#E0475E';
  const strengthW = score >= 3 ? '100%' : score === 2 ? '62%' : '30%';
  const canChange = !!curPw && okLen && okMix && okDiff && okMatch;
  const confirmBad = confirmPw.length > 0 && newPw !== confirmPw;

  const changePw = () => {
    if (!canChange) return;
    setCaptchaOpen(true);
    setCaptchaPicked([]);
    setCaptchaError(false);
  };

  const toggleTile = (i: number) => {
    setCaptchaPicked((picked) => (picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]));
    setCaptchaError(false);
  };

  const shuffleCaptcha = () => {
    setTileVariant((v) => (v + 1) % TILE_SET.length);
    setCaptchaPicked([]);
    setCaptchaError(false);
  };

  const verifyCaptcha = () => {
    const tiles = TILE_SET[tileVariant];
    const catIdx = tiles.map((ic, i) => (ic.indexOf('ph-cat') > -1 ? i : -1)).filter((i) => i > -1);
    const picked = [...captchaPicked].sort((a, b) => a - b);
    const ok = picked.length === catIdx.length && catIdx.every((i) => picked.includes(i));
    if (!ok) {
      setCaptchaError(true);
      setCaptchaPicked([]);
      return;
    }
    settingsApi
      .changePassword(curPw, newPw)
      .then(() => {
        setCaptchaOpen(false);
        setCurPw('');
        setNewPw('');
        setConfirmPw('');
        flash('비밀번호가 변경됐어요');
      })
      .catch(() => {
        // TODO(api): 실패 시 입력값 유지(재시도 가능)
        setCaptchaOpen(false);
        flash('비밀번호 변경에 실패했어요');
      });
  };

  const logoutAll = () => {
    settingsApi
      .logoutAllDevices()
      .then(() => flash('모든 기기에서 로그아웃했어요'))
      .catch(() => flash('기기 로그아웃에 실패했어요')); // TODO(api)
  };

  const downloadData = () => {
    settingsApi
      .exportData()
      .then(() => flash('데이터 준비 요청이 접수됐어요'))
      .catch(() => {
        // 요청이 유실됐는데 접수됐다고 안내하지 않는다
        flash('데이터 준비 요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
      });
  };

  const confirmDelete = () => {
    settingsApi
      .deleteAccount()
      .then(async () => {
        setDeleteOpen(false);
        await logout();
        navigate(PATHS.HOME);
      })
      .catch((err: any) => {
        setDeleteOpen(false);
        const st = err?.response?.status;
        // 정책상 불가(권한/제약)와 일시적 오류를 구분해 안내
        if (st === 403 || st === 409) {
          flash('계정 삭제는 고객센터 확인이 필요해요. 담당자에게 문의해 주세요.');
        } else {
          flash('계정 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
  };

  const confirmLogout = async () => {
    await logout();
    navigate(PATHS.HOME);
  };

  /* 파생 표시값 — 원본 renderVals 그대로 */
  const trimmedName = profile.name.trim();
  const displayName = `${trimmedName || '학부모'} 학부모`;
  const initial = [...(trimmedName || '학')][0];
  const pwType = showPw ? 'text' : 'password';
  const eyeIcon = showPw ? 'ph-fill ph-eye-slash' : 'ph-fill ph-eye';

  const toggleRow = <K extends string>(d: RowDef<K>, on: boolean, onToggle: () => void, desc?: string) => (
    <div key={d.key} className="pm-row">
      <span className="pm-row-ico" style={{ background: d.bg, color: d.color }}>
        <i className={d.icon} />
      </span>
      <div className="pm-row-info">
        <div className="pm-row-title">{d.title}</div>
        <div className="pm-row-sub">{desc ?? d.desc}</div>
      </div>
      <button className={`pm-switch${on ? ' pm-switch--on' : ''}`} onClick={onToggle}>
        <span className="pm-knob" />
      </button>
    </div>
  );

  return (
    <ParentLayout className="pm-bg" bell={<ParentBellLink />}>
      {/* HEADER */}
      <section className="pm-header">
        <div className="pm-header-row">
          <span className="pm-header-ico">
            <i className="ph-fill ph-user-circle-gear" />
          </span>
          <div>
            <h1 className="pm-title">마이 페이지</h1>
            <p className="pm-subtitle">프로필·자녀·알림·구독 설정을 한 곳에서 관리해요</p>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="pm-body">
        {/* TAB NAV */}
        <div className="pm-tabnav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`pm-tab${tab === t.key ? ' pm-tab--on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <i className={t.icon} />
              {t.label}
            </button>
          ))}
          <Link
            to={PATHS.PARENT_MYPAGE}
            className="pm-logout-link"
            onClick={(e) => {
              e.preventDefault();
              setLogoutOpen(true);
            }}
          >
            <i className="ph-fill ph-sign-out" />
            로그아웃
          </Link>
        </div>

        {/* CONTENT */}
        <div>
          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <>
              <div className="pm-card pm-card--mb">
                <div className="pm-pro-head">
                  <div className="pm-pro-ava">{initial}</div>
                  <div>
                    <div className="pm-pro-name">{displayName}</div>
                    <div className="pm-pro-pill">
                      <i className="ph-fill ph-users-three" />
                      연결된 자녀 {childList.length}명
                    </div>
                  </div>
                </div>

                <div className="pm-form">
                  <div>
                    <label className="pm-label">이름</label>
                    <input
                      value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value.slice(0, 12) }))}
                      maxLength={12}
                      placeholder="이름을 입력해요"
                      className="pm-input pm-input--strong"
                    />
                  </div>
                  <div>
                    <label className="pm-label">휴대폰 번호</label>
                    <input
                      value={profile.phone}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="010-0000-0000"
                      className="pm-input pm-input--soft"
                    />
                  </div>
                  <div className="pm-span2">
                    <label className="pm-label">이메일</label>
                    <input
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                      placeholder="parent@email.com"
                      className="pm-input pm-input--soft"
                    />
                  </div>
                </div>

                <div className="pm-note pm-note--mt16">
                  <i className="ph-fill ph-info" />
                  <span>연락처는 선생님 알림과 상담 답변을 받는 데 사용돼요. 자녀에게는 공개되지 않아요.</span>
                </div>

                <div className="pm-actions">
                  <button className="pm-save-btn" onClick={saveProfile}>
                    <i className="ph-fill ph-check-circle" />
                    프로필 저장
                  </button>
                </div>
              </div>

              {/* linked children */}
              <div className="pm-card pm-card--sm">
                <div className="pm-card-title">연결된 자녀</div>
                <div className="pm-kids">
                  {childLoaded && childList.length === 0 && (
                    <div className="pm-kid-empty">아직 연결된 자녀가 없어요. 아래 자녀 관리에서 초대코드로 연결해 주세요.</div>
                  )}
                  {childList.map((c) => (
                    <div key={c.code} className="pm-kid">
                      <span className="pm-kid-ava" style={{ background: c.avatarBg }}>
                        {c.initial}
                      </span>
                      <div className="pm-kid-info">
                        <div className="pm-kid-name">{c.name}</div>
                        <div className="pm-kid-code">
                          {c.code} · {c.cls}
                        </div>
                      </div>
                      <span className="pm-kid-badge">
                        <i className="ph-fill ph-link" />
                        연결됨
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <>
              <div className="pm-card pm-card--mb">
                <div className="pm-sec-head">
                  <span className="pm-sec-ico">
                    <i className="ph-fill ph-lock-key" />
                  </span>
                  <h2 className="pm-sec-title">비밀번호 변경</h2>
                </div>
                <p className="pm-sec-desc">계정을 안전하게 지키려면 비밀번호를 주기적으로 바꿔주세요.</p>

                <div className="pm-pwcol">
                  <div>
                    <label className="pm-label">현재 비밀번호</label>
                    <div className="pm-pwwrap">
                      <input
                        value={curPw}
                        onChange={(e) => setCurPw(e.target.value)}
                        type={pwType}
                        placeholder="현재 비밀번호"
                        className="pm-input pm-input--pw pm-input--eye"
                      />
                      <button className="pm-eye" onClick={() => setShowPw((s) => !s)}>
                        <i className={eyeIcon} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="pm-label">새 비밀번호</label>
                    <input
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      type={pwType}
                      placeholder="8자 이상, 숫자와 문자 포함"
                      className="pm-input pm-input--pw"
                    />
                    {newPw.length > 0 && (
                      <div className="pm-strength">
                        <div className="pm-strength-bar">
                          <div className="pm-strength-fill" style={{ width: strengthW, background: strengthColor }} />
                        </div>
                        <span className="pm-strength-label" style={{ color: strengthColor }}>
                          {strengthLabel}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="pm-label">새 비밀번호 확인</label>
                    <input
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      type={pwType}
                      placeholder="새 비밀번호를 다시 입력해요"
                      className={`pm-input pm-input--pw${confirmBad ? ' pm-input--bad' : ''}`}
                    />
                    {confirmBad && (
                      <div className="pm-mismatch">
                        <i className="ph-fill ph-warning-circle" />
                        <span>비밀번호가 일치하지 않아요.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* checklist */}
                <div className="pm-rules">
                  <div className="pm-rules-title">안전한 비밀번호 조건</div>
                  <div className="pm-rules-list">
                    <div className={`pm-rule${okLen ? ' pm-rule--ok' : ''}`}>
                      <i className={okLen ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'} />
                      8자 이상
                    </div>
                    <div className={`pm-rule${okMix ? ' pm-rule--ok' : ''}`}>
                      <i className={okMix ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'} />
                      영문과 숫자 포함
                    </div>
                    <div className={`pm-rule${okDiff ? ' pm-rule--ok' : ''}`}>
                      <i className={okDiff ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'} />
                      현재 비밀번호와 다름
                    </div>
                  </div>
                </div>

                <div className="pm-actions">
                  <button
                    className="pm-ghost-btn"
                    onClick={() => {
                      setCurPw('');
                      setNewPw('');
                      setConfirmPw('');
                    }}
                  >
                    지우기
                  </button>
                  <button
                    className={`pm-change-btn ${canChange ? 'pm-change-btn--on' : 'pm-change-btn--off'}`}
                    onClick={changePw}
                  >
                    <i className="ph-fill ph-lock-key" />
                    비밀번호 변경
                  </button>
                </div>
              </div>

              {/* other security */}
              <div className="pm-card pm-card--sm">
                <div className="pm-card-title">로그인 보안</div>
                <div className="pm-row pm-row--mb10">
                  <span className="pm-row-ico" style={{ background: '#E1F5EC', color: '#17B08C' }}>
                    <i className="ph-fill ph-shield-check" />
                  </span>
                  <div className="pm-row-info">
                    <div className="pm-row-title">2단계 인증</div>
                    <div className="pm-row-sub">로그인 시 휴대폰 인증을 한 번 더 해요.</div>
                  </div>
                  <button className={`pm-switch${twofa ? ' pm-switch--on' : ''}`} onClick={toggle2fa}>
                    <span className="pm-knob" />
                  </button>
                </div>
                <div className="pm-row">
                  <span className="pm-row-ico" style={{ background: '#FFF1E9', color: '#FF922E' }}>
                    <i className="ph-fill ph-devices" />
                  </span>
                  <div className="pm-row-info">
                    <div className="pm-row-title">로그인된 기기</div>
                    <div className="pm-row-sub">{deviceNote}</div>
                  </div>
                  <button className="pm-danger-sm" onClick={logoutAll}>
                    모두 로그아웃
                  </button>
                </div>
              </div>
            </>
          )}

          {/* CHILDREN TAB */}
          {tab === 'children' && (
            <div className="pm-card">
              <div className="pm-ch-topbar">
                <div className="pm-ch-head">
                  <span className="pm-sec-ico">
                    <i className="ph-fill ph-users-three" />
                  </span>
                  <div>
                    <h2 className="pm-sec-title">자녀 관리</h2>
                    <p className="pm-ch-desc">학습 목표와 이용 시간을 자녀별로 설정해요.</p>
                  </div>
                </div>
                <button className="pm-connect-btn" onClick={connectChild}>
                  <i className="ph-bold ph-plus" />
                  자녀 연결
                </button>
              </div>
              <div className="pm-ch-list">
                {childLoaded && childList.length === 0 && (
                  <div className="pm-ch-empty">
                    <div className="pm-ch-empty-ic"><i className="ph-fill ph-users-three" /></div>
                    <div className="pm-ch-empty-title">아직 연결된 자녀가 없어요</div>
                    <div className="pm-ch-empty-text">학교에서 받은 초대코드(LINK-XXXX-XXXX)로 자녀를 연결하면 학습 목표와 이용 시간을 관리할 수 있어요.</div>
                    <button className="pm-connect-btn" onClick={connectChild}>
                      <i className="ph-bold ph-plus" /> 자녀 연결하기
                    </button>
                  </div>
                )}
                {childList.map((c) => (
                  <div key={c.code} className="pm-ch-card">
                    <div className="pm-ch-row">
                      <span className="pm-ch-ava" style={{ background: c.avatarBg }}>
                        {c.initial}
                      </span>
                      <div className="pm-ch-info">
                        <div className="pm-ch-name">
                          {c.name} · {c.age}
                        </div>
                        <div className="pm-ch-code">
                          {c.code} · {c.cls}
                        </div>
                      </div>
                      <button className="pm-danger-sm" onClick={() => unlinkChild(c)}>
                        연결 해제
                      </button>
                    </div>
                    <div className="pm-ch-stats">
                      <div className="pm-ch-stat">
                        <div className="pm-ch-stat-label">하루 학습 목표</div>
                        <div className="pm-ch-stat-val">{c.goal}</div>
                      </div>
                      <div className="pm-ch-stat">
                        <div className="pm-ch-stat-label">이번 주 학습</div>
                        <div className="pm-ch-stat-val pm-ch-stat-val--green">{c.week}</div>
                      </div>
                    </div>
                    <div className="pm-ch-limit">
                      <span className="pm-row-ico" style={{ background: '#FFF1E9', color: '#FF922E' }}>
                        <i className="ph-fill ph-timer" />
                      </span>
                      <div className="pm-row-info">
                        <div className="pm-row-title">학습 시간 제한</div>
                        <div className="pm-row-sub">
                          {c.limitOn ? '하루 30분이 지나면 잠시 쉼어요' : '제한 없이 자유롭게 학습해요'}
                        </div>
                      </div>
                      <button
                        className={`pm-switch${c.limitOn ? ' pm-switch--on' : ''}`}
                        onClick={() => toggleChildLimit(c)}
                      >
                        <span className="pm-knob" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIF TAB */}
          {tab === 'notif' && (
            <>
              <div className="pm-card pm-card--mb">
                <div className="pm-sec-head">
                  <span className="pm-sec-ico">
                    <i className="ph-fill ph-bell-ringing" />
                  </span>
                  <h2 className="pm-sec-title">받고 싶은 알림</h2>
                </div>
                <p className="pm-sec-desc pm-sec-desc--18">자녀 학습 소식 중 어떤 것을 받을지 선택해요.</p>
                <div className="pm-rows">
                  {NOTIF_DEFS.map((d) => toggleRow(d, notif[d.key], () => toggleNotif(d.key)))}
                </div>
              </div>
              <div className="pm-card pm-card--sm">
                <div className="pm-card-title">받는 방법</div>
                <div className="pm-rows">
                  {CHANNEL_DEFS.map((d) =>
                    toggleRow(
                      d,
                      channels[d.key],
                      () => toggleChannel(d.key),
                      d.key === 'email' ? profile.email : d.key === 'sms' ? profile.phone : undefined,
                    ),
                  )}
                </div>
                <div className="pm-note pm-note--mt14">
                  <i className="ph-fill ph-moon-stars" />
                  <span>밤 9시부터 아침 7시까지는 긴급 알림을 제외하고 방해하지 않아요.</span>
                </div>
              </div>
            </>
          )}

          {/* PRIVACY TAB */}
          {tab === 'privacy' && (
            <>
              <div className="pm-card pm-card--mb">
                <div className="pm-sec-head">
                  <span className="pm-sec-ico">
                    <i className="ph-fill ph-shield-check" />
                  </span>
                  <h2 className="pm-sec-title">데이터 이용 동의</h2>
                </div>
                <p className="pm-sec-desc pm-sec-desc--18">
                  동의는 언제든 바꿀 수 있어요. 필수 데이터는 서비스 제공에만 사용돼요.
                </p>
                <div className="pm-rows">
                  {PRIVACY_DEFS.map((d) => toggleRow(d, privacy[d.key], () => togglePrivacy(d.key)))}
                </div>
                <div className="pm-note pm-note--green pm-note--mt14">
                  <i className="ph-fill ph-baby" />
                  <span>만 14세 미만 자녀의 개인정보는 관련 법령에 따라 안전하게 보호돼요.</span>
                </div>
              </div>
              <div className="pm-card pm-card--sm pm-card--mb">
                <div className="pm-card-title pm-card-title--tight">내 데이터</div>
                <p className="pm-data-desc">자녀의 학습 기록을 파일로 내려받을 수 있어요.</p>
                <button className="pm-dl-btn" onClick={downloadData}>
                  <i className="ph-fill ph-download-simple" />
                  학습 데이터 내려받기
                </button>
              </div>
              <div className="pm-card pm-card--sm pm-card--danger">
                <div className="pm-danger-title">계정 삭제</div>
                <p className="pm-danger-desc">
                  계정을 삭제하면 모든 학습 기록과 자녀 연결이 영구히 사라져요. 이 작업은 되돌릴 수 없어요.
                </p>
                <button className="pm-del-btn" onClick={() => setDeleteOpen(true)}>
                  <i className="ph-fill ph-trash" />
                  계정 삭제
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* CAPTCHA MODAL */}
      {captchaOpen && (
        <div className="pm-overlay pm-overlay--captcha" onClick={() => setCaptchaOpen(false)}>
          <div className="pm-cap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-cap-head">
              <div className="pm-cap-shield">
                <i className="ph-fill ph-shield-check" />
              </div>
              <div className="pm-cap-headtxt">
                <div className="pm-cap-title">사람인지 확인해요</div>
                <div className="pm-cap-sub">CatChap 보안 확인</div>
              </div>
              <button className="pm-cap-close" onClick={() => setCaptchaOpen(false)}>
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <div className="pm-cap-body">
              <div className="pm-cap-bar">
                <span className="pm-cap-q">고양이를 모두 골라주세요 🐱</span>
                <button className="pm-cap-shuffle" title="새로고침" onClick={shuffleCaptcha}>
                  <i className="ph-bold ph-arrow-clockwise" />
                </button>
              </div>
              <div className="pm-cap-grid">
                {TILE_SET[tileVariant].map((icon, i) => {
                  const picked = captchaPicked.includes(i);
                  return (
                    <button
                      key={`${tileVariant}-${i}`}
                      className={`pm-cap-tile${picked ? ' pm-cap-tile--picked' : ''}`}
                      onClick={() => toggleTile(i)}
                    >
                      <i className={icon} />
                      {picked && (
                        <span className="pm-cap-check">
                          <i className="ph-bold ph-check" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {captchaError && (
                <div className="pm-cap-err">
                  <i className="ph-fill ph-warning-circle" />
                  <span>앗, 다시 골라볼까요? 고양이만 정확히 골라주세요.</span>
                </div>
              )}
              <button className="pm-verify-btn" onClick={verifyCaptcha}>
                <i className="ph-fill ph-check-circle" />
                확인하고 비밀번호 변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM */}
      {logoutOpen && (
        <div className="pm-overlay pm-overlay--confirm" onClick={() => setLogoutOpen(false)}>
          <div className="pm-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="pm-confirm-ico">
              <i className="ph-fill ph-sign-out" />
            </div>
            <h2 className="pm-confirm-title">로그아웃 하시겠어요?</h2>
            <p className="pm-confirm-text">로그아웃하면 다시 로그인해야 자녀 학습 정보를 볼 수 있어요.</p>
            <div className="pm-confirm-btns">
              <button className="pm-cancel-btn" onClick={() => setLogoutOpen(false)}>
                취소
              </button>
              <button className="pm-ok-btn" onClick={confirmLogout}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRM */}
      {deleteOpen && (
        <div className="pm-overlay pm-overlay--confirm" onClick={() => setDeleteOpen(false)}>
          <div className="pm-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="pm-confirm-ico pm-confirm-ico--danger">
              <i className="ph-fill ph-trash" />
            </div>
            <h2 className="pm-confirm-title">계정을 삭제하시겠어요?</h2>
            <p className="pm-confirm-text">
              계정을 삭제하면 모든 학습 기록과 자녀 연결이 영구히 사라져요. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="pm-confirm-btns">
              <button className="pm-cancel-btn" onClick={() => setDeleteOpen(false)}>
                취소
              </button>
              <button className="pm-ok-btn pm-ok-btn--danger" onClick={confirmDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONNECT CHILD MODAL */}
      {connectOpen && (
        <div className="pm-overlay pm-overlay--confirm" onClick={() => setConnectOpen(false)}>
          <div className="pm-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="pm-confirm-ico">
              <i className="ph-fill ph-link" />
            </div>
            <h2 className="pm-confirm-title">자녀 연결</h2>
            <p className="pm-confirm-text">
              학교에서 받은 초대코드(LINK-XXXX-XXXX)를 입력하면 자녀 계정이 연결돼요.
            </p>
            <input
              value={connectCode}
              onChange={onConnectCodeChange}
              placeholder="LINK-XXXX-XXXX"
              className="pm-input pm-input--strong"
              style={{ textAlign: 'center', letterSpacing: 1, margin: '4px 0 10px' }}
            />
            {connectError && (
              <div className="pm-mismatch" style={{ justifyContent: 'center', marginBottom: 8 }}>
                <i className="ph-fill ph-warning-circle" />
                <span>{connectError}</span>
              </div>
            )}
            <div className="pm-confirm-btns">
              <button className="pm-cancel-btn" onClick={() => setConnectOpen(false)}>
                취소
              </button>
              <button className="pm-ok-btn" onClick={confirmConnect}>
                연결하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="pm-toast">
          <i className="ph-fill ph-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </ParentLayout>
  );
}
