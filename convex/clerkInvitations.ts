import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============ Auth Helpers ============
function getRoleFromIdentity(identity: { role?: string; [k: string]: unknown }): string | undefined {
  if (identity?.role) return identity.role;
  const m = identity as Record<string, unknown>;
  return (
    (m?.publicMetadata as { role?: string })?.role ??
    (m?.public_metadata as { role?: string })?.role ??
    (m?.claims as { role?: string })?.role
  );
}

function requireClusterAdminOrAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin" && role !== "cluster-admin") {
    throw new Error("Forbidden: requires admin or cluster-admin");
  }
}

function requireAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin") {
    throw new Error("Forbidden: requires admin");
  }
}

// ============ Types ============
const invitationValidator = v.object({
  _id: v.id("clusterHeadInvitations"),
  _creationTime: v.number(),
  email: v.string(),
  memberId: v.id("members"),
  clusterId: v.union(v.id("clusters"), v.null()),
  status: v.string(),
  invitedBy: v.string(),
  invitedAt: v.number(),
  expiresAt: v.number(),
  clerkUserId: v.union(v.string(), v.null()),
});

// ============ Queries ============

/** List all pending invitations */
export const listInvitations = query({
  args: {
    status: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("clusterHeadInvitations"),
    _creationTime: v.number(),
    email: v.string(),
    memberId: v.id("members"),
    memberName: v.string(),
    clusterId: v.union(v.id("clusters"), v.null()),
    clusterName: v.union(v.string(), v.null()),
    status: v.string(),
    invitedBy: v.string(),
    invitedAt: v.number(),
    expiresAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    let invitations = await ctx.db
      .query("clusterHeadInvitations")
      .order("desc")
      .collect();

    if (args.status) {
      invitations = invitations.filter((i) => i.status === args.status);
    }

    const result = [];
    for (const inv of invitations) {
      const [member, cluster] = await Promise.all([
        ctx.db.get(inv.memberId),
        inv.clusterId ? ctx.db.get(inv.clusterId) : Promise.resolve(null),
      ]);

      result.push({
        _id: inv._id,
        _creationTime: inv._creationTime,
        email: inv.email,
        memberId: inv.memberId,
        memberName: member?.name ?? "Unknown",
        clusterId: inv.clusterId,
        clusterName: cluster?.name ?? null,
        status: inv.status,
        invitedBy: inv.invitedBy,
        invitedAt: inv.invitedAt,
        expiresAt: inv.expiresAt,
      });
    }

    return result;
  },
});

/** Get invitation by email (for checking if user was invited) */
export const getByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(invitationValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
  },
});

