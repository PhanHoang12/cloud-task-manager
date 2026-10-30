
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
const fixture = "/tests/ui/popup-fixture.html";
async function navigate(page: Page, name: string) {
  const button = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await button.click();
}
test.beforeEach(async ({ page }) => {
  for (const [module, exports] of [
    ["convex_react", "useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],
    ["@clerk_react", "useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"],
  ]) await page.route("**/node_modules/.vite/deps/" + module + ".js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {' + exports + '} from "/tests/ui/experience-mock.ts";',
  }));
});
test("M9 projects precede analytics in visual and keyboard order at each viewport", async ({ page }, testInfo) => {
  await page.goto(fixture);
  const card = page.locator(".ws-project-card").first(), disclosure = page.locator(".wo-analytics > summary");
  await expect(card).toBeVisible();
  await expect(page.locator(".wo-analytics")).not.toHaveAttribute("open", "");
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    return { card: rect(".ws-project-card").top, disclosure: rect(".wo-analytics").top, viewport: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      domOrder: Boolean(document.querySelector(".ws-projects")!.compareDocumentPosition(document.querySelector(".wo-analytics")!) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  expect(geometry.domOrder).toBe(true);
  expect(geometry.card).toBeLessThan(geometry.disclosure);
  expect(geometry.card).toBeLessThan(geometry.viewport);
  expect(geometry.overflow).toBe(false);
  const directory = "node_modules/.cache/workspace-layout";
  fs.mkdirSync(directory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: directory + "/after-" + testInfo.project.name + ".png", fullPage: true });
  console.log("M9 " + testInfo.project.name + " first card y=" + Math.round(geometry.card));
  const open = card.getByRole("button", { name: /^Mở dự án/ });
  await open.focus(); await page.keyboard.press("Tab");
  await expect(disclosure).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".wo-analytics")).toHaveAttribute("open", "");
  await expect(page.getByLabel("Khoảng thời gian biểu đồ")).toBeVisible();
  const reverseOrder = await page.evaluate(() => {
    const card = document.querySelector(".ws-project-card")!.getBoundingClientRect();
    const chart = document.querySelector(".wo-charts")!.getBoundingClientRect();
    return card.bottom <= chart.top && document.documentElement.scrollWidth <= innerWidth;
  });
  expect(reverseOrder).toBe(true);
  await page.screenshot({ path: directory + "/after-expanded-" + testInfo.project.name + ".png", fullPage: true });
  await disclosure.focus(); await page.keyboard.press("Space");
  await expect(page.getByLabel("Khoảng thời gian biểu đồ")).not.toBeVisible();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(open).toBeFocused();
});
test("M9 chart filters, clear actions and range survive disclosure and project navigation", async ({ page }) => {
  await page.goto(fixture);
  const disclosure = page.locator(".wo-analytics > summary");
  await disclosure.click();
  await page.locator(".wo-legend-row").nth(1).click();
  await expect(page.locator(".ws-project-card")).toHaveCount(0);
  await expect(page.locator(".ws-filter-summary")).toBeVisible();
  await disclosure.click();
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(page.locator(".ws-project-card")).toHaveCount(1);
  await disclosure.click();
  const segment = page.locator(".wo-donut-segment").first();
  await segment.focus(); await page.keyboard.press("Enter");
  await expect(segment).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".wo-metric.wo-blue")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await page.getByLabel("Khoảng thời gian biểu đồ").selectOption("3");
  await page.locator(".wo-bar-column").last().click();
  await expect(page.locator(".ws-filter-summary")).toBeVisible();
  await disclosure.click();
  await page.getByRole("button", { name: /^Mở dự án/ }).click();
  await expect(page.locator(".kb-page")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".ws-filter-summary")).toBeVisible();
  await expect(page.locator(".ws-project-card")).toHaveCount(1);
  await disclosure.click();
  await expect(page.getByLabel("Khoảng thời gian biểu đồ")).toHaveValue("3");
  await page.goForward(); await expect(page.locator(".kb-page")).toBeVisible();
  await page.locator(".kb-back").click();
  await expect(page.locator(".ws-filter-summary")).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(page.locator(".ws-filter-summary")).toHaveCount(0);
  await page.getByLabel("Tìm dự án").fill("hiện tại");
  await navigate(page, "Công việc cá nhân"); await navigate(page, "Không gian và dự án");
  await expect(page.getByLabel("Tìm dự án")).toHaveValue("hiện tại");
});
test("M9 project creation and status actions retain keyboard access", async ({ page }) => {
  await page.goto(fixture);
  const create = page.getByRole("button", { name: "Dự án mới", exact: true });
  await create.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("dialog.ui-modal input").first()).toBeFocused();
  await page.keyboard.press("Escape"); await expect(create).toBeFocused();
  const status = page.locator(".ws-project-card select");
  await status.selectOption("completed");
  await expect.poll(() => page.evaluate(() => window.notificationRegression.mutations.some(call => call.name === "projects:setStatus" && call.args.status === "completed"))).toBe(true);
  await expect(page.getByRole("button", { name: /^Mở dự án/ })).toBeEnabled();
});
