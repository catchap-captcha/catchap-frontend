/**
 * 강사 이력(소개) 저장소.
 *
 * ⚠ 지금은 **브라우저 localStorage에만** 저장한다. 백엔드에 강사 소개를 담을 자리가 아직
 * 없어서다 — users 테이블에 bio 계열 컬럼이 없고 `/ops/instructor/*` 에도 프로필 저장
 * 엔드포인트가 없다(강사 대시보드·분석만 있음). 그래서 강사가 저장한 이력은 **그 브라우저
 * 안에서만** 보인다. 다른 기기의 학생에게는 '아직 등록된 소개가 없어요'로 보인다.
 *
 * 서버가 준비되면(예: GET/PUT `/ops/instructor/profile` + 학생용 코스 응답에 instructor_bio)
 * 이 파일의 load/save 두 함수만 API 호출로 바꾸면 화면 코드는 그대로 동작한다.
 * 화면들은 이 모듈만 보고 있고, 저장 위치를 직접 알지 못한다.
 */

const STORE_KEY = 'catchap.instructorBio.v1';

export interface InstructorBio {
  /** 한 줄 소개 — 학생 화면에서 이름 밑에 굵게 보인다 */
  headline: string;
  /** 이력 본문 — 줄바꿈으로 항목을 나눈다(자유 서술) */
  career: string;
  /** 마지막 저장 시각(ISO) */
  updatedAt: string;
}

/** 강사 이름을 저장 키로 쓴다 — 학생 화면이 강사에 대해 아는 유일한 값이 실명(instructor_name)이라서. */
function keyOf(name: string): string {
  return name.trim();
}

type BioStore = Record<string, InstructorBio>;

function readStore(): BioStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BioStore) : {};
  } catch {
    return {}; // 손상된 값·프라이빗 모드 등 — 저장된 소개가 없는 것과 같게 취급
  }
}

/** 이 강사의 저장된 이력. 없으면 null(화면은 '아직 소개가 없어요'로 폴백). */
export function loadInstructorBio(name: string | null | undefined): InstructorBio | null {
  if (!name || !name.trim()) return null;
  const found = readStore()[keyOf(name)];
  if (!found) return null;
  // 빈 껍데기(둘 다 공백)는 없는 것으로 본다 — 저장 후 내용을 다 지운 경우
  if (!found.headline?.trim() && !found.career?.trim()) return null;
  return found;
}

/** 이력 저장. 저장에 실패하면(용량 초과·프라이빗 모드) false를 돌려 화면이 정직하게 알린다. */
export function saveInstructorBio(
  name: string,
  bio: Omit<InstructorBio, 'updatedAt'>,
): InstructorBio | null {
  if (!name || !name.trim()) return null;
  const saved: InstructorBio = {
    headline: bio.headline.trim(),
    career: bio.career.trim(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const store = readStore();
    store[keyOf(name)] = saved;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return saved;
  } catch {
    return null;
  }
}
