import { expect, test } from "./test";

test("welcome supports keyboard entry, clear auth actions and in-page navigation without overflow", async ({ page }) => {
  for (const [module, exports] of [
    ["convex_react", "useConvex,useQuery,useMutation,Authenticated,Unauthenticated,AuthLoading"],
    ["@clerk_react", "useUser,useAuth,useClerk,SignInButton,SignUpButton,SignOutButton"],
  ]) await page.route("**/node_modules/.vite/deps/" + module + ".js*", route => route.fulfill({
    contentType: "application/javascript", body: 'export {' + exports + '} from "/tests/ui/experience-mock.ts";',
  }));
  await page.goto("/tests/ui/popup-fixture.html?auth=signed-out");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".ctp-shell")).toHaveCount(0);
  for (const name of ["Create account", "Sign in"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toHaveCount(1);
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#welcome-main")).toBeFocused();
  await page.getByRole("link", { name: "Make room for better work" }).click();
  await expect(page).toHaveURL(/#welcome-start$/);
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
