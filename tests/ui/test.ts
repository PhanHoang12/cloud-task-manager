import { test as base } from "@playwright/test";

// Exercise the app's system-font fallback deterministically. External font timeouts
// must not consume each test's navigation budget. Visual review also runs separately
// with the normal application font requests enabled.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("https://fonts.gstatic.com/**", route => route.abort());
    await use(page);
  },
});
export { expect } from "@playwright/test";
export type { Page, Locator } from "@playwright/test";
