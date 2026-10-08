import type { WorkspacesError } from "@/entities/workspace";

import { ActionButton, ButtonLink, PlusIcon } from "./buttons";
import { riseStyle } from "./rise";
import { StateArt } from "./state-art";

const PANEL =
  "flex flex-col items-center gap-3 rounded-[26px] border border-dashed border-landing-border-strong bg-landing-surface/50 px-6 py-16 text-center";
const PANEL_TITLE = "font-display text-[28px] font-bold tracking-[-.01em]";
const PANEL_TEXT = "max-w-[46ch] text-landing-muted";

/** First-run state: the user has no workspaces. */
export function OverviewEmpty() {
  return (
    <div className={`${PANEL} animate-dash-rise motion-reduce:animate-none`} style={riseStyle(3)}>
      <StateArt />
      <h2 className={PANEL_TITLE}>Create your first workspace</h2>
      <p className={PANEL_TEXT}>
        A workspace holds your projects, monitors and teammates. Add a target and OntaPulse starts
        checking it.
      </p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/workspaces/new">
          <PlusIcon size={22} stroke={1.8} />
          Create workspace
        </ButtonLink>
      </div>
    </div>
  );
}

/** A filter or search matched nothing. */
export function OverviewNoResults({ term, onClear }: { term: string; onClear: () => void }) {
  return (
    <div className={PANEL}>
      <StateArt />
      <h2 className={PANEL_TITLE}>No matching workspaces</h2>
      <p className={PANEL_TEXT}>
        Nothing matches “{term}”. Try another search or clear the filter.
      </p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-3">
        <ActionButton onClick={onClear} variant="ghost">
          Clear filters
        </ActionButton>
      </div>
    </div>
  );
}

/** The list request failed: banner with the API message, the request id and a retry button. */
export function OverviewError({ error, onRetry }: { error: WorkspacesError; onRetry: () => void }) {
  return (
    <div
      className="flex animate-dash-drop items-start gap-3.5 rounded-2xl border border-[rgb(255_122_107/0.45)] bg-landing-danger/[.07] px-[18px] py-4 text-landing-danger-text motion-reduce:animate-none max-[520px]:flex-wrap"
      role="alert"
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 flex-none"
        fill="none"
        height="22"
        viewBox="0 0 20 20"
        width="22"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6 V11 M10 13.6 V14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
      <div>
        <strong className="block text-[17px] font-semibold">Couldn’t load your workspaces.</strong>
        <small className="mt-0.5 block font-mono text-[13px] leading-[normal] text-landing-muted">
          {error.message}
        </small>
        {error.requestId ? (
          <small className="block font-mono text-[13px] leading-[normal] text-landing-muted">
            Request ID: {error.requestId}
          </small>
        ) : null}
      </div>
      <ActionButton
        className="ml-auto min-h-10 px-[18px] text-[15px] max-[520px]:mx-0 max-[520px]:w-full"
        onClick={onRetry}
        variant="ghost"
      >
        Try again
      </ActionButton>
    </div>
  );
}
