import type { StudentCourse, LectureItem } from '../../api/lectures';
import { demoCoverUrl } from './demoCover';

/**
 * 데모 코스/강의 — 최종 발표용으로 코스 둘러보기·강의 둘러보기·관심사 추천을 풍성하게 채운다.
 * 실제 코스가 아니므로 카드가 페이지 이동을 하지 않는다(StudentHome이 id 'demo-' 접두사로 판정).
 * field = interestTaxonomy 그룹 key(관심사 추천 매칭용). 실제 코스가 항상 앞, 데모는 뒤에 붙는다.
 */
export interface DemoCourse extends StudentCourse {
  field: string;
}

interface FieldSpec {
  field: string;
  category: string;
  subject: string;
  instructor: string;
  courses: { title: string; desc: string; lectures: string[] }[];
}

// 분야별 데모 코스(각 3개, 강의 2~3개). field는 interestTaxonomy 그룹 key와 일치.
const SPEC: FieldSpec[] = [
  {
    field: 'math', category: '수학·수리', subject: '수학', instructor: '김민용',
    courses: [
      { title: '미적분 마스터', desc: '극한부터 적분까지 한 번에.', lectures: ['극한과 연속', '미분 기초', '적분 활용'] },
      { title: '확률과 통계 입문', desc: '데이터를 읽는 첫걸음.', lectures: ['경우의 수', '확률 기초', '통계 해석'] },
      { title: '중등 수학 총정리', desc: '핵심 개념 압축 복습.', lectures: ['방정식', '함수', '도형'] },
      { title: '고등 수학 개념완성', desc: '내신·수능 핵심 개념.', lectures: ['함수와 그래프', '수열', '삼각함수'] },
    ],
  },
  {
    field: 'safety', category: '안전·자격', subject: '안전', instructor: '박지훈',
    courses: [
      { title: '산업안전기사 대비', desc: '필기·실기 핵심 정리.', lectures: ['안전관리론', '기계안전', '전기안전'] },
      { title: '생활안전 기본기', desc: '일상 속 위험 대비.', lectures: ['가정 안전', '화재 대응', '교통 안전'] },
      { title: '응급처치·CPR 실습', desc: '골든타임을 살리는 법.', lectures: ['심폐소생술', 'AED 사용', '응급 상황 대처'] },
      { title: '건설안전 실무', desc: '현장 위험 요인 관리.', lectures: ['추락 예방', '중장비 안전', '작업 허가제'] },
    ],
  },
  {
    field: 'lang', category: '어학·외국어', subject: '어학', instructor: '최유나',
    courses: [
      { title: '토익 900 완성', desc: '실전 문제로 점수 상승.', lectures: ['LC 전략', 'RC 문법', '실전 모의고사'] },
      { title: '기초 영어 회화', desc: '입이 트이는 표현 100.', lectures: ['자기소개', '일상 대화', '여행 영어'] },
      { title: '일본어 첫걸음', desc: '히라가나부터 회화까지.', lectures: ['히라가나', '기초 문법', '기초 회화'] },
      { title: '중국어 첫걸음', desc: '병음부터 기초 회화까지.', lectures: ['성조와 병음', '기초 문형', '일상 표현'] },
      { title: 'OPIc IH 도전', desc: '스피킹 등급을 끌어올리는 전략.', lectures: ['자기소개 세팅', '롤플레이 대응', '고득점 표현'] },
    ],
  },
  {
    field: 'general', category: '교양·자기계발', subject: '일반', instructor: '정하은',
    courses: [
      { title: '엑셀 실무 완성', desc: '업무가 빨라지는 함수.', lectures: ['기초 함수', '피벗 테이블', '자동화 팁'] },
      { title: '경제·재테크 입문', desc: '돈의 흐름을 읽는 눈.', lectures: ['경제 상식', '투자 기초', '자산 관리'] },
      { title: '논리적 글쓰기', desc: '설득하는 글의 구조.', lectures: ['문장 다듬기', '단락 구성', '설득의 기술'] },
      { title: '컴퓨터 활용 기초', desc: '문서·인터넷·보안 기본기.', lectures: ['윈도우 다루기', '문서 작성', '온라인 안전'] },
    ],
  },
  {
    field: 'it', category: 'IT·프로그래밍', subject: '일반', instructor: '이서준',
    courses: [
      { title: '파이썬 기초', desc: '코딩이 처음이어도 OK.', lectures: ['변수와 자료형', '반복문·조건문', '함수와 모듈'] },
      { title: '웹 개발 부트캠프', desc: 'HTML부터 배포까지.', lectures: ['HTML·CSS', 'JavaScript', '배포 실습'] },
      { title: '데이터 분석 with 판다스', desc: '표를 다루는 힘.', lectures: ['판다스 기초', '데이터 정제', '시각화'] },
      { title: '자바 기초', desc: '객체지향 첫걸음.', lectures: ['변수와 타입', '클래스와 객체', '컬렉션'] },
    ],
  },
  {
    field: 'design', category: '디자인·크리에이티브', subject: '일반', instructor: '윤서아',
    courses: [
      { title: '포토샵 실무', desc: '보정부터 합성까지.', lectures: ['툴 익히기', '보정 기법', '합성 실습'] },
      { title: 'UX·UI 디자인', desc: '쓰기 좋은 화면 설계.', lectures: ['UX 리서치', '와이어프레임', '프로토타입'] },
      { title: '영상 편집 프리미어', desc: '컷 편집부터 자막까지.', lectures: ['컷 편집', '전환·효과', '자막·출력'] },
      { title: '일러스트레이터 입문', desc: '벡터 드로잉의 기본.', lectures: ['패스와 도형', '색과 그레이디언트', '로고 만들기'] },
    ],
  },
  {
    field: 'biz', category: '비즈니스·직무', subject: '일반', instructor: '강도윤',
    courses: [
      { title: '디지털 마케팅', desc: '데이터로 파는 법.', lectures: ['퍼널 이해', 'SNS 광고', '성과 분석'] },
      { title: '회계 기초', desc: '숫자로 회사를 읽다.', lectures: ['재무제표', '분개 원리', '원가 개념'] },
      { title: '노션 업무 자동화', desc: '흩어진 일을 한곳에.', lectures: ['데이터베이스', '템플릿', '협업 세팅'] },
      { title: '기획·전략 입문', desc: '문제를 정의하고 푸는 법.', lectures: ['문제 정의', '가설 검증', '전략 문서'] },
    ],
  },
  {
    field: 'cert', category: '자격증·시험', subject: '일반', instructor: '임재원',
    courses: [
      { title: '컴활 1급 실기', desc: '합격 루틴 그대로.', lectures: ['스프레드시트', '데이터베이스', '기출 풀이'] },
      { title: '한국사능력검정 심화', desc: '흐름으로 외운다.', lectures: ['전근대사', '근현대사', '기출 분석'] },
      { title: '정보처리기사 필기', desc: '5과목 핵심 요약.', lectures: ['소프트웨어 설계', '데이터베이스', '정보시스템'] },
      { title: '전산회계 1급', desc: '실무형 회계 자격증.', lectures: ['계정과목', '전표 입력', '결산·재무제표'] },
    ],
  },
  {
    field: 'life', category: '취미·라이프', subject: '일반', instructor: '한소율',
    courses: [
      { title: '기초 드로잉', desc: '선 긋기부터 시작.', lectures: ['선과 형태', '명암', '간단 스케치'] },
      { title: '홈 베이킹', desc: '집에서 굽는 디저트.', lectures: ['쿠키', '마들렌', '기초 빵'] },
      { title: '우쿨렐레 입문', desc: '4줄로 시작하는 연주.', lectures: ['코드 잡기', '스트로크', '한 곡 완성'] },
      { title: '사진 입문', desc: '스마트폰으로도 잘 찍기.', lectures: ['구도 잡기', '빛 읽기', '보정 기초'] },
    ],
  },
];

