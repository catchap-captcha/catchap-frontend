import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lectureApi } from '../../api/lectures';
import {
  certHtml,
  drawCourseCertificate,
  ensureCertFonts,
  type CourseCertificateData,
} from '../../utils/certificate';
import { canvasToPdf } from '../../utils/pdf';
import './CertificateModal.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 코스 수료증 팝업 — 미리보기 + 파일 저장.
 *
 * 수료 여부는 **서버가 판정한다**: GET .../exam/certificate 는 실제 수료자에게만 200을 주고
 * 미수료면 404다. 그래서 이 컴포넌트는 조건 판단을 직접 하지 않고, 받은 값만 렌더한다
 * (프론트에서 수료를 지어내 위조하는 경로를 만들지 않기 위함 — course_exam.py 주석 참고).
 *
 * 미리보기는 참조 디자인 HTML을 그대로(브라우저 렌더) 축소해 보여주고, 저장은 같은 HTML을
 * html2canvas로 캡처해 PNG/PDF로 만든다(drawCourseCertificate). 값은 학생 이름·과목(코스명)·
 * 날짜만 동적이다.
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
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<'' | 'pdf' | 'png'>('');
  const [scale, setScale] = useState(0.5);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setErr('');
    setReady(false);
    Promise.all([lectureApi.examCertificate(courseId), ensureCertFonts()])
      .then(([c]) => {
        if (!alive) return;
        setCert({
          studentName: c.student_name,
          courseTitle: c.course_title,
          subject: c.subject,
          passedAt: c.passed_at,
          perfect: c.perfect,
          questionCount: c.question_count,
          serial: c.serial,
        });
        setReady(true);
      })
      .catch((e: any) => {
        if (!alive) return;
        setErr(e?.response?.data?.detail ?? '수료증을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  // 미리보기 스케일 — 고정 크기(1056×816) 카드를 프레임 폭에 맞춰 축소한다.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !ready) return;
    const update = () => setScale(el.clientWidth / 1056);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // ESC로 닫기 — 다른 모달과 같은 규약
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fileBase = `수료증_${cert?.courseTitle ?? autoTitle ?? '코스'}`;

  const download = useCallback(
    async (kind: 'pdf' | 'png') => {
      if (!cert || saving) return;
      setSaving(kind);
      try {
        const canvas = await drawCourseCertificate(cert);
        if (kind === 'pdf') {
          await canvasToPdf(`${fileBase}.pdf`, canvas);
        } else {
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `${fileBase}.png`;
          a.click();
        }
      } catch {
        setErr(
          kind === 'pdf'
            ? 'PDF로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : 'PNG로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      } finally {
        setSaving('');
      }
    },
    [cert, saving, fileBase],
  );

  const previewHtml = useMemo(() => (cert ? certHtml(cert) : ''), [cert]);

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
          {!err && !ready && <div className="cm-loading">수료증을 만드는 중이에요…</div>}
          {!err && ready && cert && (
            <div
              ref={frameRef}
              className="cm-certframe"
              style={{ aspectRatio: '1056 / 816' }}
              aria-label={`${cert.courseTitle} 수료증`}
            >
              <div
                className="cm-cert"
                style={{ transform: `scale(${scale})` }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        <div className="cm-actions">
          <button className="cm-btn cm-btn--ghost" onClick={onClose}>
            닫기
          </button>
          <button
            className="cm-btn cm-btn--ghost"
            onClick={() => download('png')}
            disabled={!ready || !!saving}
          >
            <i className="ph-fill ph-image" /> {saving === 'png' ? '저장 중…' : 'PNG 저장'}
          </button>
          <button
            className="cm-btn cm-btn--primary"
            onClick={() => download('pdf')}
            disabled={!ready || !!saving}
          >
            <i className="ph-fill ph-file-arrow-down" /> {saving === 'pdf' ? '저장 중…' : 'PDF 다운로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
