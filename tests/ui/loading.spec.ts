import { expect, test, type Page, type Locator } from "@playwright/test";
const fixture = "/tests/ui/popup-fixture.html";
async function navigate(page: Page, name: string) {
  const button = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await button.click();
}

async function expectReadableLoading(locator: Locator) {
  const readPair = () => locator.evaluate(element => {
    let opacity = 1, background = "";
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node); opacity *= Number(style.opacity);
      const channels = style.backgroundColor.match(/[\d.]+/g)!.map(Number);
      if (!background && (channels.length === 3 || channels[3] === 1)) background = style.backgroundColor;
    }
    return { foreground: getComputedStyle(element).color, background, opacity };
  });
  await expect.poll(async () => (await readPair()).opacity).toBe(1);
  const pair = await readPair();
  const luminance = (color: string) => {
    const linear = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  expect(pair.foreground).toBe("rgb(94, 109, 131)"); expect(pair.opacity).toBe(1);
  const values = [luminance(pair.foreground), luminance(pair.background)].sort((a,b) => b-a);
  expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading} from "/tests/ui/experience-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton} from "/tests/ui/experience-mock.ts";',
  }));
});
test("M5 personal metrics distinguish loading, loaded counts and genuine zeros", async ({ page }, testInfo) => {
  await page.goto(fixture + "?loading=tasks:list"); await navigate(page, "Công việc cá nhân");
  const stats = page.getByRole("region", { name: "Thống kê công việc cá nhân", exact: true });
  await expect(stats).toHaveAttribute("aria-busy", "true");
  await expect(stats.locator("strong")).toHaveText(["—", "—", "—", "—"]);
  await expect(page.locator(".filters span")).toHaveText(["…", "…", "…", "…"]);
  await expect(page.getByRole("status").filter({ hasText: "Đang tải công việc..." })).toBeVisible();
  await expect(page.getByText("Chưa có công việc nào", { exact: true })).toHaveCount(0);
  await expectReadableLoading(page.locator(".personal-dashboard .empty[role=status]"));
  await page.screenshot({ path: testInfo.outputPath("personal-loading.png") });
  await page.evaluate(() => window.experienceRegression.setLoading(["tasks:list"], false));
  await expect(stats.locator("strong")).toHaveText(["2", "0", "1", "50%"]);
  await expect(stats).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => window.experienceRegression.emptyData());
  await expect(stats.locator("strong")).toHaveText(["0", "0", "0", "0%"]);
  await expect(page.getByText("Chưa có công việc nào", { exact: true })).toBeVisible();
});
test("M5 notification loading never announces zero or read-all and preserves M2 focus on resolution", async ({ page }, testInfo) => {
  await page.goto(fixture + "?loading=notifications:mine");
  const trigger = page.getByRole("button", { name: "Thông báo, đang tải", exact: true });
  await expect(trigger).toHaveAttribute("aria-busy", "true"); await expect(trigger.locator(".notify-badge")).toHaveText("…");
  await trigger.press("Enter");
  const popup = page.getByRole("dialog", { name: "Thông báo", exact: true }), close = popup.getByRole("button", { name: "Đóng thông báo", exact: true });
  await expect(close).toBeFocused(); await expect(popup.getByRole("status")).toHaveText("Đang tải thông báo...");
  await expect(popup).not.toContainText("Bạn đã đọc hết"); await expect(popup).not.toContainText("Chưa có thông báo");
  await page.screenshot({ path: testInfo.outputPath("notification-loading.png") });
  await page.evaluate(() => { window.experienceRegression.emptyData(); window.experienceRegression.setLoading(["notifications:mine"], false); });
  await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(popup).toContainText("Bạn đã đọc hết thông báo"); await expect(popup).toContainText("Chưa có thông báo");
  await expect(close).toBeFocused(); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc", exact: true })).toBeFocused();
});
test("M5 workspace and project loading do not masquerade as empty; zero metrics appear only after load", async ({ page }) => {
  await page.goto(fixture + "?loading=workspaces:list");
  await expect(page.getByRole("status")).toContainText("Đang tải không gian");
  await expect(page.getByText("Chưa có không gian làm việc", { exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.experienceRegression.setLoading(["projects:list"], true); window.experienceRegression.setLoading(["workspaces:list"], false); });
  await page.getByLabel("Không gian đang chọn").selectOption("workspace-b");
  await expect(page.locator(".wo-metric strong")).toHaveText(["2", "—", "—", "—"]);
  await expect(page.getByRole("status").filter({ hasText: "Đang tải tổng quan dự án..." })).toBeVisible();
  await expectReadableLoading(page.locator(".wo-overview > .ui-inline-busy[role=status]"));
  await expect(page.getByRole("heading", { name: "Chưa có dự án", exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.experienceRegression.emptyData("projects"); window.experienceRegression.setLoading(["projects:list"], false); });
  await expect(page.locator(".wo-metric strong")).toHaveText(["2", "0", "0", "0"]);
  await expect(page.getByRole("heading", { name: "Chưa có dự án", exact: true })).toBeVisible();
});
test("M5 restored project waits for current access queries rather than rendering stale board content", async ({ page }) => {
  await page.goto(fixture); await page.getByLabel("Không gian đang chọn").selectOption("workspace-b");
  await page.getByRole("button", { name: "Mở dự án Dự án liên quan", exact: true }).click();
  await navigate(page, "Công việc cá nhân");
  await page.evaluate(() => window.experienceRegression.setLoading(["workspaces:list", "projects:list"], true));
  await navigate(page, "Không gian và dự án"); await expect(page.locator(".kb-page")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Đang mở nội dung");
  await page.evaluate(() => { window.experienceRegression.revokeWorkspace(); window.experienceRegression.setLoading(["workspaces:list", "projects:list"], false); });
  await expect(page.getByRole("alert")).toContainText("Không thể mở nội dung liên quan");
  await expect(page.locator(".kb-page")).toHaveCount(0);
});
test("M5 Kanban lanes and subtask progress distinguish loading from zero and loaded data", async ({ page }) => {
  await page.goto(fixture + "?loading=projectTasks:list,subtasks:list,automationStats:projectOverview");
  await page.getByLabel("Không gian đang chọn").selectOption("workspace-b");
  await page.getByRole("button", { name: "Mở dự án Dự án liên quan", exact: true }).click();
  await expect(page.locator(".kb-column-title > span")).toHaveText(["…", "…", "…", "…"]);
  await expectReadableLoading(page.locator(".kb-page > .kb-muted[role=status]"));
  await expect(page.getByRole("status").filter({ hasText: "Đang tải tổng quan tiến độ..." })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.setLoading(["projectTasks:list"], false));
  const progress = page.getByRole("progressbar", { name: "Tiến độ công việc con", exact: true });
  await expect(progress).not.toHaveAttribute("aria-valuenow");
  await expect(page.locator(".st-heading > span")).toHaveText("… / … • …");
  await page.evaluate(() => window.experienceRegression.setLoading(["subtasks:list", "automationStats:projectOverview"], false));
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(page.locator(".st-heading > span")).toHaveText("0/1 • 0%");
  await page.evaluate(() => window.experienceRegression.setLoading(["comments:list"], true));
  await page.locator(".tc-toggle").click();
  await expectReadableLoading(page.locator(".tc-empty[role=status]"));
  await page.evaluate(() => window.experienceRegression.setLoading(["comments:list"], false));
  await expect(page.getByText("Chưa có bình luận", { exact: true })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.emptyData());
  await expect(page.locator(".kb-column-title > span")).toHaveText(["0", "0", "0", "0"]);
});
for (const query of ["tasks:list", "notifications:mine", "projects:list"]) {
  test("M5 " + query + " query error stays distinct from loading or zero and supports explicit Retry", async ({ page }) => {
    await page.goto(fixture);
    if (query === "tasks:list") await navigate(page, "Công việc cá nhân");
    await page.evaluate(name => window.experienceRegression.failQuery(name, true), query);
    const failure = page.getByRole("alert", { name: "Không thể hiển thị nội dung", exact: true });
    await expect(failure).toBeVisible(); await expect(page.locator("body")).not.toContainText("PRIVATE_QUERY_DETAILS");
    if (query === "notifications:mine") await expect(page.getByRole("heading", { name: "Không gian làm việc", exact: true })).toBeVisible();
    await page.evaluate(name => window.experienceRegression.failQuery(name, false), query);
    await failure.getByRole("button", { name: "Thử lại", exact: true }).click(); await expect(failure).toHaveCount(0);
    if (query === "tasks:list") await expect(page.locator(".stats strong")).toHaveText(["2", "0", "1", "50%"]);
    if (query === "notifications:mine") await expect(page.getByRole("button", { name: "Thông báo, 9 chưa đọc", exact: true })).toBeVisible();
  });
}
test("M5 view changes keep one notification subscriber and unmount inactive screen queries", async ({ page }) => {
  await page.goto(fixture); await navigate(page, "Công việc cá nhân");
  const trigger = page.locator(".notify-btn"); await trigger.evaluate(element => { element.setAttribute("data-instance", "retained"); });
  for (const name of ["Hồ sơ cá nhân", "Không gian và dự án", "Công việc cá nhân"]) await navigate(page, name);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["notifications:mine"])).toBe(1);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["tasks:list"])).toBe(1);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["workspaces:list"])).toBe(0);
  await expect(trigger).toHaveAttribute("data-instance", "retained");
});
