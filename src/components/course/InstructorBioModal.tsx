import { useEffect } from 'react';
import { loadInstructorBio } from '../../api/instructorBio';
import './InstructorBioModal.css';

/**
 * 강사 소개 모달 — 코스의 '강사 소개' 버튼이 여는 창.
 *
 * 내용은 강사가 프로필 화면에서 직접 저장한 이력(instructorBio)이다. 저장된 게 없으면
 * 지어내지 않고 '아직 등록되지 않았어요'로 정직하게 비운다(강사 이름은 그대로 보여준다).
 */
export default function InstructorBioModal({
  name,
  courseTitle,
  onClose,
}: {
  name: string;
  /** 어느 코스에서 열었는지 — 머리에 작게 표기(같은 강사의 코스가 여럿일 때 맥락) */
  courseTitle?: string | null;
  onClose: () => void;
}) {
  const bio = loadInstructorBio(name);

  // ESC로 닫기 — 마우스를 안 쓰는 사용자도 빠져나올 수 있게.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ibm-overlay" onClick={onClose} role="presentation">
      <div
        className="ibm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} 강사 소개`}
      >
        <button className="ibm-x" onClick={onClose} aria-label="닫기">
          <i className="ph-bold ph-x" />
        </button>

        <div className="ibm-head">
          <span className="ibm-avatar">{name.slice(0, 1)}</span>
          <div className="ibm-headinfo">
            <span className="ibm-tag">
              <i className="ph-fill ph-chalkboard-teacher" /> 강사 소개
            </span>
            <h3 className="ibm-name">{name} 강사</h3>
            {courseTitle && <p className="ibm-course">{courseTitle}</p>}
          </div>
        </div>

        {bio ? (
          <div className="ibm-body">
            {bio.headline && <p className="ibm-headline">{bio.headline}</p>}
            {bio.career && <div className="ibm-career">{bio.career}</div>}
          </div>
        ) : (
          <div className="ibm-empty">
            <i className="ph-fill ph-note-pencil" />
            <p>아직 등록된 소개가 없어요.</p>
            <span>강사가 프로필에서 이력을 등록하면 여기에 보여요.</span>
          </div>
        )}

        <button className="ibm-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
