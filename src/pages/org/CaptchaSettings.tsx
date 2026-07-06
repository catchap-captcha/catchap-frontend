import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { orgApi } from '../../api/org';
import OrgLayout from '../../layouts/OrgLayout';
import './CaptchaSettings.css';

/** handoff `CatChap 캡차설정.dc.html` 포팅 — 로그인 캡차 설정 */

type TypeId = 'img' | 'word' | 'drag' | 'num';

const TYPES: { id: TypeId; name: string; desc: string; icon: string; diff: string; bg: string; color: string }[] = [
  { id: 'img', name: '이미지 선택형', desc: '여러 그림 중 조건에 맞는 것을 골라요. (예: 고양이만 선택)', icon: 'ph-fill ph-image', diff: '쉬움', bg: '#E6F0FF', color: '#2E7BFF' },
  { id: 'word', name: '낱말 선택형', desc: '그림을 보고 알맞은 한글 낱말을 골라요.', icon: 'ph-fill ph-text-aa', diff: '보통', bg: '#FFE7E2', color: '#FF5A4D' },
  { id: 'drag', name: '끌어놓기형', desc: '카드를 알맞은 상자로 드래그해요.', icon: 'ph-fill ph-hand-grabbing', diff: '보통', bg: '#E1F5EC', color: '#17B08C' },
  { id: 'num', name: '숫자 연산형', desc: '간단한 더하기·빼기 정답을 입력해요.', icon: 'ph-fill ph-plus-minus', diff: '어려움', bg: '#FFF3D6', color: '#F0A400' },
];

// TODO(api): orgApi.captchaSettings 실패 시 원본 하드코딩 초기값 유지
const FALLBACK_ACTIVE: Record<TypeId, boolean> = { img: true, word: true, drag: true, num: false };
const FALLBACK_COUNT = 3;
const FALLBACK_SHUFFLE = true;

// 백엔드 CaptchaSetting.active_types 키 ↔ 화면 TypeId 매핑
const API_TYPE_KEY: Record<TypeId, string> = {
  img: 'image_select',
  word: 'word_select',
  drag: 'drag',
  num: 'arithmetic',
};

function diffClass(diff: string) {
  if (diff === '쉬움') return 'cs-diff cs-diffEasy';
  if (diff === '보통') return 'cs-diff cs-diffNormal';
  return 'cs-diff cs-diffHard';
}

