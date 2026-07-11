/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { teacherApi } from '../../api/teacher';
import { useToast } from '../../hooks/useToast';
import TeacherLayout from '../../layouts/TeacherLayout';
import './FamilyNotice.css';
import { parseServerDate } from '../../utils/format';

/**
 * handoff `CatChap 가정안내.dc.html` 포팅.
 * 사이드바는 TeacherLayout이 렌더(활성 메뉴: 가정 안내 — route 기준 자동).
 */

interface Student {
  id: string;
  name: string;
  parent: string;
  linked: boolean;
  avatarBg: string;
}

interface SentMessage {
  recipient: string;
  initial: string;
  avatarBg: string;
  body: string;
  time: string;
  status: 'read' | 'sent';
}

// TODO(api): teacherApi.myClassStudents() 실패 시 원본 하드코딩 학생 목록 유지
const FALLBACK_STUDENTS: Student[] = [
  { id: 's1', name: '김하은', parent: '김민정 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)' },
  { id: 's2', name: '박도윤', parent: '박정호 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)' },
  { id: 's3', name: '최서아', parent: '최은영 학부모', linked: false, avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
  { id: 's4', name: '김하람', parent: '김성우 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)' },
  { id: 's5', name: '이준서', parent: '이지훈 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#33C892,#17B0A0)' },
  { id: 's6', name: '정유나', parent: '정혜수 학부모', linked: false, avatarBg: 'linear-gradient(135deg,#FF93BE,#FF6DA6)' },
  { id: 's7', name: '강시우', parent: '강태현 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)' },
  { id: 's8', name: '윤아린', parent: '윤소라 학부모', linked: true, avatarBg: 'linear-gradient(135deg,#8B6BFF,#B08AFF)' },
];

// TODO(api): teacherApi.familyMessages() 실패 시 원본 발송 이력 유지
const FALLBACK_SENT: SentMessage[] = [
  {
    recipient: '김민정 학부모',
    initial: '하',
    avatarBg: 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
    body: '하은이가 오늘 숫자 놀이터를 끝까지 잘 해냈어요. 집에서도 칭찬 많이 해주세요!',
    time: '1시간 전',
    status: 'read',
  },
  {
    recipient: '강태현 학부모',
    initial: '시',
    avatarBg: 'linear-gradient(135deg,#4AA6FF,#2E7BFF)',
    body: '내일 준비물을 안내드려요: 색연필, 가위, 풀',
    time: '어제',
    status: 'sent',
  },
];

/** API created_at(ISO) → '방금 전/N분 전/N시간 전/어제/N일 전' 상대 시각 */
function koreanAgo(iso: string): string {
  // 서버는 KST naive 문자열 — parseServerDate로 절대시각 고정
  const t = parseServerDate(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return day === 1 ? '어제' : `${day}일 전`;
}

/* 원본 TEMPLATES 그대로 (OO → 선택 학생 이름 치환) */
const TEMPLATES = [
  { label: '칭찬', icon: 'ph-fill ph-star', text: '오늘 OO(이)가 수업에 아주 적극적으로 참여했어요. 집에서도 많이 칭찬해 주세요!' },
  { label: '결석 문의', icon: 'ph-fill ph-calendar-x', text: '오늘 OO(이)가 등원하지 않았어요. 특별한 일이 있는지 확인 부탁드려요.' },
  { label: '준비물', icon: 'ph-fill ph-backpack', text: '내일 OO 준비물을 안내드려요: ' },
  { label: '상담 요청', icon: 'ph-fill ph-chats-circle', text: 'OO 학습에 대해 잠깐 상담을 나누고 싶어요. 편하신 시간을 알려주시면 감사하겠습니다.' },
];

export default function FamilyNotice() {
  const [students, setStudents] = useState<Student[]>(FALLBACK_STUDENTS);
  const [selectedIds, setSelectedIds] = useState<string[]>(['s2']);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<SentMessage[]>(FALLBACK_SENT);
  // 학생 명단이 서버에서 실제로 왔는지 — 실패/미로딩 시 가짜(FALLBACK) 명단으로 발송 방지
  const [rosterState, setRosterState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const { toast, flash } = useToast(2200);

  useEffect(() => {
    // GET /teacher/family-messages: { students[{id,name,parent,linked}],
    //   sent[{id,recipient,student_name,body,status,created_at}] }
    teacherApi
      .familyMessages()
      .then((data: any) => {
        // 학생 목록 — avatarBg는 API에 없어 이름 일치 시 FALLBACK 색, 아니면 순환 보정
        const list = Array.isArray(data?.students) ? data.students : null;
        if (Array.isArray(list) && list.length) {
          const mapped: Student[] = list.map((s: any, i: number) => {
            const fb =
              FALLBACK_STUDENTS.find((f) => f.name === s.name) ??
              FALLBACK_STUDENTS[i % FALLBACK_STUDENTS.length];
            return {
              id: String(s.id ?? s.student_id ?? `s${i + 1}`),
              name: String(s.name ?? ''),
              parent: String(s.parent ?? s.parent_name ?? `${s.name ?? ''} 학부모`),
              linked: Boolean(s.linked ?? s.parent_linked),
              avatarBg: String(s.avatarBg ?? s.avatar_bg ?? fb.avatarBg),
            };
          });
          setStudents(mapped);
          setRosterState('ready');
          // FALLBACK id('s2')로 선택돼 있던 학생을 API UUID로 다시 연결 (이름 기준)
          setSelectedIds((ids) =>
            ids
              .map((oldId) => {
                if (mapped.some((m) => m.id === oldId)) return oldId;
                const nm = FALLBACK_STUDENTS.find((f) => f.id === oldId)?.name;
                const hit = nm ? mapped.find((m) => m.name === nm) : undefined;
                return hit ? hit.id : oldId;
              })
              .filter((id) => mapped.some((m) => m.id === id)),
          );
        } else {
          // 서버가 명단을 주지 못함 → 화면의 FALLBACK은 데모일 뿐, 발송 대상이 아님
          setRosterState('error');
        }
        // 발송 이력
        const sentList = Array.isArray(data) ? data : data?.sent ?? data?.messages;
        if (Array.isArray(sentList) && sentList.length) {
          setSent(
            sentList.map((m: any): SentMessage => {
              const stuName = String(m.student_name ?? '');
              const chars = [...(stuName || String(m.recipient ?? '냥'))];
              const fb = FALLBACK_STUDENTS.find((f) => f.name === stuName);
              return {
                recipient: String(m.recipient ?? '학부모'),
                // 원본 initial은 학생 이름 두 번째 글자(하은→하, 시우→시)
                initial: String(m.initial ?? chars[1] ?? chars[0] ?? '냥'),
                avatarBg: String(
                  m.avatarBg ?? m.avatar_bg ?? fb?.avatarBg ?? 'linear-gradient(135deg,#FF7A7A,#FF5A6E)',
                ),
                body: String(m.body ?? m.message ?? ''),
                time: String(
                  m.time ?? (m.created_at ? koreanAgo(String(m.created_at)) : m.sent_at ?? ''),
                ),
                status: m.status === 'read' ? ('read' as const) : ('sent' as const),
              };
            }),
          );
        }
      })
      .catch(() => {
        // 명단을 못 불러오면 가짜 명단으로 발송하지 않도록 error 상태로 표시
        setRosterState('error');
      });
  }, []);

  /* ── 원본 renderVals 파생값 그대로 ── */
  const selectedStudents = students.filter((s) => selectedIds.includes(s.id));
  const linkedSelected = selectedStudents.filter((s) => s.linked);
  const totalLinked = students.filter((s) => s.linked).length;
  const allOn = students.every((s) => selectedIds.includes(s.id));
  const rosterReady = rosterState === 'ready';
  const canSend = rosterReady && !sending && linkedSelected.length > 0 && message.trim().length > 0;
  const q = query.trim();
  const results = students.filter((s) => q === '' || s.name.includes(q) || s.parent.includes(q));
  const selCount = selectedStudents.length;
  const unlinkedSelCount = selCount - linkedSelected.length;
  const one = linkedSelected.length === 1 ? linkedSelected[0] : null;
  const blockedNote = selCount > 0 && linkedSelected.length === 0;

  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const toggleAll = () => {
    const allIds = students.map((s) => s.id);
    setSelectedIds((ids) => (allIds.every((id) => ids.includes(id)) ? [] : allIds));
  };

  const fill = (text: string) => {
    const nm = selectedStudents.length === 1 ? selectedStudents[0].name : '자녀';
    setMessage(text.replace(/OO/g, nm).slice(0, 200));
  };

  const send = () => {
    const msg = message.trim();
    const targets = linkedSelected;
    // 명단이 서버에서 오지 않았으면(가짜 명단) 발송 금지
    if (!msg || !targets.length || !rosterReady || sending) return;
    const single = targets.length === 1 ? targets[0] : null;
    const entry: SentMessage = {
      recipient: single ? single.parent : `학부모 ${targets.length}명`,
      initial: single ? [...single.name][0] || '냥' : '전',
      avatarBg: single ? single.avatarBg : 'linear-gradient(135deg,#FF7A7A,#FF5A6E)',
      body: msg,
      time: '방금 전',
      status: 'sent',
    };
    // 낙관적 반영 후 서버 응답을 기다려 성공/실패를 분기 (실패 시 롤백)
    setSending(true);
    setSent((list) => [entry, ...list]);
    setMessage('');
    teacherApi
      .sendFamilyMessage(targets.map((t) => t.id), msg)
      .then(() => {
        flash(single ? `${single.parent}에게 메시지를 보냈어요` : `학부모 ${targets.length}명에게 메시지를 보냈어요`);
      })
      .catch(() => {
        // 발송 실패 — 낙관적으로 추가한 이력을 되돌리고 입력값 복구
        setSent((list) => list.filter((e) => e !== entry));
        setMessage(msg);
        flash('메시지 전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => setSending(false));
  };

  return (
    <TeacherLayout bottomCard={null}>
      <main className="fn-main">
        <div className="fn-head">
          <div className="fn-crumb">
            <Link to={PATHS.TEACHER_HOME} className="fn-crumb-link">
              선생님 콘솔
            </Link>
            <i className="ph-bold ph-caret-right fn-crumb-caret" />
            <span>가정 안내</span>
          </div>
          <h1 className="fn-title">가정 안내 · 메시지 보내기</h1>
          <p className="fn-subtitle">학생을 고르고 보호자에게 간단한 알림 메시지를 보내요. 학생 개인정보는 노출되지 않아요.</p>
        </div>

        <div className="fn-grid">
          {/* COMPOSE */}
          <div className="fn-card">
            <label className="fn-label">받는 학생 찾기</label>
            <div className="fn-search-wrap">
              <i className="ph-bold ph-magnifying-glass fn-search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="학생 이름을 검색해요 (예: 김하은)"
                className="fn-search-input"
              />
            </div>
            <div className="fn-list">
              {q === '' && (
                <button onClick={toggleAll} className={'fn-row' + (allOn ? ' fn-row-on' : '')}>
                  <span className={'fn-box' + (allOn ? ' fn-box-on' : '')}>
                    {allOn && <i className="ph-bold ph-check" />}
                  </span>
                  <span className="fn-all-avatar">
                    <i className="ph-fill ph-users-three" />
                  </span>
                  <span className="fn-row-body">
                    <span className="fn-row-name">전체 선택</span>
                    <span className="fn-row-sub">연동된 학부모 {totalLinked}명 모두 선택</span>
                  </span>
                </button>
              )}
              {results.map((s) => {
                const on = selectedIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggle(s.id)} className={'fn-row' + (on ? ' fn-row-on' : '')}>
                    <span className={'fn-box' + (on ? ' fn-box-on' : '')}>
                      {on && <i className="ph-bold ph-check" />}
                    </span>
                    <span className="fn-row-avatar" style={{ background: s.avatarBg }}>
                      {[...s.name][0] || '냥'}
                    </span>
                    <span className="fn-row-body">
                      <span className="fn-row-name">{s.name}</span>
                      <span className="fn-row-sub">{s.parent}</span>
                    </span>
                    <span className={'fn-tag ' + (s.linked ? 'fn-tag-linked' : 'fn-tag-unlinked')}>
                      {s.linked ? '연결됨' : '미연결'}
                    </span>
                  </button>
                );
              })}
              {results.length === 0 && (
                <div className="fn-empty">검색 결과가 없어요. 학생 이름을 다시 확인해 주세요.</div>
              )}
            </div>

            {/* recipient */}
            <div className={'fn-recipient' + (selCount > 0 ? ' fn-recipient-on' : '')}>
              <span
                className="fn-rec-avatar"
                style={{
                  background:
                    selCount === 0
                      ? 'linear-gradient(135deg,#C7C4D8,#A7A4BB)'
                      : one
                        ? one.avatarBg
                        : 'linear-gradient(135deg,#FF7A7A,#FF5A6E)',
                }}
              >
                {selCount === 0 ? '?' : one ? [...one.name][0] || '냥' : '전'}
              </span>
              <div className="fn-rec-body">
                <div className="fn-rec-name">
                  {selCount === 0 ? '받는 사람을 선택해요' : one ? one.parent : `학부모 ${linkedSelected.length}명`}
                </div>
                <div className="fn-rec-sub">
                  {selCount === 0
                    ? '위에서 학생을 골라주세요'
                    : `전송 대상 ${linkedSelected.length}명` +
                      (unlinkedSelCount > 0 ? ` · 미연결 ${unlinkedSelCount}명 제외` : '')}
                </div>
              </div>
              <span className={'fn-rec-tag' + (selCount > 0 ? ' fn-rec-tag-on' : '')}>
                <i className="ph-fill ph-users-three" />
                {linkedSelected.length}명
              </span>
            </div>

            {/* SELECTED NAMES */}
            {selCount > 0 && (
              <div className="fn-chips">
                <span className="fn-chips-count">선택된 학생 {selCount}명</span>
                {selectedStudents.map((s) => (
                  <span key={s.id} className="fn-chip">
                    {s.name}
                    <button onClick={() => toggle(s.id)} className="fn-chip-x">
                      <i className="ph-bold ph-x" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <label className="fn-label fn-label-quick">빠른 문구</label>
            <div className="fn-tpls">
              {TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => fill(t.text)} className="fn-tpl">
                  <i className={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>

            <label className="fn-label">메시지 내용</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="보호자에게 전할 간단한 메시지를 적어요."
              className="fn-textarea"
            />
            <div className="fn-meta">
              <span className="fn-count">{message.length} / 200자</span>
              <span className="fn-channel">
                <i className="ph-fill ph-lock-simple" />
                앱 알림 + 문자로 전송
              </span>
            </div>

            <div className="fn-actions">
              <button onClick={() => setMessage('')} className="fn-clear">
                지우기
              </button>
              <button
                onClick={send}
                disabled={!canSend}
                className={'fn-send ' + (canSend ? 'fn-send-on' : 'fn-send-off')}
              >
                <i className="ph-fill ph-paper-plane-tilt" />
                {sending ? '보내는 중…' : '메시지 보내기'}
              </button>
            </div>
            {rosterState === 'error' && (
              <div className="fn-blocked">
                <i className="ph-fill ph-warning" />
                <span>학생 명단을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요. (명단을 불러오기 전에는 발송할 수 없어요)</span>
              </div>
            )}
            {rosterState === 'ready' && blockedNote && (
              <div className="fn-blocked">
                <i className="ph-fill ph-warning" />
                <span>보호자 계정이 아직 연결되지 않았어요. 연결 후 전송할 수 있어요.</span>
              </div>
            )}
          </div>

          {/* SENT LIST */}
          <div className="fn-card fn-card-sent">
            <div className="fn-sent-head">
              <span className="fn-sent-badge">
                <i className="ph-fill ph-paper-plane-tilt" />
              </span>
              <h3 className="fn-sent-title">최근 보낸 메시지</h3>
            </div>
            <div className="fn-sent-list">
              {sent.map((s, i) => (
                <div key={i} className="fn-sent-item">
                  <div className="fn-sent-top">
                    <span className="fn-sent-avatar" style={{ background: s.avatarBg }}>
                      {s.initial}
                    </span>
                    <span className="fn-sent-name">{s.recipient}</span>
                    <span className="fn-sent-time">{s.time}</span>
                  </div>
                  <p className="fn-sent-body">{s.body}</p>
                  <span className={'fn-status ' + (s.status === 'read' ? 'fn-status-read' : 'fn-status-sent')}>
                    <i className={s.status === 'read' ? 'ph-fill ph-checks' : 'ph-fill ph-check'} />
                    {s.status === 'read' ? '읽음' : '전송됨'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* TOAST */}
      {toast && (
        <div className="fn-toast">
          <i className="ph-fill ph-check-circle" />
          <span>{toast}</span>
        </div>
      )}
    </TeacherLayout>
  );
}
