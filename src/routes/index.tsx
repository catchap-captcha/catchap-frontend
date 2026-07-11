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
const AllLearning = lazy(() => import('../pages/student/AllLearning'));
const Concepts = lazy(() => import('../pages/student/Concepts'));
const MyRecords = lazy(() => import('../pages/student/MyRecords'));
const WrongNotes = lazy(() => import('../pages/student/WrongNotes'));
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

// 교사
const TeacherHome = lazy(() => import('../pages/teacher/TeacherHome'));
const TeacherClass = lazy(() => import('../pages/teacher/TeacherClass'));
const TeacherStudents = lazy(() => import('../pages/teacher/TeacherStudents'));
const TeacherAnalytics = lazy(() => import('../pages/teacher/TeacherAnalytics'));
const FamilyNotice = lazy(() => import('../pages/teacher/FamilyNotice'));
const TeacherMyPage = lazy(() => import('../pages/teacher/TeacherMyPage'));

// 기관
const OrgHome = lazy(() => import('../pages/org/OrgHome'));
const OrgClasses = lazy(() => import('../pages/org/OrgClasses'));
const OrgTeachers = lazy(() => import('../pages/org/OrgTeachers'));
const OrgAuditLog = lazy(() => import('../pages/org/OrgAuditLog'));
const OrgAnalytics = lazy(() => import('../pages/org/OrgAnalytics'));
const CaptchaSettings = lazy(() => import('../pages/org/CaptchaSettings'));
const OrgApiKeys = lazy(() => import('../pages/org/OrgApiKeys'));
const AiModels = lazy(() => import('../pages/org/AiModels'));
const SecurityPolicy = lazy(() => import('../pages/org/SecurityPolicy'));
const OrgMyPage = lazy(() => import('../pages/org/OrgMyPage'));
const OrgStudents = lazy(() => import('../pages/org/OrgStudents'));
const OrgContact = lazy(() => import('../pages/org/OrgContact'));

// 운영자
const OpsLogin = lazy(() => import('../pages/ops/OpsLogin'));
const OpsApproval = lazy(() => import('../pages/ops/OpsApproval'));
const OpsOrgs = lazy(() => import('../pages/ops/OpsOrgs'));
const OpsApiKeys = lazy(() => import('../pages/ops/OpsApiKeys'));
const OpsInquiries = lazy(() => import('../pages/ops/OpsInquiries'));
const OpsBehavior = lazy(() => import('../pages/ops/OpsBehavior'));
const OpsBehaviorExport = lazy(() => import('../pages/ops/OpsBehaviorExport'));
const OpsAuditLog = lazy(() => import('../pages/ops/OpsAuditLog'));
const OpsSystem = lazy(() => import('../pages/ops/OpsSystem'));
const OpsAiModels = lazy(() => import('../pages/ops/OpsAiModels'));
const OpsOperators = lazy(() => import('../pages/ops/OpsOperators'));

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
          <Route path={PATHS.STUDENT_ALL_LEARNING} element={<AllLearning />} />
          <Route path={PATHS.STUDENT_CONCEPTS} element={<Concepts />} />
          <Route path={PATHS.STUDENT_RECORDS} element={<MyRecords />} />
          <Route path={PATHS.STUDENT_WRONG_NOTES} element={<WrongNotes />} />
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

        {/* 교사 */}
        <Route element={<ProtectedRoute roles={['teacher', 'grade_head', 'org_admin']} />}>
          <Route path={PATHS.TEACHER_HOME} element={<TeacherHome />} />
          <Route path={PATHS.TEACHER_CLASS} element={<TeacherClass />} />
          <Route path={PATHS.TEACHER_STUDENTS} element={<TeacherStudents />} />
          <Route path={PATHS.TEACHER_ANALYTICS} element={<TeacherAnalytics />} />
          <Route path={PATHS.TEACHER_FAMILY_NOTICE} element={<FamilyNotice />} />
          <Route path={PATHS.TEACHER_MYPAGE} element={<TeacherMyPage />} />
        </Route>

        {/* 기관 관리자(교장) + 학년부장 공용: 학급/교사/학생 관리
            (백엔드가 학년부장은 담당 학년으로 자동 스코프) */}
        <Route element={<ProtectedRoute roles={['grade_head', 'org_admin', 'ops']} />}>
          <Route path={PATHS.ORG_CLASSES} element={<OrgClasses />} />
          <Route path={PATHS.ORG_TEACHERS} element={<OrgTeachers />} />
          <Route path={PATHS.ORG_AUDIT} element={<OrgAuditLog />} />
          <Route path={PATHS.ORG_STUDENTS} element={<OrgStudents />} />
          <Route path={PATHS.ORG_CONTACT} element={<OrgContact />} />
        </Route>

        {/* 교장(org_admin) 전용: 전교 대시보드·분석 + 기관 전체 설정
            (전교 집계는 담당 학년만 보는 학년부장에게 노출하지 않음) */}
        <Route element={<ProtectedRoute roles={['org_admin', 'ops']} />}>
          <Route path={PATHS.ORG_HOME} element={<OrgHome />} />
          <Route path={PATHS.ORG_ANALYTICS} element={<OrgAnalytics />} />
          <Route path={PATHS.ORG_CAPTCHA_SETTINGS} element={<CaptchaSettings />} />
          <Route path={PATHS.ORG_API_KEYS} element={<OrgApiKeys />} />
          <Route path={PATHS.ORG_AI_MODELS} element={<AiModels />} />
          <Route path={PATHS.ORG_SECURITY_POLICY} element={<SecurityPolicy />} />
          <Route path={PATHS.ORG_MYPAGE} element={<OrgMyPage />} />
        </Route>

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
          <Route path={PATHS.OPS_LOGS} element={<OpsAuditLog />} />
          <Route path={PATHS.OPS_SYSTEM} element={<OpsSystem />} />
          <Route path={PATHS.OPS_AI_MODELS} element={<OpsAiModels />} />
          <Route path={PATHS.OPS_OPERATORS} element={<OpsOperators />} />
        </Route>

        {/* 404 — handoff: CatChap 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
