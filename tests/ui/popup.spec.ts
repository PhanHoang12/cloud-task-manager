import { expect, test, type Page } from "@playwright/test";

const fixture = "/tests/ui/popup-fixture.html";
const accountTrigger = (page: Page) => page.getByRole("button", { name: "Mở trình đơn tài khoản", exact: true });
const accountPopup = (page: Page) => page.getByRole("group", { name: "Tùy chọn tài khoản", exact: true });
const notifyTrigger = (page: Page) => page.getByRole("button", { name: /^Thông báo, (?:\d+ chưa đọc|đang tải)$/ });
const notifyPopup = (page: Page) => page.getByRole("dialog", { name: "Thông báo", exact: true });

test.beforeEach(async ({ page }) => {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export {useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading} from "/tests/ui/popup-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export {useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton} from "/tests/ui/popup-mock.ts";',
  }));
});

async function board(page: Page, query = "") {
  await page.goto(fixture + query);
  await page.getByRole("button", { name: "Mở dự án Dự án kiểm tra", exact: true }).click();
  await expect(notifyTrigger(page)).toBeVisible();
}

for (const key of ["Enter", "Space"]) {
  test(`M2 notifications open with ${key}, expose non-modal semantics, and restore focus on Escape`, async ({ page }, testInfo) => {
    await board(page);
    const trigger = notifyTrigger(page);
    await trigger.focus();
    await trigger.press(key);
    const popup = notifyPopup(page);
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("aria-modal", "false");
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await expect(trigger).toHaveAttribute("aria-controls", (await popup.getAttribute("id"))!);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(popup.getByRole("button", { name: "Đóng thông báo", exact: true })).toBeFocused();
    expect(await popup.evaluate(element => element.parentElement === document.body)).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll("dialog:modal, [inert]").length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    if (key === "Enter") await page.screenshot({ path: testInfo.outputPath("notification-keyboard.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.press(key);
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test(`M2 account disclosure opens with ${key} and restores focus on Escape`, async ({ page }, testInfo) => {
    await board(page);
    const trigger = accountTrigger(page);
    await trigger.focus();
    await trigger.press(key);
    const popup = accountPopup(page);
    await expect(popup).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-controls", (await popup.getAttribute("id"))!);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(popup).not.toHaveAttribute("aria-modal", "true");
    await expect(popup.getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true })).toBeFocused();
    await expect(page.locator(".ctp-profile-backdrop")).toHaveJSProperty("tabIndex", -1);
    if (key === "Enter") await page.screenshot({ path: testInfo.outputPath("account-keyboard.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
}

test("M2 portaled notifications keep forward and reverse Tab beside their trigger", async ({ page }) => {
  await board(page);
  await notifyTrigger(page).press("Enter");
  const popup = notifyPopup(page);
  const close = popup.getByRole("button", { name: "Đóng thông báo", exact: true });
  const items = popup.locator(".notify-item");
  await page.keyboard.press("Tab");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(notifyTrigger(page)).toBeFocused();
  await expect(popup).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  const before = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  await expect(await before.isVisible() ? before : page.getByRole("navigation").getByRole("button", { name: "Hồ sơ cá nhân", exact: true })).toBeFocused();
  await notifyTrigger(page).press("Enter");
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press("Tab");
    await expect(notifyPopup(page).locator(".notify-item").nth(index)).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const next = accountTrigger(page);
  await expect(next).toBeFocused();
  await expect(popup).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(notifyTrigger(page)).toBeFocused();
});

test("M2 account Tab exits without visiting the backdrop or trapping focus", async ({ page }) => {
  await board(page);
  await accountTrigger(page).press("Enter");
  const popup = accountPopup(page);
  const profile = popup.getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true });
  const security = popup.getByRole("button", { name: "Bảo mật và đăng nhập", exact: true });
  const logout = popup.getByRole("button", { name: "Đăng xuất", exact: true });
  await page.keyboard.press("Tab");
  await expect(security).toBeFocused();
  await page.evaluate(() => window.popupRegression.changeAccountName("Tên tài khoản vừa cập nhật"));
  await expect(security).toBeFocused();
  await expect(popup).toContainText("Tên tài khoản vừa cập nhật");
  await page.keyboard.press("Tab");
  await expect(logout).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(security).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(profile).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(accountTrigger(page)).toBeFocused();
  await expect(popup).toHaveCount(0);
  await accountTrigger(page).press("Enter");
  await accountTrigger(page).focus();
  await page.keyboard.press("Tab");
  await expect(profile).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Trở về danh sách dự án/ })).toBeFocused();
  await expect(popup).toHaveCount(0);
});

test("M2 click-outside dismissal preserves notification navigation and the account backdrop", async ({ page }) => {
  await board(page);
  // Navigation remains an exposed outside action across the compact board layouts.
  const personal = page.getByRole("navigation").getByRole("button", { name: "Công việc cá nhân", exact: true });
  if (!await personal.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await notifyTrigger(page).click();
  await personal.click();
  await expect(notifyPopup(page)).toHaveCount(0);
  await expect(page.locator(".personal-dashboard")).toBeVisible();
  await accountTrigger(page).click();
  await expect(accountPopup(page)).toBeVisible();
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height - 20);
  await expect(accountPopup(page)).toHaveCount(0);
  await expect(accountTrigger(page)).toBeFocused();
  expect(await page.evaluate(() => window.popupRegression.securityCalls + window.popupRegression.signOutCalls)).toBe(0);
});

test("M2 leaving a notification popup does not steal focus from outside controls or an H1 dialog", async ({ page }) => {
  await board(page);
  await notifyTrigger(page).press("Enter");
  const create = page.getByRole("button", { name: "+ Công việc mới", exact: true });
  await create.focus();
  await expect(notifyPopup(page)).toHaveCount(0);
  await expect(create).toBeFocused();
  await notifyTrigger(page).click();
  // M9 brings this action higher on mobile, behind the open non-modal panel.
  // Use native keyboard activation there; pointer click-away has separate coverage.
  const covered = await create.evaluate(element => {
    const box = element.getBoundingClientRect();
    return !element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  });
  if (covered) await create.press("Enter");
  else await create.click();
  const dialog = page.getByRole("dialog", { name: "Tạo công việc", exact: true });
  await expect(dialog.getByLabel("Tiêu đề *", { exact: true })).toBeFocused();
  await expect(notifyPopup(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
});

test("M2 switching between account and notification popups leaves only the active popup open", async ({ page }) => {
  await board(page);
  await notifyTrigger(page).press("Enter");
  await accountTrigger(page).click();
  await expect(notifyPopup(page)).toHaveCount(0);
  await expect(accountPopup(page).getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(accountTrigger(page)).toBeFocused();
  await notifyTrigger(page).press("Enter");
  await expect(accountPopup(page)).toHaveCount(0);
  await expect(notifyPopup(page).getByRole("button", { name: "Đóng thông báo", exact: true })).toBeFocused();
});

test("M2 notification actions keep focus through query updates and preserve original mutation arguments", async ({ page }) => {
  await board(page);
  await notifyTrigger(page).press("Enter");
  const items = notifyPopup(page).locator(".notify-item");
  await page.keyboard.press("Tab");
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(notifyTrigger(page)).toHaveAccessibleName("Thông báo, 1 chưa đọc");
  await expect(items.nth(0)).toBeFocused();
  await items.nth(2).press("Enter");
  expect(await page.evaluate(() => window.popupRegression.calls.filter(call => call.name === "notifications:markRead"))).toEqual([
    { name: "notifications:markRead", args: { notificationId: "notice-one" } },
  ]);
  await notifyPopup(page).getByRole("button", { name: "Đóng thông báo", exact: true }).click();
  await expect(notifyTrigger(page)).toBeFocused();
});

for (const state of ["empty", "loading"]) {
  test(`M2 notification ${state} state retains a focusable close action and Tab exit`, async ({ page }) => {
    await board(page, "?notifications=" + state);
    await notifyTrigger(page).press("Enter");
    const close = notifyPopup(page).getByRole("button", { name: "Đóng thông báo", exact: true });
    await expect(close).toBeFocused();
    await expect(notifyPopup(page)).toContainText(state === "empty" ? "Chưa có thông báo" : "Đang tải thông báo...");
    if (state === "loading") {
      await page.keyboard.press("Tab");
      await expect(accountTrigger(page)).toBeFocused();
      await expect(notifyPopup(page)).toHaveCount(0);
      await notifyTrigger(page).press("Enter");
      await expect(close).toBeFocused();
      await page.evaluate(() => window.popupRegression.resolveNotifications());
      await expect(close).toBeFocused();
      await expect(notifyPopup(page).locator(".notify-item")).toHaveCount(3);
      await page.keyboard.press("Escape");
      await expect(notifyTrigger(page)).toBeFocused();
    } else {
      await page.keyboard.press("Tab");
      await expect(accountTrigger(page)).toBeFocused();
      await expect(notifyPopup(page)).toHaveCount(0);
    }
  });
}

test("M2 notification failures preserve keyboard recovery and existing error feedback", async ({ page }) => {
  await board(page, "?notifications=error");
  await notifyTrigger(page).press("Enter");
  const item = notifyPopup(page).locator(".notify-item").first();
  await item.press("Enter");
  await expect(notifyPopup(page).getByRole("alert")).toContainText("Không thể đánh dấu thông báo đã đọc.");
  await expect(item).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(notifyTrigger(page)).toBeFocused();
  await notifyTrigger(page).press("Enter");
  await expect(notifyPopup(page).getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => { window.popupRegression.failRead = false; });
  await notifyPopup(page).locator(".notify-item").first().press("Enter");
  await expect(notifyTrigger(page)).toHaveAccessibleName("Thông báo, 1 chưa đọc");
});

test("M2 account profile, security and logout functions still execute without focus theft", async ({ page }) => {
  await board(page);
  await accountTrigger(page).press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân", exact: true })).toBeVisible();
  await expect(accountPopup(page)).toHaveCount(0);

  await board(page);
  await accountTrigger(page).press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(accountPopup(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.popupRegression.securityCalls)).toBe(1);
  await expect(page.getByTestId("security-focus")).toBeFocused();

  await board(page);
  await accountTrigger(page).press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.popupRegression.signOutCalls)).toBe(1);
  await expect(accountPopup(page)).toHaveCount(0);
});
