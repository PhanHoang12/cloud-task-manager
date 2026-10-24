
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

/**
 * Lấy ngày hiện tại theo giờ Việt Nam.
 * Kết quả: YYYY-MM-DD
 */
function vietnamDate(timestamp: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * Deadline được tính đến hết ngày tại Việt Nam.
 * Ví dụ 2026-10-24 hết hạn lúc
 * 2026-10-25 00:00:00 GMT+7.
 */
function deadlineEnd(date: string): number {
  return (
    Date.parse(`${date}T00:00:00+07:00`) +
    DAY_MS
  );
}

/**
 * Phân loại deadline.
 */
function classifyDeadline(
  dueDate: string,
  now: number
): "overdue" | "upcoming" | "normal" {
  const remaining = deadlineEnd(dueDate) - now;

  if (!Number.isFinite(remaining)) {
    return "normal";
  }

  if (remaining <= 0) {
    return "overdue";
  }

  if (remaining <= DAY_MS) {
    return "upcoming";
  }

  return "normal";
}

/**
 * ENTRY POINT
 * Được Convex Cron Job gọi 15 phút/lần.
 *
 * Chỉ lập lịch quét dữ liệu.
 */
export const scanDeadlines = internalMutation({
  args: {},

  handler: async (ctx): Promise<void> => {
    const now = Date.now();

    // Giới hạn thời điểm kiểm tra cố định
    // cho toàn bộ các trang trong một lần quét.
    await ctx.scheduler.runAfter(
      0,
      internal.automation.scanDeadlinePage,
      {
        cursor: null,
        now,
        pageNumber: 1,
      }
    );

    console.log(
      "[Automation] Deadline scan scheduled",
      new Date(now).toISOString()
    );
  },
});

/**
 * WORKER
 * Xử lý từng trang dữ liệu theo deadline.
 */
export const scanDeadlinePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
    pageNumber: v.number(),
  },

  handler: async (ctx, args): Promise<void> => {
    const { cursor, now, pageNumber } = args;

    // Bao gồm Task có dueDate đến hết ngày mai.
    // Những Task còn hơn 24 giờ sẽ bị loại
    // bởi classifyDeadline().
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
    let skipped = 0;

    for (const task of result.page) {
      // 1. Task đã hoàn thành.
      if (task.status === "done") {
        skipped++;
        continue;
      }

      // 2. Task chưa có deadline hoặc người nhận.
      if (!task.dueDate || !task.assigneeId) {
        skipped++;
        continue;
      }

      // 3. Kiểm tra Project.
      const project = await ctx.db.get(task.projectId);

      if (!project || project.status !== "active") {
        skipped++;
        continue;
      }

      // 4. Phân loại deadline.
      const state = classifyDeadline(task.dueDate, now);

      if (state === "normal") {
        skipped++;
        continue;
      }

      if (state === "upcoming") {
        upcoming++;

        console.log("[Deadline UPCOMING]", {
          taskId: task._id,
          dueDate: task.dueDate,
          assigneeId: task.assigneeId,
        });
      }

      if (state === "overdue") {
        overdue++;

        console.log("[Deadline OVERDUE]", {
          taskId: task._id,
          dueDate: task.dueDate,
          assigneeId: task.assigneeId,
        });
      }
    }

    console.log("[Automation] Page completed", {
      pageNumber,
      scanned: result.page.length,
      upcoming,
      overdue,
      skipped,
      completed: result.isDone,
    });

    // 5. Tiếp tục quét nếu còn dữ liệu.
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
      console.log(
        "[Automation] Deadline scan finished",
        {
          completedAt: new Date().toISOString(),
          pagesProcessed: pageNumber,
        }
      );
    }
  },
});
