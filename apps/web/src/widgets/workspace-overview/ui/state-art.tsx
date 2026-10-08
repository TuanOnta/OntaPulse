/** Small orbit-and-pulse illustration for the empty and no-results panels. */
export function StateArt() {
  return (
    <svg aria-hidden="true" className="mb-1.5 size-[120px]" fill="none" viewBox="0 0 120 120">
      <circle className="stroke-landing-border-strong" cx="60" cy="60" r="44" strokeWidth="1.5" />
      <g className="origin-[60px_60px] animate-dash-orbit motion-reduce:animate-none">
        <circle
          className="stroke-landing-accent"
          cx="60"
          cy="60"
          r="52"
          strokeDasharray="3 9"
          strokeOpacity=".5"
          strokeWidth="1.5"
        />
        <circle className="fill-landing-accent" cx="60" cy="8" r="3.5" />
      </g>
      <path
        className="animate-dash-pulse-line stroke-landing-accent [stroke-dasharray:140] [stroke-dashoffset:140] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
        d="M20 62 H46 L54 40 L66 80 L74 62 H100"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
