import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowRight, CalendarDays, FolderKanban, Layers3,
  Plus, Search, ShieldCheck, Users, X
} 
from "lucide-react"; import "./workspace.css";
import TeamMembersPanel, {MyInvitations,} from "./TeamMembersPanel";
import KanbanBoard from "../kanban/KanbanBoard";
import WorkspaceOverview, { WorkspaceSummary, projectMonthKey, projectMonthLabel, type StatusFilter } from "./WorkspaceOverview";

import { useAction, useFeedback } from "../../components/Feedback";
import ModalDialog from "../../components/ModalDialog";
import { useAppNavigation, useDraftGuard, useViewState } from "../../components/NavigationExperience";
import ScreenErrorBoundary from "../../components/ScreenErrorBoundary";
import { getErrorMessage, roleLabels } from "../../lib/uiText";
import type { NotificationNavigation } from "../../lib/notificationNavigation";
import PagePhoto from "../../components/PagePhoto";

type Modal = "workspace" | "project" | null;
type ProjectStatus = "active" | "completed" | "archived";
const statusLabel: Record<ProjectStatus, string> = {
  active: "Active", completed: "Done", archived: "Archived",
};

export default function WorkspaceManager({ initialNotification }: { initialNotification?: NotificationNavigation } = {}) {
  const navigation = useAppNavigation();
  const [localNotification, setLocalNotification] = useState(initialNotification);
  const notificationNavigation = navigation ? navigation.route.notification ?? undefined : localNotification;
  const unavailableRef = useRef<HTMLDivElement>(null);
  const { notify } = useFeedback();
  const { run, pending } = useAction();
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspace = useMutation(api.workspaces.create);
  const createProject = useMutation(api.projects.create);
  const setProjectStatus = useMutation(api.projects.setStatus);
  const createdWorkspace = useRef<Id<"workspaces"> | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<Id<"workspaces"> | null>(initialNotification?.workspaceId ?? null);
  const selectedId = navigation ? navigation.route.workspaceId : localSelectedId;
  const activeWorkspace = selectedId ? workspaces?.find(item => item._id === selectedId) : workspaces?.[0];
  const workspaceId = activeWorkspace?._id;
  const adoptWorkspace = navigation?.adoptWorkspace;
  useEffect(() => { if (!selectedId && workspaceId) adoptWorkspace?.(workspaceId); }, [selectedId, workspaceId, adoptWorkspace]);
  const projects = useQuery(api.projects.list, workspaceId ? { workspaceId } : "skip");

  const [localProjectId, setLocalProjectId] = useState<Id<"projects"> | null>(initialNotification?.projectId ?? null);
  const selectedProjectId = navigation ? navigation.route.projectId : localProjectId;
  function selectContext(workspace: Id<"workspaces"> | null, project: Id<"projects"> | null) {
    if (navigation) return navigation.go({ page: "workspace", workspaceId: workspace, projectId: project, notification: null });
    setLocalSelectedId(workspace); setLocalProjectId(project); setLocalNotification(undefined); return true;
  }
  const selectedProject = projects?.find(
  (project) => project._id === selectedProjectId && project.workspaceId === workspaceId);
  const notificationUnavailable = Boolean((selectedId || selectedProjectId) && workspaces !== undefined &&
    (!activeWorkspace || (selectedProjectId && projects !== undefined && !selectedProject)));
  useEffect(() => { if (notificationUnavailable) unavailableRef.current?.focus(); }, [notificationUnavailable]);
  function backToProjects() { selectContext(activeWorkspace?._id ?? null, null); }
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useViewState("workspace:" + workspaceId + ":search", "");
  const [statusFilter, setStatusFilter] = useViewState<StatusFilter>("workspace:" + workspaceId + ":status", "all");
  const [monthFilter, setMonthFilter] = useViewState<string | null>("workspace:" + workspaceId + ":month", null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismissDraft = useDraftGuard(modal !== null && (name !== "" || description !== ""), busy || pending !== null);
  const closeModal = () => dismissDraft(() => setModal(null));
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
        createdWorkspace.current = newId;
      } else if (modal === "project" && workspaceId) {
        await createProject({ workspaceId, name: name.trim(), description: description.trim() });
      }
      notify(modal === "workspace" ? "Workspace created." : "Project created.");
      setModal(null);
    } catch (err) {
      const message = getErrorMessage(err, "Could not save your changes.");
      setError(message); notify(message, "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!busy && !modal && createdWorkspace.current) {
      const id = createdWorkspace.current; createdWorkspace.current = null; selectContext(id, null);
    }
  }, [busy, modal]);

  async function changeStatus(projectId: Id<"projects">, status: ProjectStatus) {
    await run(() => setProjectStatus({ projectId, status }), "Project status updated.", "Could not update the status.", projectId);
  }

  if (notificationUnavailable) return <div className="ws-page"><div ref={unavailableRef} tabIndex={-1} role="alert" className="ws-panel ws-empty">
    <h1>This content is no longer available</h1><p>This item may have been deleted or your access may have changed.</p>
    <button type="button" className="ui-button ui-secondary" onClick={backToProjects}>Back to projects</button>
  </div></div>;
  // The canonical route remounts the view. Expose controls only after the initial
  // workspace has been adopted, so early input cannot target the outgoing view.
  if (navigation && !selectedId && workspaceId) {
    return <div className="ws-page"><p role="status">Opening your workspace...</p></div>;
  }
  if ((selectedId || selectedProjectId) && (workspaces === undefined || (activeWorkspace && selectedProjectId && projects === undefined))) {
    return <div className="ws-page"><p role="status">Opening the linked content…</p></div>;
  }
  if (selectedProject && workspaceId && activeWorkspace) {
  return (
    <ScreenErrorBoundary scope="Task board" resetKey={selectedProject._id} onReturn={backToProjects} returnLabel="Back to projects" allowReload>
    <KanbanBoard key={selectedProject._id}
      project={selectedProject}
      workspaceId={workspaceId}
      role={activeWorkspace.myRole}
      onBack={backToProjects}
      notificationNavigation={notificationNavigation}
    />
    </ScreenErrorBoundary>
  );
}

  return (
    <div className="ws-page">
      <div className="ws-heading photo-heading"><PagePhoto />
        <div>
          <p className="ws-overline">SPACE TO BUILD TOGETHER</p>
          <h1>Workspaces</h1>
        </div>
        <button type="button" className="ws-btn ui-button ui-primary" onClick={() => openModal("workspace")}>
          <Plus size={18} /> New workspace
        </button>
      </div>
      {error && !modal && <div className="ws-alert" role="alert">{error} <button type="button" onClick={() => setError("")}>Close</button></div>}
      {workspaces === undefined ? (
        <div className="ws-panel ws-empty" role="status">Loading workspaces...</div>
      ) : workspaces.length === 0 ? (
        <div className="ws-panel ws-empty">
          <Layers3 size={38} />
          <h2>A fresh start for your team</h2>
          <p>Create a workspace and give your next project a place to grow.</p>
          <button className="ws-btn ui-button ui-primary" type="button" onClick={() => openModal("workspace")}>Create workspace</button>
        </div>
      ) : (
        <>
          <div className="ws-panel ws-switcher">
            <label htmlFor="workspace-select">Current workspace</label>
            <select id="workspace-select" value={workspaceId ?? ""} onChange={(e) => {if (selectContext(e.target.value as Id<"workspaces">, null)) setError("");}}>
              {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
            </select>
            <span className="ws-role"><ShieldCheck size={15} /> Role: {activeWorkspace ? roleLabels[activeWorkspace.myRole] : "Loading..."}</span>
          </div>

          <div className="workspace-stage"><div className="workspace-main">
          <section className="ws-panel ws-projects" aria-busy={projects === undefined}>
            <div className="ws-section-head">
              <div><h2>Projects</h2></div>
              {canCreateProject && <button type="button" className="ws-btn ui-button ui-primary" onClick={() => openModal("project")}><Plus size={17}/> New project</button>}
            </div>
            <div className="ws-search"><Search size={18}/><input aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects by name or description..." /></div>
            {(statusFilter !== "all" || monthFilter || search.trim()) && <div className="ws-filter-summary" role="status">
              <span>{projects === undefined ? "Loading…" : `${visibleProjects.length} / ${projects.length} projects`}</span>
              {statusFilter !== "all" && <span className="ws-filter-chip">{statusLabel[statusFilter]}</span>}
              {monthFilter && <span className="ws-filter-chip">{projectMonthLabel(monthFilter)}</span>}
              <button className="ui-button ui-secondary" type="button" onClick={() => {setStatusFilter("all"); setMonthFilter(null); setSearch("");}}>Clear filters</button>
            </div>}
          <ScreenErrorBoundary scope="Project overview" resetKey={workspaceId}>
            <WorkspaceSummary projects={projects} workspaceCount={workspaces.length} statusFilter={statusFilter} onStatusChange={setStatusFilter} onMonthChange={setMonthFilter} />
          </ScreenErrorBoundary>
            {projects === undefined ? <div className="ws-empty" role="status">Loading projects...</div> : visibleProjects.length === 0 ? (
              <div className="ws-empty"><FolderKanban size={34}/><h3>{projects.length === 0 ? "Room for your next idea" : "No matching projects"}</h3><p>{search.trim() || statusFilter !== "all" || monthFilter ? "Try another search or clear your filters." : "Create the first project in this workspace."}</p></div>
            ) : (
              <div className="ws-grid">
                {visibleProjects.map((project) => (
                  <article key={project._id} className="ws-project-card" aria-busy={pending===project._id}>
                    <div className="ws-project-top"><div className="ws-project-icon"><FolderKanban size={23}/></div>
                    <span className={`ws-status ws-${project.status}`}>{statusLabel[project.status]}</span>
                    </div>
                    <h3>{project.name}</h3>
                    <p>{project.description || "Add a description to give this project a little context."}</p>
                    <div className="ws-project-meta"><CalendarDays size={14}/><span>Created {new Date(project._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                    {pending===project._id && <span className="ui-inline-busy" role="status">Updating...</span>}
                    <div className="ws-card-foot">
                      {canManageProject ? (
                        <label>Status
                          <select disabled={pending!==null} aria-busy={pending===project._id} aria-label={`Status for ${project.name}`} value={project.status} onChange={(e) => void changeStatus(project._id, e.target.value as ProjectStatus)}>
                            <option value="active">Active</option>
                            <option value="completed">Done</option>
                            <option value="archived">Archived</option>
                          </select>
                        </label>
                      ) : <span><Users size={15}/> {activeWorkspace ? roleLabels[activeWorkspace.myRole] : "Loading..."}</span>}
                      <button
                        type="button"
                        className="kb-open-project ui-button ui-secondary"
                        aria-label={`Open project ${project.name}`}
                        onClick={() => selectContext(workspaceId!, project._id)}>
                        Open board <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <ScreenErrorBoundary scope="Project overview" resetKey={workspaceId}>
            <WorkspaceOverview viewKey={workspaceId} projects={projects} workspaceCount={workspaces.length} statusFilter={statusFilter} monthFilter={monthFilter} onStatusChange={setStatusFilter} onMonthChange={setMonthFilter} />
          </ScreenErrorBoundary>
          </div><aside className="workspace-people" aria-label="Workspace people">
          <ScreenErrorBoundary scope="Invitations" resetKey={workspaceId}><MyInvitations /></ScreenErrorBoundary>
           {/* Module 03: Manage members và phân quyền */}
          {workspaceId && activeWorkspace && (
            <ScreenErrorBoundary scope="People" resetKey={workspaceId}>
            <TeamMembersPanel
              key={workspaceId}
              workspaceId={workspaceId}
              myRole={activeWorkspace.myRole}
            />
            </ScreenErrorBoundary>
          )}
          </aside></div>
        </>
      )}

      {workspaces?.length === 0 && <ScreenErrorBoundary scope="Invitations"><MyInvitations /></ScreenErrorBoundary>}

      {modal && <ModalDialog className="ws-overlay" label={modal === "workspace" ? "Create workspace" : "Create project"} busy={busy} onDismiss={closeModal}>
        <form className="ws-dialog" onSubmit={(e) => void submit(e)}>
          <div className="ws-dialog-top"><div><p className="ws-overline">CLOUDTASK PRO</p><h2>{modal === "workspace" ? "Create workspace" : "Create project"}</h2></div><button className="ui-button ui-secondary ui-icon" type="button" aria-label="Close" onClick={closeModal} disabled={busy}><X size={21}/></button></div>
          <label>{modal === "workspace" ? "Workspace name" : "Project name"} *<input disabled={busy} required minLength={3} maxLength={modal === "workspace" ? 80 : 100} value={name} onChange={(e) => setName(e.target.value)} placeholder={modal === "workspace" ? "e.g. Product team" : "e.g. Website launch"}/></label>
          <label>Description<textarea disabled={busy} value={description} maxLength={modal === "workspace" ? 500 : 1000} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What are you working towards?"/></label>
          {error && <p className="ws-form-error" role="alert">{error}</p>}
          <div className="ws-dialog-actions"><button type="button" className="ws-btn ui-button ui-secondary" onClick={closeModal} disabled={busy}>Cancel</button><button className="ws-btn ui-button ui-primary" aria-busy={busy} disabled={busy || name.trim().length < 3} type="submit">{busy ? "Saving..." : "Create"}</button></div>
        </form>
      </ModalDialog>}
    </div>
  );
}
