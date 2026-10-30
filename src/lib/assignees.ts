export type AssigneeMember = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
};
export type AssigneeViewer = { id?: string; fullName?: string | null };

export function normalizeMemberName(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").normalize("NFC") ?? "";
}
function comparison(value: string) {
  return value.toLocaleLowerCase("vi-VN");
}
function selfLabel(viewer: AssigneeViewer) {
  const name = normalizeMemberName(viewer.fullName);
  return name ? `${name} (Bạn)` : "Bạn";
}

/** Presentation only: IDs are map keys, never visible fallback text. */
export function buildAssigneeLabels(
  members: readonly AssigneeMember[],
  viewer: AssigneeViewer = {},
): ReadonlyMap<string, string> {
  const names = members.map(member => normalizeMemberName(member.fullName) ||
    (member.userId === viewer.id ? normalizeMemberName(viewer.fullName) : ""));
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = comparison(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const candidates = members.map((member, index) => {
    const name = names[index];
    if (member.userId === viewer.id) return name ? `${name} (Bạn)` : "Bạn";
    const primary = name || "Thành viên chưa có tên";
    const email = !name || counts.get(comparison(name))! > 1 ? normalizeMemberName(member.email) : "";
    return email ? `${primary} · ${email}` : primary;
  });
  const candidateCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = comparison(candidate);
    candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
  }
  return new Map(members.map((member, index) => {
    const candidate = candidates[index];
    // A roster position disambiguates unavailable/shared emails without exposing ID fragments.
    const label = candidateCounts.get(comparison(candidate))! > 1
      ? `${candidate} · Thành viên ${index + 1}`
      : candidate;
    return [member.userId, label];
  }));
}

export function getAssigneeLabel(
  userId: string | null | undefined,
  labels: ReadonlyMap<string, string>,
  membersLoaded: boolean,
  viewer: AssigneeViewer = {},
): string {
  if (!userId) return "Chưa phân công";
  const label = labels.get(userId);
  if (label) return label;
  if (userId === viewer.id) return selfLabel(viewer);
  return membersLoaded ? "Thành viên không có trong danh sách" : "Đang tải người phụ trách…";
}
