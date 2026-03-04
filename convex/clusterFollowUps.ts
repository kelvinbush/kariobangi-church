import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============ Auth Helpers ============
function getRoleFromIdentity(identity: { role?: string; [k: string]: unknown }): string | undefined {
  if (identity?.role) return identity.role;
  const m = identity as Record<string, unknown>;
  return (
    (m?.publicMetadata as { role?: string })?.role ??
    (m?.public_metadata as { role?: string })?.role ??
    (m?.metadata as { role?: string })?.role ??
    (m?.claims as { role?: string })?.role
  );
}

function requireClusterAdminOrAdmin(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "admin" && role !== "cluster-admin") {
    throw new Error("Forbidden: requires admin or cluster-admin");
  }
}

function requireClusterHead(identity: { subject: string; [k: string]: unknown }) {
  const role = getRoleFromIdentity(identity);
  if (role !== "cluster-head" && role !== "admin" && role !== "cluster-admin") {
    throw new Error("Forbidden: requires cluster-head");
  }
}

// ============ Date Helpers ============
function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay() === 0;
}

function getLastSunday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  date.setUTCDate(date.getUTCDate() - daysToSubtract);
  
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousSunday(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  // If today is Sunday, return today (not last Sunday)
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  d.setDate(d.getDate() - daysToSubtract);
  d.setHours(0, 0, 0, 0);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get all Sundays within the last N weeks */
function getRecentSundays(weeks: number): string[] {
  const sundays: string[] = [];
  const today = new Date();
  const currentDay = today.getDay();
  
  // Start from most recent Sunday (today if it's Sunday)
  const mostRecentSunday = new Date(today);
  mostRecentSunday.setDate(today.getDate() - (currentDay === 0 ? 0 : currentDay));
  
  for (let i = 0; i < weeks; i++) {
    const d = new Date(mostRecentSunday);
    d.setDate(mostRecentSunday.getDate() - (i * 7));
    
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${day}`);
  }
  
  return sundays;
}

/** Check ialso inf a date is within the last N Sundays */
function isWithinRecentSundays(date: string, weeks: number): boolean {
  const recentSundays = getRecentSundays(weeks);
  return recentSundays.includes(date);
}

/** Validate that cluster heads can only report for Sundays within last 4 weeks */
function validateSundayReporting(date: string, isClusterHead: boolean): void {
  if (!isSunday(date)) {
    throw new Error("Reports can only be made for Sundays");
  }
  
  if (isClusterHead) {
    // Cluster heads can report for any of the last 4 Sundays
    if (!isWithinRecentSundays(date, 4)) {
      throw new Error("You can only report for Sundays within the last 4 weeks");
    }
  }
}

// ============ Queries ============

/** Get absent members for a cluster on a specific date (default: last Sunday) */
export const getAbsentMembers = query({
  args: {
    clusterId: v.id("clusters"),
    date: v.optional(v.string()),
  },
  returns: v.array(v.object({
    memberId: v.id("members"),
    memberName: v.string(),
    memberContact: v.union(v.string(), v.null()),
    memberResidence: v.union(v.string(), v.null()),
    hasExistingLog: v.boolean(),
    existingLogId: v.union(v.id("clusterFollowUpLogs"), v.null()),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterHead(identity as any);

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.active) throw new Error("Cluster is not active");

    // Verify the user is the cluster leader (or admin)
    const role = getRoleFromIdentity(identity as any);
    const isClusterHead = role === "cluster-head";
    if (isClusterHead && cluster.leaderClerkId !== identity.subject) {
      throw new Error("Forbidden: not the leader of this cluster");
    }

    // Get the date to check (default to last Sunday)
    const today = new Date().toISOString().split("T")[0];
    const checkDate = args.date ?? getLastSunday(today);

    // Cluster heads can view/report for any of the last 4 Sundays
    if (isClusterHead && args.date) {
      if (!isWithinRecentSundays(args.date, 4)) {
        throw new Error("You can only view reports for Sundays within the last 4 weeks");
      }
    }

    // Get all cluster members
    const clusterMembers = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
      .collect();

    const memberIds = clusterMembers.map((cm) => cm.memberId);

    // Get attendance records for this date
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", checkDate))
      .collect();

    const presentMemberIds = new Set(
      attendanceRecords
        .filter((r) => r.present)
        .map((r) => r.memberId.toString())
    );

    // Get existing follow-up logs for this date
    const existingLogs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_cluster_date", (q) => 
        q.eq("clusterId", args.clusterId).eq("date", checkDate)
      )
      .collect();

    const loggedMemberIds = new Map<string, Id<"clusterFollowUpLogs">>();
    for (const log of existingLogs) {
      loggedMemberIds.set(log.memberId.toString(), log._id);
    }

    // Find absent members
    const absentMembers = [];
    for (const memberId of memberIds) {
      const member = await ctx.db.get(memberId);
      if (!member || !member.active) continue;

      if (!presentMemberIds.has(memberId.toString())) {
        const existingLogId = loggedMemberIds.get(memberId.toString()) ?? null;
        absentMembers.push({
          memberId,
          memberName: member.name,
          memberContact: member.contact,
          memberResidence: member.residence,
          hasExistingLog: !!existingLogId,
          existingLogId,
        });
      }
    }

    return absentMembers.sort((a, b) => a.memberName.localeCompare(b.memberName));
  },
});

/** Get follow-up logs for a cluster */
export const getLogs = query({
  args: {
    clusterId: v.id("clusters"),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("clusterFollowUpLogs"),
    memberId: v.id("members"),
    memberName: v.string(),
    date: v.string(),
    status: v.string(),
    absenceReason: v.union(v.string(), v.null()),
    comment: v.string(),
    requestType: v.string(),
    resolved: v.boolean(),
    resolvedBy: v.union(v.string(), v.null()),
    resolvedAt: v.union(v.number(), v.null()),
    loggedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");

    const role = getRoleFromIdentity(identity as any);
    const isAdmin = role === "admin" || role === "cluster-admin";
    const isLeader = cluster.leaderClerkId === identity.subject;

    if (!isAdmin && !isLeader) {
      throw new Error("Forbidden: not authorized to view this cluster");
    }

    let logs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
      .order("desc")
      .collect();

    if (args.status) {
      logs = logs.filter((l) => l.status === args.status);
    }

    if (args.limit) {
      logs = logs.slice(0, args.limit);
    }

    const result = [];
    for (const log of logs) {
      const member = await ctx.db.get(log.memberId);
      result.push({
        _id: log._id,
        memberId: log.memberId,
        memberName: member?.name ?? "Unknown",
        date: log.date,
        status: log.status,
        absenceReason: log.absenceReason,
        comment: log.comment,
        requestType: log.requestType,
        resolved: log.resolved,
        resolvedBy: log.resolvedBy,
        resolvedAt: log.resolvedAt,
        loggedAt: log.loggedAt,
      });
    }

    return result;
  },
});

/** Get logs for a specific member */
export const getMemberLogs = query({
  args: {
    memberId: v.id("members"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("clusterFollowUpLogs"),
    clusterId: v.id("clusters"),
    clusterName: v.string(),
    date: v.string(),
    status: v.string(),
    absenceReason: v.union(v.string(), v.null()),
    comment: v.string(),
    requestType: v.string(),
    resolved: v.boolean(),
    loggedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterHead(identity as any);

    let logs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .order("desc")
      .collect();

    if (args.limit) {
      logs = logs.slice(0, args.limit);
    }

    const result = [];
    for (const log of logs) {
      const cluster = await ctx.db.get(log.clusterId);
      result.push({
        _id: log._id,
        clusterId: log.clusterId,
        clusterName: cluster?.name ?? "Unknown",
        date: log.date,
        status: log.status,
        absenceReason: log.absenceReason,
        comment: log.comment,
        requestType: log.requestType,
        resolved: log.resolved,
        loggedAt: log.loggedAt,
      });
    }

    return result;
  },
});

/** Get pending bishop attention requests (for future bishop dashboard) */
export const getBishopAttentionRequests = query({
  args: {
    resolved: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("clusterFollowUpLogs"),
    clusterId: v.id("clusters"),
    clusterName: v.string(),
    memberId: v.id("members"),
    memberName: v.string(),
    memberContact: v.union(v.string(), v.null()),
    date: v.string(),
    comment: v.string(),
    loggedAt: v.number(),
    resolved: v.boolean(),
    resolvedBy: v.union(v.string(), v.null()),
    resolvedAt: v.union(v.number(), v.null()),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    let logs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_request_type", (q) => q.eq("requestType", "bishop_attention"))
      .collect();

    if (args.resolved !== undefined) {
      logs = logs.filter((l) => l.resolved === args.resolved);
    }

    logs.sort((a, b) => b.loggedAt - a.loggedAt);

    const result = [];
    for (const log of logs) {
      const [cluster, member] = await Promise.all([
        ctx.db.get(log.clusterId),
        ctx.db.get(log.memberId),
      ]);

      result.push({
        _id: log._id,
        clusterId: log.clusterId,
        clusterName: cluster?.name ?? "Unknown",
        memberId: log.memberId,
        memberName: member?.name ?? "Unknown",
        memberContact: member?.contact ?? null,
        date: log.date,
        comment: log.comment,
        loggedAt: log.loggedAt,
        resolved: log.resolved,
        resolvedBy: log.resolvedBy,
        resolvedAt: log.resolvedAt,
      });
    }

    return result;
  },
});

/** Get cluster head's pending follow-ups count */
export const getPendingFollowUpCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const role = getRoleFromIdentity(identity as any);
    if (role !== "cluster-head") return 0;

    // Get the cluster led by this user
    const cluster = await ctx.db
      .query("clusters")
      .withIndex("by_active_leader", (q) => 
        q.eq("active", true).eq("leaderClerkId", identity.subject)
      )
      .first();

    if (!cluster) return 0;

    // Get last Sunday
    const today = new Date().toISOString().split("T")[0];
    const lastSunday = getLastSunday(today);

    // Get cluster members
    const clusterMembers = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster", (q) => q.eq("clusterId", cluster._id))
      .collect();

    const memberIds = clusterMembers.map((cm) => cm.memberId.toString());

    if (memberIds.length === 0) return 0;

    // Get attendance for last Sunday
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", lastSunday))
      .collect();

    // Count absent members
    const presentIds = new Set(
      attendanceRecords
        .filter((r) => r.present)
        .map((r) => r.memberId.toString())
    );

    // Get already logged absences
    const existingLogs = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_cluster_date", (q) => 
        q.eq("clusterId", cluster._id).eq("date", lastSunday)
      )
      .collect();

    const loggedMemberIds = new Set(existingLogs.map((l) => l.memberId.toString()));

    // Count members who are absent and not yet logged
    let pendingCount = 0;
    for (const memberId of memberIds) {
      if (!presentIds.has(memberId) && !loggedMemberIds.has(memberId)) {
        pendingCount++;
      }
    }

    return pendingCount;
  },
});

/** Get follow-up progress summary for all clusters (for admin dashboard) */
export const getAllClustersProgress = query({
  args: {
    date: v.optional(v.string()),
  },
  returns: v.array(v.object({
    clusterId: v.id("clusters"),
    clusterName: v.string(),
    totalMembers: v.number(),
    absentCount: v.number(),
    loggedCount: v.number(),
    pendingCount: v.number(),
    completionRate: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    // Get all active clusters
    const clusters = await ctx.db
      .query("clusters")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    // Get the date to check (default to last Sunday)
    const today = new Date().toISOString().split("T")[0];
    const checkDate = args.date ?? getLastSunday(today);

    const result = [];

    for (const cluster of clusters) {
      // Get cluster members
      const clusterMembers = await ctx.db
        .query("clusterMembers")
        .withIndex("by_cluster", (q) => q.eq("clusterId", cluster._id))
        .collect();

      const memberIds = clusterMembers.map((cm) => cm.memberId.toString());
      const totalMembers = memberIds.length;

      if (totalMembers === 0) {
        result.push({
          clusterId: cluster._id,
          clusterName: cluster.name,
          totalMembers: 0,
          absentCount: 0,
          loggedCount: 0,
          pendingCount: 0,
          completionRate: 100,
        });
        continue;
      }

      // Get attendance records for this date
      const attendanceRecords = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", checkDate))
        .collect();

      const presentIds = new Set(
        attendanceRecords
          .filter((r) => r.present)
          .map((r) => r.memberId.toString())
      );

      // Count absent members
      const absentMemberIds = memberIds.filter((id) => !presentIds.has(id));
      const absentCount = absentMemberIds.length;

      // Get existing logs for this date
      const existingLogs = await ctx.db
        .query("clusterFollowUpLogs")
        .withIndex("by_cluster_date", (q) => 
          q.eq("clusterId", cluster._id).eq("date", checkDate)
        )
        .collect();

      const loggedCount = existingLogs.length;
      const pendingCount = absentCount - loggedCount;
      const completionRate = absentCount > 0 
        ? Math.round((loggedCount / absentCount) * 100) 
        : 100;

      result.push({
        clusterId: cluster._id,
        clusterName: cluster.name,
        totalMembers,
        absentCount,
        loggedCount,
        pendingCount: Math.max(0, pendingCount),
        completionRate,
      });
    }

    return result;
  },
});

// ============ Mutations ============

/** Add a follow-up log for an absent member */
export const addLog = mutation({
  args: {
    clusterId: v.id("clusters"),
    memberId: v.id("members"),
    date: v.string(),
    status: v.string(), // "contacted" | "not_reachable" | "excused" | "needs_attention"
    absenceReason: v.optional(v.string()),
    comment: v.string(),
    requestType: v.optional(v.string()), // "none" | "removal" | "bishop_attention"
  },
  returns: v.id("clusterFollowUpLogs"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterHead(identity as any);

    const cluster = await ctx.db.get(args.clusterId);
    if (!cluster) throw new Error("Cluster not found");
    if (!cluster.active) throw new Error("Cluster is not active");

    // Verify the user is the cluster leader (or admin)
    const role = getRoleFromIdentity(identity as any);
    if (role === "cluster-head" && cluster.leaderClerkId !== identity.subject) {
      throw new Error("Forbidden: not the leader of this cluster");
    }

    // Verify member is in this cluster
    const clusterMember = await ctx.db
      .query("clusterMembers")
      .withIndex("by_cluster_member", (q) => 
        q.eq("clusterId", args.clusterId).eq("memberId", args.memberId)
      )
      .first();

    if (!clusterMember) {
      throw new Error("Member is not in this cluster");
    }

    // Validate date - cluster heads can only report for previous Sunday
    const isClusterHead = role === "cluster-head";
    validateSundayReporting(args.date, isClusterHead);

    // Check if log already exists for this member/date/cluster
    const existingLog = await ctx.db
      .query("clusterFollowUpLogs")
      .withIndex("by_cluster_member_date", (q) => 
        q.eq("clusterId", args.clusterId)
          .eq("memberId", args.memberId)
          .eq("date", args.date)
      )
      .first();

    const now = Date.now();

    if (existingLog) {
      // Update existing log
      await ctx.db.patch(existingLog._id, {
        status: args.status,
        absenceReason: args.absenceReason?.trim() ?? null,
        comment: args.comment.trim(),
        requestType: args.requestType ?? "none",
        loggedByClerkId: identity.subject,
        loggedAt: now,
      });
      return existingLog._id;
    }

    // Create new log
    return await ctx.db.insert("clusterFollowUpLogs", {
      clusterId: args.clusterId,
      memberId: args.memberId,
      date: args.date,
      status: args.status,
      absenceReason: args.absenceReason?.trim() ?? null,
      comment: args.comment.trim(),
      requestType: args.requestType ?? "none",
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      loggedByClerkId: identity.subject,
      loggedAt: now,
    });
  },
});

/** Mark a bishop attention request as resolved */
export const resolveAttentionRequest = mutation({
  args: {
    logId: v.id("clusterFollowUpLogs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const log = await ctx.db.get(args.logId);
    if (!log) throw new Error("Log not found");
    if (log.requestType !== "bishop_attention") {
      throw new Error("This is not a bishop attention request");
    }
    if (log.resolved) {
      throw new Error("Request is already resolved");
    }

    await ctx.db.patch(args.logId, {
      resolved: true,
      resolvedBy: identity.subject,
      resolvedAt: Date.now(),
    });

    return null;
  },
});

/** Update an existing log (only by the person who created it or admin) */
export const updateLog = mutation({
  args: {
    logId: v.id("clusterFollowUpLogs"),
    status: v.optional(v.string()),
    absenceReason: v.optional(v.string()),
    comment: v.optional(v.string()),
    requestType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const log = await ctx.db.get(args.logId);
    if (!log) throw new Error("Log not found");

    const role = getRoleFromIdentity(identity as any);
    const isAdmin = role === "admin" || role === "cluster-admin";
    const isCreator = log.loggedByClerkId === identity.subject;

    if (!isAdmin && !isCreator) {
      throw new Error("Forbidden: can only edit your own logs");
    }

    const updates: {
      status?: string;
      absenceReason?: string | null;
      comment?: string;
      requestType?: string;
      loggedAt?: number;
    } = { loggedAt: Date.now() };

    if (args.status !== undefined) updates.status = args.status;
    if (args.absenceReason !== undefined) updates.absenceReason = args.absenceReason?.trim() ?? null;
    if (args.comment !== undefined) updates.comment = args.comment.trim();
    if (args.requestType !== undefined) updates.requestType = args.requestType;

    await ctx.db.patch(args.logId, updates);
    return null;
  },
});

/** Delete a log (admin only) */
export const deleteLog = mutation({
  args: {
    logId: v.id("clusterFollowUpLogs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireClusterAdminOrAdmin(identity as any);

    const log = await ctx.db.get(args.logId);
    if (!log) throw new Error("Log not found");

    await ctx.db.delete(args.logId);
    return null;
  },
});
