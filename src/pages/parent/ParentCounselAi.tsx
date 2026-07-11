/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import ParentLayout from '../../layouts/ParentLayout';
import { aiChatApi } from '../../api/misc';
import { parentApi } from '../../api/parents';
import './ParentCounselAi.css';

/**
 * handoff `CatChap 학부모 상담 AI.dc.html` 포팅.
 * 원본 NAV에는 벨이 없어 ParentLayout bell 미전달.
 */

interface ChatMessage {
  from: 'ai' | 'me';
  text: string;
}

interface ChildInfo {
  id: string;
  name: string;
  age: string;
  org: string;
  initial: string;
  acc: string;
  grad: string;
  intro: string;
  answers: Record<string, string>;
}

// TODO(api): 백엔드 미구현 — parentApi.children()/aiChatApi.parentChat 실패 시 원본 DCLogic data() 그대로 유지
const FALLBACK_CHILDREN: ChildInfo[] = [
  {
    id: 'haeun',
    name: '하은',
    age: '7세',
    org: '햇살초등학교',
    initial: '하',
    acc: '89%',
    grad: 'linear-gradient(135deg,#FFC24B,#FF8A5B)',
    intro:
      '안녕하세요, 김서연 학부모님. 하은이의 학습 데이터를 함께 살펴보는 AI 학습 상담사예요. 이번 주 하은이는 한글·그림 찾기에서 강점을 보였고, 숫자 놀이에서는 조금 더 연습이 필요해 보여요.',
    answers: {
      '이번 주 우리 아이 어땠나요?':
        '이번 주 하은이는 총 14회 학습했고 평균 정답률은 89%로 지난주보다 4%p 올랐어요. 특히 한글 낱말 찾기(96%)와 그림 찾기(92%)에서 꾸준함이 돋보였어요. 다만 숫자 놀이터는 72%로, 덧셈·뺄셈 개념에서 조금 헷갈려 하는 모습이 보였습니다.',
      '숫자를 어려워하는데 어떻게 도울까요?':
        '하은이는 드래그 조작은 능숙한데 수 개념에서 머뭇거리는 편이에요. 집에서 사탕이나 블록으로 "3개에 2개를 더하면?"처럼 눈으로 보고 세는 활동을 권해요. 하루 5문제씩, 난이도를 한 단계 낮춰 성공 경험을 쌓게 해주시면 자신감이 붙어요.',
      '집에서 뭘 도와주면 좋을까요?':
        '세 가지를 추천드려요. ① 헷갈린 낱말 5개를 소리 내어 함께 읽기, ② 큰 물건으로 더하기·빼기 놀이, ③ 학습 후 "오늘 뭐가 제일 재미있었어?"라고 물어 성취를 언어로 표현하게 하기. 짧고 즐겁게, 칭찬 위주로 해주시는 게 가장 효과적이에요.',
      '학습 시간은 얼마가 적당한가요?':
        '7세 어린이는 한 번에 10~15분, 하루 20분 내외가 적당해요. 하은이는 평균 풀이 시간이 12초로 집중력이 좋은 편이니, 짧게 자주 하는 리듬이 잘 맞아요. 피곤해하면 바로 멈추고 다음 날 이어가는 것이 습관 형성에 더 좋습니다.',
    },
  },
  {
    id: 'doyun',
    name: '도윤',
    age: '5세',
    org: '행복유치원',
    initial: '도',
    acc: '76%',
    grad: 'linear-gradient(135deg,#B08AFF,#8B6BFF)',
    intro:
      '안녕하세요, 김서연 학부모님. 이번엔 도윤이의 학습 상담을 도와드릴게요. 도윤이는 그림 찾기와 끌어놓기 놀이를 특히 좋아하고, 한글 낱말은 이제 시작하는 단계예요.',
    answers: {
      '이번 주 우리 아이 어땠나요?':
        '이번 주 도윤이는 9회 학습했고 평균 정답률은 76%예요. 그림 찾기(88%)와 끌어놓기(84%)를 즐거워했어요. 한글 낱말은 이제 막 시작한 단계라 62% 정도인데, 5세임을 감안하면 아주 잘 따라오고 있어요.',
      '숫자를 어려워하는데 어떻게 도울까요?':
        '도윤이는 아직 5세라 수를 그림·사물과 연결하는 단계예요. 계단을 오르며 "하나, 둘, 셋" 세기, 간식 개수 세기처럼 일상 속 놀이로 접하게 해주세요. 정답보다 세는 즐거움에 초점을 맞추면 좋아요.',
      '집에서 뭘 도와주면 좋을까요?':
        '① 그림책을 함께 보며 사물 이름 말하기, ② 좋아하는 그림 찾기 놀이를 하루 3~4문제, ③ 잘했을 때 바로 안아주고 칭찬하기. 도윤이는 짧고 놀이 같은 활동에서 가장 잘 집중해요.',
      '학습 시간은 얼마가 적당한가요?':
        '5세는 한 번에 8~10분, 하루 10~15분이면 충분해요. 도윤이는 오래 앉아있기보다 놀이처럼 짧게 여러 번 하는 게 잘 맞아요. 재미없어하면 바로 멈추는 것이 중요해요.',
    },
  },
];

