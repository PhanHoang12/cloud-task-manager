import type { Doc } from "../../convex/_generated/dataModel";

// Stored enum values and API contracts stay unchanged; only presentation is English.
export const roleLabels: Record<Doc<"workspaceMembers">["role"], string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
export const activityLabels: Record<Doc<"projectTaskActivities">["type"], string> = { created: "Task created", updated: "Task updated", moved: "Task moved", deleted: "Task deleted" };
const taskStatusLabels = { todo: "To do", in_progress: "In progress", review: "In review", done: "Done" };

export function formatActivityDetail(type: Doc<"projectTaskActivities">["type"], detail: string) {
  if (type !== "moved") return detail;
  const match = /^(todo|in_progress|review|done) → (todo|in_progress|review|done)(?:; (?:vị trí|position) (\d+))?$/.exec(detail);
  if (!match) return detail;
  return taskStatusLabels[match[1] as keyof typeof taskStatusLabels] + " → " + taskStatusLabels[match[2] as keyof typeof taskStatusLabels] + (match[3] ? `; position ${match[3]}` : "");
}

export function formatDueDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

export function formatNotificationMessage(message: string) {
  const comment = /^Có bình luận mới trong: ([\s\S]+)$/.exec(message);
  if (comment) return `New comment on: ${comment[1]}`;
  const deadline = /^Công việc "([\s\S]+)" (sắp hết hạn|đã quá hạn) \(([^)]+)\)\.$/.exec(message);
  if (deadline) return `Task "${deadline[1]}" ${deadline[2] === "sắp hết hạn" ? "is due soon" : "is overdue"} (${deadline[3]}).`;
  return message;
}

