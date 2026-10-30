
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
const fixture = "/tests/ui/popup-fixture.html";
async function board(page: Page) {
  await page.goto(fixture);
  await page.locator("#workspace-select").selectOption("workspace-b");
  await page.locator(".kb-open-project").click();
  await expect(page.locator(".kb-card")).toBeVisible();
}
async function navigate(page: Page, name: string) {
  const button = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await button.click();
}
test.beforeEach(async ({ page }) => {
  for (const [module, exports] of [
    ["convex_react", "useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],
    ["@clerk_react", "useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"],
  ]) await page.route("**/node_modules/.vite/deps/" + module + ".js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {' + exports + '} from "/tests/ui/experience-mock.ts";',
  }));
  // Extend only this browser's existing service mock; no application/backend fixture hooks.
  await page.route("**/tests/ui/experience-mock.ts", async route => {
    const response = await route.fetch();
    let source = await response.text();
    const anchor = 'if (name === "profiles:upsert")';
    expect(source).toContain(anchor);
    source = source.replace(anchor, 'if (name === "projectTasks:setStatus" || name === "projectTasks:move") tasksB = tasksB.map(item => item._id === args.taskId ? { ...item, status: args.status ?? args.targetStatus } : item); else ' + anchor);
    await route.fulfill({ response, body: source + '\n;window.kanbanLayout = { deadlines: (incomplete = false) => { summaries = { ...summaries, tasks: { ...summaries.tasks, overdue: 1, upcoming: 1 }, scope: { tasksIncomplete: incomplete, notificationsIncomplete: incomplete } }; notify(); } };' });
  });
});
test("M9 lanes lead analytics; compact subtasks and both disclosures support keyboard and responsive layout", async ({ page }, testInfo) => {
  await board(page);
  await page.evaluate(() => { scrollTo(0, 0); document.querySelector(".kb-columns")!.scrollLeft = 0; });
  await page.evaluate(() => document.fonts.ready);
  const positions = await page.evaluate(() => ({
    lane: Math.round(document.querySelector(".kb-column")!.getBoundingClientRect().top + scrollY),
    task: Math.round(document.querySelector(".kb-card")!.getBoundingClientRect().top + scrollY),
    analytics: document.querySelector(".ad-dashboard")!.getBoundingClientRect().top + scrollY,
    overflow: document.documentElement.scrollWidth > innerWidth,
    ordered: Boolean(document.querySelector(".kb-columns")!.compareDocumentPosition(document.querySelector(".ad-dashboard")!) & Node.DOCUMENT_POSITION_FOLLOWING),
  }));
  expect(positions.ordered).toBe(true); expect(positions.overflow).toBe(false);
  expect(positions.lane).toBeLessThan(page.viewportSize()!.height);
  expect(positions.task).toBeLessThan(positions.analytics);
  const dir = "node_modules/.cache/kanban-layout";
  fs.mkdirSync(dir, { recursive: true });
  const name = testInfo.project.name.replace("-viewport", "");
  fs.writeFileSync(dir + "/after-" + name + ".json", JSON.stringify(positions));
  await page.screenshot({ path: dir + "/after-" + name + ".png", fullPage: true });
  const summary = page.locator(".ad-overview > summary");
  await summary.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".ad-stats-grid")).toBeVisible();
  await page.locator(".ad-more > summary").click();
  await expect(page.getByRole("progressbar", { name: "Tỷ lệ hoàn thành công việc" })).toBeVisible();
  await summary.focus(); await page.keyboard.press("Space");
  await expect(page.locator(".ad-stats-grid")).not.toBeVisible();
  await expect(summary).toBeFocused();
  const subtasks = page.locator(".st-disclosure > summary");
  await expect(page.getByLabel("Tên công việc con")).not.toBeVisible();
  await subtasks.focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tên công việc con")).toBeVisible();
  await page.getByLabel("Tên công việc con").fill("Bản nháp công việc con");
  await subtasks.focus(); await page.keyboard.press("Space");
  await expect(page.getByLabel("Tên công việc con")).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tên công việc con")).toHaveValue("Bản nháp công việc con");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".kb-card").scrollIntoViewIfNeeded();
  await page.screenshot({ path: dir + "/after-subtasks-" + name + ".png", fullPage: true });
});
test("M9 urgent warnings remain visible, respect incomplete data and return keyboard focus to the board", async ({ page }, testInfo) => {
  await board(page);
  await page.evaluate(() => (window as unknown as { kanbanLayout: { deadlines: (value?: boolean) => void } }).kanbanLayout.deadlines(true));
  const notice = page.locator(".ad-deadline-notice");
  await expect(notice).toContainText("Đã quá hạn: 1");
  await expect(notice).toContainText("Sắp hết hạn: 1");
  await expect(notice).toContainText("chưa đầy đủ");
  await expect(page.locator(".ad-stats-grid")).not.toBeVisible();
  await page.screenshot({ path: "node_modules/.cache/kanban-layout/after-warning-" + testInfo.project.name + ".png", fullPage: true });
  expect(await notice.evaluate(element => !!(element.compareDocumentPosition(document.querySelector(".kb-columns")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByLabel("Tìm công việc", { exact: true }).fill("không có kết quả");
  await notice.getByRole("button", { name: "Xem bảng công việc" }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tìm công việc", { exact: true })).toHaveValue("");
  await expect(page.locator(".kb-columns")).toBeFocused();
  await expect(page.locator(".kb-card")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["automationStats:projectOverview"])).toBe(1);
});
test("M9 hidden subtask drafts still guard navigation and rename drafts survive collapse and save", async ({ page }) => {
  await board(page);
  const summary = page.locator(".st-disclosure > summary");
  await summary.click();
  await page.locator(".st-tools").getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Sửa tên công việc con").fill("Tên mới chưa lưu");
  await summary.click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator(".kb-back").click();
  await expect(page.locator(".kb-page")).toBeVisible();
  await summary.click(); await expect(page.getByLabel("Sửa tên công việc con")).toHaveValue("Tên mới chưa lưu");
  await page.locator(".st-edit-form").getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Tên mới chưa lưu", exact: true })).toBeVisible();
  await expect(page.locator(".st-edit-form")).toHaveCount(0);
  await page.locator(".kb-back").click(); await expect(page.locator(".ws-projects")).toBeVisible();
});
test("M9 drag-and-drop and explicit status controls retain original mutation identities", async ({ page }, testInfo) => {
  await board(page);
  const card = page.locator(".kb-card"), target = page.locator(".kb-todo");
  if (testInfo.project.name === "desktop") await card.dragTo(target);
  else {
    // Native HTML events verify handlers on narrow viewports; physical touch is separate.
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer: transfer });
    await target.dispatchEvent("dragover", { dataTransfer: transfer });
    await target.dispatchEvent("drop", { dataTransfer: transfer });
    await transfer.dispose();
  }
  await expect(page.locator(".kb-todo .kb-card")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.notificationRegression.mutations.some(call => call.name === "projectTasks:move" && call.args.taskId === "task-b" && call.args.targetStatus === "todo"))).toBe(true);
  await page.locator(".kb-card > label select").selectOption("in_progress");
  await expect(page.locator(".kb-in_progress .kb-card")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.notificationRegression.mutations.some(call => call.name === "projectTasks:setStatus" && call.args.taskId === "task-b" && call.args.status === "in_progress"))).toBe(true);
});
test("M9 preserves M3 task target focus and isolates failed analytics from healthy lanes", async ({ page }) => {
  await page.goto(fixture);
  const bell = page.getByRole("button", { name: /^Thông báo,/ });
  await bell.click();
  await page.locator(".notify-item").filter({ hasText: "Bình luận liên quan" }).click();
  await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
  await page.evaluate(() => window.experienceRegression.failQuery("automationStats:projectOverview", true));
  await expect(page.locator(".kb-page").getByRole("alert").filter({ hasText: "Tiến độ và nhắc hạn" })).toBeVisible();
  await expect(page.locator(".kb-card")).toHaveCount(1);
  await page.evaluate(() => window.experienceRegression.failQuery("automationStats:projectOverview", false));
  await page.locator(".kb-page").getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".ad-overview > summary")).toBeVisible();
  await navigate(page, "Công việc cá nhân"); await navigate(page, "Không gian và dự án");
  await expect(page.locator(".kb-page")).toBeVisible();
});
