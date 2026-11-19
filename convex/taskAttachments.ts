import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE, attachmentType, validFileName } from "./attachmentFiles";
import { requireIdentity, requireMember } from "./permissions";

export const attachmentTarget = v.union(v.object({kind:v.literal("tasks"),id:v.id("tasks")}),v.object({kind:v.literal("projectTasks"),id:v.id("projectTasks")}));
export type AttachmentTarget = Infer<typeof attachmentTarget>;
type Ctx = QueryCtx | MutationCtx;
const denied=()=>new ConvexError("This task is unavailable or your access has changed.");
async function access(ctx:Ctx,target:AttachmentTarget,userId:string){
  if(target.kind==='tasks'){
    const task=await ctx.db.get(target.id);if(!task||task.ownerId!==userId)throw denied();
    return {canWrite:true,manager:true,workspaceId:undefined};
  }
  const task=await ctx.db.get(target.id);if(!task)throw denied();
  const project=await ctx.db.get(task.projectId);if(!project)throw denied();
  const member=await requireMember(ctx,project.workspaceId,userId);
  const manager=member.role==='owner'||member.role==='admin';
  const canWrite=project.status==='active'&&member.role!=='viewer'&&(manager||(task.status!=='done'&&(task.createdBy===userId||task.assigneeId===userId)));
  return {canWrite,manager,workspaceId:project.workspaceId};
}
function targetOf(row:Doc<'taskAttachments'>):AttachmentTarget{return {kind:row.taskType,id:row.taskId} as AttachmentTarget;}
async function priorUpload(ctx:Ctx,userId:string,uploadId:string,target:AttachmentTarget){
  const prior=await ctx.db.query('taskAttachments').withIndex('by_uploader_upload',q=>q.eq('uploadedBy',userId).eq('uploadId',uploadId)).unique();
  if(prior&&(prior.taskType!==target.kind||prior.taskId!==target.id))throw new ConvexError("This upload belongs to another task.");
  return prior;
}
export const list=query({args:{target:attachmentTarget},handler:async(ctx,{target})=>{
  const identity=await requireIdentity(ctx);const permissions=await access(ctx,target,identity.subject);
  const rows=await ctx.db.query('taskAttachments').withIndex('by_task',q=>q.eq('taskId',target.id)).take(MAX_ATTACHMENTS);
  return Promise.all(rows.map(async row=>{
    let uploader='You';
    if(row.uploadedBy!==identity.subject){
      const member=permissions.workspaceId?await ctx.db.query('workspaceMembers').withIndex('by_workspace_user',q=>q.eq('workspaceId',permissions.workspaceId!).eq('userId',row.uploadedBy)).unique():null;
      const profile=member?await ctx.db.query('profiles').withIndex('by_user',q=>q.eq('userId',row.uploadedBy)).unique():null;
      uploader=member?(profile?.fullName?.trim()||profile?.accountName?.trim()||'Team member'):'Former member';
    }
    return {_id:row._id,name:row.name,size:row.size,contentType:row.contentType,createdAt:row.createdAt,uploader,
      canRemove:permissions.canWrite&&(permissions.manager||row.uploadedBy===identity.subject)};
  }));
}});
export const authorizeUpload=internalQuery({args:{target:attachmentTarget,userId:v.string(),uploadId:v.string()},handler:async(ctx,args)=>{
  if(!(await access(ctx,args.target,args.userId)).canWrite)throw denied();
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(args.uploadId))throw new ConvexError("Invalid upload identifier.");
  const prior=await priorUpload(ctx,args.userId,args.uploadId,args.target);if(prior)return prior._id;
  const existing=await ctx.db.query('taskAttachments').withIndex('by_task',q=>q.eq('taskId',args.target.id)).take(MAX_ATTACHMENTS);
  if(existing.length>=MAX_ATTACHMENTS)throw new ConvexError("A task can have up to 10 attachments.");return null;
}});
export const attach=internalMutation({args:{target:attachmentTarget,userId:v.string(),uploadId:v.string(),storageId:v.id('_storage'),name:v.string()},handler:async(ctx,args)=>{
  if(!(await access(ctx,args.target,args.userId)).canWrite)throw denied();
  const prior=await priorUpload(ctx,args.userId,args.uploadId,args.target);if(prior)return {id:prior._id,reused:true};
  if(!validFileName(args.name))throw new ConvexError("Choose a supported file with a valid name.");
  const existing=await ctx.db.query('taskAttachments').withIndex('by_task',q=>q.eq('taskId',args.target.id)).take(MAX_ATTACHMENTS);
  if(existing.length>=MAX_ATTACHMENTS)throw new ConvexError("A task can have up to 10 attachments.");
  const metadata=await ctx.db.system.get(args.storageId);
  if(!metadata||!metadata.size||metadata.size>MAX_ATTACHMENT_SIZE||metadata.contentType!==attachmentType(args.name))throw new ConvexError("Invalid attachment.");
  const id=await ctx.db.insert('taskAttachments',{taskId:args.target.id,taskType:args.target.kind,storageId:args.storageId,name:args.name,
    contentType:metadata.contentType,size:metadata.size,uploadedBy:args.userId,uploadId:args.uploadId,createdAt:Date.now()});
  await ctx.db.patch(args.target.id,{attachmentCount:existing.length+1});return {id,reused:false};
}});
export const download=internalQuery({args:{id:v.id('taskAttachments'),userId:v.string()},handler:async(ctx,args)=>{
  const row=await ctx.db.get(args.id);if(!row)throw denied();await access(ctx,targetOf(row),args.userId);return {storageId:row.storageId,name:row.name,contentType:row.contentType};
}});
export const remove=mutation({args:{id:v.id('taskAttachments')},handler:async(ctx,{id})=>{
  const identity=await requireIdentity(ctx);const row=await ctx.db.get(id);if(!row)throw denied();
  const target=targetOf(row);const permissions=await access(ctx,target,identity.subject);
  if(!permissions.canWrite||(!permissions.manager&&row.uploadedBy!==identity.subject))throw denied();
  const rows=await ctx.db.query('taskAttachments').withIndex('by_task',q=>q.eq('taskId',target.id)).take(MAX_ATTACHMENTS);
  await ctx.storage.delete(row.storageId);await ctx.db.delete(id);await ctx.db.patch(target.id,{attachmentCount:Math.max(0,rows.length-1)});return null;
}});
export async function deleteTaskAttachments(ctx:MutationCtx,taskId:Id<'tasks'>|Id<'projectTasks'>){
  const rows=await ctx.db.query('taskAttachments').withIndex('by_task',q=>q.eq('taskId',taskId)).take(MAX_ATTACHMENTS);
  for(const row of rows){await ctx.storage.delete(row.storageId);await ctx.db.delete(row._id);}
}
