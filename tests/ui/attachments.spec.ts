import {test,expect,type Page} from './test';
import fs from 'node:fs';
import {zipSync,strToU8} from 'fflate';
const fixture='/tests/ui/popup-fixture.html';
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const word=Buffer.from(zipSync({'[Content_Types].xml':strToU8('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'),'_rels/.rels':strToU8('<Relationships/>')}));
const image=fs.readFileSync('src/assets/photography/sunlit-desk.webp');
type FixtureApi={rows:Record<string,unknown>[];fail:boolean;expired:boolean;denied:boolean;loading:boolean;tokenOptions:unknown[];add:(row:Record<string,unknown>)=>string;change:(values:Record<string,unknown>)=>void;requests:{name:string;key:string;kind:string;target:string}[]};
declare global{interface Window{attachmentFixture:FixtureApi}}
const dialog=(page:Page)=>page.getByRole('dialog',{name:/^Attachments for/});
async function navigate(page:Page,name:string){const target=page.getByRole('navigation').getByRole('button',{name,exact:true});if(!await target.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await target.click();}
async function board(page:Page,query=''){await page.goto(fixture+query);await page.locator('#workspace-select').selectOption('workspace-b');await page.locator('.kb-open-project').click();await expect(page.locator('.kb-card')).toBeVisible();await page.locator('.kb-card .attachment-trigger').click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByText('No attachments yet.',{exact:true})).toBeVisible();}
test.beforeEach(async({page})=>{
 for(const [module,exports]of [['convex_react','useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading'],['@clerk_react','useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton']])await page.route('**/node_modules/.vite/deps/'+module+'.js*',r=>r.fulfill({contentType:'application/javascript',body:'export {'+exports+'} from "/tests/ui/experience-mock.ts";'}));
 await page.route('**/tests/ui/experience-mock.ts',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace(/case "workspaces:list":\s*return workspaces;/,`case "taskAttachments:list": if(window.attachmentFixture.denied)throw new Error("Access denied");return window.attachmentFixture.loading?undefined:window.attachmentFixture.rows.filter(row=>row.taskId===args.target.id).map(row=>({...row,canRemove:args.target.kind==='tasks'||wb.myRole!=='viewer'}));case "workspaces:list": return workspaces;`);
  source=source.replace('if (name === "profiles:upsert")',`if(name==="taskAttachments:remove"){window.attachmentFixture.rows=window.attachmentFixture.rows.filter(row=>row._id!==args.id);window.attachmentFixture.change({});}else if (name === "profiles:upsert")`);
  expect(source).toContain('getToken: async () => null');
  source=source.replace('getToken: async () => null',`sessionClaims:params.has('native')?{aud:'convex'}:undefined,getToken:async(options)=>{window.attachmentFixture.tokenOptions.push(options);return window.attachmentFixture.expired?null:'fixture-attachment-token';}`);
  source+=`\n;window.attachmentFixture={rows:[],fail:false,expired:false,denied:false,loading:false,tokenOptions:[],requests:[],
add(row){const existing=this.rows.find(item=>item.uploadId===row.uploadId&&row.uploadId);if(existing)return existing._id;const id='attachment-'+(this.rows.length+1);this.rows.push({_id:id,size:100,contentType:'application/pdf',createdAt:Date.now(),uploader:'You',canRemove:true,...row});this.change({});return id;},
change(values){Object.assign(this,values);for(const row of [...tasksB,...personalTasks])row.attachmentCount=this.rows.filter(item=>item.taskId===row._id).length;notify();}};`;
  await route.fulfill({response,body:source});
 });
 await page.route('**/task-attachments/upload?*',async route=>{
  const headers={'Access-Control-Allow-Origin':new URL(page.url()).origin,'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Attachment-Name, X-Upload-Id','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const request=route.request(),name=decodeURIComponent(request.headers()['x-attachment-name']);const params=new URL(request.url()).searchParams;
  expect(request.headers()['authorization']).toBe('Bearer fixture-attachment-token');
  const row={name,contentType:request.headers()['content-type'],size:request.postDataBuffer()?.length,taskId:params.get('id'),uploadId:request.headers()['x-upload-id']};
  const result=await page.evaluate(({row,kind})=>{const state=window.attachmentFixture;state.requests.push({name:row.name,key:row.uploadId,kind,target:row.taskId!});return state.fail?null:state.add(row);},{row,kind:params.get('kind')!});
  await route.fulfill({status:result?200:403,headers,contentType:result?'application/json':'text/plain',body:result?JSON.stringify({id:result}):'Your access has changed. Please try again.'});
 });
 await page.route('**/task-attachments/download?*',async route=>{
  const headers={'Access-Control-Allow-Origin':new URL(page.url()).origin,'Access-Control-Allow-Headers':'Authorization, Content-Type'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  expect(route.request().headers()['authorization']).toBe('Bearer fixture-attachment-token');
  const id=new URL(route.request().url()).searchParams.get('id');const row=await page.evaluate(id=>window.attachmentFixture.rows.find(item=>item._id===id),id);
  if(!row)return route.fulfill({status:404,headers,body:'Unavailable'});
  const body=String(row.contentType).startsWith('image/')?image:row.contentType==='application/pdf'?pdf:word;
  await route.fulfill({status:200,headers,contentType:String(row.contentType),body});
 });
});
test('Multiple PDF, DOCX and image uploads update card counts; files survive reopening and download with their names',async({page})=>{
 await board(page);await dialog(page).getByLabel('Choose task attachments').setInputFiles([{name:'Plan.pdf',mimeType:'application/pdf',buffer:pdf},{name:'Report.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:word},{name:'Design.webp',mimeType:'image/webp',buffer:image}]);
 await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(3);await expect(dialog(page).getByRole('button',{name:'Close attachments',exact:true})).toBeEnabled();
 const [wordDownload]=await Promise.all([page.waitForEvent('download'),dialog(page).getByRole('button',{name:'Download Report.docx',exact:true}).click()]);expect(wordDownload.suggestedFilename()).toBe('Report.docx');
 const [download]=await Promise.all([page.waitForEvent('download'),dialog(page).getByRole('button',{name:'Download Plan.pdf',exact:true}).click()]);expect(download.suggestedFilename()).toBe('Plan.pdf');
 await dialog(page).getByRole('button',{name:'Close attachments',exact:true}).click();await expect(page.locator('.kb-card .attachment-trigger')).toHaveText('3');await expect(page.locator('.kb-card .attachment-trigger')).toBeFocused();
 await page.locator('.kb-card .attachment-trigger').click();await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(3);
 expect(await page.evaluate(()=>window.attachmentFixture.requests.map(row=>row.kind))).toEqual(['projectTasks','projectTasks','projectTasks']);
 expect(await page.evaluate(()=>window.attachmentFixture.tokenOptions.every((value:any)=>value.template==='convex'&&value.skipCache===true))).toBe(true);
});
test('Preview uses scoped object URLs, DOCX stays download-only and removal is confirmed',async({page})=>{
 await page.addInitScript(()=>{const revoke=URL.revokeObjectURL.bind(URL);(window as any).revoked=[];URL.revokeObjectURL=url=>{(window as any).revoked.push(url);revoke(url);};});
 await board(page);await page.evaluate(()=>{for(const [name,type]of [['Design.webp','image/webp'],['Plan.pdf','application/pdf'],['Report.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document']])window.attachmentFixture.add({name,contentType:type,taskId:'task-b'});});
 await dialog(page).getByRole('button',{name:'Preview Design.webp',exact:true}).click();await expect(dialog(page).getByRole('img',{name:'Design.webp',exact:true})).toHaveAttribute('src',/^blob:/);
 await dialog(page).getByRole('button',{name:'Close file preview',exact:true}).click();expect(await page.evaluate(()=>(window as any).revoked.length)).toBeGreaterThan(0);
 await expect(dialog(page).getByRole('button',{name:'Preview Report.docx',exact:true})).toHaveCount(0);
 await dialog(page).getByRole('button',{name:'Preview Plan.pdf',exact:true}).click();await expect(dialog(page).locator('iframe')).toHaveAttribute('sandbox','');
 await dialog(page).getByRole('button',{name:'Close file preview',exact:true}).click();
 await dialog(page).getByRole('button',{name:'Remove Plan.pdf',exact:true}).click();await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Remove attachment?',exact:true})}).getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(3);
 await dialog(page).getByRole('button',{name:'Remove Plan.pdf',exact:true}).click();await page.getByRole('button',{name:'Remove file',exact:true}).click();await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(2);
 expect(await page.evaluate(()=>window.notificationRegression.mutations.filter(call=>call.name==='taskAttachments:remove').length)).toBe(1);
});
test('Invalid files, oversize files, failed uploads and safe retries preserve files and draft guards',async({page})=>{
 await board(page);await dialog(page).getByLabel('Choose task attachments').setInputFiles([{name:'Unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')},{name:'Big.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(10*1024*1024+1)}]);
 await expect(dialog(page).getByText('Choose a PDF, DOCX, JPG, PNG or WebP file with a valid name.',{exact:true})).toBeVisible();await expect(dialog(page).getByText('Each file must be non-empty and 10 MB or smaller.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.attachmentFixture.requests)).toHaveLength(0);
 page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');await expect(dialog(page)).toBeVisible();
 await dialog(page).getByRole('button',{name:'Dismiss Unsafe.svg',exact:true}).click();await dialog(page).getByRole('button',{name:'Dismiss Big.pdf',exact:true}).click();
 await page.evaluate(()=>window.attachmentFixture.change({fail:true}));await dialog(page).getByLabel('Choose task attachments').setInputFiles({name:'Retry.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(dialog(page).getByText('Your access has changed. Please try again.',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.attachmentFixture.change({fail:false}));await dialog(page).getByRole('button',{name:'Retry Retry.pdf',exact:true}).click();await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(1);
 const calls=await page.evaluate(()=>window.attachmentFixture.requests);expect(calls).toHaveLength(2);expect(calls[0].key).toBe(calls[1].key);
});
test('Personal attachments use personal ownership and native Clerk integration tokens',async({page})=>{
 await page.goto(fixture+'?native');await navigate(page,'My tasks');await page.locator('.task .attachment-trigger').first().click();
 await dialog(page).getByLabel('Choose task attachments').setInputFiles({name:'Personal.pdf',mimeType:'application/pdf',buffer:pdf});await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(1);
 expect(await page.evaluate(()=>window.attachmentFixture.requests[0].kind)).toBe('tasks');expect(await page.evaluate(()=>window.attachmentFixture.tokenOptions[0])).toEqual({skipCache:true});
});
test('An expired session never sends a file and can retry after reauthentication',async({page})=>{
 await board(page);await page.evaluate(()=>window.attachmentFixture.change({expired:true}));
 await dialog(page).getByLabel('Choose task attachments').setInputFiles({name:'Session.pdf',mimeType:'application/pdf',buffer:pdf});
 await expect(dialog(page).getByText('Your session expired. Please sign in again.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.attachmentFixture.requests)).toHaveLength(0);
 await page.evaluate(()=>window.attachmentFixture.change({expired:false}));await dialog(page).getByRole('button',{name:'Retry Session.pdf',exact:true}).click();
 await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(1);
});
test('Viewer access is download-only and revocation removes stale file content',async({page})=>{
 await board(page,'?viewer');await page.evaluate(()=>window.attachmentFixture.add({name:'Read only.pdf',contentType:'application/pdf',taskId:'task-b'}));
 await expect(dialog(page).getByRole('button',{name:'Add files',exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('button',{name:'Remove Read only.pdf',exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('button',{name:'Download Read only.pdf',exact:true})).toBeEnabled();
 await page.evaluate(()=>window.attachmentFixture.change({denied:true}));await expect(dialog(page).getByText('Read only.pdf',{exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('button',{name:'Try again',exact:true})).toBeVisible();
});
test('Cancel upload releases busy state, retains retryable files and dialog remains keyboard accessible',async({page})=>{
 await board(page);let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/task-attachments/upload?*',async route=>{await pending;await route.fulfill({status:403,body:'Cancelled'}).catch(()=>{});});
 await dialog(page).getByLabel('Choose task attachments').setInputFiles({name:'Slow.pdf',mimeType:'application/pdf',buffer:pdf});await expect(dialog(page).getByRole('progressbar',{name:'Upload progress for Slow.pdf'})).toBeVisible();
 await expect(dialog(page).getByRole('button',{name:'Close attachments',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog(page)).toBeVisible();
 await dialog(page).getByRole('button',{name:'Cancel uploads',exact:true}).click();release();await expect(dialog(page).getByText('Upload cancelled. You can retry.',{exact:true})).toBeVisible();await expect(dialog(page).getByRole('button',{name:'Close attachments',exact:true})).toBeEnabled();
 page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');await expect(dialog(page)).toHaveCount(0);await expect(page.locator('.kb-card .attachment-trigger')).toBeFocused();
});
test('Attachment dialog stays within narrow viewports with long file names and keeps task actions separate',async({page},testInfo)=>{
 await board(page);await page.evaluate(()=>window.attachmentFixture.add({name:'A long project reference document for the final presentation and review.pdf',contentType:'application/pdf',taskId:'task-b',uploader:'Team member'}));
 await expect(dialog(page).locator('.attachment-list>li')).toHaveCount(1);expect(await dialog(page).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog(page).getByRole('button',{name:/Download A long/}).focus();await page.keyboard.press('Tab');expect(await dialog(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);
 fs.mkdirSync('node_modules/.cache/task-attachments',{recursive:true});await dialog(page).screenshot({path:`node_modules/.cache/task-attachments/${testInfo.project.name}.png`});
});
