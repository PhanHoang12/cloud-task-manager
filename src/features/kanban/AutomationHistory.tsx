
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "./automation-history.css";

type RunStatus = "running" | "completed" | "failed";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(
  startedAt: number,
  finishedAt?: number
) {
  if (finishedAt === undefined) {
    return "—";
  }

  const milliseconds = Math.max(
    0,
    finishedAt - startedAt
  );

  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }

  return `${(milliseconds / 1000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
}

function StatusBadge({
  status,
}: {
  status: RunStatus;
}) {
  const labels: Record<RunStatus, string> = {
    running: "Running",
    completed: "Done",
    failed: "Failed",
  };

  return (
    <span className={`ah-status ah-status--${status}`}>
      {labels[status]}
    </span>
  );
}

export default function AutomationHistory() {
  const result = useQuery(
    api.automationHistory.listRecent,
    {}
  );

  if (result === undefined) {
    return null;
  }

  if (!result.authorized) {
    return null;
  }

  const runs = result.runs;
  const latest = runs[0];

  return (
    <section
      className="ah-card"
      aria-label="Automation history"
    >
      <div className="ah-header">
        <div>
          <span className="ah-eyebrow">
            AUTOMATION / RUN HISTORY
          </span>

          <h3>Automation history</h3>

          <p className="ah-muted">
            The 20 most recent deadline checks across the system.
          </p>
        </div>

        <span className="ah-realtime">
          Live updates
        </span>
      </div>

      {latest && (
        <div className="ah-summary">
          <div>
            <span>Latest run</span>
            <strong>
              {formatDate(latest.startedAt)}
            </strong>
          </div>

          <div>
            <span>Triggered by</span>
            <strong>
              {latest.source === "manual"
                ? "Manual"
                : "Scheduled"}
            </strong>
          </div>

          <div>
            <span>Status</span>
            <StatusBadge status={latest.status} />
          </div>

          <div>
            <span>Tasks checked</span>
            <strong>{latest.tasksScanned}</strong>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="ah-empty">
          No deadline checks have run yet.
        </p>
      ) : (
        <div
          className="ah-table-wrap"
          tabIndex={0}
          aria-label="Deadline automation run history"
        >
          <table className="ah-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Source</th>
                <th>Status</th>
                <th>Trang</th>
                <th>Tasks checked</th>
                <th>Overdue</th>
                <th>New alerts</th>
                <th>Duration</th>
              </tr>
            </thead>

            <tbody>
              {runs.map((run) => (
                <tr key={run._id}>
                  <td>{formatDate(run.startedAt)}</td>

                  <td>
                    {run.source === "manual"
                      ? "Manual"
                      : "Scheduled"}
                  </td>

                  <td>
                    <StatusBadge status={run.status} />
                    {run.errorMessage && (
                      <span
                        className="ah-error"
                        title={run.errorMessage}
                      >
                        Error details available
                      </span>
                    )}
                  </td>

                  <td>{run.pagesProcessed}</td>
                  <td>{run.tasksScanned}</td>
                  <td>{run.overdueTasks}</td>

                  <td>
                    <strong className="ah-created">
                      {run.notificationsCreated}
                    </strong>
                  </td>

                  <td>
                    {formatDuration(
                      run.startedAt,
                      run.finishedAt
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="ah-footnote">
        Admin-only history across the system. Times shown in Vietnam time (UTC+7).
      </p>
    </section>
  );
}
