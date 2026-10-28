
import express from "express";
import { clerkMiddleware } from "@clerk/express";

const app = express();

app.use((req, res, next) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("__clerk_path");

  if (path === null) {
    return next();
  }

  // Chỉ cho phép đường dẫn tương đối của Clerk.
  if (
    path.includes("://") ||
    path.includes("\\") ||
    path.startsWith("//")
  ) {
    return res.status(400).send("Invalid proxy path");
  }

  url.searchParams.delete("__clerk_path");

  req.url =
    "/__clerk" +
    (path ? `/${path.replace(/^\/+/, "")}` : "") +
    url.search;

  next();
});

app.use(
  clerkMiddleware({
    frontendApiProxy: {
      enabled: true,
      path: "/__clerk",
    },
  })
);

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

export default app;
