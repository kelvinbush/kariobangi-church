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
  
  // The role can be in different places depending on JWT template configuration
  // Check all possible locations
  const publicMetadata = (sessionClaims?.publicMetadata as { role?: string }) || {};
  const metadata = (sessionClaims?.metadata as { role?: string }) || {};  // Your template uses this!
  const claimsRole = (sessionClaims as any)?.role;
  
  // Use the first available role source
  const role = publicMetadata?.role || metadata?.role || claimsRole || "";
  
  const pathname = req.nextUrl.pathname;

  // If not logged in, allow access
  if (!userId) {
    return;
  }

  // Cluster admin routes - admin, cluster-admin, or fellowship-pastor can access
  if (isClusterAdminRoute(req)) {
    if (role === "admin" || role === "cluster-admin" || role === "fellowship-pastor") {
      return; // Allow access
    }
    // Redirect others
    if (role === "cluster-head") {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Cluster head routes - cluster-head, admin, cluster-admin, or fellowship-pastor can access
  if (isClusterHeadRoute(req)) {
    if (role === "cluster-head" || role === "admin" || role === "cluster-admin" || role === "fellowship-pastor") {
      return; // Allow access
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Main app routes
  if (isMainAppRoute(req)) {
    if (role === "cluster-head") {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    if (role === "cluster-admin") {
      return NextResponse.redirect(new URL("/cluster-admin", req.url));
    }
    return;
  }

  // Root page - role-based redirects
  if (pathname === "/") {
    if (role === "cluster-head") {
      return NextResponse.redirect(new URL("/cluster-head", req.url));
    }
    if (role === "cluster-admin") {
      return NextResponse.redirect(new URL("/cluster-admin", req.url));
    }
    if (role === "fellowship-pastor") {
      return NextResponse.redirect(new URL("/fellowship-pastor", req.url));
    }
    return; // Allow access for other roles
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
