import { useSyncExternalStore } from "react";
// Browser-only data for the actual shared App and existing screens.
const params = new URLSearchParams(location.search);
const mode = params.get("target");
let notificationQueryError = mode === "query-error";
const now = Date.now(), userId = "user-fixture";
const wa = { _id: "workspace-a", name: "Nhóm một", description: "", myRole: "owner" };
const wb = { _id: "workspace-b", name: "Nhóm hai", description: "", myRole: params.has("viewer") ? "viewer" : "owner" };
const pa = { _id: "project-a", workspaceId: wa._id, name: "Dự án hiện tại", description: "", status: "active", _creationTime: now };
const pb = { _id: "project-b", workspaceId: wb._id, name: "Dự án liên quan", description: "Dự án được mở từ thông báo.", status: params.has("archived") ? "archived" : "active", _creationTime: now };
const task = { _id: "task-b", projectId: pb._id, title: "Công việc liên quan", description: "Nội dung công việc liên quan.",
  status: "review", priority: "medium", position: 1, createdBy: userId, assigneeId: userId, createdAt: now };
let workspaces = mode === "no-access" ? [wa] : [wa, wb];
let projectsB = mode === "project-deleted" ? [] : [pb];
let tasksB = mode === "task-deleted" ? [] : [task];
type Notice = { _id: string; kind: string; message: string; projectId?: string; taskId?: string; isRead: boolean; createdAt: number };
let notifications: Notice[] = [
  ...(["comment", "assigned", "deadline_upcoming", "deadline_overdue"] as const).map(kind => ({
    _id: "notice-" + kind, kind, message: ({comment:"Bình luận liên quan",assigned:"Công việc được giao",deadline_upcoming:"Công việc sắp đến hạn",deadline_overdue:"Công việc quá hạn"})[kind],
    projectId: pb._id, taskId: task._id, isRead: false, createdAt: now,
  })),
  { _id: "notice-project", kind: "comment", message: "Cập nhật chỉ có dự án", projectId: pb._id, isRead: false, createdAt: now },
  { _id: "notice-no-ids", kind: "comment", message: "Chỉ có nội dung thông báo", isRead: false, createdAt: now },
  { _id: "notice-task-only", kind: "assigned", message: "Thông báo chỉ có mã công việc", taskId: task._id, isRead: false, createdAt: now },
  { _id: "notice-project-gone", kind: "comment", message: "Liên kết dự án không còn khả dụng", projectId: "project-missing", taskId: "task-missing", isRead: false, createdAt: now },
  { _id: "notice-task-gone", kind: "comment", message: "Liên kết công việc không còn khả dụng", projectId: pb._id, taskId: "task-missing", isRead: false, createdAt: now },
  { _id: "notice-read", kind: "assigned", message: "Thông báo đã đọc có liên kết", projectId: pb._id, taskId: task._id, isRead: true, createdAt: now },
];
const member = { _id: "member", userId, role: "owner", fullName: "Sinh viên kiểm tra", email: "student@example.invalid" };
const account = { clerk: { name: member.fullName, email: member.email }, profile: { fullName: member.fullName } };
const empty: never[] = [];
const summaries = { project: { name: pb.name }, tasks: { total: 1, completed: 0, normal: 1, overdue: 0, upcoming: 0, withoutDeadline: 1 },
  alerts: { active: 0, sent: 0, overdue: 0, upcoming: 0 }, scope: { tasksIncomplete: false, notificationsIncomplete: false }, generatedAt: now };
