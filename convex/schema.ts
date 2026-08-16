import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Kariobangi attendance schema: members, kids, visitors, and attendance only.
export default defineSchema({
  members: defineTable({
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    residence: v.union(v.string(), v.null()),
    department: v.union(v.string(), v.null()),
    status: v.union(v.string(), v.null()),
    active: v.boolean(),
    createdBy: v.string(),
    graduationDate: v.optional(v.string()),
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
    graduationDate: v.optional(v.string()),
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
  visitors: defineTable({
    name: v.string(),
    contact: v.union(v.string(), v.null()),
    gender: v.optional(v.union(v.string(), v.null())),
    residence: v.union(v.string(), v.null()),
    relationshipStatus: v.union(v.string(), v.null()), // "married", "youth", "single", "child", etc.
    previousChurch: v.union(v.string(), v.null()),
    age: v.optional(v.number()),
    date: v.string(), // The date they first visited
    active: v.boolean(),
    createdBy: v.string(),
    // true  = first time in the ministry, came from another church
    // false = visiting from one of our own branches
    // unset = not recorded (legacy records)
    fromOtherChurch: v.optional(v.boolean()),
    // Lightweight tracking fields still read by the attendance roster
    pipelineStage: v.optional(v.string()),
    visitType: v.optional(v.string()), // "regular" | "passing_through" | "one_time_event"
    lastAttendanceDate: v.optional(v.union(v.string(), v.null())),
    sundayCount: v.optional(v.number()), // Cached Sunday attendance count
    graduationDate: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_contact", ["contact"])
    .index("by_active", ["active"])
    .index("by_date", ["date"])
    .index("by_pipeline_stage", ["pipelineStage"])
    .index("by_active_pipeline", ["active", "pipelineStage"]),
});
