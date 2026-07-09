import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HANDOFF_ROUTE_MAP, PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import mascot from '../../assets/characters/catchap-logo.png';
import './SearchPage.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SearchItem {
  title: string;
  tag: string;
  desc: string;
  icon: string;
  bg: string;
  color: string;
  href: string;
  kw: string;
}

// TODO(api): 백엔드 미구현 — studentApi.searchContent 실패/무응답 시 원본 DCLogic ITEMS 그대로 로컬 필터링
const FALLBACK: SearchItem[] = [
  { title: '국어', tag: '과목', desc: '낱말·문장·글의 속뜻을 익히는 국어 한 판', icon: 'ph-fill ph-book-open', bg: '#FFE7E2', color: '#FF5A4D', href: 'CatChap 한글낱말.dc.html', kw: '국어 한글 낱말 글자 읽기 kor' },
  { title: '영어', tag: '과목', desc: '단어·문장·문법으로 배우는 영어 한 판', icon: 'ph-fill ph-translate', bg: '#FFEDE0', color: '#FF922E', href: 'CatChap 숫자놀이터.dc.html', kw: '영어 알파벳 단어 eng english' },
  { title: '수학', tag: '과목', desc: '수·연산·도형·측정을 배우는 수학 한 판', icon: 'ph-fill ph-plus-minus', bg: '#E1F5EC', color: '#17B08C', href: 'CatChap 끌어놓기.dc.html', kw: '수학 숫자 셈 덧셈 뺄셈 연산 math' },
  { title: '과학', tag: '과목', desc: '관찰하고 탐구하는 과학 한 판', icon: 'ph-fill ph-flask', bg: '#E6F0FF', color: '#2E7BFF', href: 'CatChap 그림찾기.dc.html', kw: '과학 관찰 탐구 실험 sci' },
  { title: '사회', tag: '과목', desc: '지도·지역·공공기관을 알아가는 사회 한 판', icon: 'ph-fill ph-scroll', bg: '#EDE6FF', color: '#8B6BFF', href: 'CatChap 안전지킴이.dc.html', kw: '사회 이야기 옛날 soc' },
  { title: '생활', tag: '과목', desc: '생활 속 안전과 지혜를 배우는 생활 한 판', icon: 'ph-fill ph-house-line', bg: '#FFE9F1', color: '#FF6DA6', href: 'CatChap 미로탐험.dc.html', kw: '생활 안전 지혜 life' },
  { title: '한글 낱말 찾기', tag: '놀이', desc: '그림을 보고 알맞은 낱말 고르기', icon: 'ph-fill ph-text-aa', bg: '#FFE7E2', color: '#FF5A4D', href: 'CatChap 한글낱말.dc.html', kw: '한글 낱말 찾기 글자 단어' },
  { title: '숫자 놀이터', tag: '놀이', desc: '더하기·빼기 답을 상자에 담기', icon: 'ph-fill ph-calculator', bg: '#FFEDE0', color: '#FF922E', href: 'CatChap 숫자놀이터.dc.html', kw: '숫자 놀이터 더하기 빼기 계산' },
  { title: '끌어놓기 놀이', tag: '놀이', desc: '정답 카드를 목표 칸으로 드래그', icon: 'ph-fill ph-hand-grabbing', bg: '#E1F5EC', color: '#17B08C', href: 'CatChap 끌어놓기.dc.html', kw: '끌어놓기 드래그 카드 분류' },
  { title: '그림 찾기 퀴즈', tag: '놀이', desc: '조건에 맞는 그림을 골라요', icon: 'ph-fill ph-image', bg: '#E6F0FF', color: '#2E7BFF', href: 'CatChap 그림찾기.dc.html', kw: '그림 찾기 퀴즈 이미지 사진' },
  { title: '안전 지킴이', tag: '놀이', desc: '안전한 행동과 위험한 것 구분', icon: 'ph-fill ph-shield-check', bg: '#EDE6FF', color: '#8B6BFF', href: 'CatChap 안전지킴이.dc.html', kw: '안전 지킴이 위험 생활안전' },
  { title: '냥이 미로 탐험', tag: '놀이', desc: '고양이를 생선가게까지 데려가기', icon: 'ph-fill ph-path', bg: '#FFE9F1', color: '#FF6DA6', href: 'CatChap 미로탐험.dc.html', kw: '미로 탐험 냥이 길찾기 경로' },
  { title: '오늘의 퀴즈', tag: '바로가기', desc: '오늘 할당된 퀴즈 풀기', icon: 'ph-fill ph-lightning', bg: '#FFF3D6', color: '#F0A400', href: 'CatChap 오늘의퀴즈.dc.html', kw: '오늘 퀴즈 할당 데일리' },
  { title: '배지', tag: '바로가기', desc: '모은 배지와 보상 확인', icon: 'ph-fill ph-medal', bg: '#FFF3D6', color: '#F0A400', href: 'CatChap 배지.dc.html', kw: '배지 보상 상장 트로피' },
  { title: '마이페이지', tag: '바로가기', desc: '내 프로필 꾸미기와 정보', icon: 'ph-fill ph-cat', bg: '#FFE9F1', color: '#FF6DA6', href: 'CatChap 프로필 꾸미기.dc.html', kw: '마이페이지 프로필 꾸미기 냥코인' },
];

