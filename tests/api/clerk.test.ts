// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

const localFetch = globalThis.fetch;
let server: Server;
let origin: string;

beforeAll(async () => {
  // Synthetic configuration only. The real Clerk SDK runs against a fake upstream.
  vi.stubEnv("CLERK_PUBLISHABLE_KEY", "pk_test_" + Buffer.from("proxy-test.clerk.accounts.dev$").toString("base64"));
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_proxy_regression");
  vi.stubEnv("CLERK_FAPI_URL", "");
  vi.stubEnv("CLERK_TELEMETRY_DISABLED", "1");
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    expect(new URL(request.url).hostname).toBe("frontend-api.clerk.dev");
    if (new URL(request.url).pathname.endsWith("/prepare_verification") && !request.headers.get("cookie")?.includes("__client=fixture-client")) {
      return Response.json({ errors: [{ code: "signed_out" }] }, { status: 401 });
    }
    const headers = new Headers();
    headers.append("set-cookie", "__client=fixture-client; Path=/; HttpOnly; Secure; SameSite=None");
    headers.append("set-cookie", "proxy_test=1; Path=/; HttpOnly");
    return Response.json({
      url: request.url, method: request.method, body: await request.text(),
      contentType: request.headers.get("content-type"), cookie: request.headers.get("cookie"),
    }, { headers });
  }));
  const { default: app } = await import("../../api/clerk.js");
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});

afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Clerk proxy routing", () => {
  it("keeps every Set-Cookie header so a registration verification retains its client", async () => {
    const created = await localFetch(origin + "/__clerk/v1/client/sign_ups", { method: "POST" });
    expect(created.status).toBe(200);
    const cookies = created.headers.getSetCookie();
    expect(cookies).toEqual([
      "__client=fixture-client; Path=/; HttpOnly; Secure; SameSite=None",
      "proxy_test=1; Path=/; HttpOnly",
    ]);
    const verified = await localFetch(origin + "/__clerk/v1/client/sign_ups/sua_fixture/prepare_verification", {
      method: "POST", headers: { cookie: cookies.map(cookie => cookie.split(";")[0]).join("; ") },
    });
    expect(verified.status).toBe(200);
  });

  it("preserves Clerk's signed_out rejection when the client cookie is absent", async () => {
    const response = await localFetch(origin + "/__clerk/v1/client/sign_ups/sua_fixture/prepare_verification", { method: "POST" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ errors: [{ code: "signed_out" }] });
  });
  it.each(["/__clerk/v1/client/sign_ins", "/api/clerk"])("removes Vercel routing metadata from %s before the Clerk SDK forwards it", async path => {
    const body = "identifier=fixture%40example.invalid&password=fixture-only";
    const response = await localFetch(origin + path + "?path=v1%2Fclient%2Fsign_ins&__clerk_path=v1%2Fclient%2Fsign_ins&__clerk_api_version=2026-08-20", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: "fixture_cookie=1" }, body,
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const data = await response.json();
    const upstream = new URL(data.url);
    expect(upstream.pathname).toBe("/v1/client/sign_ins");
    expect([...upstream.searchParams.keys()]).toEqual(["__clerk_api_version"]);
    expect(upstream.searchParams.get("__clerk_api_version")).toBe("2026-08-20");
    expect(data.method).toBe("POST");
    expect(data.body).toBe(body);
    expect(data.contentType).toBe("application/x-www-form-urlencoded");
    expect(data.cookie).toBe("fixture_cookie=1");
    expect(response.headers.get("set-cookie")).toContain("proxy_test=1");
  });

  it("preserves clean proxy paths, duplicate upstream parameters and encoded values", async () => {
    const response = await localFetch(origin + "/__clerk/v1/environment?value=one&value=two&redirect_url=https%3A%2F%2Fexample.invalid%2Fpersonal%3Ftab%3Da");
    expect(response.status).toBe(200);
    const data = await response.json();
    const upstream = new URL(data.url);
    expect(upstream.pathname).toBe("/v1/environment");
    expect(upstream.searchParams.getAll("value")).toEqual(["one", "two"]);
    expect(upstream.searchParams.get("redirect_url")).toBe("https://example.invalid/personal?tab=a");
  });

  it("handles the root rewrite without sending its routing parameters upstream", async () => {
    const response = await localFetch(origin + "/api/clerk?__clerk_path=&path=");
    expect(response.status).toBe(200);
    const upstream = new URL((await response.json()).url);
    expect(upstream.pathname).toBe("/");
    expect(upstream.search).toBe("");
  });

  it.each(["https://example.invalid", "//example.invalid", "\\example.invalid"])("rejects unsafe rewrite paths: %s", async path => {
    const response = await localFetch(origin + "/api/clerk?__clerk_path=" + encodeURIComponent(path));
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid proxy path");
  });
});
