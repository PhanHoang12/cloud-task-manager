
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

async function getMembership(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  userId: string
) {
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("userId", userId)
    )
    .unique();

  if (!membership) {
    throw new Error("Bạn không thuộc Workspace này.");
  }

  return membership;
}

// 1. Tạo Project
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    const membership = await getMembership(
      ctx,
      args.workspaceId,
      identity.subject
    );

    if (membership.role === "viewer") {
      throw new Error("Viewer không có quyền tạo Project.");
    }

    const workspace = await ctx.db.get(args.workspaceId);

    if (!workspace) {
      throw new Error("Workspace không tồn tại.");
    }

    const name = args.name.trim();

    if (name.length < 3 || name.length > 100) {
      throw new Error("Tên Project phải dài từ 3 đến 100 ký tự.");
    }

    if (args.description.length > 1000) {
      throw new Error("Mô tả tối đa 1000 ký tự.");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      name,
      description: args.description.trim(),
      status: "active",
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// 2. Danh sách Project trong Workspace
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    await getMembership(
      ctx,
      args.workspaceId,
      identity.subject
    );

    return await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(100);
  },
});

// 3. Thay đổi trạng thái Project
export const setStatus = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
  },

  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    const project = await ctx.db.get(args.projectId);

    if (!project) {
      throw new Error("Project không tồn tại.");
    }

    const membership = await getMembership(
      ctx,
      project.workspaceId,
      identity.subject
    );

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      throw new Error("Bạn không có quyền quản lý Project.");
    }

    await ctx.db.patch(args.projectId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
