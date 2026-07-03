import { NextResponse } from "next/server";

// BE-16: only mutating requests are checked — GET is left alone since it
// carries no state change and public routes (/api/verify/*) need to stay
// reachable from anywhere. One Origin/Referer check is all this needs; no
// custom CORS library required for a same-origin-only API.
const ALLOWED = process.env.APP_URL || "http://localhost:3000";
let allowedOrigin;
try {
  allowedOrigin = new URL(ALLOWED).origin;
} catch {
  allowedOrigin = ALLOWED;
}

export function middleware(req) {
  if (req.method === "GET" || req.method === "HEAD") return NextResponse.next();
  const raw = req.headers.get("origin") || req.headers.get("referer") || "";
  // Exact origin match only. A prefix/startsWith check here would let
  // "https://sikkervalg.no.evil.com" pass for an allowed origin of
  // "https://sikkervalg.no" — parsing the URL and comparing .origin closes that.
  let requestOrigin;
  try {
    requestOrigin = new URL(raw).origin;
  } catch {
    requestOrigin = "";
  }
  if (requestOrigin !== allowedOrigin) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
