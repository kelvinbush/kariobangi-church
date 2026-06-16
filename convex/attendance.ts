import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isProtocolTeam, canMarkAttendance } from "./authHelpers";

export const markPresent = mutation({
  args: {
    memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")),
    date: v.string(), // ISO date string e.g. 2026-01-10
    arrivalTime: v.optional(v.string()), // HH:MM format
  },
  returns: v.union(v.id("attendance"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    if (!canMarkAttendance(identity)) {
      throw new Error("Forbidden: requires protocol, cluster-head, or admin access");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Activate if inactive/dormant/dropped
    if ('active' in member && !member.active) {
      await ctx.db.patch(args.memberId, { active: true } as any);
    }
    if ('pipelineStage' in member && (member.pipelineStage === "dormant" || member.pipelineStage === "dropped")) {
      await ctx.db.patch(args.memberId, { active: true, pipelineStage: "new" } as any);
    }

    // Get current time if not provided (Kenya timezone UTC+3)
    const getKenyaTime = () => {
      const now = new Date();
      // Add 3 hours for Kenya timezone (UTC+3)
      const kenyaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      return kenyaTime.toISOString().slice(11, 16); // Extract HH:MM
    };
    const arrivalTime = args.arrivalTime || getKenyaTime();

    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { 
        present: true, 
        markedBy: identity.subject,
        arrivalTime,
      });

      // Update visitor pipeline tracking if this is a visitor on a Sunday
      if (isSunday(args.date)) {
        try {
          const visitor = await ctx.db.get(args.memberId as any);
          if (visitor && 'pipelineStage' in visitor) {
            // Recount Sunday attendance for accuracy
            const allAttendance = await ctx.db
              .query("attendance")
              .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
              .collect();
            const sundayCount = allAttendance.filter((a) => a.present && isSunday(a.date)).length + (existing.present ? 0 : 1);
            await ctx.db.patch(args.memberId as any, {
              sundayCount,
              lastAttendanceDate: args.date,
            });
          }
        } catch { /* memberId is not a visitor, skip */ }
      }

      return existing._id;
    }

    const id = await ctx.db.insert("attendance", {
      memberId: args.memberId,
      date: args.date,
      present: true,
      markedBy: identity.subject,
      arrivalTime,
    });

    // Update visitor pipeline tracking if this is a visitor on a Sunday
    if (isSunday(args.date)) {
      try {
        const visitor = await ctx.db.get(args.memberId as any);
        if (visitor && 'pipelineStage' in visitor) {
          const allAttendance = await ctx.db
            .query("attendance")
            .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
            .collect();
          const sundayCount = allAttendance.filter((a) => a.present && isSunday(a.date)).length;
          await ctx.db.patch(args.memberId as any, {
            sundayCount,
            lastAttendanceDate: args.date,
          });
        }
      } catch { /* memberId is not a visitor, skip */ }
    }

    return id;
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
    
    if (!canMarkAttendance(identity)) {
      throw new Error("Forbidden: requires protocol, cluster-head, or admin access");
    }

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

/** Get attendance status for a specific member and date */
export const getMemberStatus = query({
  args: {
    memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")),
    date: v.string(),
  },
  returns: v.union(v.object({
    present: v.boolean(),
    markedBy: v.union(v.string(), v.null()),
  }), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const record = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => 
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (!record) return null;
    
    return {
      present: record.present,
      markedBy: record.markedBy,
    };
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
        .collect(),
      ctx.db
        .query("kids")
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
      ctx.db
        .query("visitors")
        .collect(),
    ]);

    const presentSet = new Set(todays.filter((r) => r.present).map((r) => r.memberId));

    // Filter out graduated visitors — they are now members. Keep dormant/dropped/inactive ones so they are searchable.
    const pipelineVisitors = allVisitors.filter((v) => {
      const stage = (v as any).pipelineStage || "new";
      return stage !== "graduated";
    });

    // Get returning visitors (visitors who attended previous Sundays)
    const returningVisitors = await Promise.all(
      pipelineVisitors.map(async (v) => {
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

        const firstSunday = previousSundays[previousSundays.length - 1]; // earliest Sunday they attended
        const last = attendance.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        
        return {
          _id: v._id,
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
          firstSunday,
        };
      })
    );

    const all = [
      ...members.map((m) => ({ ...m, type: "member" as const })),
      ...kids.map((k) => ({ ...k, type: "kid" as const })),
      ...returningVisitors.filter((v) => v !== null),
    ];

    // Get today's attendance records with arrival times
    const todayRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    
    const arrivalTimeMap = new Map();
    todayRecords.forEach((r) => {
      if (r.present && r.arrivalTime) {
        arrivalTimeMap.set(r.memberId, r.arrivalTime);
      }
    });

    // For last attendance per member, query per member (acceptable for current scale)
    const withLast = await Promise.all(
      all.map(async (m) => {
        // Handle both _id (members/kids) and memberId (returning visitors)
        const memberId = (m as any)._id || (m as any).memberId;
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", memberId))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        const lastPresentRecord = last.find((a) => a.present);
        const isPresentToday = presentSet.has(memberId);

        // Fetch cluster information for members only
        let clusterName = null;
        let clusterLeader = null;
        if (m.type === "member") {
          const membership = await ctx.db
            .query("clusterMembers")
            .withIndex("by_member", (q) => q.eq("memberId", memberId))
            .first();
          if (membership) {
            const cluster = await ctx.db.get(membership.clusterId);
            if (cluster && cluster.active) {
              clusterName = cluster.name;
              if (cluster.leaderClerkId) {
                const head = await ctx.db
                  .query("clusterHeads")
                  .withIndex("by_clerkId", (q) => q.eq("clerkId", cluster.leaderClerkId!))
                  .first();
                clusterLeader = head?.displayName ?? null;
              }
              if (!clusterLeader && cluster.leaderMemberId) {
                const headMem = await ctx.db.get(cluster.leaderMemberId);
                clusterLeader = headMem?.name ?? null;
              }
            }
          }
        }

        return {
          memberId: memberId,
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
          presentToday: isPresentToday,
          arrivalTime: isPresentToday ? arrivalTimeMap.get(memberId) : null,
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
          lastSeenDate: lastPresentRecord?.date || null,
          sundayCount: m.type === "returningVisitor" ? (m as any).sundayCount : undefined,
          firstSunday: m.type === "returningVisitor" ? (m as any).firstSunday : undefined,
          clusterName,
          clusterLeader,
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

    const arrivalTimeMap = new Map();
    todays.forEach((r) => {
      if (r.present && r.arrivalTime) {
        arrivalTimeMap.set(r.memberId, r.arrivalTime);
      }
    });

    // For last attendance per visitor
    const withLast = await Promise.all(
      visitors.map(async (v) => {
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", v._id))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        const isPresentToday = presentSet.has(v._id);
        return {
          memberId: v._id,
          name: v.name,
          contact: v.contact,
          residence: v.residence,
          relationshipStatus: v.relationshipStatus,
          previousChurch: v.previousChurch,
          type: "visitor" as const,
          presentToday: isPresentToday,
          arrivalTime: isPresentToday ? arrivalTimeMap.get(v._id) : null,
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

        // FIX: Count visitors present from attendance records ONLY
        // (previously also added visitorsForDate.length causing double-counting)
        // New visitors who were added today but have attendance records are already counted above
        const newVisitorsWithoutAttendance = visitorsForDate.filter(
          (v) => !attendanceRecords.some((r) => r.memberId === v._id)
        ).length;
        presentVisitors += newVisitorsWithoutAttendance;

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
          const visitor = allVisitors.find((v) => v._id === record.memberId);
          if (visitor) {
            visitorIds.add(record.memberId as any);
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
// Get youth summaries by gender
export const youthSummaries = query({
  args: {},
  returns: v.object({
    totalMaleYouth: v.number(),
    totalFemaleYouth: v.number(),
    activeMaleYouth: v.number(),
    activeFemaleYouth: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const maleYouth = members.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const isMale = (m.gender ?? "").toLowerCase() === "male";
      return isYouth && isMale;
    });

    const femaleYouth = members.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const isFemale = (m.gender ?? "").toLowerCase() === "female";
      return isYouth && isFemale;
    });

    return {
      totalMaleYouth: maleYouth.length,
      totalFemaleYouth: femaleYouth.length,
      activeMaleYouth: maleYouth.filter((m) => m.active).length,
      activeFemaleYouth: femaleYouth.filter((m) => m.active).length,
    };
  },
});

// Get youth members list with attendance info
export const youthRoster = query({
  args: { 
    gender: v.string(), // "male" or "female"
    date: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const targetDate = args.date || new Date().toISOString().split("T")[0];

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const presentSet = new Set(attendanceRecords.filter((r) => r.present).map((r) => r.memberId));

    const youthMembers = members.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isYouth && matchesGender;
    });

    // Get last attendance for each youth member
    const withLast = await Promise.all(
      youthMembers.map(async (m) => {
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
          gender: m.gender,
          department: m.department,
          status: m.status,
          active: m.active,
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

// Get attendance history for youth by date
export const youthAttendanceByDate = query({
  args: { 
    gender: v.string(),
    date: v.string(),
  },
  returns: v.object({
    date: v.string(),
    total: v.number(),
    present: v.number(),
    absent: v.number(),
    members: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
    ]);

    const presentSet = new Set(attendanceRecords.filter((r) => r.present).map((r) => r.memberId));

    const youthMembers = members.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isYouth && matchesGender;
    });

    const membersWithStatus = youthMembers.map((m) => ({
      memberId: m._id,
      name: m.name,
      contact: m.contact,
      residence: m.residence,
      gender: m.gender,
      department: m.department,
      status: m.status,
      present: presentSet.has(m._id),
    }));

    const present = membersWithStatus.filter((m) => m.present).length;

    return {
      date: args.date,
      total: youthMembers.length,
      present,
      absent: Math.max(0, youthMembers.length - present),
      members: membersWithStatus,
    };
  },
});

// Get youth attendance trends over time
export const youthAttendanceTrends = query({
  args: { 
    gender: v.string(),
    days: v.optional(v.number()),
  },
  returns: v.array(v.object({
    date: v.string(),
    total: v.number(),
    present: v.number(),
    rate: v.number(),
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

    // Get all youth members of the specified gender
    const allMembers = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const youthMembers = allMembers.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isYouth && matchesGender;
    });

    const youthMemberIds = new Set(youthMembers.map((m) => m._id));

    const trends = await Promise.all(
      dates.map(async (date) => {
        const attendanceRecords = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();

        const presentYouth = attendanceRecords.filter(
          (r) => r.present && youthMemberIds.has(r.memberId as any)
        ).length;

        return {
          date,
          total: youthMembers.length,
          present: presentYouth,
          rate: youthMembers.length > 0 ? Math.round((presentYouth / youthMembers.length) * 100) : 0,
        };
      })
    );

    return trends;
  },
});

// Get youth attendance trends for the last N Sundays (not days)
export const youthSundayTrends = query({
  args: { 
    gender: v.string(),
    weeks: v.optional(v.number()),
  },
  returns: v.array(v.object({
    date: v.string(),
    total: v.number(),
    present: v.number(),
    rate: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const weeks = args.weeks ?? 6; // Default to last 6 Sundays
    const today = new Date().toISOString().split("T")[0];
    const sundays = getPreviousSundays(weeks, today);

    // Get all youth members of the specified gender
    const allMembers = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const youthMembers = allMembers.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isYouth && matchesGender;
    });

    const youthMemberIds = new Set(youthMembers.map((m) => m._id));

    const trends = await Promise.all(
      sundays.map(async (date) => {
        const attendanceRecords = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();

        const presentYouth = attendanceRecords.filter(
          (r) => r.present && youthMemberIds.has(r.memberId as any)
        ).length;

        return {
          date,
          total: youthMembers.length,
          present: presentYouth,
          rate: youthMembers.length > 0 ? Math.round((presentYouth / youthMembers.length) * 100) : 0,
        };
      })
    );

    return trends;
  },
});

// ========== MARRIED MEMBERS QUERIES ==========

// Get married member summaries by gender
export const marriedSummaries = query({
  args: {},
  returns: v.object({
    totalMarriedMen: v.number(),
    totalMarriedWomen: v.number(),
    activeMarriedMen: v.number(),
    activeMarriedWomen: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const marriedMen = members.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const isMale = (m.gender ?? "").toLowerCase() === "male";
      return isMarried && isMale;
    });

    const marriedWomen = members.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const isFemale = (m.gender ?? "").toLowerCase() === "female";
      return isMarried && isFemale;
    });

    return {
      totalMarriedMen: marriedMen.length,
      totalMarriedWomen: marriedWomen.length,
      activeMarriedMen: marriedMen.filter((m) => m.active).length,
      activeMarriedWomen: marriedWomen.filter((m) => m.active).length,
    };
  },
});

// Get married members list with attendance info
export const marriedRoster = query({
  args: { 
    gender: v.string(), // "male" or "female"
    date: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const targetDate = args.date || new Date().toISOString().split("T")[0];

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const presentSet = new Set(attendanceRecords.filter((r) => r.present).map((r) => r.memberId));

    const marriedMembers = members.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isMarried && matchesGender;
    });

    // Get last attendance for each married member
    const withLast = await Promise.all(
      marriedMembers.map(async (m) => {
        const last = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", m._id))
          .collect();
        last.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const mostRecent = last[0];
        
        const past3MonthsAttendanceCount = last.filter(
          (r) => r.present && r.date >= threeMonthsAgoStr
        ).length;

        return {
          memberId: m._id,
          name: m.name,
          contact: m.contact,
          residence: m.residence,
          gender: m.gender,
          department: m.department,
          status: m.status,
          active: m.active,
          presentToday: presentSet.has(m._id),
          lastAttendance: mostRecent
            ? { date: mostRecent.date, present: mostRecent.present }
            : null,
          past3MonthsAttendanceCount,
        };
      })
    );

    return withLast;
  },
});

// Get attendance history for married members by date
export const marriedAttendanceByDate = query({
  args: { 
    gender: v.string(),
    date: v.string(),
  },
  returns: v.object({
    date: v.string(),
    total: v.number(),
    present: v.number(),
    absent: v.number(),
    members: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
    ]);

    const presentSet = new Set(attendanceRecords.filter((r) => r.present).map((r) => r.memberId));

    const marriedMembers = members.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isMarried && matchesGender;
    });

    const membersWithStatus = marriedMembers.map((m) => ({
      memberId: m._id,
      name: m.name,
      contact: m.contact,
      residence: m.residence,
      gender: m.gender,
      department: m.department,
      status: m.status,
      present: presentSet.has(m._id),
    }));

    const present = membersWithStatus.filter((m) => m.present).length;

    return {
      date: args.date,
      total: marriedMembers.length,
      present,
      absent: Math.max(0, marriedMembers.length - present),
      members: membersWithStatus,
    };
  },
});

// Get married members Sunday attendance trends
export const marriedSundayTrends = query({
  args: { 
    gender: v.string(),
    weeks: v.optional(v.number()),
  },
  returns: v.array(v.object({
    date: v.string(),
    total: v.number(),
    present: v.number(),
    rate: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const weeks = args.weeks ?? 6;
    const today = new Date().toISOString().split("T")[0];
    const sundays = getPreviousSundays(weeks, today);

    // Get all married members of the specified gender
    const allMembers = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const marriedMembers = allMembers.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isMarried && matchesGender;
    });

    const marriedMemberIds = new Set(marriedMembers.map((m) => m._id));

    const trends = await Promise.all(
      sundays.map(async (date) => {
        const attendanceRecords = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();

        const presentMarried = attendanceRecords.filter(
          (r) => r.present && marriedMemberIds.has(r.memberId as any)
        ).length;

        return {
          date,
          total: marriedMembers.length,
          present: presentMarried,
          rate: marriedMembers.length > 0 ? Math.round((presentMarried / marriedMembers.length) * 100) : 0,
        };
      })
    );

    return trends;
  },
});

// Get last Sunday's married attendance rate
export const lastSundayMarriedAttendanceRate = query({
  args: {
    gender: v.string(),
  },
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
    const targetDate = isSunday(today) ? today : lastSunday;

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const marriedMembers = members.filter((m) => {
      const isMarried = (m.status ?? "").toLowerCase().includes("married");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isMarried && matchesGender;
    });

    const marriedMemberIds = new Set(marriedMembers.map((m) => m._id));

    const present = attendanceRecords.filter(
      (r) => r.present && marriedMemberIds.has(r.memberId as any)
    ).length;

    const total = marriedMembers.length;

    if (total === 0) return null;

    return {
      date: targetDate,
      rate: Math.round((present / total) * 100),
      present,
      total,
    };
  },
});

// Get last Sunday's youth attendance rate
export const lastSundayYouthAttendanceRate = query({
  args: {
    gender: v.string(),
  },
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
    const targetDate = isSunday(today) ? today : lastSunday;

    const [members, attendanceRecords] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
    ]);

    const youthMembers = members.filter((m) => {
      const isYouth = (m.status ?? "").toLowerCase().includes("youth") ||
                      (m.status ?? "").toLowerCase().includes("young");
      const matchesGender = (m.gender ?? "").toLowerCase() === args.gender.toLowerCase();
      return isYouth && matchesGender;
    });

    const youthMemberIds = new Set(youthMembers.map((m) => m._id));

    const present = attendanceRecords.filter(
      (r) => r.present && youthMemberIds.has(r.memberId as any)
    ).length;

    const total = youthMembers.length;

    if (total === 0) return null;

    return {
      date: targetDate,
      rate: Math.round((present / total) * 100),
      present,
      total,
    };
  },
});

