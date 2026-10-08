/** Decorative layer: faint grid fading from the top right plus a slowly drifting blue glow. */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 [background-image:linear-gradient(rgb(232_241_236/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(232_241_236/0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_70%_0%,#000_0%,transparent_75%)]" />
      <div className="absolute -top-[460px] -right-[200px] size-[900px] animate-dash-drift bg-[radial-gradient(circle,rgb(124_196_255/0.07),transparent_62%)] motion-reduce:animate-none" />
    </div>
  );
}
