import { UserMinus, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types/domain";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";

const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function WorkspaceMembers({
  workspaceId,
  role,
}: {
  workspaceId: string;
  role?: WorkspaceRole;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);
  const [removingPending, setRemovingPending] = useState(false);
  const canManageMembers = role === "OWNER" || role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await api.workspaceMembers(workspaceId));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const member = await api.addWorkspaceMember(workspaceId, email);
      setMembers((current) => [...current, member]);
      setEmail("");
      toast.success(`${member.name} added to the workspace`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRole(member: WorkspaceMember, nextRole: "ADMIN" | "MEMBER") {
    try {
      const updated = await api.updateWorkspaceMemberRole(workspaceId, member.id, nextRole);
      setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`${updated.name} is now ${roleLabels[updated.role].toLowerCase()}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function removeMember() {
    if (!removing) return;
    setRemovingPending(true);
    try {
      await api.removeWorkspaceMember(workspaceId, removing.id);
      setMembers((current) => current.filter((member) => member.id !== removing.id));
      toast.success(`${removing.name} removed from the workspace`);
      setRemoving(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingPending(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-slate-700/70 bg-surface p-5"
      aria-labelledby="members-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">ACCESS</p>
          <h2 id="members-title" className="mt-1 font-semibold">
            Workspace members
          </h2>
          <p className="mt-1 text-sm text-muted">Manage who can access this workspace.</p>
        </div>
        {!loading && <span className="text-sm text-muted">{members.length} members</span>}
      </div>

      {canManageMembers && (
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={addMember}>
          <Label className="sr-only" htmlFor="member-email">
            Member email
          </Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
          <Button type="submit" disabled={submitting}>
            <UserPlus />
            Add member
          </Button>
        </form>
      )}

      <div className="mt-5 divide-y divide-slate-700/70">
        {loading ? (
          <Skeleton className="h-28" />
        ) : (
          members.map((member) => {
            const owner = member.role === "OWNER";
            const canEditRole = role === "OWNER" && !owner;
            const canRemove =
              !owner && (role === "OWNER" || (role === "ADMIN" && member.role === "MEMBER"));
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={member.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canEditRole ? (
                    <Select
                      value={member.role}
                      onValueChange={(value: "ADMIN" | "MEMBER") => void updateRole(member, value)}
                    >
                      <SelectTrigger size="sm" aria-label={`Role for ${member.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted">
                      {roleLabels[member.role]}
                    </span>
                  )}
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setRemoving(member)}
                    >
                      <UserMinus />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              They will immediately lose access to this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removeMember()}
              disabled={removingPending}
            >
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
