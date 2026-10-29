// Browser-only data seam: the fixture imports the real SubtaskPanel and FeedbackProvider.
import { useSyncExternalStore } from "react";

declare global {
  interface Window {
    toastMutationCalls: { name: string; args: Record<string, unknown> }[];
  }
}
let revision = 0;
let rows = [{ _id: "subtask-fixture", taskId: "task-fixture", title: "Tên ban đầu", isCompleted: false }];
const listeners = new Set<() => void>();
window.toastMutationCalls = [];
type Reference = { [key: symbol]: string };

export function useQuery(reference: Reference) {
  useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => revision);
  if (reference[Symbol.for("functionName")] !== "subtasks:list") throw new Error("Unexpected fixture query");
  return rows;
}
const mutations = new Map<string, (args: Record<string, unknown>) => Promise<void>>();
export function useMutation(reference: Reference) {
  const name = reference[Symbol.for("functionName")];
  if (!mutations.has(name)) mutations.set(name, async args => {
    window.toastMutationCalls.push({ name, args });
    if (name !== "subtasks:rename") throw new Error("Unexpected fixture mutation");
    rows = rows.map(row => row._id === args.subtaskId ? { ...row, title: String(args.title) } : row);
    revision++;
    listeners.forEach(listener => listener());
  });
  return mutations.get(name)!;
}
