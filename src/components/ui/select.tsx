import { useId } from "react";

export interface SelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  hint?: string;
}

export function Select({
  value,
  onChange,
  children,
  disabled,
  className = "",
  id,
  hint,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div className="space-y-1">
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={hintId}
        className={`w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-50 ${className}`}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}
