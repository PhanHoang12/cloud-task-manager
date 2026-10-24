import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireManager, verifiedEmail } from "./permissions";

const inviteRole = v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"));
const INVITE_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING = 100;

export const create = mutation({
  args: { workspaceId: v.id("workspaces"), email: v.string(), role: inviteRole },
  handler: async (ctx, args) => {
    const actor = await requireIdentity(ctx);
    const manager = await requireManager(ctx, args.workspaceId, actor.subject);
    if (manager.role === "admin" && args.role === "admin") throw new Error("Chỉ Owner mời được Admin.");
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Email không hợp lệ.");
    const existing = await ctx.db.query("workspaceInvitations")
      .withIndex("by_workspace_email", q => q.eq("workspaceId", args.workspaceId).eq("email", email)).collect();
    if (existing.some(inv => inv.status === "pending" && inv.expiresAt > Date.now())) {
      throw new Error("Đã có lời mời còn hiệu lực cho email này.");
    }
    const pending = await ctx.db.query("workspaceInvitations")
      .withIndex("by_workspace_status", q => q.eq("workspaceId", args.workspaceId).eq("status", "pending")).take(MAX_PENDING + 1);
    if (pending.length >= MAX_PENDING) throw new Error("Workspace có quá nhiều lời mời đang chờ.");
    const now = Date.now();
    const invitationId = await ctx.db.insert("workspaceInvitations", {
      workspaceId: args.workspaceId, email, role: args.role, status: "pending",
      invitedBy: actor.subject, createdAt: now, expiresAt: now + INVITE_LIFETIME,
    });
    await ctx.db.insert("memberAuditLogs", {workspaceId: args.workspaceId, actorId: actor.subject, action: "invite_created", targetUserId: email, createdAt: now});
    return invitationId;
  },
});

export const mine = query({
  args: {},
  handler: async ctx => {
    const identity = await requireIdentity(ctx);
    const email = verifiedEmail(identity);
    const invites = await ctx.db.query("workspaceInvitations")
      .withIndex("by_email_status", q => q.eq("email", email).eq("status", "pending")).take(100);
    const active = invites.filter(i => i.expiresAt > Date.now());
    return await Promise.all(active.map(async i => ({ ...i, workspaceName: (await ctx.db.get(i.workspaceId))?.name ?? "Workspace đã xóa" })));
  }
});

export const forWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    await requireManager(ctx, args.workspaceId, identity.subject);
    return ctx.db.query("workspaceInvitations")
      .withIndex("by_workspace_status", q => q.eq("workspaceId", args.workspaceId).eq("status", "pending")).take(100);
  }
});

export const accept = mutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const email = verifiedEmail(identity);
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.email !== email || invite.status !== "pending") throw new Error("Lời mời không hợp lệ hoặc không thuộc tài khoản này.");
    if (invite.expiresAt <= Date.now()) throw new Error("Lời mời đã hết hạn.");
    if (!(await ctx.db.get(invite.workspaceId))) throw new Error("Workspace không còn tồn tại.");
    const existing = await ctx.db.query("workspaceMembers")
      .withIndex("by_workspace_user", q => q.eq("workspaceId", invite.workspaceId).eq("userId", identity.subject)).unique();
    if (existing) throw new Error("Bạn đã là thành viên Workspace.");
    const now = Date.now();
    await ctx.db.insert("workspaceMembers", {workspaceId: invite.workspaceId, userId: identity.subject, role: invite.role, joinedAt: now});
    await ctx.db.patch(invite._id, {status: "accepted", respondedAt: now});
    await ctx.db.insert("memberAuditLogs", {workspaceId: invite.workspaceId, actorId: identity.subject, action: "invite_accepted", targetUserId: identity.subject, createdAt: now});
    return invite.workspaceId;
  },
});

export const decline = mutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const email = verifiedEmail(identity);
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.email !== email || invite.status !== "pending") throw new Error("Không thể từ chối lời mời này.");
    await ctx.db.patch(invite._id, {status: "declined", respondedAt: Date.now()});
  },
});

export const revoke = mutation({
  args: {invitationId: v.id("workspaceInvitations")},
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.status !== "pending") throw new Error("Lời mời không còn hiệu lực.");
    await requireManager(ctx, invite.workspaceId, identity.subject);
    await ctx.db.patch(invite._id, {status: "revoked", respondedAt: Date.now()});
    await ctx.db.insert("memberAuditLogs", {workspaceId: invite.workspaceId, actorId: identity.subject, action: "invite_revoked", targetUserId: invite.email, createdAt: Date.now()});
  }
});
