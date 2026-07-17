import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { PATHS } from './paths';

// 공개
const MainPage = lazy(() => import('../pages/public/MainPage'));
const ContactPage = lazy(() => import('../pages/public/ContactPage'));
const SupportPage = lazy(() => import('../pages/public/SupportPage'));
const TermsPage = lazy(() => import('../pages/public/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/public/PrivacyPage'));

// 인증
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const PasswordResetPage = lazy(() => import('../pages/auth/PasswordResetPage'));
const CaptchaPage = lazy(() => import('../pages/auth/CaptchaPage'));
const ActivatePage = lazy(() => import('../pages/auth/ActivatePage'));
const InvitePage = lazy(() => import('../pages/auth/InvitePage'));

// 학생
const StudentHome = lazy(() => import('../pages/student/StudentHome'));
const ChapterMap = lazy(() => import('../pages/student/ChapterMap'));
const GameScreen = lazy(() => import('../pages/student/GameScreen'));
const GameResult = lazy(() => import('../pages/student/GameResult'));
const DailyQuiz = lazy(() => import('../pages/student/DailyQuiz'));
const LectureList = lazy(() => import('../pages/student/LectureList'));
const LecturePlayer = lazy(() => import('../pages/student/LecturePlayer'));
const AllLearning = lazy(() => import('../pages/student/AllLearning'));
const Concepts = lazy(() => import('../pages/student/Concepts'));
const MyRecords = lazy(() => import('../pages/student/MyRecords'));
const WrongNotes = lazy(() => import('../pages/student/WrongNotes'));
const StudentScratch = lazy(() => import('../pages/student/StudentScratch'));
const Badges = lazy(() => import('../pages/student/Badges'));
const ProfileCustomize = lazy(() => import('../pages/student/ProfileCustomize'));
const Recommended = lazy(() => import('../pages/student/Recommended'));
const AiTeacher = lazy(() => import('../pages/student/AiTeacher'));
const SearchPage = lazy(() => import('../pages/student/SearchPage'));
const StudentNotifications = lazy(() => import('../pages/student/StudentNotifications'));
const StudentSettings = lazy(() => import('../pages/student/StudentSettings'));

// 학부모
const ParentHome = lazy(() => import('../pages/parent/ParentHome'));
const ParentReports = lazy(() => import('../pages/parent/ParentReports'));
const ParentCounselAi = lazy(() => import('../pages/parent/ParentCounselAi'));
const ParentNotifications = lazy(() => import('../pages/parent/ParentNotifications'));
const ParentMyPage = lazy(() => import('../pages/parent/ParentMyPage'));

// 학교(교사/기관) 콘솔 — 제품 전환(2026-07-17)으로 제거. 기존 계정은 종료 안내로.
const SchoolSunset = lazy(() => import('../pages/public/SchoolSunset'));

// 운영자
const OpsLogin = lazy(() => import('../pages/ops/OpsLogin'));
const OpsApproval = lazy(() => import('../pages/ops/OpsApproval'));
const OpsOrgs = lazy(() => import('../pages/ops/OpsOrgs'));
const OpsApiKeys = lazy(() => import('../pages/ops/OpsApiKeys'));
const OpsInquiries = lazy(() => import('../pages/ops/OpsInquiries'));
const OpsBehavior = lazy(() => import('../pages/ops/OpsBehavior'));
const OpsBehaviorExport = lazy(() => import('../pages/ops/OpsBehaviorExport'));
const OpsScratch = lazy(() => import('../pages/ops/OpsScratch'));
const OpsAuditLog = lazy(() => import('../pages/ops/OpsAuditLog'));
const OpsSystem = lazy(() => import('../pages/ops/OpsSystem'));
const OpsAiModels = lazy(() => import('../pages/ops/OpsAiModels'));
const OpsSettings = lazy(() => import('../pages/ops/OpsSettings'));
const OpsLectures = lazy(() => import('../pages/ops/OpsLectures'));
const OpsOperators = lazy(() => import('../pages/ops/OpsOperators'));
const OpsInstructors = lazy(() => import('../pages/ops/OpsInstructors'));

