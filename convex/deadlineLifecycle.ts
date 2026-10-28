
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Thu hồi cảnh báo deadline trong cùng transaction
 * với mutation thay đổi Task.
 *
 * Giữ bản ghi để tra cứu lịch sử.
 * NotificationCenter cần ẩn isActive === false.
 *
 * Dùng index by_task để chỉ tìm thông báo
 * của Task hiện tại.
 */
export async function invalidateTaskDeadlineAlerts(
  ctx: MutationCtx,
  taskId: Id<"projectTasks">
): Promise<void> {
  const now = Date.now();

  // 1. Lấy các cảnh báo deadline của Task
  const alerts = await ctx.db
    .query("deadlineAlerts")
    .withIndex("by_task", (q) =>
      q.eq("taskId", taskId)
    )
    .collect();

  // 2. Lấy các thông báo liên quan đến Task
  const notices = await ctx.db
    .query("notifications")
    .withIndex("by_task", (q) =>
      q.eq("taskId", taskId)
    )
    .collect();

  // 3. Vô hiệu hóa lịch sử cảnh báo
  for (const alert of alerts) {
    if (alert.isActive === false) continue;

    await ctx.db.patch(alert._id, {
      isActive: false,
      invalidatedAt: now,
    });
  }

  // 4. Vô hiệu hóa thông báo deadline
  for (const notice of notices) {
    if (
      (notice.kind !== "deadline_upcoming" &&
        notice.kind !== "deadline_overdue") ||
      notice.isActive === false
    ) {
      continue;
    }

    await ctx.db.patch(notice._id, {
      isActive: false,
      invalidatedAt: now,
    });
  }
}
