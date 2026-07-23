import CountUp from '../motion/CountUp';
import './StatTile.css';

/**
 * StatTile — 마이페이지 학습 요약의 한 칸.
 *
 * 왜 바꾸나: 기존 요약은 "큰 숫자 4개"로 끝나 시각적 흥미가 없었다. 각 타일에
 * (1) 아이콘 칩, (2) 0→값으로 세어 오르는 CountUp, (3) 값의 상대 수준을 보여주는
 * 얇은 미니 바를 얹어 무거운 차트 없이도 데이터가 "읽히게" 한다.
 *
 * ratio: 0~1로 정규화한 상대 수준(예: 정답률/100, 연속일/30). null이면 바를 숨긴다
 * (데이터 없음 '—'). suffix는 값 뒤 단위(%, 시간)로 CountUp 애니메이션과 분리해 붙인다.
 */
export default function StatTile({
  icon,
  value,
  suffix,
  label,
  ratio,
}: {
  icon: string;
  value: number | string | null;
  suffix?: string;
  label: string;
  ratio?: number | null;
}) {
  const has = value != null && value !== '—';
  const pct = ratio == null ? 0 : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="stt">
      <span className="stt-chip">
        <i className={icon} />
      </span>
      <div className="stt-num">
        {has ? <CountUp value={value as number | string} /> : '—'}
        {has && suffix ? <span className="stt-suffix">{suffix}</span> : null}
      </div>
      <span className="stt-label">{label}</span>
      <div className="stt-bar" aria-hidden="true">
        <span className="stt-bar-fill" style={{ width: has ? `${pct}%` : '0%' }} />
      </div>
    </div>
  );
}
