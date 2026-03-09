import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUserRoles, isAdmin, isClusterAdmin, isClusterHead } from "./authHelpers";

// ============ Auth Helpers ============
function requireAdmin(identity: any) {
  if (!isAdmin(identity)) throw new Error("Forbidden: requires admin");
}

function requireClusterAdminOrAdmin(identity: any) {
  if (!isClusterAdmin(identity)) {
    const roles = getUserRoles(identity);
    throw new Error(`Forbidden: requires admin, cluster-admin, or fellowship-pastor. Your roles: [${roles.join(", ") || "none"}]`);
  }
}

function requireClusterHead(identity: any) {
  if (!isClusterHead(identity)) {
    const roles = getUserRoles(identity);
    throw new Error(`Forbidden: requires cluster-head, admin, cluster-admin, or fellowship-pastor. Your roles: [${roles.join(", ") || "none"}]`);
  }
}

// ============ Validators ============
const clusterValidator = v.object({
  _id: v.id("clusters"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  type: v.optional(v.union(v.string(), v.null())),
  leaderClerkId: v.optional(v.union(v.string(), v.null())),
  leaderMemberId: v.optional(v.union(v.id("members"), v.null())),
  active: v.boolean(),
  createdBy: v.string(),
  updatedAt: v.number(),
});

// ============ Queries ============

/** Get all active clusters with member count */
export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("clusters"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    type: v.optional(v.union(v.string(), v.null())),
    leaderClerkId: v.optional(v.union(v.string(), v.null())),
    leaderMemberId: v.optional(v.union(v.id("members"), v.null())),
    leaderName: v.optional(v.union(v.string(), v.null())),
    active: v.boolean(),
    memberCount: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const clusters = await ctx.db
      .query("clusters")
      .withIndex("by_active", (q) => 
        args.includeInactive ? q : q.eq("active", true)
      )
      .order("asc")
      .collect();

    const result = [];
    for (const cluster of clusters) {
      const members = await ctx.db
        .query("clusterMembers")
        .withIndex("by_cluster", (q) => q.eq("clusterId", cluster._id))
        .collect();
      
      // Look up leader from clusterHeads table using leaderClerkId
      let leaderName = null;
      if (cluster.leaderClerkId) {
        const leader = await ctx.db
          .query("clusterHeads")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", cluster.leaderClerkId!))
          .first();
        leaderName = leader?.displayName ?? null;
      }

      result.push({
        ...cluster,
        leaderName,
        memberCount: members.length,
      });
    }
    return result;
  },
});

/** Get single cluster by ID */
export const get = query({
  args: { id: v.id("clusters") },
  returns: v.union(clusterValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);
    return await ctx.db.get(args.id);
  },
});

