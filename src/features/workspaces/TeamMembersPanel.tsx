import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Mail, UserMinus, Send, XCircle, UserRound, Users, Crown, MoreHorizontal, UserPlus, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/react";
import { useDraftGuard } from "../../components/NavigationExperience";
import { useAction, useFeedback } from "../../components/Feedback";
import "./members.css";
import { roleLabels } from "../../lib/uiText";

type Role = "admin" | "member" | "viewer";

export function MyInvitations() {
  const invitations = useQuery(api.invitations.mine);
  const accept = useMutation(api.invitations.accept);
  const decline = useMutation(api.invitations.decline);
  const { run, pending } = useAction();
  async function act(id: Id<"workspaceInvitations">, kind: "accept" | "decline") {
    await run(() => kind === "accept" ? accept({ invitationId: id }) : decline({ invitationId: id }), kind === "accept" ? "Invitation accepted." : "Invitation declined.", "Could not process the invitation.", `${id}:${kind}`);
  }
  return <section className="tm-panel"><h2><Mail size={19} /> Your invitations</h2>
    <p className="tm-muted">Invitations sent to your verified email address.</p>
    {invitations === undefined ? <p role="status">Loading invitations...</p> : invitations.length === 0 ? <p className="tm-muted">No new invitations.</p> : invitations.map(inv => <div className="tm-line" key={inv._id}>
      <span><strong>{inv.workspaceName}</strong><small>Role: {roleLabels[inv.role]} · Expired {new Date(inv.expiresAt).toLocaleDateString("en-US")}</small></span>
      <span className="tm-actions">
        <button className="ui-button ui-primary" disabled={pending!==null} aria-busy={pending===`${inv._id}:accept`} onClick={() => void act(inv._id, "accept")}>{pending===`${inv._id}:accept` ? "Working..." : "Accept"}</button>
        <button className="ui-button ui-secondary" disabled={pending!==null} aria-busy={pending===`${inv._id}:decline`} onClick={() => void act(inv._id, "decline")}>{pending===`${inv._id}:decline` ? "Working..." : "Decline"}</button>
      </span>
    </div>)}
  </section>;
}

function MemberAvatar({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return <span className="tm-member-avatar" aria-hidden="true">
    {url && !broken ? <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} /> : <UserRound size={23} strokeWidth={1.7} />}
  </span>;
}

function MemberActions({ name, memberRole, allowAdmin, busy, onRoleChange, onRemove }: {
  name: string; memberRole: Role; allowAdmin: boolean; busy: boolean;
  onRoleChange: (role: Role) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div ref={root} className="tm-member-tools" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => { if (event.key === "Escape") {event.preventDefault(); close();} }}>
    <button ref={trigger} type="button" className="tm-more" aria-label={`Actions for ${name}`} aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => setOpen(value => !value)}><MoreHorizontal size={21} /></button>
    {open && <div id={id} className="tm-member-popover" role="group" aria-label={`Manage ${name}`}>
      <label>Change role<select aria-label={`Role for ${name}`} value={memberRole} disabled={busy} onChange={event => {const value = event.target.value as Role; close(); onRoleChange(value);}}>
        {allowAdmin && <option value="admin">Admin</option>}<option value="member">Member</option><option value="viewer">Viewer</option>
      </select></label>
      <button className="ui-button ui-danger" type="button" disabled={busy} onClick={() => {close(); onRemove();}}><UserMinus size={16} /> Remove member</button>
    </div>}
  </div>;
}

