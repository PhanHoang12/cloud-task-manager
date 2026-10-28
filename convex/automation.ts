
import { internalMutation,internalQuery } from "./_generated/server";
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
/**
 * Nếu cảnh báo đang hoạt động thì bỏ qua.
 *
 * isActive === undefined được coi là active
 * để tương thích bản ghi cũ.
 *
 * Nếu isActive === false:
 * cho phép tạo notification mới.
 */
if (existing && existing.isActive !== false) {
  return false;
}

const isReactivation = existing?.isActive === false;

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
 
if (existing && isReactivation) {
  // Tái kích hoạt bản ghi lịch sử.
  // Không tạo alertKey thứ hai.
  await ctx.db.patch(existing._id, {
    isActive: true,
    invalidatedAt: undefined,
  });

  console.log("[Deadline Alert REACTIVATED]", {
    taskId: task._id,
    recipientId,
    kind,
    dueDate,
  });
} else {
  // Cảnh báo xuất hiện lần đầu.
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
}


  return true;
}


/**
 * Module 06.5.3 — Automation Execution History
 *
 * Một automationRun đại diện cho một lượt quét.
 * Mọi trang của lượt quét đều dùng cùng runId.
 */

type RunSource = "scheduled" | "manual";

async function startDeadlineScan(
  ctx: MutationCtx,
  source: RunSource
): Promise<void> {
  const now = Date.now();

  // Tạo bản ghi lịch sử đầu tiên.
  const runId = await ctx.db.insert("automationRuns", {
    source,
  status: "running",
  startedAt: now,
  lastHeartbeatAt: now,
  pagesProcessed: 0,
  tasksScanned: 0,
  upcomingTasks: 0,
  overdueTasks: 0,
  notificationsCreated: 0,
  skippedTasks: 0,

  });

  // Mỗi worker sẽ nhận cùng một runId.
  await ctx.scheduler.runAfter(
    0,
    internal.automation.scanDeadlinePage,
    {
      runId,
      cursor: null,
      now,
      pageNumber: 1,
    }
  );

  console.log("[Automation] Scan scheduled", {
    runId,
    source,
    executedAt: new Date(now).toISOString(),
  });
}

// Dùng khi bạn chạy lệnh thủ công:
// npx convex run automation:scanDeadlines
export const scanDeadlines = internalMutation({
  args: {},

  handler: async (ctx): Promise<void> => {
    await startDeadlineScan(ctx, "manual");
  },
});

// Entry point dành riêng cho Cron 15 phút.
export const scanScheduledDeadlines = internalMutation({
  args: {},

  handler: async (ctx): Promise<void> => {
    await startDeadlineScan(ctx, "scheduled");
  },
});

/**
 * Worker xử lý từng trang.
 *
 * Trạng thái và bộ đếm được cập nhật trong
 * cùng transaction với cảnh báo của trang đó.
 */
export const scanDeadlinePage = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
    pageNumber: v.number(),
  },

  handler: async (ctx, args): Promise<void> => {
    const { runId, cursor, now, pageNumber } = args;

    const run = await ctx.db.get(runId);

    if (!run || run.status !== "running") {
      console.log("[Automation] Run not active", {
        runId,
      });
      return;
    }

    // Giữ nguyên logic chọn deadline như 06.4.
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

      const kind = classifyDeadline(task.dueDate, now);

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
          runId,
          taskId: task._id,
          recipientId: task.assigneeId,
          kind,
          dueDate: task.dueDate,
        });
      }
    }

    // Cộng dồn số liệu từ tất cả các trang.
    const newTotals = {
      pagesProcessed: run.pagesProcessed + 1,
      tasksScanned:
        run.tasksScanned + result.page.length,
      upcomingTasks: run.upcomingTasks + upcoming,
      overdueTasks: run.overdueTasks + overdue,
      notificationsCreated:
        run.notificationsCreated + created,
      skippedTasks: run.skippedTasks + skipped,
    };

const heartbeatAt = Date.now();

if (result.isDone) {
  // Hoàn thành toàn bộ lượt quét.
  await ctx.db.patch(runId, {
    ...newTotals,
    lastHeartbeatAt: heartbeatAt,
    status: "completed",
    finishedAt: heartbeatAt,
  });
} else {
  // Worker đã hoàn thành một trang.
  await ctx.db.patch(runId, {
    ...newTotals,
    lastHeartbeatAt: heartbeatAt,
  });

  // Tiếp tục trang sau, giữ nguyên runId.
  await ctx.scheduler.runAfter(
    0,
    internal.automation.scanDeadlinePage,
    {
      runId,
      cursor: result.continueCursor,
      now,
      pageNumber: pageNumber + 1,
    }
  );
}


    console.log("[Automation] Page completed", {
      runId,
      pageNumber,
      scanned: result.page.length,
      upcoming,
      overdue,
      notificationsCreated: created,
      skipped,
      completed: result.isDone,
    });

    if (result.isDone) {
      console.log("[Automation] Deadline scan finished", {
        runId,
        ...newTotals,
        completedAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Query nội bộ xem 20 lượt chạy gần nhất.
 * Chưa mở API này trực tiếp cho frontend.
 */
export const recentRuns = internalQuery({
  args: {},

  handler: async (ctx) => {
    return await ctx.db
      .query("automationRuns")
      .withIndex("by_started")
      .order("desc")
      .take(20);
  },
});
