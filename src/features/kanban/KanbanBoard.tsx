import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/react";
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

type Task = Doc<"projectTasks">;
type Status = Task["status"];
type Priority = Task["priority"];
type Role = "owner" | "admin" | "member" | "viewer";
const lanes: { key: Status; title: string }[] = [
  { key: "todo", title: "Cần làm" },
  { key: "in_progress", title: "Đang thực hiện" },
  { key: "review", title: "Chờ duyệt" },
  { key: "done", title: "Hoàn thành" },
];
const priorityLabel: Record<Priority, string> = {
  low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp",
};

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
  const handledNavigation = useRef<number | null>(null);
  const [unavailableRequest, setUnavailableRequest] = useState<number | null>(null);
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
      notify(editingTask ? "Đã lưu thay đổi công việc." : "Đã tạo công việc.");
      setTitle(""); setDescription(""); setDueDate("");
      setAssigneeId(""); setPriority("medium"); setEditingTask(null); setShowModal(false);
    } catch (e) { const message = getErrorMessage(e, "Không thể lưu công việc."); setError(message); notify(message, "error"); }
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
    await run(() => moveTask({ taskId: task._id, targetStatus, beforeTaskId }), "Đã di chuyển công việc.", "Không thể di chuyển công việc.", `move:${task._id}`);
  }

  async function move(task: Task, status: Status) {
    if (!canChange(task, status)) return;
    await run(() => setStatus({ taskId: task._id, status }), "Đã cập nhật trạng thái.", "Không thể đổi trạng thái.", `move:${task._id}`);
  }

  async function deleteTask(task: Task) {
    if (pending || !await confirm({ title: "Xóa công việc?", description: `Công việc “${task.title}” cùng các dữ liệu liên quan sẽ bị xóa. Bạn không thể hoàn tác thao tác này.` })) return;
    await run(() => remove({ taskId: task._id }), "Đã xóa công việc.", "Không thể xóa công việc.", `delete:${task._id}`);
  }

  
