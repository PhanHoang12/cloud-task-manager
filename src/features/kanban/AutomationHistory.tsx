
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "./automation-history.css";

type RunStatus = "running" | "completed" | "failed";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("vi-VN", {
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

  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function StatusBadge({
  status,
}: {
  status: RunStatus;
}) {
  const labels: Record<RunStatus, string> = {
    running: "Đang chạy",
    completed: "Hoàn thành",
    failed: "Thất bại",
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
    return (
      <section className="ah-card">
        <p>Đang tải lịch sử Automation...</p>
      </section>
    );
  }

  if (!result.authorized) {
    return (
      <section className="ah-card">
        <h3>Lịch sử chạy Automation</h3>
        <p className="ah-muted">
          Chỉ tài khoản quản trị Automation
          được phép xem lịch sử Cron toàn hệ thống.
        </p>
      </section>
    );
  }

  const runs = result.runs;
  const latest = runs[0];

  return (
    <section
      className="ah-card"
      aria-label="Lịch sử chạy Automation"
    >
      <div className="ah-header">
        <div>
          <span className="ah-eyebrow">
            AUTOMATION / EXECUTION HISTORY
          </span>

          <h3>Lịch sử chạy Automation</h3>

          <p className="ah-muted">
            Theo dõi 20 lượt quét deadline gần nhất
            trên Convex Cloud.
          </p>
        </div>

        <span className="ah-realtime">
          ● Realtime
        </span>
      </div>

      {latest && (
        <div className="ah-summary">
          <div>
            <span>Lần chạy gần nhất</span>
            <strong>
              {formatDate(latest.startedAt)}
            </strong>
          </div>

          <div>
            <span>Nguồn thực thi</span>
            <strong>
              {latest.source === "manual"
                ? "Thủ công"
                : "Cron tự động"}
            </strong>
          </div>

          <div>
            <span>Trạng thái</span>
            <StatusBadge status={latest.status} />
          </div>

          <div>
            <span>Task đã quét</span>
            <strong>{latest.tasksScanned}</strong>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="ah-empty">
          Chưa có lịch sử chạy Automation.
        </p>
      ) : (
        <div
          className="ah-table-wrap"
          tabIndex={0}
          aria-label="Bảng lịch sử chạy Cron"
        >
          <table className="ah-table">
            <thead>
              <tr>
                <th>Thời gian bắt đầu</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Trang</th>
                <th>Task quét</th>
                <th>Quá hạn</th>
                <th>Cảnh báo mới</th>
                <th>Thời lượng</th>
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
                        Có chi tiết lỗi
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
        Lịch sử này áp dụng cho toàn hệ thống,
        không chỉ Project đang mở. Trạng thái
        "Đang chạy" có thể kéo dài nếu worker bị lỗi;
        chức năng tự động phát hiện lượt chạy thất bại
        sẽ được bổ sung riêng.
      </p>
    </section>
  );
}
