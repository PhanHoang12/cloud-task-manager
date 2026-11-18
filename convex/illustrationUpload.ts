import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ImageTarget } from "./illustrations";
import type { Id } from "./_generated/dataModel";

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
export function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return "image/png";
  const ascii = (start: number, text: string) => [...text].every((c,i) => bytes[start+i] === c.charCodeAt(0));
  return ascii(0,"RIFF") && ascii(8,"WEBP") ? "image/webp" : null;
}
function headers(origin: string) {
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
export const illustrationOptions = httpAction(async (_ctx, request): Promise<Response> => {
  const origin = request.headers.get("Origin") ?? "";
  return origin && origin === process.env.AVATAR_ALLOWED_ORIGIN
    ? new Response(null, { status: 204, headers: headers(origin) }) : new Response(null, { status: 403 });
});
export const uploadIllustration = httpAction(async (ctx, request): Promise<Response> => {
  const origin = request.headers.get("Origin") ?? "";
  if (!origin || origin !== process.env.AVATAR_ALLOWED_ORIGIN) return new Response("Origin not allowed.", { status: 403 });
  const cors = headers(origin);
  const reply = (text: string, status: number) => new Response(text, { status, headers: cors });
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return reply("Your session expired. Please sign in again.",401);
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind"), id = params.get("id");
  if (!id || !["projects","projectTasks","tasks"].includes(kind ?? "")) return reply("Invalid image target.",400);
  const target = { kind, id } as ImageTarget;
  try { await ctx.runQuery(internal.illustrations.authorizeUpload, { target, userId: identity.subject }); }
  catch { return reply("You no longer have permission to change this image.",403); }
  const type = request.headers.get("Content-Type") ?? "";
  if (!["image/jpeg","image/png","image/webp"].includes(type)) return reply("Choose a JPG, PNG or WebP image.",415);
  if (Number(request.headers.get("Content-Length")) > MAX_IMAGE_SIZE) return reply("The image must be under 2 MB.",413);
  // Bound memory even when Content-Length is missing or forged.
  const reader = request.body?.getReader();
  if (!reader) return reply("Choose an image.",400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_SIZE) { await reader.cancel(); return reply("The image must be under 2 MB.",413); }
      chunks.push(value);
    }
  } catch { return reply("Upload interrupted. Please try again.",400); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  if (!size || imageType(bytes) !== type) return reply("This file is not a valid JPG, PNG or WebP image.",415);
  let storageId: Id<"_storage"> | undefined;
  try {
    storageId = await ctx.storage.store(new Blob([bytes], { type }));
    // Recheck current membership here, including revocation during upload.
    await ctx.runMutation(internal.illustrations.attach, { target, userId: identity.subject, storageId });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...cors, "Content-Type":"application/json" } });
  } catch {
    if (storageId) await ctx.storage.delete(storageId);
    return reply("Could not save this image. Check your access and try again.",403);
  }
});
