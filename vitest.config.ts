import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "src/lib/assignees.test.ts", "src/lib/notificationNavigation.test.ts", "src/lib/commentAuthors.test.ts", "src/lib/appRoutes.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
