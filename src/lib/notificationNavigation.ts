import type { Id } from "../../convex/_generated/dataModel";

export type NotificationTarget = { projectId: Id<"projects">; taskId?: Id<"projectTasks"> };
export type NotificationNavigation = NotificationTarget & { workspaceId: Id<"workspaces">; requestId: number };

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}
export function getNotificationTarget(data: { projectId?: unknown; taskId?: unknown }): NotificationTarget | null {
  if (!identifier(data.projectId)) return null;
  return {
    projectId: data.projectId as Id<"projects">,
    ...(identifier(data.taskId) ? { taskId: data.taskId as Id<"projectTasks"> } : {}),
  };
}

type Lookup = {
  workspaces: () => Promise<readonly { _id: Id<"workspaces"> }[]>;
  projects: (workspaceId: Id<"workspaces">) => Promise<readonly { _id: Id<"projects">; workspaceId: Id<"workspaces"> }[]>;
  tasks: (projectId: Id<"projects">) => Promise<readonly { _id: Id<"projectTasks">; projectId: Id<"projects"> }[]>;
};

function checkActive(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Notification navigation cancelled");
}
/** Resolve through existing authorized directories, never through message text or guessed routes. */
export async function resolveNotificationTarget(target: NotificationTarget, lookup: Lookup, signal: AbortSignal) {
  checkActive(signal);
  const workspaces = await lookup.workspaces();
  checkActive(signal);
  for (const workspace of workspaces) {
    const projects = await lookup.projects(workspace._id);
    checkActive(signal);
    const project = projects.find(item => item._id === target.projectId && item.workspaceId === workspace._id);
    if (!project) continue;
    if (target.taskId) {
      const tasks = await lookup.tasks(project._id);
      checkActive(signal);
      if (!tasks.some(item => item._id === target.taskId && item.projectId === project._id)) {
        throw new Error("Notification target unavailable");
      }
    }
    return { workspaceId: workspace._id, projectId: project._id, ...(target.taskId ? { taskId: target.taskId } : {}) };
  }
  throw new Error("Notification target unavailable");
}

export function notificationNavigationError(error: unknown): string {
  const record = error !== null && typeof error === "object" ? error as Record<string, unknown> : {};
  const data = record.data !== null && typeof record.data === "object" ? record.data as Record<string, unknown> : {};
  const code = String(data.code ?? record.code ?? "").toUpperCase();
  const status = data.status ?? record.status ?? record.statusCode;
  const message = [record.message, record.data, typeof error === "string" ? error : ""].filter(value => typeof value === "string").join(" ");
  if (["UNAUTHENTICATED", "UNAUTHORIZED", "AUTH_REQUIRED", "SESSION_EXPIRED"].includes(code) || status === 401 ||
    /cần đăng nhập|chưa đăng nhập|unauthenticated|not authenticated|authentication required/i.test(message)) {
    return "Không thể xác minh phiên đăng nhập. Hãy kiểm tra tài khoản hoặc tải lại trang.";
  }
  return "Không thể mở nội dung liên quan. Nội dung có thể không còn khả dụng hoặc quyền truy cập đã thay đổi. Hãy thử lại hoặc chọn thông báo khác.";
}
