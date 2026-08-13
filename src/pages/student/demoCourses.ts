import type { StudentCourse, LectureItem } from '../../api/lectures';
import { AGE_PREFIX } from '../../components/student/interestTaxonomy';
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
  courses: DemoCourseSpec[];
}

interface DemoCourseSpec {
  title: string;
  desc: string;
  lectures: string[];
  /** 이 코스에 '정확히 대응'하는 관심사 태그(interestTaxonomy의 tags 값과 같아야 한다).
   *  ★여기 적어 두면 DEMO_EXACT_TAGS 가 자동으로 만들어져 홈의 '딱 맞춤' 추천에 걸린다.
   *  종전엔 이 대응표를 interestTaxonomy 에 손으로 따로 두어, 코스를 늘려도 추천이
   *  안 따라오는 어긋남이 생겼다(태그 82개 중 12개만 연결돼 있었다). */
  tag?: string;
}

// 분야별 데모 코스(각 8개, 강의 3개). field는 interestTaxonomy 그룹 key와 일치.
const SPEC: FieldSpec[] = [
  {
    field: 'math', category: '수학·수리', subject: '수학', instructor: '김민용',
    courses: [
      { title: '미적분 마스터', desc: '극한부터 적분까지 한 번에.', lectures: ['극한과 연속', '미분 기초', '적분 활용'], tag: '미적분' },
      { title: '확률과 통계 입문', desc: '데이터를 읽는 첫걸음.', lectures: ['경우의 수', '확률 기초', '통계 해석'], tag: '확률과 통계' },
      { title: '중등 수학 총정리', desc: '핵심 개념 압축 복습.', lectures: ['방정식', '함수', '도형'], tag: '중등 수학' },
      { title: '고등 수학 개념완성', desc: '내신·수능 핵심 개념.', lectures: ['함수와 그래프', '수열', '삼각함수'], tag: '고등 수학' },
      { title: '초등 수해력 다지기', desc: '연산이 손에 붙는 30일.', lectures: ['수와 연산', '분수와 소수', '문장제 훈련'], tag: '초등 수해력' },
      { title: '기하·도형 완전정복', desc: '보이면 풀린다.', lectures: ['평면도형', '입체도형', '증명의 기초'], tag: '기하·도형' },
      { title: '수리 논술 첫걸음', desc: '답이 아니라 과정을 쓴다.', lectures: ['논제 분석', '풀이 서술', '기출 첨삭'], tag: '수리 논술' },
      { title: '데이터 수리 기초', desc: '표와 그래프를 수학으로.', lectures: ['대푯값', '분포와 상관', '해석의 함정'], tag: '데이터 수리' },
    ],
  },
  {
    field: 'safety', category: '안전·자격', subject: '안전', instructor: '박지훈',
    courses: [
      { title: '산업안전기사 대비', desc: '필기·실기 핵심 정리.', lectures: ['안전관리론', '기계안전', '전기안전'], tag: '산업안전' },
      { title: '생활안전 기본기', desc: '일상 속 위험 대비.', lectures: ['가정 안전', '화재 대응', '교통 안전'], tag: '생활안전' },
      { title: '응급처치·CPR 실습', desc: '골든타임을 살리는 법.', lectures: ['심폐소생술', 'AED 사용', '응급 상황 대처'], tag: '응급처치·CPR' },
      { title: '건설안전 실무', desc: '현장 위험 요인 관리.', lectures: ['추락 예방', '중장비 안전', '작업 허가제'], tag: '건설안전' },
      { title: '소방·방재 기본', desc: '불이 나기 전에 하는 일.', lectures: ['소화 설비', '피난 계획', '방화 관리'], tag: '소방·방재' },
      { title: '교통안전 교육', desc: '운전대 앞의 습관.', lectures: ['방어 운전', '보행자 보호', '사고 대응'], tag: '교통안전' },
      { title: '전기안전 실무', desc: '감전·화재를 막는 기본.', lectures: ['접지와 누전', '작업 전 차단', '점검 체크리스트'], tag: '전기안전' },
      { title: '식품위생 관리', desc: '주방에서 지키는 기준.', lectures: ['개인 위생', '보관 온도', 'HACCP 개요'], tag: '식품위생' },
    ],
  },
  {
    field: 'lang', category: '어학·외국어', subject: '어학', instructor: '최유나',
    courses: [
      { title: '토익 900 완성', desc: '실전 문제로 점수 상승.', lectures: ['LC 전략', 'RC 문법', '실전 모의고사'], tag: 'TOEIC' },
      { title: '기초 영어 회화', desc: '입이 트이는 표현 100.', lectures: ['자기소개', '일상 대화', '여행 영어'], tag: '영어 회화' },
      { title: '일본어 첫걸음', desc: '히라가나부터 회화까지.', lectures: ['히라가나', '기초 문법', '기초 회화'], tag: '일본어' },
      { title: '중국어 첫걸음', desc: '병음부터 기초 회화까지.', lectures: ['성조와 병음', '기초 문형', '일상 표현'], tag: '중국어' },
      { title: 'OPIc IH 도전', desc: '스피킹 등급을 끌어올리는 전략.', lectures: ['자기소개 세팅', '롤플레이 대응', '고득점 표현'], tag: 'OPIc' },
      { title: 'TOEFL 리딩·리스닝', desc: '학술 지문이 편해진다.', lectures: ['지문 구조', '노트테이킹', '실전 세트'], tag: 'TOEFL' },
      { title: '비즈니스 영어 이메일', desc: '오해 없이 쓰는 법.', lectures: ['요청과 거절', '회의 조율', '보고와 공유'], tag: '비즈니스 영어' },
      { title: 'JLPT N3 대비', desc: '문법·독해 한 번에.', lectures: ['핵심 문법', '독해 전략', '청해 훈련'], tag: 'JLPT' },
    ],
  },
  {
    field: 'general', category: '교양·자기계발', subject: '일반', instructor: '정하은',
    courses: [
      { title: '엑셀 실무 완성', desc: '업무가 빨라지는 함수.', lectures: ['기초 함수', '피벗 테이블', '자동화 팁'], tag: '엑셀·오피스' },
      { title: '경제·재테크 입문', desc: '돈의 흐름을 읽는 눈.', lectures: ['경제 상식', '투자 기초', '자산 관리'], tag: '경제·재테크' },
      { title: '논리적 글쓰기', desc: '설득하는 글의 구조.', lectures: ['문장 다듬기', '단락 구성', '설득의 기술'], tag: '인문·글쓰기' },
      { title: '컴퓨터 활용 기초', desc: '문서·인터넷·보안 기본기.', lectures: ['윈도우 다루기', '문서 작성', '온라인 안전'], tag: '컴퓨터 활용' },
      { title: '시사·상식 따라잡기', desc: '뉴스가 읽히기 시작한다.', lectures: ['경제 뉴스', '국제 정세', '과학·기술'], tag: '시사·상식' },
      { title: '마음챙김 입문', desc: '흔들릴 때 돌아오는 법.', lectures: ['호흡 관찰', '감정 알아차림', '일상 적용'], tag: '심리·마음챙김' },
      { title: '시간관리의 기술', desc: '바쁜데 남는 게 없다면.', lectures: ['우선순위', '집중 블록', '주간 회고'], tag: '시간관리' },
      { title: '설득하는 발표', desc: '듣게 만드는 구조.', lectures: ['메시지 설계', '슬라이드 원칙', '질의응답'], tag: '회의·발표' },
    ],
  },
  {
    field: 'it', category: 'IT·프로그래밍', subject: 'IT', instructor: '이서준',
    courses: [
      { title: '파이썬 기초', desc: '코딩이 처음이어도 OK.', lectures: ['변수와 자료형', '반복문·조건문', '함수와 모듈'], tag: '파이썬' },
      { title: '웹 개발 부트캠프', desc: 'HTML부터 배포까지.', lectures: ['HTML·CSS', 'JavaScript', '배포 실습'], tag: '웹 개발' },
      { title: '데이터 분석 with 판다스', desc: '표를 다루는 힘.', lectures: ['판다스 기초', '데이터 정제', '시각화'], tag: '데이터 분석' },
      { title: '자바 기초', desc: '객체지향 첫걸음.', lectures: ['변수와 타입', '클래스와 객체', '컬렉션'], tag: '자바' },
      { title: 'AI·머신러닝 입문', desc: '수식보다 감각부터.', lectures: ['지도학습 개념', '모델 평가', '과적합 다루기'], tag: 'AI·머신러닝' },
      { title: '클라우드 첫걸음', desc: '서버를 빌려 쓰는 법.', lectures: ['가상 서버', '스토리지', '비용 관리'], tag: '클라우드' },
      { title: '데이터베이스 설계', desc: '표를 제대로 나누는 법.', lectures: ['정규화', '인덱스', '트랜잭션'], tag: '데이터베이스' },
      { title: '정보보안 기초', desc: '뚫리는 이유를 안다.', lectures: ['인증과 권한', '암호화 기본', '웹 취약점'], tag: '정보보안' },
    ],
  },
  {
    field: 'design', category: '디자인·크리에이티브', subject: '디자인', instructor: '윤서아',
    courses: [
      { title: '포토샵 실무', desc: '보정부터 합성까지.', lectures: ['툴 익히기', '보정 기법', '합성 실습'], tag: '포토샵' },
      { title: 'UX·UI 디자인', desc: '쓰기 좋은 화면 설계.', lectures: ['UX 리서치', '와이어프레임', '프로토타입'], tag: 'UX·UI' },
      { title: '영상 편집 프리미어', desc: '컷 편집부터 자막까지.', lectures: ['컷 편집', '전환·효과', '자막·출력'], tag: '영상 편집' },
      { title: '일러스트레이터 입문', desc: '벡터 드로잉의 기본.', lectures: ['패스와 도형', '색과 그레이디언트', '로고 만들기'], tag: '일러스트' },
      { title: '3D 모델링 입문', desc: '평면에서 입체로.', lectures: ['폴리곤 기초', '재질과 조명', '렌더링'], tag: '3D·모델링' },
      { title: '브랜딩 기초', desc: '이름에 얼굴을 붙인다.', lectures: ['브랜드 정의', '로고와 컬러', '가이드 문서'], tag: '브랜딩' },
      { title: '모션그래픽 첫걸음', desc: '움직이면 눈이 간다.', lectures: ['키프레임', '이징', '타이포 모션'], tag: '모션그래픽' },
      { title: '제품 디자인 씽킹', desc: '문제부터 다시 본다.', lectures: ['사용자 관찰', '아이디어 발산', '프로토타입'], tag: '제품 디자인' },
    ],
  },
  {
    field: 'biz', category: '비즈니스·직무', subject: '비즈니스', instructor: '강도윤',
    courses: [
      { title: '디지털 마케팅', desc: '데이터로 파는 법.', lectures: ['퍼널 이해', 'SNS 광고', '성과 분석'], tag: '마케팅' },
      { title: '회계 기초', desc: '숫자로 회사를 읽다.', lectures: ['재무제표', '분개 원리', '원가 개념'], tag: '회계·세무' },
      { title: '노션 업무 자동화', desc: '흩어진 일을 한곳에.', lectures: ['데이터베이스', '템플릿', '협업 세팅'], tag: '노션·협업툴' },
      { title: '기획·전략 입문', desc: '문제를 정의하고 푸는 법.', lectures: ['문제 정의', '가설 검증', '전략 문서'], tag: '기획·전략' },
      { title: 'PM 실무 입문', desc: '만들 것을 정하는 사람.', lectures: ['요구사항 정리', '우선순위', '릴리스 관리'], tag: 'PM·프로덕트' },
      { title: '세일즈 기본기', desc: '팔리는 대화의 순서.', lectures: ['니즈 파악', '제안과 반론', '클로징'], tag: '세일즈' },
      { title: '창업 준비', desc: '시작 전에 확인할 것.', lectures: ['아이템 검증', '사업계획서', '초기 자금'], tag: '창업' },
      { title: '인사·HR 실무', desc: '사람을 다루는 제도.', lectures: ['채용 프로세스', '평가와 보상', '노무 기초'], tag: '인사·HR' },
    ],
  },
  {
    field: 'cert', category: '자격증·시험', subject: '자격증', instructor: '임재원',
    courses: [
      { title: '컴활 1급 실기', desc: '합격 루틴 그대로.', lectures: ['스프레드시트', '데이터베이스', '기출 풀이'], tag: '컴활 1급' },
      { title: '한국사능력검정 심화', desc: '흐름으로 외운다.', lectures: ['전근대사', '근현대사', '기출 분석'], tag: '한국사능력검정' },
      { title: '정보처리기사 필기', desc: '5과목 핵심 요약.', lectures: ['소프트웨어 설계', '데이터베이스', '정보시스템'], tag: '정보처리기사' },
      { title: '전산회계 1급', desc: '실무형 회계 자격증.', lectures: ['계정과목', '전표 입력', '결산·재무제표'], tag: '전산회계' },
      { title: '공무원 국어', desc: '문법·독해 출제 포인트.', lectures: ['어법', '비문학 독해', '문학 기출'], tag: '공무원' },
      { title: '사회복지사 2급', desc: '현장으로 가는 첫 관문.', lectures: ['사회복지 개론', '실천기술', '법제와 정책'], tag: '사회복지사' },
      { title: '바리스타 2급', desc: '한 잔을 제대로 내리는 법.', lectures: ['원두와 로스팅', '에스프레소 추출', '위생과 서비스'], tag: '바리스타' },
      { title: '드론 조종 자격', desc: '띄우기 전에 아는 규칙.', lectures: ['항공 법규', '비행 원리', '실기 절차'], tag: '드론 자격' },
    ],
  },
  {
    field: 'life', category: '취미·라이프', subject: '취미', instructor: '한소율',
    courses: [
      { title: '기초 드로잉', desc: '선 긋기부터 시작.', lectures: ['선과 형태', '명암', '간단 스케치'], tag: '드로잉' },
      { title: '홈 베이킹', desc: '집에서 굽는 디저트.', lectures: ['쿠키', '마들렌', '기초 빵'], tag: '요리·베이킹' },
      { title: '우쿨렐레 입문', desc: '4줄로 시작하는 연주.', lectures: ['코드 잡기', '스트로크', '한 곡 완성'], tag: '악기·음악' },
      { title: '사진 입문', desc: '스마트폰으로도 잘 찍기.', lectures: ['구도 잡기', '빛 읽기', '보정 기초'], tag: '사진' },
      { title: '홈트 30일', desc: '기구 없이 집에서.', lectures: ['맨몸 근력', '코어 루틴', '스트레칭'], tag: '홈트·운동' },
      { title: '캘리그라피 입문', desc: '손글씨가 작품이 된다.', lectures: ['펜과 자세', '기본 획', '단어 구성'], tag: '캘리그라피' },
      { title: '베란다 가드닝', desc: '작은 창가의 초록.', lectures: ['식물 고르기', '물과 빛', '분갈이'], tag: '가드닝' },
      { title: '반려동물 돌봄', desc: '함께 살기 위한 기본.', lectures: ['건강 체크', '기초 훈련', '응급 상황'], tag: '반려동물' },
    ],
  },
];

