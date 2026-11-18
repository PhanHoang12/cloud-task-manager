export type ProjectSort = "newest" | "oldest" | "name";
export type TaskSort = "position" | "due" | "priority" | "newest";
export type DeadlineFilter = "all" | "overdue" | "today" | "week" | "none";
export function searchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase().trim();
}
export function localDayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
type ProjectRow = { name: string; description: string; status: string; _creationTime: number };
export function projectResults<T extends ProjectRow>(rows: readonly T[], search: string, status: string, sort: ProjectSort) {
  const query = searchText(search);
  return rows.filter(row => (!query || searchText(`${row.name} ${row.description}`).includes(query)) &&
    (status === "all" || row.status === status)).sort((a,b) => sort === "name"
      ? a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true })
      : sort === "oldest" ? a._creationTime-b._creationTime : b._creationTime-a._creationTime);
}
type TaskRow = { title: string; description: string; status: string; priority: string; assigneeId?: string; dueDate?: string; position: number; createdAt: number };
export type TaskFilters = { search: string; status: string; priority: string; assignee: string; deadline: DeadlineFilter; sort: TaskSort };
const priorityOrder: Record<string,number> = { urgent:4, high:3, medium:2, low:1 };
export function taskResults<T extends TaskRow>(rows: readonly T[], filters: TaskFilters, userId?: string, today = localDayKey()) {
  const query = searchText(filters.search);
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 6*86400000).toISOString().slice(0,10);
  return rows.filter(row => {
    if (query && !searchText(`${row.title} ${row.description}`).includes(query)) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.assignee === "me" && (!userId || row.assigneeId !== userId)) return false;
    if (filters.assignee === "unassigned" && row.assigneeId) return false;
    if (!["all","me","unassigned"].includes(filters.assignee) && row.assigneeId !== filters.assignee) return false;
    if (filters.deadline === "none") return !row.dueDate;
    if (filters.deadline === "all") return true;
    if (!row.dueDate || row.status === "done") return false;
    return filters.deadline === "overdue" ? row.dueDate < today
      : filters.deadline === "today" ? row.dueDate === today
      : row.dueDate >= today && row.dueDate <= weekEnd;
  }).sort((a,b) => {
    const delta = filters.sort === "due" ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
      : filters.sort === "priority" ? (priorityOrder[b.priority] ?? 0)-(priorityOrder[a.priority] ?? 0)
      : filters.sort === "newest" ? b.createdAt-a.createdAt : 0;
    return delta || a.position-b.position;
  });
}
