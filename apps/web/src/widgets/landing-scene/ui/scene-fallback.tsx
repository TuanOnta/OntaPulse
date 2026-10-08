import { cn } from "cn";

/**
 * Static stand-in for the 3D orb (ported from #scene-fallback). It shows first, cross-fades out
 * when the first WebGL frame is drawn, and stays when WebGL is unavailable or the context is lost.
 */
export function SceneFallback({ ready }: { ready: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 flex items-center justify-end pr-[4vw] transition-opacity duration-[800ms] ease-in-out motion-reduce:transition-none",
        "max-[959px]:justify-center max-[959px]:pr-0",
        ready ? "opacity-0" : "opacity-100 max-[959px]:opacity-35",
      )}
      data-testid="scene-fallback"
    >
      <svg
        className="h-auto w-[min(640px,52vw)] max-[959px]:w-[min(520px,90vw)]"
        fill="none"
        viewBox="0 0 600 600"
      >
        <circle
          className="stroke-landing-accent"
          cx="300"
          cy="300"
          r="262"
          strokeOpacity=".10"
          strokeWidth="10"
        />
        <circle
          className="stroke-landing-accent"
          cx="300"
          cy="300"
          r="250"
          strokeOpacity=".38"
          strokeWidth="1.5"
        />
        <g className="stroke-landing-accent" strokeOpacity=".15" strokeWidth="1">
          <ellipse cx="300" cy="300" rx="250" ry="70" />
          <ellipse cx="300" cy="300" rx="250" ry="150" />
          <ellipse cx="300" cy="300" rx="250" ry="215" />
          <ellipse cx="300" cy="300" rx="70" ry="250" />
          <ellipse cx="300" cy="300" rx="150" ry="250" />
          <ellipse cx="300" cy="300" rx="215" ry="250" />
          <line x1="50" y1="300" x2="550" y2="300" />
          <line x1="300" y1="50" x2="300" y2="550" />
        </g>
        <circle
          className="stroke-landing-accent"
          cx="350"
          cy="250"
          r="120"
          strokeOpacity=".45"
          strokeWidth="2"
        />
        <circle
          className="stroke-landing-accent"
          cx="350"
          cy="250"
          r="190"
          strokeOpacity=".2"
          strokeWidth="1.5"
        />
        <g className="stroke-landing-accent" strokeOpacity=".5" strokeWidth="1.5">
          <path d="M350 250 Q 450 200 440 330" />
          <path d="M350 250 Q 270 170 250 190" />
          <path d="M350 250 Q 440 150 430 175" />
          <path d="M350 250 Q 220 270 190 350" />
          <path d="M350 250 Q 360 360 330 420" />
        </g>
        <circle className="fill-landing-accent" cx="350" cy="250" r="22" fillOpacity=".2" />
        <circle className="fill-landing-accent" cx="350" cy="250" r="8" />
        <circle className="fill-landing-warn" cx="440" cy="330" r="7" />
        <circle className="fill-landing-accent" cx="250" cy="190" r="6" />
        <circle className="fill-landing-accent" cx="430" cy="175" r="6" />
        <circle className="fill-landing-danger" cx="190" cy="350" r="7" />
        <circle className="fill-landing-accent" cx="330" cy="420" r="6" />
      </svg>
    </div>
  );
}
