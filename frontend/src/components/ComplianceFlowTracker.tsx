import { CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";

export type FlowStep = {
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

interface ComplianceFlowTrackerProps {
  steps: FlowStep[];
  className?: string;
}

export default function ComplianceFlowTracker({ steps, className = "" }: ComplianceFlowTrackerProps) {
  if (steps.length === 0) return null;

  return (
    <div className={`p-4 rounded-xl border border-surface-600 bg-surface-800/50 space-y-3 ${className}`}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="mt-0.5">
            {step.status === "done" && <CheckCircle2 className="w-4 h-4 text-accent-green" />}
            {step.status === "active" && <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />}
            {step.status === "error" && <XCircle className="w-4 h-4 text-accent-red" />}
            {step.status === "pending" && <Circle className="w-4 h-4 text-gray-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm ${
              step.status === "done" ? "text-accent-green" :
              step.status === "active" ? "text-accent-blue" :
              step.status === "error" ? "text-accent-red" :
              "text-gray-500"
            }`}>
              {step.label}
            </div>
            {step.detail && (
              <div className="text-xs text-gray-500 font-mono truncate mt-0.5">{step.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
