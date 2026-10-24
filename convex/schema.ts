
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const workspaceRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer")
);

export default defineSchema({
  // Giữ nguyên dữ liệu công việc cá nhân v1.0
  tasks: defineTable({
    ownerId: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("todo"),
      v.literal("doing"),
      v.literal("done")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    dueDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"]),

  // Không gian làm việc
  workspaces: defineTable({
    name: v.string(),
    description: v.string(),
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Quan hệ thành viên - Workspace
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    role: workspaceRole,
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", [
      "workspaceId",
      "userId",
    ]),

  // Các dự án nằm trong Workspace
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", [
      "workspaceId",
      "status",
    ]),

    workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    invitedBy: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("revoked")),
    createdAt: v.number(),
    expiresAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_email_status", ["email", "status"])
    .index("by_workspace_email", ["workspaceId", "email"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  memberAuditLogs: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.string(),
    targetUserId: v.string(),
    action: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId", "createdAt"]),

});