// 시스템
const NotFoundPage = lazy(() => import('../pages/system/NotFoundPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* 공개 */}
        <Route path={PATHS.HOME} element={<MainPage />} />
        <Route path={PATHS.CONTACT} element={<ContactPage />} />
        <Route path={PATHS.SUPPORT} element={<SupportPage />} />
        <Route path={PATHS.TERMS} element={<TermsPage />} />
        <Route path={PATHS.PRIVACY} element={<PrivacyPage />} />
        <Route path={PATHS.LOGIN} element={<LoginPage />} />
        <Route path={PATHS.INVITE} element={<InvitePage />} />
        <Route path={PATHS.PASSWORD_RESET} element={<PasswordResetPage />} />
        <Route path={PATHS.CAPTCHA} element={<CaptchaPage />} />
        <Route path={PATHS.ACTIVATE} element={<ActivatePage />} />

        {/* 학생 */}
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path={PATHS.STUDENT_HOME} element={<StudentHome />} />
          <Route path={PATHS.STUDENT_CHAPTERS} element={<ChapterMap />} />
          <Route path={PATHS.STUDENT_GAME} element={<GameScreen />} />
          <Route path={PATHS.STUDENT_RESULT} element={<GameResult />} />
          <Route path={PATHS.STUDENT_DAILY_QUIZ} element={<DailyQuiz />} />
          <Route path={PATHS.STUDENT_LECTURES} element={<LectureList />} />
          <Route path={PATHS.STUDENT_LECTURE} element={<LecturePlayer />} />
          <Route path={PATHS.STUDENT_ALL_LEARNING} element={<AllLearning />} />
          <Route path={PATHS.STUDENT_CONCEPTS} element={<Concepts />} />
          <Route path={PATHS.STUDENT_RECORDS} element={<MyRecords />} />
          <Route path={PATHS.STUDENT_WRONG_NOTES} element={<WrongNotes />} />
          <Route path={PATHS.STUDENT_SCRATCH} element={<StudentScratch />} />
          <Route path={PATHS.STUDENT_BADGES} element={<Badges />} />
          <Route path={PATHS.STUDENT_PROFILE} element={<ProfileCustomize />} />
          <Route path={PATHS.STUDENT_RECOMMENDED} element={<Recommended />} />
          <Route path={PATHS.STUDENT_AI_TEACHER} element={<AiTeacher />} />
          <Route path={PATHS.STUDENT_SEARCH} element={<SearchPage />} />
          <Route path={PATHS.STUDENT_NOTIFICATIONS} element={<StudentNotifications />} />
          <Route path={PATHS.STUDENT_SETTINGS} element={<StudentSettings />} />
        </Route>

        {/* 학부모 */}
        <Route element={<ProtectedRoute roles={['parent']} />}>
          <Route path={PATHS.PARENT_HOME} element={<ParentHome />} />
          <Route path={PATHS.PARENT_REPORTS} element={<ParentReports />} />
          <Route path={PATHS.PARENT_COUNSEL_AI} element={<ParentCounselAi />} />
          <Route path={PATHS.PARENT_NOTIFICATIONS} element={<ParentNotifications />} />
          <Route path={PATHS.PARENT_MYPAGE} element={<ParentMyPage />} />
        </Route>

        {/* 학교(교사/기관) 콘솔 — 제품 전환으로 제거(19페이지). 기존 계정의 로그인
            리다이렉트(ROLE_HOME)와 남은 딥링크는 종료 안내 한 장으로 수렴한다. */}
        <Route path={PATHS.SCHOOL_SUNSET} element={<SchoolSunset />} />

        {/* 운영자 전용 로그인 (공개 라우트 — 어디에도 링크하지 않는 숨겨진 진입구) */}
        <Route path={PATHS.OPS_LOGIN} element={<OpsLogin />} />

        {/* 운영자 (ops) */}
        <Route element={<ProtectedRoute roles={['ops']} />}>
          <Route path={PATHS.OPS_APPROVAL} element={<OpsApproval />} />
          <Route path={PATHS.OPS_ORGS} element={<OpsOrgs />} />
          <Route path={PATHS.OPS_API_KEYS} element={<OpsApiKeys />} />
          <Route path={PATHS.OPS_INQUIRIES} element={<OpsInquiries />} />
          <Route path={PATHS.OPS_BEHAVIOR} element={<OpsBehavior />} />
          <Route path={PATHS.OPS_BEHAVIOR_EXPORT} element={<OpsBehaviorExport />} />
          <Route path={PATHS.OPS_SCRATCH} element={<OpsScratch />} />
          <Route path={PATHS.OPS_LOGS} element={<OpsAuditLog />} />
          <Route path={PATHS.OPS_SYSTEM} element={<OpsSystem />} />
          <Route path={PATHS.OPS_AI_MODELS} element={<OpsAiModels />} />
          <Route path={PATHS.OPS_SETTINGS} element={<OpsSettings />} />
          <Route path={PATHS.OPS_OPERATORS} element={<OpsOperators />} />
          <Route path={PATHS.OPS_INSTRUCTORS} element={<OpsInstructors />} />
        </Route>

        {/* 강의 제작 콘솔 — 운영자(전체) + 강사(자기 강의만, 스코프는 서버가 강제) */}
        <Route element={<ProtectedRoute roles={['ops', 'instructor']} />}>
          <Route path={PATHS.OPS_LECTURES} element={<OpsLectures />} />
        </Route>

        {/* 404 — handoff: CatChap 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
