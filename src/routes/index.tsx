import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { PATHS } from './paths';
import { ROLE_HOME } from './roleRoutes';
import { useAuth } from '../hooks/useAuth';

// 공개
const MainPage = lazy(() => import('../pages/public/MainPage'));
const ContactPage = lazy(() => import('../pages/public/ContactPage'));
const TermsPage = lazy(() => import('../pages/public/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/public/PrivacyPage'));

// 인증
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const FindIdPage = lazy(() => import('../pages/auth/FindIdPage'));
const PasswordResetPage = lazy(() => import('../pages/auth/PasswordResetPage'));
const CaptchaPage = lazy(() => import('../pages/auth/CaptchaPage'));
const ActivatePage = lazy(() => import('../pages/auth/ActivatePage'));
const InvitePage = lazy(() => import('../pages/auth/InvitePage'));

// 학생 — 게임화 잔재(챕터 지도·연습장·배지·아바타 꾸미기·AI선생님)는 제품 전환으로 제거.
// 전체학습·퀴즈·게임화면은 강의 문항 재편 대상이라 유지(0716 결정).
const StudentHome = lazy(() => import('../pages/student/StudentHome'));
const MyCourses = lazy(() => import('../pages/student/MyCourses'));
const StudentInquiry = lazy(() => import('../pages/student/StudentInquiry'));
const StudentExams = lazy(() => import('../pages/student/StudentExams'));
const StudentCertificates = lazy(() => import('../pages/student/StudentCertificates'));
const GameScreen = lazy(() => import('../pages/student/GameScreen'));
const GameResult = lazy(() => import('../pages/student/GameResult'));
// 오늘의퀴즈 페이지는 Q 통합(0719 결정)으로 은퇴 — 옛 경로는 문제은행으로 보낸다(아래 라우트)
const CourseDetail = lazy(() => import('../pages/student/CourseDetail'));
const Checkout = lazy(() => import('../pages/student/Checkout'));
const PaymentResult = lazy(() => import('../pages/student/PaymentResult'));
const LecturePlayer = lazy(() => import('../pages/student/LecturePlayer'));
const CourseExam = lazy(() => import('../pages/student/CourseExam'));
const Orders = lazy(() => import('../pages/student/Orders'));
const AllLearning = lazy(() => import('../pages/student/AllLearning'));
const MyRecords = lazy(() => import('../pages/student/MyRecords'));
const WrongNotes = lazy(() => import('../pages/student/WrongNotes'));
const SearchPage = lazy(() => import('../pages/student/SearchPage'));
const StudentNotifications = lazy(() => import('../pages/student/StudentNotifications'));
// 설정 페이지는 마이페이지(계정 허브)의 탭으로 흡수(0723) — 옛 경로는 허브로 리다이렉트.
const ProfileEdit = lazy(() => import('../pages/student/ProfileEdit'));
const StudentMyPage = lazy(() => import('../pages/student/StudentMyPage'));

// 학부모 콘솔 — 제품 전환(2026-07-18)으로 은퇴. 미성년 동의는 가입 게이트(guardian_email)가 담당.

// 학교(교사/기관) 콘솔 — 제품 전환(2026-07-17)으로 제거. 기존 계정은 종료 안내로.
const SchoolSunset = lazy(() => import('../pages/public/SchoolSunset'));

