const SKELETON_CARDS = [0, 1, 2, 3] as const;

const BAR = "block rounded-lg bg-landing-surface-2";

/** Loading placeholder: four card-shaped blocks with a moving sheen. */
export function WorkspaceGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspaces"
      className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 max-[520px]:grid-cols-[minmax(0,1fr)]"
      role="status"
    >
      {SKELETON_CARDS.map((key) => (
        <div
          className="relative flex min-h-[176px] flex-col gap-3.5 overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/60 p-[22px] after:absolute after:inset-0 after:animate-dash-sheen after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_30%,rgb(232_241_236/0.05)_50%,transparent_70%)] after:content-[''] motion-reduce:after:animate-none"
          key={key}
        >
          <i className={`${BAR} size-[46px] rounded-[14px]`} />
          <i className={`${BAR} mt-2 h-5 w-[62%]`} />
          <i className={`${BAR} h-3.5 w-[38%]`} />
        </div>
      ))}
    </div>
  );
}
