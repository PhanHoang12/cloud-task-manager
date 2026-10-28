
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ===============================
// 1. Lấy thông báo của người dùng
// ===============================
export const mine = query({
  args: {},

  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) =>
        q.eq("recipientId", identity.subject)
      )
      .order("desc")
      .take(100);

    // Ẩn các thông báo đã bị vô hiệu hóa.
    // Dữ liệu cũ chưa có isActive vẫn được hiển thị.
    return notifications.filter(
      (notification) => notification.isActive !== false
    );
  },
});

// ===============================
// 2. Đánh dấu thông báo đã đọc
// ===============================
export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },

  handler: async (ctx, { notificationId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Bạn cần đăng nhập.");
    }

    const notification = await ctx.db.get(notificationId);

    if (
      !notification ||
      notification.recipientId !== identity.subject
    ) {
      throw new Error("Không có quyền truy cập thông báo.");
    }

    // Không thao tác với thông báo đã vô hiệu hóa.
    if (notification.isActive === false) {
      return;
    }

    if (!notification.isRead) {
      await ctx.db.patch(notificationId, {
        isRead: true,
      });
    }
  },
});
