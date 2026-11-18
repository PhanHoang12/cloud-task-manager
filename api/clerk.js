
import express from "express";
import { clerkFrontendApiProxy } from "@clerk/backend/proxy";
import { Readable } from "node:stream";

const app = express();

app.use((req, res, next) => {
  const url = new URL(req.originalUrl || req.url, "http://localhost");
  const path = url.searchParams.get("__clerk_path");

  if (path === null && url.pathname !== "/__clerk" && !url.pathname.startsWith("/__clerk/")) {
    return next();
  }

  // Chỉ cho phép đường dẫn tương đối của Clerk.
  if (
    path !== null && (
      path.includes("://") ||
      path.includes("\\") ||
      path.startsWith("//")
    )
  ) {
    return res.status(400).send("Invalid proxy path");
  }

  url.searchParams.delete("__clerk_path");
  url.searchParams.delete("path");

  req.url =
    (path === null ? url.pathname : "/__clerk" + (path ? `/${path.replace(/^\/+/, "")}` : "")) +
    url.search;

  // Clerk reads originalUrl before url. Both must exclude Vercel routing metadata.
  req.originalUrl = req.url;

  next();
});

app.use(async (req, res, next) => {
  const url = new URL(req.originalUrl || req.url, `${req.protocol}://${req.get("host")}`);
  if (url.pathname !== "/__clerk" && !url.pathname.startsWith("/__clerk/")) return next();

  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const request = new Request(url, {
      method: req.method,
      headers,
      ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
    });
    // Keep Clerk's official upstream selection, credentials and header handling.
    const response = await clerkFrontendApiProxy(request, { proxyPath: "/__clerk" });
    res.status(response.status);
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") res.setHeader(name, value);
    });
    // setHeader replaces an earlier value: send all cookies together, never joined.
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    if (response.body) Readable.fromWeb(response.body).on("error", next).pipe(res);
    else res.end();
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

export default app;
