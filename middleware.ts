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
const isMainAppRoute = createRouteMatcher([
  "/attendance(.*)",
  "/members(.*)",
  "/kids(.*)",
  "/visitors(.*)",
  "/follow-ups(.*)",
  "/master-list(.*)",
  "/youth(.*)",
  "/married(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();
  const userId = session?.userId;
  const sessionClaims = session?.sessionClaims;
  
  // The role can be in different places depending on JWT template configuration
  const publicMetadata = (sessionClaims?.publicMetadata as { role?: string }) || {};
  const metadata = (sessionClaims?.metadata as { role?: string }) || {};
  const claimsRole = (sessionClaims as any)?.role;
  
  const role = publicMetadata?.role || metadata?.role || claimsRole || "";
  const pathname = req.nextUrl.pathname;

  // Allow public routes without auth
  if (isPublicRoute(req)) {
    return;
  }

  // Redirect non-authenticated users to sign-in
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
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
    // For authenticated users without a special role, stay on home page
    // For guests, they were already redirected to /sign-in above
    return;
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