// 데모 커버는 demoCover.ts가 코스마다 다르게 코드로 생성한다(검정 배경·라인아트·Welcome to X+제목).
// 결과가 data:image/svg+xml URL이라 thumbnailSrc가 /api/ 아닌 URL을 그대로 통과시켜 카드가 바로 쓴다.

const _courses: DemoCourse[] = [];
const _lectures: LectureItem[] = [];
const _exactTags: Record<string, string> = {};
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
    if (c.tag) _exactTags[c.tag] = cid;
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

/** 관심사 태그 → 그 태그에 '정확히 대응'하는 데모 코스 id. 위 SPEC의 tag에서 자동으로 만든다.
 *  ★손으로 관리하지 않는 이유: 종전엔 이 표가 interestTaxonomy 에 따로 있어서, 코스를 늘려도
 *  추천이 안 따라왔다. 코스 정의 한 곳만 고치면 추천까지 함께 움직이게 한다. */
export const DEMO_EXACT_TAGS: Readonly<Record<string, string>> = _exactTags;

/** 저장된 관심사(태그) → 그 태그에 정확히 대응하는 데모 코스 id 집합(대응 코스가 있는 태그만).
 *
 * ★이 함수가 interestTaxonomy 가 아니라 여기 있는 이유: 대응표(DEMO_EXACT_TAGS)가 여기서
 * 만들어지기 때문이다. 반대로 두면 세 파일이 고리를 이룬다 —
 *   interestTaxonomy → demoCourses → demoCover → interestTaxonomy
 * 그 고리는 ★빌드를 통과하고 브라우저에서만 터진다("Cannot access before initialization").
 * 실제로 한 번 그렇게 깨뜨렸다. 의존은 한 방향으로만 흐르게 둔다(taxonomy 는 잎 모듈).
 */
export function interestsToExactDemoIds(interests: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of interests ?? []) {
    if (!raw || raw.startsWith(AGE_PREFIX)) continue;
    const id = _exactTags[raw];
    if (id) out.add(id);
  }
  return out;
}

/** id가 데모 코스/강의인지 — 카드가 페이지 이동을 막을 때 쓴다. */
export function isDemoId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('demo-');
}

/** 데모 코스/강의 id에서 분야(field=그룹 key) 추출: 'demo-{field}-...' → field. 관심사 추천 매칭용. */
export function demoField(id: string | null | undefined): string {
  return id && id.startsWith('demo-') ? (id.split('-')[1] ?? '') : '';
}
