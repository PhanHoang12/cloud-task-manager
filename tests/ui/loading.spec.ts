import { expect, test, type Page, type Locator } from "./test";
const fixture = "/tests/ui/popup-fixture.html";
async function navigate(page: Page, name: string) {
  const button = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await button.click();
}

async function expectReadableLoading(locator: Locator) {
  const readPair = () => locator.evaluate(element => {
    if (!element.isConnected || !element.getClientRects().length) return null;
    let opacity = 1, background = "";
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node); opacity *= Number(style.opacity);
      const channels = (style.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      if (!background && (channels.length === 3 || channels[3] === 1)) background = style.backgroundColor;
    }
    return background ? { foreground: getComputedStyle(element).color, background, opacity } : null;
  });
  const luminance = (color: string) => {
    const linear = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  // Route commits may replace the loading node between action and measurement.
  // Retry the entire snapshot; never accept a detached node or skip contrast.
  await expect(async () => {
    const pair = await readPair();
    expect(pair).not.toBeNull();
    if (!pair) return;
    expect(pair.foreground).toBe("rgb(94, 109, 131)"); expect(pair.opacity).toBe(1);
    const values = [luminance(pair.foreground), luminance(pair.background)].sort((a,b) => b-a);
    expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
  }).toPass({ timeout: 5000 });
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
  await page.goto(fixture + "?loading=tasks:list"); await navigate(page, "My tasks");
  const stats = page.getByRole("region", { name: "Personal task overview", exact: true });
  await expect(stats).toHaveAttribute("aria-busy", "true");
  await expect(stats.locator("strong")).toHaveText(["—", "—", "—", "—"]);
  await expect(page.locator(".filters span")).toHaveText(["…", "…", "…", "…"]);
  await expect(page.getByRole("status").filter({ hasText: "Loading tasks..." })).toBeVisible();
  await expect(page.getByText("Your next great day starts here", { exact: true })).toHaveCount(0);
  await expectReadableLoading(page.locator(".personal-dashboard .empty[role=status]"));
  await page.screenshot({ path: testInfo.outputPath("personal-loading.png") });
  await page.evaluate(() => window.experienceRegression.setLoading(["tasks:list"], false));
  await expect(stats.locator("strong")).toHaveText(["2", "0", "1", "50%"]);
  await expect(stats).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => window.experienceRegression.emptyData());
  await expect(stats.locator("strong")).toHaveText(["0", "0", "0", "0%"]);
  await expect(page.getByText("Your next great day starts here", { exact: true })).toBeVisible();
});
test("M5 notification loading never announces zero or read-all and preserves M2 focus on resolution", async ({ page }, testInfo) => {
  await page.goto(fixture + "?loading=notifications:mine");
  const trigger = page.getByRole("button", { name: "Notifications, loading", exact: true });
  await expect(trigger).toHaveAttribute("aria-busy", "true"); await expect(trigger.locator(".notify-badge")).toHaveText("…");
  await trigger.press("Enter");
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true }), close = popup.getByRole("button", { name: "Dismiss notification", exact: true });
  await expect(close).toBeFocused(); await expect(popup.getByRole("status")).toHaveText("Loading notifications...");
  await expect(popup).not.toContainText("You are all caught up"); await expect(popup).not.toContainText("A little quiet, for now");
  await page.screenshot({ path: testInfo.outputPath("notification-loading.png") });
  await page.evaluate(() => { window.experienceRegression.emptyData(); window.experienceRegression.setLoading(["notifications:mine"], false); });
  await expect(page.getByRole("button", { name: "Notifications, 0 unread", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(popup).toContainText("You are all caught up"); await expect(popup).toContainText("A little quiet, for now");
  await expect(close).toBeFocused(); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Notifications, 0 unread", exact: true })).toBeFocused();
});
test("M5 workspace and project loading do not masquerade as empty; zero metrics appear only after load", async ({ page }) => {
  await page.goto(fixture + "?loading=workspaces:list");
  await expect(page.getByRole("status")).toContainText("Loading workspaces");
  await expect(page.getByText("A fresh start for your team", { exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.experienceRegression.setLoading(["projects:list"], true); window.experienceRegression.setLoading(["workspaces:list"], false); });
  await page.getByLabel("Current workspace").selectOption("workspace-b");
  await expect(page.locator(".wo-metric strong")).toHaveText(["2", "—", "—", "—"]);
  await expect(page.getByRole("status").filter({ hasText: "Loading project overview..." })).toBeVisible();
  await expectReadableLoading(page.locator(".wo-overview > .ui-inline-busy[role=status]"));
  await expect(page.getByRole("heading", { name: "Room for your next idea", exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.experienceRegression.emptyData("projects"); window.experienceRegression.setLoading(["projects:list"], false); });
  await expect(page.locator(".wo-metric strong")).toHaveText(["2", "0", "0", "0"]);
  await expect(page.getByRole("heading", { name: "Room for your next idea", exact: true })).toBeVisible();
});
test("M5 restored project waits for current access queries rather than rendering stale board content", async ({ page }) => {
  await page.goto(fixture); await page.getByLabel("Current workspace").selectOption("workspace-b");
  await page.getByRole("button", { name: "Open project Dự án liên quan", exact: true }).click();
  await navigate(page, "My tasks");
  await page.evaluate(() => window.experienceRegression.setLoading(["workspaces:list", "projects:list"], true));
  await navigate(page, "Workspaces & projects"); await expect(page.locator(".kb-page")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Opening the linked content");
  await page.evaluate(() => { window.experienceRegression.revokeWorkspace(); window.experienceRegression.setLoading(["workspaces:list", "projects:list"], false); });
  await expect(page.getByRole("alert")).toContainText("This content is no longer available");
  await expect(page.locator(".kb-page")).toHaveCount(0);
});
test("M5 Kanban lanes and subtask progress distinguish loading from zero and loaded data", async ({ page }) => {
  await page.goto(fixture + "?loading=projectTasks:list,subtasks:list,automationStats:projectOverview");
  await page.getByLabel("Current workspace").selectOption("workspace-b");
  await page.getByRole("button", { name: "Open project Dự án liên quan", exact: true }).click();
  await expect(page.locator(".kb-column-title > span")).toHaveText(["…", "…", "…", "…"]);
  await expectReadableLoading(page.locator(".kb-page > .kb-muted[role=status]"));
  await expect(page.getByRole("status").filter({ hasText: "Loading project progress..." })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.setLoading(["projectTasks:list"], false));
  const progress = page.getByRole("progressbar", { name: "Subtask progress", exact: true });
  await expect(progress).not.toHaveAttribute("aria-valuenow");
  await expect(page.locator(".st-heading > span")).toHaveText("… / … • …");
  await page.evaluate(() => window.experienceRegression.setLoading(["subtasks:list", "automationStats:projectOverview"], false));
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(page.locator(".st-heading > span")).toHaveText("0/1 • 0%");
  await page.evaluate(() => window.experienceRegression.setLoading(["comments:list"], true));
  await page.locator(".tc-toggle").click();
  await expectReadableLoading(page.locator(".tc-empty[role=status]"));
  await page.evaluate(() => window.experienceRegression.setLoading(["comments:list"], false));
  await expect(page.getByText("Start a conversation", { exact: true })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.emptyData());
  await expect(page.locator(".kb-column-title > span")).toHaveText(["0", "0", "0", "0"]);
});
for (const query of ["tasks:list", "notifications:mine", "projects:list"]) {
  test("M5 " + query + " query error stays distinct from loading or zero and supports explicit Retry", async ({ page }) => {
    await page.goto(fixture);
    if (query === "tasks:list") await navigate(page, "My tasks");
    await page.waitForFunction(() => Boolean(window.experienceRegression));
    await page.evaluate(name => window.experienceRegression.failQuery(name, true), query);
    const failure = page.getByRole("alert", { name: "We could not display this content", exact: true });
    await expect(failure).toBeVisible(); await expect(page.locator("body")).not.toContainText("PRIVATE_QUERY_DETAILS");
    if (query === "notifications:mine") await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible();
    await page.evaluate(name => window.experienceRegression.failQuery(name, false), query);
    await failure.getByRole("button", { name: "Try again", exact: true }).click(); await expect(failure).toHaveCount(0);
    if (query === "tasks:list") await expect(page.locator(".stats strong")).toHaveText(["2", "0", "1", "50%"]);
    if (query === "notifications:mine") await expect(page.getByRole("button", { name: "Notifications, 9 unread", exact: true })).toBeVisible();
  });
}
test("M5 view changes keep one notification subscriber and unmount inactive screen queries", async ({ page }) => {
  await page.goto(fixture); await navigate(page, "My tasks");
  const trigger = page.locator(".notify-btn"); await trigger.evaluate(element => { element.setAttribute("data-instance", "retained"); });
  for (const name of ["Profile", "Workspaces & projects", "My tasks"]) await navigate(page, name);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["notifications:mine"])).toBe(1);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["tasks:list"])).toBe(1);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["workspaces:list"])).toBe(0);
  await expect(trigger).toHaveAttribute("data-instance", "retained");
});
