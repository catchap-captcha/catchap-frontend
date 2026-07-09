import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import ScreenTimeReminder from '../../components/motion/ScreenTimeReminder';
import mascot from '../../assets/characters/catchap-logo.png';
import './Concepts.css';

interface SubjectTheme {
  color: string;
  soft: string;
  band: string;
  grad: string;
  icon: string;
}

interface Concept {
  name: string;
  icon: string;
  summary: string;
  points: string[];
  example: string;
}

/* 원본 DCLogic SUBJECTS 그대로 */
const SUBJECTS: Record<string, SubjectTheme> = {
  '국어': { color: '#FF5A4D', soft: '#FFE0DB', band: 'linear-gradient(150deg,#FFE6E0,#FFD3CB)', grad: 'linear-gradient(150deg,#FF7A7A,#FF5A6E)', icon: 'ph-fill ph-book-open' },
  '영어': { color: '#FF922E', soft: '#FFEDD6', band: 'linear-gradient(150deg,#FFEFD9,#FFE0BE)', grad: 'linear-gradient(150deg,#FFB43C,#FF922E)', icon: 'ph-fill ph-translate' },
  '수학': { color: '#17B08C', soft: '#DFF6EE', band: 'linear-gradient(150deg,#E4F7F0,#CDEEE1)', grad: 'linear-gradient(150deg,#33C892,#17B0A0)', icon: 'ph-fill ph-plus-minus' },
  '과학': { color: '#2E7BFF', soft: '#E1EDFF', band: 'linear-gradient(150deg,#E9F1FF,#D3E3FF)', grad: 'linear-gradient(150deg,#4AA6FF,#2E7BFF)', icon: 'ph-fill ph-flask' },
  '사회': { color: '#8B6BFF', soft: '#EAE2FF', band: 'linear-gradient(150deg,#EFE9FF,#DED2FF)', grad: 'linear-gradient(150deg,#A98CFF,#8B6BFF)', icon: 'ph-fill ph-scroll' },
  '생활': { color: '#FF6DA6', soft: '#FFE3EF', band: 'linear-gradient(150deg,#FFE8F1,#FFD3E3)', grad: 'linear-gradient(150deg,#FF93BE,#FF6DA6)', icon: 'ph-fill ph-house-line' },
};

