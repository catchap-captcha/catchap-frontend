import { useCallback, useEffect, useRef, useState } from 'react';
import { lectureApi } from '../../api/lectures';
import { drawCourseCertificate, type CourseCertificateData } from '../../utils/certificate';
import { canvasToPdf } from '../../utils/pdf';
import './CertificateModal.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 코스 수료증 팝업 — 미리보기 + 파일 저장.
 *
 * 수료 여부는 **서버가 판정한다**: GET .../exam/certificate 는 실제 수료자에게만 200을 주고
 * 미수료면 404다. 그래서 이 컴포넌트는 조건 판단을 직접 하지 않고, 받은 값만 캔버스로 그린다
 * (프론트에서 수료를 지어내 위조하는 경로를 만들지 않기 위함 — course_exam.py 주석 참고).
 *
 * 쓰는 곳: 수료 시험 합격 직후 자동 노출(CourseExam), 나의 기록의 '수료증' 버튼(MyRecords).
 */
export default function CertificateModal({
  courseId,
  autoTitle,
  onClose,
}: {
  courseId: string;
  /** 로딩 중 보여줄 코스명 — 목록에서 이미 알고 있으면 넘겨 빈 화면을 줄인다. */
  autoTitle?: string;
  onClose: () => void;
}) {
  const [cert, setCert] = useState<CourseCertificateData | null>(null);
  const [pngUrl, setPngUrl] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState<'' | 'pdf' | 'png'>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    setErr('');
    setPngUrl('');
    lectureApi
      .examCertificate(courseId)
      .then(async (c) => {
        const data: CourseCertificateData = {
          studentName: c.student_name,
          courseTitle: c.course_title,
          subject: c.subject,
          passedAt: c.passed_at,
          perfect: c.perfect,
          questionCount: c.question_count,
          serial: c.serial,
        };
        const canvas = await drawCourseCertificate(data);
        if (!alive) return;
        canvasRef.current = canvas;
        setCert(data);
        setPngUrl(canvas.toDataURL('image/png'));
      })
      .catch((e: any) => {
        if (!alive) return;
        setErr(e?.response?.data?.detail ?? '수료증을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  // ESC로 닫기 — 다른 모달(InstructorBioModal)과 같은 규약
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fileBase = `수료증_${cert?.courseTitle ?? autoTitle ?? '코스'}`;

  const savePdf = useCallback(async () => {
    if (!canvasRef.current || saving) return;
    setSaving('pdf');
    try {
      await canvasToPdf(`${fileBase}.pdf`, canvasRef.current);
    } catch {
      setErr('PDF로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving('');
    }
  }, [fileBase, saving]);

  const savePng = useCallback(() => {
    if (!pngUrl || saving) return;
    setSaving('png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${fileBase}.png`;
    a.click();
    setSaving('');
  }, [pngUrl, fileBase, saving]);

  return (
    <div className="cm-backdrop" onClick={onClose} role="presentation">
      <div
        className="cm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="수료증"
      >
        <div className="cm-head">
          <div>
            <h2 className="cm-title">수료증</h2>
            <p className="cm-sub">{cert?.courseTitle ?? autoTitle ?? '수료증을 준비하고 있어요'}</p>
          </div>
          <button className="cm-close" onClick={onClose} aria-label="닫기">
            <i className="ph-bold ph-x" />
          </button>
        </div>

        <div className="cm-body">
          {err && (
            <div className="cm-err">
              <i className="ph-fill ph-warning-circle" /> {err}
            </div>
          )}
          {!err && !pngUrl && <div className="cm-loading">수료증을 만드는 중이에요…</div>}
          {pngUrl && <img className="cm-preview" src={pngUrl} alt={`${cert?.courseTitle} 수료증`} />}
        </div>

        <div className="cm-actions">
          <button className="cm-btn cm-btn--ghost" onClick={onClose}>
            닫기
          </button>
          <button className="cm-btn cm-btn--ghost" onClick={savePng} disabled={!pngUrl || !!saving}>
            <i className="ph-fill ph-image" /> PNG 저장
          </button>
          <button className="cm-btn cm-btn--primary" onClick={savePdf} disabled={!pngUrl || !!saving}>
            <i className="ph-fill ph-file-arrow-down" /> {saving === 'pdf' ? '저장 중…' : 'PDF 다운로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
