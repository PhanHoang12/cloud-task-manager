import { describe, expect, it } from "vitest";
import { formatActivityDetail, formatDueDate, formatNotificationMessage, getErrorMessage } from "./uiText";

describe("English presentation of existing data", () => {
  it("translates known server errors without changing backend responses", () => {
    expect(getErrorMessage(new Error("Bạn cần đăng nhập."), "Try again.")).toBe("Please sign in to continue.");
    expect(getErrorMessage(new Error("[CONVEX Q(tasks:list)]\nUncaught Error: Bạn cần đăng nhập.\nCalled by client"), "Try again.")).toBe("Please sign in to continue.");
    expect(getErrorMessage(new Error("[CONVEX Q(private:path)] Request ID: SECRET"), "Try again.")).toBe("Try again.");
  });
  it("preserves user text when presenting legacy notifications in English", () => {
    expect(formatNotificationMessage("Có bình luận mới trong: Báo cáo của An")).toBe("New comment on: Báo cáo của An");
    expect(formatNotificationMessage('Công việc "Báo cáo của An" đã quá hạn (2026-11-14).')).toBe('Task "Báo cáo của An" is overdue (2026-11-14).');
    expect(formatNotificationMessage("Ghi chú do người dùng viết")).toBe("Ghi chú do người dùng viết");
  });
  it("translates structured activity only and formats dates without timezone drift", () => {
    expect(formatActivityDetail("moved", "todo → done; vị trí 2")).toBe("To do → Done; position 2");
    expect(formatActivityDetail("created", "Báo cáo của An")).toBe("Báo cáo của An");
    expect(formatDueDate("2026-11-14")).toBe("Nov 14, 2026");
  });
});
