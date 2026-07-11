import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { useAuth } from '../../hooks/useAuth';
import { aiChatApi } from '../../api/misc';
import { speak, stopSpeaking } from '../../utils/feedback';
import mascot from '../../assets/characters/catchap-logo.png';
import './AiTeacher.css';

interface ChatMessage {
  from: 'ai' | 'me';
  text: string;
}

// API 실패 시 첫 인사 fallback — {n}은 학생 이름으로 치환
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    from: 'ai',
    text: '안녕 {n}아! 나는 AI 선생님 냥냥이야 🐱 오늘도 만나서 반가워! 궁금한 게 있으면 뭐든지 물어봐.',
  },
  { from: 'ai', text: '아래 버튼을 눌러서 이야기를 시작해도 좋아!' },
];

/** 대화 시작 시각 — 원본 '오늘 오후 3:24' 하드코딩 대신 실제 현재 시각 */
function nowLabel(): string {
  // KST 고정 — 브라우저 시간대 무관
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date());
  return `오늘 ${parts}`;
}

// TODO(api): 백엔드 미구현 — aiChatApi.studentChat 실패 시 원본 DCLogic ask()의 canned 응답 사용
const CANNED: Record<string, string> = {
  '그림 찾기가 어려워요':
    '고양이는 귀가 뾰족하고 수염이 길어요. 강아지는 귀가 아래로 처진 경우가 많지! 헷갈릴 땐 "귀 모양"부터 보면 훨씬 쉬워져요. 다음엔 100% 맞힐 수 있을 거야! 💪',
  '받침이 자꾸 헷갈려요':
    '받침은 글자 아래에 오는 소리예요. 예를 들어 "곰"은 ㄱ+ㅗ+ㅁ, 마지막 ㅁ이 받침이야. 소리를 천천히 나눠서 말해보면 어떤 받침인지 들려요! 🎵',
  '오늘 뭐 배우면 좋아?':
    '어제 숫자 놀이터를 조금 어려워했으니까, 오늘은 숫자 놀이터 2단계를 추천해! 그리고 아직 시작 안 한 안전 지킴이도 재미있을 거야. 같이 해볼까? 🚀',
  '나 칭찬해줘!':
    '하은이는 12일 연속으로 학습했어! 정말 대단해 👏 끌어놓기 놀이는 정답률 95%나 돼. 꾸준함이 최고의 재능이야. 오늘도 최고! 🌟',
};

const cannedReply = (q: string) => CANNED[q] || '좋은 질문이야! 천천히 같이 알아보자. 😊';

const CHIP_LABELS = ['그림 찾기가 어려워요', '받침이 자꾸 헷갈려요', '오늘 뭐 배우면 좋아?', '나 칭찬해줘!'];

