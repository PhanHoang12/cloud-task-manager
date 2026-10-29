
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

  return `${(milliseconds / 1000).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
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
      aria-label="Lịch sử nhắc hạn tự động"
    >
      <div className="ah-header">
        <div>
          <span className="ah-eyebrow">
            TỰ ĐỘNG HÓA / LỊCH SỬ THỰC HIỆN
          </span>

          <h3>Lịch sử nhắc hạn tự động</h3>

          <p className="ah-muted">
            Theo dõi 20 lượt kiểm tra hạn hoàn thành gần nhất
            trong toàn hệ thống.
          </p>
        </div>

        <span className="ah-realtime">
          ● Cập nhật tự động
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
                : "Theo lịch"}
            </strong>
          </div>

          <div>
            <span>Trạng thái</span>
            <StatusBadge status={latest.status} />
          </div>

          <div>
            <span>Công việc đã kiểm tra</span>
            <strong>{latest.tasksScanned}</strong>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="ah-empty">
          Chưa có lịch sử nhắc hạn tự động.
        </p>
      ) : (
        <div
          className="ah-table-wrap"
          tabIndex={0}
          aria-label="Bảng lịch sử nhắc hạn tự động"
        >
          <table className="ah-table">
            <thead>
              <tr>
                <th>Thời gian bắt đầu</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Trang</th>
                <th>Công việc đã kiểm tra</th>
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
                      ? "Thủ công"
                      : "Theo lịch"}
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
        Lịch sử dành cho quản trị viên, áp dụng cho toàn hệ thống.
        Thời gian hiển thị theo múi giờ Việt Nam.
      </p>
    </section>
  );
}
