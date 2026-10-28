
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cron chính: kiểm tra deadline mỗi 15 phút.
crons.interval(
  "scan-task-deadlines",
  { minutes: 15 },
  internal.automation.scanScheduledDeadlines
);

// Watchdog: phát hiện lượt quét bị kẹt.
crons.interval(
  "check-stale-automation-runs",
  { minutes: 5 },
  internal.automationWatchdog.checkStaleRuns
);

export default crons;
