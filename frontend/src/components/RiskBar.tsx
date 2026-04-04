import { Shield } from "lucide-react";

interface RiskBarProps {
  score: number; // 0-10
  showLabel?: boolean;
}

export default function RiskBar({ score, showLabel = true }: RiskBarProps) {
  const pct = Math.min(score * 10, 100);
  const color =
    score <= 3 ? "bg-accent-green" : score <= 6 ? "bg-accent-amber" : "bg-accent-red";
  const textColor =
    score <= 3 ? "text-accent-green" : score <= 6 ? "text-accent-amber" : "text-accent-red";
  const label = score <= 3 ? "Low" : score <= 6 ? "Medium" : "High";

  return (
    <div className="flex items-center gap-3">
      {showLabel && (
        <div className="flex items-center gap-1.5">
          <Shield className={`w-3.5 h-3.5 ${textColor}`} />
          <span className={`text-xs font-medium ${textColor}`}>{label}</span>
        </div>
      )}
      <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${textColor}`}>{score}/10</span>
    </div>
  );
}
