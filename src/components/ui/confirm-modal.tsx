"use client";

import { useEffect, useId, useRef } from "react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary";
}

/**
 * Accessible confirmation dialog built on the native <dialog> element.
 *
 * Using `showModal()` gives us focus trapping, Escape-to-close, an inert
 * background, and automatic focus restoration to the trigger element for free.
 * The component stays controlled via `isOpen`; an effect keeps the native
 * dialog's open state in sync. All close paths (Cancel button, backdrop click,
 * Escape) funnel through the dialog's `close` event, which invokes `onClose`
 * exactly once so the parent's state can't drift out of sync.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  confirmVariant = "danger",
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  // Sync the native dialog's open state with the controlled `isOpen` prop.
  // Guarded by `dialog.open` so we never call showModal() on an already-open
  // dialog (which throws) or close() redundantly.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // The native `close` event fires for every close path (Escape, backdrop,
  // Cancel button, programmatic close). Routing onClose through it guarantees
  // the parent's `isOpen` is set back to false even on user-initiated dismissal.
  const handleClose = () => {
    // Only notify the parent if it still thinks the dialog is open, so a
    // parent-driven close (isOpen -> false) doesn't trigger a redundant call.
    if (isOpen) onClose();
  };

  // A click whose target is the dialog element itself (not its content) is a
  // backdrop click. `showModal()` does not close on backdrop click by default.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleClick}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="m-auto w-full max-w-md rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95 open:duration-200"
    >
      <h3 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p id={messageId} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            dialogRef.current?.close();
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
            confirmVariant === "danger"
              ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500"
              : "bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-500"
          }`}
        >
          {confirmText}
        </button>
      </div>
    </dialog>
  );
}