/** 원본 intro(k) 그대로 */
const introOf = (c: ChildInfo): ChatMessage[] => [
  { from: 'ai', text: c.intro },
  { from: 'ai', text: '아래 버튼을 누르거나 직접 질문해 주시면 자세히 안내해 드릴게요.' },
];

/** 원본 ask()의 canned 응답 그대로 */
const fallbackReply = (c: ChildInfo, q: string) =>
  c.answers[q] ||
  '좋은 질문이에요. ' +
    c.name +
    '이의 최근 학습 기록을 바탕으로 살펴볼게요. 조금 더 구체적으로 말씀해 주시면 자세히 안내해 드릴 수 있어요. 😊';

/** 원본 labels 그대로 */
const CHIP_LABELS = [
  '이번 주 우리 아이 어땠나요?',
  '숫자를 어려워하는데 어떻게 도울까요?',
  '집에서 뭘 도와주면 좋을까요?',
  '학습 시간은 얼마가 적당한가요?',
];

/** API 자녀 → 화면 모델 (이름이 하은/도윤이면 원본 상담 데이터 재사용) */
function toChild(raw: any, i: number): ChildInfo {
  const name = String(raw?.nickname ?? raw?.name ?? '');
  const fb = FALLBACK_CHILDREN.find((f) => f.name === name) ?? FALLBACK_CHILDREN[i % FALLBACK_CHILDREN.length];
  // 백엔드 accuracy는 "89%"처럼 포맷된 문자열 — 숫자로 오면 % 붙임
  const accRaw = raw?.accuracy;
  const acc =
    accRaw != null && String(accRaw) !== ''
      ? String(accRaw).endsWith('%')
        ? String(accRaw)
        : `${accRaw}%`
      : fb.acc;
  return {
    ...fb,
    id: String(raw?.id ?? raw?.child_id ?? fb.id),
    name: name || fb.name,
    age: raw?.age != null ? `${raw.age}세` : fb.age,
    org: String(raw?.org_name ?? raw?.school ?? fb.org),
    initial: (name || fb.name).charAt(0),
    acc,
  };
}

