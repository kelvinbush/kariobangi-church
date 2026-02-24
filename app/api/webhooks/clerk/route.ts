import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * Clerk webhook handler for automated cluster head onboarding.
 * 
 * Required webhook events to subscribe to in Clerk Dashboard:
 * - user.created (for when invited users sign up)
 * - user.updated (for role changes)
 * - session.created (optional, for tracking)
 * 
 * Configure webhook in Clerk Dashboard → Webhooks → Add Endpoint
 * URL: https://your-domain.com/api/webhooks/clerk
 * Secret: Set as CLERK_WEBHOOK_SECRET in .env.local
 */

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: Request) {
  // Verify webhook secret is configured
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Verify headers exist
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  // Handle the webhook event
  const eventType = evt.type;
  console.log(`Received Clerk webhook: ${eventType}`);

  try {
    switch (eventType) {
      case "user.created": {
        await handleUserCreated(evt.data);
        break;
      }
      
      case "user.updated": {
        await handleUserUpdated(evt.data);
        break;
      }

      case "user.deleted": {
        await handleUserDeleted(evt.data);
        break;
      }

      default: {
        console.log(`Unhandled webhook event: ${eventType}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle user.created event
 * This fires when a new user signs up, including via invitation
 */
async function handleUserCreated(userData: any) {
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const publicMetadata = userData.public_metadata || {};
  
  console.log(`New user created: ${userId} (${email})`);

  // Check if this user was invited as a cluster head
  if (publicMetadata.role === "cluster-head") {
    console.log(`User ${userId} is a cluster head, processing invitation...`);

    const memberId = publicMetadata.memberId;
    const clusterId = publicMetadata.clusterId;

    if (!memberId) {
      console.warn(`Cluster head ${userId} has no memberId in metadata`);
      return;
    }

    // Accept the invitation in Convex by email
    if (email) {
      try {
        const result = await fetchMutation(api.clerkInvitations.acceptByEmail, {
          email,
          clerkUserId: userId,
        });
        console.log(`Invitation acceptance result:`, result);
      } catch (err: any) {
        console.error(`Failed to accept invitation: ${err.message}`);
      }
    }
    
    // If cluster was pre-assigned but not handled by acceptByEmail
    if (clusterId && email) {
      try {
        // Check if leader is already assigned
        const cluster = await fetchQuery(api.clusters.get, { id: clusterId });
        if (cluster && !cluster.leaderClerkId) {
          await fetchMutation(api.clusters.assignLeader, {
            clusterId,
            clerkId: userId,
          });
          console.log(`Assigned user ${userId} as leader of cluster ${clusterId}`);
        }
      } catch (err: any) {
        console.error(`Failed to assign cluster leader: ${err.message}`);
      }
    }
  }
}

/**
 * Handle user.updated event
 * This fires when user metadata changes
 */
async function handleUserUpdated(userData: any) {
  const userId = userData.id;
  const publicMetadata = userData.public_metadata || {};
  const previousMetadata = userData.previous_attributes?.public_metadata || {};

  // Check if role changed to cluster-head
  if (publicMetadata.role === "cluster-head" && previousMetadata.role !== "cluster-head") {
    console.log(`User ${userId} promoted to cluster head`);

    const clusterId = publicMetadata.clusterId;

    if (clusterId) {
      try {
        await fetchMutation(api.clusters.assignLeader, {
          clusterId,
          clerkId: userId,
        });
        console.log(`Assigned user ${userId} as leader of cluster ${clusterId}`);
      } catch (err: any) {
        console.error(`Failed to assign cluster leader: ${err.message}`);
      }
    }
  }

  // Check if role was removed from cluster-head
  if (previousMetadata.role === "cluster-head" && publicMetadata.role !== "cluster-head") {
    console.log(`User ${userId} demoted from cluster head`);
    // Additional cleanup if needed
  }
}

/**
 * Handle user.deleted event
 * Clean up when a user is deleted
 */
async function handleUserDeleted(userData: any) {
  const userId = userData.id;
  console.log(`User deleted: ${userId}`);
  
  // Could clean up cluster assignments here if needed
  // Though the cluster record will still have the leaderClerkId
  // which will become invalid
}
