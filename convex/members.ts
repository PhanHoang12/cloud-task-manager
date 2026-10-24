import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireManager, requireMember, requireOwner } from "./permissions";

const role = v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"));

export const list = query({
  args: {workspaceId: v.id("workspaces")},
  handler: async (ctx,args) => {
    const identity = await requireIdentity(ctx);
    await requireMember(ctx,args.workspaceId,identity.subject);
    return ctx.db.query("workspaceMembers").withIndex("by_workspace", q=>q.eq("workspaceId",args.workspaceId)).take(100);
  }
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
