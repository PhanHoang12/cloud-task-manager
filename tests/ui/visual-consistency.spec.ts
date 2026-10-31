
import { expect, test, type Page, type Locator } from "@playwright/test";
const fixture="/tests/ui/popup-fixture.html";
async function navigate(page: Page, name: string) {
 const button=page.getByRole("navigation").getByRole("button",{name,exact:true});
 if(!await button.isVisible())await page.getByRole("button",{name:"Mở điều hướng",exact:true}).click();
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
 await page.getByRole("button",{name:"Xóa bộ lọc",exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("M10 Phase B task, discussion and automation surfaces retain readable metadata and focus",async({page})=>{
 await page.goto(fixture);await page.locator("#workspace-select").selectOption("workspace-b");await page.locator(".kb-open-project").click();
 const card=page.locator(".kb-card");await expect(card).toBeVisible();await expect(card).toHaveCSS("border-radius","14px");await expect(card).toHaveCSS("box-shadow","none");
 await readable(page.locator(".kb-priority"));await readable(page.locator(".kb-details"));
 await page.locator(".st-disclosure > summary").click();await ring(page.getByLabel("Tên công việc con"),page);
 await page.locator(".tc-toggle").click();await ring(page.getByLabel("Viết bình luận"),page);await readable(page.locator(".tc-count"));
 await page.locator(".ad-overview > summary").click();
 await readable(page.locator(".ad-stat--amber .ad-stat-value"));await readable(page.locator(".ad-live"));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("M10 Phase C personal, profile and popup styles retain hierarchy and readable states",async({page})=>{
 await page.goto(fixture);await navigate(page,"Công việc cá nhân");
 await expect(page.locator(".stat").first()).toHaveCSS("border-radius","14px");
 await expect(page.locator(".stat").first()).toHaveCSS("box-shadow","none");
 await readable(page.locator(".priority.medium"));
 await readable(page.locator(".filter.selected"));
 await readable(page.locator(".task-meta").first());
 await navigate(page,"Hồ sơ cá nhân");await expect(page.locator(".profile-card").first()).toHaveCSS("border-radius","14px");
 await ring(page.getByLabel("Họ và tên"),page);
 const bell=page.getByRole("button",{name:/^Thông báo,/});await bell.click();
 await readable(page.locator(".notify-badge"));await readable(page.locator(".notify-time").first());
 const close=page.getByRole("dialog",{name:"Thông báo",exact:true}).getByRole("button",{name:"Đóng thông báo",exact:true});await ring(close,page);
 await ring(page.locator(".notify-item").first(),page);
 await expect(page.locator(".notify-item").first()).toHaveCSS("outline-color","rgb(70, 101, 233)");
 await page.keyboard.press("Escape");await expect(bell).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
