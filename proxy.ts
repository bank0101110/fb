import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authConfigured, safeEqual, sessionToken } from "@/lib/auth";

// Everything needs a login except the login page and static assets.
// API routes also accept "Authorization: Bearer <INGEST_TOKEN>" for scripts.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  if (!authConfigured()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next(); // local dev without a password
    return new NextResponse("ตั้ง APP_PASSWORD และ AUTH_SECRET ใน Environment Variables ของ Vercel ก่อน", { status: 503 });
  }

  const isApi = pathname.startsWith("/api/");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const ingestToken = process.env.INGEST_TOKEN;
  if (isApi && bearer && ingestToken && safeEqual(bearer, ingestToken)) return NextResponse.next();

  const expected = await sessionToken();
  const got = req.cookies.get(AUTH_COOKIE)?.value;
  if (expected && got && safeEqual(got, expected)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
