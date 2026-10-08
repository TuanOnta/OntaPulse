import { DropdownMenu } from "radix-ui";

import { overviewButtonClass } from "@/shared/ui/pill-button";
import { cn } from "cn";

const DotsIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 22 22" width="22">
    <circle cx="5" cy="11" r="1.7" />
    <circle cx="11" cy="11" r="1.7" />
    <circle cx="17" cy="11" r="1.7" />
  </svg>
);
const PenIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 20 20" width="18">
    <path
      d="M3 17 L3.8 13.2 L13.6 3.4 a1.6 1.6 0 0 1 2.3 0 l.7.7 a1.6 1.6 0 0 1 0 2.3 L6.8 16.2 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);
const BinIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 20 20" width="18">
    <path
      d="M3.5 5.5 H16.5 M8 5.5 V3.6 H12 V5.5 M5 5.5 L5.8 16.4 H14.2 L15 5.5 M8.4 9 V13 M11.6 9 V13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const ITEM =
  "flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-[11px] px-3 text-left text-[15px] font-medium text-landing-text outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-landing-text/[.07] [&>svg]:flex-none [&>svg]:text-landing-muted";

/**
 * "..." button with a Rename and a Delete item. The page owns the dialogs; this only reports the choice.
 * Delete stays visible but disabled, with the reason, when the role cannot delete.
 */
export function ManageMenu({
  kind,
  onRename,
  onDelete,
  canDelete,
  deleteDisabledReason,
}: {
  /** "workspace" or "project", used in labels. */
  kind: string;
  onRename: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleteDisabledReason: string;
}) {
  const title = kind.charAt(0).toUpperCase() + kind.slice(1);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`${title} settings`}
          className={overviewButtonClass("ghost", "w-12 flex-none px-0")}
          type="button"
        >
          <DotsIcon />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[60] min-w-[232px] animate-dash-drop rounded-2xl border border-landing-border-strong bg-landing-surface-2 p-1.5 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.85)] motion-reduce:animate-none"
          sideOffset={8}
        >
          <DropdownMenu.Item className={ITEM} onSelect={onRename}>
            <PenIcon />
            Rename {kind}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="mx-1 my-1.5 h-px bg-landing-border" />
          <DropdownMenu.Item
            aria-describedby={canDelete ? undefined : "manage-menu-why"}
            className={cn(ITEM, "text-landing-danger-text [&>svg]:text-landing-danger-text")}
            disabled={!canDelete}
            onSelect={onDelete}
          >
            <BinIcon />
            Delete {kind}
          </DropdownMenu.Item>
          {canDelete ? null : (
            <p
              className="px-3 pt-1 pb-2 pl-[46px] text-[13px] leading-[1.35] text-landing-muted"
              id="manage-menu-why"
            >
              {deleteDisabledReason}
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