// 운영자
const OpsLogin = lazy(() => import('../pages/ops/OpsLogin'));
const OpsHome = lazy(() => import('../pages/ops/OpsHome'));
const OpsApproval = lazy(() => import('../pages/ops/OpsApproval'));
const OpsOrgs = lazy(() => import('../pages/ops/OpsOrgs'));
const OpsApiKeys = lazy(() => import('../pages/ops/OpsApiKeys'));
const OpsInquiries = lazy(() => import('../pages/ops/OpsInquiries'));
const OpsBehavior = lazy(() => import('../pages/ops/OpsBehavior'));
const OpsBehaviorExport = lazy(() => import('../pages/ops/OpsBehaviorExport'));
const OpsAuditLog = lazy(() => import('../pages/ops/OpsAuditLog'));
const OpsMonitoring = lazy(() => import('../pages/ops/OpsMonitoring'));
const OpsAlerts = lazy(() => import('../pages/ops/OpsAlerts'));
const OpsQuestionMetrics = lazy(() => import('../pages/ops/OpsQuestionMetrics'));
const OpsLlmModels = lazy(() => import('../pages/ops/OpsLlmModels'));
const OpsLlmKeys = lazy(() => import('../pages/ops/OpsLlmKeys'));
const OpsLlmPrompts = lazy(() => import('../pages/ops/OpsLlmPrompts'));
const OpsLectures = lazy(() => import('../pages/ops/OpsLectures'));
const OpsInstructorHome = lazy(() => import('../pages/ops/OpsInstructorHome'));
const OpsInstructorProfile = lazy(() => import('../pages/ops/OpsInstructorProfile'));
const OpsInquiry = lazy(() => import('../pages/ops/OpsInquiry'));
const OpsOperators = lazy(() => import('../pages/ops/OpsOperators'));
const OpsInstructors = lazy(() => import('../pages/ops/OpsInstructors'));
// 리뉴얼 상단바(2026-07-24) 신규 콘솔 화면
const OpsSystemStatus = lazy(() => import('../pages/ops/OpsSystemStatus'));
const OpsCourses = lazy(() => import('../pages/ops/OpsCourses'));
const OpsQuestionReview = lazy(() => import('../pages/ops/OpsQuestionReview'));
const OpsLearningAnalytics = lazy(() => import('../pages/ops/OpsLearningAnalytics'));
const OpsAccountUnlock = lazy(() => import('../pages/ops/OpsAccountUnlock'));

// 시스템
const NotFoundPage = lazy(() => import('../pages/system/NotFoundPage'));

/** "/" 게이트 — 로그인 상태면 랜딩(마케팅) 대신 역할별 홈으로 보낸다(랜딩은 로그아웃 전용).
 *  로그아웃·미인증은 랜딩(MainPage)을 그대로 본다. auth 판별 중(loading)엔 아무것도 안 그려
 *  로그인 사용자에게 랜딩이 잠깐 깜빡이는 것을 막는다(ProtectedRoute와 같은 규약). */
