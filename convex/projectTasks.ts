import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { invalidateTaskDeadlineAlerts } from "./deadlineLifecycle";

type Ctx = QueryCtx | MutationCtx;
const taskStatus = v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"));
const taskPriority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"));
type Status = "todo" | "in_progress" | "review" | "done";

type TaskInput = { title: string; description: string; dueDate?: string };

async function requireUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  return identity.subject;
}
async function access(ctx: Ctx, projectId: Id<"projects">, userId: string) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Không tìm thấy dự án.");
  const membership = await ctx.db.query("workspaceMembers")
    .withIndex("by_workspace_user", q => q.eq("workspaceId", project.workspaceId).eq("userId", userId)).unique();
  if (!membership) throw new Error("Bạn không có quyền truy cập dự án.");
  return { project, membership };
}
function validate(input: TaskInput) {
  if (input.title.trim().length < 3 || input.title.trim().length > 120) throw new Error("Tiêu đề cần từ 3 đến 120 ký tự.");
  if (input.description.length > 2000) throw new Error("Mô tả tối đa 2000 ký tự.");
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error("Ngày không hợp lệ.");
    const date = new Date(`${input.dueDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.dueDate) throw new Error("Ngày không hợp lệ.");
  }
}
async function validateAssignee(ctx: MutationCtx, workspaceId: Id<"workspaces">, assigneeId?: string) {
  if (!assigneeId) return;
  const member = await ctx.db.query("workspaceMembers")
    .withIndex("by_workspace_user", q => q.eq("workspaceId", workspaceId).eq("userId", assigneeId)).unique();
  if (!member || member.role === "viewer") throw new Error("Người được giao phải là thành viên có quyền thực hiện.");
}
function canEdit(role: string, userId: string, task: { createdBy: string; assigneeId?: string }) {
  return role === "owner" || role === "admin" || task.createdBy === userId || task.assigneeId === userId;
}
function checkWrite(projectStatus: string, role: string) {
  if (projectStatus !== "active") throw new Error("Dự án đã ngừng hoạt động.");
  if (role === "viewer") throw new Error("Viewer chỉ được xem.");
}
function checkTransition(role: string, userId: string, task: { createdBy: string; assigneeId?: string; status: Status }, target: Status) {
  if (!canEdit(role, userId, task)) throw new Error("Bạn không có quyền sửa Task này.");
  if (role !== "owner" && role !== "admin" && (target === "done" || task.status === "done")) {
    throw new Error("Chỉ Owner/Admin có thể duyệt hoặc mở lại Task hoàn thành.");
  }
}
async function log(ctx: MutationCtx, args: { projectId: Id<"projects">; taskId: Id<"projectTasks">; actorId: string; type: "created" | "updated" | "moved" | "deleted"; detail: string }) {
  await ctx.db.insert("projectTaskActivities", { ...args, createdAt: Date.now() });
}

export const list = query({ args: { projectId: v.id("projects") }, handler: async (ctx, { projectId }) => {
  await access(ctx, projectId, await requireUser(ctx));
  return ctx.db.query("projectTasks").withIndex("by_project", q => q.eq("projectId", projectId)).take(200);
}});
export const activities = query({ args: { projectId: v.id("projects") }, handler: async (ctx, { projectId }) => {
  await access(ctx, projectId, await requireUser(ctx));
  return ctx.db.query("projectTaskActivities").withIndex("by_project_created", q => q.eq("projectId", projectId)).order("desc").take(100);
}});
export const create = mutation({ args: {
  projectId: v.id("projects"), title: v.string(), description: v.string(), priority: taskPriority,
  dueDate: v.optional(v.string()), assigneeId: v.optional(v.string()),
}, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const { project, membership } = await access(ctx, args.projectId, userId);
  checkWrite(project.status, membership.role);
  validate(args);
  await validateAssignee(ctx, project.workspaceId, args.assigneeId);
  const now = Date.now();
  const taskId = await ctx.db.insert("projectTasks", {
    projectId: args.projectId, title: args.title.trim(), description: args.description.trim(), createdBy: userId,
    assigneeId: args.assigneeId, status: "todo", priority: args.priority, dueDate: args.dueDate,
    position: now, createdAt: now, updatedAt: now,
  });
  await log(ctx, { projectId: args.projectId, taskId, actorId: userId, type: "created", detail: args.title.trim() });
  return taskId;
}});
export const update = mutation({ args: {
  taskId: v.id("projectTasks"), title: v.string(), description: v.string(), priority: taskPriority,
  dueDate: v.optional(v.string()), assigneeId: v.optional(v.string()),
}, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new Error("Task không tồn tại.");
  const { project, membership } = await access(ctx, task.projectId, userId);
  checkWrite(project.status, membership.role);
  if (!canEdit(membership.role, userId, task)) throw new Error("Bạn không có quyền sửa Task.");
  // Only managers may reassign tasks to other users.
  if (args.assigneeId !== task.assigneeId && membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Chỉ Owner/Admin được thay người phụ trách.");
  }
  validate(args);
  await validateAssignee(ctx, project.workspaceId, args.assigneeId);
  if (task.dueDate !== args.dueDate || task.assigneeId !== args.assigneeId) {
    await invalidateTaskDeadlineAlerts(ctx, args.taskId);
  }
  await ctx.db.patch(args.taskId, { title: args.title.trim(), description: args.description.trim(),
    priority: args.priority, dueDate: args.dueDate, assigneeId: args.assigneeId, updatedAt: Date.now() });
  await log(ctx, { projectId: task.projectId, taskId: args.taskId, actorId: userId, type: "updated", detail: args.title.trim() });
}});
export const setStatus = mutation({ args: { taskId: v.id("projectTasks"), status: taskStatus }, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new Error("Task không tồn tại.");
  const { project, membership } = await access(ctx, task.projectId, userId);
  checkWrite(project.status, membership.role);
  checkTransition(membership.role, userId, task, args.status);
  if (task.status === args.status) return;
  if (args.status === "done") {
    await invalidateTaskDeadlineAlerts(ctx, args.taskId);
  }
  await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
  await log(ctx, { projectId: task.projectId, taskId: args.taskId, actorId: userId, type: "moved", detail: `${task.status} → ${args.status}` });
}});
export const move = mutation({ args: {
  taskId: v.id("projectTasks"), targetStatus: taskStatus, beforeTaskId: v.optional(v.id("projectTasks")),
}, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new Error("Task không tồn tại.");
  const { project, membership } = await access(ctx, task.projectId, userId);
  checkWrite(project.status, membership.role);
  checkTransition(membership.role, userId, task, args.targetStatus);
  // Reindex target lane on every move. Bounded to 200 tasks for this educational MVP.
  const all = await ctx.db.query("projectTasks")
    .withIndex("by_project_status", q => q.eq("projectId", task.projectId).eq("status", args.targetStatus)).take(201);
  if (all.length > 200) throw new Error("Cột quá lớn, cần phân trang trước khi sắp xếp.");
  const lane = all.filter(t => t._id !== task._id).sort((a, b) => a.position - b.position || a._creationTime - b._creationTime);
  if (args.beforeTaskId) {
    if (args.beforeTaskId === task._id) return;
    const index = lane.findIndex(t => t._id === args.beforeTaskId);
    if (index < 0) throw new Error("Vị trí thả không hợp lệ.");
    lane.splice(index, 0, task);
  } else lane.push(task);
  if (task.status !== args.targetStatus && args.targetStatus === "done") {
    await invalidateTaskDeadlineAlerts(ctx, args.taskId);
  }
  const now = Date.now();
  for (let index = 0; index < lane.length; index++) {
    const item = lane[index];
    await ctx.db.patch(item._id, {
      position: (index + 1) * 1000,
      ...(item._id === task._id ? { status: args.targetStatus, updatedAt: now } : {}),
    });
  }
  await log(ctx, { projectId: task.projectId, taskId: task._id, actorId: userId,
    type: "moved", detail: `${task.status} → ${args.targetStatus}; vị trí ${lane.findIndex(t => t._id === task._id) + 1}` });
}});
export const remove = mutation({ args: { taskId: v.id("projectTasks") }, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new Error("Task không tồn tại.");
  const { membership } = await access(ctx, task.projectId, userId);
  if (membership.role !== "owner" && membership.role !== "admin") throw new Error("Chỉ Owner/Admin có thể xóa Task.");
  await log(ctx, { projectId: task.projectId, taskId: args.taskId, actorId: userId, type: "deleted", detail: task.title });
  await invalidateTaskDeadlineAlerts(ctx, args.taskId);
  await ctx.db.delete(args.taskId);
}});
