import { strFromU8, unzipSync } from "fflate";
import { imageType } from "./illustrationUpload";

import { MAX_ATTACHMENT_SIZE, attachmentType, validFileName } from '../src/lib/attachmentRules';
export { MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS, attachmentType, validFileName } from '../src/lib/attachmentRules';
function validDocx(bytes: Uint8Array) {
  try {
    let count=0,total=0;const names=new Set<string>();
    // Inspect all sizes before extracting anything, including ZIP64 size sentinels.
    unzipSync(bytes,{filter:file=>{
      if(++count>2000 || file.originalSize>20*1024*1024 || (total+=file.originalSize)>50*1024*1024 ||
        /(^\/|(^|\/)\.\.(\/|$)|\\)/.test(file.name) || /vbaProject/i.test(file.name) || names.has(file.name)) throw new Error("Invalid document archive");
      names.add(file.name);return false;
    }});
    if(!names.has('[Content_Types].xml') || !names.has('word/document.xml') || !names.has('_rels/.rels'))return false;
    const xml=unzipSync(bytes,{filter:file=>{
      if(!['[Content_Types].xml','word/document.xml'].includes(file.name))return false;
      if(file.originalSize>2*1024*1024)throw new Error("Document XML too large");return true;
    }});
    const content=strFromU8(xml['[Content_Types].xml']);const document=strFromU8(xml['word/document.xml']);
    return content.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') &&
      !/macroEnabled|vbaProject/i.test(content) && document.includes('http://schemas.openxmlformats.org/wordprocessingml/2006/main') && /<(?:\w+:)?document\b/.test(document);
  } catch { return false; }
}
export function validAttachment(bytes: Uint8Array, name: string, contentType: string) {
  if(!validFileName(name) || !bytes.length || bytes.length>MAX_ATTACHMENT_SIZE || attachmentType(name)!==contentType)return false;
  if(contentType.startsWith('image/'))return imageType(bytes)===contentType;
  if(contentType==='application/pdf')return /^%PDF-[12]\.\d/.test(new TextDecoder().decode(bytes.subarray(0,12)))&&/%%EOF\s*$/.test(new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024))));
  return contentType===attachmentType('document.docx') && validDocx(bytes);
}
