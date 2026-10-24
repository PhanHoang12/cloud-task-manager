
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

type DeadlineKind =
  | "deadline_upcoming"
  | "deadline_overdue";

function vietnamDate(timestamp: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

// Hạn YYYY-MM-DD kết thúc lúc 00:00 ngày tiếp theo,
// theo giờ Việt Nam.
function deadlineEnd(date: string): number {
  return Date.parse(`${date}T00:00:00+07:00`) + DAY_MS;
}

function classifyDeadline(
  dueDate: string,
  now: number
): DeadlineKind | null {
  const remaining = deadlineEnd(dueDate) - now;

  if (!Number.isFinite(remaining)) {
    return null;
  }

  if (remaining <= 0) {
    return "deadline_overdue";
  }

  if (remaining <= DAY_MS) {
    return "deadline_upcoming";
  }

  return null;
}

/**
 * Tạo thông báo deadline nếu chưa từng gửi
 * cho cùng Task + người nhận + loại + ngày hạn.
 *
 * Toàn bộ thao tác chạy trong Convex mutation.
 */
async function createDeadlineAlert(
  ctx: MutationCtx,
  task: Doc<"projectTasks">,
  kind: DeadlineKind,
  now: number
): Promise<boolean> {
  const recipientId = task.assigneeId;
  const dueDate = task.dueDate;

  if (!recipientId || !dueDate) {
    return false;
  }

  if (task.status === "done") {
    return false;
  }

  const project = await ctx.db.get(task.projectId);

  if (!project || project.status !== "active") {
    return false;
  }

  // Không gửi nếu người nhận đã rời Workspace
  // hoặc bị chuyển sang Viewer.
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q
        .eq("workspaceId", project.workspaceId)
        .eq("userId", recipientId)
    )
    .unique();

  if (!membership || membership.role === "viewer") {
    return false;
  }

  const alertKey = [
    task._id,
    recipientId,
    kind,
    dueDate,
  ].join("|");

  const existing = await ctx.db
    .query("deadlineAlerts")
    .withIndex("by_alert_key", (q) =>
      q.eq("alertKey", alertKey)
    )
    .first();

  if (existing) {
    return false;
  }

  const message =
    kind === "deadline_upcoming"
      ? `Công việc "${task.title}" sắp hết hạn (${dueDate}).`
      : `Công việc "${task.title}" đã quá hạn (${dueDate}).`;

  // Tạo thông báo dùng chung NotificationCenter.
  await ctx.db.insert("notifications", {
    recipientId,
    actorId: "system",
    projectId: task.projectId,
    taskId: task._id,
    kind,
    message,
    isRead: false,
    isActive: true,
    createdAt: now,
  });

  // Ghi nhận mốc đã thông báo.
  await ctx.db.insert("deadlineAlerts", {
    alertKey,
    taskId: task._id,
    projectId: task.projectId,
    recipientId,
    kind,
    dueDate,
    isActive: true,
    createdAt: now,
  });

  return true;
}

/**
 * Cron entry point:
 * Chạy mỗi 15 phút.
 */
export const scanDeadlines = internalMutation({
  args: {},

  handler: async (ctx): Promise<void> => {
    const now = Date.now();

    await ctx.scheduler.runAfter(
      0,
      internal.automation.scanDeadlinePage,
      {
        cursor: null,
        now,
        pageNumber: 1,
      }
    );

    console.log("[Automation] Scan scheduled", {
      executedAt: new Date(now).toISOString(),
    });
  },
});

/**
 * Worker:
 * Quét tối đa 100 Task mỗi lần thực thi.
 */
export const scanDeadlinePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
    pageNumber: v.number(),
  },

  handler: async (ctx, args): Promise<void> => {
    const { cursor, now, pageNumber } = args;

    // Chọn rộng hơn 24 giờ để tránh bỏ sót
    // khi lọc theo ngày; classifyDeadline()
    // sẽ quyết định chính xác.
    const upperDate = vietnamDate(now + 2 * DAY_MS);

    const result = await ctx.db
      .query("projectTasks")
      .withIndex("by_due_date", (q) =>
        q
          .gte("dueDate", "0000-01-01")
          .lt("dueDate", upperDate)
      )
      .paginate({
        cursor,
        numItems: PAGE_SIZE,
      });

    let upcoming = 0;
    let overdue = 0;
    let created = 0;
    let skipped = 0;

    for (const task of result.page) {
      if (
        task.status === "done" ||
        !task.dueDate ||
        !task.assigneeId
      ) {
        skipped++;
        continue;
      }

      const kind = classifyDeadline(
        task.dueDate,
        now
      );

      if (!kind) {
        skipped++;
        continue;
      }

      if (kind === "deadline_upcoming") {
        upcoming++;
      } else {
        overdue++;
      }

      const inserted = await createDeadlineAlert(
        ctx,
        task,
        kind,
        now
      );

      if (inserted) {
        created++;

        console.log("[Deadline Alert CREATED]", {
          taskId: task._id,
          recipientId: task.assigneeId,
          kind,
          dueDate: task.dueDate,
        });
      }
    }

    console.log("[Automation] Page completed", {
      pageNumber,
      scanned: result.page.length,
      upcoming,
      overdue,
      notificationsCreated: created,
      skipped,
      completed: result.isDone,
    });

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.automation.scanDeadlinePage,
        {
          cursor: result.continueCursor,
          now,
          pageNumber: pageNumber + 1,
        }
      );
    } else {
      console.log("[Automation] Deadline scan finished", {
        pagesProcessed: pageNumber,
        completedAt: new Date().toISOString(),
      });
    }
  },
});
