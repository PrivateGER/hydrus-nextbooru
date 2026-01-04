"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Tooltip } from "./tooltip";

export interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  tooltip?: string;
  type?: "button" | "submit" | "reset";
}

export function Button({
  onClick,
  disabled,
  variant = "primary",
  loading,
  children,
  className = "",
  tooltip,
  type = "button",
}: ButtonProps) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500",
    secondary: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };

  const button = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );

  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}
