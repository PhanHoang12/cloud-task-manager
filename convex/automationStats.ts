
import { query } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;

// Giới hạn của Dashboard MVP.
// Dữ liệu vượt giới hạn sẽ được đánh dấu incomplete.
const TASK_LIMIT = 200;
const NOTIFICATION_LIMIT = 500;

type DeadlineState =
  | "overdue"
  | "upcoming"
  | "normal"
  | "none";

function deadlineEnd(dueDate: string): number {
  // Deadline kết thúc lúc 00:00 ngày kế tiếp
  // theo múi giờ Việt Nam (UTC+7).
  return Date.parse(
    `${dueDate}T00:00:00+07:00`
  ) + DAY_MS;
}

function getDeadlineState(
  dueDate: string | undefined,
  now: number
): DeadlineState {
  if (!dueDate) {
    return "none";
  }

  const remaining = deadlineEnd(dueDate) - now;

  if (!Number.isFinite(remaining)) {
    return "none";
  }

  if (remaining <= 0) {
    return "overdue";
  }

  if (remaining <= DAY_MS) {
    return "upcoming";
  }

  return "normal";
}

// Dashboard thống kê theo Project.
export const projectOverview = query({
  args: {
    projectId: v.id("projects"),
  },

  handler: async (ctx, { projectId }) => {
    // 1. Xác thực Clerk.
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    // 2. Kiểm tra Project.
    const project = await ctx.db.get(projectId);

    if (!project) {
      throw new Error("Không tìm thấy Project.");
    }

    // 3. Kiểm tra quyền Workspace.
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q
          .eq("workspaceId", project.workspaceId)
          .eq("userId", identity.subject)
      )
      .unique();

    if (!membership) {
      throw new Error(
        "Bạn không có quyền xem thống kê Project."
      );
    }

    const now = Date.now();

    // 4. Đọc tối đa 201 Task để phát hiện
    // Project có vượt giới hạn 200 hay không.
    const taskRows = await ctx.db
      .query("projectTasks")
      .withIndex("by_project", (q) =>
        q.eq("projectId", projectId)
      )
      .take(TASK_LIMIT + 1);

    const tasksIncomplete =
      taskRows.length > TASK_LIMIT;

    const tasks = taskRows.slice(0, TASK_LIMIT);

    let overdue = 0;
    let upcoming = 0;
    let normal = 0;
    let withoutDeadline = 0;
    let completed = 0;

    for (const task of tasks) {
      if (task.status === "done") {
        completed++;
        continue;
      }

      const state = getDeadlineState(
        task.dueDate,
        now
      );

      switch (state) {
        case "overdue":
          overdue++;
          break;

        case "upcoming":
          upcoming++;
          break;

        case "normal":
          normal++;
          break;

        case "none":
          withoutDeadline++;
          break;
      }
    }

    // 5. Đọc notification của riêng Project.
    const notificationRows = await ctx.db
      .query("notifications")
      .withIndex("by_project_created", (q) =>
        q.eq("projectId", projectId)
      )
      .order("desc")
      .take(NOTIFICATION_LIMIT + 1);

    const notificationsIncomplete =
      notificationRows.length >
      NOTIFICATION_LIMIT;

    const notifications = notificationRows.slice(
      0,
      NOTIFICATION_LIMIT
    );

    let notificationsSent = 0;
    let notificationsActive = 0;
    let upcomingAlerts = 0;
    let overdueAlerts = 0;

    for (const notification of notifications) {
      const isUpcoming =
        notification.kind === "deadline_upcoming";

      const isOverdue =
        notification.kind === "deadline_overdue";

      // Không tính comment hoặc assigned
      // vào số liệu automation.
      if (!isUpcoming && !isOverdue) {
        continue;
      }

      notificationsSent++;

      if (notification.isActive !== false) {
        notificationsActive++;
      }

      if (isUpcoming) {
        upcomingAlerts++;
      }

      if (isOverdue) {
        overdueAlerts++;
      }
    }

    return {
      project: {
        id: project._id,
        name: project.name,
        status: project.status,
      },

      tasks: {
        total: tasks.length,
        completed,
        overdue,
        upcoming,
        normal,
        withoutDeadline,
      },

      alerts: {
        sent: notificationsSent,
        active: notificationsActive,
        upcoming: upcomingAlerts,
        overdue: overdueAlerts,
      },

      scope: {
        taskLimit: TASK_LIMIT,
        notificationLimit: NOTIFICATION_LIMIT,
        tasksIncomplete,
        notificationsIncomplete,
      },

      generatedAt: now,
    };
  },
});
