import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from 'convex/react';
import { Check, LockKeyhole, Plus, Vote, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import ModalDialog from '../../components/ModalDialog';
import ScreenErrorBoundary from '../../components/ScreenErrorBoundary';
import { useAction, useFeedback } from '../../components/Feedback';
import { useDraftGuard } from '../../components/NavigationExperience';

type Props = { taskId: Id<'projectTasks'>; title: string; focusPollId?: Id<'taskPolls'>; onClose: () => void };
export default function TaskPolls(props: Props) {
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const dismiss = useDraftGuard(dirty, busy);
  return createPortal(<ModalDialog className="poll-overlay" label={`Polls for ${props.title}`} busy={busy} onDismiss={() => dismiss(props.onClose)}>
    <section className="poll-dialog"><header className="poll-dialog-header"><div><h2><Vote size={21} aria-hidden="true"/>Task polls</h2><p>{props.title}</p></div><button type="button" className="ui-button ui-secondary ui-icon" aria-label="Close polls" disabled={busy} onClick={() => dismiss(props.onClose)}><X size={20}/></button></header>
      <ScreenErrorBoundary scope="Polls" resetKey={props.taskId} compact onReturn={props.onClose} returnLabel="Close polls">
        <PollContent {...props} onBusy={setBusy} onDirty={setDirty}/>
      </ScreenErrorBoundary>
    </section>
  </ModalDialog>, document.body);
}
function PollContent({ taskId, focusPollId, onBusy, onDirty }: Props & { onBusy: (value: boolean) => void; onDirty: (value: boolean) => void }) {
  const data = useQuery(api.polls.list, { taskId });
  const create = useMutation(api.polls.create), vote = useMutation(api.polls.vote), close = useMutation(api.polls.close);
  const { run, pending } = useAction(); const { confirm } = useFeedback();
  const [creating, setCreating] = useState(false), [question, setQuestion] = useState(''), [options, setOptions] = useState(['', '']);
  const [selectedPoll, setSelectedPoll] = useState(focusPollId);
  const requestKey = useRef(''); const focused = useRef<string | undefined>(undefined); const pollElements = useRef(new Map<string, HTMLElement>());
  const dirty = creating && (question !== '' || options.some(option => option !== ''));
  const dismissDraft = useDraftGuard(dirty, pending !== null);
  useEffect(() => { onBusy(pending !== null); }, [pending, onBusy]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => { onBusy(false); onDirty(false); }, [onBusy, onDirty]);
  useEffect(() => { setSelectedPoll(focusPollId); }, [focusPollId]);
  useEffect(() => {
    if (!data || !selectedPoll || focused.current === selectedPoll) return;
    const element = pollElements.current.get(selectedPoll);
    if (!element) return;
    // Wait for native dialog focus and StrictMode's mount replay to finish.
    const frame = requestAnimationFrame(() => {
      if (element.isConnected && element.closest('dialog')?.open) {
        element.focus(); element.scrollIntoView({ block: 'nearest' }); focused.current = selectedPoll;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [data, selectedPoll]);
  const reset = () => { setCreating(false); setQuestion(''); setOptions(['', '']); requestKey.current = ''; };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data?.canCreate || pending) return;
    let id: Id<'taskPolls'> | undefined;
    if (await run(async () => { id = await create({ taskId, question, options, requestKey: requestKey.current }); }, 'Poll created. Your teammates will be notified.', 'Could not create the poll. Check the question and options, then retry.', 'create')) {
      reset(); setSelectedPoll(id);
    }
  }
  async function closePoll(pollId: Id<'taskPolls'>) {
    if (pending || !await confirm({ title: 'Close poll?', description: 'Voting will stop. The results will remain visible to the team.', confirmLabel: 'Close poll' })) return;
    await run(() => close({ pollId }), 'Poll closed.', 'Could not close this poll.', `close:${pollId}`);
  }
  if (!data) return <p className="poll-empty" role="status">Loading polls...</p>;
  const missing = focusPollId && !data.items.some(poll => poll._id === focusPollId);
  return <>
    <div className="poll-toolbar"><span>{data.items.length}/10 polls · Single choice{data.readOnly ? ' · Read-only' : ''}</span>
      {data.canCreate && !creating && <button type="button" className="ui-button ui-primary" disabled={pending !== null} onClick={() => { requestKey.current = crypto.randomUUID(); setCreating(true); }}><Plus size={16}/>New poll</button>}
    </div>
    {missing && <p className="poll-warning" role="alert">This poll is no longer available. You can browse the other polls for this task.</p>}
    {creating && <form className="poll-create ui-form" onSubmit={submit}><fieldset disabled={pending !== null || !data.canCreate}>
      <label>Question<input autoFocus value={question} onChange={event => setQuestion(event.target.value)} minLength={3} maxLength={240} required placeholder="What should the team decide?"/></label>
      <div className="poll-option-fields">{options.map((option, index) => <div key={index}><label>Option {index + 1}<input value={option} onChange={event => setOptions(current => current.map((value, n) => n === index ? event.target.value : value))} required maxLength={100}/></label>
        {options.length > 2 && <button type="button" className="ui-button ui-secondary ui-icon" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions(current => current.filter((_, n) => n !== index))}><X size={16}/></button>}</div>)}</div>
      {options.length < 6 && <button type="button" className="ui-button ui-secondary" onClick={() => setOptions(current => [...current, ''])}><Plus size={15}/>Add option</button>}
      <p className="poll-help">2–6 different options. Eligible workspace teammates receive an in-app notification.</p>
      <div className="poll-create-actions"><button type="button" className="ui-button ui-secondary" onClick={() => dismissDraft(reset)}>Cancel</button><button type="submit" className="ui-button ui-primary" aria-busy={pending === 'create'} disabled={question.trim().length < 3 || options.some(option => !option.trim()) || new Set(options.map(option => option.trim().normalize('NFC').toLocaleLowerCase('en-US'))).size !== options.length}>{pending === 'create' ? 'Creating...' : 'Create poll'}</button></div>
    </fieldset></form>}
    {!data.items.length && !creating && <p className="poll-empty">No polls yet.{data.canCreate ? ' Ask the team a question to get started.' : ''}</p>}
    <div className="poll-list">{data.items.map(poll => <article key={poll._id} ref={element => { if (element) pollElements.current.set(poll._id, element); else pollElements.current.delete(poll._id); }} tabIndex={-1} data-poll-id={poll._id} className={`poll-item${selectedPoll === poll._id ? ' is-targeted' : ''}`} aria-label={`Poll: ${poll.question}`}>
      <header><h3>{poll.question}</h3><span className="poll-status">{poll.status === 'closed' ? <><LockKeyhole size={13}/>Closed</> : 'Open'}</span></header>
      <p className="poll-byline">{poll.author} · {new Date(poll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
      <fieldset className="poll-vote-options" disabled={pending !== null || !poll.canVote}><legend className="poll-help">Choose one option</legend>
        {poll.options.map(option => { const percent = poll.totalVotes ? Math.round(option.votes / poll.totalVotes * 100) : 0; return <label className={`poll-option${poll.myVote === option.id ? ' is-selected' : ''}`} key={option.id}>
          <span className="poll-option-bar" style={{ width: `${percent}%` }} aria-hidden="true"/>
          <input type="radio" name={`poll-${poll._id}`} value={option.id} checked={poll.myVote === option.id} onChange={() => void run(() => vote({ pollId: poll._id, optionId: option.id }), 'Vote recorded.', 'Could not record your vote. Check whether this poll is still open.', `vote:${poll._id}`)}/>
          <span className="poll-option-label">{option.label}{poll.myVote === option.id && <Check size={14} aria-label="Your vote"/>}</span><span className="poll-option-total">{option.votes} · {percent}%</span>
        </label>; })}
      </fieldset>
      <footer><span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}{poll.status === 'open' && poll.canVote ? ' · You can change your choice' : ''}</span>
        <div>{poll.myVote && poll.canVote && <button type="button" className="ui-button ui-secondary" disabled={pending !== null} onClick={() => void run(() => vote({ pollId: poll._id }), 'Vote removed.', 'Could not remove your vote.', `vote:${poll._id}`)}>Remove my vote</button>}
          {poll.canClose && <button type="button" className="ui-button ui-secondary" disabled={pending !== null} onClick={() => void closePoll(poll._id)}>Close poll</button>}</div>
      </footer>
    </article>)}</div>
  </>;
}
