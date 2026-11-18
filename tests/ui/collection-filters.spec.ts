import { expect, test, type Page } from "./test";
const fixture='/tests/ui/popup-fixture.html';
async function navigate(page:Page,name:string){const target=page.getByRole('navigation').getByRole('button',{name,exact:true});if(!await target.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await target.click();}
async function board(page:Page,query=''){await page.goto(fixture+query);await page.locator('#workspace-select').selectOption('workspace-b');await page.getByRole('button',{name:'Open project Website Launch',exact:true}).click();await expect(page.locator('.kb-card')).toHaveCount(6);}
async function filters(page:Page){const toggle=page.getByRole('button',{name:/^Filters/});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();}
test.beforeEach(async({page})=>{
 for(const [module,exports]of [['convex_react','useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading'],['@clerk_react','useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton']])await page.route('**/node_modules/.vite/deps/'+module+'.js*',r=>r.fulfill({contentType:'application/javascript',body:'export {'+exports+'} from "/tests/ui/experience-mock.ts";'}));
 await page.route('**/tests/ui/experience-mock.ts',async route=>{
  const response=await route.fetch();let source=await response.text();
  const anchor='if (name === "profiles:upsert")';expect(source).toContain(anchor);
  source=source.replace(anchor,'if (name === "projectTasks:move" || name === "projectTasks:setStatus") tasksB=tasksB.map(t=>t._id===args.taskId?{...t,status:args.targetStatus??args.status}:t); else '+anchor);
  source+=`\n;const day = n => {const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
Object.assign(pb,{name:'Website Launch'});
projectsB=[{...pb},{...pb,_id:'project-c',name:'Alpha Archive',status:'archived',_creationTime:Date.UTC(2026,0,1)},{...pb,_id:'project-d',name:'Completed Brand',status:'completed',_creationTime:Date.UTC(2026,1,1)}];
tasksB=[{...task,title:'Linked review task',dueDate:day(0),position:0},
{...task,_id:'urgent',title:'Urgent checkout',description:'Payment validation',status:'todo',priority:'urgent',assigneeId:'other-member',dueDate:day(-1),position:1},
{...task,_id:'design',title:'Design assets',description:'Thiết kế đường dẫn',status:'in_progress',priority:'high',dueDate:day(0),position:2},
{...task,_id:'backlog',title:'Research backlog',status:'todo',priority:'low',assigneeId:undefined,dueDate:undefined,position:3},
{...task,_id:'approved',title:'Approved content',status:'done',priority:'high',dueDate:day(-1),position:4},
{...task,_id:'next',title:'Next sprint',status:'in_progress',priority:'medium',dueDate:day(8),position:5}];`;
  await route.fulfill({response,body:source});
 });
});
test('Projects combine archived status, month, search and sorting without competing chart state',async({page})=>{
 await page.goto(fixture);await page.locator('#workspace-select').selectOption('workspace-b');
 await expect(page.locator('.ws-project-card')).toHaveCount(3);
 await page.getByRole('combobox',{name:'Sort projects',exact:true}).selectOption('name');
 await expect(page.locator('.ws-project-card h3')).toHaveText(['Alpha Archive','Completed Brand','Website Launch']);
 await filters(page);await page.getByRole('combobox',{name:'Filter projects by status'}).selectOption('archived');
 await page.getByRole('combobox',{name:'Filter projects by month'}).selectOption('2026-01');
 await page.getByRole('textbox',{name:'Search projects',exact:true}).fill('  ALPHA ');
 await expect(page.locator('.ws-project-card h3')).toHaveText(['Alpha Archive']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(page.locator('.ws-project-card')).toHaveCount(3);await expect(page.getByRole('combobox',{name:'Filter projects by status'})).toHaveValue('all');
 await page.locator('.wo-metric.wo-blue').click();await expect(page.getByRole('combobox',{name:'Filter projects by status'})).toHaveValue('active');
 await expect(page.locator('.ws-project-card h3')).toHaveText(['Website Launch']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('Kanban combines status, priority, assignee and deadline then recovers an empty result',async({page})=>{
 await board(page);await filters(page);
 await page.getByRole('combobox',{name:'Filter tasks by status'}).selectOption('in_progress');
 await page.getByRole('combobox',{name:'Filter tasks by priority'}).selectOption('high');
 await page.getByRole('combobox',{name:'Filter tasks by assignee'}).selectOption('me');
 await page.getByRole('combobox',{name:'Filter tasks by deadline'}).selectOption('today');
 await expect(page.locator('.kb-card h3')).toHaveText(['Design assets']);
 await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill('thiet ke DUONG');await expect(page.locator('.kb-card')).toHaveCount(1);
 await page.getByRole('combobox',{name:'Filter tasks by priority'}).selectOption('low');
 await expect(page.getByText('No tasks match these filters.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reset task filters',exact:true}).click();await expect(page.locator('.kb-card')).toHaveCount(6);
 await page.getByRole('combobox',{name:'Filter tasks by deadline'}).selectOption('overdue');await expect(page.locator('.kb-card h3')).toHaveText(['Urgent checkout']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.getByRole('combobox',{name:'Filter tasks by assignee'}).selectOption('unassigned');await expect(page.locator('.kb-card h3')).toHaveText(['Research backlog']);
});
test('Filters and sort survive route Back/Forward while draft guards still protect task edits',async({page})=>{
 await board(page);await filters(page);await page.getByRole('combobox',{name:'Filter tasks by priority'}).selectOption('high');
 await page.getByRole('combobox',{name:'Sort tasks',exact:true}).selectOption('due');
 const edit=page.locator('.kb-card').filter({has:page.getByRole('heading',{name:'Design assets',exact:true})}).getByRole('button',{name:'Edit',exact:true});
 await edit.click();await page.getByLabel('Title *',{exact:true}).fill('Unsaved filtered task');
 page.once('dialog',dialog=>dialog.dismiss());await page.goBack();await expect(page.getByLabel('Title *',{exact:true})).toHaveValue('Unsaved filtered task');
 page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');await page.locator('.kb-back').click();
 await page.goBack();await expect(page.locator('.kb-page')).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Sort tasks',exact:true})).toHaveValue('due');await filters(page);await expect(page.getByRole('combobox',{name:'Filter tasks by priority'})).toHaveValue('high');
 await page.goForward();await expect(page.locator('.ws-projects')).toBeVisible();
});
test('Notification deep links clear all task filters and focus their previously hidden destination',async({page})=>{
 await board(page);await filters(page);await page.getByRole('combobox',{name:'Filter tasks by priority'}).selectOption('urgent');
 await page.getByRole('combobox',{name:'Filter tasks by assignee'}).selectOption('unassigned');
 await page.getByRole('combobox',{name:'Filter tasks by deadline'}).selectOption('none');
 await expect(page.locator('.kb-card')).toHaveCount(0);
 await navigate(page,'My tasks');await page.getByRole('button',{name:/^Notifications, \d+ unread$/}).click();
 const notice=page.getByRole('dialog',{name:'Notifications',exact:true}).locator('.notify-item').first();
 await expect(notice).toContainText('Open task');await notice.click();
 await expect(page.locator('.kb-card[data-notification-target]')).toBeFocused();await expect(page.locator('.kb-card')).toHaveCount(6);
 await filters(page);for(const label of ['priority','assignee','deadline'])await expect(page.getByRole('combobox',{name:'Filter tasks by '+label})).toHaveValue('all');
});
test('Sorted boards retain status drag/drop without applying a misleading manual order',async({page})=>{
 await board(page);await page.getByRole('combobox',{name:'Sort tasks',exact:true}).selectOption('priority');
 await expect(page.locator('.kb-todo .kb-card h3')).toHaveText(['Urgent checkout','Research backlog']);
 const card=page.locator('.kb-card').filter({has:page.getByRole('heading',{name:'Urgent checkout',exact:true})});
 const transfer=await page.evaluateHandle(()=>new DataTransfer());await card.dispatchEvent('dragstart',{dataTransfer:transfer});
 await page.locator('.kb-in_progress').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
 await expect.poll(()=>page.evaluate(()=>window.notificationRegression.mutations.find(call=>call.name==='projectTasks:move'))).toEqual({name:'projectTasks:move',args:{taskId:'urgent',targetStatus:'in_progress'}});
 await expect(page.locator('.kb-in_progress .kb-card h3')).toHaveText(['Urgent checkout','Design assets','Next sprint']);
});
test('Viewer filtering never enables editing and account switching removes the filtered board',async({page})=>{
 await board(page,'?viewer');await filters(page);await page.getByRole('combobox',{name:'Filter tasks by priority'}).selectOption('high');
 await expect(page.locator('.kb-card')).toHaveCount(2);await expect(page.locator('.kb-card .kb-edit')).toHaveCount(0);
 for(const select of await page.locator('.kb-card > label select').all())await expect(select).toBeDisabled();
 await page.evaluate(()=>window.experienceRegression.switchIdentity());
 await expect(page.getByRole('heading',{name:'This content is no longer available',exact:true})).toBeVisible();await expect(page.locator('.kb-card')).toHaveCount(0);
});
