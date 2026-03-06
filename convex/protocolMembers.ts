import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isFollowUpAdmin } from "./authHelpers";

function requireFollowUpAdminOrAdmin(identity: any) {
  if (!isFollowUpAdmin(identity)) {
    throw new Error("Forbidden: requires admin or follow-up-admin");
  }
}

const protocolMemberValidator = v.object({
  _id: v.id("protocolMembers"),
  _creationTime: v.number(),
  clerkId: v.string(),
  displayName: v.string(),
  active: v.boolean(),
  addedBy: v.string(),
});

/** Returns the current user's protocol member record if they are on the list. */
export const myProtocolMember = query({
  args: {},
  returns: v.union(protocolMemberValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("protocolMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(protocolMemberValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    if (args.activeOnly === true) {
      return await ctx.db
        .query("protocolMembers")
        .withIndex("by_active", (q) => q.eq("active", true))
        .order("asc")
        .collect();
    }
    return await ctx.db.query("protocolMembers").order("asc").collect();
  },
});

export const add = mutation({
  args: {
    clerkId: v.string(),
    displayName: v.string(),
  },
  returns: v.id("protocolMembers"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const existing = await ctx.db
      .query("protocolMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (existing) throw new Error("This user is already a protocol member");

    return await ctx.db.insert("protocolMembers", {
      clerkId: args.clerkId.trim(),
      displayName: args.displayName.trim(),
      active: true,
      addedBy: identity.subject,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("protocolMembers"),
    displayName: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Protocol member not found");

    const updates: { displayName?: string; active?: boolean } = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName.trim();
    if (args.active !== undefined) updates.active = args.active;
    if (Object.keys(updates).length === 0) return null;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("protocolMembers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Protocol member not found");

    await ctx.db.delete(args.id);
    return null;
  },
});
