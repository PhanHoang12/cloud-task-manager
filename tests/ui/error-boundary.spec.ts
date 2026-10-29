import { expect, test } from "@playwright/test";

const fixture = "/tests/ui/error-boundary-fixture.html";
test("H4 catches a thrown render error without exposing sensitive details", async ({ page }, testInfo) => {
  await page.goto(fixture);
  const fallback = page.getByRole("alert");
  await expect(fallback).toHaveAccessibleName("Không thể hiển thị nội dung");
  await expect(fallback.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await expect(fallback.getByRole("button", { name: "Về trang an toàn", exact: true })).toBeVisible();
  await expect(fallback.getByRole("button", { name: "Tải lại trang", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/SECRET_TOKEN|user_private_123|db\/private|PRIVATE_REQUEST/);
  await expect(page.getByText("Tài khoản hoạt động")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("generic-fallback.png") });
});

test("H4 retry remounts only the failed screen after its cause is resolved", async ({ page }) => {
  await page.goto(fixture + "?mode=query");
  await page.getByLabel("Ghi chú độc lập").fill("Giữ nguyên bản nháp");
  await page.evaluate(() => { window.boundaryPrimaryHealthy = true; });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã tải màn hình" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Ghi chú độc lập")).toHaveValue("Giữ nguyên bản nháp");
  await expect(page.getByText("Tài khoản hoạt động")).toBeVisible();
});

test("H4 persistent failures do not retry on parent updates or start remount loops", async ({ page }) => {
  await page.goto(fixture);
  await expect(page.getByRole("alert")).toBeVisible();
  const first = await page.evaluate(() => window.boundaryPrimaryRenders);
  await page.getByRole("button", { name: "Thao tác độc lập", exact: true }).click();
  await expect(page.getByLabel("Số thao tác")).toHaveText("1");
  expect(await page.evaluate(() => window.boundaryPrimaryRenders)).toBe(first);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const retried = await page.evaluate(() => window.boundaryPrimaryRenders);
  expect(retried).toBeGreaterThan(first);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.boundaryPrimaryRenders)).toBe(retried);
  await page.getByRole("button", { name: "Về trang an toàn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trang an toàn đã mở" })).toBeVisible();
});

test("H4 navigation clears the boundary and a resolved screen can be revisited", async ({ page }) => {
  await page.goto(fixture);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.evaluate(() => { window.boundaryPrimaryHealthy = true; });
  await page.getByRole("button", { name: "Trang an toàn", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Mở màn hình lỗi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã tải màn hình" })).toBeVisible();
});

test("H4 switching workspace context resets a failed boundary once", async ({ page }) => {
  await page.goto(fixture);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.evaluate(() => { window.boundaryPrimaryHealthy = true; });
  await page.getByRole("button", { name: "Đổi không gian", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã tải màn hình" })).toBeVisible();
});

test("H4 a secondary/account failure leaves main content and navigation usable", async ({ page }, testInfo) => {
  await page.goto(fixture + "?mode=secondary");
  await expect(page.getByRole("alert")).toContainText("Tài khoản");
  await expect(page.getByRole("heading", { name: "Đã tải màn hình" })).toBeVisible();
  await page.getByLabel("Ghi chú độc lập").fill("Nội dung vẫn dùng được");
  await page.getByRole("button", { name: "Thao tác độc lập", exact: true }).click();
  await expect(page.getByLabel("Số thao tác")).toHaveText("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("compact-fallback.png") });
  await page.evaluate(() => { window.boundarySecondaryHealthy = true; });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByText("Tài khoản hoạt động")).toBeVisible();
  await expect(page.getByLabel("Ghi chú độc lập")).toHaveValue("Nội dung vẫn dùng được");
});

test("H4 query/render failure while a dialog is open releases modal isolation", async ({ page }) => {
  await page.goto(fixture + "?mode=healthy");
  await page.getByRole("button", { name: "Mở hộp thoại", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => window.failBoundaryPrimary?.());
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  await page.getByRole("button", { name: "Trang an toàn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trang an toàn đã mở" })).toBeVisible();
});

test("H4 reload is an explicit user recovery action", async ({ page }) => {
  await page.goto(fixture);
  await page.getByLabel("Ghi chú độc lập").fill("Bản nháp thử nghiệm");
  const loaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Tải lại trang", exact: true }).click();
  await loaded;
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Ghi chú độc lập")).toHaveValue("");
});

for (const [mode, title] of [
  ["auth-code", "Không thể xác minh tài khoản"],
  ["auth-status", "Không thể xác minh tài khoản"],
  ["auth-data", "Không thể xác minh tài khoản"],
  ["auth-legacy", "Không thể xác minh tài khoản"],
  ["auth-claims", "Không thể xác minh tài khoản"],
  ["permission-code", "Không thể truy cập nội dung"],
  ["permission-status", "Không thể truy cập nội dung"],
  ["permission-data", "Không thể truy cập nội dung"],
  ["permission-legacy", "Không thể truy cập nội dung"],
  ["opaque", "Không thể hiển thị nội dung"],
  ["non-error", "Không thể hiển thị nội dung"],
]) {
  test(`H4 uses safe, distinct guidance for ${mode}`, async ({ page }, testInfo) => {
    await page.goto(fixture + "?mode=" + mode);
    await expect(page.getByRole("alert")).toHaveAccessibleName(title);
    await expect(page.locator("body")).not.toContainText(/SECRET_TOKEN|user_private_123|db\/private|PRIVATE_REQUEST|Uncaught Error|JWT/);
    if (mode === "opaque") await expect(page.getByRole("alert")).toContainText("quyền truy cập");
    if (mode === "auth-code" || mode === "permission-code") {
      await page.screenshot({ path: testInfo.outputPath(mode + "-fallback.png") });
    }
  });
}
