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
    (m?.metadata as { role?: string })?.role ??
    (m?.claims as { role?: string })?.role
  );
}

function requireClusterAdminOrAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin" && role !== "cluster-admin") {
    throw new Error("Forbidden: requires admin or cluster-admin");
  }
}

function isClusterHeadOf(identity: { subject: string }, clusterLeaderClerkId: string | null) {
  return identity.subject === clusterLeaderClerkId;
}

// ============ Queries ============

/** Get all members in a cluster */
export const listByCluster = query({
  args: {
    clusterId: v.id("clusters"),
  },
  returns: v.array(v.object({
    _id: v.id("clusterMembers"),
    memberId: v.id("members"),
    memberName: v.string(),
    memberContact: v.union(v.string(), v.null()),
    memberGender: v.union(v.string(), v.null()),
    memberResidence: v.union(v.string(), v.null()),
    joinedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");

    const role = getRoleFromIdentity(identity as any);
    const isAdmin = role === "admin" || role === "cluster-admin";
    const isLeader = isClusterHeadOf(identity, cluster.leaderClerkId);

    if (!isAdmin && !isLeader) {
      throw new Error("Forbidden: not authorized to view this cluster");
    }

    const clusterMembers = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
      .order("asc")
      .collect();

    const result = [];
    for (const cm of clusterMembers) {
      const member = await ctx.db.get(cm.memberId);
      if (member) {
        result.push({
          _id: cm._id,
          memberId: member._id,
          memberName: member.name,
          memberContact: member.contact,
          memberGender: member.gender,
          memberResidence: member.residence,
          joinedAt: cm.joinedAt,
        });
      }
    }

    return result.sort((a, b) => a.memberName.localeCompare(b.memberName));
  },
});

/** Get all members NOT assigned to any cluster */
export const unassignedMembers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("members"),
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const [allMembers, clusterMembers] = await Promise.all([
      ctx.db.query("members").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      ctx.db.query("clusterMembers").collect(),
    ]);

    const assignedMemberIds = new Set(clusterMembers.map((cm) => cm.memberId.toString()));

    return allMembers
      .filter((m) => !assignedMemberIds.has(m._id.toString()))
      .map((m) => ({
        _id: m._id,
        name: m.name,
        contact: m.contact,
        gender: m.gender,
        residence: m.residence,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Get members with their cluster assignment status */
export const listAllWithClusterStatus = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("members"),
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
    clusterId: v.union(v.id("clusters"), v.null()),
    clusterName: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const [allMembers, clusterMembers, clusters] = await Promise.all([
      ctx.db.query("members").withIndex("by_active", (q) => q.eq("active", true)).collect(),
      ctx.db.query("clusterMembers").collect(),
      ctx.db.query("clusters").withIndex("by_active", (q) => q.eq("active", true)).collect(),
    ]);

    const memberClusterMap = new Map<string, Id<"clusters">>();
    for (const cm of clusterMembers) {
      memberClusterMap.set(cm.memberId.toString(), cm.clusterId);
    }

    const clusterMap = new Map<string, string>();
    for (const c of clusters) {
      clusterMap.set(c._id.toString(), c.name);
    }

    let result = allMembers.map((m) => {
      const clusterId = memberClusterMap.get(m._id.toString()) ?? null;
      return {
        _id: m._id,
        name: m.name,
        contact: m.contact,
        gender: m.gender,
        residence: m.residence,
        clusterId,
        clusterName: clusterId ? (clusterMap.get(clusterId.toString()) ?? null) : null,
      };
    });

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(searchLower) ||
          (m.contact?.toLowerCase().includes(searchLower) ?? false) ||
          (m.residence?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Check if member is already assigned to a cluster */
export const getMemberCluster = query({
  args: {
    memberId: v.id("members"),
  },
  returns: v.union(v.object({
    clusterId: v.id("clusters"),
    clusterName: v.string(),
  }), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const clusterMember = await ctx.db
      .query("clusterMembers")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .first();

    if (!clusterMember) return null;

    const cluster = await ctx.db.get(clusterMember.clusterId);
    if (!cluster) return null;

    return {
      clusterId: cluster._id,
      clusterName: cluster.name,
    };
  },
});

// ============ Mutations ============

/** Add single member to cluster */
export const addMember = mutation({
  args: {
    clusterId: v.id("clusters"),
    memberId: v.id("members"),
  },
  returns: v.id("clusterMembers"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const [cluster, member, existing] = await Promise.all([
      ctx.db.get(args.clusterId),
      ctx.db.get(args.memberId),
      ctx.db
        .query("clusterMembers")
        .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
        .first(),
    ]);

    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.active) throw new Error("Cluster is not active");
    if (!member) throw new Error("Member not found");
    if (!member.active) throw new Error("Member is not active");
    if (existing) throw new Error("Member is already assigned to a cluster");

    return await ctx.db.insert("clusterMembers", {
      clusterId: args.clusterId,
      memberId: args.memberId,
      joinedAt: Date.now(),
      addedBy: identity.subject,
    });
  },
});

/** Add multiple members to cluster */
export const addMembers = mutation({
  args: {
    clusterId: v.id("clusters"),
    memberIds: v.array(v.id("members")),
  },
  returns: v.object({
    added: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.active) throw new Error("Cluster is not active");

    const errors: string[] = [];
    let added = 0;

    for (const memberId of args.memberIds) {
      try {
        const [member, existing] = await Promise.all([
          ctx.db.get(memberId),
          ctx.db
            .query("clusterMembers")
            .withIndex("by_member", (q) => q.eq("memberId", memberId))
            .first(),
        ]);

        if (!member) {
          errors.push(`Member ${memberId} not found`);
          continue;
        }
        if (!member.active) {
          errors.push(`Member ${member.name} is not active`);
          continue;
        }
        if (existing) {
          errors.push(`Member ${member.name} is already assigned to a cluster`);
          continue;
        }

        await ctx.db.insert("clusterMembers", {
          clusterId: args.clusterId,
          memberId,
          joinedAt: Date.now(),
          addedBy: identity.subject,
        });
        added++;
      } catch (e) {
        errors.push(`Error adding member ${memberId}: ${e}`);
      }
    }

    return { added, errors };
  },
});

/** Remove member from cluster */
export const removeMember = mutation({
  args: {
    clusterId: v.id("clusters"),
    memberId: v.id("members"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const clusterMember = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster_member", (q) => 
        q.eq("clusterId", args.clusterId).eq("memberId", args.memberId)
      )
      .first();

    if (!clusterMember) throw new Error("Member not found in this cluster");

    await ctx.db.delete(clusterMember._id);
    return null;
  },
});

/** Move member from one cluster to another */
export const moveMember = mutation({
  args: {
    memberId: v.id("members"),
    fromClusterId: v.id("clusters"),
    toClusterId: v.id("clusters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    if (args.fromClusterId === args.toClusterId) {
      throw new Error("Cannot move to the same cluster");
    }

    const [fromCluster, toCluster, clusterMember] = await Promise.all([
      ctx.db.get(args.fromClusterId),
      ctx.db.get(args.toClusterId),
      ctx.db
        .query("clusterMembers")
        .withIndex("by_cluster_member", (q) => 
          q.eq("clusterId", args.fromClusterId).eq("memberId", args.memberId)
        )
        .first(),
    ]);

    if (!fromCluster) throw new Error("Source cluster not found");
    if (!toCluster) throw new Error("Target cluster not found");
    if (!toCluster.active) throw new Error("Target cluster is not active");
    if (!clusterMember) throw new Error("Member not found in source cluster");

    // Check if already in target cluster
    const existingInTarget = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster_member", (q) => 
        q.eq("clusterId", args.toClusterId).eq("memberId", args.memberId)
      )
      .first();

    if (existingInTarget) {
      throw new Error("Member is already in target cluster");
    }

    // Update the record
    await ctx.db.patch(clusterMember._id, {
      clusterId: args.toClusterId,
      addedBy: identity.subject,
    });

    return null;
  },
});

/** Bulk transfer members between clusters */
export const bulkTransfer = mutation({
  args: {
    memberIds: v.array(v.id("members")),
    fromClusterId: v.id("clusters"),
    toClusterId: v.id("clusters"),
  },
  returns: v.object({
    transferred: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    if (args.fromClusterId === args.toClusterId) {
      throw new Error("Cannot transfer to the same cluster");
    }

    const [fromCluster, toCluster] = await Promise.all([
      ctx.db.get(args.fromClusterId),
      ctx.db.get(args.toClusterId),
    ]);

    if (!fromCluster) throw new Error("Source cluster not found");
    if (!toCluster) throw new Error("Target cluster not found");
    if (!toCluster.active) throw new Error("Target cluster is not active");

    const errors: string[] = [];
    let transferred = 0;

    for (const memberId of args.memberIds) {
      try {
        const clusterMember = await ctx.db
          .query("clusterMembers")
          .withIndex("by_cluster_member", (q) => 
            q.eq("clusterId", args.fromClusterId).eq("memberId", memberId)
          )
          .first();

        if (!clusterMember) {
          const member = await ctx.db.get(memberId);
          errors.push(`${member?.name ?? memberId} not found in source cluster`);
          continue;
        }

        const existingInTarget = await ctx.db
          .query("clusterMembers")
          .withIndex("by_cluster_member", (q) => 
            q.eq("clusterId", args.toClusterId).eq("memberId", memberId)
          )
          .first();

        if (existingInTarget) {
          const member = await ctx.db.get(memberId);
          errors.push(`${member?.name ?? memberId} is already in target cluster`);
          continue;
        }

        await ctx.db.patch(clusterMember._id, {
          clusterId: args.toClusterId,
          addedBy: identity.subject,
        });
        transferred++;
      } catch (e) {
        errors.push(`Error transferring ${memberId}: ${e}`);
      }
    }

    return { transferred, errors };
  },
});
