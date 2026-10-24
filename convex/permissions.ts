import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export const editableRoles: WorkspaceRole[] = ["admin", "member", "viewer"];

export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Bạn cần đăng nhập.");
  return identity;
}
export function verifiedEmail(identity: Awaited<ReturnType<typeof requireIdentity>>) {
  const email = identity.email?.trim().toLowerCase();
  if (!email || identity.emailVerified !== true) {
    throw new Error("Clerk phải cung cấp email đã xác minh trong JWT. Kiểm tra Convex integration / JWT claims.");
  }
  return email;
}
export async function requireMember(ctx: Ctx, workspaceId: Id<"workspaces">, userId: string) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Workspace không tồn tại.");
  const membership = await ctx.db.query("workspaceMembers")
    .withIndex("by_workspace_user", q => q.eq("workspaceId", workspaceId).eq("userId", userId)).unique();
  if (!membership) throw new Error("Bạn không phải thành viên Workspace.");
  return membership;
}
export async function requireManager(ctx: Ctx, workspaceId: Id<"workspaces">, userId: string) {
  const membership = await requireMember(ctx, workspaceId, userId);
  if (membership.role !== "owner" && membership.role !== "admin") throw new Error("Cần quyền Owner hoặc Admin.");
  return membership;
}
export async function requireOwner(ctx: Ctx, workspaceId: Id<"workspaces">, userId: string) {
  const member = await requireMember(ctx, workspaceId, userId);
  if (member.role !== "owner") throw new Error("Chỉ Owner có quyền này.");
  return member;
}
