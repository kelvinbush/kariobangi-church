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
  })
    .index("by_date", ["date"]) 
    .index("by_member_date", ["memberId", "date"]),
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
});
