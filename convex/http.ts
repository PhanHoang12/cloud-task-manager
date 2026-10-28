
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const MAX_SIZE = 2 * 1024 * 1024;

function detectImageType(bytes: Uint8Array): string | null {
  // JPEG
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  const png = [137, 80, 78, 71, 13, 10, 26, 10];

  if (png.every((value, i) => bytes[i] === value)) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  const ascii = (start: number, text: string) =>
    [...text].every(
      (char, i) => bytes[start + i] === char.charCodeAt(0)
    );

  if (ascii(0, "RIFF") && ascii(8, "WEBP")) {
    return "image/webp";
  }

  return null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

http.route({
  path: "/upload-avatar",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigin = process.env.AVATAR_ALLOWED_ORIGIN;

    if (!allowedOrigin || origin !== allowedOrigin) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }),
});

http.route({
  path: "/upload-avatar",
  method: "POST",

  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigin = process.env.AVATAR_ALLOWED_ORIGIN;

    if (!allowedOrigin || origin !== allowedOrigin) {
      return new Response("Origin không hợp lệ.", {
        status: 403,
      });
    }

    const headers = corsHeaders(origin);

    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return new Response("Bạn cần đăng nhập.", {
        status: 401,
        headers,
      });
    }

    const declaredLength = Number(
      request.headers.get("Content-Length") ?? "0"
    );

    if (declaredLength > MAX_SIZE) {
      return new Response("Ảnh vượt quá 2 MB.", {
        status: 413,
        headers,
      });
    }

    const blob = await request.blob();

    if (blob.size === 0 || blob.size > MAX_SIZE) {
      return new Response("Ảnh phải nhỏ hơn 2 MB.", {
        status: 413,
        headers,
      });
    }

    const bytes = new Uint8Array(
      await blob.slice(0, 16).arrayBuffer()
    );

    const detectedType = detectImageType(bytes);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !detectedType ||
      !allowedTypes.includes(detectedType) ||
      blob.type !== detectedType
    ) {
      return new Response(
        "File không phải ảnh JPG, PNG hoặc WebP hợp lệ.",
        { status: 415, headers }
      );
    }

    let storageId: Awaited<
      ReturnType<typeof ctx.storage.store>
    > | undefined;

    try {
      storageId = await ctx.storage.store(blob);

      await ctx.runMutation(
        internal.profiles.attachUploadedAvatar,
        {
          userId: identity.subject,
          storageId,
        }
      );

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      // Nếu cập nhật hồ sơ thất bại,
      // cố gắng dọn file mới upload.
      if (storageId) {
        try {
          await ctx.storage.delete(storageId);
        } catch (cleanupError) {
          console.error(
            "Avatar cleanup failed",
            cleanupError
          );
        }
      }

      console.error("Avatar upload failed", error);

      return new Response("Không thể lưu ảnh đại diện.", {
        status: 500,
        headers,
      });
    }
  }),
});

export default http;
