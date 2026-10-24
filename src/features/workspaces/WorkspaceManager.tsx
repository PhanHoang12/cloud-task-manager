import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowRight, CheckCircle2, CircleDot, FolderKanban, Layers3,
  Plus, Search, ShieldCheck, Users, X
} 
from "lucide-react"; import "./workspace.css";
import TeamMembersPanel, {MyInvitations,} from "./TeamMembersPanel";
import KanbanBoard from "../kanban/KanbanBoard";

type Modal = "workspace" | "project" | null;
type ProjectStatus = "active" | "completed" | "archived";
const statusLabel: Record<ProjectStatus, string> = {
  active: "Đang hoạt động", completed: "Hoàn thành", archived: "Đã lưu trữ",
};

export default function WorkspaceManager() {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCreateProject = activeWorkspace?.myRole !== "viewer";
  const canManageProject = activeWorkspace?.myRole === "owner" || activeWorkspace?.myRole === "admin";
  const visibleProjects = useMemo(
    () => (projects ?? []).filter((project) =>
      `${project.name} ${project.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    ),
    [projects, search]
  );
  const activeCount = projects?.filter((p) => p.status === "active").length ?? 0;
  const completedCount = projects?.filter((p) => p.status === "completed").length ?? 0;

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
      } else if (modal === "project" && workspaceId) {
        await createProject({ workspaceId, name: name.trim(), description: description.trim() });
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(projectId: Id<"projects">, status: ProjectStatus) {
    try {
      await setProjectStatus({ projectId, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    }
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
          <p className="ws-overline">CLOUDTASK PRO / TEAM WORKSPACE</p>
          <h1>Không gian làm việc</h1>
          <p className="ws-muted">Quản lý các dự án chung với dữ liệu đồng bộ từ Convex Cloud.</p>
        </div>
        <button type="button" className="ws-btn ws-primary" onClick={() => openModal("workspace")}>
          <Plus size={18} /> Workspace mới
        </button>
      </div>
       <MyInvitations />
      {error && !modal && <div className="ws-alert" role="alert">{error} <button type="button" onClick={() => setError("")}>Đóng</button></div>}
      {workspaces === undefined ? (
        <div className="ws-panel ws-empty">Đang tải Workspace từ Convex...</div>
      ) : workspaces.length === 0 ? (
        <div className="ws-panel ws-empty">
          <Layers3 size={38} />
          <h2>Chưa có Workspace</h2>
          <p>Tạo Workspace đầu tiên để quản lý các dự án của nhóm.</p>
          <button className="ws-btn ws-primary" type="button" onClick={() => openModal("workspace")}>Tạo Workspace</button>
        </div>
      ) : (
        <>
          <div className="ws-panel ws-switcher">
            <label htmlFor="workspace-select">Workspace đang chọn</label>
            <select id="workspace-select" value={workspaceId ?? ""} onChange={(e) => {setSelectedId(e.target.value as Id<"workspaces">); setSearch(""); setError("");}}>
              {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
            </select>
            <span className="ws-role"><ShieldCheck size={15} /> Vai trò: {activeWorkspace?.myRole}</span>
          </div>
          <div className="ws-stats">
            <div className="ws-stat"><span><Layers3 size={19}/> Workspace của tôi</span><strong>{workspaces.length}</strong></div>
            <div className="ws-stat"><span><FolderKanban size={19}/> Tổng dự án</span><strong>{projects?.length ?? "—"}</strong></div>
            <div className="ws-stat"><span><CircleDot size={19}/> Đang hoạt động</span><strong>{projects === undefined ? "—" : activeCount}</strong></div>
            <div className="ws-stat"><span><CheckCircle2 size={19}/> Hoàn thành</span><strong>{projects === undefined ? "—" : completedCount}</strong></div>
          </div>
          <section className="ws-panel ws-projects">
            <div className="ws-section-head">
              <div><h2>Dự án trong Workspace</h2><p>Quản lý dự án theo trạng thái và quyền thành viên.</p></div>
              {canCreateProject && <button type="button" className="ws-btn ws-primary" onClick={() => openModal("project")}><Plus size={17}/> Dự án mới</button>}
            </div>
            <div className="ws-search"><Search size={18}/><input aria-label="Tìm dự án" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm dự án theo tên hoặc mô tả..." /></div>
            {projects === undefined ? <div className="ws-empty">Đang tải dự án...</div> : visibleProjects.length === 0 ? (
              <div className="ws-empty"><FolderKanban size={34}/><h3>Không có dự án phù hợp</h3><p>{search ? "Hãy thử từ khóa khác." : "Tạo dự án đầu tiên trong Workspace này."}</p></div>
            ) : (
              <div className="ws-grid">
                {visibleProjects.map((project) => (
                  <article key={project._id} className="ws-project-card">
                    <div className="ws-project-icon"><FolderKanban size={23}/></div>
                    <span className={`ws-status ws-${project.status}`}>{statusLabel[project.status]}</span>
                    <h3>{project.name}</h3>
                    <p>{project.description || "Dự án chưa có mô tả."}</p>
                    <div className="ws-card-foot">
                      {canManageProject ? (
                        <label>Trạng thái
                          <select aria-label={`Trạng thái của ${project.name}`} value={project.status} onChange={(e) => void changeStatus(project._id, e.target.value as ProjectStatus)}>
                            <option value="active">Đang hoạt động</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="archived">Đã lưu trữ</option>
                          </select>
                        </label>
                      ) : <span><Users size={15}/> {activeWorkspace?.myRole}</span>}
                      <button
                        type="button"
                        className="kb-open-project"
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

      {modal && <div className="ws-overlay" onMouseDown={(e) => {if(e.target === e.currentTarget && !busy) setModal(null);}}>
        <form className="ws-dialog" onSubmit={(e) => void submit(e)}>
          <div className="ws-dialog-top"><div><p className="ws-overline">CLOUDTASK PRO</p><h2>{modal === "workspace" ? "Tạo Workspace" : "Tạo dự án"}</h2></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)} disabled={busy}><X size={21}/></button></div>
          <label>{modal === "workspace" ? "Tên Workspace" : "Tên dự án"} *<input autoFocus required minLength={3} maxLength={modal === "workspace" ? 80 : 100} value={name} onChange={(e) => setName(e.target.value)} placeholder={modal === "workspace" ? "Ví dụ: Cloud Computing Team" : "Ví dụ: CloudTask Pro v2"}/></label>
          <label>Mô tả<textarea value={description} maxLength={modal === "workspace" ? 500 : 1000} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Mô tả ngắn gọn mục tiêu..."/></label>
          {error && <p className="ws-form-error" role="alert">{error}</p>}
          <div className="ws-dialog-actions"><button type="button" className="ws-btn ws-secondary" onClick={() => setModal(null)} disabled={busy}>Hủy</button><button className="ws-btn ws-primary" disabled={busy || name.trim().length < 3} type="submit">{busy ? "Đang lưu..." : "Tạo mới"}</button></div>
        </form>
      </div>}
    </div>
  );
}
