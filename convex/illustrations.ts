import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, internalQuery, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireMember, requireIdentity } from "./permissions";

export const imageTarget = v.union(
  v.object({ kind: v.literal("projects"), id: v.id("projects") }),
  v.object({ kind: v.literal("projectTasks"), id: v.id("projectTasks") }),
  v.object({ kind: v.literal("tasks"), id: v.id("tasks") }),
);
export type ImageTarget = Infer<typeof imageTarget>;
const denied = () => new ConvexError("You no longer have permission to change this image.");

// Image edits follow the same ownership, membership and completed-task rules as task edits.
async function writable(ctx: QueryCtx | MutationCtx, target: ImageTarget, userId: string) {
  if (target.kind === "tasks") {
    const task = await ctx.db.get(target.id);
    if (!task || task.ownerId !== userId) throw denied();
    return { id: task._id, coverStorageId: task.coverStorageId };
  }
  if (target.kind === "projects") {
    const project = await ctx.db.get(target.id);
    if (!project) throw denied();
    const member = await requireMember(ctx, project.workspaceId, userId);
    if (member.role !== "owner" && member.role !== "admin") throw denied();
    return { id: project._id, coverStorageId: project.coverStorageId };
  }
  const task = await ctx.db.get(target.id);
  if (!task) throw denied();
  const project = await ctx.db.get(task.projectId);
  if (!project || project.status !== "active") throw denied();
  const member = await requireMember(ctx, project.workspaceId, userId);
  const manager = member.role === "owner" || member.role === "admin";
  if (member.role === "viewer" || (!manager &&
    (task.status === "done" || (task.createdBy !== userId && task.assigneeId !== userId)))) throw denied();
  return { id: task._id, coverStorageId: task.coverStorageId };
}

export const authorizeUpload = internalQuery({
  args: { target: imageTarget, userId: v.string() },
  handler: async (ctx, args) => { await writable(ctx, args.target, args.userId); return null; },
});

// Only our authenticated HTTP upload handler can attach a newly stored image.
export const attach = internalMutation({
  args: { target: imageTarget, userId: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const doc = await writable(ctx, args.target, args.userId);
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata || metadata.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(metadata.contentType ?? "")) {
      throw new ConvexError("Choose a JPG, PNG or WebP image under 2 MB.");
    }
    const coverUrl = await ctx.storage.getUrl(args.storageId);
    if (!coverUrl) throw new ConvexError("The uploaded image is unavailable.");
    await ctx.db.patch(doc.id, { coverStorageId: args.storageId, coverUrl, updatedAt: Date.now() });
    if (doc.coverStorageId && doc.coverStorageId !== args.storageId) await ctx.storage.delete(doc.coverStorageId);
    return null;
  },
});

export const remove = mutation({
  args: { target: imageTarget },
  handler: async (ctx, { target }) => {
    const identity = await requireIdentity(ctx);
    const doc = await writable(ctx, target, identity.subject);
    await ctx.db.patch(doc.id, { coverStorageId: undefined, coverUrl: undefined, updatedAt: Date.now() });
    if (doc.coverStorageId) await ctx.storage.delete(doc.coverStorageId);
    return null;
  },
});