/** Check if a member is already a cluster head or has pending invitation */
export const checkMemberStatus = query({
  args: {
    memberId: v.id("members"),
  },
  returns: v.object({
    isClusterHead: v.boolean(),
    hasPendingInvitation: v.boolean(),
    assignedCluster: v.union(v.object({
      clusterId: v.id("clusters"),
      clusterName: v.string(),
    }), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Check if they're a leader of any cluster
    const cluster = await ctx.db
      .query("clusters")
      .withIndex("by_active", (q) => q.eq("active", true))
      .filter((q) => q.eq(q.field("leaderMemberId"), args.memberId))
      .first();

    // Check for pending invitation
    const pendingInv = await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    return {
      isClusterHead: !!cluster,
      hasPendingInvitation: !!pendingInv,
      assignedCluster: cluster ? { clusterId: cluster._id, clusterName: cluster.name } : null,
    };
  },
});

/** Get eligible members for cluster head invitation */
export const getEligibleMembers = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("members"),
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    // Get all active members
    let members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Get members who are already cluster heads
    const clusters = await ctx.db
      .query("clusters")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const leaderMemberIds = new Set(
      clusters
        .filter((c) => c.leaderMemberId)
        .map((c) => c.leaderMemberId!.toString())
    );

    // Get members with pending invitations
    const pendingInvitations = await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const invitedMemberIds = new Set(
      pendingInvitations.map((i) => i.memberId.toString())
    );

    // Filter eligible members
    let eligible = members.filter(
      (m) => !leaderMemberIds.has(m._id.toString()) && !invitedMemberIds.has(m._id.toString())
    );

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      eligible = eligible.filter(
        (m) =>
          m.name.toLowerCase().includes(searchLower) ||
          (m.contact?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return eligible
      .map((m) => ({
        _id: m._id,
        name: m.name,
        contact: m.contact,
        email: m.contact, // Using contact as email for now
        residence: m.residence,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ============ Mutations ============

/** Create a new invitation */
export const createInvitation = mutation({
  args: {
    email: v.string(),
    memberId: v.id("members"),
    clusterId: v.optional(v.id("clusters")),
  },
  returns: v.id("clusterHeadInvitations"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const email = args.email.toLowerCase().trim();

    // Validate member exists
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");
    if (!member.active) throw new Error("Member is not active");

    // Check if already invited
    const existing = await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) {
      throw new Error("An invitation is already pending for this email");
    }

    // Check if member is already a cluster head
    const existingCluster = await ctx.db
      .query("clusters")
      .withIndex("by_active", (q) => q.eq("active", true))
      .filter((q) => q.eq(q.field("leaderMemberId"), args.memberId))
      .first();

    if (existingCluster) {
      throw new Error("This member is already a cluster head");
    }

    // Validate cluster if provided
    if (args.clusterId) {
      const cluster = await ctx.db.get(args.clusterId);
      if (!cluster) throw new Error("Cluster not found");
      if (!cluster.active) throw new Error("Cluster is not active");
      if (cluster.leaderClerkId) {
        throw new Error("Cluster already has a leader");
      }
    }

    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    return await ctx.db.insert("clusterHeadInvitations", {
      email,
      memberId: args.memberId,
      clusterId: args.clusterId ?? null,
      status: "pending",
      invitedBy: identity.subject,
      invitedAt: now,
      expiresAt,
      clerkUserId: null,
    });
  },
});

/** Mark invitation as accepted by ID (admin only) */
export const markAccepted = mutation({
  args: {
    invitationId: v.id("clusterHeadInvitations"),
    clerkUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") {
      throw new Error("Invitation is not pending");
    }
    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(args.invitationId, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    // Update invitation
    await ctx.db.patch(args.invitationId, {
      status: "accepted",
      clerkUserId: args.clerkUserId,
    });

    // If a cluster was specified, assign the leader
    if (invitation.clusterId) {
      await ctx.db.patch(invitation.clusterId, {
        leaderClerkId: args.clerkUserId,
        leaderMemberId: invitation.memberId,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/** Accept invitation by email (for webhook use or self-service) */
export const acceptByEmail = mutation({
  args: {
    email: v.string(),
    clerkUserId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    clusterId: v.union(v.id("clusters"), v.null()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // Find pending invitation by email
    const invitation = await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!invitation) {
      return {
        success: false,
        clusterId: null,
        message: "No pending invitation found for this email",
      };
    }

    // Check if expired
    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      return {
        success: false,
        clusterId: null,
        message: "Invitation has expired",
      };
    }

    // Mark as accepted
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      clerkUserId: args.clerkUserId,
    });

    // If a cluster was specified, assign the leader
    let assignedClusterId = null;
    if (invitation.clusterId) {
      await ctx.db.patch(invitation.clusterId, {
        leaderClerkId: args.clerkUserId,
        leaderMemberId: invitation.memberId,
        updatedAt: Date.now(),
      });
      assignedClusterId = invitation.clusterId;
    }

    return {
      success: true,
      clusterId: assignedClusterId,
      message: assignedClusterId ? "Assigned as cluster leader" : "Invitation accepted",
    };
  },
});

/** Cancel an invitation */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("clusterHeadInvitations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") {
      throw new Error("Can only cancel pending invitations");
    }

    await ctx.db.delete(args.invitationId);
    return null;
  },
});

/** Resend invitation (creates new one with fresh expiry) */
export const resendInvitation = mutation({
  args: {
    invitationId: v.id("clusterHeadInvitations"),
  },
  returns: v.id("clusterHeadInvitations"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const oldInvitation = await ctx.db.get(args.invitationId);
    if (!oldInvitation) throw new Error("Invitation not found");

    // Delete old invitation
    await ctx.db.delete(args.invitationId);

    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    return await ctx.db.insert("clusterHeadInvitations", {
      email: oldInvitation.email,
      memberId: oldInvitation.memberId,
      clusterId: oldInvitation.clusterId,
      status: "pending",
      invitedBy: identity.subject,
      invitedAt: now,
      expiresAt,
      clerkUserId: null,
    });
  },
});

/** Clean up expired invitations (can be called periodically) */
export const cleanupExpired = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const now = Date.now();
    const expired = await ctx.db
      .query("clusterHeadInvitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const inv of expired) {
      await ctx.db.patch(inv._id, { status: "expired" });
    }

    return expired.length;
  },
});

/** Revoke cluster head access and remove from cluster */
export const revokeClusterHead = mutation({
  args: {
    clusterId: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any); // Only admin can revoke

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.leaderClerkId) {
      throw new Error("Cluster has no leader to revoke");
    }

    // Remove leader from cluster
    await ctx.db.patch(args.clusterId, {
      leaderClerkId: null,
      leaderMemberId: null,
      updatedAt: Date.now(),
    });

    // Cancel any pending invitations for this member
    if (cluster.leaderMemberId) {
      const invitations = await ctx.db
        .query("clusterHeadInvitations")
        .withIndex("by_member", (q) => q.eq("memberId", cluster.leaderMemberId!))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();

      for (const inv of invitations) {
        await ctx.db.delete(inv._id);
      }
    }

    // Note: The actual Clerk user role change needs to happen via Clerk API
    // This is handled separately or via a webhook

    return null;
  },
});
