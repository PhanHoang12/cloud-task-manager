import { useEffect, useSyncExternalStore } from "react";
// Browser-only services for the real KanbanBoard and TaskComments.
const params = new URLSearchParams(location.search);
const mode = params.get("identity");
const authorId = "user_author_PRIVATE_Masn", otherId = "user_other_PRIVATE", thirdId = "user_third_PRIVATE";
const viewerId = params.get("viewer") === "self" ? authorId : params.get("viewer") === "third" ? thirdId : otherId;
const now = Date.UTC(2026, 9, 30, 0, 0, 0);
type Profile = { fullName: string; accountName?: string };
const profiles = new Map<string, Profile>([
  [authorId, mode === "account" ? { fullName: "Người dùng", accountName: "Hoàng tài khoản" } :
    mode === "blank" ? { fullName: "Người dùng" } : { fullName: "Nguyễn Hoàng", accountName: "Hoàng Clerk cũ" }],
  [otherId, { fullName: "Trần An", accountName: "An Clerk" }], [thirdId, { fullName: "Lê Bình" }],
]);
if (mode === "missing") profiles.delete(authorId);
let roster = mode === "removed" ? [otherId, thirdId] : [authorId, otherId, thirdId];
let loading = mode === "loading";
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision++; listeners.forEach(listener => listener()); };
const identityName = (id: string) => id === authorId ? "Hoàng" : id === otherId ? "An Clerk" : "Bình Clerk";
const persisted = { _id: "comment-persisted", taskId: "task-comment", projectId: "project-fixture", authorId, content: "Hiển thị tên thành viên", createdAt: now };
const comments = [persisted], empty: never[] = [];
const tasks = ["task-comment", "task-unrelated"].map((id, index) => ({
  _id: id, projectId: "project-fixture", title: index === 0 ? "Kiểm tra tên bình luận" : "Công việc thứ hai",
  description: "", status: "todo", priority: "medium", position: index, createdBy: viewerId, createdAt: now,
}));
const summary = { project: { name: "Dự án kiểm tra" }, tasks: { total: 2, completed: 0, normal: 2, overdue: 0, upcoming: 0, withoutDeadline: 2 },
  alerts: { active: 0, sent: 0, overdue: 0, upcoming: 0 }, scope: { tasksIncomplete: false, notificationsIncomplete: false }, generatedAt: now };

declare global { interface Window { commentRegression: {
  renameAuthor: (name: string) => void; removeAuthor: () => void; removeProfile: () => void;
  resolveDirectory: () => void; originalComment: () => typeof persisted;
  calls: { name: string; args: Record<string, unknown> }[];
  queries: { name: string; args: Record<string, unknown> }[];
  activeQueries: Record<string, number>;
}; } }
window.commentRegression = {
  renameAuthor: fullName => { profiles.set(authorId, { ...profiles.get(authorId), fullName }); notify(); },
  removeAuthor: () => { roster = roster.filter(id => id !== authorId); notify(); },
  removeProfile: () => { profiles.delete(authorId); notify(); },
  resolveDirectory: () => { loading = false; notify(); },
  originalComment: () => ({ ...persisted }), calls: [], queries: [], activeQueries: {},
};
type Reference = { [key: symbol]: string };
export function useQuery(reference: Reference, args: Record<string, unknown> = {}) {
  const name = reference[Symbol.for("functionName")], key = name + JSON.stringify(args);
  useEffect(() => {
    const counts = window.commentRegression.activeQueries;
    counts[name] = (counts[name] ?? 0) + 1;
    return () => { counts[name]--; };
  }, [key]);
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  window.commentRegression.queries.push({ name, args });
  switch (name) {
    case "projectTasks:list": return tasks;
    case "comments:list": return args.taskId === "task-comment" ? comments : empty;
    case "members:list":
      return loading ? undefined : roster.map((userId, index) => {
        const profile = profiles.get(userId), custom = profile?.fullName.trim();
        return { _id: "member-" + index, userId, role: "member",
          fullName: (custom && custom !== "Người dùng" ? custom : null) || profile?.accountName || (userId === viewerId ? identityName(viewerId) : null),
          email: "PRIVATE_EMAIL@example.invalid" };
      });
    case "profiles:me": {
      if (loading) return undefined;
      const stored = profiles.get(viewerId);
      return { clerk: { id: viewerId, name: identityName(viewerId) },
        profile: stored ? { ...stored, phone: "PRIVATE_PHONE", bio: "PRIVATE_BIO", studentId: "PRIVATE_STUDENT" } : null };
    }
    case "automationStats:projectOverview": return summary;
    case "automationHistory:listRecent": return { authorized: false };
    case "projectTasks:activities": case "subtasks:list": return empty;
    default: throw new Error("Unexpected comments fixture query: " + name);
  }
}
const mutations = new Map<string, (args: Record<string, unknown>) => Promise<void>>();
export function useMutation(reference: Reference) {
  const name = reference[Symbol.for("functionName")];
  if (!mutations.has(name)) mutations.set(name, async args => { window.commentRegression.calls.push({ name, args }); });
  return mutations.get(name)!;
}
export const useUser = () => ({ user: { id: viewerId, firstName: viewerId === authorId ? "Hoàng" : "An", fullName: identityName(viewerId) } });
