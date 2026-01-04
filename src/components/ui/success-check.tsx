import { CheckCircleIcon } from "@heroicons/react/24/solid";

export interface SuccessCheckProps {
  show: boolean;
}

export function SuccessCheck({ show }: SuccessCheckProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-in zoom-in-50 fade-in duration-300">
        <div className="rounded-full bg-emerald-500/20 p-6">
          <CheckCircleIcon className="h-16 w-16 text-emerald-400" />
        </div>
      </div>
    </div>
  );
}
