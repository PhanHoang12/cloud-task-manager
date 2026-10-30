
import { expect, test, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
const fixture = "/tests/ui/popup-fixture.html";
const dir = "node_modules/.cache/design-foundation";
const scenes = { workspace: ".ws-project-card", kanban: ".kb-column", personal: ".task-section", profile: ".profile-card" } as const;
async function navigate(page: Page, name: string) {
  const nav = page.getByRole("navigation").getByRole("button", { name, exact: true });
  if (!await nav.isVisible()) await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await nav.click();
}
function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const values = color.match(/[0-9.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
async function colors(target: Locator) {
  return target.evaluate(element => {
    const style = getComputedStyle(element);
    return { text: style.color, background: style.backgroundColor, focus: style.outlineColor, outline: style.outlineWidth, radius: style.borderRadius };
  });
}
test.beforeEach(async ({ page }) => {
  for (const [module, exports] of [
    ["convex_react", "useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],
    ["@clerk_react", "useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"],
  ]) await page.route("**/node_modules/.vite/deps/" + module + ".js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {' + exports + '} from "/tests/ui/experience-mock.ts";',
  }));
});
test("M10 preserves page geometry and captures the existing four surfaces", async ({ page }, testInfo) => {
  await page.goto(fixture); await expect(page.locator(".ws-project-card")).toBeVisible();
  const size = testInfo.project.name === "desktop" ? "desktop" : "mobile";
  const geometry: Record<string, { x: number; y: number; width: number; height: number }> = {};
  fs.mkdirSync(dir, { recursive: true });
  for (const view of Object.keys(scenes) as (keyof typeof scenes)[]) {
    if (view === "kanban") { await page.locator("#workspace-select").selectOption("workspace-b"); await page.locator(".kb-open-project").click(); }
    if (view === "personal" || view === "profile") await navigate(page, view === "personal" ? "Công việc cá nhân" : "Hồ sơ cá nhân");
    const target = page.locator(scenes[view]).first();
    await expect(target).toBeVisible(); await page.evaluate(() => document.fonts.ready); await page.evaluate(() => scrollTo(0, 0));
    geometry[view] = await target.evaluate(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: dir + "/after-" + view + "-" + size + ".png", fullPage: true });
  }
  fs.writeFileSync(dir + "/after-" + size + ".json", JSON.stringify(geometry, null, 2));
  // Current-run capture comparison is optional on a fresh checkout; no cache prerequisite.
  if (fs.existsSync(dir + "/before-" + size + ".json")) {
    const before = JSON.parse(fs.readFileSync(dir + "/before-" + size + ".json", "utf8"));
    for (const view of Object.keys(scenes)) for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs(geometry[view][key] - before[view][key]), view + " " + key + " stays unchanged").toBeLessThanOrEqual(1);
  }
});
test("M10 shared controls retain contrast, visible focus, native forms and busy states", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixture + "?target=pending-save");
  const create = page.getByRole("button", { name: "Không gian mới", exact: true });
  await expect(create).toBeVisible();
  const box = await create.boundingBox();
  await page.keyboard.press("Tab"); await create.focus();
  let pair = await colors(create);
  expect(pair.outline).toBe("3px"); expect(contrast(pair.focus, "rgb(246, 248, 252)")).toBeGreaterThanOrEqual(3);
  expect(contrast(pair.text, pair.background)).toBeGreaterThanOrEqual(4.5);
  expect(await create.boundingBox()).toEqual(box);
  expect(await create.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
  await create.hover(); pair = await colors(create); expect(contrast(pair.text, pair.background)).toBeGreaterThanOrEqual(4.5);
  await page.mouse.down(); pair = await colors(create); expect(contrast(pair.text, pair.background)).toBeGreaterThanOrEqual(4.5);
  await page.mouse.up();
  const modal = page.locator("dialog.ui-modal"), field = modal.locator("input").first();
  await expect(field).toBeFocused(); pair = await colors(field);
  expect(pair.radius).toBe("9px"); expect(pair.outline).toBe("3px");
  expect(contrast(pair.text, pair.background)).toBeGreaterThanOrEqual(4.5);
  const placeholder = await field.evaluate(element => getComputedStyle(element, "::placeholder").color);
  expect(contrast(placeholder, pair.background)).toBeGreaterThanOrEqual(4.5);
  await field.evaluate(element => element.setAttribute("aria-invalid", "true"));
  await expect(field).toHaveCSS("border-top-color", "rgb(185, 28, 28)");
  await field.evaluate(element => element.removeAttribute("aria-invalid"));
  await field.fill("Không gian kiểm tra");
  await page.screenshot({ path: dir + "/field-focus-" + testInfo.project.name + ".png", fullPage: true });
  await modal.getByRole("button", { name: "Tạo mới", exact: true }).click();
  await expect(field).toBeDisabled(); await expect(field).toHaveCSS("background-color", "rgb(248, 250, 255)");
  await expect(modal.getByRole("button", { name: "Đang lưu...", exact: true })).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => window.experienceRegression.completeSave());
  await expect(modal).toHaveCount(0);
  const toastClose = page.locator(".ui-toast").getByRole("button", { name: "Đóng thông báo", exact: true });
  await toastClose.focus(); pair = await colors(toastClose);
  expect(pair.outline).toBe("3px"); expect(contrast(pair.focus, pair.background)).toBeGreaterThanOrEqual(3);
  const bell = page.getByRole("button", { name: /^Thông báo,/ });
  await bell.focus(); await page.keyboard.press("Enter");
  const close = page.getByRole("dialog", { name: "Thông báo", exact: true }).getByRole("button", { name: "Đóng thông báo", exact: true });
  await expect(close).toBeFocused(); await expect(close).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Escape"); await expect(bell).toBeFocused();
  await testInfo.attach("shared-control-contrast", { body: JSON.stringify(pair), contentType: "application/json" });
  await page.emulateMedia({ forcedColors: "active" });
  await create.press("Enter");
  await expect(field).toBeFocused();
  await expect(field).toHaveCSS("outline-width", "3px");
  await expect(field).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Escape");
});