let revision = 0, sequence = 0;
const listeners = new Set<() => void>();
const notify = () => { revision++; listeners.forEach(listener => listener()); };
declare global {
  interface Window {
    notificationRegression: {
      mutations: { name: string; args: Record<string, unknown> }[];
      lookups: { name: string; args: Record<string, unknown> }[];
      completeLookup: () => void;
      recoverQuery: () => void;
      addNotification: () => void;
    };
  }
}
window.notificationRegression = {
  mutations: [], lookups: [], completeLookup: () => {},
  recoverQuery: () => { notificationQueryError = false; notify(); },
  addNotification: () => { notifications = [{ _id: "new-" + (++sequence), kind: "comment", message: "Cập nhật mới " + sequence,
    projectId: pb._id, taskId: task._id, isRead: false, createdAt: Date.now() }, ...notifications]; notify(); },
};
type Reference = { [key: symbol]: string };
const client = {
  query: async (reference: Reference, args: Record<string, unknown>) => {
    const name = reference[Symbol.for("functionName")];
    window.notificationRegression.lookups.push({ name, args });
    if (name === "workspaces:list") return workspaces;
    if (name === "projects:list") {
      if (args.workspaceId === wb._id && mode === "denied") throw new Error("Không có quyền truy cập PRIVATE_WORKSPACE");
      if (args.workspaceId === wb._id && mode === "auth") throw new Error("Bạn cần đăng nhập. PRIVATE_JWT");
      if (args.workspaceId === wb._id && mode === "pending") await new Promise<void>(resolve => { window.notificationRegression.completeLookup = resolve; });
      return args.workspaceId === wa._id ? [pa] : projectsB;
    }
    if (name === "projectTasks:list") {
      const snapshot = tasksB;
      if (mode === "revoked-after-lookup") { workspaces = [wa]; notify(); }
      if (mode === "task-removed-after-lookup") { tasksB = []; notify(); }
      return snapshot;
    }
    throw new Error("Unexpected notification lookup");
  },
};
export const useConvex = () => client;
export function useQuery(reference: Reference, args: Record<string, unknown> | "skip" = {}) {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  if (args === "skip") return undefined;
  switch (reference[Symbol.for("functionName")]) {
    case "workspaces:list": return workspaces;
    case "projects:list":
      if (mode === "main-error" && args.workspaceId === wa._id) throw new Error("PRIVATE_CURRENT_VIEW");
      return args.workspaceId === wa._id ? [pa] : projectsB;
    case "projectTasks:list": return args.projectId === pb._id ? tasksB : empty;
    case "profiles:me": return account;
    case "members:list": return [member];
    case "notifications:mine": if (notificationQueryError) throw new Error("PRIVATE_QUERY_DETAILS"); return notifications;
    case "automationStats:projectOverview": return summaries;
    case "automationHistory:listRecent": return { authorized: false };
    case "tasks:list": case "projectTasks:activities": case "subtasks:list": case "comments:list":
    case "invitations:mine": case "invitations:forWorkspace": return empty;
    default: throw new Error("Unexpected notification fixture query");
  }
}
const mutations = new Map<string, (args: Record<string, unknown>) => Promise<void>>();
export function useMutation(reference: Reference) {
  const name = reference[Symbol.for("functionName")];
  if (!mutations.has(name)) mutations.set(name, async args => {
    window.notificationRegression.mutations.push({ name, args });
    if (name === "profiles:syncIdentity") return;
    if (name !== "notifications:markRead") throw new Error("Unexpected notification fixture mutation");
    if (mode === "read-error") throw new Error("Không thể đánh dấu thông báo đã đọc.");
    notifications = notifications.map(item => item._id === args.notificationId ? { ...item, isRead: true } : item);
    notify();
  });
  return mutations.get(name)!;
}
export const useUser = () => ({ user: { id: userId, fullName: member.fullName, firstName: "Sinh viên" } });
export const useAuth = () => ({ isLoaded: true, isSignedIn: true, getToken: async () => null });
export const useClerk = () => ({ openUserProfile: () => {}, signOut: async () => {} });
export const SignInButton = ({ children }: { children: unknown }) => children;
export const SignUpButton = SignInButton, SignOutButton = SignInButton, Authenticated = SignInButton;
export const Unauthenticated = () => null, AuthLoading = () => null;
