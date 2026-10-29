import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["modal.spec.ts", "contrast.spec.ts", "search-focus.spec.ts", "error-boundary.spec.ts", "toast.spec.ts"],
  outputDir: "../../node_modules/.cache/modal-test-results",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4178",
    channel: process.env.MODAL_TEST_BROWSER ?? "msedge",
    headless: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile-viewport", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-viewport", testMatch: ["toast.spec.ts"], use: { viewport: { width: 820, height: 1180 } } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178/tests/ui/modal-fixture.html",
    reuseExistingServer: false,
  },
});
