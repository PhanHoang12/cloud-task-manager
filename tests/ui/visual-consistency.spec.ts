
import { expect, test, type Page, type Locator } from "./test";
import fs from "node:fs";
const fixture="/tests/ui/popup-fixture.html";
async function navigate(page: Page, name: string) {
 const button=page.getByRole("navigation").getByRole("button",{name,exact:true});
 if(!await button.isVisible())await page.getByRole("button",{name:"Open navigation",exact:true}).click();
 await button.click();
}
async function readable(target: Locator) {
 const data=await target.evaluate(element=>{
  const style=getComputedStyle(element);
  let background="";
  for(let node:Element|null=element;node;node=node.parentElement){
   const value=getComputedStyle(node).backgroundColor;
   const channels=value.match(/[0-9.]+/g)!.map(Number);
   if(channels.length===3||channels[3]===1){background=value;break;}
  }
  return {text:style.color,background,size:parseFloat(style.fontSize),weight:parseInt(style.fontWeight)};
 });
 const luminance=(color:string)=>{
  const channels=color.match(/[0-9.]+/g)!.slice(0,3).map(Number).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
 };
 const values=[luminance(data.text),luminance(data.background)].sort((a,b)=>b-a);
 const ratio=(values[0]+.05)/(values[1]+.05);
 const large=data.size>=24||(data.size>=18.66&&data.weight>=700);
 expect(ratio,await target.getAttribute("class")??"text contrast").toBeGreaterThanOrEqual(large?3:4.5);
}
async function ring(target:Locator,page:Page) {
 await page.evaluate(()=>document.fonts.ready);
 await page.keyboard.press("Tab");await target.scrollIntoViewIfNeeded();
 const before=await target.evaluate(element=>({width:(element as HTMLElement).offsetWidth,height:(element as HTMLElement).offsetHeight}));
 await target.focus();
 await expect(target).toHaveCSS("outline-style","solid");await expect(target).toHaveCSS("outline-width","3px");
 expect(await target.evaluate(element=>({width:(element as HTMLElement).offsetWidth,height:(element as HTMLElement).offsetHeight}))).toEqual(before);
}
test.beforeEach(async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 for(const [module,exports]of [["convex_react","useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],["@clerk_react","useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"]])
 await page.route("**/node_modules/.vite/deps/"+module+".js*",r=>r.fulfill({contentType:"application/javascript",body:'export {'+exports+'} from "/tests/ui/experience-mock.ts";'}));
});

test("English workbench groups projects and people while preserving user content", async ({ page }) => {
 await page.goto(fixture);
 await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible();
 await expect(page.getByRole("complementary", { name: "Workspace people" })).toBeVisible();
 await expect(page.locator(".ws-project-card h3")).toHaveText("Dự án hiện tại");
 await expect(page.locator(".kb-open-project")).toHaveText("Open board");
 await expect(page.locator(".ws-project-meta")).toContainText("Created");
 await navigate(page, "Profile");
 for (const name of ["Identity & contact", "Academic details", "A little about you"])
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
 await page.getByLabel("Full name", { exact: true }).fill("Nguyễn An");
 page.once("dialog", dialog => dialog.dismiss());
 await navigate(page, "My tasks");
 await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Nguyễn An");
});

test("Personal focus exposes actual completion and keeps task actions named", async ({ page }, testInfo) => {
 await page.goto(fixture); await navigate(page, "My tasks");
 await expect(page.getByRole("heading", { name: "My tasks", exact: true })).toBeVisible();
 await expect(page.locator(".task").first().getByRole("button", { name: "Edit", exact: true })).toBeVisible();
 if (testInfo.project.name === "desktop") {
  await expect(page.getByRole("progressbar", { name: "Personal task completion" })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.locator(".personal-focus")).toContainText("1 of 2 tasks completed");
 }
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("M10 Phase A shared workspace surfaces, tinted filters and native focus stay consistent",async({page})=>{
 await page.goto(fixture);await expect(page.locator(".ws-project-card")).toBeVisible();
 for(const selector of [".ws-project-card",".tm-member-panel",".ws-projects"]){
  await expect(page.locator(selector)).toHaveCSS("border-radius","14px");
  await expect(page.locator(selector)).toHaveCSS("box-shadow","none");
 }
 await ring(page.locator("#workspace-select"),page);
 await readable(page.locator(".ws-overline"));
 await page.locator(".wo-analytics > summary").click();
 await page.locator(".wo-bar-column").last().click();
 await readable(page.locator(".ws-filter-chip"));
 await readable(page.locator(".wo-bar-column.is-selected .wo-bar-label"));
 await readable(page.locator(".wo-axis span").first());
 await page.getByRole("button",{name:"Clear filters",exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("M10 Phase B task, discussion and automation surfaces retain readable metadata and focus",async({page})=>{
 await page.goto(fixture);await page.locator("#workspace-select").selectOption("workspace-b");await page.locator(".kb-open-project").click();
 const card=page.locator(".kb-card");await expect(card).toBeVisible();await expect(card).toHaveCSS("border-radius","14px");await expect(card).toHaveCSS("box-shadow","none");
 await readable(page.locator(".kb-priority"));await readable(page.locator(".kb-details"));
 await page.locator(".st-disclosure > summary").click();await ring(page.getByLabel("Subtask name"),page);
 await page.locator(".tc-toggle").click();await ring(page.getByLabel("Write a comment"),page);await readable(page.locator(".tc-count"));
 await page.locator(".ad-overview > summary").click();
 await readable(page.locator(".ad-stat--amber .ad-stat-value"));await readable(page.locator(".ad-live"));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("M10 Phase C personal, profile and popup styles retain hierarchy and readable states",async({page})=>{
 await page.goto(fixture);await navigate(page,"My tasks");
 await expect(page.locator(".stat").first()).toHaveCSS("border-radius","14px");
 await expect(page.locator(".stat").first()).toHaveCSS("box-shadow","none");
 await readable(page.locator(".priority.medium"));
 await readable(page.locator(".filter.selected"));
 await readable(page.locator(".task-meta").first());
 await navigate(page,"Profile");await expect(page.locator(".profile-card").first()).toHaveCSS("border-radius","14px");
 await ring(page.getByLabel("Full name"),page);
 const bell=page.getByRole("button",{name:/^Notifications,/});await bell.click();
 await readable(page.locator(".notify-badge"));await readable(page.locator(".notify-time").first());
 const close=page.getByRole("dialog",{name:"Notifications",exact:true}).getByRole("button",{name:"Dismiss notification",exact:true});await ring(close,page);
 await ring(page.locator(".notify-item").first(),page);
 await expect(page.locator(".notify-item").first()).toHaveCSS("outline-color","rgb(70, 101, 233)");
 await page.keyboard.press("Escape");await expect(bell).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("Interior photos stay contained in headings across routes and cannot intercept controls", async ({ page }) => {
 await page.goto(fixture);
 async function contained() {
  const heading=page.locator('.photo-heading');
  await expect(heading).toBeVisible();
  await expect(heading.locator('[data-ui-photo]')).toHaveAttribute('aria-hidden','true');
  await expect(heading.locator('img')).toHaveAttribute('alt','');
  await expect.poll(()=>heading.locator('img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const bounds=await heading.evaluate(element=>{
   const host=element.getBoundingClientRect(),photo=element.querySelector('.scene-photo')!.getBoundingClientRect();
   return {position:getComputedStyle(element).position,height:host.height,dx:Math.abs(host.left-photo.left),dy:Math.abs(host.top-photo.top),dw:Math.abs(host.width-photo.width),dh:Math.abs(host.height-photo.height)};
  });
  expect(bounds.position).toBe('relative');expect(bounds.height).toBeLessThan(280);
  for(const key of ['dx','dy','dw','dh'] as const)expect(bounds[key]).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await contained();
 await page.getByRole('button',{name:'New workspace',exact:true}).click();await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await navigate(page,'My tasks');await contained();
 await page.getByRole('button',{name:'New task',exact:true}).click();await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await navigate(page,'Profile');await contained();await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();
 await navigate(page,'Workspaces & projects');await page.locator('.kb-open-project').first().click();await contained();
});

test("Missing decorative photos preserve task forms, navigation and readable heading backgrounds", async ({ page }) => {
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*.webp*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
 await page.goto(fixture);await expect(page.getByRole('heading',{name:'Workspaces',exact:true})).toBeVisible();
 await navigate(page,'My tasks');
 await expect(page.locator('.photo-heading')).toHaveCSS('background-color','rgb(19, 37, 59)');
 await expect(page.getByRole('heading',{name:'My tasks',exact:true})).toHaveCSS('color','rgb(255, 255, 255)');
 await page.getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Title *',{exact:true}).fill('A task without a background image');
 await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('A task without a background image');
 page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');
 await navigate(page,'Profile');await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();expect(errors).toEqual([]);
});

test("Forced-colors removes decorative photography while headings and keyboard actions remain available", async ({ page }) => {
 await page.emulateMedia({forcedColors:'active'});await page.goto(fixture);
 await expect(page.locator('.scene-photo')).not.toBeVisible();
 await expect(page.getByRole('heading',{name:'Workspaces',exact:true})).toBeVisible();
 const create=page.getByRole('button',{name:'New workspace',exact:true});await create.focus();await expect(create).toBeFocused();await create.press('Enter');
 await expect(page.locator('dialog')).toBeVisible();await expect(page.locator('dialog input').first()).toBeFocused();
});

test("Search fields have exactly one focus ring and retain working filters across screens", async ({ page }) => {
 await page.goto(fixture);
 const check=async(input:Locator,wrapper:Locator)=>{
  const before=await wrapper.boundingBox();await input.focus();
  await expect(input).toHaveCSS('outline-style','none');await expect(input).toHaveCSS('box-shadow','none');
  await expect(wrapper).toHaveCSS('outline-style','solid');await expect(wrapper).toHaveCSS('outline-width','3px');
  expect(await wrapper.boundingBox()).toEqual(before);
 };
 await check(page.getByRole('textbox',{name:'Search projects',exact:true}),page.locator('.ws-search'));
 await page.getByRole('textbox',{name:'Search projects',exact:true}).fill('no-matching-illustration-project');
 await expect(page.getByRole('heading',{name:'No matching projects'})).toBeVisible();
 await page.getByRole('textbox',{name:'Search projects',exact:true}).fill('');
 await page.locator('#workspace-select').selectOption('workspace-b');await page.locator('.kb-open-project').click();
 await check(page.getByRole('textbox',{name:'Search tasks',exact:true}),page.locator('.kb-search-field'));
 await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill('no-matching-illustration-task');
 await expect(page.locator('.kb-card')).toHaveCount(0);
 await navigate(page,'My tasks');await check(page.getByRole('textbox',{name:'Search tasks',exact:true}),page.locator('.search'));
});

test("Project cards have contained covers and image actions follow viewer permissions",async({page})=>{
 await page.goto(fixture);
 const card=page.locator('.ws-project-card').first();const image=card.locator('.card-illustration > img');
 await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const upload=card.getByRole('button',{name:/Add illustration/});await upload.focus();await expect(upload).toBeFocused();
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),upload.press('Enter')]);expect(chooser.isMultiple()).toBe(false);
 await page.goto(fixture+'?viewer');await page.locator('#workspace-select').selectOption('workspace-b');
 await expect(page.locator('.ws-project-card .card-illustration > img')).toBeVisible();
 await expect(page.getByRole('button',{name:/Add illustration/})).toHaveCount(0);
 await page.locator('.kb-open-project').click();await expect(page.getByRole('button',{name:/Add illustration/})).toHaveCount(0);
});

test("Illustration uploads validate files, send the correct target, update from query data and recover from errors",async({page})=>{
 await page.route('**/tests/ui/experience-mock.ts',async route=>{
  const response=await route.fetch();let source=await response.text();
  expect(source).toContain('getToken: async () => null');
  source=source.replace('getToken: async () => null','getToken: async () => "fixture-illustration-token"');
  source=source.replace('if (name === "profiles:upsert")','if (name === "illustrations:remove") Object.assign(pa,{coverUrl:undefined}); else if (name === "profiles:upsert")');
  source+='\n;window.setIllustration = (url) => { Object.assign(pa,{coverUrl:url}); notify(); };';
  await route.fulfill({response,body:source});
 });
 let calls=0,fail=false;
 await page.route('**/upload-illustration?*',async route=>{
  calls++;const url=new URL(route.request().url());expect(url.searchParams.get('kind')).toBe('projects');expect(url.searchParams.get('id')).toBe('project-a');
  expect(route.request().headers()['content-type']).toBe('image/webp');
  expect(route.request().headers()['authorization']).toBe('Bearer fixture-illustration-token');
  if(fail)return route.fulfill({status:403,body:'You no longer have permission to change this image.'});
  await page.evaluate(()=> (window as unknown as {setIllustration:(url:string)=>void}).setIllustration('/src/assets/photography/sunlit-desk.webp'));
  await route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});
 });
 await page.goto(fixture);const input=page.locator('.ws-project-card input[type=file]');
 await input.setInputFiles({name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await expect(page.getByText('Choose a JPG, PNG or WebP image.',{exact:true})).toBeVisible();expect(calls).toBe(0);
 await input.setInputFiles({name:'too-large.webp',mimeType:'image/webp',buffer:Buffer.alloc(2*1024*1024+1)});
 await expect(page.getByText('Choose an image under 2 MB.',{exact:true})).toBeVisible();expect(calls).toBe(0);
 const photo=fs.readFileSync('src/assets/photography/sunlit-desk.webp');
 await input.setInputFiles({name:'desk.webp',mimeType:'image/webp',buffer:photo});
 await expect(page.getByRole('button',{name:/Change illustration/})).toBeEnabled();expect(calls).toBe(1);
 await expect(page.locator('.ws-project-card img')).toHaveAttribute('alt',/ illustration$/);
 await page.locator('.kb-open-project').click();
 await expect(page.locator('.scene-photo img')).toHaveAttribute('src','/src/assets/photography/sunlit-desk.webp');
 await page.getByRole('button',{name:'Back to projects',exact:true}).click();
 await navigate(page,'My tasks');await navigate(page,'Workspaces & projects');
 await expect(page.getByRole('button',{name:/Change illustration/})).toBeVisible();
 fail=true;await page.locator('.ws-project-card input[type=file]').setInputFiles({name:'desk.webp',mimeType:'image/webp',buffer:photo});
 await expect(page.getByText('You no longer have permission to change this image.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Change illustration/})).toBeEnabled();
 await expect(page.locator('.ws-project-card img')).toHaveAttribute('alt',/ illustration$/);
 await page.getByRole('button',{name:/Remove illustration/}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:/Change illustration/})).toBeVisible();
 await page.getByRole('button',{name:/Remove illustration/}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Remove image',exact:true}).click();
 await expect(page.getByRole('button',{name:/Add illustration/})).toBeVisible();
 await expect(page.locator('.ws-project-card')).toHaveCount(1);
});
