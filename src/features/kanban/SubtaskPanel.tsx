import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAction, useFeedback } from "../../components/Feedback";
import "./subtasks.css";

export default function SubtaskPanel({ taskId, editable }: {
  taskId: Id<"projectTasks">;
  editable: boolean;
}) {
  const subtasks = useQuery(api.subtasks.list, { taskId });
  const create = useMutation(api.subtasks.create);
  const toggle = useMutation(api.subtasks.toggle);
  const rename = useMutation(api.subtasks.rename);
  const remove = useMutation(api.subtasks.remove);
  const { run, pending } = useAction();
  const { confirm } = useFeedback();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<Id<"subtasks"> | null>(null);
  const [draft, setDraft] = useState("");
  const count = subtasks?.length ?? 0;
  const done = subtasks?.filter(s => s.isCompleted).length ?? 0;
  const percent = count ? Math.round(done * 100 / count) : 0;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || title.trim().length < 2) return;
    if (await run(() => create({ taskId, title: title.trim() }), "Đã thêm công việc con.", "Không thể thêm công việc con.", "create")) setTitle("");
  }
  async function edit(event: FormEvent<HTMLFormElement>, subtaskId: Id<"subtasks">) {
    event.preventDefault();
    if (!editable || draft.trim().length < 2) return;
    if (await run(() => rename({ subtaskId, title: draft.trim() }), "Đã lưu công việc con.", "Không thể sửa công việc con.", subtaskId)) setEditingId(null);
  }
  async function erase(subtaskId: Id<"subtasks">, name: string) {
    if (pending || !editable || !await confirm({ title: "Xóa công việc con?", description: `Công việc con “${name}” sẽ bị xóa. Bạn không thể hoàn tác thao tác này.` })) return;
    await run(() => remove({ subtaskId }), "Đã xóa công việc con.", "Không thể xóa công việc con.", `delete:${subtaskId}`);
  }
  return <section className="st-panel">
    <div className="st-heading"><strong>Checklist công việc con</strong><span>{done}/{count} • {percent}%</span></div>
    <div className="st-bar" role="progressbar" aria-label="Tiến độ công việc con" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div style={{ width: `${percent}%` }} /></div>
    {subtasks === undefined ? <p role="status">Đang tải checklist...</p> : count === 0 ? <p className="st-muted">Chưa có công việc con.</p> :
      <ul className="st-list">{subtasks.map(s => <li key={s._id} aria-busy={pending===s._id || pending===`delete:${s._id}`}>
        {editingId===s._id && editable ? <form className="st-edit-form" onSubmit={event => void edit(event, s._id)}>
          <input autoFocus aria-label="Sửa tên công việc con" required minLength={2} maxLength={160} value={draft} disabled={pending!==null} onChange={event => setDraft(event.target.value)} />
          <div className="st-tools">
            <button className="ui-button ui-secondary" type="button" disabled={pending!==null} onClick={() => setEditingId(null)}>Hủy</button>
            <button className="ui-button ui-primary" type="submit" aria-busy={pending===s._id} disabled={pending!==null || draft.trim().length<2}>{pending===s._id ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form> : <>
          <label><input type="checkbox" checked={s.isCompleted} disabled={!editable || pending!==null} onChange={event => void run(() => toggle({ subtaskId: s._id, isCompleted: event.target.checked }), "Đã cập nhật công việc con.", "Không thể cập nhật công việc con.", s._id)} /><span className={s.isCompleted ? "st-done" : ""}>{s.title}</span></label>
          {editable && <span className="st-tools"><button className="ui-button ui-secondary" type="button" disabled={pending!==null} onClick={() => {setEditingId(s._id); setDraft(s.title);}}>Sửa</button><button className="ui-button ui-danger" type="button" disabled={pending!==null} aria-busy={pending===`delete:${s._id}`} onClick={() => void erase(s._id, s.title)}>Xóa</button></span>}
        </>}
      </li>)}</ul>}
    {pending && <span className="ui-inline-busy" role="status">Đang xử lý checklist...</span>}
    {editable && <form className="st-add" onSubmit={event => void add(event)}><input aria-label="Tên công việc con" placeholder="Thêm công việc con..." minLength={2} maxLength={160} required disabled={pending!==null} value={title} onChange={event => setTitle(event.target.value)} /><button className="ui-button ui-primary" type="submit" aria-busy={pending==="create"} disabled={pending!==null || title.trim().length < 2}>{pending==="create" ? "Đang lưu..." : "+ Thêm"}</button></form>}
  </section>;
}
