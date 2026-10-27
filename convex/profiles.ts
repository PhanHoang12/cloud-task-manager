import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";


async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  return identity;
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireUser(ctx);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    return {
      clerk: {
        id: identity.subject,
        email: identity.email ?? "",
        name:
          identity.name ??
          identity.givenName ??
          identity.familyName ??
          "Người dùng",
      },
      profile,
    };
  },
});

export const upsert = mutation({
  args: {
    fullName: v.string(),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    studentId: v.optional(v.string()),
    department: v.optional(v.string()),
    className: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const fullName = args.fullName.trim();
    if (fullName.length < 2 || fullName.length > 80) {
      throw new Error("Họ tên phải từ 2 đến 80 ký tự.");
    }

    if ((args.bio ?? "").length > 500) {
      throw new Error("Tiểu sử tối đa 500 ký tự.");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName,
        bio: args.bio?.trim(),
        phone: args.phone?.trim(),
        studentId: args.studentId?.trim(),
        department: args.department?.trim(),
        className: args.className?.trim(),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId: identity.subject,
      fullName,
      bio: args.bio?.trim(),
      phone: args.phone?.trim(),
      studentId: args.studentId?.trim(),
      department: args.department?.trim(),
      className: args.className?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  },
});


export const attachUploadedAvatar = internalMutation({
  args: {
    userId: v.string(),
    storageId: v.id("_storage"),
  },

  handler: async (ctx, args) => {
    const metadata = await ctx.db.system.get(
      "_storage",
      args.storageId
    );

    if (!metadata) {
      throw new Error("Ảnh upload không tồn tại.");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) =>
        q.eq("userId", args.userId)
      )
      .unique();

    const avatarUrl = await ctx.storage.getUrl(
      args.storageId
    );

    if (!avatarUrl) {
      throw new Error("Không thể tạo URL avatar.");
    }

    const now = Date.now();

    if (!existing) {
      return await ctx.db.insert("profiles", {
        userId: args.userId,
        fullName: "Người dùng",
        avatarStorageId: args.storageId,
        avatarUrl,
        createdAt: now,
        updatedAt: now,
      });
    }

    const oldId = existing.avatarStorageId;

    await ctx.db.patch(existing._id, {
      avatarStorageId: args.storageId,
      avatarUrl,
      updatedAt: now,
    });

    if (oldId && oldId !== args.storageId) {
      await ctx.storage.delete(oldId);
    }

    return existing._id;
  },
});
export const removeAvatar = mutation({
  args: {},

  handler: async (ctx) => {
    const identity = await requireUser(ctx);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) =>
        q.eq("userId", identity.subject)
      )
      .unique();

    if (!profile) {
      return;
    }

    const oldStorageId = profile.avatarStorageId;

    // Gỡ avatar khỏi hồ sơ.
    await ctx.db.patch(profile._id, {
      avatarStorageId: undefined,
      avatarUrl: undefined,
      updatedAt: Date.now(),
    });

    // Dọn file avatar cũ trên Convex Storage.
    if (oldStorageId) {
      await ctx.storage.delete(oldStorageId);
    }
  },
});

// Accept no identity arguments: account details always come from the caller's JWT.
export const syncIdentity = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await requireUser(ctx);
    const existing = await ctx.db.query("profiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject)).unique();
    const accountName = identity.name?.trim() ||
      [identity.givenName, identity.familyName].filter(Boolean).join(" ").trim() || undefined;
    const details = {
      email: identity.email?.trim() || existing?.email,
      accountName: accountName || existing?.accountName,
      accountAvatarUrl: identity.pictureUrl || existing?.accountAvatarUrl,
    };
    if (existing) {
      if (existing.email !== details.email || existing.accountName !== details.accountName || existing.accountAvatarUrl !== details.accountAvatarUrl) {
        await ctx.db.patch(existing._id, { ...details, updatedAt: Date.now() });
      }
    } else {
      const now = Date.now();
      await ctx.db.insert("profiles", {
        userId: identity.subject, fullName: accountName || "Người dùng",
        ...details, createdAt: now, updatedAt: now,
      });
    }
    return null;
  },
});
