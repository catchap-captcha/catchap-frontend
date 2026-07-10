import { useEffect, useRef, useState } from 'react';
import { orgApi, type Institution } from '../../api/org';
import './InstitutionPicker.css';

export interface PickedInstitution {
  id: string;
  // CatChap에 등록된 기관이면 그 organization_id, 미등록(디렉터리만 있는) 기관이면 null.
  // 교사/학생 가입에는 이 값이 필요하다 (institution.id가 아니라). null이면 가입 불가.
  organizationId: string | null;
  name: string;
  type: string;
  sido: string;
  sigungu: string;
  dong: string;
  road: string;
}

// TODO(api): API 실패 시 원본 handoff 하드코딩 8건 fallback (디자인 유지용)
const FALLBACK: PickedInstitution[] = [
  { id: 'haetsal-elem', organizationId: null, name: '햇살초등학교', type: '초등학교', sido: '서울특별시', sigungu: '강남구', dong: '역삼동', road: '서울 강남구 테헤란로 123' },
  { id: 'daechi-saem', organizationId: null, name: '대치샘유치원', type: '유치원', sido: '서울특별시', sigungu: '강남구', dong: '대치동', road: '서울 강남구 삼성로 456' },
  { id: 'gwangjin-saessak', organizationId: null, name: '광진 새싹초등학교', type: '초등학교', sido: '서울특별시', sigungu: '광진구', dong: '화양동', road: '서울 광진구 능동로 120' },
  { id: 'sanggye-forest', organizationId: null, name: '상계 푸른숲 어린이집', type: '어린이집', sido: '서울특별시', sigungu: '노원구', dong: '상계동', road: '서울 노원구 동일로 789' },
  { id: 'byeolbit-elem', organizationId: null, name: '별빛초등학교', type: '초등학교', sido: '경기도', sigungu: '성남시 분당구', dong: '정자동', road: '경기 성남시 분당구 불정로 55' },
  { id: 'gwanggyo-rainbow', organizationId: null, name: '광교 무지개유치원', type: '유치원', sido: '경기도', sigungu: '수원시 영통구', dong: '이의동', road: '경기 수원시 영통구 광교로 22' },
  { id: 'centum-pureunsol', organizationId: null, name: '센텀 푸른솔초등학교', type: '초등학교', sido: '부산광역시', sigungu: '해운대구', dong: '우동', road: '부산 해운대구 센텀로 30' },
  { id: 'haeundae-bada', organizationId: null, name: '해운대 바다어린이집', type: '어린이집', sido: '부산광역시', sigungu: '해운대구', dong: '좌동', road: '부산 해운대구 좌동순환로 40' },
];

const SHORT_SIDO: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
  '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
  '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주',
};

function shortSido(s: string) {
  return SHORT_SIDO[s] ?? s;
}

function pillClass(type: string) {
  if (type === '초등학교') return 'ip-pill ip-pill--elem';
  if (type === '유치원') return 'ip-pill ip-pill--kinder';
  if (type === '어린이집') return 'ip-pill ip-pill--daycare';
  return 'ip-pill ip-pill--etc';
}

function toPicked(o: Institution): PickedInstitution {
  return {
    id: o.id,
    organizationId: o.organization_id ?? null,
    name: o.name,
    type: o.type,
    sido: o.sido,
    sigungu: o.sigungu,
    dong: o.dong,
    road: o.road_address,
  };
}

function uniq(a: string[]) {
  return [...new Set(a)];
}

interface InstitutionPickerProps {
  onSelect?: (inst: PickedInstitution | null) => void;
  // 초대링크 프리필처럼 기관이 이미 정해진 경우 초기 선택값(마운트 시 1회 반영).
  initialSelected?: PickedInstitution | null;
}

