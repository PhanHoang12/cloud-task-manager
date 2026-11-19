import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQuery } from 'convex/react';
import { Check, Download, Eye, FileImage, FileText, Paperclip, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { AttachmentTarget } from '../../convex/taskAttachments';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE, attachmentType, fileSize, validFileName } from '../lib/attachmentRules';
import ModalDialog from './ModalDialog';
import ScreenErrorBoundary from './ScreenErrorBoundary';
import { useDraftGuard } from './NavigationExperience';
import { useFeedback } from './Feedback';

type Props={target:AttachmentTarget;title:string;editable:boolean;onClose:()=>void};
type QueueItem={id:string;file:File;status:'queued'|'uploading'|'done'|'failed'|'cancelled';progress:number;error?:string;attachmentId?:string};
type FileRow={_id:string;name:string;size:number;contentType:string;createdAt:number;uploader:string;canRemove:boolean};
export default function TaskAttachments(props:Props){
 const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 const dismiss=useDraftGuard(dirty,busy);const close=()=>dismiss(props.onClose);
 return <ModalDialog className="attachment-overlay" label={`Attachments for ${props.title}`} busy={busy} onDismiss={close}>
  <section className="attachment-dialog">
   <header className="attachment-header"><div><h2><Paperclip size={20} aria-hidden="true"/>Attachments</h2><p>{props.title}</p></div><button type="button" className="ui-button ui-secondary ui-icon" aria-label="Close attachments" disabled={busy} onClick={close}><X size={20}/></button></header>
   <ScreenErrorBoundary scope="Attachments" resetKey={`${props.target.kind}:${props.target.id}`} onReturn={props.onClose} returnLabel="Close attachments" compact>
    <AttachmentContent {...props} onBusy={setBusy} onDirty={setDirty}/>
   </ScreenErrorBoundary>
  </section>
 </ModalDialog>;
}
function AttachmentContent({target,editable,onBusy,onDirty}:Props&{onBusy:(value:boolean)=>void;onDirty:(value:boolean)=>void}){
 const rows=useQuery(api.taskAttachments.list,{target});const remove=useMutation(api.taskAttachments.remove);const {getToken,sessionClaims}=useAuth();
 // Match ConvexProviderWithClerk for both the native integration and legacy JWT templates.
 const tokenForConvex=()=>getToken(sessionClaims?.aud==='convex'?{skipCache:true}:{template:'convex',skipCache:true});
 const {notify,confirm}=useFeedback();const input=useRef<HTMLInputElement>(null);
 const [queue,setQueue]=useState<QueueItem[]>([]),[uploading,setUploading]=useState(false),[working,setWorking]=useState<string|null>(null);
 const [preview,setPreview]=useState<{id:string;url:string;type:string;name:string}|null>(null);
 const live=useRef(true),queueRef=useRef<QueueItem[]>([]),running=useRef(false),cancel=useRef(false),xhrRef=useRef<XMLHttpRequest|null>(null),io=useRef<AbortController|null>(null),ioLock=useRef(false),urls=useRef(new Set<string>()),timers=useRef(new Set<ReturnType<typeof setTimeout>>());
 const site=()=>{
  const cloud=import.meta.env.VITE_CONVEX_URL?.trim();if(!cloud||!/^https:\/\/[^/]+\.convex\.cloud\/?$/.test(cloud))throw new Error('The data connection is unavailable.');
  return cloud.replace(/\/$/,'').replace(/\.cloud$/,'.site');
 };
 function update(fn:(value:QueueItem[])=>QueueItem[]){queueRef.current=fn(queueRef.current);if(live.current)setQueue(queueRef.current);}
 useEffect(()=>{live.current=true;return()=>{live.current=false;cancel.current=true;xhrRef.current?.abort();io.current?.abort();for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();for(const timer of timers.current)clearTimeout(timer);timers.current.clear();onBusy(false);onDirty(false);};},[onBusy,onDirty]);
 useEffect(()=>{onBusy(uploading||working!==null);},[uploading,working,onBusy]);
 useEffect(()=>{onDirty(queue.some(item=>item.status==='failed'||item.status==='cancelled'||item.status==='queued'));},[queue,onDirty]);
 useEffect(()=>{if(rows&&queueRef.current.some(item=>item.status==='done'&&rows.some(row=>row._id===item.attachmentId)))update(items=>items.filter(item=>item.status!=='done'||!rows.some(row=>row._id===item.attachmentId)));},[rows]);
 function uploadOne(item:QueueItem,token:string){return new Promise<string>((resolve,reject)=>{
  const request=new XMLHttpRequest();xhrRef.current=request;
  request.open('POST',`${site()}/task-attachments/upload?${new URLSearchParams({kind:target.kind,id:target.id})}`);
  request.setRequestHeader('Authorization',`Bearer ${token}`);request.setRequestHeader('Content-Type',attachmentType(item.file.name));
  request.setRequestHeader('X-Attachment-Name',encodeURIComponent(item.file.name));request.setRequestHeader('X-Upload-Id',item.id);request.timeout=120000;
  request.upload.onprogress=event=>{if(event.lengthComputable)update(items=>items.map(row=>row.id===item.id?{...row,progress:Math.min(100,Math.round(event.loaded/event.total*100))}:row));};
  request.onload=()=>{if(request.status>=200&&request.status<300){try{const result=JSON.parse(request.responseText);if(!result.id)throw new Error();resolve(result.id);}catch{reject(new Error('The upload response was incomplete. Retry safely.'));}}else reject(new Error(request.responseText||'Could not upload this file.'));};
  request.onerror=()=>reject(new Error('Connection lost. Retry this file.'));request.ontimeout=()=>reject(new Error('Upload timed out. Retry this file.'));
  request.onabort=()=>reject(new DOMException('Upload cancelled.','AbortError'));
  request.send(item.file);
 });}
 async function runQueue(){
  if(running.current||!editable)return;running.current=true;cancel.current=false;setUploading(true);let succeeded=0;
  try{
   for(const item of queueRef.current){
    if(item.status!=='queued')continue;if(cancel.current||!live.current)break;
    update(items=>items.map(row=>row.id===item.id?{...row,status:'uploading',error:undefined,progress:0}:row));
    try{
     const token=await tokenForConvex();if(!token)throw new Error('Your session expired. Please sign in again.');if(cancel.current||!live.current)throw new DOMException('Upload cancelled.','AbortError');
     const id=await uploadOne(item,token);succeeded++;update(items=>items.map(row=>row.id===item.id?{...row,status:'done',progress:100,attachmentId:id}:row));
    }catch(error){const aborted=error instanceof DOMException&&error.name==='AbortError';update(items=>items.map(row=>row.id===item.id?{...row,status:aborted?'cancelled':'failed',error:aborted?'Upload cancelled. You can retry.':error instanceof Error?error.message:'Could not upload this file.'}:row));}
   }
  }finally{
   if(cancel.current)update(items=>items.map(item=>item.status==='queued'?{...item,status:'cancelled',error:'Upload cancelled. You can retry.'}:item));
   running.current=false;xhrRef.current=null;if(live.current){setUploading(false);if(succeeded)notify(`${succeeded} ${succeeded===1?'file attached.':'files attached.'}`);}
  }
 }
 function choose(files:File[]){
  if(running.current||ioLock.current||!editable||!rows)return;
  if(files.length+rows.length+queueRef.current.filter(item=>item.status!=='done').length>MAX_ATTACHMENTS){notify('A task can have up to 10 attachments. Remove queued files or choose fewer files.','error');return;}
  const items=files.map(file=>{let error:string|undefined;
   if(!validFileName(file.name))error='Choose a PDF, DOCX, JPG, PNG or WebP file with a valid name.';
   else if(!file.size||file.size>MAX_ATTACHMENT_SIZE)error='Each file must be non-empty and 10 MB or smaller.';
   return {id:crypto.randomUUID(),file,status:error?'failed':'queued',progress:0,error} as QueueItem;
  });update(current=>[...current,...items]);void runQueue();
 }
 function change(event:ChangeEvent<HTMLInputElement>){choose(Array.from(event.target.files??[]));event.target.value='';}
 async function retrieve(row:FileRow,mode:'download'|'preview'){
  if(ioLock.current||running.current)return;ioLock.current=true;setWorking(row._id);const controller=new AbortController();io.current=controller;
  try{
   const token=await tokenForConvex();if(!token)throw new Error('Your session expired. Please sign in again.');if(!live.current)return;
   const response=await fetch(`${site()}/task-attachments/download?${new URLSearchParams({id:row._id})}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('This file is unavailable or your access has changed.');
   const blob=await response.blob();if(!live.current)return;const url=URL.createObjectURL(blob);urls.current.add(url);
   if(mode==='preview'){
    if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview({id:row._id,url,type:row.contentType,name:row.name});
   }else{const anchor=document.createElement('a');anchor.href=url;anchor.download=row.name;document.body.appendChild(anchor);anchor.click();anchor.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.current.delete(url);timers.current.delete(timer);},30000);timers.current.add(timer);}
  }catch(error){if(live.current&&!(error instanceof DOMException&&error.name==='AbortError'))notify(error instanceof Error?error.message:'Could not load this file.','error');}
  finally{ioLock.current=false;io.current=null;if(live.current)setWorking(null);}
 }
 async function removeFile(row:FileRow){
  if(ioLock.current||running.current||!row.canRemove)return;
  if(!await confirm({title:'Remove attachment?',description:`Remove “${row.name}” from this task? The task will be kept.`,confirmLabel:'Remove file'}))return;
  ioLock.current=true;setWorking(row._id);
  try{await remove({id:row._id as Parameters<typeof remove>[0]['id']});if(preview?.id===row._id){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);setPreview(null);}notify('Attachment removed.');}
  catch{notify('Could not remove this file. Check your access and try again.','error');}
  finally{ioLock.current=false;if(live.current)setWorking(null);}
 }
 if(rows===undefined)return <p className="attachment-loading" role="status">Loading attachments…</p>;
 const busy=uploading||working!==null;
 return <>
  {editable&&<div className="attachment-dropzone" onDragOver={event=>{event.preventDefault();event.stopPropagation();}} onDrop={event=>{event.preventDefault();event.stopPropagation();choose(Array.from(event.dataTransfer.files));}}>
   <Upload size={22} aria-hidden="true"/><div><strong>Drop files here</strong><p>PDF, DOCX, JPG, PNG, WebP · 10 MB each · 10 files per task</p></div>
   <button type="button" className="ui-button ui-primary" disabled={busy||rows.length>=MAX_ATTACHMENTS} onClick={()=>input.current?.click()}>Add files</button>
   <input ref={input} type="file" multiple accept={ATTACHMENT_ACCEPT} aria-label="Choose task attachments" hidden disabled={busy||rows.length>=MAX_ATTACHMENTS} onChange={change}/>
  </div>}
  {preview&&<section className="attachment-preview" aria-label={`Preview ${preview.name}`}><header><strong>{preview.name}</strong><button type="button" className="ui-button ui-secondary ui-icon" aria-label="Close file preview" onClick={()=>{URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);setPreview(null);}}><X size={16}/></button></header>
   {preview.type.startsWith('image/')?<img src={preview.url} alt={preview.name}/>:<iframe src={preview.url} title={`PDF preview: ${preview.name}`} sandbox=""/>}
   {preview.type==='application/pdf'&&<p>Use Download if your browser cannot display the PDF preview.</p>}
  </section>}
  <div className="attachment-list-heading"><h3>Files <span>{rows.length}/{MAX_ATTACHMENTS}</span></h3>{!editable&&<span>Read-only</span>}</div>
  {rows.length===0&&<p className="attachment-empty">No attachments yet.</p>}
  <ul className="attachment-list">{rows.map(row=><li key={row._id}>
   <span className={`attachment-file-icon ${row.contentType.startsWith('image/')?'is-image':row.contentType==='application/pdf'?'is-pdf':'is-document'}`}>{row.contentType.startsWith('image/')?<FileImage size={20}/>:<FileText size={20}/>}</span>
   <div className="attachment-file-copy"><strong title={row.name}>{row.name}</strong><span>{fileSize(row.size)} · {row.uploader} · {new Date(row.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>
   <div className="attachment-file-actions">{(row.contentType.startsWith('image/')||row.contentType==='application/pdf')&&<button className="ui-button ui-secondary ui-icon" type="button" aria-label={`Preview ${row.name}`} disabled={busy} onClick={()=>void retrieve(row,'preview')}><Eye size={16}/></button>}
    <button className="ui-button ui-secondary ui-icon" type="button" aria-label={`Download ${row.name}`} disabled={busy} onClick={()=>void retrieve(row,'download')}><Download size={16}/></button>
    {row.canRemove&&<button className="ui-button ui-danger ui-icon" type="button" aria-label={`Remove ${row.name}`} disabled={busy} onClick={()=>void removeFile(row)}><Trash2 size={16}/></button>}</div>
  </li>)}</ul>
  {queue.length>0&&<section className="attachment-queue" aria-label="Upload queue"><div className="attachment-list-heading"><h3>Uploads</h3>{uploading&&<button type="button" className="ui-button ui-secondary" onClick={()=>{cancel.current=true;xhrRef.current?.abort();}}>Cancel uploads</button>}</div>
   {queue.map(item=><div className="attachment-queue-item" key={item.id}><div className="attachment-file-copy"><strong>{item.file.name}</strong><span>{item.status==='uploading'?(item.progress===100?'Processing…':`Uploading ${item.progress}%`):item.status==='done'?'Attached':item.error||'Waiting'}</span>
    {item.status==='uploading'&&<progress max={100} value={item.progress} aria-label={`Upload progress for ${item.file.name}`}/>}</div>
    {item.status==='done'?<Check size={18} aria-label="Attached"/>:item.status!=='uploading'&&<div className="attachment-file-actions">{editable&&<button type="button" className="ui-button ui-secondary ui-icon" aria-label={`Retry ${item.file.name}`} disabled={busy||!validFileName(item.file.name)||!item.file.size||item.file.size>MAX_ATTACHMENT_SIZE} onClick={()=>{update(items=>items.map(row=>row.id===item.id?{...row,status:'queued',error:undefined}:row));void runQueue();}}><RotateCcw size={16}/></button>}<button type="button" className="ui-button ui-secondary ui-icon" disabled={busy} aria-label={`Dismiss ${item.file.name}`} onClick={()=>update(items=>items.filter(row=>row.id!==item.id))}><X size={16}/></button></div>}
   </div>)}
  </section>}
 </>;
}
