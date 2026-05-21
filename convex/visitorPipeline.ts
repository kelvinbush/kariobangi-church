import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserRoles, requireFollowUpAdmin, requireAdmin, isFollowUpAdmin, isProtocolTeam } from "./authHelpers";

// --- Date helpers ---
function todayISO(): string {
  const now = new Date();
  const kenyaOffset = 3 * 60 * 60 * 1000;
  const kenyaDate = new Date(now.getTime() + kenyaOffset);
  return kenyaDate.toISOString().split("T")[0];
}

function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay() === 0;
}

function daysBetween(date1: string, date2: string): number {
  const [y1, m1, d1] = date1.split("-").map(Number);
  const [y2, m2, d2] = date2.split("-").map(Number);
  const d1Date = new Date(Date.UTC(y1, m1 - 1, d1));
  const d2Date = new Date(Date.UTC(y2, m2 - 1, d2));
  return Math.abs(Math.floor((d2Date.getTime() - d1Date.getTime()) / (1000 * 60 * 60 * 24)));
}

function computeWeekNumber(assignedDate: string): number {
  const today = todayISO();
  const diffDays = daysBetween(assignedDate, today);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(weekNum, 3));
}

// ============================================================
// PIPELINE OVERVIEW QUERIES
// ============================================================

/** Pipeline overview: counts per stage for dashboard cards */
export const getPipelineOverview = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Also count graduated (inactive with pipelineStage=graduated)
    const inactiveVisitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", false))
      .collect();

    const graduated = inactiveVisitors.filter((v) => v.pipelineStage === "graduated");
    const dropped = inactiveVisitors.filter((v) => v.pipelineStage === "dropped");

    const stages = {
      new: 0,
      assigned: 0,
      in_progress: 0,
      ready: 0,
      graduated: graduated.length,
      dormant: 0,
      dropped: dropped.length,
    };

    for (const visitor of visitors) {
      const stage = visitor.pipelineStage || "new";
      if (stage in stages) {
        stages[stage as keyof typeof stages]++;
      } else {
        stages.new++;
      }
    }

    // Compute conversion funnel
    const totalVisitors = visitors.length + graduated.length + dropped.length;
    const followedUp = stages.assigned + stages.in_progress + stages.ready + graduated.length;
    const retentionRate = totalVisitors > 0 ? Math.round((graduated.length / totalVisitors) * 100) : 0;

    return {
      stages,
      totalActive: visitors.length,
      totalAll: totalVisitors,
      funnel: {
        totalVisitors,
        followedUp,
        graduated: graduated.length,
        retentionRate,
      },
    };
  },
});

