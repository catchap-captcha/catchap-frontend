import { courseCover } from '../../utils/courseCover';
import CatMark from '../brand/CatMark';
import './CourseCover.css';

/**
 * CourseCover — 코스 생성 커버 아트(썸네일 대체).
 * 브랜드 계열 그라데이션 + 미세 패턴 + 흐린 CatMark 워터마크 + 대표 글자 모노그램.
 * size: sm=목록 행 썸네일 / md=카드 / lg=히어로. 실제 썸네일이 생기면 이 자리만 교체.
 */
export default function CourseCover({
  seed,
  label,
  size = 'md',
  className,
  imageUrl,
}: {
  seed: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** 실제 썸네일(절대 URL — 호출부에서 thumbnailSrc로 변환해 넘긴다). 있으면 이미지를 커버에
   *  꽉 차게 깔고, 없으면 아래 생성 커버(그라데이션+모노그램)로 폴백한다. */
  imageUrl?: string | null;
}) {
  const art = courseCover(seed, label);
  return (
    <div
      className={`cover cover--${size} cover--pat${art.pattern}${className ? ` ${className}` : ''}`}
      style={{ ['--cover-from' as string]: art.from, ['--cover-to' as string]: art.to }}
      aria-hidden="true"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="cover-img" loading="lazy" />
      ) : (
        <>
          <CatMark size={size === 'sm' ? 34 : 72} variant="ghost" whiskers={false} className="cover-cat" />
          <span className="cover-mono">{art.monogram}</span>
        </>
      )}
    </div>
  );
}
