import { expect, test, type Page } from "@playwright/test";
const fixture = "/tests/ui/popup-fixture.html";
const names = { workspace: "Không gian và dự án", personal: "Công việc cá nhân", profile: "Hồ sơ cá nhân" };
async function navigate(page: Page, screen: keyof typeof names) {
  const button = page.getByRole("navigation").getByRole("button", { name: names[screen], exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await button.click();
}
async function board(page: Page) {
  await page.getByLabel("Không gian đang chọn").selectOption("workspace-b");
  await page.getByRole("button", { name: "Mở dự án Dự án liên quan", exact: true }).click();
  await expect(page.locator(".kb-page")).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading} from "/tests/ui/experience-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton} from "/tests/ui/experience-mock.ts";',
  }));
});
test("M4 restores workspace, project and scoped search after screen switches", async ({ page }) => {
  await page.goto(fixture); await board(page);
  await page.getByLabel("Tìm công việc", { exact: true }).fill("liên quan");
  await navigate(page, "personal");
  await page.getByLabel("Tìm công việc", { exact: true }).fill("Báo cáo");
  await page.getByRole("button", { name: /^Cần làm/ }).click();
  await navigate(page, "profile"); await navigate(page, "workspace");
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  await expect(page.getByLabel("Tìm công việc", { exact: true })).toHaveValue("liên quan");
  await navigate(page, "personal");
  await expect(page.getByLabel("Tìm công việc", { exact: true })).toHaveValue("Báo cáo");
  await expect(page.locator(".filter.selected")).toContainText("Cần làm");
  await expect(page.locator(".task-list .task")).toHaveCount(1);
});
test("M4 scopes project filters by workspace and retains them after opening a board", async ({ page }) => {
  await page.goto(fixture);
  await page.getByLabel("Tìm dự án").fill("hiện tại");
  await page.getByLabel("Không gian đang chọn").selectOption("workspace-b");
  await expect(page.getByLabel("Tìm dự án")).toHaveValue("");
  await page.getByLabel("Tìm dự án").fill("liên quan");
  await page.locator(".wo-metric.wo-blue").click();
  await page.getByRole("button", { name: "Mở dự án Dự án liên quan", exact: true }).click();
  await page.locator(".kb-back").click();
  await expect(page.getByLabel("Tìm dự án")).toHaveValue("liên quan");
  await expect(page.locator(".wo-metric.wo-blue")).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Không gian đang chọn").selectOption("workspace-a");
  await expect(page.getByLabel("Tìm dự án")).toHaveValue("hiện tại");
});
test("M4 Back and Forward restore screen and project context without storing drafts", async ({ page }) => {
  await page.goto(fixture); await board(page);
  await navigate(page, "personal"); await navigate(page, "profile");
  await page.goBack(); await expect(page.locator(".personal-dashboard")).toBeVisible();
  await page.goBack(); await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-b");
  await page.goForward(); await expect(page.locator(".kb-page")).toBeVisible();
  const serialized = await page.evaluate(() => JSON.stringify({ state: history.state, local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  expect(serialized).not.toMatch(/Sinh viên|student@example|fullName/);
  await expect(page).toHaveURL(/\/workspaces\/workspace-b\/projects\/project-b$/);
});
for (const kind of ["personal", "workspace", "project", "kanban"] as const) {
  test("M4 dirty " + kind + " dialog cancels dismissal and restores H1 focus after discard", async ({ page }) => {
    await page.goto(fixture);
    if (kind === "personal") {
      await navigate(page, "personal"); await page.getByRole("button", { name: "Công việc mới", exact: true }).click();
    } else if (kind === "kanban") { await board(page); await page.getByRole("button", { name: "+ Công việc mới", exact: true }).click(); }
    else await page.getByRole("button", { name: kind === "workspace" ? "Không gian mới" : "Dự án mới", exact: true }).click();
    const modal = page.locator("dialog.ui-modal"), field = modal.locator("input").first();
    await field.fill("Bản nháp chưa lưu");
    page.once("dialog", dialog => dialog.dismiss());
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible(); await expect(field).toHaveValue("Bản nháp chưa lưu");
    await page.keyboard.press("Tab");
    expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
    page.once("dialog", dialog => dialog.accept());
    await modal.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
  });
}
test("M4 unchanged and reverted personal edits need no discard prompt; failed saves retain drafts", async ({ page }) => {
  await page.goto(fixture + "?target=save-error"); await navigate(page, "personal");
  await page.locator(".task").first().getByRole("button", { name: "Sửa", exact: true }).click();
  const modal = page.locator("dialog.ui-modal"), field = modal.getByLabel("Tiêu đề *", { exact: true });
  const original = await field.inputValue();
  await field.fill("Đổi tên"); await field.fill(original);
  await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0);
  await page.locator(".task").first().getByRole("button", { name: "Sửa", exact: true }).click();
  await field.fill("Bản nháp khi lỗi");
  await modal.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Không thể lưu");
  page.once("dialog", dialog => dialog.dismiss()); await page.keyboard.press("Escape");
  await expect(field).toHaveValue("Bản nháp khi lỗi");
});
test("M4 profile draft survives realtime updates and cancelled Back; discard allows history traversal", async ({ page }) => {
  await page.goto(fixture); await navigate(page, "personal"); await navigate(page, "profile");
  await page.getByLabel("Họ và tên").fill("Tên riêng chưa lưu");
  await page.evaluate(() => window.experienceRegression.profileUpdate());
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Tên riêng chưa lưu");
  page.once("dialog", dialog => dialog.dismiss()); await page.goBack();
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Tên riêng chưa lưu");
  await expect(page).toHaveURL(/\/profile$/);
  page.once("dialog", dialog => dialog.accept()); await page.goBack();
  await expect(page.locator(".personal-dashboard")).toBeVisible();
  await page.goForward(); await expect(page.getByLabel("Họ và tên")).toHaveValue("Tên cập nhật từ máy khác");
});
for (const changed of ["workspace", "project", "role"] as const) {
  test("M4 restores current access after " + changed + " changes while away", async ({ page }) => {
    await page.goto(fixture); await board(page); await navigate(page, "personal");
    await page.evaluate(value => { if (value === "workspace") window.experienceRegression.revokeWorkspace(); else if (value === "project") window.experienceRegression.removeProject(); else window.experienceRegression.changeRole(); }, changed);
    await navigate(page, "workspace");
    if (changed === "role") {
      await expect(page.locator(".kb-page")).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Công việc mới", exact: true })).toHaveCount(0);
      await expect(page.locator(".kb-card select")).toBeDisabled();
    } else {
      await expect(page.getByRole("alert")).toContainText("Không thể mở nội dung liên quan");
      await expect(page.locator(".kb-page")).toHaveCount(0);
      await page.getByRole("button", { name: "Về danh sách dự án", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
    }
  });
}
test("M4 inline drafts guard board navigation and local subtask cancellation", async ({ page }) => {
  await page.goto(fixture); await board(page);
  await page.locator(".st-disclosure > summary").click();
  await page.locator(".st-tools").getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Sửa tên công việc con").fill("Tên chưa lưu");
  page.once("dialog", dialog => dialog.dismiss()); await page.locator(".kb-back").click();
  await expect(page.getByLabel("Sửa tên công việc con")).toHaveValue("Tên chưa lưu");
  page.once("dialog", dialog => dialog.dismiss()); await page.locator(".st-edit-form").getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByLabel("Sửa tên công việc con")).toBeVisible();
  page.once("dialog", dialog => dialog.accept()); await page.locator(".st-edit-form").getByRole("button", { name: "Hủy", exact: true }).click();
  await page.locator(".tc-toggle").click(); await page.getByLabel("Viết bình luận").fill("Bình luận chưa gửi");
  page.once("dialog", dialog => dialog.dismiss()); await navigate(page, "personal");
  await expect(page.getByLabel("Viết bình luận")).toHaveValue("Bình luận chưa gửi");
  page.once("dialog", dialog => dialog.accept()); await navigate(page, "personal");
  await expect(page.locator(".personal-dashboard")).toBeVisible();
});
test("M4 preserves M3 target focus and filters, and allows cancelling notification navigation", async ({ page }) => {
  await page.goto(fixture); await board(page); await page.getByLabel("Tìm công việc", { exact: true }).fill("không khớp");
  await navigate(page, "profile"); await page.getByLabel("Họ và tên").fill("Bản nháp hồ sơ");
  const trigger = page.getByRole("button", { name: /^Thông báo,/ });
  await trigger.click();
  const notice = page.locator(".notify-item").filter({ hasText: "Bình luận liên quan" });
  page.once("dialog", dialog => dialog.dismiss()); await notice.press("Enter");
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Bản nháp hồ sơ");
  await expect(page.getByRole("dialog", { name: "Thông báo", exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept()); await notice.press("Enter");
  await expect(page.getByRole("article", { name: "Công việc: Công việc liên quan", exact: true })).toBeFocused();
  await expect(page.getByLabel("Tìm công việc", { exact: true })).toHaveValue("");
});
test("M4 pending saves block navigation and clear the guard only after success", async ({ page }) => {
  await page.goto(fixture + "?target=pending-save"); await navigate(page, "profile");
  await page.getByLabel("Họ và tên").fill("Tên đã lưu");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await navigate(page, "personal"); await expect(page.locator(".profile-page")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Đang lưu thay đổi" })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.completeSave());
  await expect(page.getByLabel("Họ và tên")).toBeEnabled();
  await navigate(page, "personal"); await expect(page.locator(".personal-dashboard")).toBeVisible();
});

test("M4 remembers the initial workspace and chart range despite directory reordering", async ({ page }) => {
  await page.goto(fixture); await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-a");
  await page.locator(".wo-analytics > summary").click();
  await page.getByLabel("Khoảng thời gian biểu đồ").selectOption("3");
  await navigate(page, "personal");
  await page.evaluate(() => window.experienceRegression.reorderWorkspaces());
  await navigate(page, "workspace");
  await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-a");
  await expect(page.getByLabel("Khoảng thời gian biểu đồ")).toHaveValue("3");
});
test("M4 successful workspace creation selects the new workspace without a second discard prompt", async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole("button", { name: "Không gian mới", exact: true }).click();
  await page.locator("dialog.ui-modal input").first().fill("Không gian mới hợp lệ");
  await page.locator("dialog.ui-modal").getByRole("button", { name: "Tạo mới", exact: true }).click();
  await expect(page.locator("dialog.ui-modal")).toHaveCount(0);
  await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-new");
  await navigate(page, "personal"); await navigate(page, "workspace");
  await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-new");
});
test("M4 invitation drafts guard navigation; successful send clears the guard", async ({ page }) => {
  await page.goto(fixture);
  await page.locator(".tm-invite-section > summary").click();
  await page.getByLabel("Thư điện tử người nhận").fill("teammate@example.invalid");
  page.once("dialog", dialog => dialog.dismiss()); await navigate(page, "personal");
  await expect(page.getByLabel("Thư điện tử người nhận")).toHaveValue("teammate@example.invalid");
  await page.locator(".tm-invite").getByRole("button", { name: "Gửi lời mời", exact: true }).click();
  await expect(page.getByLabel("Thư điện tử người nhận")).toHaveValue("");
  await navigate(page, "personal"); await expect(page.locator(".personal-dashboard")).toBeVisible();
});

test("M4 Back from a dirty task dialog preserves native modality when cancelled", async ({ page }) => {
  await page.goto(fixture); await navigate(page, "personal");
  await page.getByRole("button", { name: "Công việc mới", exact: true }).click();
  const modal = page.locator("dialog.ui-modal");
  await modal.locator("input").first().fill("Bản nháp lịch sử");
  page.once("dialog", dialog => dialog.dismiss()); await page.goBack();
  await expect(modal).toBeVisible(); await expect(modal.locator("input").first()).toHaveValue("Bản nháp lịch sử");
  await expect(page).toHaveURL(/\/personal$/);
  await page.keyboard.press("Tab"); expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  page.once("dialog", dialog => dialog.accept()); await page.goBack();
  await expect(modal).toHaveCount(0); await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
});
test("M4 logout warns about a profile draft before calling the existing Clerk function", async ({ page }) => {
  await page.goto(fixture); await navigate(page, "profile");
  await page.getByLabel("Họ và tên").fill("Không lưu vào trình duyệt");
  await page.getByRole("button", { name: "Mở trình đơn tài khoản", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect(await page.evaluate(() => window.experienceRegression.signOutCalls)).toBe(0);
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Không lưu vào trình duyệt");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect(await page.evaluate(() => window.experienceRegression.signOutCalls)).toBe(1);
});

test("M4 an identity change clears prior account navigation and filters in memory", async ({ page }) => {
  await page.goto(fixture); await board(page); await navigate(page, "personal");
  await page.getByLabel("Tìm công việc", { exact: true }).fill("Từ khóa riêng của tài khoản trước");
  await page.evaluate(() => window.experienceRegression.switchIdentity());
  await expect(page.locator(".personal-dashboard")).toBeVisible();
  await navigate(page, "workspace");
  await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
  await expect(page.getByLabel("Không gian đang chọn")).toHaveValue("workspace-a");
  await navigate(page, "personal");
  await expect(page.getByLabel("Tìm công việc", { exact: true })).toHaveValue("");
  await expect(page.locator(".task-list .task")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toMatch(/workspace-b|project-b|Từ khóa riêng/);
});

test("M4 a new notification destination clears the prior missing-task warning and takes focus", async ({ page }) => {
  await page.goto(fixture + "?target=task-removed-after-lookup");
  const trigger = page.getByRole("button", { name: /^Thông báo,/ });
  await trigger.click(); await page.locator(".notify-item").filter({ hasText: "Bình luận liên quan" }).click();
  await expect(page.getByRole("alert")).toContainText("Không tìm thấy công việc được liên kết");
  await expect(page.getByRole("alert")).toBeFocused();
  await trigger.click(); await page.locator(".notify-item").filter({ hasText: "Cập nhật chỉ có dự án" }).click();
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