// Translate known legacy server errors without changing backend behavior.
const serverMessages: Record<string, string> = {
  "Bạn cần đăng nhập.": "Please sign in to continue.",
  "Không tìm thấy Project.": "Project not found.",
  "Bạn không có quyền xem thống kê Project.": "You cannot view this project's insights.",
  "Không tìm thấy công việc.": "Task not found.",
  "Không tìm thấy dự án.": "Project not found.",
  "Bạn không thuộc Workspace.": "You are not a member of this workspace.",
  "Viewer không có quyền bình luận.": "Viewers cannot add comments.",
  "Dự án không hoạt động.": "This project is not active.",
  "Bình luận cần từ 1–2000 ký tự.": "Comments must contain 1–2,000 characters.",
  "Bình luận không tồn tại.": "This comment no longer exists.",
  "Không thể xóa bình luận trong dự án đã ngừng hoạt động.": "Comments in inactive projects cannot be deleted.",
  "Viewer không có quyền xóa bình luận.": "Viewers cannot delete comments.",
  "Không có quyền xóa bình luận.": "You cannot delete this comment.",
  "Chỉ Owner mời được Admin.": "Only the owner can invite an admin.",
  "Email không hợp lệ.": "Enter a valid email address.",
  "Đã có lời mời còn hiệu lực cho email này.": "An active invitation already exists for this email.",
  "Workspace có quá nhiều lời mời đang chờ.": "This workspace has too many pending invitations.",
  "Lời mời không hợp lệ hoặc không thuộc tài khoản này.": "This invitation is invalid or belongs to another account.",
  "Lời mời đã hết hạn.": "This invitation has expired.",
  "Workspace không còn tồn tại.": "This workspace no longer exists.",
  "Bạn đã là thành viên Workspace.": "You are already a member of this workspace.",
  "Không thể từ chối lời mời này.": "This invitation cannot be declined.",
  "Lời mời không còn hiệu lực.": "This invitation is no longer active.",
  "Chỉ Owner được thu hồi lời mời Admin.": "Only the owner can revoke an admin invitation.",
  "Không được thay đổi quyền Owner.": "The owner's role cannot be changed.",
  "Admin không thể cấp hoặc sửa quyền Admin.": "Admins cannot assign or change admin roles.",
  "Không được loại Owner.": "The workspace owner cannot be removed.",
  "Admin không được loại Admin khác.": "Admins cannot remove another admin.",
  "Owner phải chuyển quyền sở hữu trước khi rời Workspace.": "Transfer ownership before leaving this workspace.",
  "Không có quyền truy cập thông báo.": "You cannot access this notification.",
  "Clerk phải cung cấp email đã xác minh trong JWT. Kiểm tra Convex integration / JWT claims.": "Your email could not be verified. Sign in again or contact your administrator.",
  "Workspace không tồn tại.": "Workspace not found.",
  "Bạn không phải thành viên Workspace.": "You are not a member of this workspace.",
  "Cần quyền Owner hoặc Admin.": "Owner or admin access is required.",
  "Chỉ Owner có quyền này.": "Only the workspace owner can do this.",
  "Họ tên phải từ 2 đến 80 ký tự.": "Your name must contain 2–80 characters.",
  "Tiểu sử tối đa 500 ký tự.": "Your bio must be 500 characters or fewer.",
  "Ảnh upload không tồn tại.": "The uploaded photo no longer exists.",
  "Không thể tạo URL avatar.": "Could not create a link to your photo.",
  "Bạn không thuộc Workspace này.": "You are not a member of this workspace.",
  "Viewer không có quyền tạo Project.": "Viewers cannot create projects.",
  "Tên Project phải dài từ 3 đến 100 ký tự.": "Project names must contain 3–100 characters.",
  "Mô tả tối đa 1000 ký tự.": "Descriptions must be 1,000 characters or fewer.",
  "Project không tồn tại.": "Project not found.",
  "Bạn không có quyền quản lý Project.": "You cannot manage this project.",
  "Bạn không có quyền truy cập dự án.": "You do not have access to this project.",
  "Tiêu đề cần từ 3 đến 120 ký tự.": "Task titles must contain 3–120 characters.",
  "Mô tả tối đa 2000 ký tự.": "Descriptions must be 2,000 characters or fewer.",
  "Ngày không hợp lệ.": "Choose a valid date.",
  "Người được giao phải là thành viên có quyền thực hiện.": "Choose a member who can work on this task.",
  "Dự án đã ngừng hoạt động.": "This project is no longer active.",
  "Viewer chỉ được xem.": "Viewers have read-only access.",
  "Bạn không có quyền sửa Task này.": "You cannot edit this task.",
  "Chỉ Owner/Admin có thể duyệt hoặc mở lại Task hoàn thành.": "Only owners and admins can approve or reopen completed tasks.",
  "Task không tồn tại.": "Task not found.",
  "Bạn không có quyền sửa Task.": "You cannot edit this task.",
  "Task này đã hoàn thành, chỉ có admin hoặc owner được sửa!": "Only owners and admins can edit completed tasks.",
  "Chỉ Owner/Admin được thay người phụ trách.": "Only owners and admins can change the assignee.",
  "Cột quá lớn, cần phân trang trước khi sắp xếp.": "This column is too large to reorder right now.",
  "Vị trí thả không hợp lệ.": "This drop position is not valid.",
  "Chỉ Owner/Admin có thể xóa Task.": "Only owners and admins can delete tasks.",
  "Dự án không tồn tại.": "Project not found.",
  "Không thuộc Workspace.": "You are not a member of this workspace.",
  "Không có quyền chỉnh sửa.": "You cannot edit this item.",
  "Chỉ người phụ trách hoặc người tạo Task được chỉnh sửa Subtask.": "Only the assignee or task creator can edit subtasks.",
  "Chỉ Owner/Admin được chỉnh sửa Task đã duyệt.": "Only owners and admins can edit approved tasks.",
  "Tên công việc con phải từ 2–160 ký tự.": "Subtask names must contain 2–160 characters.",
  "Giới hạn 200 Subtask cho mỗi Task.": "A task can have up to 200 subtasks.",
  "Subtask không tồn tại.": "Subtask not found.",
  "Không tìm thấy công việc hoặc không có quyền.": "This task is unavailable or you do not have access.",
  "Tiêu đề phải dài từ 1 đến 120 ký tự.": "Task titles must contain 1–120 characters.",
  "Ngày hạn không hợp lệ.": "Choose a valid due date.",
  "Tên Workspace phải dài từ 3 đến 80 ký tự.": "Workspace names must contain 3–80 characters.",
  "Mô tả tối đa 500 ký tự.": "Descriptions must be 500 characters or fewer.",
  "Bạn không có quyền sửa Workspace.": "You cannot edit this workspace.",
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = (/Uncaught Error: ([^\r\n]+)/.exec(error.message)?.[1] ?? error.message).trim();
  if (!message || /\[CONVEX|Request ID|Called by client|Server Error|Failed to fetch|NetworkError/i.test(message)) return fallback;
  if (serverMessages[message]) return serverMessages[message];
  if (/[\u00c0-\u1ef9]/u.test(message)) return fallback;
  return message;
}
