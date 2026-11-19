/// <reference types="vite/client" />
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {convexTest} from 'convex-test';
import {strToU8,zipSync} from 'fflate';
import schema from './schema';
import {api,internal} from './_generated/api';
import {attachmentType,validAttachment,MAX_ATTACHMENT_SIZE} from './attachmentFiles';
import type {AttachmentTarget} from './taskAttachments';
const modules=import.meta.glob('./**/*.ts');const origin='https://demo.example.com';
const pdf=strToU8('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const docx=()=>zipSync({'[Content_Types].xml':strToU8('<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<Relationships/>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'),'word/printerSettings/printerSettings1.bin':new Uint8Array([1,2])});
beforeEach(()=>vi.stubEnv('AVATAR_ALLOWED_ORIGIN',origin));afterEach(()=>vi.unstubAllEnvs());
async function setup(){
 const t=convexTest(schema,modules);
 const ids=await t.run(async ctx=>{
  const workspaceId=await ctx.db.insert('workspaces',{name:'Files',description:'',ownerId:'owner',createdAt:1,updatedAt:1});
  for(const role of ['owner','admin','member','viewer'] as const)await ctx.db.insert('workspaceMembers',{workspaceId,userId:role,role,joinedAt:1});
  const projectId=await ctx.db.insert('projects',{workspaceId,name:'Launch',description:'',status:'active',createdBy:'owner',createdAt:1,updatedAt:1});
  const taskId=await ctx.db.insert('projectTasks',{projectId,title:'Task with files',description:'',createdBy:'member',assigneeId:'member',status:'todo',priority:'medium',position:1,createdAt:1,updatedAt:1});
  const personalId=await ctx.db.insert('tasks',{ownerId:'owner',title:'Personal',description:'',status:'todo',priority:'low',createdAt:1,updatedAt:1});return{workspaceId,projectId,taskId,personalId};
 });let sequence=0;
 const post=(target:AttachmentTarget,user='owner',name='plan.pdf',bytes:Uint8Array=pdf,key=`upload-identifier-${++sequence}`,requestOrigin=origin)=>t.withIdentity({subject:user}).fetch(`/task-attachments/upload?kind=${target.kind}&id=${target.id}`,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':attachmentType(name)||'application/octet-stream','X-Attachment-Name':encodeURIComponent(name),'X-Upload-Id':key},body:bytes as BodyInit});
 const download=(id:string,user='owner')=>t.withIdentity({subject:user}).fetch(`/task-attachments/download?id=${id}`,{headers:{Origin:origin}});
 return{t,...ids,post,download};
}
describe('Task document attachments',()=>{
 it('rejects unauthenticated requests and disallowed origins for both upload and download',async()=>{
  const {t,taskId,post}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  expect((await t.fetch('/task-attachments/upload',{method:'POST',headers:{Origin:origin}})).status).toBe(401);
  expect((await t.fetch('/task-attachments/download?id=unknown',{headers:{Origin:origin}})).status).toBe(401);
  expect((await post(target,'owner','plan.pdf',pdf,undefined,'https://untrusted.example')).status).toBe(403);
  expect((await t.fetch('/task-attachments/download?id=unknown',{headers:{Origin:'https://untrusted.example'}})).status).toBe(403);
  expect((await t.fetch('/task-attachments/upload',{method:'OPTIONS',headers:{Origin:origin}})).status).toBe(204);
 });
 it('stores PDF, DOCX and images with a reactive count while returning no storage IDs or public URLs',async()=>{
  const {t,taskId,post}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  for(const [name,bytes]of [['plan.pdf',pdf],['report.docx',docx()],['diagram.png',png]] as const)expect((await post(target,'member',name,bytes)).status).toBe(200);
  expect((await t.run(ctx=>ctx.db.get(taskId)))?.attachmentCount).toBe(3);
  const rows=await t.withIdentity({subject:'viewer'}).query(api.taskAttachments.list,{target});expect(rows).toHaveLength(3);
  expect(rows[0]).not.toHaveProperty('storageId');expect(rows[0]).not.toHaveProperty('url');expect(rows[0]).not.toHaveProperty('uploadedBy');
  expect(rows.every(row=>!row.canRemove)).toBe(true);
 });
 it('authorizes every download, emits private/no-store and attachment headers, and denies revoked viewers',async()=>{
  const {t,taskId,workspaceId,post,download}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  const response=await post(target,'owner','Thiết kế.pdf');const {id}=await response.json();
  const file=await download(id,'viewer');expect(file.status).toBe(200);expect(file.headers.get('cache-control')).toContain('no-store');expect(file.headers.get('x-content-type-options')).toBe('nosniff');
  expect(file.headers.get('content-disposition')).toContain(encodeURIComponent('Thiết kế.pdf'));expect(new Uint8Array(await file.arrayBuffer())).toEqual(pdf);
  expect((await download(id,'outsider')).status).toBe(404);
  await t.run(async ctx=>{const member=await ctx.db.query('workspaceMembers').withIndex('by_workspace_user',q=>q.eq('workspaceId',workspaceId).eq('userId','viewer')).unique();await ctx.db.delete(member!._id);});
  expect((await download(id,'viewer')).status).toBe(404);
 });
 it('enforces personal ownership and permits workspace read-only users to read but never upload/remove',async()=>{
  const {t,personalId,taskId,post,download}=await setup();const personal={kind:'tasks',id:personalId} as const;const shared={kind:'projectTasks',id:taskId} as const;
  expect((await post(personal,'member')).status).toBe(403);const {id}=await(await post(personal)).json();expect((await download(id,'member')).status).toBe(404);
  await expect(t.withIdentity({subject:'member'}).query(api.taskAttachments.list,{target:personal})).rejects.toThrow();
  const {id:sharedId}=await(await post(shared)).json();expect((await post(shared,'viewer')).status).toBe(403);
  await expect(t.withIdentity({subject:'viewer'}).mutation(api.taskAttachments.remove,{id:sharedId})).rejects.toThrow();
  expect((await download(sharedId,'viewer')).status).toBe(200);
 });
 it('retains completed/archived task write rules without preventing authorized downloads',async()=>{
  const {t,taskId,projectId,post,download}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  const {id}=await(await post(target,'member')).json();await t.run(ctx=>ctx.db.patch(taskId,{status:'done'}));
  expect((await post(target,'member')).status).toBe(403);expect((await post(target,'admin')).status).toBe(200);
  await t.run(ctx=>ctx.db.patch(projectId,{status:'archived'}));expect((await post(target,'owner')).status).toBe(403);
  expect((await download(id,'member')).status).toBe(200);
 });
 it('rejects mismatched media, executable/macro formats, fake DOCX, traversal names and empty/oversize bodies',async()=>{
  const {t,taskId,post}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  for(const [name,bytes]of [['script.svg',png],['report.docx',pdf],['wrong.pdf',png],['../plan.pdf',pdf],['empty.pdf',new Uint8Array()],['macro.docm',docx()]] as const)expect((await post(target,'owner',name,bytes)).status).toBe(415);
  expect((await post(target,'owner','large.pdf',new Uint8Array(MAX_ATTACHMENT_SIZE+1))).status).toBe(413);
  expect((await t.run(ctx=>ctx.db.query('taskAttachments').collect()))).toHaveLength(0);
 });
 it('deduplicates retries and cleans up storage and counts when removing files',async()=>{
  const {t,taskId,post}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  const first=await(await post(target,'member','plan.pdf',pdf,'same-upload-identifier')).json();
  const retry=await(await post(target,'member','plan.pdf',pdf,'same-upload-identifier')).json();expect(retry.id).toBe(first.id);
  const rows=await t.run(ctx=>ctx.db.query('taskAttachments').collect());expect(rows).toHaveLength(1);expect((await t.run(ctx=>ctx.db.get(taskId)))?.attachmentCount).toBe(1);
  await t.withIdentity({subject:'member'}).mutation(api.taskAttachments.remove,{id:first.id});
  expect(await t.run(ctx=>ctx.storage.get(rows[0].storageId))).toBeNull();expect((await t.run(ctx=>ctx.db.get(taskId)))?.attachmentCount).toBe(0);
 });
 it('enforces the ten-file limit and supports retry of an existing upload at that limit',async()=>{
  const {t,taskId,post}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  for(let n=0;n<10;n++)expect((await post(target,'owner',`plan-${n}.pdf`,pdf,`batch-identifier-${n}`)).status).toBe(200);
  expect((await post(target)).status).toBe(403);expect((await post(target,'owner','plan-0.pdf',pdf,'batch-identifier-0')).status).toBe(200);
  expect((await t.run(ctx=>ctx.db.query('taskAttachments').collect()))).toHaveLength(10);
 });
 it('rechecks task permissions at attachment commit, including revocation after upload authorization',async()=>{
  const {t,taskId,workspaceId}=await setup();const target={kind:'projectTasks',id:taskId} as const;
  await t.query(internal.taskAttachments.authorizeUpload,{target,userId:'member',uploadId:'revocation-identifier'});
  const storageId=await t.run(async ctx=>{const member=await ctx.db.query('workspaceMembers').withIndex('by_workspace_user',q=>q.eq('workspaceId',workspaceId).eq('userId','member')).unique();await ctx.db.delete(member!._id);return ctx.storage.store(new Blob([pdf],{type:'application/pdf'}));});
  await expect(t.mutation(internal.taskAttachments.attach,{target,userId:'member',storageId,uploadId:'revocation-identifier',name:'plan.pdf'})).rejects.toThrow();
  expect((await t.run(ctx=>ctx.db.query('taskAttachments').collect()))).toHaveLength(0);
 });
 it('cleans up all attachment metadata and files when either kind of task is deleted',async()=>{
  const {t,taskId,personalId,post}=await setup();await post({kind:'projectTasks',id:taskId});await post({kind:'tasks',id:personalId});
  const rows=await t.run(ctx=>ctx.db.query('taskAttachments').collect());const owner=t.withIdentity({subject:'owner'});
  await owner.mutation(api.projectTasks.remove,{taskId});await owner.mutation(api.tasks.remove,{id:personalId});
  expect((await t.run(ctx=>ctx.db.query('taskAttachments').collect()))).toHaveLength(0);
  for(const row of rows)expect(await t.run(ctx=>ctx.storage.get(row.storageId))).toBeNull();
 });
});
describe('Document content validation',()=>{
 it('accepts a normal DOCX with printer settings, not a renamed ZIP or a macro document',()=>{
  expect(validAttachment(docx(),'report.DOCX',attachmentType('report.docx'))).toBe(true);
  expect(validAttachment(zipSync({'text.txt':strToU8('not Word')}),'fake.docx',attachmentType('fake.docx'))).toBe(false);
  const macro=zipSync({'[Content_Types].xml':strToU8('macroEnabled'),'word/document.xml':strToU8('x'),'_rels/.rels':strToU8('x'),'word/vbaProject.bin':png});
  expect(validAttachment(macro,'fake.docx',attachmentType('fake.docx'))).toBe(false);
 });
 it('bounds decompression sizes before extracting XML and rejects duplicate/traversal archive paths',()=>{
  const zipped=zipSync({'[Content_Types].xml':new Uint8Array(3*1024*1024),'word/document.xml':png,'_rels/.rels':png});
  expect(validAttachment(zipped,'bomb.docx',attachmentType('bomb.docx'))).toBe(false);
  expect(validAttachment(zipSync({'../word/document.xml':png}),'unsafe.docx',attachmentType('unsafe.docx'))).toBe(false);
  const sentinel=docx();
  for(let offset=0;offset<sentinel.length-24;offset++){
   if(sentinel[offset]===0x50&&sentinel[offset+1]===0x4b&&sentinel[offset+2]===1&&sentinel[offset+3]===2){
    new DataView(sentinel.buffer,sentinel.byteOffset,sentinel.byteLength).setUint32(offset+24,0xffffffff,true);break;
   }
  }
  expect(validAttachment(sentinel,'oversize-metadata.docx',attachmentType('oversize-metadata.docx'))).toBe(false);
 });
});
