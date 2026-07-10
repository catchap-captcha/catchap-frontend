import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import './PasswordInput.css';

/**
 * 비밀번호 입력칸 — 오른쪽 눈 버튼을 "누르고 있는 동안만" 평문으로 보여준다(실서비스식).
 * 기존 폼의 uncontrolled(ref/data-req)·controlled(value/onChange) 입력 모두 그대로 쓰도록
 * 모든 props를 안쪽 <input>에 전달하고 ref를 forward한다. type은 이 컴포넌트가 관리한다.
 */
const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ style, ...rest }, ref) {
    const [reveal, setReveal] = useState(false);
    const show = () => setReveal(true);
    const hide = () => setReveal(false);
    return (
      <span className="pw-wrap">
        <input
          {...rest}
          ref={ref}
          type={reveal ? 'text' : 'password'}
          style={{ paddingRight: 42, ...style }}
        />
        <button
          type="button"
          className="pw-eye"
          tabIndex={-1}
          aria-label="비밀번호 보기 (누르고 있는 동안만)"
          // pointer 이벤트 + 포인터 캡처 — 마우스/터치 통합, 버튼 밖에서 떼도 pointerup이
          // 이 버튼으로 전달돼 항상 다시 가려진다(누르는 동안만 노출).
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* 캡처 미지원 브라우저는 blur/leave 폴백 */
            }
            show();
          }}
          onPointerUp={hide}
          onPointerCancel={hide}
          onMouseLeave={hide}
          onBlur={hide}
          onContextMenu={(e) => e.preventDefault()}
        >
          <i className={reveal ? 'ph-fill ph-eye' : 'ph-fill ph-eye-slash'} aria-hidden />
        </button>
      </span>
    );
  },
);

export default PasswordInput;
