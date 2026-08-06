import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useCollectParticipant — 행동데이터 수집 참여자 코드(`?collect=`)를 읽는다.
 *
 * 외부 CatChap Guard(민서) 캡차를 "수집 전용"으로 띄울지 판단하는 유일한 스위치다.
 * 값이 없으면 빈 문자열 → 위젯을 아예 붙이지 않는다(일반 사용자는 기존 화면 그대로).
 *
 * 첫 렌더에서 한 번만 읽는 이유: 학생 화면(LecturePlayer·GameScreen)은 진입 직후
 * `navigate(pathname, {replace:true})`로 주소창의 쿼리스트링을 통째로 지운다. 이펙트에서
 * 읽으면 이미 collect가 날아간 뒤라 위젯이 안 붙는다. useState 초기화(렌더 시점)로 낚아챈다.
 *
 * sessionStorage에 남기는 이유: 참여자가 강의↔문제은행을 오갈 때마다 파라미터를 다시
 * 붙이지 않아도 수집이 이어지게 한다. 탭을 닫으면 사라지고, 주소로 직접 넣지 않는 한
 * 일반 사용자에게는 생길 수 없는 값이다. `?collect=`(빈 값)로 즉시 끌 수 있다.
 */

const SS_KEY = 'catchap_collect_participant';

/** 참여자 코드 정규화 — DOM 속성·URL 쿼리로 그대로 나가므로 안전한 문자만 남긴다. */
function normalize(raw: string): string {
  return raw.trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64);
}

export function useCollectParticipant(): string {
  const [searchParams] = useSearchParams();
  const [participant] = useState<string>(() => {
    const raw = searchParams.get('collect');
    try {
      if (raw != null) {
        // 파라미터가 명시됐으면 그것이 정본 — 빈 값이면 수집을 끈다.
        const v = normalize(raw);
        if (v) sessionStorage.setItem(SS_KEY, v);
        else sessionStorage.removeItem(SS_KEY);
        return v;
      }
      return normalize(sessionStorage.getItem(SS_KEY) ?? '');
    } catch {
      // 사파리 프라이빗 등 storage 차단 — 이번 페이지에서만 동작하고 조용히 넘어간다.
      return raw != null ? normalize(raw) : '';
    }
  });
  return participant;
}