const POPULAR = [
  { label: '오늘의 퀴즈', icon: 'ph-fill ph-lightning', color: '#F0A400', bg: '#FFF3D6', href: 'CatChap 오늘의퀴즈.dc.html' },
  { label: '전체 학습', icon: 'ph-fill ph-squares-four', color: '#17B08C', bg: '#E1F5EC', href: 'CatChap 전체학습.dc.html' },
  { label: '한글 낱말', icon: 'ph-fill ph-text-aa', color: '#FF5A4D', bg: '#FFE7E2', href: 'CatChap 한글낱말.dc.html' },
  { label: '숫자 놀이터', icon: 'ph-fill ph-calculator', color: '#FF922E', bg: '#FFEDE0', href: 'CatChap 숫자놀이터.dc.html' },
  { label: '끌어놓기 놀이', icon: 'ph-fill ph-hand-grabbing', color: '#17B08C', bg: '#E1F5EC', href: 'CatChap 끌어놓기.dc.html' },
  { label: '그림 찾기', icon: 'ph-fill ph-image', color: '#2E7BFF', bg: '#E6F0FF', href: 'CatChap 그림찾기.dc.html' },
  { label: '미로 탐험', icon: 'ph-fill ph-path', color: '#FF6DA6', bg: '#FFE9F1', href: 'CatChap 미로탐험.dc.html' },
  { label: '안전 지킴이', icon: 'ph-fill ph-shield-check', color: '#8B6BFF', bg: '#EDE6FF', href: 'CatChap 안전지킴이.dc.html' },
  { label: '배지', icon: 'ph-fill ph-medal', color: '#F0A400', bg: '#FFF3D6', href: 'CatChap 배지.dc.html' },
  { label: '나의 기록', icon: 'ph-fill ph-chart-line-up', color: '#8B6BFF', bg: '#EDE6FF', href: 'CatChap 나의기록.dc.html' },
  { label: 'AI 선생님', icon: 'ph-fill ph-robot', color: '#2E7BFF', bg: '#E6F0FF', href: 'CatChap AI선생님.dc.html' },
  { label: '오답 노트', icon: 'ph-fill ph-note-pencil', color: '#FF5A4D', bg: '#FFE7E2', href: 'CatChap 오답노트.dc.html' },
  { label: '다시 풀 문제', icon: 'ph-fill ph-target', color: '#FF6DA6', bg: '#FFE9F1', href: 'CatChap 취약문제추천.dc.html' },
  { label: '마이페이지', icon: 'ph-fill ph-cat', color: '#FF922E', bg: '#FFEDE0', href: 'CatChap 프로필 꾸미기.dc.html' },
  { label: '알림', icon: 'ph-fill ph-bell', color: '#F0A400', bg: '#FFF3D6', href: 'CatChap 알림.dc.html' },
  { label: '설정', icon: 'ph-fill ph-gear', color: '#8B6BFF', bg: '#EDE6FF', href: 'CatChap 설정.dc.html' },
];

/**
 * 존재하지 않는 개별 게임 파일 링크 → `${PATHS.STUDENT_GAME}?subject=<과목>` 통일.
 * 과목은 원본 ITEMS의 과목 카드가 가리키는 파일 기준(HANDOFF_ROUTE_MAP의 한글낱말/그림찾기 매핑과 동일 규칙).
 */