// 데모 커버는 demoCover.ts가 코스마다 다르게 코드로 생성한다(검정 배경·라인아트·Welcome to X+제목).
// 결과가 data:image/svg+xml URL이라 thumbnailSrc가 /api/ 아닌 URL을 그대로 통과시켜 카드가 바로 쓴다.

const _courses: DemoCourse[] = [];
const _lectures: LectureItem[] = [];
SPEC.forEach((s) => {
  s.courses.forEach((c, ci) => {
    const cid = `demo-${s.field}-${ci}`;
    _courses.push({
      id: cid,
      title: c.title,
      subject: s.subject,
      category: s.category,
      description: c.desc,
      order_no: ci,
      instructor_name: s.instructor, // 카드가 '… 강사'를 붙이므로 여기선 이름만(중복 '강사 강사' 방지)
      lecture_count: 0, // 데모 코스는 실제 강의 영상이 없으므로 0 → 카드에 '0개 강의'
      thumbnail_url: demoCoverUrl(s.field, ci, c.title),
      enrolled: false,
      field: s.field,
    });
    c.lectures.forEach((lt, li) => {
      _lectures.push({
        id: `${cid}-l${li}`,
        title: `${li + 1}강 ${lt}`,
        description: null,
        subject: s.subject,
        course_id: cid,
        order_no: li,
        duration_sec: 360 + li * 150 + ci * 45,
        question_count: 0,
        progress: null,
        thumbnail_url: null,
      });
    });
  });
});

export const DEMO_COURSES: DemoCourse[] = _courses;
export const DEMO_LECTURES: LectureItem[] = _lectures;

/** id가 데모 코스/강의인지 — 카드가 페이지 이동을 막을 때 쓴다. */
export function isDemoId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('demo-');
}

/** 데모 코스/강의 id에서 분야(field=그룹 key) 추출: 'demo-{field}-...' → field. 관심사 추천 매칭용. */
export function demoField(id: string | null | undefined): string {
  return id && id.startsWith('demo-') ? (id.split('-')[1] ?? '') : '';
}
