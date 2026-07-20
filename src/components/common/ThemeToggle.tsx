import { useTheme } from '../../hooks/useTheme';
import './ThemeToggle.css';

/**
 * 라이트/다크 전환 버튼 — 상단바에 고정으로 놓는다.
 * 해(라이트)·달(다크) 아이콘으로 현재 상태 대비 '바꿀 방향'을 보여준다.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={dark ? '라이트 모드' : '다크 모드'}
    >
      <i className={dark ? 'ph-bold ph-sun' : 'ph-bold ph-moon'} aria-hidden="true" />
    </button>
  );
}
