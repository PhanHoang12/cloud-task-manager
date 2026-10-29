import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FeedbackProvider, useFeedback } from "../../src/components/Feedback";
import SubtaskPanel from "../../src/features/kanban/SubtaskPanel";
import type { Id } from "../../convex/_generated/dataModel";
import "../../src/style.css";
import "../../src/components/ui.css";
import "../../src/features/kanban/kanban.css";

function Fixture() {
  const { notify } = useFeedback();
  const kind = new URLSearchParams(location.search).get("kind") ?? "success";
  return <main style={{ padding: 16 }}>
    <h1>Kiểm tra thông báo</h1>
    <button className="ui-button ui-secondary" onClick={() => {
      for (let index = 0; index < 4; index++) {
        const error = kind === "error" || (kind === "mixed" && index % 2 === 1);
        notify(error ? `Thông báo lỗi ${index + 1}: vui lòng thử lại.` : `Đã cập nhật công việc ${index + 1}. Nội dung được lưu thành công.`, error ? "error" : "success");
      }
    }}>Hiển thị bốn thông báo</button>
    <div data-testid="task-placement" style={{ position: "fixed", left: 16, top: 140, width: 260 }}>
      <article className="kb-card">
        <h3>Công việc thử nghiệm</h3>
        <SubtaskPanel taskId={"task-fixture" as Id<"projectTasks">} editable />
      </article>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><FeedbackProvider><Fixture /></FeedbackProvider></StrictMode>);
