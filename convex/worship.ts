import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Worship team departments
const WORSHIP_DEPARTMENTS = ["worship", "violinist", "keyboardist", "singer", "choir", "band"];

function isWorshipTeamDepartment(department: string | null): boolean {
  if (!department) return false;
  const lower = department.toLowerCase();
  return WORSHIP_DEPARTMENTS.some(d => lower.includes(d));
}

// Get all worship team members
export const getWorshipTeam = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    return members.filter((m) => isWorshipTeamDepartment(m.department));
  },
});

// Get worship team members with Sunday attendance for a specific date
export const worshipTeamSundayAttendance = query({
  args: { date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Get all active members
    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Filter worship team
    const worshipTeam = members.filter((m) => isWorshipTeamDepartment(m.department));

    // Get attendance for the specified date
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    const attendanceMap = new Map();
    attendanceRecords.forEach((record) => {
      attendanceMap.set(record.memberId, record);
    });

    // Combine member info with attendance
    return worshipTeam.map((member) => {
      const attendance = attendanceMap.get(member._id);
      return {
        memberId: member._id,
        name: member.name,
        contact: member.contact,
        department: member.department,
        gender: member.gender,
        present: attendance?.present ?? false,
        arrivalTime: attendance?.arrivalTime ?? null,
      };
    });
  },
});

// Get worship team members with Saturday practice attendance
export const worshipTeamPracticeAttendance = query({
  args: { date: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Get all active members
    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Filter worship team
    const worshipTeam = members.filter((m) => isWorshipTeamDepartment(m.department));

    // Get practice attendance for the specified date
    const practiceRecords = await ctx.db
      .query("practiceAttendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    const practiceMap = new Map();
    practiceRecords.forEach((record) => {
      practiceMap.set(record.memberId, record);
    });

    // Combine member info with practice attendance
    return worshipTeam.map((member) => {
      const practice = practiceMap.get(member._id);
      return {
        memberId: member._id,
        name: member.name,
        contact: member.contact,
        department: member.department,
        gender: member.gender,
        present: practice?.present ?? false,
        arrivalTime: practice?.arrivalTime ?? null,
        notes: practice?.notes ?? null,
      };
    });
  },
});

// Mark practice attendance for worship team member
export const markPracticeAttendance = mutation({
  args: {
    memberId: v.id("members"),
    date: v.string(),
    present: v.boolean(),
    arrivalTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.union(v.id("practiceAttendance"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Check if member exists and is worship team
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");
    if (!isWorshipTeamDepartment(member.department)) {
      throw new Error("Member is not part of the worship team");
    }

    // Check for existing record
    const existing = await ctx.db
      .query("practiceAttendance")
      .withIndex("by_member_date", (q) =>
        q.eq("memberId", args.memberId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        present: args.present,
        arrivalTime: args.arrivalTime,
        markedBy: identity.subject,
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("practiceAttendance", {
      memberId: args.memberId,
      date: args.date,
      present: args.present,
      arrivalTime: args.arrivalTime,
      markedBy: identity.subject,
      notes: args.notes,
    });
  },
});

// Get practice attendance history for a member
export const practiceHistoryForMember = query({
  args: { memberId: v.id("members") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const records = await ctx.db
      .query("practiceAttendance")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();

    // Sort by date descending
    return records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },
});

// Get worship team stats
export const worshipTeamStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    byDepartment: v.array(v.object({
      department: v.string(),
      count: v.number(),
    })),
    byGender: v.object({
      male: v.number(),
      female: v.number(),
      unknown: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const worshipTeam = members.filter((m) => isWorshipTeamDepartment(m.department));

    // Count by department
    const deptCounts = new Map<string, number>();
    worshipTeam.forEach((m) => {
      const dept = m.department || "Unknown";
      deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    });

    // Count by gender
    const male = worshipTeam.filter((m) => (m.gender ?? "").toLowerCase() === "male").length;
    const female = worshipTeam.filter((m) => (m.gender ?? "").toLowerCase() === "female").length;
    const unknown = worshipTeam.length - male - female;

    return {
      total: worshipTeam.length,
      byDepartment: Array.from(deptCounts.entries()).map(([department, count]) => ({
        department,
        count,
      })),
      byGender: { male, female, unknown },
    };
  },
});

// Get recent practice sessions (distinct dates)
export const recentPracticeSessions = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    date: v.string(),
    totalPresent: v.number(),
    totalAbsent: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(30, args.limit ?? 10));

    // Get all practice attendance records
    const allRecords = await ctx.db.query("practiceAttendance").order("desc").take(2000);

    // Get unique dates
    const seen = new Set<string>();
    const uniqueDates: string[] = [];
    for (const r of allRecords) {
      if (seen.has(r.date)) continue;
      seen.add(r.date);
      uniqueDates.push(r.date);
      if (uniqueDates.length >= limit) break;
    }

    // Calculate stats for each date
    const sessions = await Promise.all(
      uniqueDates.map(async (date) => {
        const records = await ctx.db
          .query("practiceAttendance")
          .withIndex("by_date", (q) => q.eq("date", date))
          .collect();

        const present = records.filter((r) => r.present).length;
        const absent = records.filter((r) => !r.present).length;

        return {
          date,
          totalPresent: present,
          totalAbsent: absent,
        };
      })
    );

    return sessions;
  },
});
