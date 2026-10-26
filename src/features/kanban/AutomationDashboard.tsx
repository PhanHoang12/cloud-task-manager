
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import "./automation-dashboard.css";
import AutomationHistory from "./AutomationHistory";

type Props = {
  projectId: Id<"projects">;
};

function StatCard({
  icon,
  label,
  value,
  variant = "blue",
  subtitle,
}: {
  icon: string;
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
          {value.toLocaleString("vi-VN")}
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
}: Props) {
  const data = useQuery(
    api.automationStats.projectOverview,
    { projectId }
  );

  if (data === undefined) {
    return (
      <section className="ad-dashboard ad-loading">
        <div className="ad-spinner" />
        <span>Đang tải Automation Dashboard...</span>
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
  ).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <section
      className="ad-dashboard"
      aria-label="Automation Dashboard"
    >
      {/* Header */}
      <div className="ad-header">
        <div>
          <span className="ad-eyebrow">
            CLOUD AUTOMATION / ANALYTICS
          </span>

          <h3>Automation Dashboard</h3>

          <p>
            Theo dõi deadline, tiến độ và cảnh báo
            của dự án {data.project.name}.
          </p>
        </div>

        <div className="ad-live">
          <span className="ad-live-dot" />
          Realtime
        </div>
      </div>

      {/* Data completeness warning */}
      {isIncomplete && (
        <div className="ad-warning" role="status">
          ⚠️ Một phần dữ liệu vượt giới hạn thống kê.
          Các số liệu bên dưới chưa phải tổng đầy đủ.
        </div>
      )}

      {/* KPI cards */}
      <div className="ad-stats-grid">
        <StatCard
          icon="📋"
          label="Tổng công việc"
          value={total}
          subtitle="Task trong dự án"
          variant="blue"
        />

        <StatCard
          icon="🚨"
          label="Đã quá hạn"
          value={data.tasks.overdue}
          subtitle="Task chưa hoàn thành"
          variant="red"
        />

        <StatCard
          icon="⏰"
          label="Sắp hết hạn"
          value={data.tasks.upcoming}
          subtitle="Trong vòng 24 giờ"
          variant="amber"
        />

        <StatCard
          icon="✅"
          label="Đã hoàn thành"
          value={completed}
          subtitle={`${completionRate}% tổng công việc`}
          variant="green"
        />
      </div>

      {/* Detailed statistics */}
      <div className="ad-details-grid">
        <div className="ad-panel">
          <div className="ad-panel-heading">
            <h4>Tiến độ công việc</h4>
            <span>{completionRate}%</span>
          </div>

          <div
            className="ad-progress"
            role="progressbar"
            aria-label="Tỷ lệ hoàn thành Task"
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
              <span>Đã hoàn thành</span>
              <strong>{completed}</strong>
            </div>

            <div>
              <span>Chưa đến hạn</span>
              <strong>{data.tasks.normal}</strong>
            </div>

            <div>
              <span>Chưa đặt deadline</span>
              <strong>
                {data.tasks.withoutDeadline}
              </strong>
            </div>
          </div>
        </div>

        <div className="ad-panel">
          <div className="ad-panel-heading">
            <h4>Thống kê thông báo</h4>
            <span>🔔</span>
          </div>

          <div className="ad-detail-rows">
            <div>
              <span>Cảnh báo đã gửi</span>
              <strong>{sent}</strong>
            </div>

            <div>
              <span>Còn hiệu lực</span>
              <strong className="ad-number-blue">
                {activeAlerts}
              </strong>
            </div>

            <div>
              <span>Thông báo sắp hạn</span>
              <strong>{data.alerts.upcoming}</strong>
            </div>

            <div>
              <span>Thông báo quá hạn</span>
              <strong>{data.alerts.overdue}</strong>
            </div>
          </div>

          <div className="ad-alert-progress">
            <div className="ad-alert-label">
              <span>Tỷ lệ cảnh báo còn hiệu lực</span>
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
          Dữ liệu đồng bộ từ Convex Cloud
        </span>

        <span>
          Cập nhật: {formattedTime}
        </span>
        <AutomationHistory/>
      </div>
    </section>
  );
}
