import { Badge } from "@/shared/ui/badge";
import type { ScanStatus } from "@/shared/types/domain";

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const config = {
    QUEUED: ["Queued", "bg-slate-400/15 text-slate-300"],
    RUNNING: ["Running", "bg-cyan-400/15 text-cyan-200"],
    SUCCEEDED: ["Healthy", "bg-signal/15 text-signal"],
    FAILED: ["Failed", "bg-danger/15 text-danger"],
  } as const;
  const [label, className] = config[status];

  return (
    <Badge variant="secondary" className={`border-0 ${className}`}>
      {(status === "RUNNING" || status === "QUEUED") && (
        <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
      )}
      {label}
    </Badge>
  );
}
