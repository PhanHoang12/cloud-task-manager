import { expect, test, type Page } from "@playwright/test";
const fixture = "/tests/ui/assignee-fixture.html?role=member";
const panel = (page: Page) => page.locator(".kb-card").first().locator(".tc-panel");
async function open(page: Page, viewer: string, identity = "") {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useQuery,useMutation} from "/tests/ui/comments-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useUser} from "/tests/ui/comments-mock.ts";',
  }));
  await page.goto(fixture + "&viewer=" + viewer + "&identity=" + identity);
  await panel(page).locator(".tc-toggle").click();
  await expect(panel(page).locator(".tc-bubble")).toHaveText("Hiển thị tên thành viên");
}
test("comment authors use the same current profile name and monogram in two independent viewer sessions", async ({ page, browser }, testInfo) => {
  const context = await browser.newContext({ viewport: page.viewportSize()! }), other = await context.newPage();
  try {
    await open(page, "self"); await open(other, "other");
    for (const view of [page, other]) {
      await expect(panel(view).locator(".tc-author")).toHaveText("Nguyễn Hoàng");
      await expect(panel(view).locator(".tc-avatar")).toHaveText("N");
      await expect(panel(view).locator(".tc-comment")).not.toContainText(/PRIVATE_|Masn|Thành viên Masn|\(Bạn\)/);
      expect(await view.evaluate(() => window.commentRegression.calls)).toEqual([]);
    }
    await expect(panel(page).locator(".tc-delete")).toHaveCount(1);
    await expect(panel(other).locator(".tc-delete")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("comment-profile-name.png") });
  } finally { await context.close(); }
});
for (const [identity, expected] of [["missing", "Thành viên"], ["blank", "Thành viên"], ["account", "Hoàng tài khoản"]]) {
  test("comment profile state " + identity + " resolves consistently for self and another viewer", async ({ page, browser }) => {
    const context = await browser.newContext({ viewport: page.viewportSize()! }), other = await context.newPage();
    try {
      await open(page, "self", identity); await open(other, "other", identity);
      await expect(panel(page).locator(".tc-author")).toHaveText(expected);
      await expect(panel(other).locator(".tc-author")).toHaveText(expected);
      await expect(panel(page).locator(".tc-delete")).toHaveCount(1);
      await expect(panel(other).locator(".tc-delete")).toHaveCount(0);
      if (expected === "Thành viên") {
        await expect(panel(page).locator(".tc-avatar svg")).toHaveCount(1);
        await expect(panel(other).locator(".tc-avatar svg")).toHaveCount(1);
      }
    } finally { await context.close(); }
  });
}
test("comment author renames update both viewers without changing content, identity, draft or focus", async ({ page, browser }) => {
  const context = await browser.newContext({ viewport: page.viewportSize()! }), other = await context.newPage();
  try {
    await open(page, "self"); await open(other, "other");
    await panel(page).getByLabel("Viết bình luận").fill("Bản nháp chưa gửi");
    const original = await page.evaluate(() => window.commentRegression.originalComment());
    for (const view of [page, other]) await view.evaluate(() => window.commentRegression.renameAuthor("Hoàng Đã Cập Nhật"));
    for (const view of [page, other]) {
      await expect(panel(view).locator(".tc-author")).toHaveText("Hoàng Đã Cập Nhật");
      await expect(panel(view).locator(".tc-avatar")).toHaveText("H");
      expect(await view.evaluate(() => window.commentRegression.originalComment())).toEqual(original);
      expect(await view.evaluate(() => window.commentRegression.calls)).toEqual([]);
    }
    await expect(panel(page).getByLabel("Viết bình luận")).toHaveValue("Bản nháp chưa gửi");
    await expect(panel(page).getByLabel("Viết bình luận")).toBeFocused();
  } finally { await context.close(); }
});
test("removed members stay neutral for two permitted viewers without erasing their comments", async ({ page, browser }) => {
  const context = await browser.newContext({ viewport: page.viewportSize()! }), other = await context.newPage();
  try {
    await open(page, "other"); await open(other, "third");
    for (const view of [page, other]) {
      await view.evaluate(() => window.commentRegression.removeAuthor());
      await expect(panel(view).locator(".tc-author")).toHaveText("Thành viên");
      await expect(panel(view).locator(".tc-bubble")).toHaveText("Hiển thị tên thành viên");
      await expect(panel(view).locator(".tc-comment")).not.toContainText(/PRIVATE_|Masn/);
      expect(await view.evaluate(() => window.commentRegression.originalComment().authorId)).toBe("user_author_PRIVATE_Masn");
      expect(await view.evaluate(() => window.commentRegression.calls)).toEqual([]);
    }
  } finally { await context.close(); }
});
test("a deleted author profile does not fall back to Clerk or ID fragments for either viewer", async ({ page, browser }) => {
  const context = await browser.newContext({ viewport: page.viewportSize()! }), other = await context.newPage();
  try {
    await open(page, "self"); await open(other, "other");
    for (const view of [page, other]) {
      await view.evaluate(() => window.commentRegression.removeProfile());
      await expect(panel(view).locator(".tc-author")).toHaveText("Thành viên");
      await expect(panel(view).locator(".tc-avatar svg")).toHaveCount(1);
    }
  } finally { await context.close(); }
});
test("pending author data is explicit and resolves without new per-comment identity queries", async ({ page }) => {
  await open(page, "self", "loading");
  await expect(panel(page).locator(".tc-author")).toHaveText("Đang tải tên thành viên…");
  await expect(panel(page).locator(".tc-comment")).not.toContainText(/PRIVATE_|Masn/);
  await page.evaluate(() => window.commentRegression.resolveDirectory());
  await expect(panel(page).locator(".tc-author")).toHaveText("Nguyễn Hoàng");
  await expect.poll(() => page.evaluate(() => window.commentRegression.activeQueries["profiles:me"])).toBe(1);
  await expect.poll(() => page.evaluate(() => window.commentRegression.activeQueries["members:list"])).toBe(1);
  const profiles = await page.evaluate(() => window.commentRegression.queries.filter(query => query.name === "profiles:me"));
  expect(profiles.length).toBeGreaterThan(0); expect(profiles.every(query => Object.keys(query.args).length === 0)).toBe(true);
});
test("renamed self keeps original deletion arguments and comment submission still sends only task/content", async ({ page }) => {
  await open(page, "self");
  await page.evaluate(() => window.commentRegression.renameAuthor("Tên mới"));
  await panel(page).locator(".tc-delete").click();
  await page.getByRole("dialog").getByRole("button", { name: "Xóa", exact: true }).click();
  expect(await page.evaluate(() => window.commentRegression.calls[0])).toEqual({ name: "comments:remove", args: { commentId: "comment-persisted" } });
  await panel(page).getByLabel("Viết bình luận").fill("Bình luận mới");
  await panel(page).getByRole("button", { name: "Gửi", exact: true }).click();
  expect(await page.evaluate(() => window.commentRegression.calls[1])).toEqual({ name: "comments:create", args: { taskId: "task-comment", content: "Bình luận mới" } });
});
