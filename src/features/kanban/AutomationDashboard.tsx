
import { useQuery } from "convex/react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, CheckCircle2, ChevronDown, Clock3, ListTodo } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import "./automation-dashboard.css";
import AutomationHistory from "./AutomationHistory";
import ScreenErrorBoundary from "../../components/ScreenErrorBoundary";

type Props = {
  projectId: Id<"projects">;
  noticeTarget?: HTMLElement | null;
  onReviewTasks?: () => void;
};

function StatCard({
  icon,
  label,
  value,
  variant = "blue",
  subtitle,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  variant?: "blue" | "red" | "amber" | "green";
  subtitle: string;
}) {
  return (
    <article className={`ad-stat ad-stat--${variant}`}>
      <div className="ad-stat-icon" aria-hidden="true">
        {icon}
      </div>

      <div className="ad-stat-content">
        <span className="ad-stat-label">{label}</span>
        <strong className="ad-stat-value">
          {value.toLocaleString("en-US")}
        </strong>
        <span className="ad-stat-subtitle">
          {subtitle}
        </span>
      </div>
    </article>
  );
}

export default function AutomationDashboard({
  projectId,
  noticeTarget,
  onReviewTasks,
}: Props) {
  const data = useQuery(
    api.automationStats.projectOverview,
    { projectId }
  );

  if (data === undefined) {
    return (
      <section className="ad-dashboard ad-loading" aria-busy="true">
        <div className="ad-spinner" />
        <span role="status">Loading project progress...</span>
      </section>
    );
  }

  const total = data.tasks.total;
  const completed = data.tasks.completed;

  const completionRate =
    total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  const sent = data.alerts.sent;
  const activeAlerts = data.alerts.active;

  const activeAlertRate =
    sent > 0
      ? Math.min(100, Math.round(
          (activeAlerts / sent) * 100
        ))
      : 0;

  const isIncomplete =
    data.scope.tasksIncomplete ||
    data.scope.notificationsIncomplete;

  const formattedTime = new Date(
    data.generatedAt
  ).toLocaleString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
    {/* Keep the existing query and its failure boundary local to analytics.
        The notice is portaled into the board's earlier DOM slot for native Tab order. */}
    {noticeTarget && (data.tasks.overdue > 0 || data.tasks.upcoming > 0 || isIncomplete) && createPortal(
      <div className="ad-deadline-notice" role="status">
        <div>
          {data.tasks.overdue > 0 && <strong>Overdue: {data.tasks.overdue} tasks. </strong>}
          {data.tasks.upcoming > 0 && <span>Due soon: {data.tasks.upcoming} tasks within the next 24 hours. </span>}
          {isIncomplete && <span>Some data exceeds the reporting limit. These totals may be incomplete.</span>}
        </div>
        {onReviewTasks && <button type="button" className="ui-button ui-secondary" onClick={onReviewTasks}>View task board</button>}
      </div>, noticeTarget)}
    <section
      className="ad-dashboard"
      aria-label="Progress & deadlines"
    >
      <details className="ad-overview">
        <summary><span>Progress & deadlines</span><ChevronDown size={20} aria-hidden="true" /></summary>
      {/* Header */}
      <div className="ad-header">
        <div>
          <span className="ad-eyebrow">
            AUTOMATED INSIGHTS
          </span>

          <h3>Progress & deadlines</h3>

          <p>
            Keep an eye on project progress, deadlines, and alerts {data.project.name}.
          </p>
        </div>

        <div className="ad-live">
          <span className="ad-live-dot" />
          Live updates
        </div>
      </div>

      {/* Data completeness warning */}
      {isIncomplete && (
        <div className="ad-warning" role="status">
          Some data exceeds the reporting limit. The totals below may be incomplete.
        </div>
      )}

      {/* KPI cards */}
      <div className="ad-stats-grid">
        <StatCard
          icon={<ListTodo size={21}/>}
          label="Total tasks"
          value={total}
          subtitle="Project tasks"
          variant="blue"
        />

        <StatCard
          icon={<AlertTriangle size={21}/>}
          label="Overdue"
          value={data.tasks.overdue}
          subtitle="Incomplete tasks"
          variant="red"
        />

        <StatCard
          icon={<Clock3 size={21}/>}
          label="Due soon"
          value={data.tasks.upcoming}
          subtitle="Within the next 24 hours"
          variant="amber"
        />

        <StatCard
          icon={<CheckCircle2 size={21}/>}
          label="Completed"
          value={completed}
          subtitle={`${completionRate}% of all tasks`}
          variant="green"
        />
      </div>

      <details className="ad-more">
        <summary>Progress & notification details</summary>
        <div className="ad-details-grid">
          <div className="ad-panel">
            <div className="ad-panel-heading">
              <h4>Task progress</h4>
              <span>{completionRate}%</span>
            </div>

            <div
              className="ad-progress"
              role="progressbar"
              aria-label="Task completion rate"
              aria-valuenow={completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="ad-progress-fill"
                style={{
                  width: `${completionRate}%`,
                }}
              />
            </div>

            <div className="ad-detail-rows">
              <div>
                <span>Completed</span>
                <strong>{completed}</strong>
              </div>

              <div>
                <span>On track</span>
                <strong>{data.tasks.normal}</strong>
              </div>

              <div>
                <span>No deadline</span>
                <strong>
                  {data.tasks.withoutDeadline}
                </strong>
              </div>
            </div>
          </div>

          <div className="ad-panel">
            <div className="ad-panel-heading">
              <h4>Notification activity</h4>
              <Bell size={18} aria-hidden="true"/>
            </div>

            <div className="ad-detail-rows">
              <div>
                <span>Alerts sent</span>
                <strong>{sent}</strong>
              </div>

              <div>
                <span>Still active</span>
                <strong className="ad-number-blue">
                  {activeAlerts}
                </strong>
              </div>

              <div>
                <span>Upcoming deadline alerts</span>
                <strong>{data.alerts.upcoming}</strong>
              </div>

              <div>
                <span>Overdue alerts</span>
                <strong>{data.alerts.overdue}</strong>
              </div>
            </div>

            <div className="ad-alert-progress">
              <div className="ad-alert-label">
                <span>Active alert rate</span>
                <strong>{activeAlertRate}%</strong>
              </div>

              <div className="ad-progress ad-progress-blue">
                <div
                  className="ad-progress-fill"
                  style={{
                    width: `${activeAlertRate}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ad-footer">
          <span>
            <span className="ad-live-dot" />
            Data syncs automatically
          </span>

          <span>
            Updated: {formattedTime}
          </span>
        </div>
        <ScreenErrorBoundary scope="Deadline history" resetKey={projectId}><AutomationHistory /></ScreenErrorBoundary>
      </details>
      </details>
    </section>
    </>
  );
}
