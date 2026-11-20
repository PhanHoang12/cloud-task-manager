import { v } from 'convex/values';
import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { requireIdentity, requireMember } from './permissions';

async function access(ctx: QueryCtx | MutationCtx, taskId: Id<'projectTasks'>) {
  const identity = await requireIdentity(ctx);
  const task = await ctx.db.get(taskId);
  const project = task ? await ctx.db.get(task.projectId) : null;
  if (!task || !project) throw new Error('This task is unavailable.');
  const member = await requireMember(ctx, project.workspaceId, identity.subject);
  return { task, project, member, userId: identity.subject, writable: project.status === 'active' && member.role !== 'viewer' };
}
function validate(question: string, options: string[]) {
  const text = question.trim(); const labels = options.map(option => option.trim());
  if (text.length < 3 || text.length > 240) throw new Error('Use a question with 3–240 characters.');
  if (labels.length < 2 || labels.length > 6 || labels.some(label => !label || label.length > 100)) throw new Error('Add 2–6 options, each with 1–100 characters.');
  if (new Set(labels.map(label => label.normalize('NFC').toLocaleLowerCase('en-US'))).size !== labels.length) throw new Error('Each option must be different.');
  return { text, labels };
}
export const list = query({ args: { taskId: v.id('projectTasks') }, handler: async (ctx, { taskId }) => {
  const permissions = await access(ctx, taskId);
  const polls = await ctx.db.query('taskPolls').withIndex('by_task_created', q => q.eq('taskId', taskId)).order('desc').take(10);
  const items = await Promise.all(polls.filter(poll => !poll.deleting).map(async poll => {
    const myVote = await ctx.db.query('taskPollVotes').withIndex('by_poll_user', q => q.eq('pollId', poll._id).eq('userId', permissions.userId)).unique();
    const authorMember = await ctx.db.query('workspaceMembers').withIndex('by_workspace_user', q => q.eq('workspaceId', permissions.project.workspaceId).eq('userId', poll.createdBy)).unique();
    const profile = authorMember ? await ctx.db.query('profiles').withIndex('by_user', q => q.eq('userId', poll.createdBy)).unique() : null;
    const customName = profile?.fullName?.trim();
    const authorName = (customName && customName !== 'Người dùng' ? customName : '') || profile?.accountName?.trim() || 'Team member';
    const author = poll.createdBy === permissions.userId ? 'You' : authorMember ? authorName : 'Former member';
    return { _id: poll._id, question: poll.question, options: poll.options, totalVotes: poll.totalVotes, status: poll.status,
      createdAt: poll.createdAt, closedAt: poll.closedAt, author, myVote: myVote?.optionId ?? null,
      canVote: permissions.writable && poll.status === 'open',
      canClose: permissions.writable && poll.status === 'open' && (poll.createdBy === permissions.userId || ['owner', 'admin'].includes(permissions.member.role)) };
  }));
  return { items, canCreate: permissions.writable && polls.length < 10, readOnly: !permissions.writable };
} });
export const create = mutation({ args: { taskId: v.id('projectTasks'), question: v.string(), options: v.array(v.string()), requestKey: v.string() }, handler: async (ctx, args) => {
  const permissions = await access(ctx, args.taskId);
  if (!permissions.writable) throw new Error('You cannot create a poll in this task.');
  const { text, labels } = validate(args.question, args.options);
  if (!/^[A-Za-z0-9-]{16,80}$/.test(args.requestKey)) throw new Error('Invalid poll request.');
  const prior = await ctx.db.query('taskPolls').withIndex('by_creator_request', q => q.eq('createdBy', permissions.userId).eq('requestKey', args.requestKey)).unique();
  if (prior) {
    if (prior.taskId !== args.taskId || prior.question !== text || JSON.stringify(prior.options.map(option => option.label)) !== JSON.stringify(labels)) throw new Error('This request already created another poll. Close and reopen the form.');
    return prior._id;
  }
  const existing = await ctx.db.query('taskPolls').withIndex('by_task_created', q => q.eq('taskId', args.taskId)).take(10);
  if (existing.length >= 10) throw new Error('A task can have up to 10 polls.');
  const pollId = await ctx.db.insert('taskPolls', { taskId: args.taskId, projectId: permissions.project._id,
    createdBy: permissions.userId, requestKey: args.requestKey, question: text,
    options: labels.map((label, index) => ({ id: `option-${index + 1}`, label, votes: 0 })), totalVotes: 0, status: 'open', createdAt: Date.now() });
  await ctx.db.patch(args.taskId, { pollCount: existing.length + 1 });
  await ctx.scheduler.runAfter(0, internal.polls.notifyPage, { pollId, cursor: null });
  return pollId;
} });
export const vote = mutation({ args: { pollId: v.id('taskPolls'), optionId: v.optional(v.string()) }, handler: async (ctx, { pollId, optionId }) => {
  const poll = await ctx.db.get(pollId);
  if (!poll || poll.deleting) throw new Error('This poll is unavailable.');
  const permissions = await access(ctx, poll.taskId);
  if (!permissions.writable || poll.status !== 'open') throw new Error('This poll is read-only or closed.');
  if (optionId !== undefined && !poll.options.some(option => option.id === optionId)) throw new Error('Choose an option from this poll.');
  const prior = await ctx.db.query('taskPollVotes').withIndex('by_poll_user', q => q.eq('pollId', pollId).eq('userId', permissions.userId)).unique();
  if ((prior?.optionId ?? undefined) === optionId) return;
  if (prior) {
    if (optionId) await ctx.db.patch(prior._id, { optionId, updatedAt: Date.now() });
    else await ctx.db.delete(prior._id);
  } else if (optionId) await ctx.db.insert('taskPollVotes', { pollId, userId: permissions.userId, optionId, createdAt: Date.now(), updatedAt: Date.now() });
  await ctx.db.patch(pollId, { totalVotes: poll.totalVotes + (optionId && !prior ? 1 : !optionId && prior ? -1 : 0),
    options: poll.options.map(option => ({ ...option, votes: option.votes + (option.id === optionId ? 1 : 0) - (option.id === prior?.optionId ? 1 : 0) })) });
} });
export const close = mutation({ args: { pollId: v.id('taskPolls') }, handler: async (ctx, { pollId }) => {
  const poll = await ctx.db.get(pollId);
  if (!poll || poll.deleting) throw new Error('This poll is unavailable.');
  const permissions = await access(ctx, poll.taskId);
  if (!permissions.writable || (poll.createdBy !== permissions.userId && !['owner', 'admin'].includes(permissions.member.role))) throw new Error('Only the poll creator or an Owner/Admin can close this poll.');
  if (poll.status === 'closed') return;
  await ctx.db.patch(pollId, { status: 'closed', closedAt: Date.now() });
} });
export const notifyPage = internalMutation({ args: { pollId: v.id('taskPolls'), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, { pollId, cursor }) => {
  const poll = await ctx.db.get(pollId); if (!poll || poll.deleting || poll.status !== 'open') return;
  const task = await ctx.db.get(poll.taskId); const project = task ? await ctx.db.get(task.projectId) : null;
  if (!task || !project || project.status !== 'active' || !await ctx.db.get(project.workspaceId)) return;
  const page = await ctx.db.query('workspaceMembers').withIndex('by_workspace', q => q.eq('workspaceId', project.workspaceId)).paginate({ cursor, numItems: 100 });
  for (const member of page.page) {
    if (member.userId === poll.createdBy || member.role === 'viewer') continue;
    const existing = await ctx.db.query('notifications').withIndex('by_poll_recipient', q => q.eq('pollId', pollId).eq('recipientId', member.userId)).unique();
    if (!existing) await ctx.db.insert('notifications', { recipientId: member.userId, actorId: poll.createdBy, projectId: project._id, taskId: task._id, pollId,
      kind: 'poll_created', message: `New poll in ${task.title.slice(0, 100)}: ${poll.question}`, isRead: false, isActive: true, createdAt: poll.createdAt });
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.polls.notifyPage, { pollId, cursor: page.continueCursor });
} });
export async function deleteTaskPolls(ctx: MutationCtx, taskId: Id<'projectTasks'>) {
  const polls = await ctx.db.query('taskPolls').withIndex('by_task_created', q => q.eq('taskId', taskId)).take(10);
  for (const poll of polls) {
    await ctx.db.patch(poll._id, { deleting: true });
    await ctx.scheduler.runAfter(0, internal.polls.purge, { pollId: poll._id });
  }
}
export const purge = internalMutation({ args: { pollId: v.id('taskPolls') }, handler: async (ctx, { pollId }) => {
  const poll = await ctx.db.get(pollId); if (!poll?.deleting) return;
  const votes = await ctx.db.query('taskPollVotes').withIndex('by_poll', q => q.eq('pollId', pollId)).take(100);
  for (const vote of votes) await ctx.db.delete(vote._id);
  const notices = await ctx.db.query('notifications').withIndex('by_poll_recipient', q => q.eq('pollId', pollId)).take(100);
  for (const notice of notices) await ctx.db.delete(notice._id);
  if (votes.length === 100 || notices.length === 100) await ctx.scheduler.runAfter(0, internal.polls.purge, { pollId });
  else await ctx.db.delete(pollId);
} });
