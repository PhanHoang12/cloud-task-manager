import { expect, test, type Page } from "@playwright/test";

const fixture = "/tests/ui/popup-fixture.html";
const trigger = (page: Page) => page.getByRole("button", { name: /^Thông báo, \d+ chưa đọc$/ });
const popup = (page: Page) => page.getByRole("dialog", { name: "Thông báo", exact: true });
const item = (page: Page, text: string) => popup(page).locator(".notify-item").filter({ hasText: text });

test.beforeEach(async ({ page }) => {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading} from "/tests/ui/notification-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton} from "/tests/ui/notification-mock.ts";',
  }));
});

async function navigate(page: Page, name: string) {
  const destination = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await destination.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await destination.click();
}
async function personal(page: Page, query = "") {
  await page.goto(fixture + query);
  await navigate(page, "Công việc cá nhân");
  await expect(page.locator(".personal-dashboard")).toBeVisible();
}
async function linkedTask(page: Page) {
  const card = page.getByRole("article", { name: "Công việc: Công việc liên quan", exact: true });
  await expect(card).toBeFocused();
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  await expect(card).toHaveCSS("outline-width", "3px");
  return card;
}

test("M3 shared shell exposes one notification trigger across personal, workspace, profile and Kanban", async ({ page }, testInfo) => {
  await page.goto(fixture);
  await expect(trigger(page)).toHaveCount(1);
  await expect(page.locator(".ctp-header").getByRole("button", { name: /^Thông báo,/ })).toHaveCount(1);
  for (const name of ["Công việc cá nhân", "Hồ sơ cá nhân", "Không gian và dự án"]) {
    await navigate(page, name);
    await expect(trigger(page)).toHaveCount(1);
    await expect(trigger(page)).toBeVisible();
    await expect(trigger(page)).toHaveAccessibleName("Thông báo, 9 chưa đọc");
  }
  await page.getByRole("button", { name: "Mở dự án Dự án hiện tại", exact: true }).click();
  await expect(page.locator(".kb-page")).toBeVisible();
  await expect(trigger(page)).toHaveCount(1);
  await expect(page.locator(".kb-page .notify-btn")).toHaveCount(0);
  await trigger(page).press("Enter");
  await expect(popup(page).getByRole("button", { name: "Đóng thông báo", exact: true })).toBeFocused();
  expect(await page.locator(".ctp-header-account").evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth;
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("shared-notification.png") });
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
});

test("M3 unread counts and realtime notification changes survive switching screens", async ({ page }) => {
  await personal(page);
  await page.evaluate(() => { window.notificationRegression.addNotification(); window.notificationRegression.addNotification(); });
  await expect(trigger(page)).toHaveAccessibleName("Thông báo, 11 chưa đọc");
  await expect(page.locator(".notify-badge")).toHaveText("9+");
  await trigger(page).click();
  await item(page, "Chỉ có nội dung thông báo").click();
  await expect(trigger(page)).toHaveAccessibleName("Thông báo, 10 chưa đọc");
  await page.keyboard.press("Escape");
  await navigate(page, "Không gian và dự án");
  await expect(trigger(page)).toHaveAccessibleName("Thông báo, 10 chưa đọc");
  expect(await page.evaluate(() => window.notificationRegression.mutations.filter(call => call.name === "notifications:markRead"))).toEqual([
    { name: "notifications:markRead", args: { notificationId: "notice-no-ids" } },
  ]);
});

