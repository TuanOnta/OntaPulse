import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  MemberAvatar,
  WorkspaceRoleBadge,
  canChangeRole,
  canManageWorkspace,
  canRemoveMember,
  type MembersError,
} from "@/entities/workspace";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { prefersReducedMotion } from "@/shared/lib/reduced-motion";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types/domain";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { LockIcon } from "@/shared/ui/lock-icon";
import { ActionButton, PlusIcon, SMALL_PILL } from "@/shared/ui/pill-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export const EMAIL_MAX = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAVE_MS = 380;
const FLASH_MS = 1600;
const ROW_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_170px_150px] items-center gap-4 px-5 max-[959px]:grid-cols-[minmax(0,1fr)_auto] max-[959px]:gap-y-3";

const ROLE_LABEL: Record<"ADMIN" | "MEMBER", string> = { ADMIN: "Admin", MEMBER: "Member" };

export type MembersPaneProps = {
  workspaceId: string;
  role?: WorkspaceRole;
  currentUserId?: string;
  status: "loading" | "ready" | "error";
  members: WorkspaceMember[];
  error: MembersError | null;
  onReload: () => void;
  onAdded: (member: WorkspaceMember) => void;
  onChanged: (member: WorkspaceMember) => void;
  onRemoved: (id: string) => void;
  /** Bumped by the hero "Add member" button; every new non-zero value focuses the email field. */
  focusEmailToken?: number;
};

