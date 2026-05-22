import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUserRoles, hasAnyRole, requireAdmin, requireFollowUpAdmin, isProtocolTeam, isFollowUpAdmin } from "./authHelpers";


// --- Date helper: past N Sundays ---
function getPreviousSundays(count: number, fromDate?: string): string[] {
  const parts = fromDate
    ? fromDate.split("-").map(Number)
    : new Date().toISOString().split("T")[0].split("-").map(Number);
  const [year, month, day] = parts;
  let date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  date.setUTCDate(date.getUTCDate() - daysToSubtract);
  const sundays: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${d}`);
    date.setUTCDate(date.getUTCDate() - 7);
  }
  return sundays;
}

// --- Helper: days between two ISO dates ---
function daysBetween(date1: string, date2: string): number {
  const [y1, m1, d1] = date1.split("-").map(Number);
  const [y2, m2, d2] = date2.split("-").map(Number);
  const d1Date = new Date(Date.UTC(y1, m1 - 1, d1));
  const d2Date = new Date(Date.UTC(y2, m2 - 1, d2));
  return Math.abs(Math.floor((d2Date.getTime() - d1Date.getTime()) / (1000 * 60 * 60 * 24)));
}

// --- Helper: compute week number from assigned date ---
function computeWeekNumber(assignedDate: string): number {
  const now = new Date();
  const [year, month, day] = assignedDate.split("-").map(Number);
  const assigned = new Date(Date.UTC(year, month - 1, day));
  const diffMs = now.getTime() - assigned.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(weekNum, 4)); // Clamp between 1 and 4
}

// --- Helper: today's ISO date ---
function todayISO(): string {
  const now = new Date();
  // Use Kenya time (UTC+3)
  const kenyaOffset = 3 * 60 * 60 * 1000;
  const kenyaDate = new Date(now.getTime() + kenyaOffset);
  return kenyaDate.toISOString().split("T")[0];
}

// --- Validators for returns ---
const visitorDocValidator = v.object({
  _id: v.id("visitors"),
  _creationTime: v.number(),
  name: v.string(),
  contact: v.union(v.string(), v.null()),
  residence: v.union(v.string(), v.null()),
  relationshipStatus: v.union(v.string(), v.null()),
  previousChurch: v.union(v.string(), v.null()),
  age: v.optional(v.number()),
  date: v.string(),
  active: v.boolean(),
  createdBy: v.string(),
  // New optional pipeline fields
  gender: v.optional(v.union(v.string(), v.null())),
  pipelineStage: v.optional(v.string()),
  visitType: v.optional(v.string()),
  lastAttendanceDate: v.optional(v.union(v.string(), v.null())),
  sundayCount: v.optional(v.number()),
});

/** Visitors whose first visit date (visitors.date) is in the past 3 Sundays. 
 *  Excludes children, passing_through, one_time_event visitors.
 *  Excludes visitors who already have an active (non-archived) follow-up. */
export const visitorsEligibleForFollowUp = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const sundays = getPreviousSundays(3);
    const allVisitors: any[] = [];
    const seen = new Set<Id<"visitors">>();

    for (const dateStr of sundays) {
      const list = await ctx.db
        .query("visitors")
        .withIndex("by_date", (q) => q.eq("date", dateStr))
        .collect();
      for (const v of list) {
        if (!v.active) continue;
        if (v.relationshipStatus === "child") continue;
        // Exclude passing_through and one_time_event visitors
        if (v.visitType === "passing_through" || v.visitType === "one_time_event") continue;
        if (seen.has(v._id)) continue;
        seen.add(v._id);
        allVisitors.push(v);
      }
    }

    // Exclude visitors who already have an active (non-archived) follow-up
    const activeFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const assignedVisitorIds = new Set(activeFollowUps.map((f) => f.visitorId));

    return allVisitors.filter((v) => !assignedVisitorIds.has(v._id));
  },
});

// --- Mutations: assign, reassign ---

export const assign = mutation({
  args: {
    visitorId: v.id("visitors"),
    assignedToClerkId: v.string(),
  },
  returns: v.id("followUps"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || !visitor.active) throw new Error("Visitor not found or inactive");

    const forVisitor = await ctx.db
      .query("followUps")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
    const existing = forVisitor.find((f) => !f.archived);
    if (existing) throw new Error("This visitor already has an active follow-up");

    const now = Date.now();
    const today = todayISO();

    const followUpId = await ctx.db.insert("followUps", {
      visitorId: args.visitorId,
      assignedToClerkId: args.assignedToClerkId,
      status: "not_contacted",
      archived: false,
      removalRequested: false,
      removalReason: null,
      requestedAt: null,
      createdBy: identity.subject,
      updatedAt: now,
      // Pipeline tracking
      assignedDate: today,
      lastContactDate: null,
    });

    // Update visitor pipeline stage
    await ctx.db.patch(args.visitorId, { pipelineStage: "assigned" });

    return followUpId;
  },
});

export const reassign = mutation({
  args: {
    followUpId: v.id("followUps"),
    assignedToClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or already archived");

    await ctx.db.patch(args.followUpId, {
      assignedToClerkId: args.assignedToClerkId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// --- Add log (status + comment); protocol can only do for their assignees ---
export const addLog = mutation({
  args: {
    followUpId: v.id("followUps"),
    status: v.string(),
    comment: v.string(),
  },
  returns: v.id("followUpLogs"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or archived");

    const userRoles = getUserRoles(identity as any);
    const isAdminOrFUAdmin = isProtocolTeam(identity) || hasAnyRole(userRoles, ["follow-up-admin"]);
    const isAssignee = followUp.assignedToClerkId === identity.subject;
    if (!isAdminOrFUAdmin && !isAssignee) throw new Error("Forbidden: not assigned to this follow-up");

    const now = Date.now();
    const today = todayISO();

    // Update follow-up status and last contact date
    await ctx.db.patch(args.followUpId, {
      status: args.status,
      updatedAt: now,
      lastContactDate: today,
    });

    // Update visitor pipeline stage to in_progress if currently assigned
    const visitor = await ctx.db.get(followUp.visitorId);
    if (visitor && (visitor.pipelineStage === "assigned" || visitor.pipelineStage === "new")) {
      await ctx.db.patch(followUp.visitorId, { pipelineStage: "in_progress" });
    }

    return await ctx.db.insert("followUpLogs", {
      followUpId: args.followUpId,
      status: args.status,
      comment: args.comment.trim(),
      loggedByClerkId: identity.subject,
      loggedAt: now,
    });
  },
});

// --- Request removal (protocol or admin/follow-up-admin) ---
export const requestRemoval = mutation({
  args: {
    followUpId: v.id("followUps"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or archived");

    const userRoles = getUserRoles(identity as any);
    const isAdminOrFUAdmin = isProtocolTeam(identity) || hasAnyRole(userRoles, ["follow-up-admin"]);
    const isAssignee = followUp.assignedToClerkId === identity.subject;
    if (!isAdminOrFUAdmin && !isAssignee) throw new Error("Forbidden: not assigned to this follow-up");

    const now = Date.now();
    await ctx.db.patch(args.followUpId, {
      removalRequested: true,
      removalReason: args.reason.trim(),
      requestedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/** Archive follow-up as graduated. Admin or follow-up-admin. */
export const markAsGraduated = mutation({
  args: { followUpId: v.id("followUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or already archived");

    await ctx.db.patch(args.followUpId, {
      archived: true,
      status: "graduated",
      updatedAt: Date.now(),
    });

    // Update visitor pipeline stage to ready (ready for member graduation)
    const visitor = await ctx.db.get(followUp.visitorId);
    if (visitor && visitor.active) {
      await ctx.db.patch(followUp.visitorId, { pipelineStage: "ready" });
    }

    return null;
  },
});

/** Only admin can remove visitor and archive follow-up. */
export const removeVisitorAndArchiveFollowUp = mutation({
  args: {
    visitorId: v.id("visitors"),
    followUpId: v.id("followUps"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) throw new Error("Visitor not found");

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.visitorId !== args.visitorId) throw new Error("Follow-up not found or mismatch");

    await ctx.db.patch(args.visitorId, {
      active: false,
      pipelineStage: "dropped",
    });
    await ctx.db.patch(args.followUpId, {
      archived: true,
      status: "removed",
      removalRequested: false,
      removalReason: null,
      requestedAt: null,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// --- List queries (with visitor details + pipeline info) ---

/** All active (non-archived) follow-ups with enriched data. Admin or follow-up-admin only. */
export const listAll = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const list = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .order("desc")
      .collect();

    const result: any[] = [];
    const today = todayISO();
    for (const f of list) {
      const visitor = await ctx.db.get(f.visitorId);

      // Compute week number from assigned date
      const weekNumber = f.assignedDate ? computeWeekNumber(f.assignedDate) : null;

      const visitorStage = visitor?.pipelineStage ?? "new";
      const isReady = f.assignedDate && daysBetween(f.assignedDate, today) >= 28;
      const dynamicStage = isReady && visitorStage !== "graduated" && visitorStage !== "dropped" && visitorStage !== "dormant"
        ? "ready"
        : visitorStage;

      result.push({
        _id: f._id,
        visitorId: f.visitorId,
        assignedToClerkId: f.assignedToClerkId,
        status: f.status,
        archived: f.archived,
        removalRequested: f.removalRequested,
        removalReason: f.removalReason,
        requestedAt: f.requestedAt,
        updatedAt: f.updatedAt,
        visitorName: visitor?.name ?? "",
        visitorContact: visitor?.contact ?? null,
        visitorDate: visitor?.date ?? "",
        // Pipeline enrichment
        assignedDate: f.assignedDate ?? null,
        lastContactDate: f.lastContactDate ?? null,
        weekNumber,
        visitorSundayCount: visitor?.sundayCount ?? 0,
        visitorPipelineStage: dynamicStage,
        visitorLastAttendance: visitor?.lastAttendanceDate ?? null,
      });
    }
    return result;
  },
});

/** My assigned follow-ups (protocol member) with pipeline data. */
export const myFollowUps = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const userRoles = getUserRoles(identity as any);
    const isAdminOrFUAdmin = isProtocolTeam(identity) || hasAnyRole(userRoles, ["follow-up-admin"]);
    const targetClerkId = args.clerkId ?? identity.subject;
    if (!isAdminOrFUAdmin && targetClerkId !== identity.subject) {
      throw new Error("Forbidden: can only view your own follow-ups");
    }

    const list = await ctx.db
      .query("followUps")
      .withIndex("by_assigned_and_archived", (q) =>
        q.eq("assignedToClerkId", targetClerkId).eq("archived", false)
      )
      .order("desc")
      .collect();

    const result: any[] = [];
    const today = todayISO();
    for (const f of list) {
      const visitor = await ctx.db.get(f.visitorId);

      // Compute week number from assigned date
      const weekNumber = f.assignedDate ? computeWeekNumber(f.assignedDate) : null;

      // Get attendance records count for this visitor
      let sundayCount = visitor?.sundayCount ?? 0;
      if (sundayCount === 0 && visitor) {
        // Compute if not cached
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", visitor._id))
          .collect();
        sundayCount = attendance.filter((a) => a.present && isSunday(a.date)).length;
      }

      const visitorStage = visitor?.pipelineStage ?? "new";
      const isReady = f.assignedDate && daysBetween(f.assignedDate, today) >= 28;
      const dynamicStage = isReady && visitorStage !== "graduated" && visitorStage !== "dropped" && visitorStage !== "dormant"
        ? "ready"
        : visitorStage;

      result.push({
        _id: f._id,
        visitorId: f.visitorId,
        assignedToClerkId: f.assignedToClerkId,
        status: f.status,
        archived: f.archived,
        removalRequested: f.removalRequested,
        removalReason: f.removalReason,
        requestedAt: f.requestedAt,
        updatedAt: f.updatedAt,
        visitorName: visitor?.name ?? "",
        visitorContact: visitor?.contact ?? null,
        visitorDate: visitor?.date ?? "",
        // Pipeline enrichment
        assignedDate: f.assignedDate ?? null,
        lastContactDate: f.lastContactDate ?? null,
        weekNumber,
        visitorSundayCount: sundayCount,
        visitorPipelineStage: dynamicStage,
        visitorResidence: visitor?.residence ?? null,
        visitorLastAttendance: visitor?.lastAttendanceDate ?? null,
        visitorGender: visitor?.gender ?? null,
      });
    }
    return result;
  },
});

/** Follow-ups with removal requested. Admin or follow-up-admin. */
export const removalQueue = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const list = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const withRequest = list.filter((f) => f.removalRequested);

    const result: any[] = [];
    for (const f of withRequest) {
      const visitor = await ctx.db.get(f.visitorId);
      result.push({
        _id: f._id,
        visitorId: f.visitorId,
        assignedToClerkId: f.assignedToClerkId,
        status: f.status,
        archived: f.archived,
        removalRequested: f.removalRequested,
        removalReason: f.removalReason,
        requestedAt: f.requestedAt,
        updatedAt: f.updatedAt,
        visitorName: visitor?.name ?? "",
        visitorContact: visitor?.contact ?? null,
        visitorDate: visitor?.date ?? "",
      });
    }
    return result;
  },
});

/** Log history for a follow-up. */
export const logsForFollowUp = query({
  args: { followUpId: v.id("followUps") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp) return [];

    const isAuthorized = isProtocolTeam(identity) || followUp.assignedToClerkId === identity.subject;
    if (!isAuthorized) return [];

    return await ctx.db
      .query("followUpLogs")
      .withIndex("by_followUp", (q) => q.eq("followUpId", args.followUpId))
      .order("desc")
      .collect();
  },
});

/** Recent graduates (archived, status graduated). For dashboard. */
export const recentGraduates = query({
  args: {
    limit: v.optional(v.number()),
    clerkId: v.optional(v.string()),
  },
  returns: v.array(v.object({
    followUpId: v.id("followUps"),
    visitorId: v.id("visitors"),
    visitorName: v.string(),
    assignedToClerkId: v.string(),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const all = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", true))
      .collect();
    const graduated = all.filter((f) => f.status === "graduated");
    let filtered = graduated;
    if (args.clerkId) {
      if (!isFollowUpAdmin(identity) && args.clerkId !== identity.subject) {
        throw new Error("Forbidden");
      }
      filtered = graduated.filter((f) => f.assignedToClerkId === args.clerkId);
    }
    filtered.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const take = args.limit ?? 10;
    const slice = filtered.slice(0, take);

    const result = [];
    for (const f of slice) {
      const visitor = await ctx.db.get(f.visitorId);
      result.push({
        followUpId: f._id,
        visitorId: f.visitorId,
        visitorName: visitor?.name ?? "",
        assignedToClerkId: f.assignedToClerkId,
        updatedAt: f.updatedAt,
      });
    }
    return result;
  },
});

/** Count of graduates per protocol member (assignedToClerkId). Admin only. */
export const graduatesByProtocolMember = query({
  args: {},
  returns: v.array(v.object({
    clerkId: v.string(),
    displayName: v.string(),
    count: v.number(),
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const archived = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", true))
      .collect();
    const graduated = archived.filter((f) => f.status === "graduated");

    const byClerk = new Map<string, number>();
    for (const f of graduated) {
      byClerk.set(f.assignedToClerkId, (byClerk.get(f.assignedToClerkId) ?? 0) + 1);
    }

    const protocolMembers = await ctx.db.query("protocolMembers").collect();
    const byId = new Map(protocolMembers.map((p) => [p.clerkId, p.displayName]));

    return Array.from(byClerk.entries()).map(([clerkId, count]) => ({
      clerkId,
      displayName: byId.get(clerkId) ?? clerkId,
      count,
    }));
  },
});

// Helper: check if date is a Sunday
function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay() === 0;
}
