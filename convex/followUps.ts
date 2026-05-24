import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUserRoles, hasAnyRole, requireAdmin, requireFollowUpAdmin, isProtocolTeam, isFollowUpAdmin } from "./authHelpers";
import {
  FOLLOW_UP_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  computeFollowUpWeek,
  daysSince,
  getDormantCandidate,
  getPipelineStage,
  hasCompletedWeekFour,
  isAssignableVisitor,
  isSunday,
  protocolPhoneFromClerkId,
  todayISO,
} from "./pipelineHelpers";


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

/** Active, regular visitors who do not already have an active follow-up.
 *  Excludes children, passing_through, one_time_event, dormant, dropped, and graduated visitors.
 *  Excludes visitors who already have an active (non-archived) follow-up. */
export const visitorsEligibleForFollowUp = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const activeVisitors = await ctx.db
      .query("visitors")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const activeFollowUps = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const assignedVisitorIds = new Set(activeFollowUps.map((f) => f.visitorId));

    return activeVisitors
      .filter((visitor) => isAssignableVisitor(visitor))
      .filter((visitor) => !assignedVisitorIds.has(visitor._id))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    if (!visitor || !isAssignableVisitor(visitor)) throw new Error("Visitor is not eligible for follow-up assignment");

    const protocolMember = await ctx.db
      .query("protocolMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.assignedToClerkId))
      .first();
    if (!protocolMember?.active && args.assignedToClerkId !== identity.subject) {
      throw new Error("Assignee must be an active protocol member");
    }

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

/** Admin/follow-up-admin can enter structured reports received outside the app. */
export const addManualLog = mutation({
  args: {
    followUpId: v.id("followUps"),
    reportedByClerkId: v.string(),
    status: v.string(),
    comment: v.string(),
  },
  returns: v.id("followUpLogs"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or archived");

    const protocolMember = await ctx.db
      .query("protocolMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.reportedByClerkId))
      .first();
    if (!protocolMember) throw new Error("Reported-by protocol member not found");

    const now = Date.now();
    const today = todayISO();
    await ctx.db.patch(args.followUpId, {
      status: args.status,
      updatedAt: now,
      lastContactDate: today,
    });

    const visitor = await ctx.db.get(followUp.visitorId);
    if (visitor && (visitor.pipelineStage === "assigned" || visitor.pipelineStage === "new")) {
      await ctx.db.patch(followUp.visitorId, { pipelineStage: "in_progress" });
    }

    return await ctx.db.insert("followUpLogs", {
      followUpId: args.followUpId,
      status: args.status,
      comment: args.comment.trim(),
      loggedByClerkId: args.reportedByClerkId,
      loggedAt: now,
    });
  },
});

/** Mark a visitor's active follow-up as ready for graduation without archiving it. */
export const markReadyForGraduation = mutation({
  args: { followUpId: v.id("followUps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or already archived");

    const visitor = await ctx.db.get(followUp.visitorId);
    if (!visitor || !visitor.active) throw new Error("Visitor not found or inactive");

    await ctx.db.patch(followUp.visitorId, { pipelineStage: "ready" });
    await ctx.db.patch(args.followUpId, { updatedAt: Date.now() });
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

      // Compute week number from assigned date with manual weekOverride priority
      const weekNumber = f.assignedDate ? computeFollowUpWeek(f.assignedDate, today, f.weekOverride) : null;
      const dynamicStage = visitor ? getPipelineStage(visitor, f, today) : "new";

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
        weekOverride: f.weekOverride ?? null,
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

      // Compute week number from assigned date with manual weekOverride priority
      const weekNumber = f.assignedDate ? computeFollowUpWeek(f.assignedDate, today, f.weekOverride) : null;

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

      const dynamicStage = visitor ? getPipelineStage(visitor, f, today) : "new";

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
        weekOverride: f.weekOverride ?? null,
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

async function sundayCountForVisitor(ctx: any, visitor: any): Promise<number> {
  const attendance = await ctx.db
    .query("attendance")
    .withIndex("by_member_date", (q: any) => q.eq("memberId", visitor._id))
    .collect();
  const computed = attendance.filter((row: any) => row.present && isSunday(row.date)).length;
  return computed > 0 ? computed : visitor.sundayCount ?? 0;
}

async function latestLogForFollowUp(ctx: any, followUpId: Id<"followUps">): Promise<any | null> {
  const logs = await ctx.db
    .query("followUpLogs")
    .withIndex("by_followUp", (q: any) => q.eq("followUpId", followUpId))
    .order("desc")
    .collect();
  return logs[0] ?? null;
}

function createEmptyBuckets() {
  return [
    { key: "eligible", label: "Eligible unassigned", rows: [] as any[] },
    { key: "week1", label: "Week 1", rows: [] as any[] },
    { key: "week2", label: "Week 2", rows: [] as any[] },
    { key: "week3", label: "Week 3", rows: [] as any[] },
    { key: "week4", label: "Week 4", rows: [] as any[] },
    { key: "graduation_ready", label: "Graduation ready", rows: [] as any[] },
    { key: "dormant_candidates", label: "Dormant candidates", rows: [] as any[] },
    { key: "removal_requests", label: "Removal requests", rows: [] as any[] },
  ];
}

async function buildAdminWorkspace(ctx: any, referenceDate: string) {
  const protocolMembers = await ctx.db.query("protocolMembers").collect();
  const protocolByClerkId = new Map<string, any>(protocolMembers.map((member: any) => [member.clerkId, member]));

  const activeFollowUps = await ctx.db
    .query("followUps")
    .withIndex("by_archived", (q: any) => q.eq("archived", false))
    .collect();
  const archivedFollowUps = await ctx.db
    .query("followUps")
    .withIndex("by_archived", (q: any) => q.eq("archived", true))
    .collect();
  const activeVisitors = await ctx.db
    .query("visitors")
    .withIndex("by_active", (q: any) => q.eq("active", true))
    .collect();

  const activeFollowUpByVisitor = new Map(activeFollowUps.map((followUp: any) => [followUp.visitorId.toString(), followUp]));
  const buckets = createEmptyBuckets();
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  const activeRows: any[] = [];

  for (const followUp of activeFollowUps) {
    const visitor = await ctx.db.get(followUp.visitorId);
    if (!visitor) continue;

    const sundayCount = await sundayCountForVisitor(ctx, visitor);
    const assignee = protocolByClerkId.get(followUp.assignedToClerkId);
    const latestLog = await latestLogForFollowUp(ctx, followUp._id);
    const weekNumber = followUp.assignedDate ? computeFollowUpWeek(followUp.assignedDate, referenceDate, followUp.weekOverride) : 1;
    const pipelineStage = getPipelineStage(visitor, followUp, referenceDate);
    const ready = pipelineStage === "ready" || hasCompletedWeekFour(followUp.assignedDate, referenceDate, followUp.weekOverride);

    const row = {
      followUpId: followUp._id,
      visitorId: visitor._id,
      visitorName: visitor.name,
      visitorContact: visitor.contact ?? null,
      visitorResidence: visitor.residence ?? null,
      firstVisitDate: visitor.date,
      lastAttendanceDate: visitor.lastAttendanceDate ?? null,
      assignedDate: followUp.assignedDate ?? null,
      assignedToClerkId: followUp.assignedToClerkId,
      assigneeName: assignee?.displayName ?? followUp.assignedToClerkId,
      assigneePhone: assignee?.phone ?? protocolPhoneFromClerkId(followUp.assignedToClerkId),
      assigneeAccessMode: assignee?.accessMode ?? (followUp.assignedToClerkId.startsWith("wa:phone:") ? "whatsapp_only" : "system"),
      status: followUp.status,
      statusLabel: FOLLOW_UP_STATUS_LABELS[followUp.status] ?? followUp.status,
      pipelineStage,
      pipelineStageLabel: PIPELINE_STAGE_LABELS[pipelineStage] ?? pipelineStage,
      weekNumber,
      weekOverride: followUp.weekOverride ?? null,
      sundayCount,
      lastContactDate: followUp.lastContactDate ?? null,
      latestNote: latestLog?.comment ?? null,
      latestNoteAt: latestLog?.loggedAt ?? null,
      latestNoteByClerkId: latestLog?.loggedByClerkId ?? null,
      removalRequested: followUp.removalRequested,
      removalReason: followUp.removalReason,
      daysAssigned: followUp.assignedDate ? daysSince(followUp.assignedDate, referenceDate) : null,
    };

    const bucketKey = followUp.removalRequested
      ? "removal_requests"
      : ready
        ? "graduation_ready"
        : `week${weekNumber}`;
    byKey.get(bucketKey)?.rows.push(row);
    activeRows.push(row);
  }

  for (const visitor of activeVisitors) {
    const activeFollowUp = activeFollowUpByVisitor.get(visitor._id.toString());
    if (!isAssignableVisitor(visitor) || activeFollowUp) continue;

    const sundayCount = await sundayCountForVisitor(ctx, visitor);
    const dormant = getDormantCandidate(visitor, sundayCount, false, referenceDate);
    const row = {
      followUpId: null,
      visitorId: visitor._id,
      visitorName: visitor.name,
      visitorContact: visitor.contact ?? null,
      visitorResidence: visitor.residence ?? null,
      firstVisitDate: visitor.date,
      lastAttendanceDate: visitor.lastAttendanceDate ?? null,
      assignedDate: null,
      assignedToClerkId: null,
      assigneeName: null,
      assigneePhone: null,
      assigneeAccessMode: null,
      status: null,
      statusLabel: "Unassigned",
      pipelineStage: "new",
      pipelineStageLabel: "Eligible unassigned",
      weekNumber: null,
      sundayCount,
      lastContactDate: null,
      latestNote: null,
      latestNoteAt: null,
      latestNoteByClerkId: null,
      removalRequested: false,
      removalReason: null,
      daysAssigned: null,
      daysSinceLastVisit: dormant.daysSinceLastVisit,
      dormantReason: dormant.reason,
    };

    byKey.get(dormant.eligible ? "dormant_candidates" : "eligible")?.rows.push(row);
  }

  for (const bucket of buckets) {
    bucket.rows.sort((a, b) => {
      const assigneeCompare = (a.assigneeName ?? "").localeCompare(b.assigneeName ?? "");
      if (assigneeCompare !== 0 && bucket.key !== "eligible") return assigneeCompare;
      return a.visitorName.localeCompare(b.visitorName);
    });
  }

  const team = protocolMembers
    .map((member: any) => {
      const rows = activeRows.filter((row) => row.assignedToClerkId === member.clerkId);
      const readyCount = rows.filter((row) => row.pipelineStage === "ready").length;
      return {
        _id: member._id,
        clerkId: member.clerkId,
        displayName: member.displayName,
        active: member.active,
        accessMode: member.accessMode ?? (member.clerkId.startsWith("wa:phone:") ? "whatsapp_only" : "system"),
        phone: member.phone ?? protocolPhoneFromClerkId(member.clerkId),
        activeAssignments: rows.length,
        pendingReports: rows.filter((row) => row.status === "not_contacted").length,
        readyCount,
        week1: rows.filter((row) => row.weekNumber === 1).length,
        week2: rows.filter((row) => row.weekNumber === 2).length,
        week3: rows.filter((row) => row.weekNumber === 3).length,
        week4: rows.filter((row) => row.weekNumber === 4).length,
      };
    })
    .sort((a: any, b: any) => b.activeAssignments - a.activeAssignments || a.displayName.localeCompare(b.displayName));

  const stats = {
    activeAssignments: activeRows.length,
    eligible: byKey.get("eligible")?.rows.length ?? 0,
    pendingReports: activeRows.filter((row) => row.status === "not_contacted").length,
    graduationReady: byKey.get("graduation_ready")?.rows.length ?? 0,
    dormantCandidates: byKey.get("dormant_candidates")?.rows.length ?? 0,
    removalRequests: byKey.get("removal_requests")?.rows.length ?? 0,
    graduatedAllTime: archivedFollowUps.filter((followUp: any) => followUp.status === "graduated").length,
  };

  return {
    referenceDate,
    generatedAt: Date.now(),
    buckets,
    stats,
    team,
  };
}

/** Admin workspace payload: stage buckets, team progress, and weekly export rows. */
export const adminWorkspace = query({
  args: {
    referenceDate: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    return await buildAdminWorkspace(ctx, args.referenceDate ?? todayISO());
  },
});

/** Print/share-ready weekly assignments export, grouped by every follow-up stage. */
export const weeklyAssignmentsExport = query({
  args: {
    referenceDate: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    return await buildAdminWorkspace(ctx, args.referenceDate ?? todayISO());
  },
});

/** Admin or follow-up-admin can manually override the follow-up week, bypassing time calculations. */
export const updateFollowUpWeekOverride = mutation({
  args: {
    followUpId: v.id("followUps"),
    weekOverride: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or already archived");

    if (args.weekOverride !== null && (args.weekOverride < 1 || args.weekOverride > 4)) {
      throw new Error("Invalid week override value (must be 1-4 or null)");
    }

    await ctx.db.patch(args.followUpId, {
      weekOverride: args.weekOverride,
      updatedAt: Date.now(),
    });

    // Cascade stage changes to visitor: week 4 or ready advances pipeline to "ready" stage.
    const week = args.weekOverride !== null 
      ? args.weekOverride 
      : (followUp.assignedDate ? computeFollowUpWeek(followUp.assignedDate, todayISO()) : 1);

    if (week >= 4) {
      await ctx.db.patch(followUp.visitorId, { pipelineStage: "ready" });
    } else {
      const visitor = await ctx.db.get(followUp.visitorId);
      if (visitor && visitor.pipelineStage === "ready") {
        const stage = followUp.status === "not_contacted" ? "assigned" : "in_progress";
        await ctx.db.patch(followUp.visitorId, { pipelineStage: stage });
      }
    }

    return null;
  },
});