export default function TeamMembersPanel({ workspaceId, myRole }: { workspaceId: Id<"workspaces">; myRole: "owner" | "admin" | "member" | "viewer" }) {
  const members = useQuery(api.members.list, { workspaceId });
  const { user } = useUser();
  const isManager = myRole === "owner" || myRole === "admin";
  const invitations = useQuery(api.invitations.forWorkspace, isManager ? { workspaceId } : "skip");
  const invite = useMutation(api.invitations.create);
  const revoke = useMutation(api.invitations.revoke);
  const changeRole = useMutation(api.members.changeRole);
  const remove = useMutation(api.members.remove);
  const leave = useMutation(api.members.leave);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const { run, pending } = useAction();
  const { confirm } = useFeedback();
  const busy = pending !== null;
  useDraftGuard(isManager && email !== "", pending !== null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run(() => invite({ workspaceId, email: email.trim(), role }), "Invitation created. The recipient can sign in to view it.", "Could not send the invitation.", "invite")) setEmail("");
  }
  async function removeMember(userId: string, name: string) {
    if (busy || !await confirm({ title: "Remove member?", description: `${name} will lose access to this workspace.`, confirmLabel: "Remove member" })) return;
    await run(() => remove({ workspaceId, targetUserId: userId }), "Member removed.", "Could not remove the member.", `remove:${userId}`);
  }
  async function revokeInvitation(invitationId: Id<"workspaceInvitations">) {
    if (busy || !await confirm({ title: "Revoke invitation?", description: "The recipient will no longer be able to join with this invitation.", confirmLabel: "Revoke" })) return;
    await run(() => revoke({ invitationId }), "Invitation revoked.", "Could not revoke the invitation.", invitationId);
  }
  async function leaveWorkspace() {
    if (busy || !await confirm({ title: "Leave workspace?", description: "You will lose access to this workspace and its projects. You will need a new invitation to rejoin.", confirmLabel: "Leave workspace" })) return;
    await run(() => leave({ workspaceId }), "You have left the workspace.", "Could not leave the workspace.", "leave");
  }
  const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
  const orderedMembers = [...(members ?? [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joinedAt - b.joinedAt);
  return <section className="tm-panel tm-member-panel" aria-label="People" aria-busy={busy || members === undefined}>
    <header className="tm-member-header">
      <div><h2><Users size={19}/>People</h2><p>The people who make things happen</p></div>
      <span className="tm-member-count">{members === undefined ? "Loading…" : `${members.length}${members.length === 100 ? "+" : ""} ${members.length === 1 ? "member" : "members"}`}</span>
    </header>
    {busy && <span className="ui-inline-busy" role="status">{pending?.startsWith("remove:") ? "Removing member…" : "Working…"}</span>}
    {members === undefined ? <div className="tm-member-empty" role="status">Loading members…</div> : members.length === 0 ? <div className="tm-member-empty">No one has joined this workspace yet.</div> :
      <ul className="tm-member-list">{orderedMembers.map(member => {
        const mine = member.userId === user?.id;
        const displayName = member.fullName || (mine ? user?.fullName || user?.username : null) || `Member ${member.userId.slice(-4)}`;
        const memberEmail = member.email || (mine ? user?.primaryEmailAddress?.emailAddress : null);
        const avatarUrl = member.avatarUrl || (mine ? user?.imageUrl : null) || null;
        const canManage = isManager && member.role !== "owner" && (myRole === "owner" || member.role !== "admin");
        return <li className="tm-member-row" key={member._id} aria-busy={pending===`role:${member.userId}` || pending===`remove:${member.userId}`}>
          <MemberAvatar key={avatarUrl ?? "fallback"} url={avatarUrl} />
          <div className="tm-member-identity"><strong>{displayName}{mine && <span className="tm-member-you">You</span>}</strong><span className="tm-member-email">{memberEmail || "No email address"}</span></div>
          <div className="tm-member-right">
            <span className={`tm-role-badge tm-role-${member.role}`}>{member.role === "owner" && <Crown size={16} strokeWidth={1.6} />} {roleLabels[member.role]}</span>
            {canManage && <MemberActions name={displayName} memberRole={member.role as Role} allowAdmin={myRole === "owner"} busy={busy}
              onRoleChange={value => {void run(() => changeRole({ workspaceId, targetUserId: member.userId, role: value }), "Permissions updated.", "Could not update permissions.", `role:${member.userId}`);}}
              onRemove={() => void removeMember(member.userId, displayName)} />}
          </div>
        </li>;
      })}</ul>}
    {isManager && <div className="tm-member-management">
      <details className="tm-invite-section">
        <summary><UserPlus size={17} /> Invite a teammate <ChevronDown size={15} className="tm-details-chevron" /></summary>
        <form className="tm-invite" onSubmit={event => void submit(event)}>
          <label>Email address<input type="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} placeholder="thanhvien@example.com" /></label>
          <label>Role<select disabled={busy} value={role} onChange={event => setRole(event.target.value as Role)}><option value="member">Member</option><option value="viewer">Viewer</option>{myRole === "owner" && <option value="admin">Admin</option>}</select></label>
          <button className="ui-button ui-primary" disabled={busy || !email.trim()} aria-busy={pending==="invite"} type="submit"><Send size={15} />{pending==="invite" ? "Sending…" : "Send invitation"}</button>
        </form>
      </details>
      <details className="tm-pending-section">
        <summary><Mail size={17} /> Pending invitations {invitations && <span className="tm-pending-count">{invitations.length}</span>}<ChevronDown size={15} className="tm-details-chevron" /></summary>
        {invitations === undefined ? <p className="tm-muted">Loading invitations…</p> : invitations.length === 0 ? <p className="tm-muted">No pending invitations.</p> : invitations.map(inv => <div className="tm-line" key={inv._id}>
          <span><strong>{inv.email}</strong><small>{roleLabels[inv.role]} · {inv.expiresAt <= Date.now() ? "Expired" : "Still active"}</small></span>
          <button className="ui-button ui-danger" type="button" disabled={busy || (myRole === "admin" && inv.role === "admin")} aria-busy={pending===inv._id} onClick={() => void revokeInvitation(inv._id)}><XCircle size={16} />{pending===inv._id ? "Revoking…" : "Revoke"}</button>
        </div>)}
      </details>
    </div>}
    {myRole !== "owner" && <div className="tm-member-footer"><button type="button" className="ui-button ui-danger" disabled={busy} aria-busy={pending==="leave"} onClick={() => void leaveWorkspace()}>{pending==="leave" ? "Working…" : "Leave workspace"}</button></div>}
  </section>;
}
