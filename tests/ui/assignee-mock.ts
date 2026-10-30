// Browser-only hooks for the real KanbanBoard and its existing children.
import { useSyncExternalStore } from "react";

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const currentId = "user_current_PRIVATE";
export const useUser = () => ({ user: { id: currentId, fullName: "Lê Minh", firstName: "Minh" } });
const now = Date.now();
const seedMembers = [
  { _id: "m0", userId: currentId, role: "owner", fullName: "Lê Minh", email: "me@example.invalid" },
  { _id: "m1", userId: "user_an_a_PRIVATE", role: "member", fullName: "Nguyễn An", email: "an.a@example.invalid" },
  { _id: "m2", userId: "user_an_b_PRIVATE", role: "admin", fullName: "Nguyễn An", email: "an.b@example.invalid" },
  { _id: "m3", userId: "user_missing_PRIVATE", role: "member", fullName: null, email: "new@example.invalid" },
  { _id: "m4", userId: "user_blank_a_PRIVATE", role: "member", fullName: null, email: null },
  { _id: "m5", userId: "user_blank_b_PRIVATE", role: "member", fullName: " ", email: null },
  { _id: "m6", userId: "user_long_PRIVATE", role: "member", fullName: "Nguyễn Thị Minh Anh với tên hiển thị dài để kiểm tra xuống dòng và khả năng đọc trên màn hình nhỏ", email: "long@example.invalid" },
  { _id: "m7", userId: "user_viewer_PRIVATE", role: "viewer", fullName: "Người xem dự án", email: "viewer@example.invalid" },
];
let members: typeof seedMembers | undefined = mode === "loading" ? undefined : mode === "empty" ? [] : seedMembers;
const firstAssignee = mode === "removed" ? "user_removed_PRIVATE" : mode === "viewer-assignee" ? "user_viewer_PRIVATE" : "user_an_a_PRIVATE";
let tasks = [
  { _id: "task-an", title: "Công việc của An", assigneeId: firstAssignee },
  { _id: "task-self", title: "Công việc của tôi", assigneeId: currentId },
  { _id: "task-long", title: "Công việc tên dài", assigneeId: "user_long_PRIVATE" },
  { _id: "task-none", title: "Công việc chưa phân công", assigneeId: undefined },
].map((task, index) => ({ ...task, projectId: "project-fixture", description: "Mô tả công việc",
  priority: "medium", status: "todo", position: index, createdBy: currentId, createdAt: now }));
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision++; listeners.forEach(listener => listener()); };
declare global {
  interface Window {
    assigneeRegression: {
      calls: { name: string; args: Record<string, unknown> }[];
      queries: string[];
      resolveMembers: () => void;
      renameMember: (userId: string, name: string) => void;
      removeMember: (userId: string) => void;
    };
  }
}
window.assigneeRegression = {
  calls: [], queries: [],
  resolveMembers: () => { members = seedMembers; notify(); },
  renameMember: (userId, fullName) => { members = members?.map(member => member.userId === userId ? { ...member, fullName } : member); notify(); },
  removeMember: userId => { members = members?.filter(member => member.userId !== userId); notify(); },
};
type Reference = { [key: symbol]: string };
const summary = { project: { name: "Dự án kiểm tra" }, tasks: { total: 4, completed: 0, normal: 4, overdue: 0, upcoming: 0, withoutDeadline: 4 },
  alerts: { active: 0, sent: 0, overdue: 0, upcoming: 0 }, scope: { tasksIncomplete: false, notificationsIncomplete: false }, generatedAt: now };
const empty: never[] = [];
export function useQuery(reference: Reference) {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  const name = reference[Symbol.for("functionName")];
  window.assigneeRegression.queries.push(name);
  switch (name) {
    case "projectTasks:list": return tasks;
    case "members:list": return members;
    case "profiles:me": return { clerk: { id: currentId }, profile: { fullName: "Lê Minh" } };
    case "projectTasks:activities": case "subtasks:list": case "comments:list": case "notifications:mine": return empty;
    case "automationStats:projectOverview": return summary;
    case "automationHistory:listRecent": return { authorized: false };
    default: throw new Error("Unexpected assignee fixture query: " + name);
  }
}
let sequence = 0;
const mutations = new Map<string, (args: Record<string, unknown>) => Promise<void>>();
export function useMutation(reference: Reference) {
  const name = reference[Symbol.for("functionName")];
  if (!mutations.has(name)) mutations.set(name, async args => {
    window.assigneeRegression.calls.push({ name, args });
    if (name === "projectTasks:create") {
      tasks = [...tasks, { _id: "created-" + (++sequence), projectId: String(args.projectId), title: String(args.title),
        description: String(args.description), priority: String(args.priority), status: "todo", position: 10,
        assigneeId: args.assigneeId as string | undefined, createdBy: currentId, createdAt: Date.now() }];
    } else if (name === "projectTasks:update") {
      tasks = tasks.map(task => task._id === args.taskId ? { ...task, ...args } as typeof task : task);
    } else throw new Error("Unexpected assignee fixture mutation: " + name);
    notify();
  });
  return mutations.get(name)!;
}
