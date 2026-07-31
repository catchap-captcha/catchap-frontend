import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../layouts/StudentLayout';
import { PATHS } from '../../routes/paths';
import { lectureApi, thumbnailSrc, type StudentCourse } from '../../api/lectures';
import CourseCover from '../../components/course/CourseCover';
import CertificateModal from '../../components/course/CertificateModal';
import './StudentCertificates.css';

/**
 * 수료증 — 상단바 '수료' 그룹. 수료한(수료 시험 통과) 코스만 모아 수료증을 확인·다운로드한다.
 * 종전엔 '수료증' 메뉴가 '수료시험'과 같은 수료 현황 탭으로 가서 별개 화면이 없었다(사용자 지적).
 *
 * 발급 자체(서버 수료 검증 → 캔버스 렌더 → PNG/PDF 저장)는 기존 CertificateModal이 맡는다 —
 * 수료 자격은 서버가 최종 판정하므로 여기선 통과한 코스 목록만 보여준다.
 */
function fmtPassedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 수료`;
}

export default function StudentCertificates() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [certCourse, setCertCourse] = useState<StudentCourse | null>(null);

  useEffect(() => {
    let alive = true;
    lectureApi
      .courses()
      .then((cs) => {
        if (!alive) return;
        setCourses(Array.isArray(cs) ? cs : []);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, []);

  const passed = (courses ?? []).filter((c) => c.exam?.passed);

  return (
    <StudentLayout className="sc-root">
      <section className="sc-wrap">
        <div className="sc-head">
          <h1 className="sc-title">수료증</h1>
          <p className="sc-sub">수료한 코스의 수료증을 확인하고 PDF·이미지로 내려받을 수 있어요.</p>
        </div>

        {state === 'loading' && <div className="sc-empty">불러오는 중…</div>}
        {state === 'error' && (
          <div className="sc-empty">수료증을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        )}

        {state === 'ready' && passed.length === 0 && (
          <div className="sc-empty">
            <i className="ph ph-certificate sc-empty-ic" />
            <p className="sc-empty-txt">
              아직 받은 수료증이 없어요.
              <br />
              코스를 완주하고 수료 시험을 통과하면 여기에 수료증이 발급돼요.
            </p>
            <button
              className="sc-cta"
              onClick={() => navigate(`${PATHS.STUDENT_RECORDS}?tab=completion`)}
            >
              <i className="ph-fill ph-seal-check" /> 수료 현황 보기
            </button>
          </div>
        )}

        {state === 'ready' && passed.length > 0 && (
          <div className="sc-list">
            {passed.map((c) => (
              <div key={c.id} className="sc-card">
                <CourseCover
                  seed={c.id}
                  label={c.title || c.subject}
                  imageUrl={thumbnailSrc(c.thumbnail_url)}
                  size="sm"
                  className="sc-cover"
                />
                <div className="sc-cbody">
                  <div className="sc-ctop">
                    <span className="sc-ctitle">{c.title}</span>
                    <span className={`sc-badge${c.exam?.perfect ? ' sc-badge-perfect' : ''}`}>
                      {c.exam?.perfect ? '만점 수료' : '수료'}
                    </span>
                  </div>
                  <div className="sc-meta">
                    {c.instructor_name ? `${c.instructor_name} 강사 · ` : ''}
                    {c.subject}
                    {fmtPassedAt(c.exam?.passed_at) && ` · ${fmtPassedAt(c.exam?.passed_at)}`}
                  </div>
                </div>
                <button className="sc-btn" onClick={() => setCertCourse(c)}>
                  <i className="ph-fill ph-download-simple" /> 수료증 보기
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 수료증 팝업 — 발급 자격은 서버가 최종 판정(미수료면 404). PNG/PDF 저장은 모달이 처리. */}
      {certCourse && (
        <CertificateModal
          courseId={certCourse.id}
          autoTitle={certCourse.title}
          onClose={() => setCertCourse(null)}
        />
      )}
    </StudentLayout>
  );
}
