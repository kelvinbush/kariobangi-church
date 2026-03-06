import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isAdmin } from "./authHelpers";

export const list = query({
  args: {
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.active === true) {
      return await ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    }
    if (args.active === false) {
      return await ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", false))
        .collect();
    }
    // No filter
    return await ctx.db.query("kids").order("desc").collect();
  },
});

export const quickAdd = mutation({
  args: {
    name: v.string(),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    function toNull(s: string | undefined): string | null {
      if (s === undefined) return null;
      const t = s.trim();
      if (t === '' || t === '-' || t.toLowerCase() === 'n/a') return null;
      return t;
    }

    const contact = toNull(args.contact);
    // Removed duplicate contact check - family members can share contacts

    const id = await ctx.db.insert('kids', {
      name: args.name.trim(),
      contact,
      residence: toNull(args.residence),
      ...(args.age !== undefined ? { age: args.age } : {}),
      active: true,
      createdBy: identity.subject,
    });
    return id;
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    contact: v.string(),
    residence: v.string(),
    age: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Removed duplicate contact check - family members can share contacts

    const doc = {
      name: args.name.trim(),
      contact: args.contact.trim(),
      residence: args.residence.trim(),
      ...(args.age !== undefined ? { age: args.age } : {}),
      active: args.active ?? true,
      createdBy: identity.subject,
    };
    const id = await ctx.db.insert("kids", doc);
    return id;
  },
});

export const update = mutation({
  args: {
    kidId: v.id("kids"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    age: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const kid = await ctx.db.get(args.kidId);
    if (!kid) throw new Error("Kid not found");

    // Removed duplicate contact check - family members can share contacts

    await ctx.db.patch(args.kidId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.contact !== undefined ? { contact: args.contact } : {}),
      ...(args.residence !== undefined ? { residence: args.residence } : {}),
      ...(args.age !== undefined ? { age: args.age } : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
    });
  },
});

export const remove = mutation({
  args: { kidId: v.id("kids") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isAdmin(identity)) {
      throw new Error("Forbidden: requires admin");
    }

    const kid = await ctx.db.get(args.kidId);
    if (!kid) throw new Error("Kid not found");

    const attendanceRows = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.kidId as any))
      .collect();
    for (const row of attendanceRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.kidId);
  },
});

/** Convert a kid to a member: create member, migrate attendance, delete kid. Admin only. */
export const convertToMember = mutation({
  args: {
    kidId: v.id("kids"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    gender: v.optional(v.string()),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    if (!isAdmin(identity)) {
      throw new Error("Forbidden: requires admin");
    }

    const kid = await ctx.db.get(args.kidId);
    if (!kid) throw new Error("Kid not found");

    const name = (args.name ?? kid.name).trim();
    const contact = args.contact !== undefined ? (args.contact?.trim() || null) : kid.contact;
    const residence = args.residence !== undefined ? (args.residence?.trim() || null) : kid.residence;
    const gender = args.gender !== undefined ? (args.gender?.trim() || null) : null;
    const department = args.department !== undefined ? (args.department?.trim() || null) : null;
    const status = args.status !== undefined ? (args.status?.trim() || null) : null;

    const memberId = await ctx.db.insert("members", {
      name,
      contact,
      residence,
      gender,
      department,
      status,
      active: true,
      createdBy: identity.subject,
    });

    const attendanceRows = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.kidId as any))
      .collect();
    for (const row of attendanceRows) {
      await ctx.db.insert("attendance", {
        memberId,
        date: row.date,
        present: row.present,
        markedBy: row.markedBy,
      });
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.kidId);
    return memberId;
  },
});

export const bulkImport = mutation({
  args: { csv: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const lines = args.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return { inserted: 0, skipped: 0, errors: 0 };

    // Expect header: Number,Name,Contact,Residence,Age
    let startIndex = 0;
    const header = lines[0].toLowerCase();
    if (
      header.includes("name") &&
      header.includes("contact") &&
      header.includes("residence")
    ) {
      startIndex = 1;
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    function normalize(val: string | undefined): string | null {
      if (!val) return null;
      const v = val.trim();
      if (v === '' || v === '-' || v.toLowerCase() === 'n/a') return null;
      return v;
    }

    function parseAge(val: string | undefined): number | null {
      if (!val) return null;
      const v = val.trim();
      if (v === '' || v === '-' || v.toLowerCase() === 'n/a') return null;
      const num = parseInt(v, 10);
      if (isNaN(num) || num < 0 || num > 150) return null;
      return num;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const row = lines[i];
      const parts = row.split(',');
      if (parts.length < 3) {
        errors++;
        continue;
      }
      const [_, nameRaw, contactRaw, residenceRaw, ageRaw] = parts;
      const name = (nameRaw ?? '').trim();
      if (!name) {
        skipped++;
        continue;
      }
      const contact = normalize(contactRaw);
      const residence = normalize(residenceRaw);
      const age = parseAge(ageRaw);

      try {

        await ctx.db.insert('kids', {
          name,
          contact,
          residence,
          ...(age !== null ? { age } : {}),
          active: true,
          createdBy: identity.subject,
        });
        inserted++;
      } catch (e) {
        errors++;
      }
    }

    return { inserted, skipped, errors };
  },
});
