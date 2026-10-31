import { matchPath, type Location } from "react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { NotificationNavigation } from "./notificationNavigation";

export const appPaths = {
  personal: "/personal",
  workspaces: "/workspaces",
  workspace: "/workspaces/:workspaceId",
  project: "/workspaces/:workspaceId/projects/:projectId",
  profile: "/profile",
} as const;

export type AppRoute = {
  page: "workspace" | "personal" | "profile" | "not-found";
  workspaceId: Id<"workspaces"> | null;
  projectId: Id<"projects"> | null;
  notification: NotificationNavigation | null;
};

const validIdentifier = (value: string | undefined): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** URL identifiers are untrusted selectors, never proof of access. */
export function routeFromLocation(location: Pick<Location, "pathname" | "search" | "key" | "state">): AppRoute {
  const empty = { workspaceId: null, projectId: null, notification: null };
  if (matchPath(appPaths.personal, location.pathname)) return { page: "personal", ...empty };
  if (matchPath(appPaths.profile, location.pathname)) return { page: "profile", ...empty };
  if (location.pathname === "/" || matchPath(appPaths.workspaces, location.pathname)) return { page: "workspace", ...empty };
  const project = matchPath(appPaths.project, location.pathname);
  const workspace = project ?? matchPath(appPaths.workspace, location.pathname);
  if (!workspace || !validIdentifier(workspace.params.workspaceId) ||
    (project && !validIdentifier(project.params.projectId))) return { page: "not-found", ...empty };
  const workspaceId = workspace.params.workspaceId as Id<"workspaces">;
  const projectId = project ? project.params.projectId as Id<"projects"> : null;
  const task = new URLSearchParams(location.search).get("task");
  const focusProject = location.state?.focusProject === true;
  return {
    page: "workspace", workspaceId, projectId,
    notification: projectId && (validIdentifier(task ?? undefined) || focusProject) ? {
      workspaceId, projectId, requestId: location.key,
      ...(validIdentifier(task ?? undefined) ? { taskId: task as Id<"projectTasks"> } : {}),
    } : null,
  };
}

export function routePath(route: AppRoute): string {
  if (route.page === "personal") return appPaths.personal;
  if (route.page === "profile") return appPaths.profile;
  if (route.page !== "workspace" || !route.workspaceId) return appPaths.workspaces;
  const base = `${appPaths.workspaces}/${encodeURIComponent(route.workspaceId)}`;
  if (!route.projectId) return base;
  const project = `${base}/projects/${encodeURIComponent(route.projectId)}`;
  return route.notification?.taskId ? `${project}?task=${encodeURIComponent(route.notification.taskId)}` : project;
}
