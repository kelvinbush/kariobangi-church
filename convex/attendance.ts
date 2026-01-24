import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const markPresent = mutation({
  args: {
    memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")),
    date: v.string(), // ISO date string e.g. 2026-01-10
  },
  returns: v.union(v.id("attendance"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { present: true, markedBy: identity.subject });
      return existing._id;
    }

    return await ctx.db.insert("attendance", {
      memberId: args.memberId,
      date: args.date,
      present: true,
      markedBy: identity.subject,
    });
  },
});

export const unmarkPresent = mutation({
  args: {
    memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")),
    date: v.string(),
  },
  returns: v.union(v.id("attendance"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { present: false, markedBy: identity.subject });
      return existing._id;
    }

    // No existing record; do nothing (or create an explicit absent record if desired)
    return null;
  },
});

export const attendanceByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const statusForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const presentSet = new Set(records.filter((r) => r.present).map((r) => r.memberId));

    const [members, kids] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    const all = [...members, ...kids];
    return all.map((m) => ({ memberId: m._id, present: presentSet.has(m._id) }));
  },
});

export const historyForMember = query({
  args: { memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
      .collect();

    // Sort by date descending (assuming ISO date string)
    return records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },
});

export const rosterForDate = query({
  args: { date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [members, kids, visitors, todays] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("visitors")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
    ]);

    const presentSet = new Set(todays.filter((r) => r.present).map((r) => r.memberId));

    const all = [
      ...members.map((m) => ({ ...m, type: "member" as const })),
      ...kids.map((k) => ({ ...k, type: "kid" as const })),
      ...visitors.map((v) => ({ ...v, type: "visitor" as const })),
    ];

    // For last attendance per member, query per member (acceptable for current scale)
    const withLast = await Promise.all(
      all.map(async (m) => {
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", m._id))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        return {
          memberId: m._id,
          name: m.name,
          contact: m.contact,
          residence: m.residence,
          gender: m.type === "member" ? m.gender : null,
          department: m.type === "member" ? (m as any).department : null,
          status: m.type === "member" ? (m as any).status : null,
          relationshipStatus: m.type === "visitor" ? (m as any).relationshipStatus : null,
          previousChurch: m.type === "visitor" ? (m as any).previousChurch : null,
          type: m.type,
          presentToday: presentSet.has(m._id),
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
        };
      })
    );

    return withLast;
  },
});

export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(50, args.limit ?? 10));
    const records = await ctx.db.query("attendance").order("desc").take(limit);

    const result = await Promise.all(
      records.map(async (r) => {
        const m = await ctx.db.get(r.memberId);
        return {
          _id: r._id,
          date: r.date,
          present: r.present,
          memberId: r.memberId,
          memberName: m?.name ?? "Unknown",
          createdAt: r._creationTime,
        };
      })
    );
    return result;
  },
});

export const summaries = query({
  args: {},
  returns: v.object({
    totalMen: v.number(),
    totalWomen: v.number(),
    totalKids: v.number(),
    totalYouths: v.number(),
    totalVisitors: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [members, kids, visitors] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    const totalMen = members.filter((m) => (m.gender ?? "").toLowerCase() === "male").length;
    const totalWomen = members.filter((m) => (m.gender ?? "").toLowerCase() === "female").length;
    const totalKids = kids.length;
    // Youths are typically identified by status field - adjust based on your data
    const totalYouths = members.filter((m) => 
      (m.status ?? "").toLowerCase().includes("youth") || 
      (m.status ?? "").toLowerCase().includes("young")
    ).length;
    const totalVisitors = visitors.length;

    return {
      totalMen,
      totalWomen,
      totalKids,
      totalYouths,
      totalVisitors,
    };
  },
});

export const attendanceTrends = query({
  args: { days: v.optional(v.number()) },
  returns: v.array(v.object({
    date: v.string(),
    members: v.number(),
    kids: v.number(),
    visitors: v.number(),
    total: v.number(),
    present: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const days = args.days ?? 7;
    const today = new Date();
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }

    const trends = await Promise.all(
      dates.map(async (date) => {
        const [attendanceRecords, visitorsForDate] = await Promise.all([
          ctx.db
            .query("attendance")
            .withIndex("by_date", (q) => q.eq("date", date))
            .collect(),
          ctx.db
            .query("visitors")
            .withIndex("by_date", (q) => q.eq("date", date))
            .collect(),
        ]);

        const presentSet = new Set(attendanceRecords.filter((r) => r.present).map((r) => r.memberId));
        
        // Get all members and kids
        const [allMembers, allKids] = await Promise.all([
          ctx.db
            .query("members")
            .withIndex("by_active", (q) => q.eq("active", true))
            .collect(),
          ctx.db
            .query("kids")
            .withIndex("by_active", (q) => q.eq("active", true))
            .collect(),
        ]);

        const memberIds = new Set([...allMembers.map((m) => m._id), ...allKids.map((k) => k._id)]);
        const visitorIds = new Set(visitorsForDate.map((v) => v._id));
        
        // Count present by type
        let presentMembers = 0;
        let presentKids = 0;
        let presentVisitors = 0;
        
        for (const record of attendanceRecords) {
          if (!presentSet.has(record.memberId)) continue;
          
          if (allKids.some((k) => k._id === record.memberId)) {
            presentKids++;
          } else if (allMembers.some((m) => m._id === record.memberId)) {
            presentMembers++;
          } else if (visitorIds.has(record.memberId)) {
            presentVisitors++;
          }
        }

        // Also count visitors that were added on this date (they're automatically present)
        const newVisitorsCount = visitorsForDate.length;
        presentVisitors += newVisitorsCount;

        return {
          date,
          members: presentMembers,
          kids: presentKids,
          visitors: presentVisitors,
          total: allMembers.length + allKids.length + visitorsForDate.length,
          present: presentMembers + presentKids + presentVisitors,
        };
      })
    );

    return trends;
  },
});

export const recentRollCalls = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(60, args.limit ?? 20));

    // Convex doesn't provide a native group-by; we build a small list of unique
    // dates from recent attendance rows, then compute per-date counts.
    const seed = await ctx.db.query("attendance").order("desc").take(2000);
    const uniqueDates: string[] = [];
    const seen = new Set<string>();
    for (const r of seed) {
      if (seen.has(r.date)) continue;
      seen.add(r.date);
      uniqueDates.push(r.date);
      if (uniqueDates.length >= limit) break;
    }

    const summaries = await Promise.all(
      uniqueDates.map(async (date) => {
        const rows = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();
        const total = rows.length;
        const present = rows.filter((r) => r.present).length;
        return { date, total, present, absent: Math.max(0, total - present) };
      })
    );

    // ISO date strings sort lexicographically.
    summaries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return summaries;
  },
});
