import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
async function requireUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  return identity.subject;
}
async function ownedTask(ctx: Ctx, id: Id<"tasks">, ownerId: string) {
  const task = await ctx.db.get(id);
  if (!task || task.ownerId !== ownerId) throw new Error("Không tìm thấy công việc hoặc không có quyền.");
  return task;
}
const status = v.union(v.literal("todo"), v.literal("doing"), v.literal("done"));
const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
function checkTitle(title: string) {
  if (!title.trim() || title.trim().length > 120) throw new Error("Tiêu đề phải dài từ 1 đến 120 ký tự.");
}
function checkDescription(description: string) {
  if (description.length > 2000) throw new Error("Mô tả tối đa 2000 ký tự.");
}

function checkDueDate(dueDate: string | undefined) {
  if (dueDate === undefined) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Ngày hạn không hợp lệ.");
  }

  const date = new Date(`${dueDate}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dueDate
  ) {
    throw new Error("Ngày hạn không hợp lệ.");
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    return await ctx.db.query("tasks").withIndex("by_owner", q => q.eq("ownerId", ownerId)).collect();
  },
});
export const create = mutation({
  args: {title:v.string(), description:v.string(), priority, dueDate:v.optional(v.string())},
  handler: async (ctx,args) => {
    const ownerId = await requireUser(ctx);
    checkTitle(args.title);checkDescription(args.description);checkDueDate(args.dueDate);
    const now=Date.now();
    return await ctx.db.insert("tasks", {ownerId,title:args.title.trim(),description:args.description.trim(),priority:args.priority,dueDate:args.dueDate,status:"todo",createdAt:now,updatedAt:now});
  },
});
export const update = mutation({
  args: {id:v.id("tasks"),title:v.string(),description:v.string(),priority,dueDate:v.optional(v.string()),status},
  handler: async (ctx,args) => {
    const ownerId=await requireUser(ctx);
    await ownedTask(ctx,args.id,ownerId);
    checkTitle(args.title);checkDescription(args.description);checkDueDate(args.dueDate);
    await ctx.db.patch(args.id,{title:args.title.trim(),description:args.description.trim(),priority:args.priority,dueDate:args.dueDate,status:args.status,updatedAt:Date.now()});
  },
});
export const setStatus = mutation({
  args: {id:v.id("tasks"),status},
  handler: async (ctx,args) => {
    const ownerId=await requireUser(ctx);
    await ownedTask(ctx,args.id,ownerId);
    await ctx.db.patch(args.id,{status:args.status,updatedAt:Date.now()});
  },
});
export const remove = mutation({
  args: {id:v.id("tasks")},
  handler: async (ctx,args) => {
    const ownerId=await requireUser(ctx);
    await ownedTask(ctx,args.id,ownerId);
    await ctx.db.delete(args.id);
  },
});
