/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
import { deadlineMessage, emailConfig, HOUR, reminderWindow } from './deadlineEmailConfig';
import { smtpOutcome } from './smtpOutcome';
const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), verify: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: smtp.createTransport } }));
const modules = import.meta.glob('./**/*.ts');
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));
  vi.stubEnv('DEADLINE_EMAIL_ENABLED', 'true'); vi.stubEnv('SMTP_USER', 'sender@example.com');
  vi.stubEnv('SMTP_PASS', 'fake-smtp-test-password'); vi.stubEnv('SMTP_HOST', 'smtp.gmail.com'); vi.stubEnv('SMTP_PORT', '465');
  vi.stubEnv('SMTP_FROM', ''); vi.stubEnv('EMAIL_APP_URL', 'https://cloudtask.example.com');
  smtp.sendMail.mockReset().mockResolvedValue({ accepted: ['member@example.com'] });
  smtp.verify.mockReset().mockResolvedValue(true);
  smtp.close.mockReset(); smtp.createTransport.mockReset().mockReturnValue({ sendMail: smtp.sendMail, verify: smtp.verify, close: smtp.close });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const workspaceId = await ctx.db.insert('workspaces', { name:'Team', description:'', ownerId:'owner', createdAt:1, updatedAt:1 });
    for (const role of ['owner','member','viewer'] as const) await ctx.db.insert('workspaceMembers', { workspaceId, userId:role, role, joinedAt:1 });
    const profileId = await ctx.db.insert('profiles', { userId:'member', fullName:'Team member', email:'member@example.com', emailVerified:true, deadlineEmailEnabled:true, createdAt:1, updatedAt:1 });
    const projectId = await ctx.db.insert('projects', { workspaceId, name:'Launch', description:'', status:'active', createdBy:'owner', createdAt:1, updatedAt:1 });
    const taskId = await ctx.db.insert('projectTasks', { projectId, title:'Review the release', description:'', createdBy:'owner', assigneeId:'member', dueDate:'2026-11-20', status:'todo', priority:'high', position:1, createdAt:1, updatedAt:1 });
    return { workspaceId, profileId, projectId, taskId };
  });
  const queue = async () => {
    await t.mutation(internal.deadlineEmails.scan, {}); await t.mutation(internal.deadlineEmails.dispatch, {});
    return (await t.run(ctx => ctx.db.query('deadlineEmailBatches').collect()))[0];
  };
  const deliver = (batch: Awaited<ReturnType<typeof queue>>) => t.action(internal.deadlineEmailDelivery.send, { batchId:batch._id, lease:batch.nextAttemptAt });
  return { t, ...ids, queue, deliver };
}
describe('Deadline email SMTP workflow', () => {
  it('checks SMTP configuration privately without sending email or returning credentials',async()=>{
    const {t}=await setup();const result=await t.action(internal.deadlineEmailDelivery.checkConnection,{});
    expect(result).toEqual({configured:true,connected:true,reason:'ready'});expect(smtp.sendMail).not.toHaveBeenCalled();
    smtp.verify.mockRejectedValueOnce({code:'EAUTH',message:'PRIVATE_AUTH_DETAILS'});
    expect(await t.action(internal.deadlineEmailDelivery.checkConnection,{})).toEqual({configured:true,connected:false,reason:'authentication_failed'});
  });
  it('does nothing until valid delivery configuration is explicitly enabled', async () => {
    const {t} = await setup(); vi.stubEnv('DEADLINE_EMAIL_ENABLED','false');
    await t.mutation(internal.deadlineEmails.scan, {}); expect(await t.run(ctx=>ctx.db.query('deadlineEmailReminders').collect())).toHaveLength(0);
    vi.stubEnv('DEADLINE_EMAIL_ENABLED','true'); vi.stubEnv('EMAIL_APP_URL','https://evil.example/?redirect=1'); expect(emailConfig()).toBeNull();
    vi.stubEnv('EMAIL_APP_URL','https://cloudtask.example.com'); vi.stubEnv('SMTP_PORT','25'); expect(emailConfig()).toBeNull();
  });
  it('deduplicates scans and sends a private digest with real task deep links', async () => {
    const {t,taskId,queue,deliver} = await setup();
    await t.run(async ctx=>{const task=await ctx.db.get(taskId);const {_id,_creationTime,...copy}=task!;await ctx.db.insert('projectTasks',{...copy,title:'Check the screenshots',position:2});});
    const batch=await queue();await t.mutation(internal.deadlineEmails.scan, {});expect(await t.run(ctx=>ctx.db.query('deadlineEmailReminders').collect())).toHaveLength(2);
    await deliver(batch);await deliver(batch);
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);const mail=smtp.sendMail.mock.calls[0][0];
    expect(mail.to).toBe('member@example.com');expect(mail.cc).toBeUndefined();expect(mail.bcc).toBeUndefined();
    expect(mail.subject).toContain('2 tasks');expect(mail.html).toContain(`?task=${taskId}`);expect(mail.text).toContain('UTC+7');
    expect(smtp.createTransport.mock.calls[0][0]).toMatchObject({secure:true,requireTLS:true,tls:{rejectUnauthorized:true},logger:false,debug:false});
    expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('sent');
    expect((await t.run(ctx=>ctx.db.query('deadlineEmailReminders').collect())).every(row=>row.status==='sent')).toBe(true);
  });
  it('emits the urgent reminder separately and never sends two stages for a newly discovered urgent task',async()=>{
    const {t,queue,deliver}=await setup();const batch=await queue();await deliver(batch);
    vi.setSystemTime(new Date('2026-11-20T22:30:00+07:00'));await t.mutation(internal.deadlineEmails.scan,{});
    const rows=await t.run(ctx=>ctx.db.query('deadlineEmailReminders').collect());expect(rows.map(row=>row.stage).sort()).toEqual(['24h','2h']);
    expect(reminderWindow('2026-11-20',Date.now())).toBe('2h');
    expect(reminderWindow('2026-11-20',Date.parse('2026-11-21T00:00:00+07:00'))).toBeNull();
    expect(reminderWindow('2026-02-30',Date.now())).toBeNull();
  });
  it('does not record removed digest items as sent and allows only one concurrent sender',async()=>{
    const {t,taskId,queue,deliver}=await setup();
    await t.run(async ctx=>{const task=await ctx.db.get(taskId);const {_id,_creationTime,...copy}=task!;await ctx.db.insert('projectTasks',{...copy,title:'A remaining task',position:2});});
    const batch=await queue();await t.run(ctx=>ctx.db.patch(taskId,{status:'done'}));await Promise.all([deliver(batch),deliver(batch)]);
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);expect(smtp.sendMail.mock.calls[0][0].subject).toContain('1 task');
    const reminders=await t.run(ctx=>ctx.db.query('deadlineEmailReminders').collect());
    expect(reminders.find(row=>row.taskId===taskId)?.status).toBe('skipped');expect(reminders.filter(row=>row.status==='sent')).toHaveLength(1);
  });
  for(const reason of ['completed','deleted','reassigned','deadline_changed','revoked','viewer','archived','workspace_deleted','opted_out','unverified','email_removed'] as const)it(`rechecks ${reason} immediately before SMTP delivery`,async()=>{
    const {t,taskId,projectId,workspaceId,profileId,queue,deliver}=await setup();const batch=await queue();
    await t.run(async ctx=>{
      if(reason==='completed')await ctx.db.patch(taskId,{status:'done'});
      if(reason==='deleted')await ctx.db.delete(taskId);
      if(reason==='reassigned')await ctx.db.patch(taskId,{assigneeId:'owner'});
      if(reason==='deadline_changed')await ctx.db.patch(taskId,{dueDate:'2026-11-21'});
      if(reason==='archived')await ctx.db.patch(projectId,{status:'archived'});
      if(reason==='workspace_deleted')await ctx.db.delete(workspaceId);
      if(reason==='opted_out')await ctx.db.patch(profileId,{deadlineEmailEnabled:false});
      if(reason==='unverified')await ctx.db.patch(profileId,{emailVerified:false});
      if(reason==='email_removed')await ctx.db.patch(profileId,{email:undefined});
      if(reason==='revoked'||reason==='viewer'){
        const member=await ctx.db.query('workspaceMembers').withIndex('by_workspace_user',q=>q.eq('workspaceId',workspaceId).eq('userId','member')).unique();
        if(reason==='revoked')await ctx.db.delete(member!._id);else await ctx.db.patch(member!._id,{role:'viewer'});
      }
    });await deliver(batch);expect(smtp.sendMail).not.toHaveBeenCalled();expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('cancelled');
  });
  it('does not send to accounts without verified email and explicit opt-in',async()=>{
    const {t,profileId,queue}=await setup();await t.run(ctx=>ctx.db.patch(profileId,{deadlineEmailEnabled:undefined}));expect(await queue()).toBeUndefined();
    await t.run(ctx=>ctx.db.patch(profileId,{deadlineEmailEnabled:true,emailVerified:undefined}));expect(await queue()).toBeUndefined();
  });
  it('retries only known non-acceptance with backoff and rejects stale dispatch leases',async()=>{
    const {t,queue,deliver}=await setup();const batch=await queue();smtp.sendMail.mockRejectedValueOnce({command:'CONN',code:'ECONNECTION'});
    await deliver(batch);expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('queued');
    await deliver(batch);expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now()+3*60000);await t.mutation(internal.deadlineEmails.dispatch,{});const retry=(await t.run(ctx=>ctx.db.get(batch._id)))!;
    await deliver(retry);expect(smtp.sendMail).toHaveBeenCalledTimes(2);expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('sent');
  });
  it('never automatically retries ambiguous SMTP acceptance or a crashed sending worker',async()=>{
    const {t,queue,deliver}=await setup();const batch=await queue();smtp.sendMail.mockRejectedValueOnce({command:'DATA',code:'ETIMEDOUT'});await deliver(batch);
    expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('uncertain');vi.setSystemTime(Date.now()+3*HOUR);await t.mutation(internal.deadlineEmails.dispatch,{});await deliver(batch);expect(smtp.sendMail).toHaveBeenCalledTimes(1);
    await t.run(ctx=>ctx.db.patch(batch._id,{status:'sending',nextAttemptAt:Date.now()-1}));await t.mutation(internal.deadlineEmails.dispatch,{});expect((await t.run(ctx=>ctx.db.get(batch._id)))?.status).toBe('uncertain');
  });
  it('recovers a preparation crash but bounds retries and the daily Gmail budget',async()=>{
    const {t,queue,deliver}=await setup();const batch=await queue();
    await t.run(ctx=>ctx.db.patch(batch._id,{status:'preparing',attempts:1,nextAttemptAt:Date.now()-1}));await t.mutation(internal.deadlineEmails.dispatch,{});
    const recovered=(await t.run(ctx=>ctx.db.get(batch._id)))!;
    await t.run(ctx=>ctx.db.insert('deadlineEmailUsage',{day:new Date().toISOString().slice(0,10),attempts:100}));await deliver(recovered);
    expect(smtp.sendMail).not.toHaveBeenCalled();expect((await t.run(ctx=>ctx.db.get(batch._id)))?.reason).toBe('daily_limit');
  });
  it('stores preference only for the caller and requires a verified identity to opt in',async()=>{
    const {t,profileId}=await setup();
    await expect(t.withIdentity({subject:'member',email:'member@example.com'}).mutation(api.profiles.upsert,{fullName:'Member',deadlineEmailEnabled:true})).rejects.toThrow('Verify');
    await t.withIdentity({subject:'member',email:'member@example.com',emailVerified:true}).mutation(api.profiles.upsert,{fullName:'Member',deadlineEmailEnabled:true});
    expect((await t.run(ctx=>ctx.db.get(profileId)))?.emailVerified).toBe(true);
    await t.withIdentity({subject:'member',email:'changed@example.com',emailVerified:false}).mutation(api.profiles.syncIdentity,{});
    expect((await t.run(ctx=>ctx.db.get(profileId)))?.emailVerified).toBe(false);
    await expect(t.mutation(api.profiles.upsert,{fullName:'Other',deadlineEmailEnabled:false})).rejects.toThrow();
  });
  it('escapes untrusted task text and classifies SMTP failures conservatively',()=>{
    const mail=deadlineMessage('https://cloudtask.example.com','24h',[{title:'<img src=x onerror=alert(1)>',project:'Team & friends',dueDate:'2026-11-20',workspaceId:'workspace',projectId:'project',taskId:'task'}]);
    expect(mail.html).not.toContain('<img');expect(mail.html).toContain('&lt;img');expect(mail.html).toContain('Team &amp; friends');
    expect(smtpOutcome({responseCode:451,command:'DATA'})).toBe('retry');expect(smtpOutcome({responseCode:535})).toBe('failed');expect(smtpOutcome(new Error('ambiguous'))).toBe('uncertain');
  });
});
