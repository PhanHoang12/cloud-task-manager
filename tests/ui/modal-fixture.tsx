import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import ModalDialog from "../../src/components/ModalDialog";
import "../../src/style.css";
import "../../src/components/ui.css";
import "../../src/features/workspaces/workspace.css";
import "../../src/features/kanban/kanban.css";

declare global {
  interface Window { completeModalSave?: () => void }
}

const params = new URLSearchParams(location.search);
const kind = params.get("kind") ?? "personal";
const styles = {
  personal: { overlay: "overlay", form: "modal" },
  workspace: { overlay: "ws-overlay", form: "ws-dialog" },
  kanban: { overlay: "kb-overlay", form: "kb-dialog" },
}[kind]!;

function Fixture() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);
  const [backgroundActions, setBackgroundActions] = useState(0);
  const [removeOpener, setRemoveOpener] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    window.completeModalSave = () => {
      setBusy(false);
      if (params.has("fail")) {
        setError("Không thể lưu công việc. Vui lòng thử lại.");
      } else {
        if (params.has("removeOpener")) setRemoveOpener(true);
        setSaved(count => count + 1);
        setOpen(false);
      }
    };
  }

  return <main>
    {!removeOpener && <button className="ui-button ui-primary" onClick={() => {
      setTitle(params.has("edit") ? "Công việc hiện tại" : "");
      setError("");
      setOpen(true);
    }}>Mở hộp thoại</button>}
    <button className="ui-button ui-secondary" onClick={() => setBackgroundActions(count => count + 1)}>Thao tác nền</button>
    <output aria-label="Đã lưu">{saved}</output>
    <output aria-label="Thao tác nền đã chạy">{backgroundActions}</output>
    {open && <ModalDialog className={styles.overlay} label="Công việc thử nghiệm" busy={busy} onDismiss={() => setOpen(false)}>
      <form className={styles.form} onSubmit={submit}>
        <h2>Công việc thử nghiệm</h2>
        <button className="ui-button ui-secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Đóng</button>
        <label>Tiêu đề<input required minLength={kind === "personal" ? undefined : 3} maxLength={120} disabled={busy} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Mô tả<textarea maxLength={2000} disabled={busy} /></label>
        <button type="button" hidden>Ẩn</button>
        <button type="button" disabled>Không khả dụng</button>
        {error && <p role="alert">{error}</p>}
        <button className="ui-button ui-secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Hủy</button>
        <button className="ui-button ui-primary" type="submit" disabled={busy}>Lưu</button>
      </form>
    </ModalDialog>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
