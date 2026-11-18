import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/react";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleDashed, Clock3, Eye, GripVertical, History, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import "./kanban.css";
import SubtaskPanel from "./SubtaskPanel";
import TaskComments from "./TaskComments";
import AutomationDashboard from "./AutomationDashboard";


import { useAction, useFeedback } from "../../components/Feedback";
import ModalDialog from "../../components/ModalDialog";
import { useDraftGuard, useViewState } from "../../components/NavigationExperience";
import ScreenErrorBoundary from "../../components/ScreenErrorBoundary";
import { activityLabels, formatActivityDetail, formatDueDate, getErrorMessage } from "../../lib/uiText";
import { buildAssigneeLabels, getAssigneeLabel } from "../../lib/assignees";
import { buildCommentAuthorNames } from "../../lib/commentAuthors";
import type { NotificationNavigation } from "../../lib/notificationNavigation";
import PagePhoto from "../../components/PagePhoto";

type Task = Doc<"projectTasks">;
type Status = Task["status"];
type Priority = Task["priority"];
type Role = "owner" | "admin" | "member" | "viewer";
const lanes: { key: Status; title: string }[] = [
  { key: "todo", title: "To do" },
  { key: "in_progress", title: "In progress" },
  { key: "review", title: "In review" },
  { key: "done", title: "Done" },
];
const priorityLabel: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};
const laneIcons = { todo: CircleDashed, in_progress: Clock3, review: Eye, done: CheckCircle2 };

