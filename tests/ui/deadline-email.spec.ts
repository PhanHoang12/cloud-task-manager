import {test,expect,type Page} from './test';
import fs from 'node:fs';
const fixture='/tests/ui/popup-fixture.html';
const preference=(page:Page)=>page.getByRole('checkbox',{name:'Email me about upcoming task deadlines',exact:true});
async function navigate(page:Page,name:string){const target=page.getByRole('navigation').getByRole('button',{name,exact:true});if(!await target.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await target.click();}
async function open(page:Page,query=''){await page.goto(fixture+query);await navigate(page,'Profile');await expect(page.locator('.profile-form')).toBeVisible();}
test.beforeEach(async({page})=>{
 for(const [module,exports]of [['convex_react','useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading'],['@clerk_react','useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton']])await page.route('**/node_modules/.vite/deps/'+module+'.js*',route=>route.fulfill({contentType:'application/javascript',body:'export {'+exports+'} from "/tests/ui/experience-mock.ts";'}));
 await page.route('**/tests/ui/experience-mock.ts',async route=>{const response=await route.fetch();const source=(await response.text()).replace(/case "profiles:me":\s*return account;/,'case "profiles:me": return {...account,emailDeliveryAvailable:params.has("smtp-ready")};');await route.fulfill({response,body:source});});
});
test('Email reminders default off, save explicitly and persist across profile navigation',async({page})=>{
 await open(page);await expect(preference(page)).not.toBeChecked();await expect(page.getByText('Email delivery setup is pending. Your preference will be saved.',{exact:true})).toBeVisible();
 await preference(page).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Profile updated.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.notificationRegression.mutations.filter(row=>row.name==='profiles:upsert').at(-1)?.args.deadlineEmailEnabled)).toBe(true);
 await navigate(page,'My tasks');await expect(page.locator('.personal-dashboard')).toBeVisible();await navigate(page,'Profile');await expect(preference(page)).toBeChecked();
 await preference(page).uncheck();await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.notificationRegression.mutations.filter(row=>row.name==='profiles:upsert').at(-1)?.args.deadlineEmailEnabled)).toBe(false);
});
test('An unsaved email preference uses the existing navigation draft guard',async({page})=>{
 await open(page);await preference(page).check();page.once('dialog',dialog=>dialog.dismiss());await navigate(page,'My tasks');
 await expect(page.locator('.profile-form')).toBeVisible();await expect(preference(page)).toBeChecked();
 page.once('dialog',dialog=>dialog.accept());await navigate(page,'My tasks');await expect(page.locator('.personal-dashboard')).toBeVisible();
 await navigate(page,'Profile');await expect(preference(page)).not.toBeChecked();
});
test('Failed preference saves retain the selection and existing error feedback',async({page})=>{
 await open(page,'?target=save-error');await preference(page).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByText('Could not update your profile.',{exact:true})).toBeVisible();await expect(preference(page)).toBeChecked();await expect(preference(page)).toBeEnabled();
});
test('Pending saves lock the checkbox and protect navigation',async({page})=>{
 await open(page,'?target=pending-save');await preference(page).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(preference(page)).toBeDisabled();
 await navigate(page,'My tasks');await expect(page.locator('.profile-form')).toBeVisible();await page.evaluate(()=>window.experienceRegression.completeSave());await expect(preference(page)).toBeEnabled();
});
test('The compact notification setting is keyboard accessible and fits each viewport',async({page},info)=>{
 await open(page,'?smtp-ready');await expect(page.getByText('Email delivery setup is pending. Your preference will be saved.',{exact:true})).toHaveCount(0);
 await preference(page).focus();await page.keyboard.press('Space');await expect(preference(page)).toBeChecked();
 const rect=await preference(page).boundingBox();expect(rect!.width).toBeLessThanOrEqual(24);expect(rect!.width).toBeGreaterThanOrEqual(18);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 fs.mkdirSync('node_modules/.cache/deadline-email',{recursive:true});await preference(page).locator('xpath=ancestor::div[contains(@class,"profile-field-group")]').screenshot({path:`node_modules/.cache/deadline-email/${info.project.name}.png`});
});
