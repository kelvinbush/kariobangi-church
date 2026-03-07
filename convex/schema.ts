import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  members: defineTable({
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
    department: v.union(v.string(), v.null()),
    status: v.union(v.string(), v.null()),
    active: v.boolean(),
    createdBy: v.string(),
  })
    .index("by_name", ["name"]) 
    .index("by_contact", ["contact"]) 
    .index("by_active", ["active"]),
  kids: defineTable({
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
    age: v.optional(v.number()),
    active: v.boolean(),
    createdBy: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_contact", ["contact"])
    .index("by_active", ["active"]),
  attendance: defineTable({
    memberId: v.union(v.id("members"), v.id("kids"), v.id("visitors")),
    date: v.string(),
    present: v.boolean(),
    markedBy: v.string(),
    arrivalTime: v.optional(v.string()), // HH:MM format for arrival time
  })
    .index("by_date", ["date"]) 
    .index("by_member_date", ["memberId", "date"]),

  // Practice attendance for worship team (Saturday practice)
  practiceAttendance: defineTable({
    memberId: v.id("members"),
    date: v.string(), // Date of the practice (typically Saturday)
    present: v.boolean(),
    arrivalTime: v.optional(v.string()), // HH:MM format
    markedBy: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_member_date", ["memberId", "date"])
    .index("by_member", ["memberId"]),
  visitors: defineTable({
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
    relationshipStatus: v.union(v.string(), v.null()), // "married" or "youth"
    previousChurch: v.union(v.string(), v.null()),
    age: v.optional(v.number()),
    date: v.string(), // The date they visited
    active: v.boolean(),
    createdBy: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_contact", ["contact"])
    .index("by_active", ["active"])
    .index("by_date", ["date"]),

  // Follow-up: protocol members are Clerk users who get assigned visitors to call.
  protocolMembers: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    active: v.boolean(),
    addedBy: v.string(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_active", ["active"]),

  // One active follow-up per visitor; archived when graduated or removed.
  followUps: defineTable({
    visitorId: v.id("visitors"),
    assignedToClerkId: v.string(),
    status: v.string(), // "not_contacted" | "contacted" | "needs_follow_up" | "graduated" | "removed"
    archived: v.boolean(),
    removalRequested: v.boolean(),
    removalReason: v.union(v.string(), v.null()),
    requestedAt: v.union(v.number(), v.null()),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_assigned", ["assignedToClerkId"])
    .index("by_status", ["status"])
    .index("by_archived", ["archived"])
    .index("by_assigned_and_archived", ["assignedToClerkId", "archived"]),

  // History of status + comment per follow-up (who called, when, what).
  followUpLogs: defineTable({
    followUpId: v.id("followUps"),
    status: v.string(),
    comment: v.string(),
    loggedByClerkId: v.string(),
    loggedAt: v.number(),
  })
    .index("by_followUp", ["followUpId"]),

  // ========== CLUSTERS SYSTEM ==========
  // Clusters - groups of members with a leader
  clusters: defineTable({
    name: v.string(),
    description: v.union(v.string(), v.null()),
    leaderClerkId: v.union(v.string(), v.null()), // Clerk ID of cluster head
    leaderMemberId: v.union(v.id("members"), v.null()), // Reference to members table
    active: v.boolean(),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_active", ["active"])
    .index("by_leader", ["leaderClerkId"])
    .index("by_active_leader", ["active", "leaderClerkId"]),

  // Cluster members - which members belong to which cluster
  clusterMembers: defineTable({
    clusterId: v.id("clusters"),
    memberId: v.id("members"),
    joinedAt: v.number(),
    addedBy: v.string(),
  })
    .index("by_cluster", ["clusterId"])
    .index("by_member", ["memberId"])
    .index("by_cluster_member", ["clusterId", "memberId"]),

  // Cluster follow-up logs - cluster head reports on absent members
  clusterFollowUpLogs: defineTable({
    clusterId: v.id("clusters"),
    memberId: v.id("members"),
    date: v.string(), // The Sunday/date member was absent
    status: v.string(), // "contacted" | "not_reachable" | "excused" | "needs_attention"
    absenceReason: v.union(v.string(), v.null()), // Why they were absent
    comment: v.string(), // Leader's notes
    requestType: v.string(), // "none" | "removal" | "bishop_attention"
    resolved: v.boolean(), // For bishop attention requests
    resolvedBy: v.union(v.string(), v.null()),
    resolvedAt: v.union(v.number(), v.null()),
    loggedByClerkId: v.string(),
    loggedAt: v.number(),
  })
    .index("by_cluster", ["clusterId"])
    .index("by_member", ["memberId"])
    .index("by_date", ["date"])
    .index("by_cluster_date", ["clusterId", "date"])
    .index("by_request_type", ["requestType"])
    .index("by_resolved", ["resolved"])
    .index("by_cluster_member_date", ["clusterId", "memberId", "date"]),

  // Pending cluster head invitations (legacy - keep for now)
  clusterHeadInvitations: defineTable({
    email: v.string(),
    name: v.string(),
    memberId: v.union(v.id("members"), v.null()),
    clusterId: v.union(v.id("clusters"), v.null()),
    status: v.string(),
    invitedBy: v.string(),
    invitedAt: v.number(),
    expiresAt: v.number(),
    clerkUserId: v.union(v.string(), v.null()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_member", ["memberId"])
    .index("by_cluster", ["clusterId"]),

  // Cluster heads - managed like protocol members (admin adds Clerk ID directly)
  clusterHeads: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    clusterId: v.union(v.id("clusters"), v.null()),
    active: v.boolean(),
    addedBy: v.string(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_active", ["active"])
    .index("by_cluster", ["clusterId"]),
});