export function validateEmail(value: string, existing: string[]): string | null {
  if (!value) return "Enter an email address.";
  if (value.length > EMAIL_MAX || !EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
  if (existing.includes(value)) return "This person is already a member.";
  return null;
}

function ViewOnlyNote({ children }: { children: string }) {
  return (
    <div className="mb-[18px] flex items-center gap-2.5 rounded-[14px] border border-landing-border bg-landing-bg/50 px-3.5 py-2.5 text-[15px] text-landing-muted">
      <LockIcon />
      {children}
    </div>
  );
}

/** Members tab: add by email, list with role select and remove, remove confirmation dialog. */
export function MembersPane({
  workspaceId,
  role,
  currentUserId,
  status,
  members,
  error,
  onReload,
  onAdded,
  onChanged,
  onRemoved,
  focusEmailToken = 0,
}: MembersPaneProps) {
  const manage = canManageWorkspace(role);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<WorkspaceMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (focusEmailToken > 0) emailRef.current?.focus();
  }, [focusEmailToken]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  function later(action: () => void, ms: number) {
    timers.current.push(window.setTimeout(action, ms));
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    const problem = validateEmail(
      value,
      members.map((member) => member.email.toLowerCase()),
    );
    setEmailError(problem);
    if (problem) {
      emailRef.current?.focus();
      return;
    }
    setAdding(true);
    try {
      const member = await api.addWorkspaceMember(workspaceId, value);
      onAdded(member);
      setEmail("");
      setFlashId(member.id);
      later(() => setFlashId(null), FLASH_MS);
      toast.success(`${member.name} was added as a member.`);
    } catch (failure) {
      setEmailError(getErrorMessage(failure));
      emailRef.current?.focus();
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: WorkspaceMember, next: "ADMIN" | "MEMBER") {
    try {
      const updated = await api.updateWorkspaceMemberRole(workspaceId, member.id, next);
      onChanged(updated);
      toast.success(`${updated.name} is now ${ROLE_LABEL[next]}.`);
    } catch (failure) {
      toast.error(getErrorMessage(failure));
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const target = pendingRemove;
    setRemoving(true);
    try {
      await api.removeWorkspaceMember(workspaceId, target.id);
      setPendingRemove(null);
      setLeavingId(target.id);
      later(
        () => {
          onRemoved(target.id);
          setLeavingId(null);
        },
        prefersReducedMotion() ? 0 : LEAVE_MS,
      );
      toast.success(`${target.name} was removed.`);
    } catch (failure) {
      toast.error(getErrorMessage(failure));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <div className="mb-[18px]">
        <h2 className="font-display text-[22px] font-bold tracking-[-.01em]">Members</h2>
        <p className="mt-0.5 text-[15px] text-landing-muted">
          New members join as <strong className="font-semibold text-landing-text-2">Member</strong>.
          Only the owner can change roles.
        </p>
      </div>

      {manage ? (
        <form
          className="mb-[18px] flex flex-wrap items-start gap-3 rounded-[18px] border border-landing-border bg-landing-surface/60 p-4 "
          noValidate
          onSubmit={addMember}
        >
          <div className="min-w-0 flex-[1_1_280px]">
            <label
              className="mb-1.5 block text-[14px] font-medium text-landing-text-2"
              htmlFor="member-email"
            >
              Add a registered user
            </label>
            <input
              aria-describedby="member-email-error"
              aria-invalid={emailError ? true : undefined}
              autoComplete="off"
              className="min-h-12 w-full rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none aria-[invalid=true]:border-landing-danger aria-[invalid=true]:shadow-[0_0_0_4px_rgb(255_122_107/0.12)]"
              id="member-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              ref={emailRef}
              spellCheck={false}
              type="email"
              value={email}
            />
            <p
              className="mt-1.5 min-h-5 text-[14px] text-landing-danger-text"
              id="member-email-error"
              role="alert"
            >
              {emailError}
            </p>
          </div>
          <ActionButton
            className="mt-[26px] max-[520px]:mt-0 max-[520px]:w-full"
            disabled={adding}
            type="submit"
          >
            <PlusIcon />
            {adding ? "Adding..." : "Add member"}
          </ActionButton>
        </form>
      ) : (
        <ViewOnlyNote>Only owners and admins can add or remove members.</ViewOnlyNote>
      )}

      {status === "loading" ? (
        <div
          aria-busy="true"
          aria-label="Loading members"
          className="h-40 animate-pulse rounded-[22px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
          role="status"
        />
      ) : status === "error" ? (
        <div
          className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[rgb(255_122_107/0.45)] bg-landing-danger/[.07] px-[18px] py-4 text-landing-danger-text"
          role="alert"
        >
          <div className="min-w-0">
            <strong className="block text-[17px] font-semibold">Couldn’t load members.</strong>
            <small className="block font-mono text-[13px] leading-[normal] text-landing-muted">
              {error?.message}
              {error?.requestId ? ` Request ID: ${error.requestId}` : ""}
            </small>
          </div>
          <ActionButton className={`ml-auto ${SMALL_PILL}`} onClick={onReload} variant="ghost">
            Try again
          </ActionButton>
        </div>
      ) : (
        <div
          aria-label="Workspace members"
          className="overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/[.72]"
          role="table"
        >
          <div
            className={`${ROW_COLUMNS} bg-landing-bg/50 py-3 font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase max-[959px]:hidden`}
            role="row"
          >
            <span role="columnheader">Member</span>
            <span role="columnheader">Role</span>
            <span className="text-right" role="columnheader">
              Actions
            </span>
          </div>
          <div role="rowgroup">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              const changeable = canChangeRole(role, member, isSelf);
              const removable = canRemoveMember(role, member, isSelf);
              return (
                <div
                  className={`${ROW_COLUMNS} border-t border-landing-border py-3.5 first:border-t-0 hover:bg-landing-text/[.025] ${
                    leavingId === member.id
                      ? "animate-ws-leave motion-reduce:animate-none"
                      : flashId === member.id
                        ? "animate-ws-flash motion-reduce:animate-none"
                        : ""
                  }`}
                  key={member.id}
                  role="row"
                >
                  <div className="flex min-w-0 items-center gap-3.5" role="cell">
                    <MemberAvatar name={member.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                        {member.name}
                        {isSelf ? (
                          <span className="rounded-full bg-landing-surface-2 px-2 py-0.5 font-mono text-[11px] leading-[normal] font-medium tracking-[.06em] text-landing-text-2 uppercase">
                            You
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-[13px] leading-[normal] text-landing-muted">
                        {member.email}
                      </div>
                    </div>
                  </div>
                  <div role="cell">
                    {changeable ? (
                      <Select
                        onValueChange={(value) =>
                          void changeRole(member, value as "ADMIN" | "MEMBER")
                        }
                        value={member.role}
                      >
                        <SelectTrigger
                          aria-label={`Role for ${member.name}`}
                          className="w-full rounded-[12px] data-[size=default]:h-11 border-landing-border-strong bg-landing-bg/80 px-3.5 text-[15px] font-medium text-landing-text"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">{ROLE_LABEL.ADMIN}</SelectItem>
                          <SelectItem value="MEMBER">{ROLE_LABEL.MEMBER}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <WorkspaceRoleBadge role={member.role} />
                    )}
                  </div>
                  <div
                    className="flex items-center justify-end gap-2 max-[959px]:col-start-2 max-[959px]:row-span-2 max-[959px]:row-start-1"
                    role="cell"
                  >
                    {removable ? (
                      <ActionButton
                        aria-label={`Remove ${member.name}`}
                        className={SMALL_PILL}
                        onClick={() => setPendingRemove(member)}
                        variant="danger"
                      >
                        Remove
                      </ActionButton>
                    ) : member.role === "OWNER" ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-landing-muted">
                        <LockIcon />
                        Fixed
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => !open && setPendingRemove(null)}
        open={pendingRemove !== null}
      >
        <DialogContent
          className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px]"
          showCloseButton={false}
        >
          <div className="flex flex-col gap-[18px] p-[26px]">
            <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
              Remove member?
            </DialogTitle>
            <DialogDescription className="-mt-2.5 text-[16px] text-landing-muted">
              {pendingRemove?.name} will lose access to this workspace and its projects immediately.
            </DialogDescription>
            <div className="mt-1 flex flex-wrap justify-end gap-2.5">
              <ActionButton onClick={() => setPendingRemove(null)} variant="ghost">
                Cancel
              </ActionButton>
              <ActionButton
                disabled={removing}
                onClick={() => void confirmRemove()}
                variant="danger"
              >
                Remove member
              </ActionButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
