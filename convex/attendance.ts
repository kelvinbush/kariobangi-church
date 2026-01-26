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
  returns: v.array(v.any()),
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
  returns: v.array(v.any()),
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

    const [members, kids, todays, allVisitors] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
      ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    const presentSet = new Set(todays.filter((r) => r.present).map((r) => r.memberId));

    // Get returning visitors (visitors who attended previous Sundays)
    const returningVisitors = await Promise.all(
      allVisitors.map(async (v) => {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", v._id))
          .collect();
        
        const sundayDates = attendance
          .filter((a) => isSunday(a.date))
          .map((a) => a.date)
          .sort()
          .reverse();
        
        // Only include if they've attended at least one previous Sunday (not today)
        const previousSundays = sundayDates.filter((d) => d < args.date);
        if (previousSundays.length === 0) return null;

        const last = attendance.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        
        return {
          memberId: v._id,
          name: v.name,
          contact: v.contact,
          residence: v.residence,
          relationshipStatus: v.relationshipStatus,
          previousChurch: v.previousChurch,
          age: v.age,
          type: "returningVisitor" as const,
          presentToday: presentSet.has(v._id),
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
          sundayCount: previousSundays.length,
        };
      })
    );

    const all = [
      ...members.map((m) => ({ ...m, type: "member" as const })),
      ...kids.map((k) => ({ ...k, type: "kid" as const })),
      ...returningVisitors.filter((v) => v !== null),
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
          relationshipStatus: m.type === "returningVisitor" ? (m as any).relationshipStatus : null,
          previousChurch: m.type === "returningVisitor" ? (m as any).previousChurch : null,
          age: m.type === "returningVisitor" ? (m as any).age : null,
          type: m.type,
          presentToday: presentSet.has(m._id),
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
          sundayCount: m.type === "returningVisitor" ? (m as any).sundayCount : undefined,
        };
      })
    );

    return withLast;
  },
});

