
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "scan-task-deadlines",
  { minutes: 15 },
  internal.automation.scanDeadlines
);

export default crons;
