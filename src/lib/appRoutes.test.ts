import { describe, expect, it } from "vitest";
import { routeFromLocation, routePath } from "./appRoutes";

const parse = (url: string, state: unknown = null) => {
  const { pathname, search } = new URL(url, "https://example.invalid");
  return routeFromLocation({ pathname, search, state, key: "entry" });
};
describe("persistent application URLs", () => {
  it.each(["/personal", "/profile", "/workspaces", "/workspaces/team-1", "/workspaces/team-1/projects/project-1", "/workspaces/team-1/projects/project-1?task=task-1"])("round-trips %s without browser session state", url => {
    expect(routePath(parse(url))).toBe(url);
  });
  it.each(["/unknown", "/workspaces/a/projects/b/extra", "/workspaces/%2F/projects/b", "/workspaces/%20", "/workspaces/"+"a".repeat(129)])("rejects unsupported/malformed selectors: %s", url => {
    expect(parse(url).page).toBe("not-found");
  });
  it("takes project/task selectors from the URL rather than history payloads", () => {
    const route=parse("/workspaces/team-1/projects/project-1?task=task-1", { workspaceId: "other", projectId: "other", taskId: "other" });
    expect(route.workspaceId).toBe("team-1");
    expect(route.projectId).toBe("project-1");
    expect(route.notification?.taskId).toBe("task-1");
  });
  it("does not interpret a task query outside a project or malformed task IDs", () => {
    expect(parse("/personal?task=task-1").notification).toBeNull();
    expect(parse("/workspaces/team-1/projects/project-1?task=%2F").notification).toBeNull();
  });
  it("keeps form values and unrelated query parameters out of generated destinations", () => {
    expect(routePath(parse("/profile?fullName=private&draft=private"))).toBe("/profile");
  });
});