const GAME_FILE_SUBJECT: Record<string, string> = {
  'CatChap 한글낱말.dc.html': '국어',
  'CatChap 숫자놀이터.dc.html': '영어',
  'CatChap 끌어놓기.dc.html': '수학',
  'CatChap 그림찾기.dc.html': '과학',
  'CatChap 안전지킴이.dc.html': '사회',
  'CatChap 미로탐험.dc.html': '생활',
};

function mapHref(href: string): string {
  if (href.startsWith('/')) return href; // API가 route를 직접 줄 경우
  const [file, query] = href.split('?');
  const subject = GAME_FILE_SUBJECT[file];
  if (subject) return `${PATHS.STUDENT_GAME}?subject=${subject}`;
  const route = HANDOFF_ROUTE_MAP[file];
  if (!route) return PATHS.STUDENT_HOME;
  return query ? `${route}?${query}` : route;
}

/** 원본 tagStyle(tag) → 클래스 매핑 */
const tagClass = (tag: string) =>
  tag === '과목' ? 'sp-tag sp-tag-subject' : tag === '놀이' ? 'sp-tag sp-tag-game' : 'sp-tag sp-tag-etc';

function saveRecent(recent: string[]) {
  try {
    localStorage.setItem('catchap_recent', JSON.stringify(recent));
  } catch {
    /* 원본과 동일: 저장 실패 무시 */
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  // 원본 componentDidMount의 localStorage('catchap_recent') 로드 그대로
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const r = JSON.parse(localStorage.getItem('catchap_recent') || '[]');
      return Array.isArray(r) ? r.slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const [, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const [apiItems, setApiItems] = useState<SearchItem[] | null>(null);

  // 실시간 필터: 입력할 때마다 searchContent(q) 호출, 실패 시 로컬 필터(FALLBACK) 사용
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setApiItems(null);
      return;
    }
    let stale = false;
    studentApi
      .searchContent(q)
      .then((data) => {
        if (stale) return;
        // API 응답 형태: { query, count, results:[{title,tag,desc,icon,href,meta}] }
        // (배열 직접 응답 / items 키도 방어적으로 지원)
        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.items)
              ? data.items
              : null;
        if (!raw) {
          setApiItems(null);
          return;
        }
        const mapped: SearchItem[] = raw.map((r: any) => ({
          title: String(r.title ?? ''),
          tag: String(r.tag ?? '기타'),
          desc: String(r.desc ?? ''),
          icon: String(r.icon ?? 'ph-fill ph-sparkle'),
          bg: r.bg ?? r.meta?.soft ?? '#F1EFF7',
          color: r.color ?? r.meta?.color ?? '#8B6BFF',
          href: String(r.href ?? ''),
          kw: String(r.kw ?? ''),
        }));
        // 결과가 있으면 API 사용, 비어 있으면 로컬 FALLBACK 필터로 (실패 시에도 로컬)
        setApiItems(mapped.length ? mapped : null);
      })
      .catch(() => {
        if (!stale) setApiItems(null);
      });
    return () => {
      stale = true;
    };
  }, [query]);

  const addRecent = (term: string) => {
    const t = (term || '').trim();
    if (!t) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, 6);
      saveRecent(next);
      return next;
    });
  };

  const removeRecent = (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== term);
      saveRecent(next);
      return next;
    });
  };

  const clearRecent = () => {
    saveRecent([]);
    setRecent([]);
  };

  // 원본 startVoice — Web Speech API 로직 그대로 보존.
  // 단, 원본 마크업에는 음성 버튼이 없어 트리거 UI가 없다(원본에 없는 UI 추가 금지).
  // 미지원 브라우저 alert() 안내는 alert 금지 규칙으로 제거. // TODO(voice-ui)
  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* 원본과 동일: stop 실패 무시 */
      }
    }
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setQuery(t);
      addRecent(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };
  void startVoice;

  // 원본 renderVals() 그대로
  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;
  const localMatched = hasQuery
    ? FALLBACK.filter((it) => (it.title + ' ' + it.kw + ' ' + it.desc).toLowerCase().includes(q))
    : [];
  const results = hasQuery ? (apiItems ?? localMatched) : [];
  const showSuggest = !hasQuery;
  const hasRecent = recent.length > 0;
  const noResults = hasQuery && results.length === 0;

  return (
    <div className="sp-root">
      {/* NAV — 검색 전용 축약 NAV(닫기)라 학습 홈 NAV와 달라 페이지 자체 구현 */}
      <div className="sp-nav">
        <div className="sp-navinner">
          <Link to={PATHS.STUDENT_HOME} className="sp-logo">
            <img src={mascot} alt="CatChap" className="sp-logoimg" />
            <span className="sp-logotitle">CatChap</span>
          </Link>
          <div className="sp-spacer" />
          <Link to={PATHS.STUDENT_HOME} className="sp-close">
            <i className="ph-bold ph-x" />
            닫기
          </Link>
        </div>
      </div>

      <div className="sp-container">
        {/* BIG SEARCH FIELD */}
        <div className="sp-searchwrap">
          <i className="ph-bold ph-magnifying-glass sp-searchicon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRecent(query);
            }}
            autoFocus
            placeholder="무엇을 배우고 싶어요? 눌러서 골라도 돼요!"
            className="sp-input"
          />
          <div className="sp-inputbtns">
            {hasQuery && (
              <button onClick={() => setQuery('')} title="지우기" className="sp-clearbtn">
                <i className="ph-bold ph-x" />
              </button>
            )}
          </div>
        </div>

        {/* EMPTY STATE */}
        {showSuggest && (
          <div className="sp-suggest">
            {/* 인기 검색어 / 자주 찾는 놀이 */}
            <div className="sp-popular">
              <div className="sp-cardhead">
                <span className="sp-cardicon">
                  <i className="ph-fill ph-fire" />
                </span>
                <h2 className="sp-cardtitle">인기 검색어 · 자주 찾는 놀이</h2>
              </div>
              <div className="sp-popchips">
                {POPULAR.map((c) => (
                  <Link key={c.label} to={mapHref(c.href)} className="sp-popchip">
                    <span className="sp-popicon" style={{ background: c.bg, color: c.color }}>
                      <i className={c.icon} />
                    </span>
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* 최근에 찾아봤어요 */}
            {hasRecent && (
              <div className="sp-recent">
                <div className="sp-recenthead">
                  <span className="sp-recenticon">
                    <i className="ph-fill ph-clock-counter-clockwise" />
                  </span>
                  <h2 className="sp-recenttitle">최근에 찾아봤어요</h2>
                  <button onClick={clearRecent} className="sp-clearall">
                    모두 지우기
                  </button>
                </div>
                <div className="sp-recentchips">
                  {recent.map((label) => (
                    <div key={label} className="sp-recentchip">
                      <button onClick={() => setQuery(label)} className="sp-recentfill">
                        <i className="ph-bold ph-arrow-counter-clockwise" />
                        {label}
                      </button>
                      <button onClick={() => removeRecent(label)} title="지우기" className="sp-recentremove">
                        <i className="ph-bold ph-x" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESULT COUNT */}
        {hasQuery && (
          <div className="sp-count">
            <b>{query}</b> 검색 결과 {results.length}개
          </div>
        )}

        {/* RESULTS */}
        <div className="sp-results">
          {results.map((r) => (
            <Link key={`${r.tag}:${r.title}`} to={mapHref(r.href)} className="sp-result">
              <span className="sp-resulticon" style={{ background: r.bg, color: r.color }}>
                <i className={r.icon} />
              </span>
              <div className="sp-resultbody">
                <div className="sp-resulttitlerow">
                  <span className="sp-resulttitle">{r.title}</span>
                  <span className={tagClass(r.tag)}>{r.tag}</span>
                </div>
                <div className="sp-resultdesc">{r.desc}</div>
              </div>
              <i className="ph-bold ph-arrow-right sp-resultarrow" />
            </Link>
          ))}
        </div>

        {/* NO RESULTS */}
        {noResults && (
          <div className="sp-noresults">
            <div className="sp-nofloat">
              <img src={mascot} alt="마스코트" className="sp-noimg" />
            </div>
            <h2 className="sp-notitle">찾는 놀이가 없어요</h2>
            <p className="sp-notext">다른 낱말로 검색해 보거나, 위 추천에서 골라봐요!</p>
          </div>
        )}
      </div>
    </div>
  );
}