/** Get visitors filtered by pipeline stage, with full enrichment */
export const getVisitorsByStage = query({
  args: {
    stage: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    let visitors;
    if (args.includeInactive) {
      visitors = await ctx.db.query("visitors").collect();
    } else {
      visitors = await ctx.db
        .query("visitors")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    }

    // Filter by stage if specified
    if (args.stage) {
      if (args.stage === "graduated" || args.stage === "dropped") {
        // These stages are on inactive visitors
        const inactiveVisitors = await ctx.db
          .query("visitors")
          .withIndex("by_active", (q) => q.eq("active", false))
          .collect();
        visitors = inactiveVisitors.filter((v) => v.pipelineStage === args.stage);
      } else {
        visitors = visitors.filter((v) => (v.pipelineStage || "new") === args.stage);
      }
    }

    // Get all active follow-ups
    const allFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const followUpByVisitor = new Map(
      allFollowUps.map((f) => [f.visitorId.toString(), f])
    );

    // Get protocol member names
    const protocolMembers = await ctx.db.query("protocolMembers").collect();
    const protocolByClerkId = new Map(
      protocolMembers.map((p) => [p.clerkId, p.displayName])
    );

    // Enrich each visitor with real Sunday counts from attendance
    const enriched = await Promise.all(visitors.map(async (visitor) => {
      const followUp = followUpByVisitor.get(visitor._id.toString());
      const weekNumber = followUp?.assignedDate ? computeWeekNumber(followUp.assignedDate) : null;

      // Compute real Sunday count from attendance records (don't trust cached field for existing data)
      let sundayCount = visitor.sundayCount ?? 0;
      if (sundayCount === 0) {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
          .collect();
        sundayCount = attendance.filter((a) => a.present && isSunday(a.date)).length;
      }

      return {
        ...visitor,
        pipelineStage: visitor.pipelineStage || "new",
        sundayCount,
        visitType: visitor.visitType || "regular",
        // Follow-up info
        followUpId: followUp?._id || null,
        followUpStatus: followUp?.status || null,
        followUpAssignee: followUp ? protocolByClerkId.get(followUp.assignedToClerkId) || null : null,
        followUpAssigneeClerkId: followUp?.assignedToClerkId || null,
        followUpWeekNumber: weekNumber,
        followUpAssignedDate: followUp?.assignedDate || null,
        followUpLastContact: followUp?.lastContactDate || null,
      };
    }));

    // Sort: by stage urgency (ready first, then in_progress, assigned, new), then by name
    return enriched.sort((a, b) => {
      const stageOrder: Record<string, number> = {
        ready: 0, in_progress: 1, assigned: 2, new: 3, dormant: 4, dropped: 5, graduated: 6,
      };
      const aOrder = stageOrder[a.pipelineStage] ?? 3;
      const bOrder = stageOrder[b.pipelineStage] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  },
});

/** Full journey for a single visitor: attendance records, follow-up, logs */
export const getVisitorJourney = query({
  args: { visitorId: v.id("visitors") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden: requires protocol team access");
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    // Get attendance records
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.visitorId))
      .collect();
    const sortedAttendance = attendance
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Get follow-up (active or archived)
    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
    const activeFollowUp = followUps.find((f) => !f.archived);
    const allFollowUps = followUps.sort((a, b) => b.updatedAt - a.updatedAt);

    // Get follow-up logs
    let logs: any[] = [];
    const followUpForLogs = activeFollowUp || allFollowUps[0];
    if (followUpForLogs) {
      logs = await ctx.db
        .query("followUpLogs")
        .withIndex("by_followUp", (q) => q.eq("followUpId", followUpForLogs._id))
        .order("asc")
        .collect();
    }

    // Get protocol member name for assignee
    let assigneeName: string | null = null;
    if (activeFollowUp) {
      const protocolMember = await ctx.db
        .query("protocolMembers")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", activeFollowUp.assignedToClerkId))
        .first();
      assigneeName = protocolMember?.displayName ?? null;
    }

    // Compute week number
    const weekNumber = activeFollowUp?.assignedDate
      ? computeWeekNumber(activeFollowUp.assignedDate)
      : null;

    // Compute Sunday count
    const sundayCount = visitor.sundayCount ??
      attendance.filter((a) => a.present && isSunday(a.date)).length;

    return {
      visitor: {
        ...visitor,
        pipelineStage: visitor.pipelineStage || "new",
        visitType: visitor.visitType || "regular",
        sundayCount,
      },
      followUp: activeFollowUp
        ? {
          _id: activeFollowUp._id,
          status: activeFollowUp.status,
          assignedDate: activeFollowUp.assignedDate ?? null,
          assignedToClerkId: activeFollowUp.assignedToClerkId,
          assigneeName,
          lastContactDate: activeFollowUp.lastContactDate ?? null,
          weekNumber,
          removalRequested: activeFollowUp.removalRequested,
        }
        : null,
      logs,
      attendanceRecords: sortedAttendance.map((a) => ({
        date: a.date,
        present: a.present,
        arrivalTime: a.arrivalTime ?? null,
      })),
      allFollowUps: allFollowUps.map((f) => ({
        _id: f._id,
        status: f.status,
        archived: f.archived,
        assignedDate: f.assignedDate ?? null,
        updatedAt: f.updatedAt,
      })),
    };
  },
});

// ============================================================
// DORMANT VISITOR DETECTION
// ============================================================

/** Get dormant visitors: visited once, no return in 4+ weeks */
export const getDormantVisitors = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    const today = todayISO();
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const dormant: any[] = [];

    for (const visitor of visitors) {
      // Skip already marked dormant/dropped
      if (visitor.pipelineStage === "dormant" || visitor.pipelineStage === "dropped") {
        dormant.push({ ...visitor, daysSinceLastVisit: daysBetween(visitor.lastAttendanceDate || visitor.date, today) });
        continue;
      }

      // Check if visitor qualifies as dormant
      const lastDate = visitor.lastAttendanceDate || visitor.date;
      const daysSince = daysBetween(lastDate, today);
      const sundayCount = visitor.sundayCount ?? 0;

      // Dormant: 1 or fewer Sunday visits AND 28+ days (4 weeks) since last activity
      if (sundayCount <= 1 && daysSince >= 28) {
        dormant.push({ ...visitor, daysSinceLastVisit: daysSince });
      }
    }

    return dormant.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
  },
});

