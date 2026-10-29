import type { Doc } from "../../convex/_generated/dataModel";

// Keep API and stored values unchanged; translate labels at the presentation layer.
export const roleLabels: Record<Doc<"workspaceMembers">["role"], string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  member: "Thành viên",
  viewer: "Người xem",
};

export const activityLabels: Record<Doc<"projectTaskActivities">["type"], string> = {
  created: "Tạo công việc",
  updated: "Cập nhật công việc",
  moved: "Di chuyển công việc",
  deleted: "Xóa công việc",
};

const taskStatusLabels: Record<Doc<"projectTasks">["status"], string> = {
  todo: "Cần làm",
  in_progress: "Đang thực hiện",
  review: "Chờ duyệt",
  done: "Hoàn thành",
};

export function formatActivityDetail(type: Doc<"projectTaskActivities">["type"], detail: string) {
  if (type !== "moved") return detail;
  // Translate only the structured move record, preserving user-entered titles.
  const match = /^(todo|in_progress|review|done) → (todo|in_progress|review|done)(; vị trí \d+)?$/.exec(detail);
  if (!match) return detail;
  return taskStatusLabels[match[1] as keyof typeof taskStatusLabels] + " → " +
    taskStatusLabels[match[2] as keyof typeof taskStatusLabels] + (match[3] ?? "");
}

export function formatDueDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : value;
}

// Older deployments can still return mixed-language validation messages.
export function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = /Uncaught Error: ([^\r\n]+)/.exec(error.message)?.[1] ?? error.message;
  if (!message.trim() || /\[CONVEX|Request ID|Called by client|Server Error|Failed to fetch|NetworkError/i.test(message)) return fallback;

  return message
    .replace("Clerk phải cung cấp email đã xác minh trong JWT. Kiểm tra Convex integration / JWT claims.",
      "Không thể xác minh địa chỉ thư điện tử. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.")
    .replace(/Owner\/Admin/g, "chủ sở hữu hoặc quản trị viên")
    .replace(/\bWorkspace\b/g, "không gian làm việc")
    .replace(/\bProject\b/g, "dự án")
    .replace(/\bSubtask\b/g, "công việc con")
    .replace(/\bTask\b/g, "công việc")
    .replace(/\bOwner\b/g, "chủ sở hữu")
    .replace(/\bAdmin\b/g, "quản trị viên")
    .replace(/\bViewer\b/g, "người xem")
    .replace(/\b[Ee]mail\b/g, "thư điện tử")
    .replace("Ảnh upload", "Ảnh tải lên")
    .replace("URL avatar", "địa chỉ ảnh đại diện")
    .replace(/^\p{Ll}/u, letter => letter.toLocaleUpperCase("vi-VN"));
}
