"use client";

/**
 * Role-based route guard.
 *
 * Each dashboard layout passes the role it requires. The hook:
 *  1. Waits while AuthContext is still loading the session (no redirect — we
 *     don't know what the user's role is yet).
 *  2. If the user is unauthenticated, sends them to the signin page for the
 *     requested role.
 *  3. If the user is authenticated BUT has the wrong role, sends them to the
 *     signin page for the requested role WITHOUT logging them out — they keep
 *     their existing session, they just have to re-authenticate as the role
 *     this route demands. The current URL is preserved as `?redirect=...`
 *     so signin can bounce them back after a successful login.
 *
 * Strict rule: every role is exclusive. An admin trying to open /seller or
 * /dashboard is blocked the same as a buyer trying to open /admin.
 */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export type RequiredRole = "buyer" | "seller" | "admin";

function signinPathForRole(role: RequiredRole, currentPath: string): string {
  const redirect = encodeURIComponent(currentPath || "/");
  if (role === "admin") {
    // Admin has its own dedicated signin page (uses ADMIN_API_KEY).
    return `/admin/signin?redirect=${redirect}`;
  }
  // Buyers and sellers share the general signin page. The `role` query string
  // lets the signin UI surface a contextual heading like "Sign in as seller".
  return `/signin?role=${role}&redirect=${redirect}`;
}

export type RoleGuardState = {
  /** True until AuthContext has finished restoring the session. */
  isVerifying: boolean;
  /** True only when the session is valid AND role matches. Safe to render UI. */
  isAuthorized: boolean;
};

export function useRoleGuard(requiredRole: RequiredRole): RoleGuardState {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasRole = !!user && user.role === requiredRole;
  const isAuthorized = !isLoading && isAuthenticated && hasRole;

  useEffect(() => {
    if (isLoading) return; // still hydrating — don't redirect yet
    if (isAuthenticated && hasRole) return; // permitted

    // Either unauthenticated OR authenticated with the wrong role.
    // Either way, push them to the signin page for the role this route
    // demands. We do NOT call logout() — the user keeps their current
    // session and just needs to re-authenticate as the correct role.
    const target = signinPathForRole(requiredRole, pathname || "/");
    router.replace(target);
  }, [isLoading, isAuthenticated, hasRole, requiredRole, pathname, router]);

  return {
    isVerifying: isLoading,
    isAuthorized,
  };
}
