import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// --- Auth helpers ---
function getRoleFromIdentity(identity: { role?: string; [k: string]: unknown }): string | undefined {
  if (identity?.role) return identity.role;
  const m = identity as Record<string, unknown>;
  return (
    (m?.publicMetadata as { role?: string })?.role ??
    (m?.public_metadata as { role?: string })?.role ??
    (m?.claims as { role?: string })?.role
  );
}

function requireAdmin(identity: { subject: string; [k: string]: unknown }) {
  if (getRoleFromIdentity(identity) !== "admin") throw new Error("Forbidden: requires admin");
}

function requireFollowUpAdminOrAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin" && role !== "follow-up-admin") {
    throw new Error("Forbidden: requires admin or follow-up-admin");
  }
}


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
});

/** Visitors whose first visit date (visitors.date) is in the past 3 Sundays. Excludes children. Excludes visitors who already have an active (non-archived) follow-up. */
export const visitorsEligibleForFollowUp = query({
  args: {},
  returns: v.array(visitorDocValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const sundays = getPreviousSundays(3);
    const allVisitors: Array<{
      _id: Id<"visitors">;
      _creationTime: number;
      name: string;
      contact: string | null;
      residence: string | null;
      relationshipStatus: string | null;
      previousChurch: string | null;
      age?: number;
      date: string;
      active: boolean;
      createdBy: string;
    }> = [];
    const seen = new Set<Id<"visitors">>();

    for (const dateStr of sundays) {
      const list = await ctx.db
        .query("visitors")
        .withIndex("by_date", (q) => q.eq("date", dateStr))
        .collect();
      for (const v of list) {
        if (!v.active) continue;
        if (v.relationshipStatus === "child") continue;
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
    requireFollowUpAdminOrAdmin(identity as any);

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || !visitor.active) throw new Error("Visitor not found or inactive");

    const forVisitor = await ctx.db
      .query("followUps")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
    const existing = forVisitor.find((f) => !f.archived);
    if (existing) throw new Error("This visitor already has an active follow-up");

    const now = Date.now();
    return await ctx.db.insert("followUps", {
      visitorId: args.visitorId,
      assignedToClerkId: args.assignedToClerkId,
      status: "not_contacted",
      archived: false,
      removalRequested: false,
      removalReason: null,
      requestedAt: null,
      createdBy: identity.subject,
      updatedAt: now,
    });
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
    requireFollowUpAdminOrAdmin(identity as any);

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

    const role = getRoleFromIdentity(identity as any);
    const isAdminOrFUAdmin = role === "admin" || role === "follow-up-admin";
    const isAssignee = followUp.assignedToClerkId === identity.subject;
    if (!isAdminOrFUAdmin && !isAssignee) throw new Error("Forbidden: not assigned to this follow-up");

    const now = Date.now();
    await ctx.db.patch(args.followUpId, { status: args.status, updatedAt: now });
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

    const role = getRoleFromIdentity(identity as any);
    const isAdminOrFUAdmin = role === "admin" || role === "follow-up-admin";
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
    requireFollowUpAdminOrAdmin(identity as any);

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp || followUp.archived) throw new Error("Follow-up not found or already archived");

    await ctx.db.patch(args.followUpId, {
      archived: true,
      status: "graduated",
      updatedAt: Date.now(),
    });
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

    await ctx.db.patch(args.visitorId, { active: false });
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

// --- List queries (with visitor details) ---
const followUpWithVisitorValidator = v.object({
  _id: v.id("followUps"),
  visitorId: v.id("visitors"),
  assignedToClerkId: v.string(),
  status: v.string(),
  archived: v.boolean(),
  removalRequested: v.boolean(),
  removalReason: v.union(v.string(), v.null()),
  requestedAt: v.union(v.number(), v.null()),
  updatedAt: v.number(),
  visitorName: v.string(),
  visitorContact: v.union(v.string(), v.null()),
  visitorDate: v.string(),
});

/** All active (non-archived) follow-ups. Admin or follow-up-admin only. */
export const listAll = query({
  args: {},
  returns: v.array(followUpWithVisitorValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const list = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .order("desc")
      .collect();

    const result: Array<{
      _id: Id<"followUps">;
      visitorId: Id<"visitors">;
      assignedToClerkId: string;
      status: string;
      archived: boolean;
      removalRequested: boolean;
      removalReason: string | null;
      requestedAt: number | null;
      updatedAt: number;
      visitorName: string;
      visitorContact: string | null;
      visitorDate: string;
    }> = [];
    for (const f of list) {
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

/** My assigned follow-ups (protocol member). Protocol sees own; admin/follow-up-admin can pass clerkId to see someone else's or omit for own. */
export const myFollowUps = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  returns: v.array(followUpWithVisitorValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const role = getRoleFromIdentity(identity as any);
    const isAdminOrFUAdmin = role === "admin" || role === "follow-up-admin";
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

    const result: Array<{
      _id: Id<"followUps">;
      visitorId: Id<"visitors">;
      assignedToClerkId: string;
      status: string;
      archived: boolean;
      removalRequested: boolean;
      removalReason: string | null;
      requestedAt: number | null;
      updatedAt: number;
      visitorName: string;
      visitorContact: string | null;
      visitorDate: string;
    }> = [];
    for (const f of list) {
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

/** Follow-ups with removal requested. Admin or follow-up-admin. */
export const removalQueue = query({
  args: {},
  returns: v.array(followUpWithVisitorValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireFollowUpAdminOrAdmin(identity as any);

    const list = await ctx.db
      .query("followUps")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
    const withRequest = list.filter((f) => f.removalRequested);

    const result: Array<{
      _id: Id<"followUps">;
      visitorId: Id<"visitors">;
      assignedToClerkId: string;
      status: string;
      archived: boolean;
      removalRequested: boolean;
      removalReason: string | null;
      requestedAt: number | null;
      updatedAt: number;
      visitorName: string;
      visitorContact: string | null;
      visitorDate: string;
    }> = [];
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

const logEntryValidator = v.object({
  _id: v.id("followUpLogs"),
  followUpId: v.id("followUps"),
  status: v.string(),
  comment: v.string(),
  loggedByClerkId: v.string(),
  loggedAt: v.number(),
});

/** Log history for a follow-up. */
export const logsForFollowUp = query({
  args: { followUpId: v.id("followUps") },
  returns: v.array(logEntryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const followUp = await ctx.db.get(args.followUpId);
    if (!followUp) return [];

    const role = getRoleFromIdentity(identity as any);
    const isAdminOrFUAdmin = role === "admin" || role === "follow-up-admin";
    const isAssignee = followUp.assignedToClerkId === identity.subject;
    if (!isAdminOrFUAdmin && !isAssignee) return [];

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
      const role = getRoleFromIdentity(identity as any);
      if (role !== "admin" && role !== "follow-up-admin" && args.clerkId !== identity.subject) {
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
    requireFollowUpAdminOrAdmin(identity as any);

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
