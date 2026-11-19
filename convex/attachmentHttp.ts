import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { AttachmentTarget } from './taskAttachments';
import type { Id } from './_generated/dataModel';
import { MAX_ATTACHMENT_SIZE, attachmentType, validAttachment, validFileName } from './attachmentFiles';
function cors(origin:string){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Attachment-Name, X-Upload-Id','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Expose-Headers':'Content-Disposition','Vary':'Origin','Cache-Control':'private, no-store'};}
function allowed(request:Request){const origin=request.headers.get('Origin')??'';return origin&&origin===process.env.AVATAR_ALLOWED_ORIGIN?origin:null;}
export const options=httpAction(async(_ctx,request):Promise<Response>=>{const origin=allowed(request);return new Response(null,{status:origin?204:403,headers:origin?cors(origin):{}});});
export const upload=httpAction(async(ctx,request):Promise<Response>=>{
  const origin=allowed(request);if(!origin)return new Response('Origin not allowed.',{status:403});
  const headers=cors(origin);const reply=(message:string,status:number)=>new Response(message,{status,headers});
  const identity=await ctx.auth.getUserIdentity();if(!identity)return reply('Your session expired. Please sign in again.',401);
  const params=new URL(request.url).searchParams;const kind=params.get('kind'),id=params.get('id');
  if(!id||!['tasks','projectTasks'].includes(kind??''))return reply('Invalid task.',400);
  const target={kind,id} as AttachmentTarget;const uploadId=request.headers.get('X-Upload-Id')??'';
  let name:string;try{name=decodeURIComponent(request.headers.get('X-Attachment-Name')??'');}catch{return reply('Invalid file name.',400);}
  const contentType=request.headers.get('Content-Type')??'';
  if(!validFileName(name)||attachmentType(name)!==contentType)return reply('Choose a PDF, DOCX, JPG, PNG or WebP file.',415);
  try{
    const prior=await ctx.runQuery(internal.taskAttachments.authorizeUpload,{target,userId:identity.subject,uploadId});
    if(prior)return new Response(JSON.stringify({id:prior}),{status:200,headers:{...headers,'Content-Type':'application/json'}});
  }catch{return reply('You cannot upload to this task, or it already has 10 attachments.',403);}
  if(Number(request.headers.get('Content-Length'))>MAX_ATTACHMENT_SIZE)return reply('Each file must be 10 MB or smaller.',413);
  const reader=request.body?.getReader();if(!reader)return reply('Choose a non-empty file.',400);
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_ATTACHMENT_SIZE){await reader.cancel();return reply('Each file must be 10 MB or smaller.',413);}chunks.push(value);}}
  catch{return reply('Upload interrupted. Please try again.',400);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(!validAttachment(bytes,name,contentType))return reply('The file contents do not match a supported PDF, DOCX or image.',415);
  let storageId:Id<'_storage'>|undefined;
  try{
    storageId=await ctx.storage.store(new Blob([bytes],{type:contentType}));
    const result=await ctx.runMutation(internal.taskAttachments.attach,{target,userId:identity.subject,uploadId,storageId,name});
    if(result.reused)await ctx.storage.delete(storageId);
    return new Response(JSON.stringify({id:result.id}),{status:200,headers:{...headers,'Content-Type':'application/json'}});
  }catch{
    if(storageId)await ctx.storage.delete(storageId);
    return reply('Could not attach this file. Check your access and the 10-file limit.',403);
  }
});
export const download=httpAction(async(ctx,request):Promise<Response>=>{
  const origin=allowed(request);if(!origin)return new Response('Origin not allowed.',{status:403});
  const headers={...cors(origin),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};
  const identity=await ctx.auth.getUserIdentity();if(!identity)return new Response('Please sign in again.',{status:401,headers});
  try{
    const id=new URL(request.url).searchParams.get('id') as Id<'taskAttachments'>;
    const file=await ctx.runQuery(internal.taskAttachments.download,{id,userId:identity.subject});
    const blob=await ctx.storage.get(file.storageId);if(!blob)return new Response('File unavailable.',{status:404,headers});
    return new Response(blob,{status:200,headers:{...headers,'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name)}`}});
  }catch{return new Response('This file is unavailable or your access has changed.',{status:404,headers});}
});
