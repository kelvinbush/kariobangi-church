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
});
