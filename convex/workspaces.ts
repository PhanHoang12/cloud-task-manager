
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

async function requireUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Bạn cần đăng nhập.");
  }

  return identity.subject;
}

async function requireMembership(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  userId: string
) {
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .unique();

  if (!membership) {
    throw new Error("Bạn không thuộc Workspace này.");
  }

  return membership;
}

function validateName(name: string) {
  const cleanName = name.trim();

  if (cleanName.length < 3 || cleanName.length > 80) {
    throw new Error("Tên Workspace phải dài từ 3 đến 80 ký tự.");
  }

  return cleanName;
}

// 1. Tạo Workspace
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = validateName(args.name);

    if (args.description.length > 500) {
      throw new Error("Mô tả tối đa 500 ký tự.");
    }

    const now = Date.now();

    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      description: args.description.trim(),
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      joinedAt: now,
    });

    return workspaceId;
  },
});

// 2. Xem danh sách Workspace tham gia
export const list = query({
  args: {},

  handler: async (ctx) => {
    const userId = await requireUser(ctx);

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    const workspaces = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(
          membership.workspaceId
        );

        if (!workspace) return null;

        return {
          ...workspace,
          myRole: membership.role,
        };
      })
    );

    return workspaces.filter(
      (workspace) => workspace !== null
    );
  },
});

// 3. Xem thông tin một Workspace
export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const membership = await requireMembership(
      ctx,
      args.workspaceId,
      userId
    );

    const workspace = await ctx.db.get(args.workspaceId);

    if (!workspace) {
      throw new Error("Workspace không tồn tại.");
    }

    return {
      ...workspace,
      myRole: membership.role,
    };
  },
});

// 4. Đổi thông tin Workspace
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const membership = await requireMembership(
      ctx,
      args.workspaceId,
      userId
    );

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      throw new Error("Bạn không có quyền sửa Workspace.");
    }

    const name = validateName(args.name);

    if (args.description.length > 500) {
      throw new Error("Mô tả tối đa 500 ký tự.");
    }

    await ctx.db.patch(args.workspaceId, {
      name,
      description: args.description.trim(),
      updatedAt: Date.now(),
    });
  },
});

// 5. Xem thành viên trong Workspace
export const listMembers = query({
  args: {
    workspaceId: v.id("workspaces"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    await requireMembership(ctx, args.workspaceId, userId);

    return await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(100);
  },
});
