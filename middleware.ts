import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define route matchers by role
const isClusterAdminRoute = createRouteMatcher(["/cluster-admin(.*)"]);
const isClusterHeadRoute = createRouteMatcher(["/cluster-head(.*)"]);
const isMainAppRoute = createRouteMatcher([
  "/attendance(.*)",
  "/members(.*)",
  "/kids(.*)",
  "/visitors(.*)",
  "/follow-ups(.*)",
  "/master-list(.*)",
  "/attendance(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();
  const userId = session?.userId;
  const sessionClaims = session?.sessionClaims;
  const role = (sessionClaims?.publicMetadata as { role?: string })?.role ?? "";
  const pathname = req.nextUrl.pathname;

  // If not logged in, allow access to public routes
  if (!userId) {
    return;
  }

  // Cluster admin routes - only cluster-admin or admin can access
  if (isClusterAdminRoute(req)) {
    if (role !== "admin" && role !== "cluster-admin") {
      // Redirect to their appropriate dashboard
      if (role === "cluster-head") {
        return NextResponse.redirect(new URL("/cluster-head", req.url));
      }
      // Default to main dashboard for other roles
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Cluster head routes - only cluster-head can access
  if (isClusterHeadRoute(req)) {
    if (role !== "cluster-head" && role !== "admin" && role !== "cluster-admin") {
      // Redirect to their appropriate dashboard
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Main app routes - only admin, follow-up-admin, and protocol can access
  if (isMainAppRoute(req)) {
    if (role === "cluster-head" || role === "cluster-admin") {
      // Redirect cluster users to their dashboards
      if (role === "cluster-head") {
        return NextResponse.redirect(new URL("/cluster-head", req.url));
      }
      if (role === "cluster-admin") {
        return NextResponse.redirect(new URL("/cluster-admin", req.url));
      }
    }
    return;
  }

  // Root page - let the page component handle the redirect based on role
  if (pathname === "/") {
    return;
  }

  // Allow all other routes
  return;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
