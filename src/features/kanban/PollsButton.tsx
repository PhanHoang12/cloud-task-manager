import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Vote } from 'lucide-react';
import type { Id } from '../../../convex/_generated/dataModel';
import './polls.css';
const TaskPolls = lazy(() => import('./TaskPolls'));
type Props = { taskId: Id<'projectTasks'>; title: string; count?: number; focus?: { pollId: Id<'taskPolls'>; requestId: string | number } };
export default function PollsButton({ taskId, title, count = 0, focus }: Props) {
  const [open, setOpen] = useState(false); const handled = useRef<string | number | null>(null);
  useEffect(() => { if (focus && handled.current !== focus.requestId) { handled.current = focus.requestId; setOpen(true); } }, [focus]);
  return <>
    <button type="button" className="ui-button ui-secondary poll-launcher" aria-haspopup="dialog" aria-label={`Polls for ${title}, ${count} polls`} onClick={() => setOpen(true)}><Vote size={16} aria-hidden="true"/>Polls <span>{count}</span></button>
    {open && <Suspense fallback={<span role="status">Opening polls...</span>}><TaskPolls taskId={taskId} title={title} focusPollId={focus?.pollId} onClose={() => setOpen(false)}/></Suspense>}
  </>;
}