export default function InstitutionPicker({ onSelect, initialSelected }: InstitutionPickerProps) {
  const [q, setQ] = useState('');
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [dong, setDong] = useState('');
  const [selected, setSelected] = useState<PickedInstitution | null>(initialSelected ?? null);
  const [open, setOpen] = useState(false);
  const [allOrgs, setAllOrgs] = useState<PickedInstitution[]>(FALLBACK);
  const [serverSearch, setServerSearch] = useState<PickedInstitution[] | null>(null);
  const [regionNames, setRegionNames] = useState<string[] | null>(null);
  const [serverRegion, setServerRegion] = useState<PickedInstitution[] | null>(null);
  const loadedAll = useRef(false);
  const searchSeq = useRef(0);
  const regionSeq = useRef(0);

  // level: 'sido' -> 'sigungu' -> 'dong' -> 'orgs' (원본 드릴다운 로직 그대로)
  let level: 'sido' | 'sigungu' | 'dong' | 'orgs' = 'sido';
  if (sido && sigungu && dong) level = 'orgs';
  else if (sido && sigungu) level = 'dong';
  else if (sido) level = 'sigungu';

  // 패널 첫 오픈 시 전체 기관 로드 (실패 시 FALLBACK 유지)
  useEffect(() => {
    if (!open || loadedAll.current) return;
    loadedAll.current = true;
    orgApi
      .searchInstitutions({})
      .then((list) => {
        if (list.length > 0) setAllOrgs(list.map(toPicked));
      })
      .catch(() => {
        /* TODO(api): fallback 유지 */
      });
  }, [open]);

  // 검색: 2글자 이상이면 서버 검색, 실패/대기 중엔 로컬 필터
  const qq = q.trim();
  const searching = qq.length >= 2;
  useEffect(() => {
    if (!searching) {
      setServerSearch(null);
      return;
    }
    const seq = ++searchSeq.current;
    orgApi
      .searchInstitutions({ q: qq })
      .then((list) => {
        if (searchSeq.current === seq) setServerSearch(list.map(toPicked));
      })
      .catch(() => {
        if (searchSeq.current === seq) setServerSearch(null);
      });
  }, [qq, searching]);

  // 지역 드릴다운: 단계별 지역 목록은 orgApi.regions, 최종 기관 목록은 searchInstitutions
  useEffect(() => {
    if (!open) return;
    const seq = ++regionSeq.current;
    setRegionNames(null);
    setServerRegion(null);
    if (level === 'orgs') {
      orgApi
        .searchInstitutions({ sido, sigungu, dong })
        .then((list) => {
          if (regionSeq.current === seq) setServerRegion(list.map(toPicked));
        })
        .catch(() => {
          if (regionSeq.current === seq) setServerRegion(null);
        });
      return;
    }
    const params = level === 'sido' ? {} : level === 'sigungu' ? { sido } : { sido, sigungu };
    orgApi
      .regions(params)
      .then((names) => {
        if (regionSeq.current === seq && names.length > 0) setRegionNames(names);
      })
      .catch(() => {
        if (regionSeq.current === seq) setRegionNames(null);
      });
  }, [open, level, sido, sigungu, dong]);

  const localSearch = searching
    ? allOrgs.filter((o) => o.name.includes(qq) || o.road.includes(qq))
    : [];
  const searchResults = serverSearch ?? localSearch;

  const countUnder = (filter: (o: PickedInstitution) => boolean) => allOrgs.filter(filter).length;

  let stepTitle = '';
  let levelOptions: Array<{ key: string; label: string; count: number; pick: () => void }> = [];
  if (level === 'sido') {
    stepTitle = '시 / 도를 선택하세요';
    const names = regionNames ?? uniq(allOrgs.map((o) => o.sido));
    levelOptions = names.map((v) => ({
      key: v,
      label: shortSido(v),
      count: countUnder((o) => o.sido === v),
      pick: () => {
        setSido(v);
        setSigungu('');
        setDong('');
      },
    }));
  } else if (level === 'sigungu') {
    stepTitle = '시 · 군 · 구를 선택하세요';
    const names = regionNames ?? uniq(allOrgs.filter((o) => o.sido === sido).map((o) => o.sigungu));
    levelOptions = names.map((v) => ({
      key: v,
      label: v,
      count: countUnder((o) => o.sido === sido && o.sigungu === v),
      pick: () => {
        setSigungu(v);
        setDong('');
      },
    }));
  } else if (level === 'dong') {
    stepTitle = '동 / 읍 / 리를 선택하세요';
    const names =
      regionNames ??
      uniq(allOrgs.filter((o) => o.sido === sido && o.sigungu === sigungu).map((o) => o.dong));
    levelOptions = names.map((v) => ({
      key: v,
      label: v,
      count: countUnder((o) => o.sido === sido && o.sigungu === sigungu && o.dong === v),
      pick: () => setDong(v),
    }));
  }

  const localRegion =
    level === 'orgs'
      ? allOrgs.filter((o) => o.sido === sido && o.sigungu === sigungu && o.dong === dong)
      : [];
  const regionResults = level === 'orgs' ? (serverRegion ?? localRegion) : [];

  const selectOrg = (o: PickedInstitution) => {
    setSelected(o);
    setOpen(false);
    onSelect?.(o);
  };
  const reselect = () => {
    setSelected(null);
    setOpen(true);
    onSelect?.(null);
  };

  const crumbs: Array<{ key: string; label: string; sep: boolean; active: boolean; go: () => void }> = [];
  if (sido)
    crumbs.push({
      key: 'sido',
      label: shortSido(sido),
      sep: false,
      active: level === 'sigungu',
      go: () => {
        setSido('');
        setSigungu('');
        setDong('');
      },
    });
  if (sigungu)
    crumbs.push({
      key: 'sigungu',
      label: sigungu,
      sep: true,
      active: level === 'dong',
      go: () => {
        setSigungu('');
        setDong('');
      },
    });
  if (dong)
    crumbs.push({
      key: 'dong',
      label: dong,
      sep: true,
      active: level === 'orgs',
      go: () => setDong(''),
    });

  const renderRow = (r: PickedInstitution) => (
    <button key={r.id} type="button" onClick={() => selectOrg(r)} className="ip-row">
      <span className="ip-row-icon">
        <i className="ph-fill ph-buildings" />
      </span>
      <span className="ip-row-body">
        <span className="ip-row-name-row">
          <span className="ip-row-name">{r.name}</span>
          <span className={pillClass(r.type)}>{r.type}</span>
        </span>
        <span className="ip-row-road">{r.road}</span>
      </span>
      <i className="ph-bold ph-caret-right ip-row-caret" />
    </button>
  );

  return (
    <div className="ip-root">
      {selected && (
        <div className="ip-selected">
          <span className="ip-selected-icon">
            <i className="ph-fill ph-check-circle" />
          </span>
          <div className="ip-selected-body">
            <div className="ip-selected-name-row">
              <span className="ip-selected-name">{selected.name}</span>
              <span className={pillClass(selected.type)}>{selected.type}</span>
            </div>
            <div className="ip-selected-road">
              <i className="ph-fill ph-map-pin" />
              {selected.road}
            </div>
          </div>
          <button type="button" onClick={reselect} className="ip-reselect">
            다시 선택
          </button>
        </div>
      )}

      {!selected && !open && (
        <button type="button" onClick={() => setOpen(true)} className="ip-trigger">
          <i className="ph-fill ph-buildings ip-trigger-icon" />
          <span className="ip-trigger-text">기관을 검색하거나 선택해 주세요</span>
          <i className="ph-bold ph-caret-down ip-trigger-caret" />
        </button>
      )}

      {!selected && open && (
        <div className="ip-panel">
          <div className="ip-panel-head">
            <span className="ip-panel-title">
              <i className="ph-fill ph-buildings" />
              기관 찾기
            </span>
            <button type="button" onClick={() => setOpen(false)} className="ip-close">
              <i className="ph-bold ph-x" />
            </button>
          </div>

          <div className="ip-search">
            <i className="ph-bold ph-magnifying-glass" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="기관명 또는 도로명 주소 2글자 이상 검색"
            />
          </div>

          {searching && (
            <div className="ip-results">
              {searchResults.length > 0 && (
                <>
                  <div className="ip-count">검색 결과 {searchResults.length}곳</div>
                  {searchResults.map(renderRow)}
                </>
              )}
              {searchResults.length === 0 && (
                <div className="ip-empty">
                  <i className="ph-fill ph-info" />
                  <span>등록된 기관을 찾지 못했어요. 기관으로 등록된 곳만 검색돼요.</span>
                </div>
              )}
            </div>
          )}

          <div className="ip-divider">
            <div className="ip-divider-line" />
            <span>또는 지역으로 찾기</span>
            <div className="ip-divider-line" />
          </div>

          {crumbs.length > 0 && (
            <div className="ip-crumbs">
              {crumbs.map((c) => (
                <span key={c.key} className="ip-crumb-wrap">
                  {c.sep && <i className="ph-bold ph-caret-right ip-crumb-sep" />}
                  <button
                    type="button"
                    onClick={c.go}
                    className={c.active ? 'ip-crumb ip-crumb--active' : 'ip-crumb'}
                  >
                    {c.label}
                  </button>
                </span>
              ))}
            </div>
          )}

          {level !== 'orgs' && (
            <>
              <div className="ip-step-title">{stepTitle}</div>
              <div className="ip-levels">
                {levelOptions.map((o) => (
                  <button key={o.key} type="button" onClick={o.pick} className="ip-level">
                    <span className="ip-level-label">{o.label}</span>
                    <span className="ip-level-count">{o.count}곳</span>
                    <i className="ph-bold ph-caret-right ip-level-caret" />
                  </button>
                ))}
              </div>
            </>
          )}

          {level === 'orgs' && (
            <div className="ip-results ip-results--region">
              {regionResults.length > 0 && (
                <>
                  <div className="ip-count">이 지역의 등록 기관 {regionResults.length}곳</div>
                  {regionResults.map(renderRow)}
                </>
              )}
              {regionResults.length === 0 && (
                <div className="ip-empty">
                  <i className="ph-fill ph-info" />
                  <span>선택한 지역에 등록된 기관이 없어요.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