return (
  <div className="kb-page">
    <button
      type="button"
      className="kb-back"
      onClick={onBack}
    >
      ← Trở về danh sách dự án
    </button>

    <header className="kb-header">
      <div className="kb-header-info">
        <p className="kb-caption">
          DỰ ÁN / BẢNG CÔNG VIỆC
        </p>

        <h2 ref={linkedHeadingRef} tabIndex={notificationNavigation ? -1 : undefined} className={notificationNavigation ? "kb-notification-heading" : undefined}>{project.name}</h2>

        <p>
          {project.description ||
            "Quản lý công việc dự án theo thời gian thực."}
        </p>
      </div>

      <div className="kb-header-actions">

        {canCreate && (
          <button
            type="button"
            className="kb-primary ui-button ui-primary"
            onClick={openCreate}
          >
            + Công việc mới
          </button>
        )}
      </div>
    </header>
    <div className="kb-deadline-notices" ref={setDeadlineNoticeTarget} />
    {linkedTaskUnavailable && <div ref={unavailableRef} tabIndex={-1} className="kb-warning" role="alert">Không tìm thấy công việc được liên kết trong danh sách hiện có. Bạn có thể xem các công việc khác của dự án.</div>}
    {!active && <div className="kb-warning">Dự án không hoạt động. Chỉ xem công việc.</div>}
    {error && <div role="alert" className="kb-error">{error} <button onClick={() => setError("")}>Đóng</button></div>}
    <input className="kb-search" aria-label="Tìm công việc" placeholder="Tìm kiếm công việc..." value={search} onChange={e => setSearch(e.target.value)} />
    <div className="kb-toolbar"><span>Kéo thả để sắp xếp hoặc chọn trạng thái trên thẻ công việc.</span>
      <button type="button" onClick={() => setShowHistory(v => !v)}>{showHistory ? "Ẩn lịch sử" : "Xem lịch sử"}</button></div>
    {tasks === undefined && <p className="kb-muted" role="status">Đang tải công việc của dự án...</p>}
    <div ref={columnsRef} className="kb-columns" aria-busy={tasks === undefined} role="region" aria-label="Bảng công việc, cuộn ngang để xem các cột" tabIndex={0}>
      {lanes.map(lane => <section key={lane.key} className={`kb-column kb-${lane.key}`}
        onDragOver={e => {if (dragId) e.preventDefault();}}
        onDrop={e => { e.preventDefault(); void dropTask(lane.key); }}>
        <div className="kb-column-title"><strong>{lane.title}</strong><span>{tasks === undefined ? "…" : visible.filter(t => t.status === lane.key).length}</span></div>
        {tasks === undefined ? <p className="kb-muted" aria-hidden="true">Đang tải...</p> :
          visible.filter(t => t.status === lane.key).map(task => <article className="kb-card" key={task._id}
            ref={task._id === notificationNavigation?.taskId ? linkedTaskRef : undefined}
            tabIndex={task._id === notificationNavigation?.taskId ? -1 : undefined}
            data-notification-target={task._id === notificationNavigation?.taskId ? "true" : undefined}
            aria-label={task._id === notificationNavigation?.taskId ? `Công việc: ${task.title}` : undefined}
            aria-busy={pending===`move:${task._id}` || pending===`delete:${task._id}`}
            draggable={!pending && canChange(task, task.status)}
            onDragStart={e => {e.dataTransfer.effectAllowed = "move"; setDragId(task._id);}}
            onDragEnd={() => setDragId(null)}
            onDragOver={e => {if (dragId && dragId !== task._id) e.preventDefault();}}
            onDrop={e => {e.stopPropagation(); e.preventDefault(); void dropTask(lane.key, task._id);}}>
            <div className="kb-card-top"><span className={`kb-priority kb-${task.priority}`}>{priorityLabel[task.priority]}</span>
              {isManager && active && <button className="ui-button ui-danger ui-icon" disabled={pending!==null} aria-busy={pending===`delete:${task._id}`} type="button" onClick={() => void deleteTask(task)} aria-label={`Xóa ${task.title}`}>×</button>}</div>
            <h3>{task.title}</h3>
            {canChange(task, task.status) && <button type="button" className="kb-edit ui-button ui-secondary" disabled={pending!==null} onClick={() => openEdit(task)}>Chỉnh sửa</button>}{task.description && <p>{task.description}</p>}
            <div className="kb-details">{task.dueDate && <span>Hạn: {formatDueDate(task.dueDate)}</span>}
              <span>{task.assigneeId ? `Phụ trách: ${assigneeLabel(task.assigneeId)}` : "Chưa phân công"}</span></div>
              <label>
                Trạng thái
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
            {(pending===`move:${task._id}` || pending===`delete:${task._id}`) && <span className="ui-inline-busy" role="status">Đang xử lý...</span>}
            {/* Module 04.4 — Subtasks & Progress Tracking */}
            <ScreenErrorBoundary scope="Công việc con" resetKey={task._id} compact>
            <SubtaskPanel
              compact
              taskId={task._id}
              editable={canChange(task, task.status)}/>
            </ScreenErrorBoundary>
            <ScreenErrorBoundary scope="Thảo luận" resetKey={task._id} compact>
              <TaskComments
            authorNames={commentAuthorNames}
            taskId={task._id}
            canComment={active && role !== "viewer"}
            canModerate={isManager}/>
            </ScreenErrorBoundary>
            </article>)}

        {tasks !== undefined && !visible.some(t => t.status === lane.key) && <p className="kb-muted">Chưa có công việc</p>}
      </section>)}
    </div>
    <ScreenErrorBoundary scope="Tiến độ và nhắc hạn" resetKey={project._id}>
      <AutomationDashboard projectId={project._id} noticeTarget={deadlineNoticeTarget}
        onReviewTasks={() => { setSearch(""); columnsRef.current?.focus(); columnsRef.current?.scrollIntoView({ block: "nearest" }); }} />
    </ScreenErrorBoundary>
    {showHistory && <section className="kb-history"><h3>Lịch sử công việc</h3>
      {activities === undefined ? <p role="status">Đang tải lịch sử công việc...</p> : activities.length === 0 ? <p>Chưa có thay đổi nào.</p> :
        <ul>{activities.map(a => <li key={a._id}><strong>{activityLabels[a.type]}</strong> — {formatActivityDetail(a.type, a.detail)}
          <small> • {new Date(a.createdAt).toLocaleString("vi-VN")} • {a.actorId.slice(-8)}</small></li>)}</ul>}
    </section>}
    {showModal && <ModalDialog className="kb-overlay" label={editingTask ? "Chỉnh sửa công việc" : "Tạo công việc"} busy={busy} onDismiss={closeTask}>
      <form className="kb-dialog" onSubmit={e => void submit(e)}>
        <div className="kb-dialog-head"><h3>{editingTask ? "Chỉnh sửa công việc" : "Tạo công việc mới"}</h3><button className="ui-button ui-secondary ui-icon" aria-label="Đóng" type="button" onClick={closeTask} disabled={busy}>×</button></div>
        <label>Tiêu đề *<input disabled={busy} required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Mô tả<textarea disabled={busy} rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="kb-form-row"><label>Ưu tiên<select disabled={busy} value={priority} onChange={e => setPriority(e.target.value as Priority)}>
          {Object.entries(priorityLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Hạn hoàn thành<input disabled={busy} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label></div>
        <label>Người phụ trách<select aria-busy={members === undefined} disabled={busy || (!!editingTask && !isManager)} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
          <option value="">Chưa phân công</option>
          {assigneeId && !members?.some(m => m.userId === assigneeId && m.role !== "viewer") &&
            <option value={assigneeId} disabled>{assigneeLabel(assigneeId)} · Không thể chọn mới</option>}
          {members?.filter(m => m.role !== "viewer").map(m => <option key={m._id} value={m.userId}>{assigneeLabel(m.userId)}</option>)}
        </select>{members === undefined && <span role="status">Đang tải danh sách thành viên…</span>}</label>
        {error && <p role="alert" className="kb-error">{error}</p>}
        <div className="kb-actions"><button className="ui-button ui-secondary" type="button" disabled={busy} onClick={closeTask}>Hủy</button>
          <button className="ui-button ui-primary" aria-busy={busy} type="submit" disabled={busy || title.trim().length < 3}>{busy ? "Đang lưu..." : editingTask ? "Lưu thay đổi" : "Tạo công việc"}</button></div>
      </form>
    </ModalDialog>}
  </div>
);
}
