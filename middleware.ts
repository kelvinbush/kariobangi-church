import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
]);

// Define route matchers by role
const isClusterAdminRoute = createRouteMatcher(["/cluster-admin(.*)"]);
const isClusterHeadRoute = createRouteMatcher(["/cluster-head(.*)"]);
const isFellowshipPastorRoute = createRouteMatcher(["/fellowship-pastor(.*)"]);
const isNoRoleRoute = createRouteMatcher(["/no-role(.*)"]);

// Home page - admin only
const isHomePage = createRouteMatcher(["/"]);

// Protocol team routes: attendance, visitors, follow-ups/my
const isProtocolRoute = createRouteMatcher([
  "/attendance(.*)",
  "/visitors(.*)",
  "/follow-ups/my(.*)",
]);

// Follow-up admin routes (admin can assign follow-ups, view all)
const isFollowUpAdminRoute = createRouteMatcher([
  "/follow-ups$", // exact /follow-ups only (admin view)
]);

// Other main app routes (members, kids, master-list, youth, married)
const isMainAppRoute = createRouteMatcher([
  "/members(.*)",
  "/kids(.*)",
  "/master-list(.*)",
  "/youth(.*)",
  "/married(.*)",
]);

// Helper to get all user roles (supports single role string or roles array)
function getUserRoles(sessionClaims: any): string[] {
  const publicMetadata = (sessionClaims?.publicMetadata as { role?: string; roles?: string[]; secondaryRole?: string }) || {};
  const metadata = (sessionClaims?.metadata as { role?: string; roles?: string[]; secondaryRole?: string }) || {};
  const claims = sessionClaims as any;
  
  const roles = new Set<string>();
  
  // Check all possible sources
  const sources = [publicMetadata, metadata, claims];
  
  for (const source of sources) {
    // Single role
    if (source?.role && typeof source.role === 'string') {
      roles.add(source.role);
    }
    // Roles array
    if (source?.roles && Array.isArray(source.roles)) {
      source.roles.forEach((r: string) => roles.add(r));
    }
    // Secondary role (for special cases like protocol+fellowship-pastor or follow-up-admin+protocol)
    if (source?.secondaryRole && typeof source.secondaryRole === 'string') {
      roles.add(source.secondaryRole);
    }
  }
  
  return Array.from(roles);
}

// Helper to check if user has any of the required roles
function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  return userRoles.some(role => requiredRoles.includes(role));
}

// Check if user is protocol team (protocol or follow-up-admin or both)
function isProtocolTeam(userRoles: string[]): boolean {
  return hasAnyRole(userRoles, ["protocol", "follow-up-admin"]);
}

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();
  const userId = session?.userId;
  const sessionClaims = session?.sessionClaims;
  
  const userRoles = getUserRoles(sessionClaims);
  const hasRole = userRoles.length > 0;
  const pathname = req.nextUrl.pathname;

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
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Check for admin role first (admin can access everything)
  const isAdmin = userRoles.includes("admin");
  if (isAdmin) {
    return;
  }

  // Home page - admin only (all others redirected)
  if (isHomePage(req)) {
    // Redirect based on role
    if (userRoles.includes("cluster-head")) {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    if (userRoles.includes("cluster-admin")) {
      return NextResponse.redirect(new URL("/cluster-admin", req.url));
    }
    if (userRoles.includes("fellowship-pastor")) {
      return NextResponse.redirect(new URL("/fellowship-pastor", req.url));
    }
    if (isProtocolTeam(userRoles)) {
      // Protocol team goes to attendance as their "home"
      return NextResponse.redirect(new URL("/attendance", req.url));
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Protocol routes: attendance, visitors, my follow-ups
  if (isProtocolRoute(req)) {
    if (isProtocolTeam(userRoles)) {
      return;
    }
    // Redirect others
    if (userRoles.includes("cluster-head")) {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    if (userRoles.includes("cluster-admin")) {
      return NextResponse.redirect(new URL("/cluster-admin", req.url));
    }
    if (userRoles.includes("fellowship-pastor")) {
      return NextResponse.redirect(new URL("/fellowship-pastor", req.url));
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Follow-up admin routes (main /follow-ups page)
  if (isFollowUpAdminRoute(req)) {
    if (hasAnyRole(userRoles, ["follow-up-admin"])) {
      return;
    }
    // Protocol users without follow-up-admin go to their my follow-ups
    if (userRoles.includes("protocol")) {
      return NextResponse.redirect(new URL("/follow-ups/my", req.url));
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Cluster admin routes
  if (isClusterAdminRoute(req)) {
    if (hasAnyRole(userRoles, ["cluster-admin", "fellowship-pastor"])) {
      return;
    }
    if (userRoles.includes("cluster-head")) {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Cluster head routes
  if (isClusterHeadRoute(req)) {
    if (hasAnyRole(userRoles, ["cluster-head", "cluster-admin", "fellowship-pastor"])) {
      return;
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Fellowship pastor routes
  if (isFellowshipPastorRoute(req)) {
    if (userRoles.includes("fellowship-pastor")) {
      return;
    }
    return NextResponse.redirect(new URL("/no-role", req.url));
  }

  // Main app routes (members, kids, master-list, youth, married)
  if (isMainAppRoute(req)) {
    // Protocol team and fellowship-pastor can access these
    if (isProtocolTeam(userRoles) || userRoles.includes("fellowship-pastor")) {
      return;
    }
    // Redirect others to their pages
    if (userRoles.includes("cluster-head")) {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    if (userRoles.includes("cluster-admin")) {
      return NextResponse.redirect(new URL("/cluster-admin", req.url));
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
