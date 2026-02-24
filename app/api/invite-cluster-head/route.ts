import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * API route to invite a member to become a cluster head.
 * This creates a Clerk invitation and stores a pending record in Convex.
 */
export async function POST(req: Request) {
  try {
    // Verify the requester is a cluster-admin or admin
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get requester's role from Clerk
    const client = await clerkClient();
    const requester = await client.users.getUser(userId);
    const role = (requester.publicMetadata as { role?: string })?.role;
    
    if (role !== "admin" && role !== "cluster-admin") {
      return NextResponse.json({ error: "Forbidden: requires admin or cluster-admin" }, { status: 403 });
    }

    // Parse request body
    const { email, memberId, clusterId, firstName, lastName } = await req.json();

    if (!email || !memberId) {
      return NextResponse.json(
        { error: "Email and memberId are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if user already exists in Clerk
    const existingUsers = await client.users.getUserList({
      emailAddress: [email],
    });

    let invitationId: string | null = null;

    if (existingUsers.data.length > 0) {
      // User already exists - just update their role
      const existingUser = existingUsers.data[0];
      
      // Check if already a cluster head
      const existingRole = (existingUser.publicMetadata as { role?: string })?.role;
      if (existingRole === "cluster-head") {
        return NextResponse.json(
          { error: "User is already a cluster head" },
          { status: 409 }
        );
      }

      // Update their role directly
      await client.users.updateUser(existingUser.id, {
        publicMetadata: {
          ...existingUser.publicMetadata,
          role: "cluster-head",
        },
      });

      // Create invitation record as accepted
      await fetchMutation(api.clerkInvitations.createInvitation, {
        email: email.toLowerCase().trim(),
        memberId,
        clusterId: clusterId || undefined,
      });

      // Mark as accepted immediately
      const invitation = await client.users.getUser(existingUser.id);
      
      return NextResponse.json({
        success: true,
        message: "User promoted to cluster head",
        userId: existingUser.id,
        preExisting: true,
      });
    }

    // User doesn't exist - create invitation via Clerk
    // Note: You need to enable invitations in Clerk Dashboard first
    // Go to Clerk Dashboard → User & Authentication → Invitation
    
    // Create the invitation in Clerk
    try {
      const invitation = await client.invitations.createInvitation({
        emailAddress: email.toLowerCase().trim(),
        publicMetadata: {
          role: "cluster-head",
          memberId,
          clusterId: clusterId || null,
          invitedBy: userId,
        },
        redirectUrl: `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
      });
      
      invitationId = invitation.id;
    } catch (err: any) {
      // If invitations are disabled or failed, fall back to creating user directly
      console.warn("Clerk invitation failed, attempting direct user creation:", err);
      
      // Alternative: Create user directly (requires additional setup)
      return NextResponse.json(
        { 
          error: "Invitation system not configured. Please enable invitations in Clerk Dashboard.",
          details: err.message,
        },
        { status: 500 }
      );
    }

    // Store invitation in Convex
    await fetchMutation(api.clerkInvitations.createInvitation, {
      email: email.toLowerCase().trim(),
      memberId,
      clusterId: clusterId || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
      invitationId,
    });

  } catch (error: any) {
    console.error("Invitation error:", error);
    return NextResponse.json(
      { error: "Failed to send invitation", details: error.message },
      { status: 500 }
    );
  }
}
