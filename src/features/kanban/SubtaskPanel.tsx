import { useState, type FormEvent } from "react";
import { CheckSquare2, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAction, useFeedback } from "../../components/Feedback";
import "./subtasks.css";
import { confirmDiscard, useDraftGuard } from "../../components/NavigationExperience";

export default function SubtaskPanel({ taskId, editable, compact = false }: {
  taskId: Id<"projectTasks">;
  editable: boolean;
  compact?: boolean;
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
  const originalTitle = subtasks?.find(item => item._id === editingId)?.title ?? "";
  useDraftGuard(editable && (title !== "" || (editingId !== null && draft !== originalTitle)), pending !== null);
  const cancelEdit = () => { if (confirmDiscard(editingId !== null && draft !== originalTitle, pending !== null)) setEditingId(null); };
  const count = subtasks?.length ?? 0;
  const done = subtasks?.filter(s => s.isCompleted).length ?? 0;
  const percent = count ? Math.round(done * 100 / count) : 0;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || title.trim().length < 2) return;
    if (await run(() => create({ taskId, title: title.trim() }), "Subtask added.", "Could not add the subtask.", "create")) setTitle("");
  }
  async function edit(event: FormEvent<HTMLFormElement>, subtaskId: Id<"subtasks">) {
    event.preventDefault();
    if (!editable || draft.trim().length < 2) return;
    if (await run(() => rename({ subtaskId, title: draft.trim() }), "Subtask saved.", "Could not edit the subtask.", subtaskId)) setEditingId(null);
  }
  async function erase(subtaskId: Id<"subtasks">, name: string) {
    if (pending || !editable || !await confirm({ title: "Delete subtask?", description: `Subtask “${name}” will be deleted. This cannot be undone.` })) return;
    await run(() => remove({ subtaskId }), "Subtask deleted.", "Could not delete the subtask.", `delete:${subtaskId}`);
  }
  return <section className="st-panel">
    <details className="st-disclosure" open={compact ? undefined : true}>
    <summary>
    <div className="st-heading" aria-busy={subtasks === undefined}><strong><CheckSquare2 size={14}/>Subtasks</strong><span>{subtasks === undefined ? "… / … • …" : `${done}/${count} • ${percent}%`}</span><ChevronDown size={16} aria-hidden="true" /></div>
    <div className="st-bar" role="progressbar" aria-label="Subtask progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={subtasks === undefined ? undefined : percent} aria-valuetext={subtasks === undefined ? "Loading progress" : undefined}><div style={{ width: `${percent}%` }} /></div>
    </summary>
    {subtasks === undefined ? <p role="status">Loading subtasks...</p> : count === 0 ? <p className="st-muted">No subtasks yet.</p> :
      <ul className="st-list">{subtasks.map(s => <li key={s._id} aria-busy={pending===s._id || pending===`delete:${s._id}`}>
        {editingId===s._id && editable ? <form className="st-edit-form" onSubmit={event => void edit(event, s._id)}>
          <input autoFocus aria-label="Rename subtask" required minLength={2} maxLength={160} value={draft} disabled={pending!==null} onChange={event => setDraft(event.target.value)} />
          <div className="st-tools">
            <button className="ui-button ui-secondary" type="button" disabled={pending!==null} onClick={cancelEdit}>Cancel</button>
            <button className="ui-button ui-primary" type="submit" aria-busy={pending===s._id} disabled={pending!==null || draft.trim().length<2}>{pending===s._id ? "Saving..." : "Save"}</button>
          </div>
        </form> : <>
          <label><input type="checkbox" checked={s.isCompleted} disabled={!editable || pending!==null} onChange={event => void run(() => toggle({ subtaskId: s._id, isCompleted: event.target.checked }), "Subtask updated.", "Could not update the subtask.", s._id)} /><span className={s.isCompleted ? "st-done" : ""}>{s.title}</span></label>
          {editable && <span className="st-tools"><button className="ui-button ui-secondary ui-icon" aria-label="Edit" title="Edit subtask" type="button" disabled={pending!==null} onClick={() => { if (!confirmDiscard(editingId !== s._id && editingId !== null && draft !== originalTitle, pending !== null)) return; setEditingId(s._id); setDraft(s.title);}}><Pencil size={14}/></button><button className="ui-button ui-danger ui-icon" aria-label="Delete" title="Delete subtask" type="button" disabled={pending!==null} aria-busy={pending===`delete:${s._id}`} onClick={() => void erase(s._id, s.title)}><Trash2 size={14}/></button></span>}
        </>}
      </li>)}</ul>}
    {pending && <span className="ui-inline-busy" role="status">Updating subtask...</span>}
    {editable && <form className="st-add" onSubmit={event => void add(event)}><input aria-label="Subtask name" placeholder="Add a subtask..." minLength={2} maxLength={160} required disabled={pending!==null} value={title} onChange={event => setTitle(event.target.value)} /><button className="ui-button ui-primary" type="submit" aria-busy={pending==="create"} disabled={pending!==null || title.trim().length < 2}><Plus size={14}/>{pending==="create" ? "Saving..." : "Add"}</button></form>}
    </details>
  </section>;
}
