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
        className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 ${className}`}
      />
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
    </div>
  );
}