export default function CaptchaSettings() {
  const { me } = useAuth();
  const orgId = me?.organization_id ?? null;

  const [active, setActive] = useState<Record<TypeId, boolean>>(FALLBACK_ACTIVE);
  const [count, setCount] = useState(FALLBACK_COUNT);
  const [shuffle, setShuffle] = useState(FALLBACK_SHUFFLE);
  const [previewIds, setPreviewIds] = useState<TypeId[]>([]);
  const [saved, setSaved] = useState(false);
  // 새로 뽑을 때마다 csIn 애니메이션을 다시 재생하기 위한 시퀀스
  const [rollSeq, setRollSeq] = useState(0);
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;

  const activeTypes = useCallback(
    (a?: Record<TypeId, boolean>) => {
      const src = a || active;
      return TYPES.filter((t) => src[t.id]);
    },
    [active],
  );

  const effCount = useCallback(
    (a?: Record<TypeId, boolean>, c?: number) => {
      const n = activeTypes(a).length;
      return Math.max(0, Math.min(c == null ? count : c, n));
    },
    [activeTypes, count],
  );

  const reroll = useCallback(
    (a?: Record<TypeId, boolean>, c?: number, sh?: boolean) => {
      const pool = activeTypes(a).slice();
      const useShuffle = sh == null ? shuffleRef.current : sh;
      if (useShuffle) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }
      const k = effCount(a, c);
      setPreviewIds(pool.slice(0, k).map((t) => t.id));
      setRollSeq((s) => s + 1);
    },
    [activeTypes, effCount],
  );

  // 원본 componentDidMount: 첫 미리보기 + API 설정 로드
  useEffect(() => {
    reroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let on = true;
    orgApi
      .captchaSettings(orgId)
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .then((res: any) => {
        if (!on || !res || typeof res !== 'object') return;
        const nextActive: Record<TypeId, boolean> = { ...FALLBACK_ACTIVE };
        // 백엔드 필드명: active_types {image_select, word_select, drag, arithmetic} (구 active {img,...}도 허용)
        const src = res.active_types ?? res.active;
        if (src && typeof src === 'object') {
          (Object.keys(nextActive) as TypeId[]).forEach((k) => {
            const v = src[API_TYPE_KEY[k]] ?? src[k];
            if (typeof v === 'boolean') nextActive[k] = v;
          });
        }
        if (TYPES.every((t) => !nextActive[t.id])) return; // 최소 1종 유지
        const rawCount =
          typeof res.round_count === 'number' ? res.round_count : typeof res.count === 'number' ? res.count : FALLBACK_COUNT;
        const nextCount = Math.min(rawCount, TYPES.filter((t) => nextActive[t.id]).length);
        const nextShuffle = typeof res.shuffle === 'boolean' ? res.shuffle : FALLBACK_SHUFFLE;
        setActive(nextActive);
        setCount(nextCount);
        setShuffle(nextShuffle);
        reroll(nextActive, nextCount, nextShuffle);
      })
      .catch(() => {
        // TODO(api): 실패 시 FALLBACK 유지
      });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const toggle = (id: TypeId) => {
    const next = { ...active, [id]: !active[id] };
    if (activeTypes(next).length === 0) return; // 최소 1종 유지
    const nextCount = Math.min(count, activeTypes(next).length);
    setActive(next);
    setCount(nextCount);
    setSaved(false);
    reroll(next, nextCount);
  };

  const pickCount = (n: number) => {
    const nextCount = Math.min(n, activeTypes().length);
    setCount(nextCount);
    setSaved(false);
    reroll(undefined, nextCount);
  };

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffle(next);
    setSaved(false);
    reroll(undefined, undefined, next);
  };

  const save = () => {
    setSaved(true);
    if (orgId) {
      // 백엔드 CaptchaSettingsUpdate 스키마: {active_types, round_count, shuffle}
      orgApi
        .saveCaptchaSettings(orgId, {
          active_types: {
            image_select: active.img,
            word_select: active.word,
            drag: active.drag,
            arithmetic: active.num,
          },
          round_count: count,
          shuffle,
        })
        .catch(() => {
          // TODO(api): 실패 시에도 원본과 동일하게 '저장됨' 상태 유지
        });
    }
  };

  const activeCount = activeTypes().length;
  const eff = effCount();
  const byId = Object.fromEntries(TYPES.map((t) => [t.id, t]));

  return (
    <OrgLayout active="api" widget="pro">
      {/* HEADER */}
      <div className="cs-header">
        <div>
          <div className="cs-breadcrumb">
            <a href="#" onClick={(e) => e.preventDefault()}>API·사이트</a>
            <i className="ph-bold ph-caret-right" />
            <span>캡차 설정</span>
          </div>
          <h1 className="cs-title">로그인 캡차 설정</h1>
          <p className="cs-subtitle">로그인 화면에 노출할 캡차 종류를 켜고 끄고, 매 로그인마다 몇 개를 랜덤으로 낼지 정해요.</p>
        </div>
        <button className="cs-saveBtn" onClick={save}>
          <i className={saved ? 'ph-fill ph-check' : 'ph-fill ph-floppy-disk'} />
          {saved ? '저장됨' : '설정 저장'}
        </button>
      </div>

      {/* SUMMARY BAR */}
      <div className="cs-summary">
        <span className="cs-summaryMain">
          <i className="ph-fill ph-shuffle" />활성 {activeCount}종 중 매 로그인 {eff}개 랜덤 출제
        </span>
        <span className="cs-summaryHint">
          {activeCount <= 1 ? '한 종류만 활성화되어 항상 같은 캡차가 나와요.' : '활성 종류가 많을수록 예측이 어려워 보안에 유리해요.'}
        </span>
      </div>

      <div className="cs-grid">
        {/* CAPTCHA TYPE LIST */}
        <div className="cs-typeList">
          {TYPES.map((t) => {
            const on = !!active[t.id];
            return (
              <div className={on ? 'cs-typeCard cs-typeCardOn' : 'cs-typeCard'} key={t.id}>
                <span className="cs-typeIcon" style={{ background: t.bg, color: t.color }}>
                  <i className={t.icon} />
                </span>
                <div className="cs-typeBody">
                  <div className="cs-typeNameRow">
                    <span className="cs-typeName">{t.name}</span>
                    <span className={diffClass(t.diff)}>{t.diff}</span>
                  </div>
                  <div className="cs-typeDesc">{t.desc}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  className={on ? 'cs-switch cs-switchOn' : 'cs-switch'}
                  onClick={() => toggle(t.id)}
                >
                  <span className="cs-knob" />
                </button>
              </div>
            );
          })}
          <div className="cs-warn">
            <i className="ph-fill ph-warning-circle" />
            <span>
              최소 1종은 활성화되어 있어야 해요. 어린이 조작 미숙과 봇 탐지는 분리되어 채점되며, 난이도가 높을수록
              저학년에게는 자동으로 쉬운 종류가 우선 배정돼요.
            </span>
          </div>
        </div>

        {/* SETTINGS PANEL */}
        <div className="cs-panel">
          <div className="cs-panelCard">
            <h3 className="cs-panelTitle">라운드당 호출 개수</h3>
            <p className="cs-panelSub">한 번 로그인할 때 낼 캡차 수예요. 활성 종류 수({activeCount})까지 고를 수 있어요.</p>
            <div className="cs-countRow">
              {[1, 2, 3, 4].map((n) => {
                const disabled = n > activeCount;
                const on = n === count;
                return (
                  <button
                    key={n}
                    className={
                      disabled ? 'cs-countChip cs-countChipOff' : on ? 'cs-countChip cs-countChipOn' : 'cs-countChip'
                    }
                    onClick={() => {
                      if (!disabled) pickCount(n);
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="cs-shuffleRow">
              <div>
                <div className="cs-shuffleTitle">종류 순서 랜덤</div>
                <div className="cs-shuffleSub">끄면 항상 같은 순서로 출제</div>
              </div>
              <button
                role="switch"
                aria-checked={shuffle}
                className={shuffle ? 'cs-switch cs-switchOn' : 'cs-switch'}
                onClick={toggleShuffle}
              >
                <span className="cs-knob" />
              </button>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="cs-panelCard">
            <div className="cs-previewHead">
              <h3 className="cs-previewTitle">다음 로그인 미리보기</h3>
              <button className="cs-rerollBtn" onClick={() => reroll()}>
                <i className="ph-bold ph-dice-five" />새로 뽑기
              </button>
            </div>
            <div className="cs-previewList">
              {previewIds.map((id, i) => {
                const t = byId[id];
                return (
                  <div className="cs-previewItem" key={`${rollSeq}-${id}`}>
                    <span className="cs-previewOrder">{i + 1}</span>
                    <span className="cs-previewIcon" style={{ background: t.bg, color: t.color }}>
                      <i className={t.icon} />
                    </span>
                    <span className="cs-previewName">{t.name}</span>
                    <span className={`cs-previewDiff ${diffClass(t.diff)}`}>{t.diff}</span>
                  </div>
                );
              })}
            </div>
            <p className="cs-previewNote">실제 로그인 시 이 순서로 캡차가 제시돼요. 새로 뽑기를 눌러 랜덤 결과를 확인하세요.</p>
          </div>
        </div>
      </div>
    </OrgLayout>
  );
}
