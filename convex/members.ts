import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isAdmin, getRoleFromIdentity, isProtocolTeam } from "./authHelpers";

export const list = query({
  args: {
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.active === true) {
      return await ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
    }
    if (args.active === false) {
      return await ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", false))
        .collect();
    }
    // No filter
    return await ctx.db.query("members").order("desc").collect();
  },
});

export const quickAdd = mutation({
  args: {
    name: v.string(),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    gender: v.optional(v.string()),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
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

    const id = await ctx.db.insert('members', {
      name: args.name.trim(),
      contact,
      residence: toNull(args.residence),
      gender: toNull(args.gender),
      department: toNull(args.department),
      status: toNull(args.status),
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
    gender: v.string(),
    residence: v.string(),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Removed duplicate contact check - family members can share contacts

    const doc = {
      name: args.name.trim(),
      contact: args.contact.trim(),
      gender: args.gender.trim(),
      residence: args.residence.trim(),
      department: null,
      status: null,
      active: args.active ?? true,
      createdBy: identity.subject,
    };
    const id = await ctx.db.insert("members", doc);
    return id;
  },
});

export const update = mutation({
  args: {
    memberId: v.id("members"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    gender: v.optional(v.string()),
    residence: v.optional(v.string()),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Removed duplicate contact check - family members can share contacts

    await ctx.db.patch(args.memberId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.contact !== undefined ? { contact: args.contact } : {}),
      ...(args.gender !== undefined ? { gender: args.gender } : {}),
      ...(args.residence !== undefined ? { residence: args.residence } : {}),
      ...(args.department !== undefined ? { department: args.department } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
    });
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isAdmin(identity)) {
      throw new Error("Forbidden: requires admin");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const attendanceRows = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
      .collect();
    for (const row of attendanceRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.memberId);
  },
});

/** Delete several members at once, cascading their attendance records. Admin only. */
export const bulkRemove = mutation({
  args: { memberIds: v.array(v.id("members")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isAdmin(identity)) {
      throw new Error("Forbidden: requires admin");
    }

    let deleted = 0;
    for (const memberId of args.memberIds) {
      const member = await ctx.db.get(memberId);
      if (!member) continue;

      const attendanceRows = await ctx.db
        .query("attendance")
        .withIndex("by_member_date", (q) => q.eq("memberId", memberId))
        .collect();
      for (const row of attendanceRows) {
        await ctx.db.delete(row._id);
      }

      await ctx.db.delete(memberId);
      deleted++;
    }
    return deleted;
  },
});

/** Convert a member to a kid: create kid, migrate attendance, delete member. Admin only. */
export const convertToKid = mutation({
  args: {
    memberId: v.id("members"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    residence: v.optional(v.string()),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    if (!isAdmin(identity)) {
      throw new Error("Forbidden: requires admin");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const name = (args.name ?? member.name).trim();
    const contact = args.contact !== undefined ? (args.contact?.trim() || null) : member.contact;
    const residence = args.residence !== undefined ? (args.residence?.trim() || null) : member.residence;
    const age = args.age;

    const kidId = await ctx.db.insert("kids", {
      name,
      contact,
      residence,
      ...(age !== undefined ? { age } : {}),
      active: true,
      createdBy: identity.subject,
    });

    const attendanceRows = await ctx.db
      .query("attendance")
      .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId))
      .collect();
    for (const row of attendanceRows) {
      await ctx.db.insert("attendance", {
        memberId: kidId,
        date: row.date,
        present: row.present,
        markedBy: row.markedBy,
      });
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.memberId);
    return kidId;
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

    // Expect header: Name,Contact,Residence,Department,Status,Gender
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

    function inferGender(name: string, department: string | null, status: string | null): string | null {
      const n = name.toLowerCase();
      if (n.startsWith('mr ')) return 'male';
      if (n.startsWith('mrs') || n.startsWith('ms') || n.startsWith('miss')) return 'female';
      const d = (department ?? '').toLowerCase();
      const s = (status ?? '').toLowerCase();
      if (d.includes('women')) return 'female';
      if (d.includes('men')) return 'male';
      if (s.includes('women') || s.includes('mother')) return 'female';
      return null; // unknown
    }

    function normalizeGender(val: string | null): string | null {
      if (!val) return null;
      const g = val.trim().toLowerCase();
      if (!g) return null;
      if (g.startsWith('m')) return 'male';
      if (g.startsWith('f')) return 'female';
      return null;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const row = lines[i];
      const parts = row.split(',');
      if (parts.length < 5) {
        errors++;
        continue;
      }
      const [nameRaw, contactRaw, residenceRaw, departmentRaw, statusRaw, genderRaw] = parts;
      const name = (nameRaw ?? '').trim();
      if (!name) {
        skipped++;
        continue;
      }
      const contact = normalize(contactRaw);
      const residence = normalize(residenceRaw);
      const department = normalize(departmentRaw);
      const status = normalize(statusRaw);
      const providedGender = normalizeGender(normalize(genderRaw));
      const gender = providedGender ?? inferGender(name, department, status);

      try {
        // Removed duplicate contact check - family members can share contacts
        // Contact is kept for querying purposes but not enforced as unique

        await ctx.db.insert('members', {
          name,
          contact,
          gender,
          residence,
          department,
          status,
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

export const getDormantMembersAndKids = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      type: v.string(),
      contact: v.union(v.string(), v.null()),
      residence: v.union(v.string(), v.null()),
      lastSeen: v.union(v.string(), v.null()),
      daysInactive: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden");
    }

    const [members, kids] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
      ctx.db
        .query("kids")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect(),
    ]);

    // Fetch all attendance in the last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const targetDate = sixtyDaysAgo.toISOString().split("T")[0];
    const recentAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.gte("date", targetDate))
      .collect();

    // Map memberId to latest attendance date (only from present: true records)
    const latestRecentDates = new Map<string, string>();
    for (const record of recentAttendance) {
      if (record.present) {
        const idStr = record.memberId.toString();
        const current = latestRecentDates.get(idStr);
        if (!current || record.date > current) {
          latestRecentDates.set(idStr, record.date);
        }
      }
    }

    const sixtyDaysAgoMs = sixtyDaysAgo.getTime();
    const dormantList: any[] = [];
    const today = new Date();

    for (const entity of members) {
      // Skip if created recently (less than 60 days ago)
      if (entity._creationTime >= sixtyDaysAgoMs) continue;

      const idStr = entity._id.toString();
      const hasRecent = latestRecentDates.has(idStr);

      if (!hasRecent) {
        // Find their absolute last seen date
        const allHistory = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", entity._id))
          .collect();
        const lastPresent = allHistory.filter((a) => a.present).sort((a, b) => b.date.localeCompare(a.date))[0];
        
        const lastSeen = lastPresent?.date || null;
        let daysInactive = 999; // Default for never seen
        if (lastSeen) {
          const [y, m, d] = lastSeen.split("-").map(Number);
          const lastDateObj = new Date(Date.UTC(y, m - 1, d));
          daysInactive = Math.floor((today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
        }

        dormantList.push({
          id: idStr,
          name: entity.name,
          type: "member",
          contact: entity.contact || null,
          residence: entity.residence || null,
          lastSeen,
          daysInactive,
        });
      }
    }

    for (const entity of kids) {
      // Skip if created recently (less than 60 days ago)
      if (entity._creationTime >= sixtyDaysAgoMs) continue;

      const idStr = entity._id.toString();
      const hasRecent = latestRecentDates.has(idStr);

      if (!hasRecent) {
        // Find their absolute last seen date
        const allHistory = await ctx.db
          .query("attendance")
          .withIndex("by_member_date", (q) => q.eq("memberId", entity._id))
          .collect();
        const lastPresent = allHistory.filter((a) => a.present).sort((a, b) => b.date.localeCompare(a.date))[0];
        
        const lastSeen = lastPresent?.date || null;
        let daysInactive = 999; // Default for never seen
        if (lastSeen) {
          const [y, m, d] = lastSeen.split("-").map(Number);
          const lastDateObj = new Date(Date.UTC(y, m - 1, d));
          daysInactive = Math.floor((today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
        }

        dormantList.push({
          id: idStr,
          name: entity.name,
          type: "kid",
          contact: entity.contact || null,
          residence: entity.residence || null,
          lastSeen,
          daysInactive,
        });
      }
    }

    return dormantList.sort((a, b) => b.daysInactive - a.daysInactive);
  },
});

export const bulkMarkInactiveMembersAndKids = mutation({
  args: {
    ids: v.array(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (!isProtocolTeam(identity)) {
      throw new Error("Forbidden");
    }

    let count = 0;
    for (const idStr of args.ids) {
      try {
        const memberId = ctx.db.normalizeId("members", idStr);
        if (memberId) {
          const doc = await ctx.db.get(memberId);
          if (doc && doc.active) {
            await ctx.db.patch(memberId, { active: false });
            count++;
            continue;
          }
        }
      } catch { /* ignore */ }

      try {
        const kidId = ctx.db.normalizeId("kids", idStr);
        if (kidId) {
          const doc = await ctx.db.get(kidId);
          if (doc && doc.active) {
            await ctx.db.patch(kidId, { active: false });
            count++;
          }
        }
      } catch { /* ignore */ }
    }

    return count;
  },
});

