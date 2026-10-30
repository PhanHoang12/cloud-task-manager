
import { useQuery } from "convex/react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
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
        <span role="status">Đang tải tổng quan tiến độ...</span>
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
          {data.tasks.overdue > 0 && <strong>Đã quá hạn: {data.tasks.overdue} công việc. </strong>}
          {data.tasks.upcoming > 0 && <span>Sắp hết hạn: {data.tasks.upcoming} công việc trong vòng 24 giờ. </span>}
          {isIncomplete && <span>Một phần dữ liệu vượt giới hạn thống kê. Số liệu có thể chưa đầy đủ.</span>}
        </div>
        {onReviewTasks && <button type="button" className="ui-button ui-secondary" onClick={onReviewTasks}>Xem bảng công việc</button>}
      </div>, noticeTarget)}
    <section
      className="ad-dashboard"
      aria-label="Tiến độ và nhắc hạn"
    >
      <details className="ad-overview">
        <summary><span>Tiến độ và nhắc hạn</span><ChevronDown size={20} aria-hidden="true" /></summary>
      {/* Header */}
      <div className="ad-header">
        <div>
          <span className="ad-eyebrow">
            THEO DÕI TỰ ĐỘNG
          </span>

          <h3>Tiến độ và nhắc hạn</h3>

          <p>
            Theo dõi hạn hoàn thành, tiến độ và cảnh báo
            của dự án {data.project.name}.
          </p>
        </div>

        <div className="ad-live">
          <span className="ad-live-dot" />
          Cập nhật tự động
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
          subtitle="Công việc trong dự án"
          variant="blue"
        />

        <StatCard
          icon="🚨"
          label="Đã quá hạn"
          value={data.tasks.overdue}
          subtitle="Công việc chưa hoàn thành"
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

      <details className="ad-more">
        <summary>Chi tiết tiến độ và thông báo</summary>
        <div className="ad-details-grid">
          <div className="ad-panel">
            <div className="ad-panel-heading">
              <h4>Tiến độ công việc</h4>
              <span>{completionRate}%</span>
            </div>

            <div
              className="ad-progress"
              role="progressbar"
              aria-label="Tỷ lệ hoàn thành công việc"
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
                <span>Chưa có hạn hoàn thành</span>
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
            Dữ liệu được đồng bộ tự động
          </span>

          <span>
            Cập nhật: {formattedTime}
          </span>
        </div>
        <ScreenErrorBoundary scope="Lịch sử nhắc hạn" resetKey={projectId}><AutomationHistory /></ScreenErrorBoundary>
      </details>
      </details>
    </section>
    </>
  );
}
