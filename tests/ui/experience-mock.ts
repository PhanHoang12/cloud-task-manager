import { useEffect, useSyncExternalStore } from "react";
// Browser-only data for the actual shared App and existing screens.
const params = new URLSearchParams(location.search);
const mode = params.get("target");
let activeUserId = "user-fixture";
let authLoaded = params.get("auth") !== "loading";
let signedIn = params.get("auth") !== "signed-out";
let convexLoading = params.get("auth") === "convex-loading";
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
let account = { clerk: { name: member.fullName, email: member.email }, profile: { fullName: member.fullName } };
const empty: never[] = [];
let summaries = { project: { name: pb.name }, tasks: { total: 1, completed: 0, normal: 1, overdue: 0, upcoming: 0, withoutDeadline: 1 },
  alerts: { active: 0, sent: 0, overdue: 0, upcoming: 0 }, scope: { tasksIncomplete: false, notificationsIncomplete: false }, generatedAt: now };
let personalTasks = [
  { _id: "personal-one", title: "Báo cáo học kỳ", description: "", status: "todo", priority: "medium", createdAt: now },
  { _id: "personal-two", title: "Bài tập đã xong", description: "", status: "done", priority: "low", createdAt: now },
];
let subtasks = [{ _id: "subtask-one", taskId: task._id, title: "Đọc tài liệu", isCompleted: false }];
const loading = new Set<string>((params.get("loading") ?? "").split(",").filter(Boolean));
const failures = new Set<string>();
let completeSave = () => {};
declare global { interface Window { experienceRegression: {
  setLoading: (names: string[], active: boolean) => void;
  emptyData: (scope?: string) => void;
  activeQueries: Record<string, number>;
  signOutCalls: number;
  switchIdentity: () => void;
  failQuery: (name: string, active: boolean) => void;
  revokeWorkspace: () => void;
  removeProject: () => void;
  reorderWorkspaces: () => void;
  changeRole: () => void;
  profileUpdate: () => void;
  completeSave: () => void;
  setAuthState: (state: "loading" | "signed-out" | "convex-loading" | "signed-in") => void;
  signInReturnTo?: string;
}; } }
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
window.experienceRegression = {
  setAuthState: state => {
    authLoaded = state !== "loading"; signedIn = state !== "signed-out";
    convexLoading = state === "convex-loading"; notify();
  },
  setLoading: (names, active) => { for (const name of names) active ? loading.add(name) : loading.delete(name); notify(); },
  activeQueries: {}, signOutCalls: 0,
  switchIdentity: () => { activeUserId = "other-fixture"; workspaces = [wa]; personalTasks = []; notifications = []; account = { clerk: { name: "Tài khoản khác", email: "other@example.invalid" }, profile: { fullName: "Tài khoản khác" } }; notify(); },
  emptyData: scope => { if (scope === "projects") projectsB = []; else { personalTasks = []; tasksB = []; subtasks = []; notifications = []; summaries = { ...summaries, tasks: { total: 0, completed: 0, normal: 0, overdue: 0, upcoming: 0, withoutDeadline: 0 } }; } notify(); },
  failQuery: (name, active) => { active ? failures.add(name) : failures.delete(name); notify(); },
  revokeWorkspace: () => { workspaces = [wa]; notify(); },
  removeProject: () => { projectsB = []; notify(); },
  reorderWorkspaces: () => { workspaces = [wb, wa]; notify(); },
  changeRole: () => { wb.myRole = "viewer"; workspaces = [...workspaces]; notify(); },
  profileUpdate: () => { account = { ...account, profile: { fullName: "Tên cập nhật từ máy khác" } }; notify(); },
  completeSave: () => completeSave(),
};
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
      return args.workspaceId === "workspace-new" ? empty : args.workspaceId === wa._id ? [pa] : projectsB;
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
  const queryName = reference[Symbol.for("functionName")];
  const key = queryName + ":" + JSON.stringify(args);
  useEffect(() => {
    if (args === "skip") return;
    const counts = window.experienceRegression.activeQueries; counts[queryName] = (counts[queryName] ?? 0) + 1;
    return () => { counts[queryName]--; };
  }, [key]);
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  if (args === "skip") return undefined;
  const name = reference[Symbol.for("functionName")];
  if (failures.has(name)) throw new Error("PRIVATE_QUERY_DETAILS");
  if (loading.has(name)) return undefined;
  switch (name) {
    case "workspaces:list": return workspaces;
    case "projects:list":
      if (mode === "main-error" && args.workspaceId === wa._id) throw new Error("PRIVATE_CURRENT_VIEW");
      return args.workspaceId === "workspace-new" ? empty : args.workspaceId === wa._id ? [pa] : projectsB;
    case "projectTasks:list": return args.projectId === pb._id ? tasksB : empty;
    case "profiles:me": return account;
    case "members:list": return [member];
    case "notifications:mine": if (notificationQueryError) throw new Error("PRIVATE_QUERY_DETAILS"); return notifications;
    case "automationStats:projectOverview": return summaries;
    case "automationHistory:listRecent": return { authorized: false };
    case "tasks:list": return personalTasks;
    case "subtasks:list": return subtasks;
    case "projectTasks:activities": case "comments:list":
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
    if (name !== "notifications:markRead") {
      if (mode === "save-error") throw new Error("Không thể lưu thay đổi.");
      if (mode === "pending-save") await new Promise<void>(resolve => { completeSave = resolve; });
      if (name === "profiles:upsert") account = { ...account, profile: args as typeof account.profile };
      else if (name === "tasks:create") personalTasks = [...personalTasks, { _id: "personal-new", createdAt: now, status: "todo", ...args } as typeof personalTasks[number]];
      else if (name === "tasks:update") personalTasks = personalTasks.map(item => item._id === args.id ? { ...item, ...args } : item);
      else if (name === "tasks:remove") personalTasks = personalTasks.filter(item => item._id !== args.id);
      else if (name === "subtasks:rename") subtasks = subtasks.map(item => item._id === args.subtaskId ? { ...item, title: String(args.title) } : item);
      else if (name === "workspaces:create") { workspaces = [...workspaces, { ...wa, _id: "workspace-new", name: String(args.name) }]; notify(); return "workspace-new" as never; }
      else if (name === "projects:create") projectsB = [...projectsB, { ...pb, _id: "project-new", name: String(args.name) }];
      notify();
      return;
    }
    if (mode === "read-error") throw new Error("Không thể đánh dấu thông báo đã đọc.");
    notifications = notifications.map(item => item._id === args.notificationId ? { ...item, isRead: true } : item);
    notify();
  });
  return mutations.get(name)!;
}
export const useUser = () => ({ user: { id: activeUserId, fullName: member.fullName, firstName: "Sinh viên" } });
export const useAuth = () => {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  return { userId: signedIn ? activeUserId : null, isLoaded: authLoaded, isSignedIn: signedIn, getToken: async () => null };
};
export const useClerk = () => ({ openUserProfile: () => {}, signOut: async () => { window.experienceRegression.signOutCalls++; } });
export const SignInButton = ({ children, forceRedirectUrl }: { children: unknown; forceRedirectUrl?: string }) => {
  window.experienceRegression.signInReturnTo = forceRedirectUrl;
  return children;
};
export const SignUpButton = SignInButton, SignOutButton = SignInButton;
function useAuthSnapshot() {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
}
export const Authenticated = ({ children }: { children: unknown }) => {
  useAuthSnapshot(); return authLoaded && signedIn && !convexLoading ? children : null;
};
export const Unauthenticated = ({ children }: { children: unknown }) => {
  useAuthSnapshot(); return authLoaded && !signedIn && !convexLoading ? children : null;
};
export const AuthLoading = ({ children }: { children: unknown }) => {
  useAuthSnapshot(); return authLoaded && convexLoading ? children : null;
};
