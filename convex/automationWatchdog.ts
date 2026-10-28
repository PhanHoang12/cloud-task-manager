
import { internalMutation } from "./_generated/server";

const MINUTE_MS = 60 * 1000;

// Nếu không có heartbeat trong 10 phút,
// coi lượt quét là đã ngừng tiến triển.
const STALE_AFTER_MS = 10 * MINUTE_MS;

// Giới hạn mỗi lần watchdog đọc tối đa 100 run.
const WATCH_LIMIT = 100;

export const checkStaleRuns = internalMutation({
  args: {},

  handler: async (ctx) => {
    const now = Date.now();

    const runs = await ctx.db
      .query("automationRuns")
      .withIndex("by_status_started", (q) =>
        q.eq("status", "running")
      )
      .order("asc")
      .take(WATCH_LIMIT);

    let failed = 0;

    for (const run of runs) {
      // Tương thích dữ liệu cũ chưa có heartbeat.
      const lastActivity =
        run.lastHeartbeatAt ?? run.startedAt;

      const idleTime = now - lastActivity;

      if (idleTime < STALE_AFTER_MS) {
        continue;
      }

      await ctx.db.patch(run._id, {
        status: "failed",
        finishedAt: now,

        errorMessage:
          "Watchdog: Không có heartbeat trong " +
          "ít nhất 10 phút. Lượt quét có thể " +
          "đã bị kẹt hoặc worker không hoàn thành.",
      });

      failed++;

      console.warn("[Automation Watchdog] STALE_RUN", {
        runId: run._id,
        source: run.source,
        lastHeartbeatAt: lastActivity,
        idleMinutes: Math.floor(
          idleTime / MINUTE_MS
        ),
        pagesProcessed: run.pagesProcessed,
      });
    }

    console.log("[Automation Watchdog] Completed", {
      checked: runs.length,
      failed,
      checkedAt: new Date(now).toISOString(),
    });

    return {
      checked: runs.length,
      failed,
    };
  },
});
