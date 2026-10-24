
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
  projectTasks: defineTable({
  projectId: v.id("projects"),

  title: v.string(),
  description: v.string(),

  createdBy: v.string(),
  assigneeId: v.optional(v.string()),

  status: v.union(
    v.literal("todo"),
    v.literal("in_progress"),
    v.literal("review"),
    v.literal("done")
  ),

  priority: v.union(
    v.literal("low"),
    v.literal("medium"),
    v.literal("high"),
    v.literal("urgent")
  ),

  dueDate: v.optional(v.string()),

  position: v.number(),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_project_status", ["projectId", "status"])
  .index("by_assignee", ["assigneeId"])
  .index("by_due_date", ["dueDate"]),

  
projectTaskActivities: defineTable({
  projectId: v.id("projects"),
  taskId: v.id("projectTasks"),
  actorId: v.string(),

  type: v.union(
    v.literal("created"),
    v.literal("updated"),
    v.literal("moved"),
    v.literal("deleted")
  ),

  detail: v.string(),
  createdAt: v.number(),
}).index("by_project_created", [
  "projectId",
  "createdAt"
]),
subtasks: defineTable({
  taskId: v.id("projectTasks"),
  title: v.string(),
  isCompleted: v.boolean(),
  position: v.number(),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_task", ["taskId"]),

  // Add INSIDE defineSchema({ ... }) in convex/schema.ts.
// Keep all existing tables. Make sure defineTable and v are already imported.

taskComments: defineTable({
  taskId: v.id("projectTasks"),
  projectId: v.id("projects"),
  authorId: v.string(),
  content: v.string(),
  createdAt: v.number(),
}).index("by_task_created", ["taskId", "createdAt"]),


notifications: defineTable({
  recipientId: v.string(),
  actorId: v.string(),

  projectId: v.id("projects"),
  taskId: v.id("projectTasks"),
  isActive: v.optional(v.boolean()),
  invalidatedAt: v.optional(v.number()),

  kind: v.union(
    v.literal("comment"),
    v.literal("assigned"),
    v.literal("deadline_upcoming"),
    v.literal("deadline_overdue")
  ),

  message: v.string(),
  isRead: v.boolean(),
  createdAt: v.number(),
})
  .index("by_recipient_created", [
    "recipientId",
    "createdAt",
  ])
  .index("by_task", ["taskId"]),

deadlineAlerts: defineTable({
  alertKey: v.string(),

  taskId: v.id("projectTasks"),
  projectId: v.id("projects"),

  recipientId: v.string(),
  
  isActive: v.optional(v.boolean()),
  invalidatedAt: v.optional(v.number()),


  kind: v.union(
    v.literal("deadline_upcoming"),
    v.literal("deadline_overdue")
  ),

  dueDate: v.string(),
  createdAt: v.number(),
})
  .index("by_alert_key", ["alertKey"])
  .index("by_task", ["taskId"]),


});
