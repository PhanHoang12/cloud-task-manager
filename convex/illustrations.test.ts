/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { ImageTarget } from "./illustrations";
const modules = import.meta.glob("./**/*.ts");
const origin = "https://demo.example.com";
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
beforeEach(() => vi.stubEnv("AVATAR_ALLOWED_ORIGIN", origin));
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema,modules);
  const ids = await t.run(async ctx => {
    const workspaceId = await ctx.db.insert("workspaces",{ name:"Photos",description:"",ownerId:"owner",createdAt:1,updatedAt:1 });
    for (const role of ["owner","admin","member","viewer"] as const) await ctx.db.insert("workspaceMembers",{workspaceId,userId:role,role,joinedAt:1});
    const projectId = await ctx.db.insert("projects",{workspaceId,name:"Launch",description:"",status:"active",createdBy:"owner",createdAt:1,updatedAt:1});
    const taskId = await ctx.db.insert("projectTasks",{projectId,title:"Prepare design",description:"",createdBy:"member",assigneeId:"member",status:"todo",priority:"medium",position:1,createdAt:1,updatedAt:1});
    const personalId = await ctx.db.insert("tasks",{ownerId:"owner",title:"Personal",description:"",status:"todo",priority:"low",createdAt:1,updatedAt:1});
    return {workspaceId,projectId,taskId,personalId};
  });
  const post = (target: ImageTarget, user="owner", body: Uint8Array = png, type="image/png", requestOrigin=origin) =>
    t.withIdentity({subject:user}).fetch(`/upload-illustration?kind=${target.kind}&id=${target.id}`,{method:"POST",headers:{Origin:requestOrigin,"Content-Type":type},body:body as BodyInit});
  return {t,...ids,post};
}
describe("Card illustrations",()=>{
 it("rejects unauthenticated uploads and unexpected origins before storing files",async()=>{
  const {t,projectId,post}=await setup();
  expect((await t.fetch(`/upload-illustration?kind=projects&id=${projectId}`,{method:"POST",headers:{Origin:origin},body:png})).status).toBe(401);
  expect((await post({kind:"projects",id:projectId},"owner",png,"image/png","https://untrusted.example")).status).toBe(403);
  expect((await t.fetch('/upload-illustration',{method:'OPTIONS',headers:{Origin:origin}})).status).toBe(204);
 });
 it("stores a shared project cover, replaces it without orphaning the old file and removes it without deleting the project",async()=>{
  const {t,projectId,post}=await setup();const target={kind:"projects",id:projectId} as const;
  expect((await post(target)).status).toBe(200);
  const first=await t.run(ctx=>ctx.db.get(projectId));expect(first?.coverUrl).toBeTruthy();
  expect((await post(target,"admin")).status).toBe(200);
  const second=await t.run(ctx=>ctx.db.get(projectId));expect(second?.coverStorageId).not.toBe(first?.coverStorageId);
  expect(await t.run(ctx=>ctx.storage.get(first!.coverStorageId!))).toBeNull();
  const rows=await t.withIdentity({subject:"viewer"}).query(api.projects.list,{workspaceId:second!.workspaceId});
  expect(rows[0].coverUrl).toBe(second?.coverUrl);
  await t.withIdentity({subject:"owner"}).mutation(api.illustrations.remove,{target});
  expect(await t.run(ctx=>ctx.db.get(projectId))).toMatchObject({name:"Launch"});
  expect((await t.run(ctx=>ctx.db.get(projectId)))?.coverStorageId).toBeUndefined();
  expect(await t.run(ctx=>ctx.storage.get(second!.coverStorageId!))).toBeNull();
 });
 it("enforces project management, viewer, nonmember and personal ownership boundaries",async()=>{
  const {t,projectId,personalId,taskId,post}=await setup();
  for(const user of ["member","viewer","outsider"]) {
   expect((await post({kind:"projects",id:projectId},user)).status).toBe(403);
   await expect(t.withIdentity({subject:user}).mutation(api.illustrations.remove,{target:{kind:"projects",id:projectId}})).rejects.toThrow();
  }
  expect((await post({kind:"projectTasks",id:taskId},"viewer")).status).toBe(403);
  expect((await post({kind:"projectTasks",id:taskId},"outsider")).status).toBe(403);
  expect((await post({kind:"tasks",id:personalId},"member")).status).toBe(403);
  expect((await post({kind:"tasks",id:personalId})).status).toBe(200);
 });
 it("follows task edit and completion rules and blocks archived projects",async()=>{
  const {t,projectId,taskId,post}=await setup();const target={kind:"projectTasks",id:taskId} as const;
  expect((await post(target,"member")).status).toBe(200);
  await t.run(ctx=>ctx.db.patch(taskId,{status:"done"}));
  expect((await post(target,"member")).status).toBe(403);
  expect((await post(target,"admin")).status).toBe(200);
  await t.run(ctx=>ctx.db.patch(projectId,{status:"archived"}));
  expect((await post(target)).status).toBe(403);
 });
 it("rejects fake images, SVG, empty bodies and oversize streams and preserves the existing cover",async()=>{
  const {t,projectId,post}=await setup();const target={kind:"projects",id:projectId} as const;
  await post(target);const before=await t.run(ctx=>ctx.db.get(projectId));
  for(const [data,type,status] of [[new Uint8Array([1,2,3]),"image/png",415],[png,"image/svg+xml",415],[new Uint8Array(),"image/png",415],[new Uint8Array(2*1024*1024+1),"image/png",413]] as const){
   expect((await post(target,"owner",data as Uint8Array,type)).status).toBe(status);
  }
  expect((await t.run(ctx=>ctx.db.get(projectId)))?.coverStorageId).toBe(before?.coverStorageId);
 });
 it("rechecks membership at attach time when access was revoked during upload",async()=>{
  const {t,taskId,workspaceId}=await setup();const target={kind:"projectTasks",id:taskId} as const;
  await t.query(internal.illustrations.authorizeUpload,{target,userId:"member"});
  const storageId=await t.run(async ctx=>{
   const membership=await ctx.db.query("workspaceMembers").withIndex("by_workspace_user",q=>q.eq("workspaceId",workspaceId).eq("userId","member")).unique();
   await ctx.db.delete(membership!._id);return ctx.storage.store(new Blob([png],{type:"image/png"}));
  });
  await expect(t.mutation(internal.illustrations.attach,{target,userId:"member",storageId})).rejects.toThrow();
  expect((await t.run(ctx=>ctx.db.get(taskId)))?.coverUrl).toBeUndefined();
 });
 it("cleans up task images when personal or Kanban tasks are deleted",async()=>{
  const {t,personalId,taskId,post}=await setup();
  await post({kind:"tasks",id:personalId});await post({kind:"projectTasks",id:taskId});
  const [personal,task]=await t.run(async ctx=>[await ctx.db.get(personalId),await ctx.db.get(taskId)]);
  const owner=t.withIdentity({subject:"owner"});
  await owner.mutation(api.tasks.remove,{id:personalId});await owner.mutation(api.projectTasks.remove,{taskId});
  expect(await t.run(ctx=>ctx.storage.get(personal!.coverStorageId!))).toBeNull();
  expect(await t.run(ctx=>ctx.storage.get(task!.coverStorageId!))).toBeNull();
 });
});
