export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png,.webp';
const types:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
export function attachmentType(name:string){return types[name.split('.').pop()?.toLowerCase()??''];}
export function validFileName(name:string){return name.length>0&&name.length<=180&&name===name.trim()&&!/[\x00-\x1f\x7f/\\:]/.test(name)&&Boolean(attachmentType(name));}
export function fileSize(size:number){return size>=1024*1024?`${(size/(1024*1024)).toFixed(1)} MB`:`${Math.max(1,Math.ceil(size/1024))} KB`;}
