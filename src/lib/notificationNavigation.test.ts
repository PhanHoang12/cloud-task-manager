import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { getNotificationTarget, notificationNavigationError, resolveNotificationTarget } from "./notificationNavigation";

const wa = "workspace-a" as Id<"workspaces">, wb = "workspace-b" as Id<"workspaces">;
const projectId = "project-b" as Id<"projects">, taskId = "task-b" as Id<"projectTasks">;
function setup() {
  const calls: string[] = [];
  const lookup = {
    workspaces: async () => { calls.push("workspaces"); return [{ _id: wa }, { _id: wb }]; },
    projects: async (workspaceId: Id<"workspaces">) => { calls.push("projects:" + workspaceId); return workspaceId === wb ? [{ _id: projectId, workspaceId: wb }] : []; },
    tasks: async (id: Id<"projects">) => { calls.push("tasks:" + id); return [{ _id: taskId, projectId }]; },
  };
  return { lookup, calls, controller: new AbortController() };
}

describe("Notification destination data", () => {
  it.each(["comment", "assigned", "deadline_upcoming", "deadline_overdue"])("supports %s with explicit project/task identifiers", kind => {
    const data = { kind, projectId, taskId };
    expect(getNotificationTarget(data)).toEqual({ projectId, taskId });
  });
  it("supports a known project without inventing a task destination", () => {
    expect(getNotificationTarget({ projectId })).toEqual({ projectId });
  });
  it.each([{}, { taskId }, { projectId: "" }, { projectId: " " }, { projectId: 4 }])("does not invent a destination without a project ID (%o)", data => {
    expect(getNotificationTarget(data)).toBeNull();
  });
  it("does not parse destinations out of messages", () => {
    const data = { message: "Mở dự án project-b và task-b" };
    expect(getNotificationTarget(data as { projectId?: unknown })).toBeNull();
  });
});

describe("Authorized notification navigation", () => {
  it("searches authorized workspace/project lists and validates the task in its project", async () => {
    const { lookup, calls, controller } = setup();
    await expect(resolveNotificationTarget({ projectId, taskId }, lookup, controller.signal)).resolves.toEqual({ workspaceId: wb, projectId, taskId });
    expect(calls).toEqual(["workspaces", "projects:" + wa, "projects:" + wb, "tasks:" + projectId]);
  });
  it("does not query tasks when only a project is identified", async () => {
    const { lookup, calls, controller } = setup();
    await expect(resolveNotificationTarget({ projectId }, lookup, controller.signal)).resolves.toEqual({ workspaceId: wb, projectId });
    expect(calls.some(call => call.startsWith("tasks:"))).toBe(false);
  });
  it("does not request project/task data outside the authorized workspace list", async () => {
    const { lookup, calls, controller } = setup();
    lookup.workspaces = async () => [{ _id: wa }];
    await expect(resolveNotificationTarget({ projectId, taskId }, lookup, controller.signal)).rejects.toThrow("unavailable");
    expect(calls).toEqual(["projects:" + wa]);
  });
  it("rejects a missing task instead of substituting a different task", async () => {
    const { lookup, controller } = setup();
    lookup.tasks = async () => [];
    await expect(resolveNotificationTarget({ projectId, taskId }, lookup, controller.signal)).rejects.toThrow("unavailable");
  });
  it("checks returned task/project consistency", async () => {
    const { lookup, controller } = setup();
    lookup.tasks = async () => [{ _id: taskId, projectId: "other" as Id<"projects"> }];
    await expect(resolveNotificationTarget({ projectId, taskId }, lookup, controller.signal)).rejects.toThrow("unavailable");
  });
  it("propagates permission/authentication failures without trying unauthorized alternatives", async () => {
    const { lookup, calls, controller } = setup();
    lookup.projects = async () => { throw new Error("Bạn cần đăng nhập."); };
    await expect(resolveNotificationTarget({ projectId }, lookup, controller.signal)).rejects.toThrow("đăng nhập");
    expect(calls).toEqual(["workspaces"]);
  });
  it("cancels before starting any request", async () => {
    const { lookup, calls, controller } = setup();
    controller.abort();
    await expect(resolveNotificationTarget({ projectId }, lookup, controller.signal)).rejects.toThrow("cancelled");
    expect(calls).toEqual([]);
  });
  it("cancels between requests instead of applying a late result", async () => {
    const { lookup, calls, controller } = setup();
    lookup.workspaces = async () => { controller.abort(); return [{ _id: wa }]; };
    await expect(resolveNotificationTarget({ projectId }, lookup, controller.signal)).rejects.toThrow("cancelled");
    expect(calls).toEqual([]);
  });
});

describe("Notification destination feedback", () => {
  it("gives distinct fixed authentication guidance", () => {
    expect(notificationNavigationError(new Error("Bạn cần đăng nhập. PRIVATE"))).toContain("phiên đăng nhập");
    expect(notificationNavigationError({ data: { code: "UNAUTHENTICATED" } })).toContain("phiên đăng nhập");
  });
  it("does not expose raw permission errors, IDs, paths, or stack details", () => {
    const message = notificationNavigationError(new Error("forbidden PRIVATE_USER backend/private.ts"));
    expect(message).toContain("quyền truy cập");
    expect(message).not.toMatch(/PRIVATE|private.ts|forbidden/);
  });
});
