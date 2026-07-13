/* =========================================================================
   animal-config.js — 동물 단일 설정 파일 (Single Source of Truth).

   "처음 5마리" 구성으로 복귀: dog / rabbit / chicken / panda / capybara.
   이 5마리는 원래부터 배경이 깔끔하게 제거된 방향별 낱장 프레임
   (assets/animals/{id}/dir0~7.png)이라 흰 테두리 문제가 없습니다.
   렌더링은 'frames' 방식(낱장 PNG), 게임은 드래그 회전 그대로 유지.
   프론트/백엔드는 동일한 영문 id 를 사용합니다.
   ========================================================================= */

const ANIMAL_CONFIG = {
  dog:      { id: "dog",      nameKo: "강아지",   image: "assets/animals/dog/dir0.png",      base: "assets/animals/dog/dir",      columns: 4, rows: 2, frameCount: 8 },
  rabbit:   { id: "rabbit",   nameKo: "토끼",     image: "assets/animals/rabbit/dir0.png",   base: "assets/animals/rabbit/dir",   columns: 4, rows: 2, frameCount: 8 },
  chicken:  { id: "chicken",  nameKo: "닭",       image: "assets/animals/chicken/dir0.png",  base: "assets/animals/chicken/dir",  columns: 4, rows: 2, frameCount: 8 },
  panda:    { id: "panda",    nameKo: "판다",     image: "assets/animals/panda/dir0.png",    base: "assets/animals/panda/dir",    columns: 4, rows: 2, frameCount: 8 },
  capybara: { id: "capybara", nameKo: "카피바라", image: "assets/animals/capybara/dir0.png", base: "assets/animals/capybara/dir", columns: 4, rows: 2, frameCount: 8 },
  cat:      { id: "cat",      nameKo: "고양이",   image: "assets/animals/cat/dir0.png",      base: "assets/animals/cat/dir",      columns: 4, rows: 2, frameCount: 8 },
  pig:      { id: "pig",      nameKo: "돼지",     image: "assets/animals/pig/dir0.png",      base: "assets/animals/pig/dir",      columns: 4, rows: 2, frameCount: 8 },
  quokka:   { id: "quokka",   nameKo: "쿼카",     image: "assets/animals/quokka/dir0.png",   base: "assets/animals/quokka/dir",   columns: 4, rows: 2, frameCount: 8 },
  tiger:    { id: "tiger",    nameKo: "호랑이",   image: "assets/animals/tiger/dir0.png",    base: "assets/animals/tiger/dir",    columns: 4, rows: 2, frameCount: 8 },
  sheep:    { id: "sheep",    nameKo: "양",       image: "assets/animals/sheep/dir0.png",    base: "assets/animals/sheep/dir",    columns: 4, rows: 2, frameCount: 8 },
  giraffe:  { id: "giraffe",  nameKo: "기린",     image: "assets/animals/giraffe/dir0.png",  base: "assets/animals/giraffe/dir",  columns: 4, rows: 2, frameCount: 8 },
};

// 등록 순서 (참고용). 실제 선택은 서버가 담당.
const ANIMAL_ORDER = ["dog", "rabbit", "chicken", "panda", "capybara", "cat", "pig", "quokka", "tiger", "sheep", "giraffe"];

// (선택) 동물별 시각 보정. 기본은 보정 없음(scale 1.0).
const ANIMAL_VISUAL_CONFIG = {};
function animalScale(id) {
  const v = ANIMAL_VISUAL_CONFIG[id];
  return (v && typeof v.scale === 'number') ? v.scale : 1;
}

window.ANIMAL_CONFIG = ANIMAL_CONFIG;
window.ANIMAL_ORDER = ANIMAL_ORDER;
window.ANIMAL_VISUAL_CONFIG = ANIMAL_VISUAL_CONFIG;
window.animalScale = animalScale;