// Get attendance counts for all visitors (to determine returning visitor status)
export const visitorAttendanceCounts = query({
  args: {},
  returns: v.array(v.object({
    visitorId: v.string(),
    count: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Get all active visitors
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Get attendance count for each visitor
    const counts = await Promise.all(
      visitors.map(async (v) => {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", v._id))
          .collect();
        
        // Count only Sundays and only present records
        const sundayCount = attendance.filter((a) => isSunday(a.date) && a.present).length;
        
        return {
          visitorId: v._id,
          count: sundayCount,
        };
      })
    );

    return counts;
  },
});

export const lastSundayAttendanceRate = query({
  args: {},
  returns: v.union(
    v.object({
      date: v.string(),
      rate: v.number(),
      present: v.number(),
      total: v.number(),
      visitorsPresent: v.number(),
      visitorsTotal: v.number(),
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

    const [members, kids, attendanceRecords, visitorsForDate, allActiveVisitors] = await Promise.all([
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
      ctx.db
        .query("visitors")
        .withIndex("by_date", (q) => q.eq("date", targetDate))
        .collect(),
      ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    const memberIds = new Set([...members.map((m) => m._id), ...kids.map((k) => k._id)]);
    const allVisitorIds = new Set(allActiveVisitors.map((v) => v._id));
    
    const presentSet = new Set(
      attendanceRecords
        .filter((r) => {
          // Only count members and kids, not visitors
          return memberIds.has(r.memberId as any) && r.present;
        })
        .map((r) => r.memberId)
    );

    // Count visitors who attended on this date
    // This includes: visitors added on this date + returning visitors marked present
    const visitorsPresentIds = new Set(
      attendanceRecords
        .filter((r) => {
          // Count visitors (both new and returning) who were marked present
          return allVisitorIds.has(r.memberId as any) && r.present;
        })
        .map((r) => r.memberId)
    );
    
    // Visitors added on that date are automatically present (they get marked when added)
    // So we need to include both: visitors from attendance records AND visitors added on that date
    visitorsForDate.forEach((v) => visitorsPresentIds.add(v._id));
    
    const visitorsPresent = visitorsPresentIds.size;
    const visitorsTotal = visitorsPresentIds.size; // Total visitors who attended = those present

    const total = members.length + kids.length;
    const present = presentSet.size;

    if (total === 0) return null;

    return {
      date: targetDate,
      rate: Math.round((present / total) * 100),
      present,
      total,
      visitorsPresent,
      visitorsTotal,
    };
  },
});

export const getLatestAttendanceDates = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const allAttendance = await ctx.db.query("attendance").collect();
    const latestDates: Record<string, string> = {};
    for (const record of allAttendance) {
      if (record.present) {
        const memberIdStr = record.memberId.toString();
        const current = latestDates[memberIdStr];
        if (!current || record.date > current) {
          latestDates[memberIdStr] = record.date;
        }
      }
    }
    return latestDates;
  },
});

