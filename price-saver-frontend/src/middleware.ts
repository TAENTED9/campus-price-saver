import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Admin signin is public; everything else under /admin requires auth
const ADMIN_PUBLIC = ["/admin/signin"];
const BYPASS      = ["/_next", "/api", "/favicon", "/images", "/icons", "/fonts"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow Next.js internals and static assets
  if (BYPASS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only run admin protection on /admin/* routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Allow public admin routes (signin)
  if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For protected /admin/* routes — check for admin_token cookie
  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    const signinUrl = new URL("/admin/signin", request.url);
    signinUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
