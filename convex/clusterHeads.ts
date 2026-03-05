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

function requireAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin") throw new Error("Forbidden: requires admin");
}

function requireClusterAdminOrAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin" && role !== "cluster-admin" && role !== "fellowship-pastor") {
    throw new Error("Forbidden: requires admin or cluster-admin");
  }
}

const clusterHeadValidator = v.object({
  _id: v.id("clusterHeads"),
  _creationTime: v.number(),
  clerkId: v.string(),
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  clusterId: v.union(v.id("clusters"), v.null()),
  active: v.boolean(),
  addedBy: v.string(),
});

/** Returns the current user's cluster head record if they are on the list. */
export const myClusterHead = query({
  args: {},
  returns: v.union(clusterHeadValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("clusterHeads")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

/** List all cluster heads (admin or cluster-admin) */
export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("clusterHeads"),
    _creationTime: v.number(),
    clerkId: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    clusterId: v.union(v.id("clusters"), v.null()),
    clusterName: v.union(v.string(), v.null()),
    active: v.boolean(),
    addedBy: v.string(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    let heads = await ctx.db
      .query("clusterHeads")
      .withIndex("by_active", (q) => 
        args.activeOnly === true ? q.eq("active", true) : q
      )
      .order("asc")
      .collect();

    const result = [];
    for (const head of heads) {
      const cluster = head.clusterId ? await ctx.db.get(head.clusterId) : null;
      result.push({
        ...head,
        clusterName: cluster?.name ?? null,
      });
    }
    return result;
  },
});

/** Add a new cluster head (admin only) */
export const add = mutation({
  args: {
    clerkId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    clusterId: v.optional(v.id("clusters")),
  },
  returns: v.id("clusterHeads"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    // Check if already exists
    const existing = await ctx.db
      .query("clusterHeads")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      throw new Error("This user is already a cluster head");
    }

    // If cluster specified, update the cluster's leader
    if (args.clusterId) {
      const cluster = await ctx.db.get(args.clusterId);
      if (!cluster) throw new Error("Cluster not found");
      if (cluster.leaderClerkId) {
        throw new Error("Cluster already has a leader assigned");
      }
      await ctx.db.patch(args.clusterId, {
        leaderClerkId: args.clerkId,
        updatedAt: Date.now(),
      });
    }

    return await ctx.db.insert("clusterHeads", {
      clerkId: args.clerkId.trim(),
      displayName: args.displayName.trim(),
      email: args.email?.trim() ?? null,
      clusterId: args.clusterId ?? null,
      active: true,
      addedBy: identity.subject,
    });
  },
});

/** Update cluster head details (admin only) */
export const update = mutation({
  args: {
    id: v.id("clusterHeads"),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    clusterId: v.optional(v.id("clusters")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const head = await ctx.db.get(args.id);
    if (!head) throw new Error("Cluster head not found");

    const updates: { displayName?: string; email?: string | null; clusterId?: Id<"clusters"> | null } = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName.trim();
    if (args.email !== undefined) updates.email = args.email?.trim() ?? null;
    
    // Handle cluster assignment change
    if (args.clusterId !== undefined && args.clusterId !== head.clusterId) {
      // Remove from old cluster
      if (head.clusterId) {
        await ctx.db.patch(head.clusterId, {
          leaderClerkId: null,
          updatedAt: Date.now(),
        });
      }
      // Add to new cluster
      if (args.clusterId) {
        const cluster = await ctx.db.get(args.clusterId);
        if (!cluster) throw new Error("Cluster not found");
        if (cluster.leaderClerkId) {
          throw new Error("Cluster already has a leader assigned");
        }
        await ctx.db.patch(args.clusterId, {
          leaderClerkId: head.clerkId,
          updatedAt: Date.now(),
        });
      }
      updates.clusterId = args.clusterId ?? null;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }
    return null;
  },
});

/** Archive (deactivate) a cluster head (admin or cluster-admin) */
export const archive = mutation({
  args: {
    id: v.id("clusterHeads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const head = await ctx.db.get(args.id);
    if (!head) throw new Error("Cluster head not found");

    // Remove from cluster if assigned
    if (head.clusterId) {
      await ctx.db.patch(head.clusterId, {
        leaderClerkId: null,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.id, { active: false });
    return null;
  },
});

/** Reactivate a cluster head (admin or cluster-admin) */
export const reactivate = mutation({
  args: {
    id: v.id("clusterHeads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const head = await ctx.db.get(args.id);
    if (!head) throw new Error("Cluster head not found");

    await ctx.db.patch(args.id, { active: true });
    return null;
  },
});

/** Remove cluster head permanently (admin only) */
export const remove = mutation({
  args: {
    id: v.id("clusterHeads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const head = await ctx.db.get(args.id);
    if (!head) throw new Error("Cluster head not found");

    // Remove from cluster if assigned
    if (head.clusterId) {
      await ctx.db.patch(head.clusterId, {
        leaderClerkId: null,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
