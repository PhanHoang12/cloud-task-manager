import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import "./kanban.css";
import SubtaskPanel from "./SubtaskPanel";
import TaskComments from "./TaskComments";
import NotificationCenter from "./NotificationCenter";
import AutomationDashboard from "./AutomationDashboard";


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

export default function KanbanBoard({ project, workspaceId, role, onBack }: {
  project: Doc<"projects">;
  workspaceId: Id<"workspaces">;
  role: Role;
  onBack: () => void;
}) {
  const { user } = useUser();
  const tasks = useQuery(api.projectTasks.list, { projectId: project._id });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
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
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isManager = role === "owner" || role === "admin";
  const active = project.status === "active";
  const canCreate = active && role !== "viewer";
  const visible = useMemo(() => (tasks ?? [])
    .filter(t => `${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.position - b.position), [tasks, search]);

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
      setTitle(""); setDescription(""); setDueDate("");
      setAssigneeId(""); setPriority("medium"); setEditingTask(null); setShowModal(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể tạo Task."); }
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
    if (!dragId) return;
    const task = tasks?.find(t => t._id === dragId);
    setDragId(null);
    if (!task || !canChange(task, targetStatus) || !active) return;
    setError("");
    try { await moveTask({taskId: task._id, targetStatus, beforeTaskId}); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể kéo thả Task."); }
  }

  async function move(task: Task, status: Status) {
    setError("");
    try { await setStatus({ taskId: task._id, status }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái."); }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Xóa “${task.title}”?`)) return;
    setError("");
    try { await remove({ taskId: task._id }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể xóa Task."); }
  }

  
return (
  <div className="kb-page">
    <button
      type="button"
      className="kb-back"
      onClick={onBack}
    >
      ← Trở về Workspace
    </button>

    <header className="kb-header">
      <div className="kb-header-info">
        <p className="kb-caption">
          CLOUDTASK PRO / PROJECT KANBAN
        </p>

        <h2>{project.name}</h2>

        <p>
          {project.description ||
            "Quản lý công việc dự án theo thời gian thực."}
        </p>
      </div>

      <div className="kb-header-actions">
        <NotificationCenter />

        {canCreate && (
          <button
            type="button"
            className="kb-primary"
            onClick={openCreate}
          >
            + Công việc mới
          </button>
        )}
      </div>
    </header>
    <AutomationDashboard projectId={project._id} />
    {!active && <div className="kb-warning">Dự án không hoạt động. Chỉ xem công việc.</div>}
    {error && <div role="alert" className="kb-error">{error} <button onClick={() => setError("")}>Đóng</button></div>}
    <input className="kb-search" aria-label="Tìm Task" placeholder="Tìm kiếm công việc..." value={search} onChange={e => setSearch(e.target.value)} />
    <div className="kb-toolbar"><span>Kéo thả để đổi trạng thái hoặc sắp xếp • Có thể dùng dropdown thay thế</span>
      <button type="button" onClick={() => setShowHistory(v => !v)}>{showHistory ? "Ẩn lịch sử" : "Xem lịch sử"}</button></div>
    <div className="kb-columns">
      {lanes.map(lane => <section key={lane.key} className={`kb-column kb-${lane.key}`}
        onDragOver={e => {if (dragId) e.preventDefault();}}
        onDrop={e => { e.preventDefault(); void dropTask(lane.key); }}>
        <div className="kb-column-title"><strong>{lane.title}</strong><span>{visible.filter(t => t.status === lane.key).length}</span></div>
        {tasks === undefined ? <p className="kb-muted">Đang tải...</p> :
          visible.filter(t => t.status === lane.key).map(task => <article className="kb-card" key={task._id}
            draggable={canChange(task, task.status)}
            onDragStart={e => {e.dataTransfer.effectAllowed = "move"; setDragId(task._id);}}
            onDragEnd={() => setDragId(null)}
            onDragOver={e => {if (dragId && dragId !== task._id) e.preventDefault();}}
            onDrop={e => {e.stopPropagation(); e.preventDefault(); void dropTask(lane.key, task._id);}}>
            <div className="kb-card-top"><span className={`kb-priority kb-${task.priority}`}>{priorityLabel[task.priority]}</span>
              {isManager && <button type="button" onClick={() => void deleteTask(task)} aria-label={`Xóa ${task.title}`}>×</button>}</div>
            <h3>{task.title}</h3>
            {canChange(task, task.status) && <button type="button" className="kb-edit" onClick={() => openEdit(task)}>Chỉnh sửa</button>}{task.description && <p>{task.description}</p>}
            <div className="kb-details">{task.dueDate && <span>Hạn: {task.dueDate}</span>}
              <span>{task.assigneeId ? `Phụ trách: ${task.assigneeId === user?.id ? "Tôi" : task.assigneeId.slice(-8)}` : "Chưa phân công"}</span></div>
              <label>
                Trạng thái
                <select
                  value={task.status}
                  disabled={!canChange(task, task.status)}
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
            {/* Module 04.4 — Subtasks & Progress Tracking */}
            <SubtaskPanel
              taskId={task._id}
              editable={canChange(task, task.status)}/>
              <TaskComments
            taskId={task._id}
            canComment={active && role !== "viewer"}
            canModerate={isManager}/>
            </article>)}

        {tasks !== undefined && !visible.some(t => t.status === lane.key) && <p className="kb-muted">Chưa có công việc</p>}
      </section>)}
    </div>
    {showHistory && <section className="kb-history"><h3>Lịch sử công việc</h3>
      {activities === undefined ? <p>Đang tải...</p> : activities.length === 0 ? <p>Chưa có thay đổi nào.</p> :
        <ul>{activities.map(a => <li key={a._id}><strong>{a.type}</strong> — {a.detail}
          <small> • {new Date(a.createdAt).toLocaleString("vi-VN")} • {a.actorId.slice(-8)}</small></li>)}</ul>}
    </section>}
    {showModal && <div className="kb-overlay" onMouseDown={e => { if(e.target === e.currentTarget && !busy) setShowModal(false); }}>
      <form className="kb-dialog" onSubmit={e => void submit(e)}>
        <div className="kb-dialog-head"><h3>{editingTask ? "Chỉnh sửa công việc" : "Tạo công việc mới"}</h3><button type="button" onClick={() => setShowModal(false)} disabled={busy}>×</button></div>
        <label>Tiêu đề *<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Mô tả<textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="kb-form-row"><label>Ưu tiên<select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
          {Object.entries(priorityLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Hạn hoàn thành<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label></div>
        <label>Người phụ trách<select disabled={!!editingTask && !isManager} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
          <option value="">Chưa phân công</option>
          {members?.filter(m => m.role !== "viewer").map(m => <option key={m._id} value={m.userId}>{m.userId === user?.id ? "Tôi" : m.userId}</option>)}
        </select></label>
        {error && <p role="alert" className="kb-error">{error}</p>}
        <div className="kb-actions"><button type="button" disabled={busy} onClick={() => setShowModal(false)}>Hủy</button>
          <button type="submit" disabled={busy || title.trim().length < 3}>{busy ? "Đang lưu..." : editingTask ? "Lưu thay đổi" : "Tạo công việc"}</button></div>
      </form>
    </div>}
  </div>
);
}
