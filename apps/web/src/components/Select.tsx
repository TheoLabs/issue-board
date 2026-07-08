import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 커스텀 드롭다운. 네이티브 <select>와 달리 메뉴가 **항상 트리거 바로 아래**로
 * 절대배치된다(top:100%). 바깥 클릭·Escape로 닫힌다.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  minWidth,
  triggerClassName,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** 트리거 최소 너비(px). 값에 따라 폭이 흔들리는 걸 막는다 */
  minWidth?: number;
  /** 트리거에 덧붙일 클래스 (상태 색 tint 등) */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    // 부모 행(예: 테이블 행)의 클릭 핸들러로 이벤트가 새는 것을 막는다.
    <div
      className="dropdown"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`dropdown-trigger${open ? ' open' : ''}${
          triggerClassName ? ` ${triggerClassName}` : ''
        }`}
        style={minWidth ? { minWidth } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dropdown-value">{current?.label ?? ''}</span>
        <span className="dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dropdown-item${o.value === value ? ' selected' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
