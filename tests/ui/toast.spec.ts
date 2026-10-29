import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Swap only the fixture's Convex hooks; never connect to an authenticated deployment.
  await page.route("**/node_modules/.vite/deps/convex_react.js*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export { useQuery, useMutation } from "/tests/ui/toast-convex-mock.ts";',
  }));
});

async function placeSaveUnderToast(page: Page) {
  // Deterministic occlusion: move the fixture card, leaving production toast CSS untouched.
  // The Save center lies under noninteractive text, away from the dismissal button.
  return page.evaluate(() => {
    const toast = document.querySelectorAll<HTMLElement>(".ui-toast")[2];
    const save = document.querySelector<HTMLElement>(".st-edit-form button[type=submit]")!;
    const placement = document.querySelector<HTMLElement>('[data-testid="task-placement"]')!;
    const toastBox = toast.getBoundingClientRect();
    const saveBox = save.getBoundingClientRect();
    const x = toastBox.left + Math.min(200, toastBox.width - 80);
    const y = toastBox.top + toastBox.height / 2;
    placement.style.transform = `translate(${x - saveBox.left - saveBox.width / 2}px, ${y - saveBox.top - saveBox.height / 2}px)`;
    return { x, y };
  });
}

for (const kind of ["success", "error", "mixed"]) {
  test(`stacked ${kind} toast bodies allow a real pointer Save on SubtaskPanel`, async ({ page }, testInfo) => {
    await page.goto("/tests/ui/toast-fixture.html?kind=" + kind);
    await page.getByRole("button", { name: "Sửa", exact: true }).click();
    await expect(page.getByLabel("Sửa tên công việc con")).toBeFocused();
    await page.getByLabel("Sửa tên công việc con").fill("Tên được lưu qua thông báo");
    await page.getByRole("button", { name: "Hiển thị bốn thông báo", exact: true }).click();
    await expect(page.locator(".ui-toast")).toHaveCount(4);
    if (kind === "success") await expect(page.getByRole("status")).toHaveCount(4);
    if (kind === "error") await expect(page.getByRole("alert")).toHaveCount(4);
    if (kind === "mixed") {
      await expect(page.getByRole("status")).toHaveCount(2);
      await expect(page.getByRole("alert")).toHaveCount(2);
    }
    const point = await placeSaveUnderToast(page);
    await page.screenshot({ path: testInfo.outputPath(kind + "-toast-overlap.png") });
    const save = page.locator(".st-edit-form").getByRole("button", { name: "Lưu", exact: true });
    // No forced click, programmatic submission, dismissal or timeout-based workaround.
    await save.click({ timeout: 1500 });
    await expect(page.getByRole("checkbox", { name: "Tên được lưu qua thông báo", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.toastMutationCalls)).toEqual([{
      name: "subtasks:rename",
      args: { subtaskId: "subtask-fixture", title: "Tên được lưu qua thông báo" },
    }]);
    await expect(page.locator(".ui-toast")).toHaveCount(4);
    expect(await page.locator(".ui-toast").first().evaluate(element => getComputedStyle(element).pointerEvents)).toBe("none");
    await testInfo.attach("overlap-target", { body: JSON.stringify(point), contentType: "application/json" });
  });
}

test("stacked notifications retain readable copy and pointer/keyboard dismissal", async ({ page }) => {
  await page.goto("/tests/ui/toast-fixture.html?kind=mixed");
  await page.getByRole("button", { name: "Hiển thị bốn thông báo", exact: true }).click();
  await expect(page.locator(".ui-toast")).toHaveCount(4);
  expect(await page.locator(".ui-toast").evaluateAll(toasts => toasts.every(element => {
    const rect = element.getBoundingClientRect();
    const text = element.querySelector("span")!;
    const textBox = text.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight &&
      getComputedStyle(text).visibility === "visible" && textBox.width > 0 && textBox.height > 0 &&
      text.scrollWidth <= text.clientWidth + 1;
  }))).toBe(true);
  const close = page.getByRole("button", { name: "Đóng thông báo", exact: true });
  await close.first().click();
  await expect(close).toHaveCount(3);
  // Enter reaches a close control through normal Tab order.
  await page.getByLabel("Tên công việc con", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(close.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(close).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(1);
});

test("success expires after six seconds and errors persist until dismissed", async ({ page }) => {
  await page.clock.install();
  await page.goto("/tests/ui/toast-fixture.html?kind=mixed");
  await page.getByRole("button", { name: "Hiển thị bốn thông báo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(2);
  await page.clock.runFor(6001);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(2);
  await page.clock.runFor(60000);
  await expect(page.getByRole("alert")).toHaveCount(2);
  await page.getByRole("button", { name: "Đóng thông báo", exact: true }).first().click();
  await expect(page.getByRole("alert")).toHaveCount(1);
});
