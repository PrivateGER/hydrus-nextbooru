import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

type InfoBoxVariant = "info" | "tip" | "warning" | "error" | "success" | "note" | "security";

interface InfoBoxProps {
  children: React.ReactNode;
  variant?: InfoBoxVariant;
  className?: string;
  title?: string;
}

const variantConfig: Record<
  InfoBoxVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    containerClass: string;
    iconClass: string;
    textClass: string;
    titleClass: string;
  }
> = {
  info: {
    icon: InformationCircleIcon,
    containerClass: "bg-blue-500/10 border-blue-500/20",
    iconClass: "text-blue-400",
    textClass: "text-blue-200",
    titleClass: "text-blue-300",
  },
  tip: {
    icon: SparklesIcon,
    containerClass: "bg-amber-500/10 border-amber-500/20",
    iconClass: "text-amber-400",
    textClass: "text-amber-200",
    titleClass: "text-amber-300",
  },
  warning: {
    icon: ExclamationTriangleIcon,
    containerClass: "bg-orange-500/10 border-orange-500/20",
    iconClass: "text-orange-400",
    textClass: "text-orange-200",
    titleClass: "text-orange-300",
  },
  error: {
    icon: ExclamationCircleIcon,
    containerClass: "bg-red-500/10 border-red-500/20",
    iconClass: "text-red-400",
    textClass: "text-red-200",
    titleClass: "text-red-300",
  },
  success: {
    icon: CheckCircleIcon,
    containerClass: "bg-emerald-500/10 border-emerald-500/20",
    iconClass: "text-emerald-400",
    textClass: "text-emerald-200",
    titleClass: "text-emerald-300",
  },
  note: {
    icon: LightBulbIcon,
    containerClass: "bg-purple-500/10 border-purple-500/20",
    iconClass: "text-purple-400",
    textClass: "text-purple-200",
    titleClass: "text-purple-300",
  },
  security: {
    icon: ShieldExclamationIcon,
    containerClass: "bg-rose-500/10 border-rose-500/20",
    iconClass: "text-rose-400",
    textClass: "text-rose-200",
    titleClass: "text-rose-300",
  },
};

export function InfoBox({ children, variant = "info", className = "", title }: InfoBoxProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${config.containerClass} ${className}`}>
      <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconClass}`} />
      <div className="min-w-0 flex-1">
        {title && <p className={`mb-1 text-sm font-medium ${config.titleClass}`}>{title}</p>}
        <div className={`text-sm ${config.textClass}`}>{children}</div>
      </div>
    </div>
  );
}
