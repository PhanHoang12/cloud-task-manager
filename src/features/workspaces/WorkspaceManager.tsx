import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowRight, FolderKanban, Layers3,
  Plus, Search, ShieldCheck, Users, X
} 
from "lucide-react"; import "./workspace.css";
import TeamMembersPanel, {MyInvitations,} from "./TeamMembersPanel";
import KanbanBoard from "../kanban/KanbanBoard";
import WorkspaceOverview, { projectMonthKey, projectMonthLabel, type StatusFilter } from "./WorkspaceOverview";

import { useAction, useFeedback } from "../../components/Feedback";
import { getErrorMessage, roleLabels } from "../../lib/uiText";

type Modal = "workspace" | "project" | null;
type ProjectStatus = "active" | "completed" | "archived";
const statusLabel: Record<ProjectStatus, string> = {
  active: "Đang hoạt động", completed: "Hoàn thành", archived: "Đã lưu trữ",
};

export default function WorkspaceManager() {
  const { notify } = useFeedback();
  const { run, pending } = useAction();
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspace = useMutation(api.workspaces.create);
  const createProject = useMutation(api.projects.create);
  const setProjectStatus = useMutation(api.projects.setStatus);
  const [selectedId, setSelectedId] = useState<Id<"workspaces"> | null>(null);
  const activeWorkspace = workspaces?.find((item) => item._id === selectedId) ?? workspaces?.[0];
  const workspaceId = activeWorkspace?._id;
  const projects = useQuery(api.projects.list, workspaceId ? { workspaceId } : "skip");

  const [selectedProjectId, setSelectedProjectId] =
  useState<Id<"projects"> | null>(null);
  const selectedProject = projects?.find(
  (project) => project._id === selectedProjectId);
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCreateProject = activeWorkspace?.myRole !== "viewer";
  const canManageProject = activeWorkspace?.myRole === "owner" || activeWorkspace?.myRole === "admin";
  const visibleProjects = useMemo(
    () => (projects ?? []).filter((project) =>
      `${project.name} ${project.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
      (statusFilter === "all" || project.status === statusFilter) &&
      (!monthFilter || projectMonthKey(project._creationTime) === monthFilter)
    ),
    [projects, search, statusFilter, monthFilter]
  );


  function openModal(kind: Exclude<Modal, null>) {
    setError(""); setName(""); setDescription(""); setModal(kind);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (modal === "workspace") {
        const newId = await createWorkspace({ name: name.trim(), description: description.trim() });
        setSelectedId(newId);
        setStatusFilter("all"); setMonthFilter(null); setSearch("");
      } else if (modal === "project" && workspaceId) {
        await createProject({ workspaceId, name: name.trim(), description: description.trim() });
      }
      notify(modal === "workspace" ? "Đã tạo không gian làm việc." : "Đã tạo dự án.");
      setModal(null);
    } catch (err) {
      const message = getErrorMessage(err, "Không thể lưu dữ liệu.");
      setError(message); notify(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(projectId: Id<"projects">, status: ProjectStatus) {
    await run(() => setProjectStatus({ projectId, status }), "Đã cập nhật trạng thái dự án.", "Không thể cập nhật trạng thái.", projectId);
  }

  if (selectedProject && workspaceId && activeWorkspace) {
  return (
    <KanbanBoard
      project={selectedProject}
      workspaceId={workspaceId}
      role={activeWorkspace.myRole}
      onBack={() => setSelectedProjectId(null)}
    />
  );
}

  return (
    <div className="ws-page">
      <div className="ws-heading">
        <div>
          <p className="ws-overline">LÀM VIỆC NHÓM / TỔNG QUAN</p>
          <h1>Không gian làm việc</h1>
          <p className="ws-muted">Theo dõi dự án, tiến độ và thành viên trong cùng một không gian.</p>
        </div>
        <button type="button" className="ws-btn ui-button ui-primary" onClick={() => openModal("workspace")}>
          <Plus size={18} /> Không gian mới
        </button>
      </div>
      {error && !modal && <div className="ws-alert" role="alert">{error} <button type="button" onClick={() => setError("")}>Đóng</button></div>}
      {workspaces === undefined ? (
        <div className="ws-panel ws-empty">Đang tải không gian làm việc...</div>
      ) : workspaces.length === 0 ? (
        <div className="ws-panel ws-empty">
          <Layers3 size={38} />
          <h2>Chưa có không gian làm việc</h2>
          <p>Tạo không gian làm việc đầu tiên để quản lý các dự án của nhóm.</p>
          <button className="ws-btn ui-button ui-primary" type="button" onClick={() => openModal("workspace")}>Tạo không gian làm việc</button>
        </div>
      ) : (
        <>
          <div className="ws-panel ws-switcher">
            <label htmlFor="workspace-select">Không gian đang chọn</label>
            <select id="workspace-select" value={workspaceId ?? ""} onChange={(e) => {setSelectedId(e.target.value as Id<"workspaces">); setSearch(""); setStatusFilter("all"); setMonthFilter(null); setSelectedProjectId(null); setError("");}}>
              {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
            </select>
            <span className="ws-role"><ShieldCheck size={15} /> Vai trò: {activeWorkspace ? roleLabels[activeWorkspace.myRole] : "Đang tải..."}</span>
          </div>
          <WorkspaceOverview projects={projects} workspaceCount={workspaces.length} statusFilter={statusFilter} monthFilter={monthFilter} onStatusChange={setStatusFilter} onMonthChange={setMonthFilter} />
          <section className="ws-panel ws-projects">
            <div className="ws-section-head">
              <div><h2>Dự án trong không gian</h2><p>Quản lý dự án theo trạng thái và quyền thành viên.</p></div>
              {canCreateProject && <button type="button" className="ws-btn ui-button ui-primary" onClick={() => openModal("project")}><Plus size={17}/> Dự án mới</button>}
            </div>
            <div className="ws-search"><Search size={18}/><input aria-label="Tìm dự án" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm dự án theo tên hoặc mô tả..." /></div>
            {(statusFilter !== "all" || monthFilter || search.trim()) && <div className="ws-filter-summary" role="status">
              <span>{projects === undefined ? "Đang tải…" : `${visibleProjects.length} / ${projects.length} dự án`}</span>
              {statusFilter !== "all" && <span className="ws-filter-chip">{statusLabel[statusFilter]}</span>}
              {monthFilter && <span className="ws-filter-chip">{projectMonthLabel(monthFilter)}</span>}
              <button className="ui-button ui-secondary" type="button" onClick={() => {setStatusFilter("all"); setMonthFilter(null); setSearch("");}}>Xóa bộ lọc</button>
            </div>}
            {projects === undefined ? <div className="ws-empty">Đang tải dự án...</div> : visibleProjects.length === 0 ? (
              <div className="ws-empty"><FolderKanban size={34}/><h3>Không có dự án phù hợp</h3><p>{search.trim() || statusFilter !== "all" || monthFilter ? "Thử từ khóa khác hoặc xóa bộ lọc để xem thêm dự án." : "Tạo dự án đầu tiên trong không gian làm việc này."}</p></div>
            ) : (
              <div className="ws-grid">
                {visibleProjects.map((project) => (
                  <article key={project._id} className="ws-project-card" aria-busy={pending===project._id}>
                    <div className="ws-project-icon"><FolderKanban size={23}/></div>
                    <span className={`ws-status ws-${project.status}`}>{statusLabel[project.status]}</span>
                    <h3>{project.name}</h3>
                    <p>{project.description || "Dự án chưa có mô tả."}</p>
                    {pending===project._id && <span className="ui-inline-busy" role="status">Đang cập nhật...</span>}
                    <div className="ws-card-foot">
                      {canManageProject ? (
                        <label>Trạng thái
                          <select disabled={pending!==null} aria-busy={pending===project._id} aria-label={`Trạng thái của ${project.name}`} value={project.status} onChange={(e) => void changeStatus(project._id, e.target.value as ProjectStatus)}>
                            <option value="active">Đang hoạt động</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="archived">Đã lưu trữ</option>
                          </select>
                        </label>
                      ) : <span><Users size={15}/> {activeWorkspace ? roleLabels[activeWorkspace.myRole] : "Đang tải..."}</span>}
                      <button
                        type="button"
                        className="kb-open-project ui-button ui-secondary ui-icon"
                        aria-label={`Mở dự án ${project.name}`}
                        onClick={() => setSelectedProjectId(project._id)}>
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <MyInvitations />
           {/* Module 03: Quản lý thành viên và phân quyền */}
          {workspaceId && activeWorkspace && (
            <TeamMembersPanel
              key={workspaceId}
              workspaceId={workspaceId}
              myRole={activeWorkspace.myRole}
            />
          )}
        </>
      )}

      {workspaces?.length === 0 && <MyInvitations />}

      {modal && <div className="ws-overlay" onMouseDown={(e) => {if(e.target === e.currentTarget && !busy) setModal(null);}}>
        <form role="dialog" aria-modal="true" aria-label={modal === "workspace" ? "Tạo không gian làm việc" : "Tạo dự án"} className="ws-dialog" onSubmit={(e) => void submit(e)}>
          <div className="ws-dialog-top"><div><p className="ws-overline">CLOUDTASK PRO</p><h2>{modal === "workspace" ? "Tạo không gian làm việc" : "Tạo dự án"}</h2></div><button className="ui-button ui-secondary ui-icon" type="button" aria-label="Đóng" onClick={() => setModal(null)} disabled={busy}><X size={21}/></button></div>
          <label>{modal === "workspace" ? "Tên không gian" : "Tên dự án"} *<input disabled={busy} autoFocus required minLength={3} maxLength={modal === "workspace" ? 80 : 100} value={name} onChange={(e) => setName(e.target.value)} placeholder={modal === "workspace" ? "Ví dụ: Nhóm điện toán đám mây" : "Ví dụ: Ứng dụng quản lý công việc"}/></label>
          <label>Mô tả<textarea disabled={busy} value={description} maxLength={modal === "workspace" ? 500 : 1000} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn gọn mục tiêu..."/></label>
          {error && <p className="ws-form-error" role="alert">{error}</p>}
          <div className="ws-dialog-actions"><button type="button" className="ws-btn ui-button ui-secondary" onClick={() => setModal(null)} disabled={busy}>Hủy</button><button className="ws-btn ui-button ui-primary" aria-busy={busy} disabled={busy || name.trim().length < 3} type="submit">{busy ? "Đang lưu..." : "Tạo mới"}</button></div>
        </form>
      </div>}
    </div>
  );
}