export default function ParentCounselAi() {
  // null=로딩중, []=연결된 자녀 없음 (미연동 시 데모 자녀 노출 방지)
  const [children, setChildren] = useState<ChildInfo[] | null>(null);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  /** 인트로 fetch 경합 방지 — 현재 선택된 자녀 id */
  const activeIdRef = useRef('');

  const loaded = children !== null;
  const childList = children ?? [];
  const active = childList.find((c) => c.id === activeId) ?? childList[0];

  /** 자녀 인트로 로드 — API intro 성공 시 교체, 실패 시 기존 하드코딩 intro 유지 */
  const loadIntro = (c: ChildInfo) => {
    setMessages(introOf(c));
    aiChatApi
      .parentChatIntro(c.id)
      .then((data) => {
        const intro = typeof data?.intro === 'string' && data.intro ? data.intro : '';
        if (!intro || activeIdRef.current !== c.id) return;
        setChildren((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, intro } : x)));
        setMessages(introOf({ ...c, intro }));
      })
      .catch(() => {
        /* TODO(api): 실패 시 FALLBACK intro 유지 */
      });
  };

  // 원본 componentDidMount/componentDidUpdate scrollToBottom 그대로
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    parentApi
      .children()
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) {
          setChildren([]); // 연결된 자녀 없음
          return;
        }
        const mapped = list.map(toChild);
        setChildren(mapped);
        setActiveId(mapped[0].id);
        activeIdRef.current = mapped[0].id;
        loadIntro(mapped[0]);
      })
      .catch(() => {
        setChildren([]); // 조회 실패 시에도 데모 자녀 대신 빈 상태
      });
  }, []);

  // 원본 c.select: 자녀 전환 시 대화 리셋 + 해당 자녀 인트로(API intro 우선)
  const selectChild = (c: ChildInfo) => {
    setActiveId(c.id);
    activeIdRef.current = c.id;
    loadIntro(c);
  };

  // 원본 ask(q) — 응답은 aiChatApi.parentChat, 실패 시 원본 canned 응답
  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    const child = active;
    setMessages((prev) => [...prev, { from: 'me', text: t }]);
    aiChatApi
      .parentChat(child.id, t)
      .then((data) => {
        const reply =
          typeof data === 'string' ? data : (data?.reply ?? data?.message ?? data?.text ?? data?.answer);
        setMessages((prev) => [
          ...prev,
          { from: 'ai', text: typeof reply === 'string' && reply ? reply : fallbackReply(child, t) },
        ]);
      })
      .catch(() => {
        // TODO(api): API 실패 시 원본 answers/generic 응답 fallback
        setMessages((prev) => [...prev, { from: 'ai', text: fallbackReply(child, t) }]);
      });
  };

  const sendInput = () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    ask(t);
  };

  // 연결된 자녀가 없으면 상담 대상이 없으므로 빈 상태
  if (loaded && childList.length === 0) {
    return (
      <ParentLayout className="pc-bg">
        <section className="pc-body">
          <div className="pc-empty">
            <div className="pc-empty-ic"><i className="ph-fill ph-chats-circle" /></div>
            <h2 className="pc-empty-title">상담할 자녀가 없어요</h2>
            <p className="pc-empty-text">
              자녀를 연결하면 학습 데이터를 바탕으로 AI 상담을 받을 수 있어요. 홈에서 <b>자녀 연결</b>을 먼저 해주세요.
            </p>
          </div>
        </section>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout className="pc-bg">
      {/* BODY */}
      <section className="pc-body">
        {/* LEFT: AI card + topics */}
        <aside className="pc-aside">
          <div className="pc-aicard">
            <div className="pc-aicard-icon">
              <i className="ph-fill ph-chats-circle" />
            </div>
            <h2 className="pc-aicard-title">AI 학습 상담사</h2>
            <p className="pc-aicard-text">
              자녀의 학습 데이터를 바탕으로 교육 상담을 도와드려요. 편하게 물어보세요.
            </p>
            <div className="pc-status">
              <span className="pc-statusdot" />
              상담 가능
            </div>
          </div>

          {/* child context / switcher */}
          <div className="pc-childcard">
            <div className="pc-childhead">
              <span className="pc-childlabel">상담 대상</span>
              <span className="pc-childhint">자녀를 선택하세요</span>
            </div>
            <div className="pc-childlist">
              {childList.map((c) => {
                const isActive = c.id === active.id;
                return (
                  <button
                    key={c.id}
                    className={`pc-child ${isActive ? 'pc-child--on' : 'pc-child--off'}`}
                    onClick={() => selectChild(c)}
                  >
                    <span className="pc-childavatar" style={{ background: c.grad }}>
                      {c.initial}
                    </span>
                    <span className="pc-childinfo">
                      <span className="pc-childname">
                        {c.name} · {c.age}
                      </span>
                      <span className="pc-childsub">
                        {c.org} · 정답률 {c.acc}
                      </span>
                    </span>
                    {isActive && (
                      <span className="pc-childcheck">
                        <i className="ph-fill ph-check-circle" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pc-topics">
            <div className="pc-topicstitle">이런 상담을 도와드려요</div>
            <div className="pc-topiclist">
              <div className="pc-topic">
                <span className="pc-topicicon pc-ti1">
                  <i className="ph-fill ph-chart-donut" />
                </span>
                자녀 학습 현황 해석
              </div>
              <div className="pc-topic">
                <span className="pc-topicicon pc-ti2">
                  <i className="ph-fill ph-magnifying-glass" />
                </span>
                강점·취약점 원인 분석
              </div>
              <div className="pc-topic">
                <span className="pc-topicicon pc-ti3">
                  <i className="ph-fill ph-house-line" />
                </span>
                가정 학습 지도 팁
              </div>
              <div className="pc-topic">
                <span className="pc-topicicon pc-ti4">
                  <i className="ph-fill ph-heart" />
                </span>
                학습 습관·정서 상담
              </div>
            </div>
          </div>

          <div className="pc-notice">
            <i className="ph-fill ph-shield-check pc-noticeicon" />
            <p className="pc-noticetext">
              상담 답변은 자녀의 학습 데이터를 바탕으로 한 참고용 안내예요. 진단·처방이 아니에요.
            </p>
          </div>
        </aside>

        {/* RIGHT: chat */}
        <div className="pc-chat">
          {/* chat header */}
          <div className="pc-chathead">
            <div className="pc-chatavatar">
              <i className="ph-fill ph-chats-circle" />
            </div>
            <div className="pc-chatheadtext">
              <div className="pc-chatname">AI 학습 상담사</div>
              <div className="pc-chatstatus">● 상담 중</div>
            </div>
          </div>

          {/* messages */}
          <div ref={messagesRef} className="pc-msgs">
            <div className="pc-daterow">
              <span className="pc-datechip">오늘 오후 8:10</span>
            </div>
            {messages.map((m, i) => {
              const isAI = m.from === 'ai';
              return (
                <div key={i} className={`pc-msgrow ${isAI ? 'pc-msgrow-ai' : 'pc-msgrow-me'}`}>
                  {isAI && (
                    <div className="pc-msgavatar">
                      <i className="ph-fill ph-chats-circle" />
                    </div>
                  )}
                  <div className={`pc-bubble ${isAI ? 'pc-bubble-ai' : 'pc-bubble-me'}`}>{m.text}</div>
                </div>
              );
            })}
          </div>

          {/* quick replies */}
          <div className="pc-chips">
            {CHIP_LABELS.map((label) => (
              <button key={label} className="pc-chip" onClick={() => ask(label)}>
                {label}
              </button>
            ))}
          </div>

          {/* input bar */}
          <div className="pc-inputbar">
            <div className="pc-inputwrap">
              <input
                type="text"
                placeholder="자녀 교육에 대해 궁금한 점을 물어보세요..."
                className="pc-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendInput();
                }}
              />
            </div>
            <button className="pc-send" onClick={sendInput}>
              <i className="ph-fill ph-paper-plane-right" />
            </button>
          </div>
        </div>
      </section>
    </ParentLayout>
  );
}
