import { expect, test } from "@playwright/test";

for (const kind of ["personal", "workspace", "kanban"]) {
  test.describe(kind, () => {
    test.beforeEach(async ({ page }) => {
      // The fixture uses the real shared modal and incumbent styles, without backend/auth providers.
      await page.goto(`/tests/ui/modal-fixture.html?kind=${kind}`);
      await page.getByRole("button", { name: "Mở hộp thoại", exact: true }).click();
    });

    test("focuses the first field and wraps Tab/Shift+Tab past hidden and disabled controls", async ({ page }, testInfo) => {
      const modal = page.getByRole("dialog", { name: "Công việc thử nghiệm" });
      await expect(page.getByLabel("Tiêu đề")).toBeFocused();
      await page.getByRole("button", { name: "Đóng", exact: true }).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Đóng", exact: true })).toBeFocused();
      for (const key of ["Tab", "Shift+Tab"]) {
        for (let index = 0; index < 9; index++) {
          await page.keyboard.press(key);
          await expect(modal).toContainText("Công việc thử nghiệm");
          expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`${kind}.png`) });
    });

    test("restores focus after Escape, close button, cancel and backdrop dismissal", async ({ page }) => {
      const opener = page.getByRole("button", { name: "Mở hộp thoại", exact: true });
      for (const action of ["escape", "close", "cancel", "backdrop"]) {
        if (action === "escape") await page.keyboard.press("Escape");
        if (action === "close") await page.getByRole("button", { name: "Đóng", exact: true }).click();
        if (action === "cancel") await page.getByRole("button", { name: "Hủy", exact: true }).click();
        if (action === "backdrop") await page.mouse.click(5, 5);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(opener, `Focus restored after ${action}`).toBeFocused();
        await expect(page.getByLabel("Đã lưu")).toHaveText("0");
        if (action !== "backdrop") await opener.click();
      }
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    });

    test("keeps the background inert and blocks background pointer actions", async ({ page }) => {
      const background = page.getByRole("button", { name: "Thao tác nền", exact: true });
      await background.evaluate(element => element.focus());
      await expect(background).not.toBeFocused();
      const box = await background.boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(page.getByLabel("Thao tác nền đã chạy")).toHaveText("0");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await background.click();
      await expect(page.getByLabel("Thao tác nền đã chạy")).toHaveText("1");
    });

    test("preserves validation and traps focus while saving, then restores it on success", async ({ page }) => {
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(page.getByLabel("Tiêu đề")).toBeFocused();
      await expect(page.getByLabel("Đã lưu")).toHaveText("0");
      await page.getByLabel("Tiêu đề").fill("Công việc mới");
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      const modal = page.getByRole("dialog");
      await expect(page.getByLabel("Tiêu đề")).toBeDisabled();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await expect(modal).toBeVisible();
      expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.evaluate(() => (window as Window & { completeModalSave: () => void }).completeModalSave());
      await expect(modal).toHaveCount(0);
      await expect(page.getByLabel("Đã lưu")).toHaveText("1");
      await expect(page.getByRole("button", { name: "Mở hộp thoại", exact: true })).toBeFocused();
    });

    test("preserves edit values after a failed save and allows dismissal afterward", async ({ page }) => {
      await page.goto(`/tests/ui/modal-fixture.html?kind=${kind}&edit&fail`);
      await page.getByRole("button", { name: "Mở hộp thoại", exact: true }).click();
      await expect(page.getByLabel("Tiêu đề")).toHaveValue("Công việc hiện tại");
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      await page.evaluate(() => (window as Window & { completeModalSave: () => void }).completeModalSave());
      await expect(page.getByRole("alert")).toContainText("Không thể lưu");
      await expect(page.getByLabel("Tiêu đề")).toHaveValue("Công việc hiện tại");
      await expect(page.getByLabel("Tiêu đề")).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Mở hộp thoại", exact: true })).toBeFocused();
    });

    test("uses a logical focus fallback if the original trigger disappears", async ({ page }) => {
      await page.goto(`/tests/ui/modal-fixture.html?kind=${kind}&removeOpener`);
      await page.getByRole("button", { name: "Mở hộp thoại", exact: true }).click();
      await page.getByLabel("Tiêu đề").fill("Công việc mới");
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      await page.evaluate(() => (window as Window & { completeModalSave: () => void }).completeModalSave());
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Thao tác nền", exact: true })).toBeFocused();
    });
  });
}