/** Get my cluster (for cluster head) */
export const myCluster = query({
  args: {},
  returns: v.union(v.object({
    _id: v.id("clusters"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    type: v.optional(v.union(v.string(), v.null())),
    leaderClerkId: v.optional(v.union(v.string(), v.null())),
    leaderMemberId: v.optional(v.union(v.id("members"), v.null())),
    active: v.boolean(),
    memberCount: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    members: v.array(v.object({
      _id: v.id("members"),
      name: v.string(),
      contact: v.optional(v.union(v.string(), v.null())),
      gender: v.optional(v.union(v.string(), v.null())),
      residence: v.optional(v.union(v.string(), v.null())),
    })),
  }), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    if (!isClusterHead(identity)) {
      const roles = getUserRoles(identity);
      throw new Error(`Forbidden: requires cluster-head, admin, cluster-admin, or fellowship-pastor. Your roles: [${roles.join(", ") || "none"}]`);
    }

    const cluster = await ctx.db
      .query("clusters")
      .withIndex("by_active_leader", (q) => 
        q.eq("active", true).eq("leaderClerkId", identity.subject)
      )
      .first();

    if (!cluster) return null;

    const clusterMembers = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", cluster._id))
      .collect();

    const members = [];
    for (const cm of clusterMembers) {
      const member = await ctx.db.get(cm.memberId);
      if (member) {
        members.push({
          _id: member._id,
          name: member.name,
          contact: member.contact,
          gender: member.gender,
          residence: member.residence,
        });
      }
    }

    return {
      ...cluster,
      memberCount: members.length,
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

/** Get cluster statistics for admin dashboard */
export const stats = query({
  args: {},
  returns: v.object({
    totalClusters: v.number(),
    totalMembersInClusters: v.number(),
    unassignedMembers: v.number(),
    clustersNeedingAttention: v.number(), // Clusters with pending bishop attention requests
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const [clusters, allMembers, clusterMembers, pendingRequests] = await Promise.all([
      ctx.db.query("clusters").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      ctx.db.query("members").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      ctx.db.query("clusterMembers").collect(),
      ctx.db
        .query("clusterFollowUpLogs")
        .withIndex("by_request_type", (q) => q.eq("requestType", "bishop_attention"))
        .filter((q) => q.eq(q.field("resolved"), false))
        .collect(),
    ]);

    const assignedMemberIds = new Set(clusterMembers.map((cm) => cm.memberId));
    const unassignedMembers = allMembers.filter((m) => !assignedMemberIds.has(m._id)).length;

    // Get unique clusters with pending requests
    const clustersWithPending = new Set(pendingRequests.map((r) => r.clusterId.toString()));

    return {
      totalClusters: clusters.length,
      totalMembersInClusters: clusterMembers.length,
      unassignedMembers,
      clustersNeedingAttention: clustersWithPending.size,
    };
  },
});

/** Get members not assigned to any cluster */
export const getUnassignedMembers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("members"),
    name: v.string(),
    contact: v.optional(v.union(v.string(), v.null())),
    gender: v.optional(v.union(v.string(), v.null())),
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const [allMembers, clusterMembers] = await Promise.all([
      ctx.db.query("members").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      ctx.db.query("clusterMembers").collect(),
    ]);

    const assignedIds = new Set(clusterMembers.map((cm) => cm.memberId.toString()));

    return allMembers
      .filter((m) => !assignedIds.has(m._id.toString()))
      .map((m) => ({
        _id: m._id,
        name: m.name,
        contact: m.contact,
        gender: m.gender,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Get members of a specific cluster */
export const getClusterMembers = query({
  args: {
    clusterId: v.id("clusters"),
  },
  returns: v.array(v.object({
    _id: v.id("members"),
    name: v.string(),
    contact: v.optional(v.union(v.string(), v.null())),
    gender: v.optional(v.union(v.string(), v.null())),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const clusterMembers = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
      .collect();

    const members = [];
    for (const cm of clusterMembers) {
      const member = await ctx.db.get(cm.memberId);
      if (member && member.active) {
        members.push({
          _id: member._id,
          name: member.name,
          contact: member.contact,
          gender: member.gender,
        });
      }
    }

    return members.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ============ Mutations ============

/** Create a new cluster - Admin only */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  returns: v.id("clusters"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const now = Date.now();
    return await ctx.db.insert("clusters", {
      name: args.name.trim(),
      description: args.description?.trim() ?? null,
      type: args.type ?? null,
      leaderClerkId: null,
      leaderMemberId: null,
      active: true,
      createdBy: identity.subject,
      updatedAt: now,
    });
  },
});

/** Update cluster details */
export const update = mutation({
  args: {
    id: v.id("clusters"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const cluster = await ctx.db.get(args.id);
    if (!cluster) throw new Error("Cluster not found");

    const updates: { name?: string; description?: string | null; type?: string | null; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined) updates.description = args.description?.trim() ?? null;
    if (args.type !== undefined) updates.type = args.type ?? null;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

/** Assign leader to cluster - Admin only */
export const assignLeader = mutation({
  args: {
    clusterId: v.id("clusters"),
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");

    // Verify the cluster head exists
    const clusterHead = await ctx.db
      .query("clusterHeads")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!clusterHead) {
      throw new Error("Cluster head not found. Please add them in the Cluster Heads page first.");
    }

    if (!clusterHead.active) {
      throw new Error("This cluster head is archived. Please reactivate them first.");
    }

    // Check if leader is already assigned to another cluster
    if (clusterHead.clusterId && clusterHead.clusterId !== args.clusterId) {
      throw new Error("This user is already a leader of another cluster");
    }

    // Update cluster with leader
    await ctx.db.patch(args.clusterId, {
      leaderClerkId: args.clerkId,
      updatedAt: Date.now(),
    });

    // Update clusterHead with cluster assignment
    await ctx.db.patch(clusterHead._id, {
      clusterId: args.clusterId,
    });

    return null;
  },
});

/** Remove leader from cluster */
export const removeLeader = mutation({
  args: {
    clusterId: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any); // Only admin can remove leaders

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.leaderClerkId) throw new Error("Cluster has no leader");

    // Find the cluster head and clear their cluster assignment
    const clusterHead = await ctx.db
      .query("clusterHeads")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", cluster.leaderClerkId!))
      .first();

    if (clusterHead) {
      await ctx.db.patch(clusterHead._id, {
        clusterId: null,
      });
    }

    // Clear the leader assignment from cluster
    await ctx.db.patch(args.clusterId, {
      leaderClerkId: null,
      leaderMemberId: null,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Archive (soft delete) a cluster */
export const archive = mutation({
  args: {
    id: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any); // Only admin can archive

    const cluster = await ctx.db.get(args.id);
    if (!cluster) throw new Error("Cluster not found");

    await ctx.db.patch(args.id, {
      active: false,
      leaderClerkId: null, // Remove leader when archiving
      leaderMemberId: null,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Reactivate an archived cluster */
export const reactivate = mutation({
  args: {
    id: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const cluster = await ctx.db.get(args.id);
    if (!cluster) throw new Error("Cluster not found");

    await ctx.db.patch(args.id, {
      active: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Delete cluster permanently (admin only) */
export const remove = mutation({
  args: {
    id: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const cluster = await ctx.db.get(args.id);
    if (!cluster) throw new Error("Cluster not found");

    // Remove all cluster members first
    const members = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.id))
      .collect();
    
    for (const cm of members) {
      await ctx.db.delete(cm._id);
    }

    // Remove all follow-up logs
    const logs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.id))
      .collect();
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
