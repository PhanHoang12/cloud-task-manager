import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
async function access(ctx: Ctx, taskId: Id<"projectTasks">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error("Không tìm thấy công việc.");
  const project = await ctx.db.get(task.projectId);
  if (!project) throw new Error("Không tìm thấy dự án.");
  const membership = await ctx.db.query("workspaceMembers")
    .withIndex("by_workspace_user", q => q.eq("workspaceId", project.workspaceId).eq("userId", identity.subject)).unique();
  if (!membership) throw new Error("Bạn không thuộc Workspace.");
  return { userId: identity.subject, task, project, membership };
}

export const list = query({
  args: { taskId: v.id("projectTasks") },
  handler: async (ctx, { taskId }) => {
    await access(ctx, taskId);
    return await ctx.db.query("taskComments")
      .withIndex("by_task_created", q => q.eq("taskId", taskId))
      .order("asc").take(100);
  },
});

export const create = mutation({
  args: { taskId: v.id("projectTasks"), content: v.string() },
  handler: async (ctx, { taskId, content }) => {
    const { userId, task, project, membership } = await access(ctx, taskId);
    if (membership.role === "viewer") throw new Error("Viewer không có quyền bình luận.");
    if (project.status !== "active") throw new Error("Dự án không hoạt động.");
    const text = content.trim();
    if (!text || text.length > 2000) throw new Error("Bình luận cần từ 1–2000 ký tự.");
    const now = Date.now();
    const commentId = await ctx.db.insert("taskComments", {
      taskId, projectId: task.projectId, authorId: userId, content: text, createdAt: now,
    });
    // Notify assignee and creator, but never notify the commenter themself.
    const recipients = [...new Set([task.assigneeId, task.createdBy].filter((id): id is string => !!id && id !== userId))];
    for (const recipientId of recipients) {
      const recipient = await ctx.db.query("workspaceMembers")
        .withIndex("by_workspace_user", q => q.eq("workspaceId", project.workspaceId).eq("userId", recipientId)).unique();
      if (recipient) await ctx.db.insert("notifications", {
        recipientId, actorId: userId, projectId: task.projectId, taskId, kind: "comment",
        message: `Có bình luận mới trong: ${task.title.slice(0, 100)}`,
        isRead: false, createdAt: now,
      });
    }
    return commentId;
  },
});


export const remove = mutation({
  args: {
    commentId: v.id("taskComments"),
  },

  handler: async (ctx, { commentId }) => {
    const comment = await ctx.db.get(commentId);

    if (!comment) {
      throw new Error("Bình luận không tồn tại.");
    }

    const { userId, project, membership } = await access(
      ctx,
      comment.taskId
    );

    // Project không hoạt động thì không được xóa comment.
    if (project.status !== "active") {
      throw new Error(
        "Không thể xóa bình luận trong dự án đã ngừng hoạt động."
      );
    }

    // Viewer chỉ có quyền đọc.
    if (membership.role === "viewer") {
      throw new Error("Viewer không có quyền xóa bình luận.");
    }

    // Chỉ tác giả hoặc Owner/Admin được xóa.
    const isManager =
      membership.role === "owner" ||
      membership.role === "admin";

    if (userId !== comment.authorId && !isManager) {
      throw new Error("Không có quyền xóa bình luận.");
    }

    await ctx.db.delete(commentId);
  },
});
