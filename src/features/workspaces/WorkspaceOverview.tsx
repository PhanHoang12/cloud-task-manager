import { useMemo, useState, type KeyboardEvent } from "react";
import { Archive, CheckCircle2, CircleDot, FolderKanban, Layers3, PieChart, BarChart3 } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import "./workspace-overview.css";

export type ProjectStatus = Doc<"projects">["status"];
export type StatusFilter = ProjectStatus | "all";
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const percentage = (count: number, total: number) => percentFormatter.format(total ? count / total * 100 : 0);
const monthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" });

export function projectMonthKey(timestamp: number) {
  const parts = monthFormatter.formatToParts(timestamp);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}
export function projectMonthLabel(key: string) {
  const [year, month] = key.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

const statuses = [
  { key: "active", label: "Đang hoạt động", color: "#4f7df3", icon: CircleDot },
  { key: "completed", label: "Hoàn thành", color: "#10b981", icon: CheckCircle2 },
  { key: "archived", label: "Đã lưu trữ", color: "#94a3b8", icon: Archive },
] as const;

type Props = {
  projects: Doc<"projects">[] | undefined;
  workspaceCount: number;
  statusFilter: StatusFilter;
  monthFilter: string | null;
  onStatusChange: (status: StatusFilter) => void;
  onMonthChange: (month: string | null) => void;
};

export default function WorkspaceOverview({ projects, workspaceCount, statusFilter, monthFilter, onStatusChange, onMonthChange }: Props) {
  const [months, setMonths] = useState(6);
  const [hovered, setHovered] = useState<ProjectStatus | null>(null);
  const [focusedMonth, setFocusedMonth] = useState<string | null>(null);
  const loading = projects === undefined;
  const total = projects?.length ?? 0;
  const counts = {
    active: projects?.filter(project => project.status === "active").length ?? 0,
    completed: projects?.filter(project => project.status === "completed").length ?? 0,
    archived: projects?.filter(project => project.status === "archived").length ?? 0,
  };
  const completionRate = percentage(counts.completed, total);
  const currentMonth = projectMonthKey(Date.now());
  const series = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    return Array.from({ length: months }, (_, index) => {
      const date = new Date(Date.UTC(year, month - months + index, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const items = (projects ?? []).filter(project => projectMonthKey(project._creationTime) === key);
      return {
        key, total: items.length,
        counts: { active: items.filter(item => item.status === "active").length, completed: items.filter(item => item.status === "completed").length, archived: items.filter(item => item.status === "archived").length },
      };
    });
  }, [projects, months, currentMonth]);
  const ceiling = Math.max(4, Math.ceil(Math.max(...series.map(month => month.total)) / 4) * 4);
  const periodTotal = series.reduce((sum, month) => sum + month.total, 0);
  const detail = series.find(month => month.key === (focusedMonth ?? monthFilter));
  const highlighted = hovered ?? (statusFilter === "all" ? null : statusFilter);
  let offset = 0;

  function selectStatus(status: ProjectStatus) {
    onStatusChange(statusFilter === status ? "all" : status);
  }
  function activateSegment(event: KeyboardEvent<SVGCircleElement>, status: ProjectStatus) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStatus(status); }
  }

  return <section className="wo-overview" aria-label="Tổng quan Workspace" aria-busy={loading}>
    <div className="wo-metrics">
      <article className="wo-metric wo-violet">
        <span className="wo-metric-icon"><Layers3 size={21} /></span>
        <span className="wo-metric-label">Workspace của tôi</span>
        <strong>{workspaceCount}</strong><small>Không gian bạn có quyền truy cập</small>
      </article>
      <button type="button" className="wo-metric wo-indigo" aria-pressed={statusFilter === "all"} onClick={() => {onStatusChange("all"); onMonthChange(null);}} disabled={loading}>
        <span className="wo-metric-icon"><FolderKanban size={21} /></span>
        <span className="wo-metric-label">Tổng dự án</span>
        <strong>{loading ? "—" : total}</strong><small>Trong Workspace đang chọn</small>
      </button>
      <button type="button" className={`wo-metric wo-blue ${statusFilter === "active" ? "is-selected" : ""}`} aria-pressed={statusFilter === "active"} onClick={() => selectStatus("active")} disabled={loading}>
        <span className="wo-metric-icon"><CircleDot size={21} /></span>
        <span className="wo-metric-label">Đang hoạt động</span>
        <strong>{loading ? "—" : counts.active}</strong><small>{loading ? "Đang tải dữ liệu…" : `${percentage(counts.active, total)}% tổng dự án`}</small>
      </button>
      <button type="button" className={`wo-metric wo-green ${statusFilter === "completed" ? "is-selected" : ""}`} aria-pressed={statusFilter === "completed"} onClick={() => selectStatus("completed")} disabled={loading}>
        <span className="wo-metric-icon"><CheckCircle2 size={21} /></span>
        <span className="wo-metric-label">Đã hoàn thành</span>
        <strong>{loading ? "—" : counts.completed}</strong><small>{loading ? "Đang tải dữ liệu…" : `${completionRate}% tổng dự án`}</small>
      </button>
    </div>

    <div className="wo-charts">
      <article className="wo-chart-card">
        <header className="wo-chart-heading"><div><span className="wo-eyebrow"><PieChart size={14} /> PHÂN BỐ DỰ ÁN</span><h2>Trạng thái dự án</h2><p>Bấm vào biểu đồ hoặc trạng thái để lọc.</p></div></header>
        {loading ? <div className="wo-chart-loading" role="status">Đang tải biểu đồ…</div> : <>
          <div className="wo-donut-layout">
            <div className="wo-donut-wrap">
              <svg className="wo-donut" viewBox="0 0 220 220" aria-label={`Phân bố ${total} dự án theo trạng thái`}>
                <circle cx="110" cy="110" r="78" fill="none" stroke="#eef2f8" strokeWidth="23" />
                {statuses.map(status => {
                  const percent = total ? counts[status.key] / total * 100 : 0;
                  const start = offset;
                  offset += percent;
                  if (!percent) return null;
                  return <circle key={status.key} className="wo-donut-segment" cx="110" cy="110" r="78" fill="none" stroke={status.color} strokeWidth="23" pathLength="100"
                    strokeDasharray={`${percent - Math.min(1.4, percent * .15)} ${100 - percent + Math.min(1.4, percent * .15)}`} strokeDashoffset={-start} transform="rotate(-90 110 110)"
                    opacity={!highlighted || highlighted === status.key ? 1 : .25}
                    role="button" tabIndex={0} aria-pressed={statusFilter === status.key} aria-label={`${status.label}: ${counts[status.key]} dự án, ${percentage(counts[status.key], total)}%. Bấm để lọc.`}
                    onClick={() => selectStatus(status.key)} onKeyDown={event => activateSegment(event, status.key)}
                    onMouseEnter={() => setHovered(status.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(status.key)} onBlur={() => setHovered(null)}>
                    <title>{status.label}: {counts[status.key]} dự án ({percentage(counts[status.key], total)}%)</title>
                  </circle>;
                })}
              </svg>
              <div className="wo-donut-center" aria-hidden="true"><strong>{highlighted ? counts[highlighted] : total}</strong><span>{highlighted ? statuses.find(status => status.key === highlighted)?.label : "Tổng dự án"}</span></div>
            </div>
            <div className="wo-legend">{statuses.map(status => <button type="button" key={status.key} className={`wo-legend-row ${statusFilter === status.key ? "is-selected" : ""}`} aria-pressed={statusFilter === status.key} onClick={() => selectStatus(status.key)}>
              <span className="wo-color-dot" style={{ background: status.color }} /><span>{status.label}</span><strong>{counts[status.key]}</strong><small>{percentage(counts[status.key], total)}%</small>
            </button>)}</div>
          </div>
          <div className="wo-chart-note">{total ? <><span className="wo-color-dot" style={{ background: "#10b981" }} /> {completionRate}% dự án đã hoàn thành</> : "Chưa có dự án. Tạo dự án đầu tiên để bắt đầu theo dõi."}</div>
        </>}
      </article>

      <article className="wo-chart-card">
        <header className="wo-chart-heading"><div><span className="wo-eyebrow"><BarChart3 size={14} /> HOẠT ĐỘNG THEO THÁNG</span><h2>Dự án được tạo</h2><p>Trạng thái hiện tại, nhóm theo tháng tạo.</p></div>
          <select className="wo-range" aria-label="Khoảng thời gian biểu đồ" value={months} onChange={event => {setMonths(Number(event.target.value)); onMonthChange(null);}}><option value={6}>6 tháng gần đây</option><option value={3}>3 tháng gần đây</option></select>
        </header>
        {loading ? <div className="wo-chart-loading" role="status">Đang tải biểu đồ…</div> : <>
          <div className="wo-bars-chart" role="group" aria-label={`Số dự án được tạo trong ${months} tháng gần đây`}>
            <div className="wo-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick => <span key={tick}>{ceiling / 4 * tick}</span>)}</div>
            <div className="wo-bars" style={{ gridTemplateColumns: `repeat(${months}, minmax(0, 1fr))` }}>
              {series.map(month => <button type="button" className={`wo-bar-column ${monthFilter === month.key ? "is-selected" : ""}`} key={month.key}
                aria-pressed={monthFilter === month.key} aria-label={`${projectMonthLabel(month.key)}: ${month.total} dự án. ${statuses.map(status => `${status.label}: ${month.counts[status.key]}`).join(", ")}. Bấm để lọc.`}
                onClick={() => onMonthChange(monthFilter === month.key ? null : month.key)}
                onMouseEnter={() => setFocusedMonth(month.key)} onMouseLeave={() => setFocusedMonth(null)} onFocus={() => setFocusedMonth(month.key)} onBlur={() => setFocusedMonth(null)}>
                <span className="wo-bar-track"><span className="wo-bar-stack" style={{ height: `${month.total / ceiling * 100}%` }}>
                  {month.total > 0 && <span className="wo-bar-value">{month.total}</span>}
                  {statuses.map(status => <span key={status.key} className="wo-bar-segment" style={{ height: `${month.total ? month.counts[status.key] / month.total * 100 : 0}%`, background: status.color, opacity: statusFilter === "all" || statusFilter === status.key ? 1 : .25 }} />)}
                </span>{month.total === 0 && <span className="wo-bar-zero">0</span>}</span>
                <span className="wo-bar-label">T{Number(month.key.slice(5))}<small>{month.key.slice(0, 4)}</small></span>
              </button>)}
            </div>
          </div>
          <div className="wo-bar-detail" aria-live="polite">{detail ? <><strong>{projectMonthLabel(detail.key)} · {detail.total} dự án</strong><span>{statuses.map(status => `${status.label}: ${detail.counts[status.key]}`).join(" · ")}</span></> : <><strong>{periodTotal} dự án trong {months} tháng gần đây</strong><span>Bấm vào cột tháng để lọc danh sách bên dưới.</span></>}</div>
        </>}
      </article>
    </div>
    <p className="wo-scope">Số liệu dự án thuộc Workspace đang chọn · Tự động cập nhật khi dữ liệu thay đổi.</p>
  </section>;
}
