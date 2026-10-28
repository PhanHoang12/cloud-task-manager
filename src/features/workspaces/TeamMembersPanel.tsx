import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Mail, UserMinus, Send, XCircle, UserRound, Crown, MoreHorizontal, UserPlus, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/react";
import { useAction, useFeedback } from "../../components/Feedback";
import "./members.css";

type Role = "admin" | "member" | "viewer";
const roleText = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

export function MyInvitations() {
  const invitations = useQuery(api.invitations.mine);
  const accept = useMutation(api.invitations.accept);
  const decline = useMutation(api.invitations.decline);
  const { run, pending } = useAction();
  async function act(id: Id<"workspaceInvitations">, kind: "accept" | "decline") {
    await run(() => kind === "accept" ? accept({ invitationId: id }) : decline({ invitationId: id }), kind === "accept" ? "Đã chấp nhận lời mời." : "Đã từ chối lời mời.", "Không thể xử lý lời mời.", `${id}:${kind}`);
  }
  return <section className="tm-panel"><h2><Mail size={19} /> Lời mời của tôi</h2>
    <p className="tm-muted">Chỉ hiển thị lời mời gửi đến email đã xác minh trong Clerk.</p>
    {invitations === undefined ? <p role="status">Đang tải lời mời...</p> : invitations.length === 0 ? <p className="tm-muted">Không có lời mời mới.</p> : invitations.map(inv => <div className="tm-line" key={inv._id}>
      <span><strong>{inv.workspaceName}</strong><small>Vai trò: {roleText[inv.role]} · Hết hạn {new Date(inv.expiresAt).toLocaleDateString("vi-VN")}</small></span>
      <span className="tm-actions">
        <button className="ui-button ui-primary" disabled={pending!==null} aria-busy={pending===`${inv._id}:accept`} onClick={() => void act(inv._id, "accept")}>{pending===`${inv._id}:accept` ? "Đang xử lý..." : "Chấp nhận"}</button>
        <button className="ui-button ui-secondary" disabled={pending!==null} aria-busy={pending===`${inv._id}:decline`} onClick={() => void act(inv._id, "decline")}>{pending===`${inv._id}:decline` ? "Đang xử lý..." : "Từ chối"}</button>
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
    <button ref={trigger} type="button" className="tm-more" aria-label={`Thao tác với ${name}`} aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => setOpen(value => !value)}><MoreHorizontal size={21} /></button>
    {open && <div id={id} className="tm-member-popover" role="group" aria-label={`Quản lý ${name}`}>
      <label>Thay đổi vai trò<select aria-label={`Vai trò của ${name}`} value={memberRole} disabled={busy} onChange={event => {const value = event.target.value as Role; close(); onRoleChange(value);}}>
        {allowAdmin && <option value="admin">Admin</option>}<option value="member">Member</option><option value="viewer">Viewer</option>
      </select></label>
      <button className="ui-button ui-danger" type="button" disabled={busy} onClick={() => {close(); onRemove();}}><UserMinus size={16} /> Loại thành viên</button>
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await run(() => invite({ workspaceId, email: email.trim(), role }), "Đã tạo lời mời. Người nhận đăng nhập để thấy lời mời.", "Không thể gửi lời mời.", "invite")) setEmail("");
  }
  async function removeMember(userId: string, name: string) {
    if (busy || !await confirm({ title: "Loại thành viên?", description: `${name} sẽ mất quyền truy cập Workspace này.`, confirmLabel: "Loại thành viên" })) return;
    await run(() => remove({ workspaceId, targetUserId: userId }), "Đã loại thành viên.", "Không thể loại thành viên.", `remove:${userId}`);
  }
  async function revokeInvitation(invitationId: Id<"workspaceInvitations">) {
    if (busy || !await confirm({ title: "Thu hồi lời mời?", description: "Người nhận sẽ không thể dùng lời mời này để tham gia Workspace.", confirmLabel: "Thu hồi" })) return;
    await run(() => revoke({ invitationId }), "Đã thu hồi lời mời.", "Không thể thu hồi lời mời.", invitationId);
  }
  async function leaveWorkspace() {
    if (busy || !await confirm({ title: "Rời Workspace?", description: "Bạn sẽ mất quyền truy cập các dự án trong Workspace này. Cần lời mời mới để tham gia lại.", confirmLabel: "Rời Workspace" })) return;
    await run(() => leave({ workspaceId }), "Đã rời Workspace.", "Không thể rời Workspace.", "leave");
  }
  const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
  const orderedMembers = [...(members ?? [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joinedAt - b.joinedAt);
  return <section className="tm-panel tm-member-panel" aria-label="Thành viên Workspace" aria-busy={busy || members === undefined}>
    <header className="tm-member-header">
      <div><h2>Thành viên Workspace</h2><p>Quản lý tài khoản và vai trò trong nhóm</p></div>
      <span className="tm-member-count">{members === undefined ? "Đang tải…" : `${members.length}${members.length === 100 ? "+" : ""} thành viên`}</span>
    </header>
    {busy && <span className="ui-inline-busy" role="status">{pending?.startsWith("remove:") ? "Đang loại thành viên…" : "Đang xử lý…"}</span>}
    {members === undefined ? <div className="tm-member-empty" role="status">Đang tải danh sách thành viên…</div> : members.length === 0 ? <div className="tm-member-empty">Chưa có thành viên trong Workspace.</div> :
      <ul className="tm-member-list">{orderedMembers.map(member => {
        const mine = member.userId === user?.id;
        const displayName = member.fullName || (mine ? user?.fullName || user?.username : null) || `Thành viên ${member.userId.slice(-4)}`;
        const memberEmail = member.email || (mine ? user?.primaryEmailAddress?.emailAddress : null);
        const avatarUrl = member.avatarUrl || (mine ? user?.imageUrl : null) || null;
        const canManage = isManager && member.role !== "owner" && (myRole === "owner" || member.role !== "admin");
        return <li className="tm-member-row" key={member._id} aria-busy={pending===`role:${member.userId}` || pending===`remove:${member.userId}`}>
          <MemberAvatar key={avatarUrl ?? "fallback"} url={avatarUrl} />
          <div className="tm-member-identity"><strong>{displayName}{mine && <span className="tm-member-you">Bạn</span>}</strong><span className="tm-member-email">{memberEmail || "Chưa có thông tin email"}</span></div>
          <div className="tm-member-right">
            <span className={`tm-role-badge tm-role-${member.role}`}>{member.role === "owner" && <Crown size={16} strokeWidth={1.6} />} {roleText[member.role]}</span>
            {canManage && <MemberActions name={displayName} memberRole={member.role as Role} allowAdmin={myRole === "owner"} busy={busy}
              onRoleChange={value => {void run(() => changeRole({ workspaceId, targetUserId: member.userId, role: value }), "Đã cập nhật quyền.", "Không thể cập nhật quyền.", `role:${member.userId}`);}}
              onRemove={() => void removeMember(member.userId, displayName)} />}
          </div>
        </li>;
      })}</ul>}
    {isManager && <div className="tm-member-management">
      <details className="tm-invite-section">
        <summary><UserPlus size={17} /> Mời thành viên <ChevronDown size={15} className="tm-details-chevron" /></summary>
        <form className="tm-invite" onSubmit={event => void submit(event)}>
          <label>Email người nhận<input type="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} placeholder="member@example.com" /></label>
          <label>Vai trò<select disabled={busy} value={role} onChange={event => setRole(event.target.value as Role)}><option value="member">Member</option><option value="viewer">Viewer</option>{myRole === "owner" && <option value="admin">Admin</option>}</select></label>
          <button className="ui-button ui-primary" disabled={busy || !email.trim()} aria-busy={pending==="invite"} type="submit"><Send size={15} />{pending==="invite" ? "Đang gửi…" : "Gửi lời mời"}</button>
        </form>
      </details>
      <details className="tm-pending-section">
        <summary><Mail size={17} /> Lời mời đang chờ {invitations && <span className="tm-pending-count">{invitations.length}</span>}<ChevronDown size={15} className="tm-details-chevron" /></summary>
        {invitations === undefined ? <p className="tm-muted">Đang tải lời mời…</p> : invitations.length === 0 ? <p className="tm-muted">Không có lời mời đang chờ.</p> : invitations.map(inv => <div className="tm-line" key={inv._id}>
          <span><strong>{inv.email}</strong><small>{roleText[inv.role]} · {inv.expiresAt <= Date.now() ? "Đã hết hạn" : "Còn hiệu lực"}</small></span>
          <button className="ui-button ui-danger" type="button" disabled={busy || (myRole === "admin" && inv.role === "admin")} aria-busy={pending===inv._id} onClick={() => void revokeInvitation(inv._id)}><XCircle size={16} />{pending===inv._id ? "Đang thu hồi…" : "Thu hồi"}</button>
        </div>)}
      </details>
    </div>}
    {myRole !== "owner" && <div className="tm-member-footer"><button type="button" className="ui-button ui-danger" disabled={busy} aria-busy={pending==="leave"} onClick={() => void leaveWorkspace()}>{pending==="leave" ? "Đang xử lý…" : "Rời Workspace"}</button></div>}
  </section>;
}
