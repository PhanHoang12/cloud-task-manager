
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

type Ctx = QueryCtx | MutationCtx;

const taskStatus = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done")
);

const taskPriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

async function requireUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  return identity.subject;
}

async function getProjectAccess(
  ctx: Ctx,
  projectId: Id<"projects">,
  userId: string
) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Không tìm thấy dự án.");

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", q =>
      q.eq("workspaceId", project.workspaceId)
       .eq("userId", userId)
    )
    .unique();

  if (!membership) {
    throw new Error("Bạn không có quyền truy cập dự án.");
  }

  return { project, membership };
}

function checkTask(title: string, description: string) {
  if (title.trim().length < 3 || title.trim().length > 120) {
    throw new Error("Tiêu đề phải dài từ 3 đến 120 ký tự.");
  }

  if (description.length > 2000) {
    throw new Error("Mô tả tối đa 2000 ký tự.");
  }
}

function checkDueDate(dueDate?: string) {
  if (dueDate === undefined) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Ngày phải có định dạng YYYY-MM-DD.");
  }

  const parsed = new Date(`${dueDate}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dueDate
  ) {
    throw new Error("Ngày không hợp lệ.");
  }
}

// 1. Lấy danh sách Task trong một Project
export const list = query({
  args: {
    projectId: v.id("projects"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    await getProjectAccess(ctx, args.projectId, userId);

    return await ctx.db
      .query("projectTasks")
      .withIndex("by_project", q =>
        q.eq("projectId", args.projectId)
      )
      .take(200);
  },
});

// 2. Tạo Task mới
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    priority: taskPriority,
    dueDate: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const { project, membership } =
      await getProjectAccess(ctx, args.projectId, userId);

    if (membership.role === "viewer") {
      throw new Error("Viewer không có quyền tạo Task.");
    }

    if (project.status !== "active") {
      throw new Error("Chỉ có thể tạo Task trong dự án đang hoạt động.");
    }

    checkTask(args.title, args.description);
    checkDueDate(args.dueDate);

    if (args.assigneeId) {
      const assignee = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", q =>
          q.eq("workspaceId", project.workspaceId)
           .eq("userId", args.assigneeId!)
        )
        .unique();

      if (!assignee) {
        throw new Error("Người được giao không thuộc Workspace.");
      }

      if (assignee.role === "viewer") {
        throw new Error("Không thể giao Task cho Viewer.");
      }
    }

    const now = Date.now();

    return await ctx.db.insert("projectTasks", {
      projectId: args.projectId,
      title: args.title.trim(),
      description: args.description.trim(),
      createdBy: userId,
      assigneeId: args.assigneeId,
      status: "todo",
      priority: args.priority,
      dueDate: args.dueDate,
      position: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// 3. Chuyển trạng thái Kanban
export const setStatus = mutation({
  args: {
    taskId: v.id("projectTasks"),
    status: taskStatus,
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const task = await ctx.db.get(args.taskId);

    if (!task) throw new Error("Task không tồn tại.");

    const { project, membership } =
      await getProjectAccess(ctx, task.projectId, userId);

    if (project.status !== "active") {
      throw new Error("Dự án không còn hoạt động.");
    }

    if (membership.role === "viewer") {
      throw new Error("Viewer không thể thay đổi Task.");
    }

    const isManager =
      membership.role === "owner" ||
      membership.role === "admin";

    const isResponsible =
      task.assigneeId === userId ||
      task.createdBy === userId;

    if (!isManager && !isResponsible) {
      throw new Error("Bạn không được phép thay đổi Task này.");
    }

    if (args.status === "done" && !isManager) {
      throw new Error(
        "Chỉ Owner hoặc Admin được phê duyệt hoàn thành."
      );
    }

    if (
      task.status === "done" &&
      args.status !== "done" &&
      !isManager
    ) {
      throw new Error(
        "Chỉ Owner hoặc Admin được mở lại Task đã hoàn thành."
      );
    }

    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// 4. Xóa Task
export const remove = mutation({
  args: {
    taskId: v.id("projectTasks"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const task = await ctx.db.get(args.taskId);

    if (!task) throw new Error("Task không tồn tại.");

    const { membership } =
      await getProjectAccess(ctx, task.projectId, userId);

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      throw new Error("Chỉ Owner/Admin được xóa Task.");
    }

    await ctx.db.delete(args.taskId);
  },
});
