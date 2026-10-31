import { expect, test, type Page } from "@playwright/test";

const project = "/workspaces/workspace-b/projects/project-b";
test.beforeEach(async ({ context }) => {
  for (const [module, exports] of [
    ["convex_react", "useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],
    ["@clerk_react", "useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"],
  ]) await context.route("**/node_modules/.vite/deps/" + module + ".js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {' + exports + '} from "/tests/ui/experience-mock.ts";',
  }));
  // Serve the actual App fixture for document loads, including F5 and new tabs.
  // Runtime modules remain the real application; only Clerk/Convex are mocked.
  await context.route("**/*", async route => {
    if (!route.request().isNavigationRequest() || new URL(route.request().url()).origin !== "http://127.0.0.1:4178") return route.fallback();
    const response = await route.fetch({ url: "http://127.0.0.1:4178/tests/ui/popup-fixture.html" });
    await route.fulfill({ response, body: (await response.text()).replace('src="./popup-fixture.tsx"', 'src="/tests/ui/popup-fixture.tsx"') });
  });
});

async function navigate(page: Page, name: string) {
  const button=page.getByRole("navigation").getByRole("button", { name, exact: true });
  await expect(page.locator(".ctp-shell")).toBeVisible();
  if (!await button.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await button.click();
}

for (const [path, selector] of [
  ["/personal", ".personal-dashboard"], ["/workspaces", ".ws-projects"],
  ["/workspaces/workspace-b", ".ws-projects"], [project, ".kb-page"], ["/profile", ".profile-form"],
]) test("URL direct load and F5 restore " + path, async ({ page }) => {
  await page.goto(path); await expect(page.locator(selector)).toBeVisible();
  const canonical = new URL(page.url()).pathname;
  if (path.includes("workspace-b")) await expect(page.getByRole("heading", { name: path === project ? "Dự án liên quan" : "Không gian làm việc", exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator(selector)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(canonical);
  if (path === project) await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  if (path === "/workspaces/workspace-b") await expect(page.locator("#workspace-select")).toHaveValue("workspace-b");
});

test("a copied project URL opens independently in a new tab", async ({ page, context }) => {
  await page.goto(project); await expect(page.locator(".kb-page")).toBeVisible();
  const second=await context.newPage(); await second.goto(page.url());
  await expect(second.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  await expect(second.locator(".kb-card")).toHaveCount(1);
  expect(await second.evaluate(() => history.state.cloudTaskNavigation)).toBeUndefined();
});

test("Clerk and Convex loading preserve the destination without querying protected data", async ({ page }) => {
  await page.goto(project+"?auth=loading");
  await expect(page.getByText("Đang tải phiên đăng nhập...", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.experienceRegression.activeQueries["workspaces:list"] ?? 0)).toBe(0);
  await page.evaluate(() => window.experienceRegression.setAuthState("convex-loading"));
  await expect(page.getByText("Đang xác thực phiên đăng nhập...", { exact: true })).toBeVisible();
  await expect(page.locator(".kb-page")).toHaveCount(0);
  await page.evaluate(() => window.experienceRegression.setAuthState("signed-in"));
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(project);
});

test("a signed-out project link resumes after sign-in with a same-origin return path", async ({ page }) => {
  await page.goto(project+"?auth=signed-out");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.experienceRegression.signInReturnTo)).toBe(project+"?auth=signed-out");
  await expect(page.locator(".ctp-shell")).toHaveCount(0);
  await page.evaluate(() => window.experienceRegression.setAuthState("signed-in"));
  await expect(page.getByRole("heading", { name: "Dự án liên quan", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(project);
});

test("direct routes wait for membership and project validation before mounting the board", async ({ page }) => {
  await page.goto(project+"?loading=workspaces:list,projects:list");
  await expect(page.getByText("Đang mở nội dung liên quan…", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.experienceRegression.activeQueries["projectTasks:list"] ?? 0)).toBe(0);
  await page.evaluate(() => window.experienceRegression.setLoading(["workspaces:list"], false));
  await expect(page.locator(".kb-page")).toHaveCount(0);
  await page.evaluate(() => window.experienceRegression.setLoading(["projects:list"], false));
  await expect(page.locator(".kb-card")).toHaveCount(1);
});

for (const path of ["/workspaces/workspace-missing/projects/project-b", "/workspaces/workspace-a/projects/project-b", "/workspaces/workspace-b/projects/deleted"]) {
  test("inaccessible/mismatched/deleted direct target is safe: " + path, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Không thể mở nội dung liên quan", exact: true })).toBeVisible();
    await expect(page.locator(".kb-card")).toHaveCount(0);
    expect(await page.evaluate(() => window.experienceRegression.activeQueries["projectTasks:list"] ?? 0)).toBe(0);
    await page.getByRole("button", { name: "Về danh sách dự án", exact: true }).click();
    await expect(page.locator(".ws-projects")).toBeVisible();
  });
}

test("revocation and account switching revalidate the URL and unmount protected content", async ({ page }) => {
  await page.goto(project); await expect(page.locator(".kb-card")).toBeVisible();
  await page.evaluate(() => window.experienceRegression.switchIdentity());
  await expect(page.getByRole("heading", { name: "Không thể mở nội dung liên quan", exact: true })).toBeVisible();
  await expect(page.locator(".kb-card")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(project);
  await page.getByRole("button", { name: "Về danh sách dự án", exact: true }).click();
  await expect(page.locator("#workspace-select")).toHaveValue("workspace-a");
});

test("sign-out removes protected content and a revoked destination stays unavailable on reauthentication", async ({ page }) => {
  await page.goto(project); await expect(page.locator(".kb-card")).toBeVisible();
  await page.evaluate(() => window.experienceRegression.setAuthState("signed-out"));
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.locator(".kb-card")).toHaveCount(0);
  await page.evaluate(() => { window.experienceRegression.revokeWorkspace(); window.experienceRegression.setAuthState("signed-in"); });
  await expect(page.getByRole("heading", { name: "Không thể mở nội dung liên quan", exact: true })).toBeVisible();
});

for (const path of ["/unknown-page", "/workspaces/%2F/projects/project-b"]) test("unknown or malformed routes recover: "+path, async ({ page }) => {
  await page.goto(path); await expect(page.getByRole("heading", { name: "Không tìm thấy trang", exact: true })).toBeVisible();
  await expect(page.locator(".kb-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Về không gian làm việc", exact: true }).click();
  await expect(page.locator(".ws-projects")).toBeVisible();
});

test("notification task URLs survive F5 and browser traversal", async ({ page }) => {
  await page.goto("/personal");
  await page.getByRole("button", { name: /^Thông báo,/ }).click();
  await page.locator(".notify-item").filter({ hasText: "Bình luận liên quan" }).click();
  await expect(page).toHaveURL(new RegExp(project+"\\?task=task-b$"));
  await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
  await page.reload(); await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
  await navigate(page, "Hồ sơ cá nhân"); await page.goBack();
  await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
});

test("dirty Back/Forward cancellation preserves the URL and mounted dialog", async ({ page }) => {
  await page.goto(project); await expect(page.locator(".kb-page")).toBeVisible();
  await navigate(page, "Công việc cá nhân");
  await page.getByRole("button", { name: "Công việc mới", exact: true }).click();
  await page.getByLabel("Tiêu đề *", { exact: true }).fill("Bản nháp giữ nguyên");
  page.once("dialog", dialog => dialog.dismiss()); await page.goBack();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByLabel("Tiêu đề *", { exact: true })).toHaveValue("Bản nháp giữ nguyên");
  page.once("dialog", dialog => dialog.accept()); await page.goBack();
  await expect(page).toHaveURL(new RegExp(project+"$")); await expect(page.locator(".kb-page")).toBeVisible();
  await page.goForward(); await expect(page.locator(".personal-dashboard")).toBeVisible();
  await expect(page.locator("dialog.ui-modal")).toHaveCount(0);
});

test("dirty Forward cancellation keeps the form and the router's history position", async ({ page }) => {
  await page.goto("/personal"); await expect(page.locator(".personal-dashboard")).toBeVisible();
  await navigate(page, "Hồ sơ cá nhân"); await page.goBack();
  await page.getByRole("button", { name: "Công việc mới", exact: true }).click();
  await page.getByLabel("Tiêu đề *", { exact: true }).fill("Bản nháp trước Forward");
  page.once("dialog", dialog => dialog.dismiss()); await page.goForward();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByLabel("Tiêu đề *", { exact: true })).toHaveValue("Bản nháp trước Forward");
  page.once("dialog", dialog => dialog.accept()); await page.goForward();
  await expect(page.locator(".profile-form")).toBeVisible();
});

test("pending saves also block browser Back until the save finishes", async ({ page }) => {
  await page.goto("/personal?target=pending-save"); await expect(page.locator(".personal-dashboard")).toBeVisible();
  await navigate(page, "Hồ sơ cá nhân");
  await page.getByLabel("Họ và tên").fill("Tên đang lưu");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await page.goBack(); await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("status").filter({ hasText: "Đang lưu thay đổi" })).toBeVisible();
  await page.evaluate(() => window.experienceRegression.completeSave());
  await expect(page.getByLabel("Họ và tên")).toBeEnabled();
  await page.goBack(); await expect(page.locator(".personal-dashboard")).toBeVisible();
});

test("live membership revocation removes an already-open project", async ({ page }) => {
  await page.goto(project); await expect(page.locator(".kb-card")).toBeVisible();
  await page.evaluate(() => window.experienceRegression.revokeWorkspace());
  await expect(page.getByRole("heading", { name: "Không thể mở nội dung liên quan", exact: true })).toBeVisible();
  await expect(page.locator(".kb-card")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.experienceRegression.activeQueries["projectTasks:list"] ?? 0)).toBe(0);
});

test("workspace Back cancellation keeps its draft; confirmation discards it before changing context", async ({ page }) => {
  await page.goto("/workspaces/workspace-a");
  await page.locator("#workspace-select").selectOption("workspace-b");
  await page.getByRole("button", { name: "Dự án mới", exact: true }).click();
  const field=page.locator("dialog.ui-modal input").first();
  await field.fill("Chỉ tạo trong không gian B");
  page.once("dialog", dialog => dialog.dismiss()); await page.goBack();
  await expect(page).toHaveURL(/\/workspaces\/workspace-b$/);
  await expect(field).toHaveValue("Chỉ tạo trong không gian B");
  page.once("dialog", dialog => dialog.accept()); await page.goBack();
  await expect(page).toHaveURL(/\/workspaces\/workspace-a$/);
  await expect(page.locator("dialog.ui-modal")).toHaveCount(0);
  await page.getByRole("button", { name: "Dự án mới", exact: true }).click();
  await expect(field).toHaveValue("");
});

test("reopening the same notification target discards an inline draft only after confirmation", async ({ page }) => {
  await page.goto(project+"?task=task-b");
  await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
  await page.locator(".tc-toggle").click();
  const comment=page.getByLabel("Viết bình luận"); await comment.fill("Bình luận chưa gửi");
  await page.getByRole("button", { name: /^Thông báo,/ }).click();
  const notice=page.locator(".notify-item").filter({ hasText: "Bình luận liên quan" });
  page.once("dialog", dialog => dialog.dismiss()); await notice.click();
  await expect(comment).toHaveValue("Bình luận chưa gửi");
  page.once("dialog", dialog => dialog.accept()); await notice.click();
  await expect(page.locator(".kb-card[data-notification-target]")).toBeFocused();
  await page.locator(".tc-toggle").click(); await expect(comment).toHaveValue("");
});
