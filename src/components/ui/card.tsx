export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-800/50 p-5 ${className}`}>
      {children}
    </div>
  );
}
