import { lazy, Suspense, useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { AttachmentTarget } from '../../convex/taskAttachments';
import './attachments.css';
const AttachmentDialog=lazy(()=>import('./TaskAttachments'));
export default function AttachmentButton({target,title,count=0,editable,disabled=false}:{target:AttachmentTarget;title:string;count?:number;editable:boolean;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 return <>
  <button className="attachment-trigger" type="button" disabled={disabled} title="Attachments" aria-haspopup="dialog" aria-label={`Attachments for ${title}, ${count} files`} onClick={()=>setOpen(true)}><Paperclip size={15} aria-hidden="true"/><span>{count}</span></button>
  {open&&<Suspense fallback={<span className="attachment-opening" role="status">Opening attachments…</span>}><AttachmentDialog target={target} title={title} editable={editable} onClose={()=>setOpen(false)}/></Suspense>}
 </>;
}