for (const [kind, message] of [
  ["comment", "Bình luận liên quan"], ["assigned", "Công việc được giao"],
  ["deadline_upcoming", "Công việc sắp đến hạn"], ["deadline_overdue", "Công việc quá hạn"],
]) {
  test(`M3 ${kind} opens the authorized workspace/project and focuses the related task`, async ({ page }, testInfo) => {
    await personal(page);
    await trigger(page).press("Enter");
    await expect(item(page, message)).toContainText("Mở công việc");
    await item(page, message).press("Enter");
    const card = await linkedTask(page);
    await expect(popup(page)).toHaveCount(0);
    await expect(page.locator("dialog.ui-modal")).toHaveCount(0);
    const lookups = await page.evaluate(() => window.notificationRegression.lookups);
    expect(lookups).toEqual([
      { name: "workspaces:list", args: {} },
      { name: "projects:list", args: { workspaceId: "workspace-a" } },
      { name: "projects:list", args: { workspaceId: "workspace-b" } },
      { name: "projectTasks:list", args: { projectId: "project-b" } },
    ]);
    expect(await page.evaluate(() => window.notificationRegression.mutations.filter(call => call.name === "notifications:markRead"))).toEqual([
      { name: "notifications:markRead", args: { notificationId: "notice-" + kind } },
    ]);
    if (kind === "comment") await card.screenshot({ path: testInfo.outputPath("linked-task.png") });
    await page.locator(".kb-back").click();
    await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-b");
  });
}

test("M3 a project-only record opens its project without inventing a task destination", async ({ page }) => {
  await personal(page);
  await trigger(page).click();
  await expect(item(page, "Cập nhật chỉ có dự án")).toContainText("Mở dự án");
  await item(page, "Cập nhật chỉ có dự án").click();
  const heading = page.getByRole("heading", { name: "Dự án liên quan", exact: true });
  await expect(heading).toBeFocused();
  await expect(page.locator(".kb-card[data-notification-target]")).toHaveCount(0);
  expect((await page.evaluate(() => window.notificationRegression.lookups)).some(call => call.name === "projectTasks:list")).toBe(false);
});

test("M3 records without a project ID remain mark-read only, even when they contain a task ID", async ({ page }) => {
  await personal(page);
  await trigger(page).click();
  for (const message of ["Chỉ có nội dung thông báo", "Thông báo chỉ có mã công việc"]) {
    await expect(item(page, message).locator(".notify-destination")).toHaveCount(0);
    await item(page, message).click();
    await expect(popup(page)).toBeVisible();
    await expect(page.locator(".personal-dashboard")).toBeVisible();
  }
  expect(await page.evaluate(() => window.notificationRegression.lookups)).toEqual([]);
});

for (const [mode, message] of [
  ["project-deleted", "Bình luận liên quan"], ["task-deleted", "Bình luận liên quan"],
  ["no-access", "Bình luận liên quan"], ["denied", "Bình luận liên quan"], ["auth", "Bình luận liên quan"],
  ["missing-project-record", "Liên kết dự án không còn khả dụng"], ["missing-task-record", "Liên kết công việc không còn khả dụng"],
]) {
  test(`M3 unavailable target (${mode}) preserves the current view and safe recovery`, async ({ page }) => {
    await personal(page, "?target=" + mode);
    await trigger(page).press("Enter");
    await item(page, message).press("Enter");
    await expect(popup(page).getByRole("alert")).toContainText(mode === "auth" ? "phiên đăng nhập" : "quyền truy cập");
    await expect(page.locator(".personal-dashboard")).toBeVisible();
    await expect(page.locator(".kb-page")).toHaveCount(0);
    await expect(item(page, message)).toBeFocused();
    await expect(page.locator("body")).not.toContainText(/PRIVATE_|backend\/|project-missing|task-missing/);
    if (mode === "no-access") {
      expect((await page.evaluate(() => window.notificationRegression.lookups)).some(call => call.args.workspaceId === "workspace-b")).toBe(false);
    }
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
  });
}

for (const dismissal of ["Escape", "trigger"]) {
test(`M3 ${dismissal} cancels a pending lookup and ignores its late result`, async ({ page }) => {
  await personal(page, "?target=pending");
  await trigger(page).press("Enter");
  await item(page, "Bình luận liên quan").press("Enter");
  await expect(popup(page).getByRole("status")).toContainText("Đang mở");
  await expect.poll(async () => (await page.evaluate(() => window.notificationRegression.lookups)).filter(call => call.name === "projects:list" && call.args.workspaceId === "workspace-b").length).toBe(1);
  await item(page, "Bình luận liên quan").press("Enter");
  if (dismissal === "Escape") await page.keyboard.press("Escape");
  else await trigger(page).click();
  await expect(trigger(page)).toBeFocused();
  await page.evaluate(() => window.notificationRegression.completeLookup());
  await expect(page.locator(".personal-dashboard")).toBeVisible();
  await expect(page.locator(".kb-page")).toHaveCount(0);
  expect((await page.evaluate(() => window.notificationRegression.lookups)).filter(call => call.name === "projects:list" && call.args.workspaceId === "workspace-b")).toHaveLength(1);
});
}

