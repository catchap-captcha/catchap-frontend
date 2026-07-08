/**
 * 데모칸 표시 배지 — 백엔드 응답에 demo=true 인 데이터(실 학습기록이 없어 예시값으로 채운 것)를
 * "데모"로 명시한다. 실데이터가 쌓이면 자동으로 사라진다.
 *
 *   <DemoBadge show={data.demo} />                 // 칩 (인라인)
 *   <DemoBadge show={data.demo} variant="banner" /> // 상단 배너 (섹션/페이지 상단)
 */
interface Props {
  show?: boolean;
  label?: string;
  variant?: 'chip' | 'banner';
  title?: string;
}

const TIP = '실제 학습 기록이 아직 없어 예시(데모) 데이터로 표시 중이에요. 학생이 문제를 풀면 실제 값으로 바뀝니다.';

export default function DemoBadge({ show, label = '데모', variant = 'chip', title }: Props) {
  if (!show) return null;
  if (variant === 'banner') {
    return (
      <div
        title={title || TIP}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px',
          padding: '9px 14px', borderRadius: 12, background: '#FFF7E6',
          border: '1px solid #FFE1A6', color: '#9A6B00', fontSize: 13, fontWeight: 700,
        }}
      >
        <span aria-hidden style={{ fontSize: 15 }}>🧪</span>
        <span>데모 데이터 — {TIP}</span>
      </div>
    );
  }
  return (
    <span
      title={title || TIP}
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '1px 7px', marginLeft: 6,
        borderRadius: 8, background: '#FFF1D6', border: '1px solid #FFDca6',
        color: '#9A6B00', fontSize: 11, fontWeight: 800, lineHeight: '16px', verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
}
