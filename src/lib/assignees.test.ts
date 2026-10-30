import { describe, expect, it } from "vitest";
import { buildAssigneeLabels, getAssigneeLabel } from "./assignees";

describe("Kanban assignee presentation", () => {
  it("uses names and keeps original IDs as lookup keys", () => {
    const labels = buildAssigneeLabels([{ userId: "user_private_1", fullName: " Nguyễn  An " }]);
    expect(labels.get("user_private_1")).toBe("Nguyễn An");
    expect([...labels.keys()]).toEqual(["user_private_1"]);
  });

  it("does not expose an email when the member name is unambiguous", () => {
    expect(buildAssigneeLabels([{ userId: "a", fullName: "Nguyễn An", email: "an@example.invalid" }]).get("a")).toBe("Nguyễn An");
  });

  it("disambiguates matching names with existing public emails", () => {
    const labels = buildAssigneeLabels([
      { userId: "a", fullName: "Nguyễn An", email: "a@example.invalid" },
      { userId: "b", fullName: "nguyễn an", email: "b@example.invalid" },
    ]);
    expect(labels.get("a")).toBe("Nguyễn An · a@example.invalid");
    expect(labels.get("b")).toBe("nguyễn an · b@example.invalid");
  });

  it("normalizes Unicode before comparing duplicate Vietnamese names", () => {
    const labels = buildAssigneeLabels([
      { userId: "a", fullName: "Nguyễn An".normalize("NFD"), email: "a@example.invalid" },
      { userId: "b", fullName: "Nguyễn An", email: "b@example.invalid" },
    ]);
    expect(labels.get("a")).toBe("Nguyễn An · a@example.invalid");
  });

  it("distinguishes shared or missing emails with a roster position, never an ID suffix", () => {
    const labels = buildAssigneeLabels([
      { userId: "user_SECRET_A", fullName: "An", email: "shared@example.invalid" },
      { userId: "user_SECRET_B", fullName: "An", email: "shared@example.invalid" },
      { userId: "user_SECRET_C", fullName: "An" },
      { userId: "user_SECRET_D", fullName: "An" },
    ]);
    expect(new Set(labels.values()).size).toBe(4);
    expect(labels.get("user_SECRET_A")).toBe("An · shared@example.invalid · Thành viên 1");
    expect(labels.get("user_SECRET_D")).toBe("An · Thành viên 4");
    expect([...labels.values()].join(" ")).not.toContain("SECRET");
  });

  it("uses a clear missing-name label with email only when available", () => {
    const labels = buildAssigneeLabels([
      { userId: "a", fullName: " ", email: " member@example.invalid " },
      { userId: "b", fullName: null, email: null },
    ]);
    expect(labels.get("a")).toBe("Thành viên chưa có tên · member@example.invalid");
    expect(labels.get("b")).toBe("Thành viên chưa có tên");
  });

  it("distinguishes several unnamed members without inventing actual names", () => {
    const labels = buildAssigneeLabels([{ userId: "a" }, { userId: "b" }]);
    expect(labels.get("a")).toBe("Thành viên chưa có tên · Thành viên 1");
    expect(labels.get("b")).toBe("Thành viên chưa có tên · Thành viên 2");
  });

  it("prefers the workspace name for the current user and marks them as Bạn", () => {
    const labels = buildAssigneeLabels([{ userId: "me", fullName: "Tên trong nhóm", email: "me@example.invalid" }], { id: "me", fullName: "Tên Clerk" });
    expect(labels.get("me")).toBe("Tên trong nhóm (Bạn)");
  });

  it("falls back to the current Clerk name, then Bạn", () => {
    expect(buildAssigneeLabels([{ userId: "me" }], { id: "me", fullName: "Lê Minh" }).get("me")).toBe("Lê Minh (Bạn)");
    expect(buildAssigneeLabels([{ userId: "me" }], { id: "me" }).get("me")).toBe("Bạn");
  });

  it.each([undefined, null, ""])("handles an unassigned task (%s)", userId => {
    expect(getAssigneeLabel(userId, new Map(), false)).toBe("Chưa phân công");
  });

  it("distinguishes loading from a member absent in the returned directory", () => {
    expect(getAssigneeLabel("private_ID", new Map(), false)).toBe("Đang tải người phụ trách…");
    expect(getAssigneeLabel("private_ID", new Map(), true)).toBe("Thành viên không có trong danh sách");
  });

  it("uses the known current-user name even while the directory loads or omits them", () => {
    const viewer = { id: "me", fullName: "Lê Minh" };
    expect(getAssigneeLabel("me", new Map(), false, viewer)).toBe("Lê Minh (Bạn)");
    expect(getAssigneeLabel("me", new Map(), true, viewer)).toBe("Lê Minh (Bạn)");
  });

  it("does not read or display private profile fields", () => {
    const member = { userId: "private_ID", fullName: "Nguyễn An", phone: "PRIVATE_PHONE", studentId: "PRIVATE_STUDENT", bio: "PRIVATE_BIO" };
    expect(buildAssigneeLabels([member]).get(member.userId)).toBe("Nguyễn An");
  });

  it("refreshes labels from new snapshots without mutating member data", () => {
    const member = Object.freeze({ userId: "a", fullName: null });
    expect(buildAssigneeLabels([member]).get("a")).toBe("Thành viên chưa có tên");
    expect(buildAssigneeLabels([{ ...member, fullName: "Tên vừa cập nhật" }]).get("a")).toBe("Tên vừa cập nhật");
    expect(member.fullName).toBeNull();
  });
});
