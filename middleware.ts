import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
]);

const isNoRoleRoute = createRouteMatcher(["/no-role(.*)"]);

// Admin-only routes
const isAdminRoute = createRouteMatcher(["/", "/admin(.*)"]);

// Protocol team routes: attendance, visitors, members, kids registration + marking
const isProtocolRoute = createRouteMatcher([
  "/attendance(.*)",
  "/visitors(.*)",
  "/members(.*)",
  "/kids(.*)",
]);

// Get all user roles (supports single role string or roles array)
function getUserRoles(sessionClaims: any): string[] {
  const publicMetadata =
    (sessionClaims?.publicMetadata as { role?: string; roles?: string[] }) || {};
  const metadata =
    (sessionClaims?.metadata as { role?: string; roles?: string[] }) || {};
  const claims = sessionClaims as any;

  const roles = new Set<string>();

  for (const source of [publicMetadata, metadata, claims]) {
    if (source?.role && typeof source.role === "string") {
      roles.add(source.role);
    }
    if (source?.roles && Array.isArray(source.roles)) {
      source.roles.forEach((r: string) => roles.add(r));
    }
  }

  return Array.from(roles);
}

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();
  const userId = session?.userId;
  const userRoles = getUserRoles(session?.sessionClaims);
  const hasRole = userRoles.length > 0;

  // Allow public routes without auth
  if (isPublicRoute(req)) {
    return;
  }

  // Redirect non-authenticated users to sign-in
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Allow access to no-role page
  if (isNoRoleRoute(req)) {
    return;
  }

  // Users with no role go to no-role page
  if (!hasRole) {
    console.log(userRoles);
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  const isAdmin = userRoles.includes("admin");
  const isProtocol = userRoles.includes("protocol");

  // Admin can access everything
  if (isAdmin) {
    return;
  }

  // Admin routes: admin only; protocol team lands on attendance, others on no-role
  if (isAdminRoute(req)) {
    if (isProtocol) {
      return NextResponse.redirect(new URL("/attendance", req.url));
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Protocol routes
  if (isProtocolRoute(req)) {
    if (isProtocol) {
      return;
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Allow all other routes
  return;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
