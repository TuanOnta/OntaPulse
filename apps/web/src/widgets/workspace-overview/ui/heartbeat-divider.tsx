import { riseStyle } from "./rise";

const PATH = "M0 11 H430 L446 11 L458 3 L474 19 L488 11 H1000";

/** Thin heartbeat line under the page head, with a light beam travelling along it. */
export function HeartbeatDivider() {
  return (
    <div
      aria-hidden="true"
      className="relative mt-7 mb-6 h-[22px] animate-dash-rise motion-reduce:animate-none"
      style={riseStyle(1)}
    >
      <svg
        className="block h-[22px] w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 1000 22"
      >
        <path
          className="fill-none stroke-landing-border-strong [stroke-width:1.2] [vector-effect:non-scaling-stroke]"
          d={PATH}
        />
        <path
          className="animate-dash-travel fill-none stroke-landing-text-2 [filter:drop-shadow(0_0_3px_rgb(232_241_236/0.5))] [stroke-dasharray:90_1200] [stroke-dashoffset:90] [stroke-linecap:round] [stroke-width:1.6] [vector-effect:non-scaling-stroke] motion-reduce:hidden"
          d={PATH}
        />
      </svg>
    </div>
  );
}
