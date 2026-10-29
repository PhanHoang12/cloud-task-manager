import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexError } from "convex/values";
import ScreenErrorBoundary from "../../src/components/ScreenErrorBoundary";
import ModalDialog from "../../src/components/ModalDialog";
import "../../src/style.css";
import "../../src/components/ui.css";
import "../../src/app-layout.css";

declare global {
  interface Window {
    boundaryPrimaryHealthy: boolean;
    boundarySecondaryHealthy: boolean;
    boundaryPrimaryRenders: number;
    boundarySecondaryRenders: number;
    failBoundaryPrimary?: () => void;
  }
}
const mode = new URLSearchParams(location.search).get("mode") ?? "render";
window.boundaryPrimaryHealthy = mode === "healthy" || mode === "secondary";
window.boundarySecondaryHealthy = mode !== "secondary";
window.boundaryPrimaryRenders = 0;
window.boundarySecondaryRenders = 0;

function failure(): unknown {
  const secret = "SECRET_TOKEN user_private_123 db/private.ts Request ID PRIVATE_REQUEST";
  if (mode === "auth-code") return new ConvexError({ code: "UNAUTHENTICATED", detail: secret });
  if (mode === "permission-code") return new ConvexError({ code: "PERMISSION_DENIED", detail: secret });
  if (mode === "auth-status") return Object.assign(new Error(secret), { status: 401 });
  if (mode === "permission-status") return Object.assign(new Error(secret), { status: 403 });
  if (mode === "auth-data") return new ConvexError("Bạn cần đăng nhập. " + secret);
  if (mode === "permission-data") return new ConvexError("Bạn không thuộc Workspace này. " + secret);
  if (mode === "auth-legacy") return new Error("[CONVEX Q(tasks:list)]\nUncaught Error: Bạn cần đăng nhập.\n" + secret);
  if (mode === "permission-legacy") return new Error("[CONVEX Q(projectTasks:list)]\nUncaught Error: Không tìm thấy công việc hoặc không có quyền.\n" + secret);
  if (mode === "auth-claims") return new Error("Clerk phải cung cấp email đã xác minh trong JWT. " + secret);
  if (mode === "opaque") return new Error("Server Error");
  if (mode === "non-error") return secret;
  if (mode === "query") return new Error("[CONVEX Q(tasks:list)] [Request ID: PRIVATE_REQUEST] Server Error\nUncaught Error: " + secret);
  return new Error(secret);
}

function Primary() {
  const [open, setOpen] = useState(false);
  window.boundaryPrimaryRenders++;
  if (!window.boundaryPrimaryHealthy) throw failure();
  return <section>
    <h2>Đã tải màn hình</h2>
    <button type="button" className="ui-button ui-primary" onClick={() => setOpen(true)}>Mở hộp thoại</button>
    {open && <ModalDialog label="Kiểm tra modal" className="overlay" busy={false} onDismiss={() => setOpen(false)}>
      <form className="modal"><label>Tiêu đề<input /></label><button type="button" className="ui-button ui-secondary" onClick={() => setOpen(false)}>Đóng</button></form>
    </ModalDialog>}
  </section>;
}
function Secondary() {
  window.boundarySecondaryRenders++;
  if (!window.boundarySecondaryHealthy) throw new Error("SECRET_TOKEN secondary query failure");
  return <span>Tài khoản hoạt động</span>;
}
function Fixture() {
  const [view, setView] = useState("failed");
  const [workspace, setWorkspace] = useState(1);
  const [note, setNote] = useState("");
  const [count, setCount] = useState(0);
  const [, update] = useState(0);
  window.failBoundaryPrimary = () => {
    window.boundaryPrimaryHealthy = false;
    update(value => value + 1);
  };
  return <div className="ctp-shell">
    <aside className="ctp-sidebar is-expanded"><div className="ctp-brand">CloudTask Pro</div>
      <nav className="ctp-navigation" aria-label="Điều hướng thử nghiệm">
        <button className="ctp-nav-item" onClick={() => setView("safe")}>Trang an toàn</button>
        <button className="ctp-nav-item" onClick={() => setView("failed")}>Mở màn hình lỗi</button>
        <button className="ctp-nav-item" onClick={() => setWorkspace(value => value + 1)}>Đổi không gian</button>
      </nav>
    </aside>
    <div className="ctp-right">
      <header className="ctp-header"><div className="ctp-header-text"><strong>Không gian và dự án</strong></div>
        <div className="ctp-header-account"><ScreenErrorBoundary scope="Tài khoản" resetKey={view} compact allowReload><Secondary /></ScreenErrorBoundary></div>
      </header>
      <main className="ctp-content">
        <section style={{ padding: 20 }}><label>Ghi chú độc lập<input value={note} onChange={event => setNote(event.target.value)} /></label><button className="ui-button ui-secondary" onClick={() => setCount(value => value + 1)}>Thao tác độc lập</button><output aria-label="Số thao tác">{count}</output></section>
        <ScreenErrorBoundary scope="Màn hình thử nghiệm" resetKey={view + ":" + workspace} onReturn={() => setView("safe")} returnLabel="Về trang an toàn" allowReload>
          {view === "safe" ? <h1>Trang an toàn đã mở</h1> : <Primary />}
        </ScreenErrorBoundary>
      </main>
    </div>
  </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
