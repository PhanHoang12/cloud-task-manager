import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Search } from "lucide-react";
import "../../src/style.css";
import "../../src/components/ui.css";
import "../../src/app-layout.css";
import "../../src/features/workspaces/workspace.css";

const params = new URLSearchParams(location.search);
const kind = params.get("kind") ?? "personal";
const whiteSurface = params.get("surface") !== "canvas";
const items = [
  { title: "Báo cáo học kỳ", description: "Tổng hợp tiến độ" },
  { title: "Thiết kế giao diện", description: "Kiểm tra tìm kiếm" },
];
function Fixture() {
  const [search, setSearch] = useState("");
  const visible = items.filter(item => {
    const text = item.title + " " + item.description;
    return kind === "personal"
      ? text.toLowerCase().includes(search.toLowerCase())
      : text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  });
  const input = <input
    aria-label={kind === "personal" ? "Tìm công việc" : "Tìm dự án"}
    placeholder={kind === "personal" ? "Tìm công việc..." : "Tìm dự án theo tên hoặc mô tả..."}
    value={search}
    onChange={event => setSearch(event.target.value)}
  />;
  const controls = <>
    <button type="button" className="ui-button ui-secondary">Trước tìm kiếm</button>
    {kind === "personal"
      ? <label className="search" data-testid="search-wrapper"><Search size={17} />{input}</label>
      : <div className="ws-search" data-testid="search-wrapper"><Search size={18} />{input}</div>}
    <button type="button" className="ui-button ui-secondary">Sau tìm kiếm</button>
  </>;
  return <div className="ctp-shell">
    <aside className="ctp-sidebar"><div className="ctp-brand">CloudTask Pro</div></aside>
    <div className="ctp-right"><div className="ctp-content">
      {kind === "personal"
        ? <section className="personal-dashboard"><main className="main" id="canvas">
            <header className="topbar"><div><h1>Công việc cá nhân</h1><p className="subtitle">Tìm kiếm công việc của bạn.</p></div></header>
            <section className={whiteSurface ? "task-section" : undefined}><div className="toolbar">{controls}</div></section>
          </main></section>
        : <section className="ws-page" id="canvas">
            <header className="ws-heading"><div><h1>Không gian làm việc</h1><p className="ws-muted">Tìm kiếm dự án của nhóm.</p></div></header>
            <section className={whiteSurface ? "ws-panel ws-projects" : undefined}>{controls}</section>
          </section>}
      <ul aria-label="Kết quả tìm kiếm">{visible.map(item => <li key={item.title}>{item.title}</li>)}</ul>
    </div></div>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
