import { cn } from "cn";
import { Link } from "react-router-dom";

/** OntaPulse mark and name; links to the dashboard. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 px-2 font-display text-[22px] font-bold text-landing-text hover:text-landing-text",
        className,
      )}
      to="/dashboard"
    >
      <svg aria-hidden="true" height={size} viewBox="0 0 30 30" width={size}>
        <circle
          className="stroke-landing-accent"
          cx="15"
          cy="15"
          fill="none"
          r="13"
          strokeOpacity=".5"
          strokeWidth="1.5"
        />
        <path
          className="stroke-landing-accent"
          d="M3 16 H10 L13 8 L17 23 L20 16 H27"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      OntaPulse
    </Link>
  );
}
