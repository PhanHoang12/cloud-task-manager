import { v } from 'convex/values';
import { internalMutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { deadlineMessage, emailConfig, HOUR, reminderWindow, validEmail, type EmailTask } from './deadlineEmailConfig';

type Reminder = Doc<'deadlineEmailReminders'>;
const batchArgs = { batchId: v.id('deadlineEmailBatches'), attempt: v.number() };
async function eligible(ctx: MutationCtx, reminder: Pick<Reminder, 'taskId' | 'recipientId' | 'dueDate' | 'stage'>) {
  const task = await ctx.db.get(reminder.taskId);
  if (!task || task.status === 'done' || task.assigneeId !== reminder.recipientId || task.dueDate !== reminder.dueDate || reminderWindow(reminder.dueDate, Date.now()) !== reminder.stage) return null;
  const project = await ctx.db.get(task.projectId);
  if (!project || project.status !== 'active' || !await ctx.db.get(project.workspaceId)) return null;
  const member = await ctx.db.query('workspaceMembers').withIndex('by_workspace_user', q => q.eq('workspaceId', project.workspaceId).eq('userId', reminder.recipientId)).unique();
  if (!member || member.role === 'viewer') return null;
  const profile = await ctx.db.query('profiles').withIndex('by_user', q => q.eq('userId', reminder.recipientId)).unique();
  if (!profile?.deadlineEmailEnabled || profile.emailVerified !== true || !validEmail(profile.email ?? '')) return null;
  return { to: profile.email!, item: { title: task.title, project: project.name, dueDate: reminder.dueDate, workspaceId: project.workspaceId, projectId: project._id, taskId: task._id } satisfies EmailTask };
}
async function finish(ctx: MutationCtx, batch: Doc<'deadlineEmailBatches'>, status: 'sent' | 'failed' | 'uncertain' | 'cancelled', reason?: string) {
  await ctx.db.patch(batch._id, { status, reason, finishedAt: Date.now() });
  for (const id of batch.reminderIds) {
    const reminder = await ctx.db.get(id);
    if (reminder?.batchId === batch._id && reminder.status === 'batched') await ctx.db.patch(id, { status: status === 'sent' ? 'sent' : 'skipped' });
  }
}

// Independent from in-app alerts: no changes to existing notification counters or history.
export const scan = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    if (!emailConfig()) return;
    const now = Date.now();
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const page = await ctx.db.query('projectTasks').withIndex('by_due_date', q => q.gte('dueDate', day.format(now)).lte('dueDate', day.format(now + 24 * HOUR))).paginate({ cursor: cursor ?? null, numItems: 100 });
    for (const task of page.page) {
      if (!task.dueDate || !task.assigneeId || task.status === 'done') continue;
      const stage = reminderWindow(task.dueDate, now);
      if (!stage) continue;
      const candidate = { taskId: task._id, recipientId: task.assigneeId, dueDate: task.dueDate, stage };
      if (!await eligible(ctx, candidate)) continue;
      const key = `${task._id}|${task.assigneeId}|${task.dueDate}|${stage}`;
      if (await ctx.db.query('deadlineEmailReminders').withIndex('by_key', q => q.eq('key', key)).unique()) continue;
      await ctx.db.insert('deadlineEmailReminders', { ...candidate, key, status: 'pending', createdAt: now });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.deadlineEmails.scan, { cursor: page.continueCursor });
  },
});

