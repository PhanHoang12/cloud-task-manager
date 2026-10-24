import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = subtasks?.length ?? 0;
  const done = subtasks?.filter(s => s.isCompleted).length ?? 0;
  const percent = count ? Math.round(done * 100 / count) : 0;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editable || busy || !title.trim()) return;
    setBusy(true); setError("");
    try { await create({ taskId, title }); setTitle(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể tạo Subtask."); }
    finally { setBusy(false); }
  }
  async function change(subtaskId: Id<"subtasks">, isCompleted: boolean) {
    setError("");
    try { await toggle({ subtaskId, isCompleted }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể cập nhật."); }
  }
  async function edit(subtaskId: Id<"subtasks">, current: string) {
    const next = window.prompt("Sửa tên công việc con", current);
    if (next === null || next.trim() === current) return;
    setError("");
    try { await rename({ subtaskId, title: next }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể sửa."); }
  }
  async function erase(subtaskId: Id<"subtasks">) {
    if (!window.confirm("Xóa công việc con này?")) return;
    setError("");
    try { await remove({ subtaskId }); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể xóa."); }
  }
  return <section className="st-panel">
    <div className="st-heading"><strong>Checklist công việc con</strong><span>{done}/{count} • {percent}%</span></div>
    <div className="st-bar" role="progressbar" aria-label="Tiến độ công việc con" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div style={{ width: `${percent}%` }} /></div>
    {subtasks === undefined ? <p>Đang tải checklist...</p> : count === 0 ? <p className="st-muted">Chưa có công việc con.</p> :
      <ul className="st-list">{subtasks.map(s => <li key={s._id}>
        <label><input type="checkbox" checked={s.isCompleted} disabled={!editable} onChange={e => void change(s._id, e.target.checked)} /><span className={s.isCompleted ? "st-done" : ""}>{s.title}</span></label>
        {editable && <span className="st-tools"><button type="button" onClick={() => void edit(s._id, s.title)}>Sửa</button><button type="button" onClick={() => void erase(s._id)}>Xóa</button></span>}
      </li>)}</ul>}
    {editable && <form className="st-add" onSubmit={e => void add(e)}><input aria-label="Tên công việc con" placeholder="Thêm công việc con..." minLength={2} maxLength={160} required value={title} onChange={e => setTitle(e.target.value)} /><button type="submit" disabled={busy || title.trim().length < 2}>{busy ? "Đang lưu" : "+ Thêm"}</button></form>}
    {error && <p role="alert" className="st-error">{error}</p>}
  </section>;
}
