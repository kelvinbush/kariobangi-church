import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function isAdminIdentity(identity: any): boolean {
  return getRoleFromIdentity(identity) === "admin";
}

function getRoleFromIdentity(identity: any): string | undefined {
  // Check top-level role first (from JWT template)
  if (identity?.role) return identity.role;
  // Fallback to other possible locations
  return (
    identity?.publicMetadata?.role ??
    identity?.public_metadata?.role ??
    identity?.claims?.role ??
    identity?.claims?.publicMetadata?.role ??
    identity?.claims?.public_metadata?.role ??
    identity?.customClaims?.role ??
    identity?.customClaims?.publicMetadata?.role ??
    identity?.customClaims?.public_metadata?.role
  );
}

export const list = query({
  args: {
    active: v.optional(v.boolean()),
    date: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.date) {
      return await ctx.db
        .query("visitors")
        .withIndex("by_date", (q) => q.eq("date", args.date!))
        .collect();
    }
    
    if (args.active === true) {
      return await ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    } else if (args.active === false) {
      return await ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", false))
        .collect();
    }
    
    return await ctx.db.query("visitors").collect();
  },
});

export const quickAdd = mutation({
  args: {
    name: v.string(),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    relationshipStatus: v.optional(v.string()),
    previousChurch: v.optional(v.string()),
    age: v.optional(v.number()),
    date: v.string(),
  },
  returns: v.id("visitors"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    function toNull(s: string | undefined): string | null {
      if (s === undefined) return null;
      const t = s.trim();
      if (t === '' || t === '-' || t.toLowerCase() === 'n/a') return null;
      return t;
    }

    const id = await ctx.db.insert('visitors', {
      name: args.name.trim(),
      contact: toNull(args.contact),
      residence: toNull(args.residence),
      relationshipStatus: toNull(args.relationshipStatus),
      previousChurch: toNull(args.previousChurch),
      ...(args.age !== undefined ? { age: args.age } : {}),
      date: args.date,
      active: true,
      createdBy: identity.subject,
    });
    return id;
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    contact: v.string(),
    residence: v.string(),
    relationshipStatus: v.string(),
    previousChurch: v.string(),
    age: v.optional(v.number()),
    date: v.string(),
    active: v.optional(v.boolean()),
  },
  returns: v.id("visitors"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const doc = {
      name: args.name.trim(),
      contact: args.contact.trim(),
      residence: args.residence.trim(),
      relationshipStatus: args.relationshipStatus.trim(),
      previousChurch: args.previousChurch.trim(),
      ...(args.age !== undefined ? { age: args.age } : {}),
      date: args.date,
      active: args.active ?? true,
      createdBy: identity.subject,
    };
    const id = await ctx.db.insert("visitors", doc);
    return id;
  },
});

export const update = mutation({
  args: {
    visitorId: v.id("visitors"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    relationshipStatus: v.optional(v.string()),
    previousChurch: v.optional(v.string()),
    age: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    await ctx.db.patch(args.visitorId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.contact !== undefined ? { contact: args.contact } : {}),
      ...(args.residence !== undefined ? { residence: args.residence } : {}),
      ...(args.relationshipStatus !== undefined ? { relationshipStatus: args.relationshipStatus } : {}),
      ...(args.previousChurch !== undefined ? { previousChurch: args.previousChurch } : {}),
      ...(args.age !== undefined ? { age: args.age } : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
    });
    return null;
  },
});

export const remove = mutation({
  args: { visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isAdminIdentity(identity as any)) {
      const role = getRoleFromIdentity(identity as any);
      throw new Error(`Forbidden (role=${role ?? "undefined"}). Configure Clerk JWT template 'convex' to include role.`);
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    const attendanceRows = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.visitorId as any))
      .collect();
    for (const row of attendanceRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.visitorId);
    return null;
  },
});
