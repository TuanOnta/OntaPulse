const TRACE_PATH = "M0 18 H120 L134 18 L144 5 L156 31 L168 12 L178 18 H400";
const STROKE =
  "fill-none stroke-landing-accent [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6] [vector-effect:non-scaling-stroke]";

/** Heartbeat line at the top of the panel with a bright beam running along it. */
export function HeartbeatTrace() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none -mx-1.5 -mt-1.5 -mb-2 h-9 [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]"
    >
      <svg
        className="block size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 400 36"
      >
        <path className={`${STROKE} opacity-[.16]`} d={TRACE_PATH} pathLength={1} />
        <path
          className={`${STROKE} animate-auth-beam [filter:drop-shadow(0_0_5px_rgb(94_242_160/0.9))] [stroke-dasharray:.26_1] [stroke-dashoffset:.26] motion-reduce:hidden`}
          d={TRACE_PATH}
          pathLength={1}
        />
      </svg>
    </div>
  );
}