function HomeRoute() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (me) return <Navigate to={ROLE_HOME[me.role]} replace />;
  return <MainPage />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* 공개 — 랜딩은 로그아웃 전용(로그인 시 역할별 홈으로 보낸다) */}
        <Route path={PATHS.HOME} element={<HomeRoute />} />
        <Route path={PATHS.CONTACT} element={<ContactPage />} />
        {/* 고객지원 페이지는 접었다(0730) — 문의 양식·FAQ가 문의하기로 합쳐졌다.
            404 대신 리다이렉트로 둔다: 마이페이지·이메일·외부에 /support 링크가 남아 있다. */}
        <Route path={PATHS.SUPPORT} element={<Navigate to={PATHS.CONTACT} replace />} />
        <Route path={PATHS.TERMS} element={<TermsPage />} />
        <Route path={PATHS.PRIVACY} element={<PrivacyPage />} />
        <Route path={PATHS.LOGIN} element={<LoginPage />} />
        <Route path={PATHS.INVITE} element={<InvitePage />} />
        <Route path={PATHS.FIND_ID} element={<FindIdPage />} />
        <Route path={PATHS.PASSWORD_RESET} element={<PasswordResetPage />} />
        <Route path={PATHS.CAPTCHA} element={<CaptchaPage />} />
        <Route path={PATHS.ACTIVATE} element={<ActivatePage />} />

        {/* 학생 */}
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path={PATHS.STUDENT_HOME} element={<StudentHome />} />
          <Route path={PATHS.STUDENT_MY_COURSES} element={<MyCourses />} />
          <Route path={PATHS.STUDENT_INQUIRY} element={<StudentInquiry />} />
          <Route path={PATHS.STUDENT_EXAMS} element={<StudentExams />} />
          <Route path={PATHS.STUDENT_CERTIFICATES} element={<StudentCertificates />} />
          <Route path={PATHS.STUDENT_GAME} element={<GameScreen />} />
          <Route path={PATHS.STUDENT_RESULT} element={<GameResult />} />
          {/* 오늘의퀴즈 은퇴(Q 통합 2단계) — 북마크·옛 링크는 문제은행(오늘의 Q)으로 */}
          <Route
            path={PATHS.STUDENT_DAILY_QUIZ}
            element={<Navigate to={PATHS.STUDENT_ALL_LEARNING} replace />}
          />
          {/* '강의 신청' 페이지 은퇴 — 홈 '코스 둘러보기'로 통합(2026-08-04). 옛 링크·북마크·
              여러 화면의 '강의 둘러보기/목록으로'는 전부 홈으로 착지한다(신청·결제는 홈·코스상세가
              ?course= 로 직행하므로 무관). */}
          <Route
            path={PATHS.STUDENT_LECTURES}
            element={<Navigate to={PATHS.STUDENT_HOME} replace />}
          />
          <Route path={PATHS.STUDENT_COURSE_DETAIL} element={<CourseDetail />} />
          <Route path={PATHS.STUDENT_CHECKOUT} element={<Checkout />} />
          {/* 카카오페이 QR 승인/취소/실패 후 백엔드가 리다이렉트해 오는 착지 페이지 */}
          <Route path={PATHS.STUDENT_PAYMENT_SUCCESS} element={<PaymentResult kind="success" />} />
          <Route path={PATHS.STUDENT_PAYMENT_FAIL} element={<PaymentResult kind="fail" />} />
          <Route path={PATHS.STUDENT_PAYMENT_CANCEL} element={<PaymentResult kind="cancel" />} />
          <Route path={PATHS.STUDENT_LECTURE} element={<LecturePlayer />} />
          <Route path={PATHS.STUDENT_COURSE_EXAM} element={<CourseExam />} />
          <Route path={PATHS.STUDENT_ORDERS} element={<Orders />} />
          <Route path={PATHS.STUDENT_ALL_LEARNING} element={<AllLearning />} />
          {/* 개념 설명·취약문제추천 은퇴(성인화 0720, 초등 커리큘럼) — 옛 링크는 문제은행으로 */}
          <Route
            path={PATHS.STUDENT_CONCEPTS}
            element={<Navigate to={PATHS.STUDENT_ALL_LEARNING} replace />}
          />
          <Route
            path={PATHS.STUDENT_RECOMMENDED}
            element={<Navigate to={PATHS.STUDENT_ALL_LEARNING} replace />}
          />
          <Route path={PATHS.STUDENT_RECORDS} element={<MyRecords />} />
          <Route path={PATHS.STUDENT_WRONG_NOTES} element={<WrongNotes />} />
          <Route path={PATHS.STUDENT_SEARCH} element={<SearchPage />} />
          <Route path={PATHS.STUDENT_NOTIFICATIONS} element={<StudentNotifications />} />
          {/* 설정 → 마이페이지(계정 허브) '계정·개인정보' 탭으로 흡수(북마크 보호 리다이렉트) */}
          <Route
            path={PATHS.STUDENT_SETTINGS}
            element={<Navigate to={`${PATHS.STUDENT_MYPAGE}?tab=account`} replace />}
          />
          <Route path={PATHS.STUDENT_PROFILE_EDIT} element={<ProfileEdit />} />
          <Route path={PATHS.STUDENT_MYPAGE} element={<StudentMyPage />} />
        </Route>

        {/* 학교(교사/기관) 콘솔 — 제품 전환으로 제거(19페이지). 기존 계정의 로그인
            리다이렉트(ROLE_HOME)와 남은 딥링크는 종료 안내 한 장으로 수렴한다. */}
        <Route path={PATHS.SCHOOL_SUNSET} element={<SchoolSunset />} />

        {/* 운영자 전용 로그인 (공개 라우트 — 어디에도 링크하지 않는 숨겨진 진입구) */}
        <Route path={PATHS.OPS_LOGIN} element={<OpsLogin />} />

        {/* 운영자 (ops) */}
        <Route element={<ProtectedRoute roles={['ops']} />}>
          <Route path={PATHS.OPS_DASHBOARD} element={<OpsHome />} />
          <Route path={PATHS.OPS_APPROVAL} element={<OpsApproval />} />
          <Route path={PATHS.OPS_ORGS} element={<OpsOrgs />} />
          <Route path={PATHS.OPS_API_KEYS} element={<OpsApiKeys />} />
          <Route path={PATHS.OPS_INQUIRIES} element={<OpsInquiries />} />
          <Route path={PATHS.OPS_BEHAVIOR} element={<OpsBehavior />} />
          <Route path={PATHS.OPS_BEHAVIOR_EXPORT} element={<OpsBehaviorExport />} />
          <Route path={PATHS.OPS_LOGS} element={<OpsAuditLog />} />
          <Route path={PATHS.OPS_MONITORING} element={<OpsMonitoring />} />
          <Route path={PATHS.OPS_ALERTS} element={<OpsAlerts />} />
          {/* 모델 카탈로그 삭제(2026-07-23·레거시 표시용) — 북마크 보호용 리다이렉트 */}
          <Route path={PATHS.OPS_AI_MODELS} element={<Navigate to={PATHS.OPS_APPROVAL} replace />} />
          <Route path={PATHS.OPS_LLM_MODELS} element={<OpsLlmModels />} />
          <Route path={PATHS.OPS_LLM_KEYS} element={<OpsLlmKeys />} />
          <Route path={PATHS.OPS_LLM_PROMPTS} element={<OpsLlmPrompts />} />
          {/* 레거시 '설정' 경로 — LLM 설정 3분할로 대체됨. 북마크 보호용 리다이렉트. */}
          <Route path={PATHS.OPS_SETTINGS} element={<Navigate to={PATHS.OPS_LLM_KEYS} replace />} />
          <Route path={PATHS.OPS_OPERATORS} element={<OpsOperators />} />
          <Route path={PATHS.OPS_INSTRUCTORS} element={<OpsInstructors />} />
          <Route path={PATHS.OPS_SYSTEM_STATUS} element={<OpsSystemStatus />} />
          <Route path={PATHS.OPS_ACCOUNT_UNLOCK} element={<OpsAccountUnlock />} />
        </Route>

        {/* 강의 제작 콘솔 — 운영자(전체) + 강사(자기 강의만, 스코프는 서버가 강제) */}
        <Route element={<ProtectedRoute roles={['ops', 'instructor']} />}>
          <Route path={PATHS.OPS_INSTRUCTOR_HOME} element={<OpsInstructorHome />} />
          <Route path={PATHS.OPS_INSTRUCTOR_PROFILE} element={<OpsInstructorProfile />} />
          <Route path={PATHS.OPS_INQUIRY} element={<OpsInquiry />} />
          <Route path={PATHS.OPS_LECTURES} element={<OpsLectures />} />
          <Route path={PATHS.OPS_QUESTION_METRICS} element={<OpsQuestionMetrics />} />
          <Route path={PATHS.OPS_COURSES} element={<OpsCourses />} />
          {/* 문항 검수·학습 분석은 저작자(강사) 전용 API(require_content_author)라 운영자가
              들어오면 목록 페이지들과 동일하게 카드 안에서 '불러오지 못했어요'로 보인다. */}
          <Route path={PATHS.OPS_QUESTION_REVIEW} element={<OpsQuestionReview />} />
          <Route path={PATHS.OPS_LEARNING_ANALYTICS} element={<OpsLearningAnalytics />} />
        </Route>

        {/* 404 — handoff: CatChap 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
