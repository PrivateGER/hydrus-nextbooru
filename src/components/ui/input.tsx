import { useId } from "react";

export interface InputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  hint?: string;
}

export function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
  id,
  hint,
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1">
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hintId}
        className={`w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500 disabled:opacity-50 ${className}`}
      />
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}