/** Auto-archive dormant visitors: mark as dormant those with 1 attendance and 4+ weeks inactivity */
export const autoArchiveDormant = mutation({
  args: {},
  returns: v.number(), // Returns count of visitors marked dormant
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    const today = todayISO();
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    let count = 0;

    for (const visitor of visitors) {
      // Skip visitors already in certain stages
      if (visitor.pipelineStage === "dormant" || visitor.pipelineStage === "dropped" || visitor.pipelineStage === "graduated") continue;
      // Don't mark visitors with active follow-ups as dormant
      if (visitor.pipelineStage === "assigned" || visitor.pipelineStage === "in_progress") continue;
      // Skip non-regular visitors (already handled differently)
      if (visitor.visitType === "passing_through" || visitor.visitType === "one_time_event") continue;

      const lastDate = visitor.lastAttendanceDate || visitor.date;
      const daysSince = daysBetween(lastDate, today);
      const sundayCount = visitor.sundayCount ?? 0;

      // Auto-dormant: <=1 Sunday visits AND 28+ days since last activity
      if (sundayCount <= 1 && daysSince >= 28) {
        await ctx.db.patch(visitor._id, { pipelineStage: "dormant" });

        // Archive any follow-up
        const followUps = await ctx.db
          .query("followUps")
          .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
          .collect();
        for (const f of followUps) {
          if (!f.archived) {
            await ctx.db.patch(f._id, {
              archived: true,
              status: "removed",
              updatedAt: Date.now(),
            });
          }
        }

        count++;
      }
    }

    return count;
  },
});

// ============================================================
// PIPELINE STAGE MANAGEMENT
// ============================================================

