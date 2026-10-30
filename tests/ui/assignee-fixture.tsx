import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import KanbanBoard from "../../src/features/kanban/KanbanBoard";
import { FeedbackProvider } from "../../src/components/Feedback";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import "../../src/style.css";
import "../../src/components/ui.css";

const params = new URLSearchParams(location.search);
const role = (params.get("role") ?? "owner") as "owner" | "admin" | "member" | "viewer";
const project = {
  _id: "project-fixture", _creationTime: Date.now(), workspaceId: "workspace-fixture",
  name: "Dự án kiểm tra người phụ trách", description: "Phân công bằng tên thành viên.",
  status: params.has("inactive") ? "archived" : "active",
} as Doc<"projects">;
createRoot(document.getElementById("root")!).render(<StrictMode><FeedbackProvider>
  <KanbanBoard project={project} workspaceId={"workspace-fixture" as Id<"workspaces">} role={role} onBack={() => {}} />
</FeedbackProvider></StrictMode>);
