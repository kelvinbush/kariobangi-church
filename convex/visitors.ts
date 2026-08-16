import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isProtocolTeam, requireAdmin } from "./authHelpers";
import { isSunday, todayISO } from "./pipelineHelpers";

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
    gender: v.optional(v.string()),
    visitType: v.optional(v.string()),
    fromOtherChurch: v.optional(v.boolean()),
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
      gender: toNull(args.gender),
      residence: toNull(args.residence),
      relationshipStatus: toNull(args.relationshipStatus),
      previousChurch: toNull(args.previousChurch),
      ...(args.age !== undefined ? { age: args.age } : {}),
      ...(args.fromOtherChurch !== undefined ? { fromOtherChurch: args.fromOtherChurch } : {}),
      date: args.date,
      active: true,
      createdBy: identity.subject,
      // Pipeline fields
      pipelineStage: "new",
      visitType: args.visitType || "regular",
      lastAttendanceDate: args.date,
      sundayCount: isSunday(args.date) ? 1 : 0,
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
    gender: v.optional(v.string()),
    visitType: v.optional(v.string()),
    fromOtherChurch: v.optional(v.boolean()),
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
      gender: args.gender?.trim() || null,
      residence: args.residence.trim(),
      relationshipStatus: args.relationshipStatus.trim(),
      previousChurch: args.previousChurch.trim(),
      ...(args.age !== undefined ? { age: args.age } : {}),
      ...(args.fromOtherChurch !== undefined ? { fromOtherChurch: args.fromOtherChurch } : {}),
      date: args.date,
      active: args.active ?? true,
      createdBy: identity.subject,
      // Pipeline fields
      pipelineStage: "new" as const,
      visitType: args.visitType || "regular",
      lastAttendanceDate: args.date,
      sundayCount: isSunday(args.date) ? 1 : 0,
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
    gender: v.optional(v.string()),
    visitType: v.optional(v.string()),
    fromOtherChurch: v.optional(v.boolean()),
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
      ...(args.gender !== undefined ? { gender: args.gender } : {}),
      ...(args.visitType !== undefined ? { visitType: args.visitType } : {}),
      ...(args.fromOtherChurch !== undefined ? { fromOtherChurch: args.fromOtherChurch } : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
    });
    return null;
  },
});

// Admin-only. Cascades to the visitor's attendance records.
export const remove = mutation({
  args: { visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Only admins can remove visitors.
    requireAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    // Delete attendance records
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

/** Delete several visitors at once, cascading their attendance records. Admin only. */
export const bulkRemove = mutation({
  args: { visitorIds: v.array(v.id("visitors")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    requireAdmin(identity as any);

    let deleted = 0;
    for (const visitorId of args.visitorIds) {
      const visitor = await ctx.db.get(visitorId);
      if (!visitor) continue;

      const attendanceRows = await ctx.db
        .query("attendance")
        .withIndex("by_member_date", (q) => q.eq("memberId", visitorId as any))
        .collect();
      for (const row of attendanceRows) {
        await ctx.db.delete(row._id);
      }

      await ctx.db.delete(visitorId);
      deleted++;
    }
    return deleted;
  },
});

// Graduate a visitor to become a member. Migrates their attendance records.
export const graduateToMember = mutation({
  args: {
    visitorId: v.id("visitors"),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
    gender: v.optional(v.string()),
    graduationDate: v.optional(v.string()),
  },
  returns: v.id("members"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Only admin can graduate visitors
    requireAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    const gradDate = args.graduationDate || todayISO();

    // Create new member from visitor data
    const memberId = await ctx.db.insert("members", {
      name: visitor.name,
      contact: visitor.contact,
      gender: args.gender || visitor.gender || null,
      residence: visitor.residence,
      department: args.department || null,
      status: args.status || null,
      active: true,
      createdBy: identity.subject,
      graduationDate: gradDate,
    });

    // FIX: Migrate attendance records from visitor ID to new member ID
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.visitorId as any))
      .collect();
    for (const record of attendanceRecords) {
      // Create new attendance record under member ID
      await ctx.db.insert("attendance", {
        memberId: memberId,
        date: record.date,
        present: record.present,
        markedBy: record.markedBy,
        ...(record.arrivalTime ? { arrivalTime: record.arrivalTime } : {}),
      });
      // Delete old visitor attendance record
      await ctx.db.delete(record._id);
    }

    // Mark visitor as inactive (graduated) with pipeline stage
    await ctx.db.patch(args.visitorId, {
      active: false,
      pipelineStage: "graduated",
      graduationDate: gradDate,
    });

    return memberId;
  },
});

export const graduateToKid = mutation({
  args: {
    visitorId: v.id("visitors"),
    age: v.optional(v.number()),
    graduationDate: v.optional(v.string()),
  },
  returns: v.id("kids"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    requireAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    const gradDate = args.graduationDate || todayISO();

    // Create new kid from visitor data
    const kidId = await ctx.db.insert("kids", {
      name: visitor.name,
      contact: visitor.contact,
      residence: visitor.residence,
      age: args.age ?? undefined,
      active: true,
      createdBy: identity.subject,
      graduationDate: gradDate,
    });

    // Migrate attendance records from visitor ID to new kid ID
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.visitorId as any))
      .collect();
    for (const record of attendanceRecords) {
      await ctx.db.insert("attendance", {
        memberId: kidId,
        date: record.date,
        present: record.present,
        markedBy: record.markedBy,
        ...(record.arrivalTime ? { arrivalTime: record.arrivalTime } : {}),
      });
      await ctx.db.delete(record._id);
    }

    // Mark visitor as inactive (graduated)
    await ctx.db.patch(args.visitorId, {
      active: false,
      pipelineStage: "graduated",
      graduationDate: gradDate,
      relationshipStatus: "child",
    });

    return kidId;
  },
});
