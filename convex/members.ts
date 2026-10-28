import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireManager, requireMember, requireOwner } from "./permissions";

const role = v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"));

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(v.object({
    _id: v.id("workspaceMembers"), _creationTime: v.number(),
    workspaceId: v.id("workspaces"), userId: v.string(),
    role: v.union(v.literal("owner"), role), joinedAt: v.number(),
    fullName: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    avatarUrl: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    await requireMember(ctx, args.workspaceId, identity.subject);
    const members = await ctx.db.query("workspaceMembers")
      .withIndex("by_workspace", q => q.eq("workspaceId", args.workspaceId)).take(100);
    return await Promise.all(members.map(async member => {
      const profile = await ctx.db.query("profiles")
        .withIndex("by_user", q => q.eq("userId", member.userId)).unique();
      const mine = member.userId === identity.subject;
      const customName = profile?.fullName.trim();
      const fullName = (customName && customName !== "Người dùng" ? customName : null) ||
        profile?.accountName || (mine ? identity.name : null) || null;
      const storedAvatar = profile?.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : profile?.avatarUrl;
      // Project only public account details; never expose bio, phone or student data.
      return {
        ...member, fullName,
        email: profile?.email || (mine ? identity.email : null) || null,
        avatarUrl: storedAvatar || profile?.accountAvatarUrl || (mine ? identity.pictureUrl : null) || null,
      };
    }));
  },
});

export const changeRole = mutation({
  args: {workspaceId:v.id("workspaces"), targetUserId:v.string(), role},
  handler: async (ctx,args) => {
    const identity = await requireIdentity(ctx);
    const actor = await requireManager(ctx,args.workspaceId,identity.subject);
    const target = await requireMember(ctx,args.workspaceId,args.targetUserId);
    if (target.role === "owner") throw new Error("Không được thay đổi quyền Owner.");
    if (actor.role === "admin" && (target.role === "admin" || args.role === "admin")) throw new Error("Admin không thể cấp hoặc sửa quyền Admin.");
    await ctx.db.patch(target._id,{role:args.role});
    await ctx.db.insert("memberAuditLogs", {workspaceId:args.workspaceId,actorId:identity.subject,action:"role_changed",targetUserId:args.targetUserId,detail:args.role,createdAt:Date.now()});
  }
});

export const remove = mutation({
  args:{workspaceId:v.id("workspaces"),targetUserId:v.string()},
  handler:async(ctx,args)=>{
    const identity=await requireIdentity(ctx);
    const actor=await requireManager(ctx,args.workspaceId,identity.subject);
    const target=await requireMember(ctx,args.workspaceId,args.targetUserId);
    if(target.role==="owner") throw new Error("Không được loại Owner.");
    if(actor.role==="admin" && target.role==="admin") throw new Error("Admin không được loại Admin khác.");
    await ctx.db.delete(target._id);
    await ctx.db.insert("memberAuditLogs", {workspaceId:args.workspaceId,actorId:identity.subject,action:"member_removed",targetUserId:args.targetUserId,createdAt:Date.now()});
  }
});

export const leave = mutation({
  args:{workspaceId:v.id("workspaces")},
  handler:async(ctx,args)=>{
    const identity=await requireIdentity(ctx);
    const member=await requireMember(ctx,args.workspaceId,identity.subject);
    if(member.role==="owner") throw new Error("Owner phải chuyển quyền sở hữu trước khi rời Workspace.");
    await ctx.db.delete(member._id);
    await ctx.db.insert("memberAuditLogs", {workspaceId:args.workspaceId,actorId:identity.subject,action:"member_left",targetUserId:identity.subject,createdAt:Date.now()});
  }
});

export const recentAudit = query({
  args:{workspaceId:v.id("workspaces")},
  handler:async(ctx,args)=>{
    const identity=await requireIdentity(ctx);
    await requireOwner(ctx,args.workspaceId,identity.subject);
    return ctx.db.query("memberAuditLogs").withIndex("by_workspace",q=>q.eq("workspaceId",args.workspaceId)).order("desc").take(50);
  }
});