export default function KanbanBoard({ project, workspaceId, role, onBack, notificationNavigation }: {
  project: Doc<"projects">;
  workspaceId: Id<"workspaces">;
  role: Role;
  onBack: () => void;
  notificationNavigation?: NotificationNavigation;
}) {
  const { user } = useUser();
  const linkedTaskRef = useRef<HTMLElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [deadlineNoticeTarget, setDeadlineNoticeTarget] = useState<HTMLDivElement | null>(null);
  const linkedHeadingRef = useRef<HTMLHeadingElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const handledNavigation = useRef<NotificationNavigation["requestId"] | null>(null);
  const [unavailableRequest, setUnavailableRequest] = useState<NotificationNavigation["requestId"] | null>(null);
  const linkedTaskUnavailable = notificationNavigation !== undefined && unavailableRequest === notificationNavigation.requestId;
  const { notify, confirm } = useFeedback();
  const { run, pending } = useAction();
  const tasks = useQuery(api.projectTasks.list, { projectId: project._id });
  const members = useQuery(api.members.list, { workspaceId });
  const viewerProfile = useQuery(api.profiles.me);
  const commentAuthorNames = useMemo(() => buildCommentAuthorNames(members, viewerProfile ? {
    id: viewerProfile.clerk.id,
    profile: viewerProfile.profile ? { fullName: viewerProfile.profile.fullName, accountName: viewerProfile.profile.accountName } : null,
  } : undefined), [members, viewerProfile]);
  const assigneeLabels = useMemo(() => buildAssigneeLabels(members ?? [], { id: user?.id, fullName: user?.fullName }), [members, user?.id, user?.fullName]);
  const assigneeLabel = (id?: string) => getAssigneeLabel(id, assigneeLabels, members !== undefined, { id: user?.id, fullName: user?.fullName });
  const create = useMutation(api.projectTasks.create);
  const setStatus = useMutation(api.projectTasks.setStatus);
  const remove = useMutation(api.projectTasks.remove);
  const update = useMutation(api.projectTasks.update);
  const moveTask = useMutation(api.projectTasks.move);
  const activities = useQuery(api.projectTasks.activities, { projectId: project._id });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<Id<"projectTasks"> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useViewState("project:" + project._id + ":search", "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formSnapshot = { title, description, priority, dueDate, assigneeId };
  const baseline = editingTask ? { title: editingTask.title, description: editingTask.description, priority: editingTask.priority, dueDate: editingTask.dueDate ?? "", assigneeId: editingTask.assigneeId ?? "" } : { title: "", description: "", priority: "medium", dueDate: "", assigneeId: "" };
  const dismissDraft = useDraftGuard(showModal && JSON.stringify(formSnapshot) !== JSON.stringify(baseline), busy || pending !== null);
  const closeTask = () => dismissDraft(() => setShowModal(false));
  const previousNotification = useRef(notificationNavigation?.requestId);
  useEffect(() => {
    if (previousNotification.current === notificationNavigation?.requestId) return;
    previousNotification.current = notificationNavigation?.requestId;
    setShowModal(false);
  }, [notificationNavigation?.requestId]);
  const isManager = role === "owner" || role === "admin";
  const active = project.status === "active";
  const canCreate = active && role !== "viewer";
  const visible = useMemo(() => (tasks ?? [])
    .filter(t => `${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position), [tasks, search]);

  useEffect(() => {
    if (!notificationNavigation || handledNavigation.current === notificationNavigation.requestId ||
      (notificationNavigation.taskId && tasks === undefined)) return;
    if (notificationNavigation.taskId && !tasks?.some(task => task._id === notificationNavigation.taskId)) {
      handledNavigation.current = notificationNavigation.requestId;
      setUnavailableRequest(notificationNavigation.requestId);
      return;
    }
    if (search) { setSearch(""); return; }
    const element = notificationNavigation.taskId ? linkedTaskRef.current : linkedHeadingRef.current;
    if (element) {
      handledNavigation.current = notificationNavigation.requestId;
      element.scrollIntoView({ block: "center", inline: "center" });
      element.focus({ preventScroll: true });
    }
  }, [notificationNavigation, tasks, search]);
  useEffect(() => {
    if (linkedTaskUnavailable) unavailableRef.current?.focus();
  }, [linkedTaskUnavailable]);

  const canChange = (task: Task, target: Status) => {
    if (!active || role === "viewer") return false;
    if (!isManager && task.assigneeId !== user?.id && task.createdBy !== user?.id) return false;
    if (!isManager && (target === "done" || task.status === "done")) return false;
    return true;
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !canCreate) return;
    setBusy(true); setError("");
    try {
      if (editingTask) {
        await update({taskId: editingTask._id, title: title.trim(), description: description.trim(), priority,
          dueDate: dueDate || undefined, assigneeId: assigneeId || undefined });
      } else {
        await create({ projectId: project._id, title: title.trim(), description: description.trim(), priority,
          dueDate: dueDate || undefined, assigneeId: assigneeId || undefined });
      }
      notify(editingTask ? "Task changes saved." : "Task created.");
      setTitle(""); setDescription(""); setDueDate("");
      setAssigneeId(""); setPriority("medium"); setEditingTask(null); setShowModal(false);
    } catch (e) { const message = getErrorMessage(e, "Could not save the task."); setError(message); notify(message, "error"); }
    finally { setBusy(false); }
  }

  function openCreate() {
    setEditingTask(null); setTitle(""); setDescription(""); setDueDate("");
    setPriority("medium"); setAssigneeId(""); setError(""); setShowModal(true);
  }
  function openEdit(task: Task) {
    if (!canChange(task, task.status)) return;
    setEditingTask(task); setTitle(task.title); setDescription(task.description);
    setDueDate(task.dueDate ?? ""); setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? ""); setError(""); setShowModal(true);
  }
  async function dropTask(targetStatus: Status, beforeTaskId?: Id<"projectTasks">) {
    if (!dragId || pending) return;
    const task = tasks?.find(t => t._id === dragId);
    setDragId(null);
    if (!task || !canChange(task, targetStatus) || !active) return;
    await run(() => moveTask({ taskId: task._id, targetStatus, beforeTaskId }), "Task moved.", "Could not move the task.", `move:${task._id}`);
  }

  async function move(task: Task, status: Status) {
    if (!canChange(task, status)) return;
    await run(() => setStatus({ taskId: task._id, status }), "Status updated.", "Could not change the status.", `move:${task._id}`);
  }

  async function deleteTask(task: Task) {
    if (pending || !await confirm({ title: "Delete task?", description: `Task “${task.title}” and its related data will be deleted. This cannot be undone.` })) return;
    await run(() => remove({ taskId: task._id }), "Task deleted.", "Could not delete the task.", `delete:${task._id}`);
  }

  
return (
  <div className="kb-page">
    <button
      type="button"
      className="kb-back"
      onClick={onBack}
    >
      <ArrowLeft size={16}/> Back to projects
    </button>

    <header className="kb-header photo-heading"><PagePhoto />
      <div className="kb-header-info">
        <p className="kb-caption">
          KANBAN
        </p>

        <h2 ref={linkedHeadingRef} tabIndex={notificationNavigation ? -1 : undefined} className={notificationNavigation ? "kb-notification-heading" : undefined}>{project.name}</h2>

        <p>
          {project.description ||
            "Bring every part of your project into focus."}
        </p>
      </div>

      <div className="kb-header-actions">

        {canCreate && (
          <button
            type="button"
            className="kb-primary ui-button ui-primary"
            onClick={openCreate}
          >
            <Plus size={17}/> New task
          </button>
        )}
      </div>
    </header>
    <div className="kb-deadline-notices" ref={setDeadlineNoticeTarget} />
    {linkedTaskUnavailable && <div ref={unavailableRef} tabIndex={-1} className="kb-warning" role="alert">The linked task is no longer available. You can still browse the other tasks in this project.</div>}
    {!active && <div className="kb-warning">This project is read-only because it is not active.</div>}
    {error && <div role="alert" className="kb-error">{error} <button onClick={() => setError("")}>Close</button></div>}
    <div className="kb-control-bar"><label className="kb-search-field"><Search size={17}/><input className="kb-search" aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="ui-button ui-secondary" type="button" aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}><History size={16}/>{showHistory ? "Hide activity" : "View activity"}</button></div>
    <p className="kb-board-hint">Drag a card to move it, or choose its status.</p>
    {tasks === undefined && <p className="kb-muted" role="status">Loading project tasks...</p>}
    <div ref={columnsRef} className="kb-columns" aria-busy={tasks === undefined} role="region" aria-label="Task board, scroll horizontally to explore columns" tabIndex={0}>
      {lanes.map(lane => <section key={lane.key} className={`kb-column kb-${lane.key}`}
        onDragOver={e => {if (dragId) e.preventDefault();}}
        onDrop={e => { e.preventDefault(); void dropTask(lane.key); }}>
        <div className="kb-column-title"><strong>{(() => { const Icon = laneIcons[lane.key]; return <Icon size={16}/>; })()}{lane.title}</strong><span>{tasks === undefined ? "…" : visible.filter(t => t.status === lane.key).length}</span></div>
        {tasks === undefined ? <p className="kb-muted" aria-hidden="true">Loading...</p> :
          visible.filter(t => t.status === lane.key).map(task => <article className="kb-card" key={task._id}
            ref={task._id === notificationNavigation?.taskId ? linkedTaskRef : undefined}
            tabIndex={task._id === notificationNavigation?.taskId ? -1 : undefined}
            data-notification-target={task._id === notificationNavigation?.taskId ? "true" : undefined}
            aria-label={task._id === notificationNavigation?.taskId ? `Task: ${task.title}` : undefined}
            aria-busy={pending===`move:${task._id}` || pending===`delete:${task._id}`}
            draggable={!pending && canChange(task, task.status)}
            onDragStart={e => {e.dataTransfer.effectAllowed = "move"; setDragId(task._id);}}
            onDragEnd={() => setDragId(null)}
            onDragOver={e => {if (dragId && dragId !== task._id) e.preventDefault();}}
            onDrop={e => {e.stopPropagation(); e.preventDefault(); void dropTask(lane.key, task._id);}}>
            <div className="kb-card-top"><div className="kb-card-label">{canChange(task, task.status) && <GripVertical className="kb-drag-hint" size={14} aria-hidden="true"/>}<span className={`kb-priority kb-${task.priority}`}>{priorityLabel[task.priority]}</span></div>
              <div className="kb-card-actions">{canChange(task, task.status) && <button type="button" aria-label="Edit" title="Edit task" className="kb-edit ui-button ui-secondary ui-icon" disabled={pending!==null} onClick={() => openEdit(task)}><Pencil size={15}/></button>}
              {isManager && active && <button className="ui-button ui-danger ui-icon" disabled={pending!==null} aria-busy={pending===`delete:${task._id}`} type="button" onClick={() => void deleteTask(task)} aria-label={`Delete ${task.title}`}><Trash2 size={15}/></button>}</div></div>
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
            <div className="kb-details">{task.dueDate && <span><CalendarDays size={14}/>Due: {formatDueDate(task.dueDate)}</span>}
              <span><UserRound size={14}/>{task.assigneeId ? `Assigned to: ${assigneeLabel(task.assigneeId)}` : "Unassigned"}</span></div>
              <label>
                Status
                <select
                  value={task.status}
                  disabled={pending!==null || !canChange(task, task.status)}
                  onChange={(e) =>
                    void move(task, e.target.value as Status)
                  }
                >
                  {lanes.map((s) => (
                    <option
                      key={s.key}
                      value={s.key}
                      disabled={!canChange(task, s.key)}
                    >
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            {(pending===`move:${task._id}` || pending===`delete:${task._id}`) && <span className="ui-inline-busy" role="status">Working...</span>}
            {/* Module 04.4 — Subtasks & Progress Tracking */}
            <ScreenErrorBoundary scope="Subtasks" resetKey={task._id} compact>
            <SubtaskPanel
              compact
              taskId={task._id}
              editable={canChange(task, task.status)}/>
            </ScreenErrorBoundary>
            <ScreenErrorBoundary scope="Discussion" resetKey={task._id} compact>
              <TaskComments
            authorNames={commentAuthorNames}
            taskId={task._id}
            canComment={active && role !== "viewer"}
            canModerate={isManager}/>
            </ScreenErrorBoundary>
            </article>)}

        {tasks !== undefined && !visible.some(t => t.status === lane.key) && <p className="kb-muted">No tasks yet</p>}
      </section>)}
    </div>
    <ScreenErrorBoundary scope="Progress & deadlines" resetKey={project._id}>
      <AutomationDashboard projectId={project._id} noticeTarget={deadlineNoticeTarget}
        onReviewTasks={() => { setSearch(""); columnsRef.current?.focus(); columnsRef.current?.scrollIntoView({ block: "nearest" }); }} />
    </ScreenErrorBoundary>
    {showHistory && <section className="kb-history"><h3>Project activity</h3>
      {activities === undefined ? <p role="status">Loading activity...</p> : activities.length === 0 ? <p>No changes yet.</p> :
        <ul>{activities.map(a => <li key={a._id}><strong>{activityLabels[a.type]}</strong> — {formatActivityDetail(a.type, a.detail)}
          <small> • {new Date(a.createdAt).toLocaleString("en-US")} • {a.actorId.slice(-8)}</small></li>)}</ul>}
    </section>}
    {showModal && <ModalDialog className="kb-overlay" label={editingTask ? "Edit task" : "Create task"} busy={busy} onDismiss={closeTask}>
      <form className="kb-dialog" onSubmit={e => void submit(e)}>
        <div className="kb-dialog-head"><h3>{editingTask ? "Edit task" : "Create a task"}</h3><button className="ui-button ui-secondary ui-icon" aria-label="Close" type="button" onClick={closeTask} disabled={busy}>×</button></div>
        <label>Title *<input disabled={busy} required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Description<textarea disabled={busy} rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="kb-form-row"><label>Priority<select disabled={busy} value={priority} onChange={e => setPriority(e.target.value as Priority)}>
          {Object.entries(priorityLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Due date<input disabled={busy} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label></div>
        <label>Assignee<select aria-busy={members === undefined} disabled={busy || (!!editingTask && !isManager)} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {assigneeId && !members?.some(m => m.userId === assigneeId && m.role !== "viewer") &&
            <option value={assigneeId} disabled>{assigneeLabel(assigneeId)} · Not available for a new assignment</option>}
          {members?.filter(m => m.role !== "viewer").map(m => <option key={m._id} value={m.userId}>{assigneeLabel(m.userId)}</option>)}
        </select>{members === undefined && <span role="status">Loading members…</span>}</label>
        {error && <p role="alert" className="kb-error">{error}</p>}
        <div className="kb-actions"><button className="ui-button ui-secondary" type="button" disabled={busy} onClick={closeTask}>Cancel</button>
          <button className="ui-button ui-primary" aria-busy={busy} type="submit" disabled={busy || title.trim().length < 3}>{busy ? "Saving..." : editingTask ? "Save changes" : "Create task"}</button></div>
      </form>
    </ModalDialog>}
  </div>
);
}