/* 원본 DCLogic CONCEPTS 그대로 (정적 콘텐츠) */
const CONCEPTS: Record<string, Concept[]> = {
  '국어': [
    { name: '자음·모음', icon: 'ph-fill ph-text-aa', summary: '글자는 자음과 모음이 만나 소리가 돼요.', points: ['ㄱ, ㄴ, ㄷ 같은 자음이 있어요.', 'ㅏ, ㅑ, ㅓ 같은 모음이 있어요.', '자음과 모음이 만나면 ‘가, 나, 다’가 돼요.'], example: 'ㄱ + ㅏ = 가 🐱' },
    { name: '낱말 읽기', icon: 'ph-fill ph-book-open', summary: '글자가 모이면 낱말이 돼요.', points: ['글자를 하나씩 이어서 읽어봐요.', '그림을 보면 낱말을 쉽게 떠올릴 수 있어요.', '소리 내어 읽으면 더 잘 외워져요.'], example: '고 + 양 + 이 = 고양이 🐈' },
    { name: '짧은 문장', icon: 'ph-fill ph-chat-text', summary: '낱말이 모이면 문장이 돼요.', points: ['누가 무엇을 하는지 담겨 있어요.', '문장 끝에는 마침표(.)를 찍어요.', '읽고 나서 어떤 장면인지 떠올려봐요.'], example: '고양이가 잠을 자요. 😴' },
    { name: '받아쓰기', icon: 'ph-fill ph-pencil-simple', summary: '소리 나는 대로 쓰지 않는 낱말이 있어요.', points: ['‘같이’는 [가치]로 소리 나요.', '‘꽃’은 받침 ㅊ을 잊지 말아요.', '헷갈리면 또박또박 천천히 써봐요.'], example: '‘같이’는 [가치]로 읽지만 ‘같이’로 써요.' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '지금까지 배운 국어를 모아 살펴봐요.', points: ['자음·모음, 낱말, 문장을 떠올려봐요.', '좋아하는 낱말을 소리 내어 읽어봐요.', '어렵던 낱말은 다시 한 번 써봐요.'], example: '오늘 배운 낱말로 짧은 문장을 만들어봐요!' },
  ],
  '영어': [
    { name: '알파벳', icon: 'ph-fill ph-translate', summary: '영어에는 26개의 알파벳이 있어요.', points: ['A부터 Z까지 순서가 있어요.', '큰 글자(대문자)와 작은 글자(소문자)가 있어요.', 'A-a, B-b처럼 짝이 있어요.'], example: 'A a   B b   C c 🐱' },
    { name: '파닉스 소리', icon: 'ph-fill ph-speaker-high', summary: '알파벳마다 소리가 있어요.', points: ['A는 ‘애’, B는 ‘브’ 소리가 나요.', '소리를 이어 붙이면 단어를 읽을 수 있어요.', '입 모양을 따라 하면 더 쉬워요.'], example: 'c-a-t → cat (고양이) 🐈' },
    { name: '쉬운 단어', icon: 'ph-fill ph-cards', summary: '그림과 함께 쉬운 단어를 익혀요.', points: ['cat, dog, sun처럼 짧은 단어부터 시작해요.', '그림을 보면 뜻을 쉽게 알 수 있어요.', '소리 내어 여러 번 말해봐요.'], example: 'sun ☀️ = 해' },
    { name: '짧은 문장', icon: 'ph-fill ph-chat-text', summary: '단어가 모이면 영어 문장이 돼요.', points: ['‘I am ~’, ‘It is ~’로 시작해봐요.', '단어 사이는 띄어 써요.', '문장 끝에는 마침표(.)를 붙여요.'], example: 'It is a cat. 🐱' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '배운 영어를 함께 정리해봐요.', points: ['알파벳 노래를 불러봐요.', '좋아하는 단어를 말해봐요.', '짧은 문장 하나를 소리 내어 읽어봐요.'], example: 'Hello! I am happy. 😊' },
  ],
  '수학': [
    { name: '수 세기', icon: 'ph-fill ph-hash', summary: '물건을 하나씩 세어 수를 알아봐요.', points: ['하나, 둘, 셋… 순서대로 세요.', '마지막에 센 수가 전체 개수예요.', '0은 ‘아무것도 없다’는 뜻이에요.'], example: '🍎🍎🍎 = 사과 3개' },
    { name: '더하기', icon: 'ph-fill ph-plus', summary: '두 수를 모으면 더 커져요.', points: ['＋는 ‘더한다’는 뜻이에요.', '그림을 합쳐서 세어봐요.', '2 + 3 은 5가 돼요.'], example: '🐱🐱 + 🐱🐱🐱 = 5마리' },
    { name: '빼기', icon: 'ph-fill ph-minus', summary: '있던 것에서 덜어내면 작아져요.', points: ['−는 ‘뺀다’는 뜻이에요.', '하나씩 지우며 세어봐요.', '5 − 2 는 3이 남아요.'], example: '🍪🍪🍪🍪🍪 에서 2개 먹으면 3개' },
    { name: '모양과 규칙', icon: 'ph-fill ph-shapes', summary: '모양에는 규칙이 숨어 있어요.', points: ['동그라미, 세모, 네모를 찾아봐요.', '반복되는 순서를 규칙이라 해요.', '다음에 올 모양을 맞혀봐요.'], example: '🔴🔵🔴🔵 다음은? 🔴' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '배운 수학을 놀이처럼 정리해요.', points: ['수를 세고, 더하고, 빼봐요.', '우리 주변의 모양을 찾아봐요.', '좋아하는 수로 문제를 만들어봐요.'], example: '간식을 세고 나눠보면 그게 수학이에요!' },
  ],
  '과학': [
    { name: '동물 친구', icon: 'ph-fill ph-paw-print', summary: '동물마다 사는 곳과 특징이 달라요.', points: ['새는 날고, 물고기는 헤엄쳐요.', '다리 수와 먹이가 서로 달라요.', '우리 주변 동물을 관찰해봐요.'], example: '고양이는 다리가 4개, 야옹 하고 울어요 🐈' },
    { name: '식물 관찰', icon: 'ph-fill ph-plant', summary: '식물은 자라면서 모습이 바뀌어요.', points: ['씨앗 → 싹 → 잎 → 꽃 순서로 자라요.', '물과 햇빛이 있어야 잘 자라요.', '잎, 줄기, 뿌리가 있어요.'], example: '씨앗을 심고 물을 주면 싹이 나요 🌱' },
    { name: '날씨와 계절', icon: 'ph-fill ph-cloud-sun', summary: '계절마다 날씨가 달라져요.', points: ['봄·여름·가을·겨울이 있어요.', '맑음, 비, 눈 같은 날씨가 있어요.', '날씨에 맞게 옷을 입어요.'], example: '겨울에는 눈이 오고 추워요 ❄️' },
    { name: '물과 공기', icon: 'ph-fill ph-drop', summary: '물과 공기는 보이거나 안 보여요.', points: ['물은 얼면 얼음, 끓으면 김이 돼요.', '공기는 안 보여도 우리 곁에 있어요.', '바람은 움직이는 공기예요.'], example: '물이 얼면 단단한 얼음이 돼요 🧊' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '배운 과학을 떠올려봐요.', points: ['동물, 식물, 날씨를 관찰해봐요.', '궁금한 걸 ‘왜?’ 하고 물어봐요.', '오늘 본 것 하나를 그려봐요.'], example: '창밖 날씨를 관찰하고 말해봐요!' },
  ],
  '사회': [
    { name: '옛날 사람들', icon: 'ph-fill ph-users-three', summary: '옛날 사람들은 지금과 다르게 살았어요.', points: ['동굴이나 초가집에서 살았어요.', '돌과 나무로 도구를 만들었어요.', '불을 사용하며 생활이 편해졌어요.'], example: '아주 먼 옛날엔 돌로 도구를 만들었어요 🪨' },
    { name: '위인 이야기', icon: 'ph-fill ph-crown', summary: '훌륭한 일을 한 위인이 있어요.', points: ['세종대왕은 한글을 만드셨어요.', '이순신 장군은 나라를 지켰어요.', '위인의 노력을 배울 수 있어요.'], example: '세종대왕님 덕분에 한글을 써요 👑' },
    { name: '우리 문화', icon: 'ph-fill ph-scroll', summary: '우리나라만의 멋진 문화가 있어요.', points: ['한복, 한옥, 한글이 있어요.', '설날·추석 같은 명절이 있어요.', '전통 놀이와 음식이 있어요.'], example: '설날에는 세배를 하고 떡국을 먹어요 🥢' },
    { name: '나라의 시작', icon: 'ph-fill ph-flag', summary: '우리나라는 아주 오래전에 시작됐어요.', points: ['단군 이야기가 전해져요.', '여러 나라가 있다가 하나가 됐어요.', '옛 이야기로 시작을 알 수 있어요.'], example: '먼 옛날의 이야기가 전해 내려와요 📜' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '배운 사회를 이야기처럼 정리해요.', points: ['옛날 사람들의 생활을 떠올려봐요.', '기억나는 위인을 말해봐요.', '좋아하는 옛이야기를 골라봐요.'], example: '가장 기억에 남는 이야기를 말해봐요!' },
  ],
  '생활': [
    { name: '교통 안전', icon: 'ph-fill ph-traffic-sign', summary: '길에서는 안전 약속을 지켜요.', points: ['초록불에 손 들고 건너요.', '좌우를 살피고 건너요.', '횡단보도로만 건너요.'], example: '초록불이 켜지면 좌우를 보고 건너요 🚦' },
    { name: '우리 집 안전', icon: 'ph-fill ph-house-line', summary: '집에서도 조심할 것이 있어요.', points: ['뜨거운 것, 날카로운 것은 조심해요.', '콘센트에 손을 넣지 않아요.', '위험할 땐 어른께 말해요.'], example: '가스나 불은 어른과 함께 다뤄요 🔥' },
    { name: '친구 사이', icon: 'ph-fill ph-hand-heart', summary: '친구와 사이좋게 지내는 방법이 있어요.', points: ['‘고마워’, ‘미안해’를 말해요.', '차례를 지키고 함께 나눠요.', '친구 이야기를 잘 들어줘요.'], example: '함께 놀 때는 차례를 지켜요 🤝' },
    { name: '건강 습관', icon: 'ph-fill ph-heartbeat', summary: '건강을 지키는 생활 습관이 있어요.', points: ['손을 자주 깨끗이 씻어요.', '골고루 먹고 물을 마셔요.', '일찍 자고 일찍 일어나요.'], example: '밥 먹기 전에 손을 깨끗이 씻어요 🧼' },
    { name: '종합 복습', icon: 'ph-fill ph-star', summary: '배운 생활 약속을 떠올려봐요.', points: ['안전 약속을 하나씩 말해봐요.', '오늘 지킨 좋은 습관을 칭찬해봐요.', '친구에게 다정하게 말해봐요.'], example: '오늘 지킨 안전 약속을 자랑해봐요!' },
  ],
};

