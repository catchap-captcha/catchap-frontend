import { useEffect, useState } from 'react';
import { notificationApi, type Notification } from '../../api/notifications';
import { settingsApi } from '../../api/settings';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';
import './OpsAlerts.css';
import SystemScreenGuide from '../../components/ops/SystemScreenGuide';

/**
 * 시스템 경보 — 서버·서비스에 문제가 생겼을 때 받은 알림을 모아 본다.
 *
 * 어디서 오나: 클러스터의 감시 장치(Alertmanager)가 임계를 넘긴 것을 판단해 백엔드로 보내고,
 * 백엔드가 운영자 전원에게 이 알림을 만든다. 그래서 여기 목록은 '내가 받은 경보'다
 * — 운영자끼리 같은 내용을 각자 받는다.
 *
 * ★가짜를 그리지 않는다: 못 불러오면 못 불러왔다고 적는다. 빈 목록을 '이상 없음'처럼
 * 보이게 하지 않는다 — 수집이 끊겨서 조용한 것과 진짜 평온한 것은 다르기 때문이다.
 */

const ALERT_TYPE = '시스템경보';

/** 제목 앞의 [급함]·[경고]·[해제] 를 떼어 알갱이만 남긴다. 등급은 색으로 보여 준다. */
function split(title: string): { tag: string; rest: string } {
  const m = /^\[(.+?)\]\s*(.*)$/.exec(title);
  return m ? { tag: m[1], rest: m[2] } : { tag: '', rest: title };
}

const HANGUL = /[가-힣]/;

/**
 * 목록에 보일 한 줄 — ★규칙 이름(CatchapServiceDown)이 아니라 사람이 읽는 말.
 *
 * ★백엔드는 0816 부터 제목에 한글을 넣는다(backend#68). 그런데 ★그것은 경보를 ★받을 때
 *   만들어 저장하는 값이라, 그 전에 쌓인 기록은 제목이 영문 규칙 이름 그대로다.
 *   실제로 지금 화면의 15건이 전부 그렇다 —
 *     [급함] CatchapServiceDown — monitoring-kube-state-metrics-6cb6769d69-przfr 외 1건
 *   반납까지 새 경보가 안 오면 운영자는 영문만 보게 된다.
 *
 * ★고칠 자리는 저장된 값이 아니라 ★보여 주는 쪽이다. 본문(message)에는 그때도 한글
 *   설명이 들어 있었다("· [급함] catchap 지표가 10분째 안 들어옵니다"). 그것을 쓴다.
 *   저장된 원문은 건드리지 않는다 — 기록은 온 그대로 남아야 한다.
 */
function headline(title: string, message: string | null): string {
  const { rest } = split(title);
  if (HANGUL.test(rest)) return rest; // 이미 한글이면 그대로
  const m = /^·\s*\[[^\]]*\]\s*(.+)$/m.exec(message || '');
  const ko = m?.[1]?.trim();
  if (!ko || !HANGUL.test(ko)) return rest; // 본문에도 한글이 없으면 손대지 않는다
  // 규칙 이름 자리만 한글로 바꾸고 "— 어디서 · 외 N건" 은 살린다.
  const tail = rest.replace(/^[A-Za-z][A-Za-z0-9_]*/, '').replace(/^\s*—\s*/, '').trim();
  const more = /외 \d+건$/.exec(tail)?.[0] ?? '';
  const where = tail.replace(/\s*외 \d+건$/, '').trim();
  // 한글 설명이 이미 그 파드·배포 이름을 담고 있으면 같은 말을 두 번 붙이지 않는다
  return [ko, where && !ko.includes(where) ? `— ${where}` : '', more].filter(Boolean).join(' ');
}

