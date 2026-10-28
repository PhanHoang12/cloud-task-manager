import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
async function authorize(ctx: Ctx, taskId: Id<"projectTasks">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error("Task không tồn tại.");
  const project = await ctx.db.get(task.projectId);
  if (!project) throw new Error("Dự án không tồn tại.");
  const member = await ctx.db.query("workspaceMembers")
    .withIndex("by_workspace_user", q => q.eq("workspaceId", project.workspaceId).eq("userId", identity.subject))
    .unique();
  if (!member) throw new Error("Không thuộc Workspace.");
  return { task, project, member, userId: identity.subject };
}
function requireEditor(data: Awaited<ReturnType<typeof authorize>>) {
  if (data.project.status !== "active" || data.member.role === "viewer") throw new Error("Không có quyền chỉnh sửa.");
  const manager = data.member.role === "owner" || data.member.role === "admin";
  if (!manager && data.task.createdBy !== data.userId && data.task.assigneeId !== data.userId) {
    throw new Error("Chỉ người phụ trách hoặc người tạo Task được chỉnh sửa Subtask.");
  }
  if (data.task.status === "done" && !manager) throw new Error("Chỉ Owner/Admin được chỉnh sửa Task đã duyệt.");
}
async function audit(ctx: MutationCtx, data: Awaited<ReturnType<typeof authorize>>, detail: string) {
  await ctx.db.insert("projectTaskActivities", {
    projectId: data.task.projectId, taskId: data.task._id,
    actorId: data.userId, type: "updated", detail, createdAt: Date.now(),
  });
}
function titleOf(title: string) {
  const result = title.trim();
  if (result.length < 2 || result.length > 160) throw new Error("Tên công việc con phải từ 2–160 ký tự.");
  return result;
}
export const list = query({
  args: { taskId: v.id("projectTasks") },
  handler: async (ctx, { taskId }) => {
    await authorize(ctx, taskId);
    const rows = await ctx.db.query("subtasks").withIndex("by_task", q => q.eq("taskId", taskId)).take(200);
    return rows.sort((a, b) => a.position - b.position);
  },
});
export const create = mutation({
  args: { taskId: v.id("projectTasks"), title: v.string() },
  handler: async (ctx, args) => {
    const data = await authorize(ctx, args.taskId); requireEditor(data);
    const title = titleOf(args.title);
    const existing = await ctx.db.query("subtasks").withIndex("by_task", q => q.eq("taskId", args.taskId)).take(200);
    if (existing.length >= 200) throw new Error("Giới hạn 200 Subtask cho mỗi Task.");
    const now = Date.now();
    const position = existing.reduce((n, s) => Math.max(n, s.position), 0) + 1;
    const id = await ctx.db.insert("subtasks", { taskId: args.taskId, title, isCompleted: false, position, createdBy: data.userId, createdAt: now, updatedAt: now });
    await audit(ctx, data, `Thêm Subtask: ${title}`);
    return id;
  },
});
export const rename = mutation({
  args: { subtaskId: v.id("subtasks"), title: v.string() },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Subtask không tồn tại.");
    const data = await authorize(ctx, subtask.taskId); requireEditor(data);
    const title = titleOf(args.title);
    await ctx.db.patch(args.subtaskId, { title, updatedAt: Date.now() });
    await audit(ctx, data, `Đổi tên Subtask thành: ${title}`);
  },
});
export const toggle = mutation({
  args: { subtaskId: v.id("subtasks"), isCompleted: v.boolean() },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Subtask không tồn tại.");
    const data = await authorize(ctx, subtask.taskId); requireEditor(data);
    if (subtask.isCompleted === args.isCompleted) return;
    await ctx.db.patch(args.subtaskId, { isCompleted: args.isCompleted, updatedAt: Date.now() });
    await audit(ctx, data, `${args.isCompleted ? "Hoàn thành" : "Mở lại"} Subtask: ${subtask.title}`);
  },
});
export const remove = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Subtask không tồn tại.");
    const data = await authorize(ctx, subtask.taskId); requireEditor(data);
    await ctx.db.delete(args.subtaskId);
    await audit(ctx, data, `Xóa Subtask: ${subtask.title}`);
  },
});
