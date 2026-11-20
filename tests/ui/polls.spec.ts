import {test,expect,type Page} from './test';
import fs from 'node:fs';
const dialog=(page:Page)=>page.getByRole('dialog',{name:/^Polls for/});
const question='Which design should we ship?';
declare global {interface Window {pollFixture:any}}
test.beforeEach(async({context})=>{
 for(const [module,exports]of [['convex_react','useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading'],['@clerk_react','useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton']])await context.route('**/node_modules/.vite/deps/'+module+'.js*',route=>route.fulfill({contentType:'application/javascript',body:'export {'+exports+'} from "/tests/ui/experience-mock.ts";'}));
 await context.route('**/tests/ui/experience-mock.ts',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace(/case "workspaces:list":\s*return workspaces;/,`case "polls:list": if(window.pollFixture.denied)throw new Error('Access denied');return {items:window.pollFixture.rows.map(row=>({...row,canVote:wb.myRole!=='viewer'&&pb.status==='active'&&row.status==='open',canClose:wb.myRole!=='viewer'&&pb.status==='active'&&row.status==='open'})),canCreate:wb.myRole!=='viewer'&&pb.status==='active'&&window.pollFixture.rows.length<10,readOnly:wb.myRole==='viewer'||pb.status!=='active'};case "workspaces:list": return workspaces;`);
  source=source.replace('if (name === "profiles:upsert")',`if(name.startsWith('polls:'))return window.pollFixture.mutate(name,args);else if (name === "profiles:upsert")`);
  source+=`\n;window.pollFixture={denied:false,fail:false,rows:params.has('empty')?[]:[{_id:'poll-1',question:'Which design should we ship?',options:[{id:'option-1',label:'Blue design',votes:0},{id:'option-2',label:'Green design',votes:0}],totalVotes:0,status:'open',author:'Team member',myVote:null,createdAt:Date.now()}],
change(values){Object.assign(this,values);task.pollCount=this.rows.length;notify();},
notice(){notifications.unshift({_id:'notice-poll',kind:'poll_created',message:'New poll: Which design should we ship?',pollId:'poll-1',taskId:task._id,projectId:pb._id,isRead:false,createdAt:Date.now()});notify();},
mutate(name,args){if(this.fail)throw new Error('NetworkError');if(name==='polls:create'){const previous=this.rows.find(row=>row.key===args.requestKey);if(previous)return previous._id;const id='poll-'+(this.rows.length+1);this.rows.unshift({_id:id,question:args.question,options:args.options.map((label,index)=>({id:'option-'+(index+1),label,votes:0})),totalVotes:0,status:'open',author:'You',myVote:null,createdAt:Date.now(),key:args.requestKey});this.change({});return id;}
const poll=this.rows.find(row=>row._id===args.pollId);if(name==='polls:close')poll.status='closed';if(name==='polls:vote'){const old=poll.myVote;poll.options=poll.options.map(option=>({...option,votes:option.votes+(option.id===args.optionId?1:0)-(option.id===old?1:0)}));poll.totalVotes+=!old&&args.optionId?1:old&&!args.optionId?-1:0;poll.myVote=args.optionId||null;}this.change({});}};task.pollCount=window.pollFixture.rows.length;`;
  await route.fulfill({response,body:source});
 });
 await context.route('**/*',async route=>{
  if(!route.request().isNavigationRequest()||new URL(route.request().url()).origin!=='http://127.0.0.1:4178')return route.fallback();
  const response=await route.fetch({url:'http://127.0.0.1:4178/tests/ui/popup-fixture.html'});await route.fulfill({response,body:(await response.text()).replace('src="./popup-fixture.tsx"','src="/tests/ui/popup-fixture.tsx"')});
 });
});
async function board(page:Page,query=''){
 await page.goto('/workspaces/workspace-b/projects/project-b'+query);await expect(page.locator('.kb-card')).toBeVisible();
}
async function open(page:Page,query=''){
 await board(page,query);await page.getByRole('button',{name:/^Discussion/}).click();await page.getByRole('button',{name:/^Polls for/}).click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByText('Choose one option',{exact:true})).toBeVisible();
}
test('Create a bounded poll inside Discussion with lazy queries and retained task layout',async({page})=>{
 await board(page,'?empty');expect(await page.evaluate(()=>window.experienceRegression.activeQueries['polls:list']??0)).toBe(0);
 await page.getByRole('button',{name:/^Discussion/}).click();expect(await page.evaluate(()=>window.experienceRegression.activeQueries['polls:list']??0)).toBe(0);await page.getByRole('button',{name:/^Polls for/}).click();
 await dialog(page).getByRole('button',{name:'New poll',exact:true}).click();await dialog(page).getByLabel('Question',{exact:true}).fill(question);await dialog(page).getByLabel('Option 1',{exact:true}).fill('Blue design');await dialog(page).getByLabel('Option 2',{exact:true}).fill(' blue design ');await expect(dialog(page).getByRole('button',{name:'Create poll',exact:true})).toBeDisabled();
 await dialog(page).getByLabel('Option 2',{exact:true}).fill('Green design');for(let n=3;n<=6;n++){await dialog(page).getByRole('button',{name:'Add option',exact:true}).click();await dialog(page).getByLabel('Option '+n,{exact:true}).fill('Alternative '+n);}
 await expect(dialog(page).getByRole('button',{name:'Add option',exact:true})).toHaveCount(0);await dialog(page).getByRole('button',{name:'Remove option 6',exact:true}).click();await dialog(page).getByRole('button',{name:'Create poll',exact:true}).click();await expect(dialog(page).getByRole('heading',{name:question,exact:true})).toBeVisible();
 const create=await page.evaluate(()=>window.notificationRegression.mutations.find(call=>call.name==='polls:create'));expect(create?.args.options).toHaveLength(5);expect(String(create?.args.requestKey)).toHaveLength(36);
 await dialog(page).getByRole('button',{name:'Close polls',exact:true}).click();await expect(page.getByRole('button',{name:/^Polls for/})).toBeFocused();await expect.poll(()=>page.evaluate(()=>window.experienceRegression.activeQueries['polls:list']??0)).toBe(0);
});
test('Vote, change choice and remove a vote using server-backed totals',async({page})=>{
 await open(page);await dialog(page).getByRole('radio',{name:/Blue design/}).check();await expect(dialog(page).getByRole('radio',{name:/Blue design/})).toBeChecked();await expect(dialog(page).getByText(/1 vote · You/)).toBeVisible();
 await dialog(page).getByRole('radio',{name:/Green design/}).check();await expect(dialog(page).getByRole('radio',{name:/Green design/})).toBeChecked();await expect(dialog(page).getByText(/1 vote · You/)).toBeVisible();
 await dialog(page).getByRole('button',{name:'Remove my vote',exact:true}).click();await expect(dialog(page).getByRole('radio',{name:/Green design/})).not.toBeChecked();await expect(dialog(page).getByText(/0 votes · You/)).toBeVisible();
});
test('Closing a poll is confirmed and retains read-only results',async({page})=>{
 await open(page);await dialog(page).getByRole('button',{name:'Close poll',exact:true}).click();await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Close poll?',exact:true})}).getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog(page).getByRole('radio').first()).toBeEnabled();
 await dialog(page).getByRole('button',{name:'Close poll',exact:true}).click();await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Close poll?',exact:true})}).getByRole('button',{name:'Close poll',exact:true}).click();await expect(dialog(page).getByText('Closed',{exact:true})).toBeVisible();await expect(dialog(page).getByRole('radio').first()).toBeDisabled();
});
test('Viewer and archived projects remain read-only; revocation removes the poll content',async({page})=>{
 for(const query of ['?viewer','?archived']){await open(page,query);await expect(dialog(page).getByRole('button',{name:'New poll',exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('radio').first()).toBeDisabled();await expect(dialog(page).getByRole('button',{name:'Close poll',exact:true})).toHaveCount(0);}
 await page.evaluate(()=>window.pollFixture.change({denied:true}));await expect(dialog(page).getByRole('heading',{name:question,exact:true})).toHaveCount(0);await expect(dialog(page).getByRole('button',{name:'Try again',exact:true})).toBeVisible();
});
test('Failed creation retains the draft and uses the same idempotency key on retry',async({page})=>{
 await open(page);await dialog(page).getByRole('button',{name:'New poll',exact:true}).click();await dialog(page).getByLabel('Question',{exact:true}).fill('When should we demo?');await dialog(page).getByLabel('Option 1',{exact:true}).fill('Monday');await dialog(page).getByLabel('Option 2',{exact:true}).fill('Friday');await page.evaluate(()=>window.pollFixture.change({fail:true}));await dialog(page).getByRole('button',{name:'Create poll',exact:true}).click();
 await expect(page.getByText('Could not create the poll. Check the question and options, then retry.',{exact:true})).toBeVisible();await expect(dialog(page).getByLabel('Question',{exact:true})).toHaveValue('When should we demo?');page.once('dialog',event=>event.dismiss());await page.keyboard.press('Escape');await expect(dialog(page)).toBeVisible();
 await page.evaluate(()=>window.pollFixture.change({fail:false}));await dialog(page).getByRole('button',{name:'Create poll',exact:true}).click();await expect(dialog(page).getByRole('heading',{name:'When should we demo?',exact:true})).toBeVisible();const calls=await page.evaluate(()=>window.notificationRegression.mutations.filter(call=>call.name==='polls:create'));expect(calls).toHaveLength(2);expect(calls[0].args.requestKey).toBe(calls[1].args.requestKey);
});
test('Pending creation protects drafts, modal dismissal and browser navigation',async({page})=>{
 await open(page,'?target=pending-save');await dialog(page).getByRole('button',{name:'New poll',exact:true}).click();await dialog(page).getByLabel('Question',{exact:true}).fill('When should we demo?');await dialog(page).getByLabel('Option 1',{exact:true}).fill('Monday');await dialog(page).getByLabel('Option 2',{exact:true}).fill('Friday');await dialog(page).getByRole('button',{name:'Create poll',exact:true}).click();await expect(dialog(page).getByRole('button',{name:'Close polls',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog(page)).toBeVisible();await page.evaluate(()=>window.experienceRegression.completeSave());await expect(dialog(page).getByRole('button',{name:'Close polls',exact:true})).toBeEnabled();
});
test('Poll notifications open the exact poll through the existing router and survive F5',async({page})=>{
 await board(page);await page.evaluate(()=>window.pollFixture.notice());await page.getByRole('button',{name:/^Notifications,/}).click();await page.locator('.notify-item').filter({hasText:'New poll: Which design should we ship?'}).click();await expect(page).toHaveURL(/\?task=task-b&poll=poll-1$/);await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('article',{name:'Poll: '+question,exact:true})).toBeFocused();await page.reload();await expect(dialog(page).getByRole('heading',{name:question,exact:true})).toBeVisible();
 await page.goto('/workspaces/workspace-b/projects/project-b?task=task-b&poll=poll-missing');await expect(dialog(page).getByText('This poll is no longer available. You can browse the other polls for this task.',{exact:true})).toBeVisible();await expect(dialog(page).getByRole('heading',{name:question,exact:true})).toBeVisible();
});
test('Long poll content stays readable and keyboard-accessible without viewport overflow',async({page},info)=>{
 await open(page);await page.evaluate(()=>{const row=window.pollFixture.rows[0];row.question='Which version should our team use for the final project demonstration and presentation?';row.options[0].label='A carefully reviewed design with accessible navigation and clear task details for the entire team';window.pollFixture.change({});});
 expect(await dialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);await dialog(page).getByRole('radio').first().focus();await page.keyboard.press('Space');await expect(dialog(page).getByRole('radio').first()).toBeChecked();await page.keyboard.press('Tab');expect(await dialog(page).evaluate(element=>element.contains(document.activeElement))).toBe(true);
 fs.mkdirSync('node_modules/.cache/polls',{recursive:true});await dialog(page).screenshot({path:`node_modules/.cache/polls/${info.project.name}.png`});
});