const TAG_CLASS: Record<string, string> = {
  급함: 'crit',
  경고: 'warn',
  참고: 'info',
  해제: 'ok',
  안내: 'info',
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

/** 얼마나 지났는지 — 목록에서 '최근 것인지'를 한눈에 보려고. */
function ago(ts: string | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function OpsAlerts() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState<Notification | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);

  // 수신 설정 — 끄면 이 화면에는 계속 쌓이고 ★메일만 안 온다.
  const [mailOn, setMailOn] = useState<boolean | null>(null); // null = 아직 모름
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const load = () => {
    setState('loading');
    notificationApi
      .list()
      .then((all) => {
        setRows((all ?? []).filter((n) => n.type === ALERT_TYPE));
        setState('ready');
      })
      .catch(() => setState('error'));
  };

  useEffect(load, []);

  useEffect(() => {
    settingsApi
      .get()
      .then((d) => setMailOn(d?.settings?.alerts?.email !== false)) // 설정이 없으면 받는 것이 기본
      .catch(() => setMailOn(null)); // ★모르면 모른다고 둔다 — 켜진 것처럼 보이게 하지 않는다
  }, []);

  const toggleMail = async (next: boolean) => {
    setSaving(true);
    setSaveMsg('');
    try {
      const cur = await settingsApi.get();
      const merged = { ...(cur?.settings ?? {}), alerts: { ...(cur?.settings?.alerts ?? {}), email: next } };
      await settingsApi.save(merged);
      setMailOn(next);
      setSaveMsg(next ? '이제 메일로도 받아요.' : '이제 이 화면에만 쌓여요.');
    } catch {
      setSaveMsg('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const openOne = (n: Notification) => {
    setOpen(n);
    if (!n.read_at) {
      notificationApi
        .markRead(n.id)
        .then(() => setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r))))
        .catch(() => {/* 읽음 표시 실패는 화면을 막지 않는다 */});
    }
  };

  const unread = rows.filter((r) => !r.read_at).length;
  const shown = onlyUnread ? rows.filter((r) => !r.read_at) : rows;

  return (
    <div className="op-root ops-alerts">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">시스템 경보</h1>
            <p className="op-sub">
              서버·서비스에 문제가 생기면 여기에 쌓여요. 급한 것은 메일로도 가요.
            </p>
          </div>
          <button className="op-refresh" onClick={load}>
            <i className="ph-bold ph-arrows-clockwise" />
            새로고침
          </button>
        </div>
        <SystemScreenGuide />

        {/* 수신 설정 — 이 화면에서 '관리'할 수 있는 것 */}
        <div className="al-prefs">
          <div className="al-prefs-main">
            <i className="ph-fill ph-envelope-simple" />
            <div>
              <b>경보 메일 받기</b>
              <small>
                끄면 <b>이 화면에는 계속 쌓이고</b> 메일만 안 와요. 급한 경보는 다른 운영자에게도 같이 가요.
              </small>
            </div>
          </div>
          {mailOn === null ? (
            <span className="al-prefs-unknown">설정을 불러오지 못했어요</span>
          ) : (
            <button
              className={`al-toggle ${mailOn ? 'on' : ''}`}
              onClick={() => toggleMail(!mailOn)}
              disabled={saving}
              aria-pressed={mailOn}
            >
              <span className="al-toggle-knob" />
              <span className="al-toggle-label">{mailOn ? '받는 중' : '끔'}</span>
            </button>
          )}
          {saveMsg && <span className="al-prefs-msg">{saveMsg}</span>}
        </div>

        <div className="al-filters">
          <button className={`al-chip ${!onlyUnread ? 'on' : ''}`} onClick={() => setOnlyUnread(false)}>
            전체 {rows.length}건
          </button>
          <button className={`al-chip ${onlyUnread ? 'on' : ''}`} onClick={() => setOnlyUnread(true)}>
            안 읽음 {unread}건
          </button>
        </div>

        <div className="op-logcard">
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow al-bad">
              경보를 불러오지 못했어요. <b>경보가 없다는 뜻이 아니에요</b> — 새로고침해 주세요.
            </div>
          )}
          {state === 'ready' && shown.length === 0 && (
            <div className="op-logrow">
              {onlyUnread ? '안 읽은 경보가 없어요.' : '받은 경보가 없어요.'}
            </div>
          )}
          {state === 'ready' &&
            shown.map((n) => {
              const { tag } = split(n.title);
              const rest = headline(n.title, n.message);
              const cls = TAG_CLASS[tag] ?? 'info';
              return (
                <button key={n.id} className={`al-row ${n.read_at ? '' : 'unread'}`} onClick={() => openOne(n)}>
                  <span className={`al-tag al-tag--${cls}`}>{tag || '알림'}</span>
                  <span className="al-title">{rest}</span>
                  <span className="al-time" title={fmt(n.created_at)}>
                    {ago(n.created_at)}
                  </span>
                </button>
              );
            })}
        </div>

        {/* 이 화면을 읽는 법 — 처음 보는 사람이 무엇을 해야 하는지 알 수 있게 */}
        <div className="al-guide">
          <h2>어디서 오는 건가요</h2>
          <p>
            클러스터의 감시 장치가 30초마다 서버·서비스를 재고, 미리 정해 둔 선을 넘으면 경보를 만들어요.
            그 경보가 백엔드를 거쳐 <b>운영자 모두에게</b> 옵니다. 같은 내용을 각자 받아요.
          </p>
          <h2>등급</h2>
          <ul>
            <li>
              <span className="al-tag al-tag--crit">급함</span> 서비스가 멈췄거나 곧 멈춰요. 지금 봐야 해요.
            </li>
            <li>
              <span className="al-tag al-tag--warn">경고</span> 아직 괜찮지만 두면 문제가 돼요.
            </li>
            <li>
              <span className="al-tag al-tag--info">참고</span> 알아 두면 좋은 것. 메일로는 안 가요.
            </li>
            <li>
              <span className="al-tag al-tag--ok">해제</span> 났던 문제가 풀렸어요.
            </li>
          </ul>
          <h2>조용하면 괜찮은 건가요</h2>
          <p>
            <b>꼭 그렇지는 않아요.</b> 지표 수집이 끊겨도 조용해집니다. 그래서 수집이 멈추는 것 자체를
            잡는 경보를 따로 두었어요. 그래도 이상하다 싶으면 <b>모니터링</b> 화면에서 마지막 수집 시각을
            확인해 주세요.
          </p>
        </div>
      </main>

      {open && (
        <div className="al-modal" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="al-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="al-modal-head">
              <span className={`al-tag al-tag--${TAG_CLASS[split(open.title).tag] ?? 'info'}`}>
                {split(open.title).tag || '알림'}
              </span>
              <b>{headline(open.title, open.message)}</b>
              <button className="al-modal-x" onClick={() => setOpen(null)} aria-label="닫기">
                <i className="ph-bold ph-x" />
              </button>
            </div>
            <pre className="al-modal-body">{open.message}</pre>
            <div className="al-modal-foot">받은 시각 {fmt(open.created_at)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
