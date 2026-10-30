import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useQuery, useMutation} from "/tests/ui/assignee-mock.ts";',
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {useUser} from "/tests/ui/assignee-mock.ts";',
  }));
});
const fixture = "/tests/ui/assignee-fixture.html";
const card = (page: Page, title = "Công việc của An") => page.locator(".kb-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const assignment = (page: Page) => page.getByRole("dialog").getByRole("combobox", { name: /^Người phụ trách/ });
async function edit(page: Page) {
  await card(page).getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Tiêu đề *", { exact: true })).toBeFocused();
}

test("M1 shows names, conditional secondary identifiers and no visible Clerk IDs", async ({ page }, testInfo) => {
  await page.goto(fixture);
  await expect(card(page).locator(".kb-details")).toContainText("Nguyễn An · an.a@example.invalid");
  await expect(card(page, "Công việc của tôi").locator(".kb-details")).toContainText("Lê Minh (Bạn)");
  await expect(card(page, "Công việc chưa phân công").locator(".kb-details")).toHaveText("Chưa phân công");
  await expect(card(page, "Công việc tên dài").locator(".kb-details")).toContainText("Nguyễn Thị Minh Anh");
  expect(await card(page, "Công việc tên dài").locator(".kb-details").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await card(page, "Công việc tên dài").screenshot({ path: testInfo.outputPath("assignee-long-name.png") });
  await page.getByRole("button", { name: "+ Công việc mới", exact: true }).click();
  const select = assignment(page);
  await expect(select.locator('option[value="user_current_PRIVATE"]')).toHaveText("Lê Minh (Bạn)");
  await expect(select.locator('option[value="user_an_b_PRIVATE"]')).toHaveText("Nguyễn An · an.b@example.invalid");
  await expect(select.locator('option[value="user_missing_PRIVATE"]')).toHaveText("Thành viên chưa có tên · new@example.invalid");
  await expect(select.locator('option[value="user_blank_a_PRIVATE"]')).toHaveText("Thành viên chưa có tên · Thành viên 5");
  await expect(select.locator('option[value="user_blank_b_PRIVATE"]')).toHaveText("Thành viên chưa có tên · Thành viên 6");
  await expect(select.locator('option[value="user_viewer_PRIVATE"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/user_\w+_PRIVATE|me@example.invalid|long@example.invalid|viewer@example.invalid/);
  const queries = await page.evaluate(() => window.assigneeRegression.queries);
  expect(queries).toContain("members:list");
  expect(queries).not.toContain("workspaces:listMembers");
  // Comment names may read only the authenticated viewer profile; no arbitrary-user lookups.
  expect([...new Set(queries.filter(name => name.startsWith("profiles:")))]).toEqual(["profiles:me"]);
  await select.selectOption("user_an_a_PRIVATE");
  await page.screenshot({ path: testInfo.outputPath("assignee-names.png") });
});

test("M1 creates and edits assignments with original Clerk ID payloads", async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole("button", { name: "+ Công việc mới", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Tiêu đề *", { exact: true }).fill("Phân công bằng tên");
  await assignment(page).selectOption({ label: "Nguyễn An · an.b@example.invalid" });
  await page.getByRole("dialog").getByRole("button", { name: "Tạo công việc", exact: true }).click();
  await expect(card(page, "Phân công bằng tên").locator(".kb-details")).toContainText("Nguyễn An · an.b@example.invalid");
  await card(page, "Phân công bằng tên").getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(assignment(page)).toHaveValue("user_an_b_PRIVATE");
  await assignment(page).selectOption("user_current_PRIVATE");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(card(page, "Phân công bằng tên").locator(".kb-details")).toContainText("Lê Minh (Bạn)");
  await card(page, "Phân công bằng tên").getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await assignment(page).selectOption("");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(card(page, "Phân công bằng tên").locator(".kb-details")).toHaveText("Chưa phân công");
  const calls = await page.evaluate(() => window.assigneeRegression.calls);
  expect(calls).toHaveLength(3);
  expect(calls[0]).toMatchObject({ name: "projectTasks:create", args: { assigneeId: "user_an_b_PRIVATE" } });
  expect(calls[1]).toMatchObject({ name: "projectTasks:update", args: { assigneeId: "user_current_PRIVATE" } });
  expect(calls[2].name).toBe("projectTasks:update");
  expect(calls[2].args.assigneeId).toBeUndefined();
});

test("M1 loading and profile updates preserve the selected ID and H1 keyboard behavior", async ({ page }) => {
  await page.goto(fixture + "?mode=loading");
  await expect(card(page).locator(".kb-details")).toContainText("Đang tải người phụ trách…");
  await edit(page);
  await expect(assignment(page)).toHaveValue("user_an_a_PRIVATE");
  await expect(assignment(page)).toHaveAttribute("aria-busy", "true");
  await expect(assignment(page).locator('option[value="user_an_a_PRIVATE"]')).toHaveJSProperty("disabled", true);
  await expect(page.getByRole("status").filter({ hasText: "Đang tải danh sách thành viên…" })).toBeVisible();
  await page.evaluate(() => window.assigneeRegression.resolveMembers());
  await expect(assignment(page)).toHaveValue("user_an_a_PRIVATE");
  await expect(assignment(page)).toHaveAttribute("aria-busy", "false");
  await expect(assignment(page).locator('option[value="user_an_a_PRIVATE"]')).toHaveJSProperty("disabled", false);
  await page.evaluate(() => window.assigneeRegression.renameMember("user_an_a_PRIVATE", "Tên vừa cập nhật"));
  await expect(assignment(page).locator('option[value="user_an_a_PRIVATE"]')).toHaveText("Tên vừa cập nhật");
  await expect(assignment(page)).toHaveValue("user_an_a_PRIVATE");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Chỉnh sửa", exact: true })).toBeFocused();
  await expect(card(page).locator(".kb-details")).toContainText("Tên vừa cập nhật");
  expect(await page.evaluate(() => window.assigneeRegression.calls)).toEqual([]);
});

for (const mode of ["removed", "viewer-assignee"]) {
  test(`M1 preserves an unavailable current assignment without making it newly eligible (${mode})`, async ({ page }) => {
    await page.goto(fixture + "?mode=" + mode);
    const id = mode === "removed" ? "user_removed_PRIVATE" : "user_viewer_PRIVATE";
    const label = mode === "removed" ? "Thành viên không có trong danh sách" : "Người xem dự án";
    await expect(card(page).locator(".kb-details")).toContainText(label);
    await edit(page);
    await expect(assignment(page)).toHaveValue(id);
    await expect(assignment(page).locator('option[value="' + id + '"]')).toHaveJSProperty("disabled", true);
    await expect(assignment(page).locator('option[value="' + id + '"]')).toContainText(label);
    // Native keyboard navigation skips the retained, disabled current option.
    await assignment(page).focus();
    await assignment(page).press("Home");
    await assignment(page).press("ArrowDown");
    await expect(assignment(page)).toHaveValue("user_current_PRIVATE");
    await assignment(page).selectOption("user_an_a_PRIVATE");
    await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(card(page).locator(".kb-details")).toContainText("Nguyễn An · an.a@example.invalid");
    expect(await page.evaluate(() => window.assigneeRegression.calls[0].args.assigneeId)).toBe("user_an_a_PRIVATE");
  });
}

test("M1 membership changes during editing do not silently clear or reassign the task", async ({ page }) => {
  await page.goto(fixture);
  await edit(page);
  await page.evaluate(() => window.assigneeRegression.removeMember("user_an_a_PRIVATE"));
  await expect(assignment(page)).toHaveValue("user_an_a_PRIVATE");
  await expect(assignment(page).locator('option[value="user_an_a_PRIVATE"]')).toHaveJSProperty("disabled", true);
  await expect(assignment(page)).toContainText("Thành viên không có trong danh sách");
  expect(await page.evaluate(() => window.assigneeRegression.calls)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(card(page).locator(".kb-details")).toContainText("Thành viên không có trong danh sách");
});

test("M1 an empty directory still allows explicitly unassigned task creation", async ({ page }) => {
  await page.goto(fixture + "?mode=empty");
  await page.getByRole("button", { name: "+ Công việc mới", exact: true }).click();
  await expect(assignment(page).locator("option")).toHaveCount(1);
  await expect(assignment(page)).toHaveValue("");
  await page.getByRole("dialog").getByLabel("Tiêu đề *", { exact: true }).fill("Chưa cần phân công");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo công việc", exact: true }).click();
  await expect(card(page, "Chưa cần phân công").locator(".kb-details")).toHaveText("Chưa phân công");
  expect(await page.evaluate(() => window.assigneeRegression.calls[0].args.assigneeId)).toBeUndefined();
});

for (const role of ["owner", "admin", "member", "viewer"]) {
  test(`M1 preserves existing assignment editing eligibility for ${role}`, async ({ page }) => {
    await page.goto(fixture + "?role=" + role);
    if (role === "viewer") {
      await expect(page.getByRole("button", { name: "+ Công việc mới", exact: true })).toHaveCount(0);
      await expect(card(page).getByRole("button", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
      await expect(card(page).getByRole("combobox", { name: /Trạng thái/ })).toBeDisabled();
    } else {
      await edit(page);
      await expect(assignment(page)).toHaveValue("user_an_a_PRIVATE");
      if (role === "member") await expect(assignment(page)).toBeDisabled();
      else await expect(assignment(page)).toBeEnabled();
      await expect(assignment(page).locator('option[value="user_viewer_PRIVATE"]')).toHaveCount(0);
    }
  });
}

test("M1 does not enable task actions on an archived project", async ({ page }) => {
  await page.goto(fixture + "?inactive=1");
  await expect(page.getByRole("button", { name: "+ Công việc mới", exact: true })).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Chỉnh sửa", exact: true })).toHaveCount(0);
  await expect(card(page).getByRole("combobox", { name: /Trạng thái/ })).toBeDisabled();
});
