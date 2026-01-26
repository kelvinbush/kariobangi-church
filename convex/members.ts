import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function isAdminIdentity(identity: any): boolean {
  return getRoleFromIdentity(identity) === "admin";
}

function getRoleFromIdentity(identity: any): string | undefined {
  // Check top-level role first (from JWT template)
  if (identity?.role) return identity.role;
  // Fallback to other possible locations
  return (
    identity?.publicMetadata?.role ??
    identity?.public_metadata?.role ??
    identity?.claims?.role ??
    identity?.claims?.publicMetadata?.role ??
    identity?.claims?.public_metadata?.role ??
    identity?.customClaims?.role ??
    identity?.customClaims?.publicMetadata?.role ??
    identity?.customClaims?.public_metadata?.role
  );
}

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

    if (!isAdminIdentity(identity as any)) {
      const role = getRoleFromIdentity(identity as any);
      throw new Error(`Forbidden (role=${role ?? "undefined"}). Configure Clerk JWT template 'convex' to include role.`);
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
