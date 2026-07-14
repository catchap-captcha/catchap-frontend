import { Link, useParams, useSearchParams } from 'react-router-dom';
import ScratchBrowser from '../../components/scratch/ScratchBrowser';
import { teacherApi } from '../../api/teacher';
import { PATHS } from '../../routes/paths';

/**
 * 교사용 학생 연습장 필기 재생 — /teacher/students/:studentId/scratch
 * 열람 시 서버가 감사 로그(student.scratch_view)를 남긴다(모든 교사 열람 허용, 추적).
 */
export default function TeacherScratch() {
  const { studentId = '' } = useParams();
  const [sp] = useSearchParams();
  const name = sp.get('name') || '학생';

  return (
    <div>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 14px 0' }}>
        <Link
          to={PATHS.TEACHER_STUDENTS}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#8A8175', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
        >
          <i className="ph-bold ph-arrow-left" /> 학생 목록
        </Link>
      </div>
      <ScratchBrowser
        title={`${name} 학생의 필기`}
        subtitle="학생이 문제를 풀며 연습장에 쓴 풀이 과정을 과목별로 볼 수 있어요."
        emptyHint="이 학생이 아직 연습장에 필기를 남기지 않았어요."
        notice="필기 열람 기록은 감사 로그에 남습니다. 학습 지도 목적으로만 확인해 주세요."
        loadList={(subject) => teacherApi.studentScratch(studentId, subject)}
        loadDetail={(recordId) => teacherApi.studentScratchDetail(studentId, recordId)}
      />
    </div>
  );
}
