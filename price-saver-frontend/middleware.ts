import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Middleware for route protection and role-based access control
 * Ensures users can only access their own resources
 * Prevents unauthorized access to seller/admin routes
 */

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXT_PUBLIC_JWT_SECRET || "your-secret-key"
);

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/signin", "/signup", "/", "/explore", "/about"];

// Routes that require seller role
const SELLER_ROUTES = ["/seller", "/inventory", "/analytics"];

// Routes that require admin role
const ADMIN_ROUTES = ["/admin"];

interface JWTPayload {
  sub: string; // user_id
  email: string;
  username?: string;
  role?: string;
  exp: number;
}

async function verifyAuth(token: string): Promise<JWTPayload | null> {
  try:
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as JWTPayload;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}

function getTokenFromRequest(req: NextRequest): string | null {
  // Try Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try cookie
  const token = req.cookies.get("accessToken")?.value;
  return token || null;
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function isSellerRoute(pathname: string): boolean {
  return SELLER_ROUTES.some((route) => pathname.startsWith(route));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route));
}

function extractUserIdFromUrl(pathname: string): string | null {
  /**
   * Extract {userId} from dynamic routes like /seller/[userId]/inventory
   * or /buyer/[userId]/wishlist
   */
  const match = pathname.match(/\/(seller|buyer|admin)\/([^/]+)/);
  return match ? match[2] : null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = getTokenFromRequest(req);

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // If user is authenticated and tries to access signin/signup, redirect to dashboard
    if (token && (pathname === "/signin" || pathname === "/signup")) {
      const payload = await verifyAuth(token);
      if (payload) {
        const role = payload.role || "buyer";
        const dashboard = role === "seller" ? "/seller/dashboard" : "/buyer/dashboard";
        return NextResponse.redirect(new URL(dashboard, req.url));
      }
    }
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (!token) {
    // Redirect to signin if accessing protected route without token
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Verify token
  const payload = await verifyAuth(token);
  if (!payload) {
    // Invalid token - redirect to signin
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const userId = payload.sub;
  const userRole = payload.role || "buyer";

  // ==================== SELLER ROUTE CHECK ====================
  if (isSellerRoute(pathname)) {
    if (userRole !== "seller" && userRole !== "admin") {
      // User is not a seller, redirect to buyer dashboard
      return NextResponse.redirect(new URL("/buyer/dashboard", req.url));
    }

    // Extract {userId} from URL and validate it matches authenticated user
    const urlUserId = extractUserIdFromUrl(pathname);
    if (urlUserId && urlUserId !== userId && userRole !== "admin") {
      // User trying to access another seller's data
      return NextResponse.redirect(new URL(`/seller/${userId}/dashboard`, req.url));
    }
  }

  // ==================== ADMIN ROUTE CHECK ====================
  if (isAdminRoute(pathname)) {
    if (userRole !== "admin") {
      // User is not an admin, redirect to their dashboard
      const dashboard = userRole === "seller" ? "/seller/dashboard" : "/buyer/dashboard";
      return NextResponse.redirect(new URL(dashboard, req.url));
    }
  }

  // ==================== BUYER ROUTE CHECK ====================
  if (pathname.startsWith("/buyer")) {
    // Extract {userId} from URL
    const urlUserId = extractUserIdFromUrl(pathname);
    if (urlUserId && urlUserId !== userId && userRole !== "admin") {
      // User trying to access another buyer's data
      return NextResponse.redirect(new URL(`/buyer/${userId}/dashboard`, req.url));
    }
  }

  // All checks passed
  return NextResponse.next();
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    // Protected routes
    "/buyer/:path*",
    "/seller/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/profile/:path*",
    // Public routes (to redirect authenticated users away from signin/signup)
    "/signin",
    "/signup",
  ],
};
