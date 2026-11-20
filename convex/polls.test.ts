/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api, internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
beforeEach(() => vi.useFakeTimers()); afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const workspaceId = await ctx.db.insert('workspaces', { name:'Poll team', description:'', ownerId:'owner', createdAt:1, updatedAt:1 });
    for (const userId of ['owner','admin','member','other','viewer']) await ctx.db.insert('workspaceMembers', { workspaceId, userId, role:userId === 'other' ? 'member' : userId as 'owner'|'admin'|'member'|'viewer', joinedAt:1 });
    const projectId = await ctx.db.insert('projects', { workspaceId, name:'Launch', description:'', status:'active', createdBy:'owner', createdAt:1, updatedAt:1 });
    const taskId = await ctx.db.insert('projectTasks', { projectId, title:'Choose a direction', description:'', createdBy:'owner', assigneeId:'member', status:'todo', priority:'medium', position:1, createdAt:1, updatedAt:1 });
    return {workspaceId,projectId,taskId};
  }); let sequence=0;
  const user=(subject:string)=>t.withIdentity({subject});
  const create=(subject='owner',options=['Monday','Friday'],question='When should we meet?',requestKey=`poll-request-identifier-${++sequence}`)=>user(subject).mutation(api.polls.create,{taskId:ids.taskId,question,options,requestKey});
  return {t,user,create,...ids};
}
describe('Task polls',()=>{
  it('requires authentication and current task/workspace access',async()=>{
    const {t,taskId,user,create}=await setup();const pollId=await create();
    await expect(t.query(api.polls.list,{taskId})).rejects.toThrow();await expect(user('outside').query(api.polls.list,{taskId})).rejects.toThrow();
    await expect(user('outside').mutation(api.polls.vote,{pollId,optionId:'option-1'})).rejects.toThrow();await expect(create('outside')).rejects.toThrow();await expect(user('outside').mutation(api.polls.close,{pollId})).rejects.toThrow();
  });
  it.each(['owner','admin','member','other'])('allows %s to create a collaborative poll',async role=>{
    const {user,create,taskId}=await setup();await create(role);const data=await user(role).query(api.polls.list,{taskId});expect(data.items).toHaveLength(1);expect(data.items[0]).toMatchObject({author:'You',totalVotes:0,status:'open'});expect(data.items[0]).not.toHaveProperty('createdBy');expect(data.items[0]).not.toHaveProperty('requestKey');
  });
  it('keeps Viewers read-only and inactive projects immutable',async()=>{
    const {t,projectId,taskId,user,create}=await setup();const pollId=await create();await expect(create('viewer')).rejects.toThrow();await expect(user('viewer').mutation(api.polls.vote,{pollId,optionId:'option-1'})).rejects.toThrow();expect(await user('viewer').query(api.polls.list,{taskId})).toMatchObject({canCreate:false,readOnly:true});
    await t.run(ctx=>ctx.db.patch(projectId,{status:'archived'}));await expect(create()).rejects.toThrow();await expect(user('owner').mutation(api.polls.vote,{pollId,optionId:'option-1'})).rejects.toThrow();await expect(user('owner').mutation(api.polls.close,{pollId})).rejects.toThrow();expect((await user('member').query(api.polls.list,{taskId})).items).toHaveLength(1);
  });
  it('validates questions, option limits and normalized duplicate labels',async()=>{
    const {create}=await setup();for(const [options,question]of [[['One'],'Valid question'],[Array(7).fill('x'),'Valid question'],[['','One'],'Valid question'],[[' A ','a'],'Valid question'],[['é','e\u0301'],'Valid question'],[['One','Two'],'x'],[['One','Two'],'x'.repeat(241)],[['x'.repeat(101),'B'],'Valid question']] as [string[],string][])await expect(create('owner',options,question)).rejects.toThrow();await expect(create('owner',['One','Two'],'Valid question','invalid')).rejects.toThrow();
  });
  it('deduplicates creation retries, rejects changed payloads and enforces ten polls',async()=>{
    const {t,taskId,create}=await setup();const key='same-poll-request-identifier';const first=await create('member',undefined,undefined,key);expect(await create('member',undefined,undefined,key)).toBe(first);await expect(create('member',['Changed','Other'],undefined,key)).rejects.toThrow();for(let n=0;n<9;n++)await create();await expect(create()).rejects.toThrow('10 polls');expect(await create('member',undefined,undefined,key)).toBe(first);expect((await t.run(ctx=>ctx.db.get(taskId)))?.pollCount).toBe(10);
  });
  it('supports one ballot per user, changing a choice and removing a vote',async()=>{
    const {t,user,create}=await setup();const pollId=await create();const member=user('member');await member.mutation(api.polls.vote,{pollId,optionId:'option-1'});await member.mutation(api.polls.vote,{pollId,optionId:'option-1'});await member.mutation(api.polls.vote,{pollId,optionId:'option-2'});let poll=await t.run(ctx=>ctx.db.get(pollId));expect(poll?.totalVotes).toBe(1);expect(poll?.options.map(row=>row.votes)).toEqual([0,1]);await expect(member.mutation(api.polls.vote,{pollId,optionId:'other-poll-option'})).rejects.toThrow();await member.mutation(api.polls.vote,{pollId});await member.mutation(api.polls.vote,{pollId});poll=await t.run(ctx=>ctx.db.get(pollId));expect(poll?.totalVotes).toBe(0);expect(poll?.options.map(row=>row.votes)).toEqual([0,0]);expect(await t.run(ctx=>ctx.db.query('taskPollVotes').collect())).toHaveLength(0);
  });
  it('serializes concurrent ballots and exposes only the caller choice',async()=>{
    const {t,user,taskId,create}=await setup();const pollId=await create();await Promise.all([user('member').mutation(api.polls.vote,{pollId,optionId:'option-1'}),user('member').mutation(api.polls.vote,{pollId,optionId:'option-2'}),user('other').mutation(api.polls.vote,{pollId,optionId:'option-1'})]);const poll=await t.run(ctx=>ctx.db.get(pollId));expect(poll?.totalVotes).toBe(2);expect(poll?.options.reduce((sum,row)=>sum+row.votes,0)).toBe(2);expect(await t.run(ctx=>ctx.db.query('taskPollVotes').collect())).toHaveLength(2);expect((await user('member').query(api.polls.list,{taskId})).items[0].myVote).not.toBeNull();const viewer=(await user('viewer').query(api.polls.list,{taskId})).items[0];expect(viewer.myVote).toBeNull();expect(viewer).not.toHaveProperty('voters');
  });
  it('allows only the poll creator or managers to close and retains results',async()=>{
    const {t,user,taskId,create}=await setup();const pollId=await create('member');await user('owner').mutation(api.polls.vote,{pollId,optionId:'option-1'});await expect(user('other').mutation(api.polls.close,{pollId})).rejects.toThrow();await user('member').mutation(api.polls.close,{pollId});await user('owner').mutation(api.polls.close,{pollId});await expect(user('owner').mutation(api.polls.vote,{pollId,optionId:'option-2'})).rejects.toThrow();expect((await user('viewer').query(api.polls.list,{taskId})).items[0]).toMatchObject({status:'closed',totalVotes:1,canVote:false});const another=await create('member');await user('admin').mutation(api.polls.close,{pollId:another});expect((await t.run(ctx=>ctx.db.get(another)))?.status).toBe('closed');
  });
  it.each(['owner','member'])('notifies eligible teammates when %s creates a poll',async author=>{
    const {t,user,create}=await setup();const pollId=await create(author);await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});const notices=await t.run(ctx=>ctx.db.query('notifications').collect());expect(notices).toHaveLength(3);expect(notices.every(row=>row.kind==='poll_created'&&row.pollId===pollId&&row.recipientId!==author&&row.recipientId!=='viewer')).toBe(true);if(author==='member')expect((await user('owner').query(api.notifications.mine,{}))[0]?.pollId).toBe(pollId);
  });
  it('hides existing poll notices immediately after revocation or Viewer downgrade',async()=>{
    const {t,user,workspaceId,taskId,create}=await setup();const pollId=await create();await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});await t.run(async ctx=>{for(const name of ['member','other']){const member=await ctx.db.query('workspaceMembers').withIndex('by_workspace_user',q=>q.eq('workspaceId',workspaceId).eq('userId',name)).unique();if(name==='member')await ctx.db.delete(member!._id);else await ctx.db.patch(member!._id,{role:'viewer'});}});expect(await user('member').query(api.notifications.mine,{})).toHaveLength(0);expect(await user('other').query(api.notifications.mine,{})).toHaveLength(0);await expect(user('member').query(api.polls.list,{taskId})).rejects.toThrow();await expect(user('member').mutation(api.polls.vote,{pollId,optionId:'option-1'})).rejects.toThrow();
  });
  it('pages notification fan-out beyond 100 members without duplicates',async()=>{
    const {t,workspaceId,create}=await setup();await t.run(async ctx=>{for(let n=0;n<115;n++)await ctx.db.insert('workspaceMembers',{workspaceId,userId:`extra-${n}`,role:'member',joinedAt:2});});const pollId=await create();await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});const jobs=await t.run(ctx=>ctx.db.system.query('_scheduled_functions').collect());const next=jobs.find(job=>job.name==='polls:notifyPage'&&job.args[0].cursor);expect(next).toBeTruthy();await t.mutation(internal.polls.notifyPage,next!.args[0]);expect(await t.run(ctx=>ctx.db.query('notifications').collect())).toHaveLength(118);
  });
  it('purges votes and notices after task deletion and suppresses late fan-out',async()=>{
    const {t,user,taskId,create}=await setup();const pollId=await create();await user('member').mutation(api.polls.vote,{pollId,optionId:'option-1'});await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});await user('owner').mutation(api.projectTasks.remove,{taskId});expect(await user('member').query(api.notifications.mine,{})).toHaveLength(0);await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});await t.mutation(internal.polls.purge,{pollId});expect(await t.run(ctx=>ctx.db.get(pollId))).toBeNull();expect(await t.run(ctx=>ctx.db.query('taskPollVotes').collect())).toHaveLength(0);expect(await t.run(ctx=>ctx.db.query('notifications').collect())).toHaveLength(0);
  });
  it('invalidates deadline alerts without reading or invalidating poll notices',async()=>{
    const {t,user,taskId,projectId,create}=await setup();const pollId=await create();await t.mutation(internal.polls.notifyPage,{pollId,cursor:null});
    const deadlineId=await t.run(ctx=>ctx.db.insert('notifications',{recipientId:'member',actorId:'system',projectId,taskId,kind:'deadline_upcoming',message:'Due soon',isRead:false,createdAt:1}));
    await user('owner').mutation(api.projectTasks.update,{taskId,title:'Choose a direction',description:'',priority:'medium',dueDate:'2026-12-10',assigneeId:'member'});
    expect((await t.run(ctx=>ctx.db.get(deadlineId)))?.isActive).toBe(false);expect((await t.run(ctx=>ctx.db.query('notifications').collect())).filter(row=>row.kind==='poll_created').every(row=>row.isActive===true)).toBe(true);
  });
  it('resolves author display names without exposing private profile fields',async()=>{
    const {t,user,taskId,create}=await setup();await t.run(ctx=>ctx.db.insert('profiles',{userId:'owner',fullName:'Người dùng',accountName:'Project owner',bio:'PRIVATE_BIO',phone:'PRIVATE_PHONE',createdAt:1,updatedAt:1}));await create();
    const row=(await user('member').query(api.polls.list,{taskId})).items[0];expect(row.author).toBe('Project owner');expect(JSON.stringify(row)).not.toContain('PRIVATE');
  });
});
