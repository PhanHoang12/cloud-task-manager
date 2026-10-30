// Browser-only service seam. App, AccountMenu and NotificationCenter are the actual components.
import { useSyncExternalStore } from "react";

const mode = new URLSearchParams(location.search).get("notifications");
const now = Date.now();
const member = { _id: "member", userId: "user-fixture", role: "owner", fullName: "Sinh viên kiểm tra", email: "student@example.invalid" };
const workspace = { _id: "workspace", name: "Nhóm kiểm tra", description: "", myRole: "owner" };
const project = { _id: "project", workspaceId: "workspace", name: "Dự án kiểm tra", description: "Kiểm tra điều hướng popup.", status: "active", _creationTime: now };
const seedNotifications = [
  { _id: "notice-one", message: "Công việc mới được giao", kind: "assigned", createdAt: now, isRead: false },
  { _id: "notice-two", message: "Bình luận mới trong công việc", kind: "comment", createdAt: now, isRead: false },
  { _id: "notice-three", message: "Thông báo đã đọc", kind: "comment", createdAt: now, isRead: true },
];
let notifications: typeof seedNotifications | undefined = mode === "loading" ? undefined : mode === "empty" ? [] : seedNotifications;
let account = { clerk: { name: "Sinh viên kiểm tra", email: "student@example.invalid" },
  profile: { fullName: "Sinh viên kiểm tra", bio: "", phone: "", studentId: "", department: "", className: "" } };
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision++; listeners.forEach(listener => listener()); };
declare global {
  interface Window {
    popupRegression: {
      calls: { name: string; args: Record<string, unknown> }[];
      securityCalls: number;
      signOutCalls: number;
      resolveNotifications: () => void;
      changeAccountName: (name: string) => void;
      failRead: boolean;
    };
  }
}
window.popupRegression = {
  calls: [], securityCalls: 0, signOutCalls: 0, failRead: mode === "error",
  resolveNotifications: () => { notifications = seedNotifications; notify(); },
  changeAccountName: fullName => { account = { ...account, profile: { ...account.profile, fullName } }; notify(); },
};
const clerk = {
  openUserProfile: () => {
    window.popupRegression.securityCalls++;
    const target = document.querySelector<HTMLButtonElement>('[data-testid="security-focus"]')!;
    target.hidden = false;
    target.focus();
  },
  signOut: async () => { window.popupRegression.signOutCalls++; },
};
export const useClerk = () => clerk;
export const useAuth = () => ({ isLoaded: true, isSignedIn: true, getToken: async () => null });
export const useUser = () => ({ user: { id: member.userId, fullName: member.fullName, firstName: "Sinh viên" } });
export const SignInButton = ({ children }: { children: unknown }) => children;
export const SignUpButton = SignInButton;
export const SignOutButton = SignInButton;
export const Authenticated = SignInButton;
export const Unauthenticated = () => null;
export const AuthLoading = () => null;

const empty: never[] = [];
const workspaces = [workspace], projects = [project], members = [member];
const summary = { project: { name: project.name }, tasks: { total: 0, completed: 0, normal: 0, overdue: 0, upcoming: 0, withoutDeadline: 0 },
  alerts: { active: 0, sent: 0, overdue: 0, upcoming: 0 }, scope: { tasksIncomplete: false, notificationsIncomplete: false }, generatedAt: now };
type Reference = { [key: symbol]: string };
export function useQuery(reference: Reference) {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  switch (reference[Symbol.for("functionName")]) {
    case "workspaces:list": return workspaces;
    case "projects:list": return projects;
    case "members:list": return members;
    case "profiles:me": return account;
    case "notifications:mine": return notifications;
    case "automationStats:projectOverview": return summary;
    case "automationHistory:listRecent": return { authorized: false };
    case "tasks:list": case "projectTasks:list": case "projectTasks:activities":
    case "invitations:mine": case "invitations:forWorkspace": return empty;
    default: throw new Error("Unexpected popup fixture query");
  }
}
const mutations = new Map<string, (args: Record<string, unknown>) => Promise<void>>();
export function useMutation(reference: Reference) {
  const name = reference[Symbol.for("functionName")];
  if (!mutations.has(name)) mutations.set(name, async args => {
    window.popupRegression.calls.push({ name, args });
    if (name === "profiles:syncIdentity") return;
    if (name !== "notifications:markRead") throw new Error("Unexpected popup fixture mutation");
    if (window.popupRegression.failRead) throw new Error("Không thể đánh dấu thông báo đã đọc.");
    notifications = notifications?.map(item => item._id === args.notificationId ? { ...item, isRead: true } : item);
    notify();
  });
  return mutations.get(name)!;
}

// Destination-less M2 fixtures never perform navigation lookups.
export const useConvex = () => ({ query: async () => { throw new Error("No popup fixture destination"); } });
