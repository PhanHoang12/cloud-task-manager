import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import WorkspaceOverview, { WorkspaceSummary, type StatusFilter } from "../../src/features/workspaces/WorkspaceOverview";
import "../../src/style.css";
import "../../src/components/ui.css";
import "../../src/app-layout.css";
import "../../src/features/workspaces/workspace.css";
import "../../src/features/kanban/kanban.css";
import "../../src/features/workspaces/members.css";
import "../../src/features/kanban/collaboration.css";

function Fixture() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [month, setMonth] = useState<string | null>(null);
  return <div className="ctp-shell">
    <aside className="ctp-sidebar"><div className="ctp-brand">CloudTask Pro</div></aside>
    <div className="ctp-right"><div className="ctp-content">
      <section id="personal" className="personal-dashboard"><main className="main">
        <header className="topbar"><div><h1>My tasks</h1><p className="subtitle">Tập trung vào những việc quan trọng.</p></div></header>
        <div className="stats"><div className="stat"><span className="stat-title">Total tasks</span><strong>12</strong><span className="stat-foot">Everything on your list</span></div></div>
        <section className="task-section"><div className="section-head"><div><h2>Your task list</h2><p>A little clarity for your everyday work</p></div></div>
          <article className="task"><button className="status-dot" aria-label="Change status">○</button><div className="task-body"><h3>Done báo cáo</h3><p>Description công việc cá nhân cần được đọc rõ ràng.</p></div></article>
        </section>
      </main></section>
      <section id="workspace" className="ws-page">
        <div className="ws-heading"><div><h1>Workspaces</h1><p className="ws-muted">Theo dõi projects, tiến độ và members.</p></div></div>
        <section className="ws-panel ws-projects"><div className="ws-section-head"><div><h2>Projects</h2><p>Find your next focus. Pick a project and get started.</p></div></div>
        <WorkspaceSummary projects={[]} workspaceCount={2} statusFilter={status} onStatusChange={setStatus} onMonthChange={setMonth} />
          <div className="ws-grid"><article className="ws-project-card"><h3>Dự án học kỳ</h3><p>Description projects giúp nhóm hiểu công việc cần hoàn thành.</p><div className="ws-card-foot"><button className="ui-button ui-secondary" type="button">Open project</button></div></article></div>
        </section>
        <WorkspaceOverview projects={[]} workspaceCount={2} statusFilter={status} monthFilter={month} onStatusChange={setStatus} onMonthChange={setMonth} />
        <section id="members" className="tm-panel tm-member-panel"><header className="tm-member-header"><h2>People</h2></header>
          <ul className="tm-member-list"><li className="tm-member-row"><span className="tm-member-avatar" aria-hidden="true">MA</span><div className="tm-member-identity"><strong>Nguyễn Minh Anh</strong><span className="tm-member-email">minhanh@example.com</span></div><div className="tm-member-right"><button className="tm-more" aria-label="Actions for members">⋯</button></div></li></ul>
        </section>
      </section>
      <section id="kanban" className="kb-page"><header className="kb-header"><div className="kb-header-info"><h2>Task board</h2><p>Description projects trên bảng tasks.</p></div></header>
        <div className="kb-columns"><section className="kb-column"><article className="kb-card" draggable>
          <h3>Done bản mẫu</h3><p>Description công việc trong projects.</p><div className="kb-details"><span>Due: 30/10/2026</span><span>Assigned to: Tôi</span></div>
          <label>Status<select defaultValue="todo"><option value="todo">To do</option></select></label>
          <section className="tc-panel"><div className="tc-content"><div className="tc-comment"><div className="tc-comment-body"><div className="tc-meta"><strong className="tc-author">Minh Anh</strong><time className="tc-time">29/10 10:30</time></div><div className="tc-bubble">Cập nhật tiến độ tasks.</div><button type="button" className="tc-delete ui-button ui-danger">Delete</button></div></div></div></section>
        </article></section></div>
      </section>
    </div></div>
  </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