const ORDER = ['국어', '영어', '수학', '과학', '사회', '생활'];

/* 원본 saveRead() 그대로 */
function saveRead(read: Record<string, boolean>) {
  try {
    localStorage.setItem('catchap_concepts_read', JSON.stringify(read));
  } catch {
    /* 원본과 동일: 저장 실패 무시 */
  }
}

/* 원본 componentDidMount의 localStorage 읽기 로직 그대로 */
function loadRead(): Record<string, boolean> {
  let read: unknown = null;
  try {
    const raw = localStorage.getItem('catchap_concepts_read');
    if (raw) read = JSON.parse(raw);
  } catch {
    /* 원본과 동일: 파싱 실패 시 기본값 */
  }
  if (!read || typeof read !== 'object') {
    // 읽음 상태는 서버(concept_reads 실테이블)에서 가져온다 — 가짜 시드 없음
    return {};
  }
  return read as Record<string, boolean>;
}

interface Detail {
  subjectName: string;
  num: number;
  name: string;
  summary: string;
  icon: string;
  color: string;
  soft: string;
  grad: string;
  points: string[];
  example: string;
  quizHref: string;
}

export default function Concepts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* 원본 componentDidMount: ?tab= 쿼리로 과목 탭 초기화 */
  const [tab, setTab] = useState<string>(() => {
    const t = searchParams.get('tab');
    if (t && (t === '전체' || SUBJECTS[t])) return t;
    return '전체';
  });
  const [read, setRead] = useState<Record<string, boolean>>(loadRead);
  const [openId, setOpenId] = useState<string | null>(null);

  /* 서버 읽음 상태를 가져와 localStorage와 병합 (실패 시 localStorage만 사용) */
  useEffect(() => {
    let mounted = true;
    studentApi
      .conceptReads()
      .then((ids) => {
        if (!mounted || !Array.isArray(ids)) return;
        // 서버(concept_reads)가 원본 — 과거 시드 등 로컬 잔여값은 서버 상태로 교체
        setRead(() => {
          const next: Record<string, boolean> = {};
          ids.forEach((id) => {
            if (typeof id === 'string') next[id] = true;
          });
          saveRead(next);
          return next;
        });
      })
      .catch(() => {
        // API 실패 시 localStorage만 사용
      });
    return () => {
      mounted = false;
    };
  }, []);

  /* 원본 markRead() + 서버 동기화(fire-and-forget) */
  const markRead = (id: string) => {
    if (read[id]) return;
    const next = { ...read, [id]: true };
    saveRead(next);
    setRead(next);
    studentApi.markConceptRead(id).catch(() => {
      // TODO(api): 실패 무시 (fire-and-forget)
    });
  };

  const openDetail = (id: string) => {
    markRead(id);
    setOpenId(id);
  };
  const closeDetail = () => setOpenId(null);

  const goQuiz = (subject: string, num: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigate(`${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(subject)}&chapter=${num}`);
  };

  /* 원본 renderVals(): total + readCount */
  let total = 0;
  let readCount = 0;
  ORDER.forEach((sub) => {
    (CONCEPTS[sub] || []).forEach((_, i) => {
      total += 1;
      if (read[`${sub}-${i + 1}`]) readCount += 1;
    });
  });

  const tabDefs = [{ key: '전체', icon: 'ph-fill ph-squares-four' }].concat(
    ORDER.map((sub) => ({ key: sub, icon: SUBJECTS[sub].icon })),
  );

  const visible = tab === '전체' ? ORDER : [tab];

  /* 원본 renderVals()의 detail */
  let d: Detail | null = null;
  if (openId) {
    const [sub, ns] = openId.split('-');
    const idx = parseInt(ns, 10) - 1;
    const c = (CONCEPTS[sub] || [])[idx];
    const s = SUBJECTS[sub];
    if (c && s) {
      d = {
        subjectName: sub,
        num: idx + 1,
        name: c.name,
        summary: c.summary,
        icon: c.icon,
        color: s.color,
        soft: s.soft,
        grad: s.grad,
        points: c.points,
        example: c.example,
        quizHref: `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(sub)}&chapter=${idx + 1}`,
      };
    }
  }

  return (
    <div className="cp-root">
      {/* NAV (축소형 — 원본 그대로) */}
      <div className="cp-nav">
        <div className="cp-navinner">
          <Link to={PATHS.STUDENT_HOME} className="cp-back">
            <i className="ph-bold ph-arrow-left" />
            뒤로
          </Link>
          <Link to={PATHS.STUDENT_HOME} className="cp-navlogo">
            <img src={mascot} alt="CatChap" className="cp-navlogoimg" />
            <span className="cp-navlogotitle">CatChap</span>
          </Link>
          <div className="cp-navspacer" />
          <Link to={PATHS.STUDENT_SEARCH} title="검색" className="cp-navsearch">
            <i className="ph-bold ph-magnifying-glass" />
          </Link>
        </div>
      </div>

      <div className="cp-container">
        {/* HEADER */}
        <section className="cp-herosec">
          <div className="cp-hero">
            <div className="cp-herocircle" />
            <div className="cp-heroleft">
              <span className="cp-herobadge">
                <i className="ph-fill ph-book-bookmark" />
                개념 설명
              </span>
              <h1 className="cp-herotitle">문제 풀기 전에 먼저 알아봐요 📖</h1>
              <p className="cp-herodesc">
                각 챕터에서 배우는 핵심 개념을 그림책처럼 짧고 편하게 모아뒀어요. 천천히 읽고 문제로 넘어가 봐요.
              </p>
              <div className="cp-heroprog">
                <span className="cp-heroprogicon">
                  <i className="ph-fill ph-check-circle" />
                </span>
                <span className="cp-heroprogtext">
                  {total}개 중 <span className="cp-heroprognum">{readCount}개</span> 읽어봤어요
                </span>
              </div>
            </div>
            <div className="cp-heroright">
              <div className="cp-herobubble">
                오늘은 이 개념부터
                <br />
                알아볼까요?
                <div className="cp-herobubbletail" />
              </div>
              <img src={mascot} alt="냥냥이" className="cp-heromascot" />
            </div>
          </div>
        </section>

        {/* SUBJECT FILTER TABS */}
        <section className="cp-tabssec">
          <div className="cp-tabsrow">
            {tabDefs.map((t) => {
              const active = tab === t.key;
              const c = t.key === '전체' ? '#FF5A4D' : SUBJECTS[t.key].color;
              return (
                <button
                  key={t.key}
                  className={`cp-tab${active ? ' cp-tab-on' : ''}`}
                  style={{ '--cp-c': c } as CSSProperties}
                  onClick={() => setTab(t.key)}
                >
                  <i className={t.icon} />
                  {t.key}
                </button>
              );
            })}
          </div>
        </section>

        {/* SUBJECT SECTIONS */}
        {visible.map((sub) => {
          const s = SUBJECTS[sub];
          return (
            <section key={sub} className="cp-section">
              <div className="cp-sechead">
                <span className="cp-secicon" style={{ background: s.soft, color: s.color }}>
                  <i className={s.icon} />
                </span>
                <div>
                  <h2 className="cp-sectitle">{sub}</h2>
                  <p className="cp-secsub">챕터 5개의 개념 노트</p>
                </div>
              </div>
              <div className="cp-grid">
                {(CONCEPTS[sub] || []).map((c, i) => {
                  const num = i + 1;
                  const id = `${sub}-${num}`;
                  const isRead = !!read[id];
                  return (
                    <div key={id} className="cp-card" onClick={() => openDetail(id)}>
                      <div className="cp-cardband" style={{ background: s.band }}>
                        <span className="cp-cardbandicon" style={{ color: s.color }}>
                          <i className={c.icon} />
                        </span>
                        {isRead ? (
                          <span className="cp-cardbadge cp-cardbadge-read">읽음</span>
                        ) : (
                          <span
                            className="cp-cardbadge"
                            style={{ background: '#fff', color: s.color, boxShadow: `0 6px 12px -6px ${s.color}` }}
                          >
                            새로운 개념
                          </span>
                        )}
                      </div>
                      <div className="cp-cardbody">
                        <div className="cp-cardchiprow">
                          <span className="cp-cardchip" style={{ color: s.color, background: s.soft }}>
                            챕터 {num}
                          </span>
                        </div>
                        <div className="cp-cardname">{c.name}</div>
                        <p className="cp-cardsummary">{c.summary}</p>
                        <div className="cp-cardfoot">
                          <span className="cp-cardstatus" style={{ color: isRead ? '#17B08C' : s.color }}>
                            <i className={isRead ? 'ph-fill ph-check-circle' : 'ph-fill ph-sparkle'} />
                            {isRead ? '다시 보기' : '처음 보는 개념'}
                          </span>
                          <button
                            className="cp-quizbtn"
                            style={{ background: s.color }}
                            onClick={(e) => goQuiz(sub, num, e)}
                          >
                            문제 풀어보기
                            <i className="ph-bold ph-arrow-right" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* DETAIL OVERLAY */}
      {d && (
        <div className="cp-overlay" onClick={closeDetail}>
          <div className="cp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cp-sheethead" style={{ background: d.grad }}>
              <button className="cp-sheetclose" title="닫기" onClick={closeDetail}>
                <i className="ph-bold ph-x" />
              </button>
              <span className="cp-sheeticon" style={{ color: d.color }}>
                <i className={d.icon} />
              </span>
              <span className="cp-sheetchip" style={{ color: d.color }}>
                {d.subjectName} · 챕터 {d.num}
              </span>
            </div>
            <div className="cp-sheetbody">
              <h2 className="cp-sheettitle">{d.name}</h2>
              <p className="cp-sheetsummary" style={{ color: d.color }}>
                {d.summary}
              </p>

              <div className="cp-pointslabel">이렇게 알아봐요</div>
              <div className="cp-points">
                {d.points.map((text, i) => (
                  <div key={i} className="cp-point">
                    <span className="cp-pointicon" style={{ background: d.soft, color: d.color }}>
                      <i className="ph-fill ph-paw-print" />
                    </span>
                    <span className="cp-pointtext">{text}</span>
                  </div>
                ))}
              </div>

              <div className="cp-example" style={{ background: d.soft }}>
                <span className="cp-exampleicon" style={{ color: d.color }}>
                  <i className="ph-fill ph-lightbulb" />
                </span>
                <div>
                  <div className="cp-examplelabel" style={{ color: d.color }}>
                    이런 걸 떠올려봐요
                  </div>
                  <div className="cp-exampletext">{d.example}</div>
                </div>
              </div>

              <div className="cp-sheetactions">
                <button className="cp-sheetback" onClick={closeDetail}>
                  다른 개념 보기
                </button>
                <Link
                  to={d.quizHref}
                  className="cp-sheetquiz"
                  style={{ background: d.color, boxShadow: `0 12px 24px -10px ${d.color}` }}
                >
                  문제 풀어보기 <i className="ph-fill ph-arrow-right" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScreenTimeReminder />
    </div>
  );
}