export const visitorsRosterForDate = query({
  args: { date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [visitors, todays] = await Promise.all([
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

    // For last attendance per visitor
    const withLast = await Promise.all(
      visitors.map(async (v) => {
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", v._id))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        return {
          memberId: v._id,
          name: v.name,
          contact: v.contact,
          residence: v.residence,
          relationshipStatus: v.relationshipStatus,
          previousChurch: v.previousChurch,
          type: "visitor" as const,
          presentToday: presentSet.has(v._id),
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
  returns: v.array(v.any()),
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
          } else if (visitorsForDate.some((v) => v._id === record.memberId)) {
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

// Helper functions for Sunday calculations
function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay() === 0; // 0 = Sunday
}

function getLastSunday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek; // If today is Sunday, return today
  date.setUTCDate(date.getUTCDate() - daysToSubtract);
  
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousSundays(count: number, fromDate?: string): string[] {
  const today = fromDate ? fromDate.split("-").map(Number) : new Date().toISOString().split("T")[0].split("-").map(Number);
  const [year, month, day] = today;
  let date = new Date(Date.UTC(year, month - 1, day));
  
  // Find the most recent Sunday
  const dayOfWeek = date.getUTCDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  date.setUTCDate(date.getUTCDate() - daysToSubtract);
  
  const sundays: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${d}`);
    date.setUTCDate(date.getUTCDate() - 7); // Go back 7 days
  }
  return sundays;
}

// Find returning visitors (visitors from previous Sundays who might return)
export const findReturningVisitors = query({
  args: { 
    date: v.string(),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Get all visitors from previous dates (not today)
    const allVisitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Filter by name/contact if provided
    let filtered = allVisitors;
    if (args.name) {
      const nameLower = args.name.toLowerCase().trim();
      filtered = filtered.filter((v) => 
        v.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(v.name.toLowerCase())
      );
    }
    if (args.contact) {
      const contactClean = args.contact.trim().replace(/\D/g, "");
      filtered = filtered.filter((v) => 
        v.contact && v.contact.replace(/\D/g, "").includes(contactClean)
      );
    }

    // Get attendance history for these visitors
    const withHistory = await Promise.all(
      filtered.map(async (v) => {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", v._id))
          .collect();
        
        const sundayDates = attendance
          .filter((a) => isSunday(a.date))
          .map((a) => a.date)
          .sort()
          .reverse();
        
        return {
          _id: v._id,
          name: v.name,
          contact: v.contact,
          residence: v.residence,
          relationshipStatus: v.relationshipStatus,
          previousChurch: v.previousChurch,
          age: v.age,
          sundayCount: sundayDates.length,
          lastSunday: sundayDates[0] || null,
          allSundays: sundayDates,
        };
      })
    );

    // Only return visitors who have attended at least one Sunday
    return withHistory.filter((v) => v.sundayCount > 0);
  },
});

// Visitor retention over last 4 Sundays
export const visitorRetention = query({
  args: {},
  returns: v.object({
    weeks: v.array(v.object({
      date: v.string(),
      newVisitors: v.number(),
      returningVisitors: v.number(),
      totalVisitors: v.number(),
      uniqueVisitorIds: v.array(v.string()),
    })),
    totalUnique: v.number(),
    visitorsReadyToMerge: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const today = new Date().toISOString().split("T")[0];
    const sundays = getPreviousSundays(4, today);
    
    // Get all visitors and their attendance
    const allVisitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const visitorAttendanceMap = new Map<string, Set<string>>(); // visitorId -> Set of Sunday dates
    
    for (const visitor of allVisitors) {
      const attendance = await ctx.db
        .query("attendance")
        .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
        .collect();
      
      const sundayDates = attendance
        .filter((a) => isSunday(a.date) && a.present)
        .map((a) => a.date);
      
      visitorAttendanceMap.set(visitor._id, new Set(sundayDates));
    }

    // Process each Sunday
    const weeks = await Promise.all(
      sundays.map(async (sundayDate) => {
        // Get visitors who visited on this Sunday
        const visitorsForDate = await ctx.db
          .query("visitors")
          .withIndex("by_date", (q) => q.eq("date", sundayDate))
          .collect();
        
        const visitorIds = new Set(visitorsForDate.map((v) => v._id));
        
        // Check attendance records too
        const attendanceForDate = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", sundayDate))
          .collect();
        
        for (const record of attendanceForDate) {
          if (allVisitors.some((v) => v._id === record.memberId)) {
            visitorIds.add(record.memberId as string);
          }
        }

        // Determine new vs returning
        let newVisitors = 0;
        let returningVisitors = 0;
        
        for (const visitorId of visitorIds) {
          const previousSundays = sundays.filter((d) => d < sundayDate);
          const hasPreviousAttendance = previousSundays.some((d) => 
            visitorAttendanceMap.get(visitorId)?.has(d)
          );
          
          if (hasPreviousAttendance) {
            returningVisitors++;
          } else {
            newVisitors++;
          }
        }

        return {
          date: sundayDate,
          newVisitors,
          returningVisitors,
          totalVisitors: visitorIds.size,
          uniqueVisitorIds: Array.from(visitorIds),
        };
      })
    );

    // Find visitors ready to merge (attended 4+ Sundays)
    const visitorsReadyToMerge = Array.from(visitorAttendanceMap.entries())
      .filter(([_, sundays]) => sundays.size >= 4)
      .map(([visitorId, sundays]) => {
        const visitor = allVisitors.find((v) => v._id === visitorId);
        if (!visitor) return null;
        return {
          _id: visitor._id,
          name: visitor.name,
          contact: visitor.contact,
          residence: visitor.residence,
          relationshipStatus: visitor.relationshipStatus,
          previousChurch: visitor.previousChurch,
          age: visitor.age,
          sundayCount: sundays.size,
          lastSunday: Array.from(sundays).sort().reverse()[0],
        };
      })
      .filter((v) => v !== null);

    // Calculate total unique visitors across all 4 weeks
    const allUniqueVisitorIds = new Set<string>();
    weeks.forEach((week) => {
      week.uniqueVisitorIds.forEach((id) => allUniqueVisitorIds.add(id));
    });

    return {
      weeks,
      totalUnique: allUniqueVisitorIds.size,
      visitorsReadyToMerge,
    };
  },
});

// Get last Sunday's attendance rate
export const lastSundayAttendanceRate = query({
  args: {},
  returns: v.union(
    v.object({
      date: v.string(),
      rate: v.number(),
      present: v.number(),
      total: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const today = new Date().toISOString().split("T")[0];
    const lastSunday = getLastSunday(today);
    
    // Check if today is Sunday - if so, use today's date
    const targetDate = isSunday(today) ? today : lastSunday;

    const [members, kids, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const memberIds = new Set([...members.map((m) => m._id), ...kids.map((k) => k._id)]);
    const presentSet = new Set(
      attendanceRecords
        .filter((r) => memberIds.has(r.memberId) && r.present)
        .map((r) => r.memberId)
    );

    const total = members.length + kids.length;
    const present = presentSet.size;

    if (total === 0) return null;

    return {
      date: targetDate,
      rate: Math.round((present / total) * 100),
      present,
      total,
    };
  },
});