/** Mark a visitor as dormant manually */
export const markDormant = mutation({
  args: { visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    await ctx.db.patch(args.visitorId, { pipelineStage: "dormant" });

    // Archive any active follow-up
    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
    for (const f of followUps) {
      if (!f.archived) {
        await ctx.db.patch(f._id, {
          archived: true,
          status: "removed",
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

/** Drop a visitor from tracking */
export const dropVisitor = mutation({
  args: { visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    await ctx.db.patch(args.visitorId, {
      active: false,
      pipelineStage: "dropped",
    });

    // Archive any active follow-up
    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
    for (const f of followUps) {
      if (!f.archived) {
        await ctx.db.patch(f._id, {
          archived: true,
          status: "removed",
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

/** Reactivate a dormant or dropped visitor */
export const reactivateVisitor = mutation({
  args: { visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    await ctx.db.patch(args.visitorId, {
      active: true,
      pipelineStage: "new",
    });

    return null;
  },
});

// ============================================================
// PROTOCOL TEAM DASHBOARD
// ============================================================

/** Protocol member's dashboard with assigned visitors enriched with week info */
export const getProtocolDashboard = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userRoles = getUserRoles(identity as any);
    const isAdminOrFUAdmin = isFollowUpAdmin(identity);
    const targetClerkId = args.clerkId ?? identity.subject;
    if (!isAdminOrFUAdmin && targetClerkId !== identity.subject) {
      throw new Error("Forbidden: can only view your own dashboard");
    }

    // Get active follow-ups for this protocol member
    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_assigned_and_archived", (q) =>
        q.eq("assignedToClerkId", targetClerkId).eq("archived", false)
      )
      .collect();

    // Get archived (graduated) follow-ups for stats
    const archivedFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_assigned_and_archived", (q) =>
        q.eq("assignedToClerkId", targetClerkId).eq("archived", true)
      )
      .collect();
    const graduatedCount = archivedFollowUps.filter((f) => f.status === "graduated").length;

    // Enrich with visitor data and organize by week
    const byWeek: Record<number, any[]> = { 1: [], 2: [], 3: [] };
    const allFollowUps: any[] = [];

    for (const f of followUps) {
      const visitor = await ctx.db.get(f.visitorId);
      if (!visitor) continue;

      const weekNumber = f.assignedDate ? computeWeekNumber(f.assignedDate) : 1;
      let sundayCount = visitor.sundayCount ?? 0;
      if (sundayCount === 0) {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
          .collect();
        sundayCount = attendance.filter((a) => a.present && isSunday(a.date)).length;
      }

      // Get logs for this follow-up
      const logs = await ctx.db
        .query("followUpLogs")
        .withIndex("by_followUp", (q) => q.eq("followUpId", f._id))
        .order("asc")
        .collect();

      const enriched = {
        _id: f._id,
        visitorId: f.visitorId,
        visitorName: visitor.name,
        visitorContact: visitor.contact,
        visitorResidence: visitor.residence,
        visitorDate: visitor.date,
        visitorGender: visitor.gender ?? null,
        status: f.status,
        assignedDate: f.assignedDate ?? null,
        lastContactDate: f.lastContactDate ?? null,
        weekNumber,
        sundayCount,
        lastAttendance: visitor.lastAttendanceDate ?? null,
        removalRequested: f.removalRequested,
        logs: logs.map((l) => ({
          _id: l._id,
          status: l.status,
          comment: l.comment,
          loggedAt: l.loggedAt,
        })),
      };

      allFollowUps.push(enriched);
      const weekKey = Math.min(weekNumber, 3) as 1 | 2 | 3;
      byWeek[weekKey].push(enriched);
    }

    return {
      byWeek,
      all: allFollowUps,
      stats: {
        active: followUps.length,
        graduated: graduatedCount,
        total: followUps.length + archivedFollowUps.length,
        graduationRate: (followUps.length + archivedFollowUps.length) > 0
          ? Math.round((graduatedCount / (followUps.length + archivedFollowUps.length)) * 100)
          : 0,
        week1: byWeek[1].length,
        week2: byWeek[2].length,
        week3: byWeek[3].length,
        notContacted: followUps.filter((f) => f.status === "not_contacted").length,
        contacted: followUps.filter((f) => f.status === "contacted").length,
        needsFollowUp: followUps.filter((f) => f.status === "needs_follow_up").length,
      },
    };
  },
});

// ============================================================
// CONVERSION FUNNEL DATA
// ============================================================

/** Get conversion funnel data for visualization */
export const getConversionFunnel = query({
  args: {
    weeks: v.optional(v.number()), // How many weeks back to look (default: 12)
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isFollowUpAdmin(identity)) {
      throw new Error("Forbidden: requires follow-up-admin or admin");
    }

    // Get all visitors
    const allVisitors = await ctx.db.query("visitors").collect();
    const allFollowUps = await ctx.db.query("followUps").collect();

    const totalVisitors = allVisitors.length;
    const activeVisitors = allVisitors.filter((v) => v.active).length;
    const assignedFollowUps = allFollowUps.filter((f) => !f.archived).length;
    const graduatedFollowUps = allFollowUps.filter((f) => f.status === "graduated").length;
    const droppedVisitors = allVisitors.filter((v) => v.pipelineStage === "dropped").length;
    const dormantVisitors = allVisitors.filter((v) => v.pipelineStage === "dormant").length;

    // Visitors who have attended 3+ Sundays (compute from attendance if cached is 0)
    let retainedVisitors = 0;
    for (const visitor of allVisitors) {
      let sc = visitor.sundayCount ?? 0;
      if (sc === 0) {
        const att = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
          .collect();
        sc = att.filter((a) => a.present && isSunday(a.date)).length;
      }
      if (sc >= 3) retainedVisitors++;
    }

    return {
      totalVisitors,
      activeVisitors,
      withFollowUp: assignedFollowUps + graduatedFollowUps,
      graduated: graduatedFollowUps,
      retained: retainedVisitors,
      dormant: dormantVisitors,
      dropped: droppedVisitors,
      // Rates
      followUpRate: totalVisitors > 0 ? Math.round((assignedFollowUps + graduatedFollowUps) / totalVisitors * 100) : 0,
      graduationRate: totalVisitors > 0 ? Math.round(graduatedFollowUps / totalVisitors * 100) : 0,
      retentionRate: totalVisitors > 0 ? Math.round(retainedVisitors / totalVisitors * 100) : 0,
      dormantRate: totalVisitors > 0 ? Math.round(dormantVisitors / totalVisitors * 100) : 0,
    };
  },
});

// ============================================================
// NOTIFICATIONS / ALERTS
// ============================================================

/** Get alerts for the protocol team / admins */
export const getAlerts = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const targetClerkId = args.clerkId ?? identity.subject;

    // Get follow-ups for this user
    const myFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_assigned_and_archived", (q) =>
        q.eq("assignedToClerkId", targetClerkId).eq("archived", false)
      )
      .collect();

    const alerts: Array<{
      type: string;
      severity: "info" | "warning" | "urgent";
      message: string;
      visitorId?: string;
      followUpId?: string;
    }> = [];

    for (const f of myFollowUps) {
      const visitor = await ctx.db.get(f.visitorId);
      if (!visitor) continue;

      const weekNumber = f.assignedDate ? computeWeekNumber(f.assignedDate) : 1;

      // Alert: Final week
      if (weekNumber >= 3) {
        alerts.push({
          type: "final_week",
          severity: "urgent",
          message: `${visitor.name} is in their final follow-up week!`,
          visitorId: visitor._id,
          followUpId: f._id,
        });
      }

      // Alert: Not contacted yet
      if (f.status === "not_contacted" && weekNumber >= 2) {
        alerts.push({
          type: "not_contacted",
          severity: "warning",
          message: `${visitor.name} hasn't been contacted yet (Week ${weekNumber})`,
          visitorId: visitor._id,
          followUpId: f._id,
        });
      }

      // Alert: Ready to graduate (3+ Sunday visits)
      const sundayCount = visitor.sundayCount ?? 0;
      if (sundayCount >= 3 && visitor.pipelineStage !== "ready") {
        alerts.push({
          type: "ready_to_graduate",
          severity: "info",
          message: `${visitor.name} has attended ${sundayCount} Sundays — ready to graduate!`,
          visitorId: visitor._id,
          followUpId: f._id,
        });
      }
    }

    // Sort by severity (urgent first)
    const severityOrder = { urgent: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  },
});