test("M3 membership revocation after lookup is revalidated by the destination view", async ({ page }) => {
  await personal(page, "?target=revoked-after-lookup");
  await trigger(page).click();
  await item(page, "Bình luận liên quan").click();
  await expect(page.getByRole("alert")).toContainText("Không thể mở nội dung liên quan");
  await expect(page.locator(".kb-page")).toHaveCount(0);
  await page.getByRole("button", { name: "Về danh sách dự án", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
});

test("M3 a task disappearing after lookup gives an explanation without breaking its project", async ({ page }) => {
  await personal(page, "?target=task-removed-after-lookup");
  await trigger(page).click();
  await item(page, "Bình luận liên quan").click();
  await expect(page.getByRole("alert")).toContainText("Không tìm thấy công việc được liên kết");
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toBeFocused();
});

test("M3 viewer and archived-project restrictions survive destination navigation", async ({ page }) => {
  await personal(page, "?viewer=1&archived=1");
  await trigger(page).click();
  await item(page, "Bình luận liên quan").click();
  const card = await linkedTask(page);
  await expect(page.getByRole("button", { name: "+ Công việc mới", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
  await expect(card.getByRole("combobox", { name: /Trạng thái/ })).toBeDisabled();
});

test("M3 mark-read failure retains existing feedback and does not start destination queries", async ({ page }) => {
  await personal(page, "?target=read-error");
  await trigger(page).click();
  await item(page, "Bình luận liên quan").click();
  await expect(popup(page).getByRole("alert")).toHaveText("Không thể đánh dấu thông báo đã đọc.");
  expect(await page.evaluate(() => window.notificationRegression.lookups)).toEqual([]);
  await expect(page.locator(".personal-dashboard")).toBeVisible();
});

test("M3 already-read and repeated notifications can reopen a task without retry loops or extra mark-read calls", async ({ page }) => {
  await personal(page);
  await trigger(page).click();
  await item(page, "Thông báo đã đọc có liên kết").click();
  await linkedTask(page);
  await page.locator(".kb-back").focus();
  await trigger(page).click();
  await item(page, "Thông báo đã đọc có liên kết").click();
  await linkedTask(page);
  expect((await page.evaluate(() => window.notificationRegression.lookups)).filter(call => call.name === "projectTasks:list")).toHaveLength(2);
  expect((await page.evaluate(() => window.notificationRegression.mutations)).filter(call => call.name === "notifications:markRead")).toHaveLength(0);
});

test("M3 a notification query failure stays local to the shared shell and can be retried", async ({ page }) => {
  await page.goto(fixture + "?target=query-error");
  const failure = page.getByRole("alert", { name: "Không thể hiển thị nội dung", exact: true });
  await expect(failure).toContainText("Thông báo");
  await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở trình đơn tài khoản", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_QUERY_DETAILS");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.notificationRegression.recoverQuery());
  await failure.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(trigger(page)).toHaveCount(1);
  await expect(trigger(page)).toHaveAccessibleName("Thông báo, 9 chưa đọc");
});

test("M3 explicit notification navigation resets a failed workspace screen", async ({ page }) => {
  await page.goto(fixture + "?target=main-error");
  await expect(page.getByRole("alert", { name: "Không thể hiển thị nội dung", exact: true })).toBeVisible();
  await expect(trigger(page)).toBeVisible();
  await trigger(page).press("Enter");
  await item(page, "Bình luận liên quan").press("Enter");
  await linkedTask(page);
  await expect(page.getByRole("alert", { name: "Không thể hiển thị nội dung", exact: true })).toHaveCount(0);
  expect((await page.evaluate(() => window.notificationRegression.lookups)).filter(call => call.name === "projectTasks:list")).toHaveLength(1);
});
