"use client";

import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Message } from "@/types/admin";

export interface MessageToastProps {
  message: Message | null;
  onDismiss: () => void;
}

export function MessageToast({ message, onDismiss }: MessageToastProps) {
  if (!message) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-4 animate-in slide-in-from-top-2 ${
        message.type === "success"
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {message.type === "success" ? (
        <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
      ) : (
        <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
      )}
      <p className="flex-1 text-sm">{message.text}</p>
      <button onClick={onDismiss} className="rounded p-1 hover:bg-white/10">
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
