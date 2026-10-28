/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const ownerIdentity = { subject: "owner-user", name: "Tên từ tài khoản", email: "owner@example.com", pictureUrl: "https://example.com/account.png" };

async function setup() {
  const t = convexTest(schema, modules);
  const workspaceId = await t.run(async ctx => {
    const workspaceId = await ctx.db.insert("workspaces", { name: "Workspace A", description: "", ownerId: "owner-user", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: "owner-user", role: "owner", joinedAt: 1 });
    await ctx.db.insert("workspaceMembers", { workspaceId, userId: "member-user", role: "viewer", joinedAt: 2 });
    await ctx.db.insert("profiles", {
      userId: "owner-user", fullName: "Tên hiển thị riêng", avatarUrl: "https://example.com/custom.png",
      bio: "Riêng tư", phone: "0900000000", studentId: "PRIVATE-ID", department: "Khoa", className: "Lớp",
      createdAt: 1, updatedAt: 1,
    });
    const otherWorkspace = await ctx.db.insert("workspaces", { name: "Workspace B", description: "", ownerId: "other-user", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("workspaceMembers", { workspaceId: otherWorkspace, userId: "other-user", role: "owner", joinedAt: 1 });
    await ctx.db.insert("profiles", { userId: "other-user", fullName: "Không được xuất hiện", email: "private@example.com", createdAt: 1, updatedAt: 1 });
    return workspaceId;
  });
  return { t, workspaceId };
}

afterEach(() => vi.useRealTimers());

describe("Workspace member directory", () => {
  it("rejects unauthenticated callers and non-members", async () => {
    const { t, workspaceId } = await setup();
    await expect(t.query(api.members.list, { workspaceId })).rejects.toThrow("đăng nhập");
    await expect(t.withIdentity({ subject: "other-user" }).query(api.members.list, { workspaceId })).rejects.toThrow("thành viên");
  });

  it("allows a viewer to see only workspace account details", async () => {
    const { t, workspaceId } = await setup();
    const rows = await t.withIdentity({ subject: "member-user" }).query(api.members.list, { workspaceId });
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.userId)).not.toContain("other-user");
    const owner = rows.find(row => row.userId === "owner-user")!;
    expect(owner.fullName).toBe("Tên hiển thị riêng");
    expect(owner.avatarUrl).toBe("https://example.com/custom.png");
    expect(Object.keys(owner).sort()).toEqual(["_id", "_creationTime", "workspaceId", "userId", "role", "joinedAt", "fullName", "email", "avatarUrl"].sort());
    for (const field of ["phone", "bio", "studentId", "department", "className"]) expect(owner).not.toHaveProperty(field);
  });

  it("uses authenticated account details only for the caller's own row", async () => {
    const { t, workspaceId } = await setup();
    const rows = await t.withIdentity({ subject: "member-user", name: "Tên tài khoản hiện tại", email: "member@example.com" }).query(api.members.list, { workspaceId });
    expect(rows.find(row => row.userId === "member-user")).toMatchObject({ fullName: "Tên tài khoản hiện tại", email: "member@example.com", avatarUrl: null });
    const ownerRows = await t.withIdentity(ownerIdentity).query(api.members.list, { workspaceId });
    expect(ownerRows.find(row => row.userId === "member-user")).toMatchObject({ fullName: null, email: null, avatarUrl: null });
  });

  it("keeps Owner protected from role changes and removal", async () => {
    const { t, workspaceId } = await setup();
    const owner = t.withIdentity(ownerIdentity);
    await expect(owner.mutation(api.members.changeRole, { workspaceId, targetUserId: "owner-user", role: "member" })).rejects.toThrow("Owner");
    await expect(owner.mutation(api.members.remove, { workspaceId, targetUserId: "owner-user" })).rejects.toThrow("Owner");
  });
});

describe("Authenticated account synchronization", () => {
  it("rejects unauthenticated synchronization and identity arguments", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.profiles.syncIdentity, {})).rejects.toThrow("đăng nhập");
    await expect(t.withIdentity(ownerIdentity).mutation(api.profiles.syncIdentity, { userId: "other-user" } as never)).rejects.toThrow();
  });

  it("preserves custom profile fields and updates account details from the JWT", async () => {
    const { t, workspaceId } = await setup();
    const owner = t.withIdentity(ownerIdentity);
    await owner.mutation(api.profiles.syncIdentity, {});
    const profile = await t.run(ctx => ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", "owner-user")).unique());
    expect(profile).toMatchObject({ fullName: "Tên hiển thị riêng", email: "owner@example.com", accountName: "Tên từ tài khoản", accountAvatarUrl: "https://example.com/account.png", avatarUrl: "https://example.com/custom.png", phone: "0900000000", bio: "Riêng tư" });
    const rows = await t.withIdentity({ subject: "member-user" }).query(api.members.list, { workspaceId });
    expect(rows.find(row => row.userId === "owner-user")).toMatchObject({ fullName: "Tên hiển thị riêng", email: "owner@example.com", avatarUrl: "https://example.com/custom.png" });
  });

  it("creates only the current user's profile and avoids repeated writes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T04:00:00Z"));
    const { t } = await setup();
    const member = t.withIdentity({ subject: "member-user", name: "Thành viên mới", email: "member@example.com" });
    await member.mutation(api.profiles.syncIdentity, {});
    const first = await t.run(ctx => ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", "member-user")).unique());
    expect(first).toMatchObject({ userId: "member-user", fullName: "Thành viên mới", email: "member@example.com" });
    vi.setSystemTime(new Date("2026-10-28T04:00:00Z"));
    await member.mutation(api.profiles.syncIdentity, {});
    const second = await t.run(ctx => ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", "member-user")).unique());
    expect(second?.updatedAt).toBe(first?.updatedAt);
  });
});
