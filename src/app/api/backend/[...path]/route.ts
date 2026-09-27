import type { NextRequest } from "next/server";
import { getAllowedSession } from "@/lib/auth";

// Server-side proxy: the browser calls /api/backend/*, this checks the session and forwards to the
// Express API with the shared secret. The backend URL and key never reach the browser.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? "";

async function forward(req: NextRequest, ctx: RouteContext<"/api/backend/[...path]">) {
  if (!(await getAllowedSession())) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p === ".")) {
    return Response.json({ error: "Bad path" }, { status: 400 });
  }
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, BACKEND_URL);
  target.search = req.nextUrl.search;

  const headers = new Headers({ "x-api-key": BACKEND_API_KEY });
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        ...(res.headers.get("content-disposition") ? { "content-disposition": res.headers.get("content-disposition")! } : {}),
      },
    });
  } catch {
    return Response.json({ error: "Backend is unreachable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