export default function AiTeacher() {
  const { me } = useAuth();
  const name = (me?.name ?? '하은').trim() || '하은';

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    INITIAL_MESSAGES.map((m) => ({ ...m, text: m.text.replace(/\{n\}/g, name) })),
  );
  const [input, setInput] = useState('');
  const [dateChip] = useState(nowLabel);
  const greeted = useRef(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  // 첫 인사: GET /ai/student-chat/greeting — 이름/최근 학습 실데이터 반영 (실패 시 fallback 유지)
  useEffect(() => {
    aiChatApi
      .studentChatGreeting()
      .then((d: any) => {
        if (greeted.current) return;
        const list = Array.isArray(d?.messages) ? d.messages.filter((t: any) => typeof t === 'string' && t) : null;
        if (!list || !list.length) return;
        greeted.current = true;
        setMessages((prev) => {
          // 아직 인사만 있는 상태에서만 교체 (사용자가 먼저 질문했다면 유지)
          if (prev.length > INITIAL_MESSAGES.length) return prev;
          return list.map((text: string): ChatMessage => ({ from: 'ai', text }));
        });
      })
      .catch(() => {
        /* fallback 인사 유지 */
      });
  }, []);

  // me(이름) 늦게 로드 시 fallback 인사 이름 갱신 (인사 API 도착 전까지만)
  useEffect(() => {
    if (greeted.current) return;
    setMessages((prev) =>
      prev.length === INITIAL_MESSAGES.length
        ? INITIAL_MESSAGES.map((m) => ({ ...m, text: m.text.replace(/\{n\}/g, name) }))
        : prev,
    );
  }, [name]);

  // 원본 componentDidMount/componentDidUpdate의 _scrollToBottom 그대로
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 페이지를 떠나면 냥냥이 목소리 정지
  useEffect(() => () => stopSpeaking(), []);

  // 원본 ask(q): 사용자 메시지 즉시 추가 → 응답 도착 시 봇 메시지 추가
  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setMessages((prev) => [...prev, { from: 'me', text: t }]);
    aiChatApi
      .studentChat(t)
      .then((data) => {
        const reply =
          typeof data === 'string' ? data : (data?.reply ?? data?.message ?? data?.text ?? data?.answer);
        const text = typeof reply === 'string' && reply ? reply : cannedReply(t);
        setMessages((prev) => [...prev, { from: 'ai', text }]);
        speak(text); // 설정 '냥냥이 목소리' on일 때만 읽어줌
      })
      .catch(() => {
        // TODO(api): API 실패 시 원본 canned 응답 fallback
        const text = cannedReply(t);
        setMessages((prev) => [...prev, { from: 'ai', text }]);
        speak(text);
      });
  };

  const sendInput = () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    ask(t);
  };

  return (
    <div className="at-root">
      {/* NAV — 원본(알림 버튼 없음, 이니셜 아바타)이 학습 홈 NAV와 달라 페이지 자체 구현 */}
      <div className="at-nav">
        <div className="at-navinner">
          <Link to={PATHS.STUDENT_HOME} className="at-logo">
            <img src={mascot} alt="CatChap" className="at-logoimg" />
            <div className="at-logotext">
              <span className="at-logotitle">CatChap</span>
              <span className="at-logosub">놀면서 배우는 캡챠 학습</span>
            </div>
          </Link>
          <nav className="at-menu">
            <Link to={PATHS.STUDENT_HOME} className="at-navlink">
              홈
            </Link>
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="at-navlink">
              전체 학습
            </Link>
            <Link to={PATHS.STUDENT_CONCEPTS} className="at-navlink">
              개념 설명
            </Link>
            <a href="#" className="at-navlink at-navlink-active">
              AI 선생님
            </a>
            <Link to={PATHS.STUDENT_RECORDS} className="at-navlink">
              나의 기록
            </Link>
          </nav>
          <div className="at-navright">
            <Link to={PATHS.STUDENT_SEARCH} title="검색" className="at-iconbtn">
              <i className="ph-bold ph-magnifying-glass" />
            </Link>
            <Link to={PATHS.STUDENT_PROFILE} title="마이페이지" className="at-profile">
              <div className="at-avatar">{name.charAt(0)}</div>
              <span className="at-profilename">{name}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* BODY */}
      <section className="at-body">
        {/* LEFT: teacher card + topics */}
        <aside className="at-aside">
          <div className="at-card">
            <div className="at-cardicon">
              <i className="ph-fill ph-robot" />
            </div>
            <h2 className="at-cardtitle">AI 선생님 냥냥이</h2>
            <p className="at-cardtext">궁금한 걸 물어보면 쉽게 알려줄게요. 언제든 편하게 이야기해요!</p>
            <div className="at-status">
              <span className="at-statusdot" />
              지금 도와줄 수 있어요
            </div>
          </div>

          <div className="at-topics">
            <div className="at-topicstitle">이런 걸 도와줘요</div>
            <div className="at-topiclist">
              <div className="at-topic">
                <span className="at-topicicon at-ti1">
                  <i className="ph-fill ph-lightbulb" />
                </span>
                어려운 문제 힌트
              </div>
              <div className="at-topic">
                <span className="at-topicicon at-ti2">
                  <i className="ph-fill ph-notebook" />
                </span>
                틀린 문제 다시 설명
              </div>
              <div className="at-topic">
                <span className="at-topicicon at-ti3">
                  <i className="ph-fill ph-compass" />
                </span>
                오늘 뭐 배울지 추천
              </div>
              <div className="at-topic">
                <span className="at-topicicon at-ti4">
                  <i className="ph-fill ph-hand-heart" />
                </span>
                응원과 칭찬
              </div>
            </div>
          </div>

          <div className="at-notice">
            <i className="ph-fill ph-shield-check at-noticeicon" />
            <p className="at-noticetext">대화는 학습을 돕기 위해서만 쓰여요. 개인정보는 묻지 않아요.</p>
          </div>
        </aside>

        {/* RIGHT: chat */}
        <div className="at-chat">
          {/* chat header */}
          <div className="at-chathead">
            <div className="at-chatavatar">
              <i className="ph-fill ph-robot" />
            </div>
            <div className="at-chatheadtext">
              <div className="at-chatname">냥냥이와 대화</div>
              <div className="at-chatonline">● 온라인</div>
            </div>
          </div>

          {/* messages */}
          <div ref={messagesRef} className="at-msgs">
            <div className="at-daterow">
              <span className="at-datechip">{dateChip}</span>
            </div>
            {messages.map((m, i) => {
              const isAI = m.from === 'ai';
              return (
                <div key={i} className={`at-msgrow ${isAI ? 'at-msgrow-ai' : 'at-msgrow-me'}`}>
                  {isAI && (
                    <div className="at-msgavatar">
                      <i className="ph-fill ph-robot" />
                    </div>
                  )}
                  <div className={`at-bubble ${isAI ? 'at-bubble-ai' : 'at-bubble-me'}`}>{m.text}</div>
                </div>
              );
            })}
          </div>

          {/* quick replies */}
          <div className="at-chips">
            {CHIP_LABELS.map((label) => (
              <button key={label} className="at-chip" onClick={() => ask(label)}>
                {label}
              </button>
            ))}
          </div>

          {/* input bar */}
          <div className="at-inputbar">
            <div className="at-inputwrap">
              <input
                type="text"
                placeholder="냥냥이에게 물어보세요..."
                className="at-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendInput();
                }}
              />
            </div>
            <button className="at-send" onClick={sendInput}>
              <i className="ph-fill ph-paper-plane-right" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
