import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * Cryptographic JWT verification is NOT done here — the Edge runtime
 * can't safely access server-only secrets, and real auth is enforced
 * on every API call. This middleware only:
 *   1. Checks whether a non-expired token cookie/header is present.
 *   2. Decodes the role claim for redirect routing (no signature check).
 *   3. Redirects unauthenticated / wrong-role users.
 */

const PUBLIC_ROUTES = ["/signin", "/signup", "/", "/explore", "/about", "/store"];
const SELLER_ROUTES = ["/seller", "/inventory", "/analytics"];
const ADMIN_ROUTES  = ["/admin"];

function getToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return req.cookies.get("accessToken")?.value ?? null;
}

/**
 * Decode role from JWT payload without cryptographic verification.
 * Returns null if token is malformed OR expired — treats expired tokens
 * as if no token exists so users with stale cookies can still log in.
 */
function decodeRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Treat expired tokens as absent — let the user reach /signin
    if (payload?.exp && payload.exp * 1000 < Date.now()) return null;
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = getToken(req);

  // Let Next.js internals, API routes, and static assets through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/fonts")
  ) {
    return NextResponse.next();
  }

  // Authenticated (non-expired) user hitting signin/signup → redirect to dashboard
  if (token && (pathname === "/signin" || pathname === "/signup")) {
    const role = decodeRole(token);
    if (role) {
      const dest = role === "seller" ? "/seller" : role === "admin" ? "/admin" : "/";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    // Token present but expired → fall through and let them reach the page
  }

  // Public routes — always allow
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Protected routes require a valid (non-expired) token
  const role = token ? decodeRole(token) : null;
  if (!role) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Seller routes
  if (SELLER_ROUTES.some((r) => pathname.startsWith(r))) {
    if (role !== "seller" && role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Admin routes
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (pathname !== "/admin/signin" && role !== "admin") {
      const dest = role === "seller" ? "/seller" : "/";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/buyer/:path*",
    "/seller/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/profile/:path*",
    "/signin",
    "/signup",
  ],
};
