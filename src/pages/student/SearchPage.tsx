import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HANDOFF_ROUTE_MAP, PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import './SearchPage.css';
import { StudentNav } from '../../layouts/StudentLayout';

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

// 성인화(0720): 옛 아동 게임/놀이/배지/냥코인 카탈로그·죽은 .dc.html 링크를 걷어내고
// 앱의 실제 성인 인강 섹션으로 교체(모두 실제 route). searchContent(강의 검색) 무응답 시
// 이 목록을 로컬 필터링해 '섹션 바로가기'로 쓴다.
const FALLBACK: SearchItem[] = [
  { title: '강의', tag: '바로가기', desc: '수강 중인 강의를 이어 보거나 새 강의를 찾아요', icon: 'ph-fill ph-monitor-play', bg: 'var(--brand-soft)', color: 'var(--brand-ink)', href: PATHS.STUDENT_LECTURES, kw: '강의 영상 수강 lecture 시청' },
  { title: '문제은행', tag: '바로가기', desc: '코스 문항을 연습하고 오늘의 Q로 복습해요', icon: 'ph-fill ph-squares-four', bg: 'var(--ok-soft)', color: 'var(--ok-ink)', href: PATHS.STUDENT_ALL_LEARNING, kw: '문제은행 연습 오늘의 Q 복습 bank' },
  { title: '틀린 문제', tag: '바로가기', desc: '틀린 문항을 다시 풀어 복습해요', icon: 'ph-fill ph-notebook', bg: 'var(--danger-soft)', color: 'var(--danger-ink)', href: PATHS.STUDENT_WRONG_NOTES, kw: '틀린 문제 오답 복습 wrong' },
  { title: '나의 기록', tag: '바로가기', desc: '수강·완주·수료와 학습 통계를 확인해요', icon: 'ph-fill ph-chart-line-up', bg: 'var(--info-soft)', color: 'var(--info-ink)', href: PATHS.STUDENT_RECORDS, kw: '나의 기록 통계 수료 진도 records' },
  { title: '알림', tag: '바로가기', desc: '학습·수료 소식을 확인해요', icon: 'ph-fill ph-bell', bg: 'var(--warn-soft)', color: 'var(--warn-ink)', href: PATHS.STUDENT_NOTIFICATIONS, kw: '알림 소식 notification' },
  { title: '설정', tag: '바로가기', desc: '화면·알림·계정을 설정해요', icon: 'ph-fill ph-gear', bg: 'var(--surface-2)', color: 'var(--ink-2)', href: PATHS.STUDENT_SETTINGS, kw: '설정 계정 다크 모드 settings' },
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
  if (subject) return `${PATHS.STUDENT_GAME}?subject=${subject}&bank=1`;
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
      {/* NAV — 공용 StudentNav로 통일(사용자 결정 0714) */}
      <StudentNav />

      <div className="sp-container">
        {/* HERO — 검색 랜딩을 담백하게 채운다(넓은 빈 화면 대신 목적을 먼저 말해준다) */}
        <div className="sp-hero">
          <span className="sp-herobadge">
            <i className="ph-fill ph-magnifying-glass" /> 통합 검색
          </span>
          <h1 className="sp-herotitle">무엇을 찾고 있나요?</h1>
          <p className="sp-herosub">강의 · 문제은행 · 나의 기록을 한 번에 검색하세요.</p>
        </div>

        {/* BIG SEARCH FIELD */}
        <div className="sp-searchwrap">
          <i className="ph ph-magnifying-glass sp-searchicon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRecent(query);
            }}
            autoFocus
            placeholder="강의·문제·기록 검색 — 원하는 항목을 눌러도 돼요"
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
                  <i className="ph-fill ph-compass" />
                </span>
                <h2 className="sp-cardtitle">바로가기</h2>
              </div>
              <div className="sp-shortcutgrid">
                {FALLBACK.map((c) => (
                  <Link key={c.title} to={mapHref(c.href)} className="sp-shortcut">
                    <span className="sp-shortcuticon" style={{ background: c.bg, color: c.color }}>
                      <i className={c.icon} />
                    </span>
                    <span className="sp-shortcutbody">
                      <span className="sp-shortcuttitle">{c.title}</span>
                      <span className="sp-shortcutdesc">{c.desc}</span>
                    </span>
                    <i className="ph-bold ph-arrow-right sp-shortcutarrow" />
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
              <span className="sp-noicon">
                <i className="ph-fill ph-magnifying-glass" />
              </span>
            </div>
            <h2 className="sp-notitle">검색 결과가 없어요</h2>
            <p className="sp-notext">다른 검색어로 찾아보거나, 위 바로가기에서 골라 보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