export const dispatch = internalMutation({ args: {}, handler: async ctx => {
  if (!emailConfig()) return;
  const now = Date.now(); let slot = 0;
  const schedule = async (batchId: Id<'deadlineEmailBatches'>) => {
    const lease = now + 120000;
    await ctx.db.patch(batchId, { status: 'queued', nextAttemptAt: lease });
    await ctx.scheduler.runAfter(slot++ * 2000, internal.deadlineEmailDelivery.send, { batchId, lease });
  };
  // An expired sending lease is ambiguous SMTP acceptance: never resend automatically.
  const sending = await ctx.db.query('deadlineEmailBatches').withIndex('by_status_next', q => q.eq('status', 'sending').lte('nextAttemptAt', now)).take(10);
  for (const batch of sending) await finish(ctx, batch, 'uncertain', 'confirmation_missing');
  for (const status of ['queued', 'preparing'] as const) {
    const batches = await ctx.db.query('deadlineEmailBatches').withIndex('by_status_next', q => q.eq('status', status).lte('nextAttemptAt', now)).take(10);
    for (const batch of batches) {
      if (batch.attempts >= 3) await finish(ctx, batch, 'failed', 'retry_limit');
      else await schedule(batch._id);
    }
  }
  const pending = await ctx.db.query('deadlineEmailReminders').withIndex('by_status_created', q => q.eq('status', 'pending')).take(100);
  const groups = new Map<string, Reminder>();
  for (const reminder of pending) groups.set(`${reminder.recipientId}|${reminder.stage}`, reminder);
  for (const seed of [...groups.values()].slice(0, 10)) {
    const reminders = await ctx.db.query('deadlineEmailReminders').withIndex('by_recipient_stage_status', q => q.eq('recipientId', seed.recipientId).eq('stage', seed.stage).eq('status', 'pending')).take(25);
    const valid: Reminder[] = [];
    for (const reminder of reminders) {
      if (await eligible(ctx, reminder)) valid.push(reminder);
      else await ctx.db.patch(reminder._id, { status: 'skipped' });
    }
    if (!valid.length) continue;
    const batchId = await ctx.db.insert('deadlineEmailBatches', { recipientId: seed.recipientId, stage: seed.stage, reminderIds: valid.map(row => row._id), status: 'queued', attempts: 0, nextAttemptAt: now, createdAt: now });
    for (const row of valid) await ctx.db.patch(row._id, { status: 'batched', batchId });
    await schedule(batchId);
  }
} });

export const claim = internalMutation({ args: { batchId: v.id('deadlineEmailBatches'), lease: v.number() }, handler: async (ctx, { batchId, lease }) => {
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.status !== 'queued' || batch.nextAttemptAt !== lease) return null;
  if (!emailConfig()) { await finish(ctx, batch, 'cancelled', 'delivery_disabled'); return null; }
  if (batch.attempts >= 3) { await finish(ctx, batch, 'failed', 'retry_limit'); return null; }
  const attempt = batch.attempts + 1;
  await ctx.db.patch(batchId, { status: 'preparing', attempts: attempt, nextAttemptAt: Date.now() + 120000 });
  return attempt;
} });

export const beginSend = internalMutation({ args: batchArgs, handler: async (ctx, { batchId, attempt }) => {
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.status !== 'preparing' || batch.attempts !== attempt) return null;
  const config = emailConfig();
  if (!config) { await finish(ctx, batch, 'cancelled', 'delivery_disabled'); return null; }
  const items: EmailTask[] = []; let to = '';
  for (const id of batch.reminderIds) {
    const reminder = await ctx.db.get(id);
    const current = reminder?.batchId === batchId && reminder.status === 'batched' ? await eligible(ctx, reminder) : null;
    if (current) { items.push(current.item); to = current.to; }
    else if (reminder) await ctx.db.patch(id, { status: 'skipped' });
  }
  if (!items.length) { await finish(ctx, batch, 'cancelled', 'target_unavailable'); return null; }
  // Conservative application-wide Gmail budget, including retries, per UTC day.
  const day = new Date().toISOString().slice(0, 10);
  const usage = await ctx.db.query('deadlineEmailUsage').withIndex('by_day', q => q.eq('day', day)).unique();
  if ((usage?.attempts ?? 0) >= 100) { await finish(ctx, batch, 'failed', 'daily_limit'); return null; }
  if (usage) await ctx.db.patch(usage._id, { attempts: usage.attempts + 1 });
  else await ctx.db.insert('deadlineEmailUsage', { day, attempts: 1 });
  await ctx.db.patch(batchId, { status: 'sending', nextAttemptAt: Date.now() + 120000 });
  return { to, ...deadlineMessage(config.baseUrl, batch.stage, items) };
} });

export const complete = internalMutation({ args: { ...batchArgs, outcome: v.union(v.literal('sent'), v.literal('retry'), v.literal('failed'), v.literal('uncertain')) }, handler: async (ctx, { batchId, attempt, outcome }) => {
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.status !== 'sending' || batch.attempts !== attempt) return;
  if (outcome === 'retry' && batch.attempts < 3) {
    await ctx.db.patch(batchId, { status: 'queued', nextAttemptAt: Date.now() + (attempt === 1 ? 60000 : 5 * 60000), reason: 'connection_retry' });
  } else await finish(ctx, batch, outcome === 'retry' ? 'failed' : outcome, outcome === 'sent' ? undefined : outcome === 'uncertain' ? 'confirmation_missing' : 'smtp_rejected');
} });
