
import { query } from "./_generated/server";

// Module 06.5.3.2 — Execution History API

export const listRecent = query({
  args: {},

  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    // Chỉ cho phép tài khoản vận hành được cấu hình.
    // Không cấp quyền chỉ dựa trên role Owner trong
    // một Workspace vì đây là dữ liệu toàn hệ thống.
    const adminId =
      process.env.AUTOMATION_HISTORY_ADMIN_ID;

    if (
      !identity ||
      !adminId ||
      identity.subject !== adminId
    ) {
      return {
        authorized: false,
        runs: [],
      };
    }

    const records = await ctx.db
      .query("automationRuns")
      .withIndex("by_started")
      .order("desc")
      .take(20);

    return {
      authorized: true,
      runs: records.map((run) => ({
        _id: run._id,
        source: run.source,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        pagesProcessed: run.pagesProcessed,
        tasksScanned: run.tasksScanned,
        upcomingTasks: run.upcomingTasks,
        overdueTasks: run.overdueTasks,
        notificationsCreated:
          run.notificationsCreated,
        skippedTasks: run.skippedTasks,
        errorMessage: run.errorMessage,
      })),
    };
  },
});
