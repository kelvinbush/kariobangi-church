import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserRoles, isProtocolTeam } from "./authHelpers";

export const list = query({
  args: {
    active: v.optional(v.boolean()),
    date: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Only protocol team can view visitors
    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team access");
    }

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
    
    // Only protocol team can add visitors
    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team access");
    }

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
    
    // Only protocol team can add visitors
    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team access");
    }

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
    
    // Only protocol team can update visitors
    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team access");
    }

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

    // Only admin or follow-up-admin can remove visitors
    const userRoles = getUserRoles(identity);
    if (!userRoles.includes("admin") && !userRoles.includes("follow-up-admin")) {
      throw new Error("Forbidden: requires admin or follow-up-admin role");
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

// Get all visitors with their attendance counts (for admin)
export const listWithAttendance = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Only admin can access this
    const userRoles = getUserRoles(identity);
    if (!userRoles.includes("admin")) {
      throw new Error("Forbidden: requires admin role");
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Get attendance counts for each visitor
    const visitorsWithCounts = await Promise.all(
      visitors.map(async (visitor) => {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
          .collect();

        const sundayAttendance = attendance.filter(
          (a) => a.present && isSunday(a.date)
        );

        return {
          ...visitor,
          attendanceCount: sundayAttendance.length,
          isReturning: sundayAttendance.length >= 4,
          lastVisit: sundayAttendance.sort((a, b) =>
            a.date < b.date ? 1 : a.date > b.date ? -1 : 0
          )[0]?.date || null,
        };
      })
    );

    // Sort by attendance count descending, then by name
    return visitorsWithCounts.sort((a, b) => {
      if (b.attendanceCount !== a.attendanceCount) {
        return b.attendanceCount - a.attendanceCount;
      }
      return a.name.localeCompare(b.name);
    });
  },
});

// Graduate a visitor to become a member
export const graduateToMember = mutation({
  args: {
    visitorId: v.id("visitors"),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.id("members"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Only admin can graduate visitors
    const userRoles = getUserRoles(identity);
    if (!userRoles.includes("admin")) {
      throw new Error("Forbidden: requires admin role");
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    // Create new member from visitor data
    const memberId = await ctx.db.insert("members", {
      name: visitor.name,
      contact: visitor.contact,
      gender: null, // Can be updated later
      residence: visitor.residence,
      department: args.department || null,
      status: args.status || null,
      active: true,
      createdBy: identity.subject,
    });

    // Mark visitor as inactive (graduated)
    await ctx.db.patch(args.visitorId, { active: false });

    return memberId;
  },
});

// Helper function for Sunday check
function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay() === 0;
}
