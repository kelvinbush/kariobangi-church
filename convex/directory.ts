import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./authHelpers";
import { isSunday } from "./pipelineHelpers";

// Demographic directory: members + kids + visitors grouped by gender and life-stage
// (married / youth / single / child / ...), enriched with first-visit date and the
// number of Sundays each person has actually been marked present.

type Gender = "male" | "female" | "unspecified";
type Category = "married" | "youth" | "single" | "widowed" | "child" | "other";

function normalizeGender(raw: string | null | undefined): Gender {
  const g = (raw ?? "").trim().toLowerCase();
  if (g === "male" || g === "m" || g === "man") return "male";
  if (g === "female" || g === "f" || g === "woman") return "female";
  return "unspecified";
}

// Members carry `status`, visitors carry `relationshipStatus`. Both use the same
// vocabulary (married / youth / single / child / widow / widower).
function normalizeCategory(raw: string | null | undefined): Category {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "other";
  if (s.includes("married")) return "married";
  if (s.includes("youth") || s.includes("young")) return "youth";
  if (s.includes("widow")) return "widowed";
  if (s.includes("child") || s.includes("kid")) return "child";
  if (s.includes("single")) return "single";
  return "other";
}

type DirectoryPerson = {
  id: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: Gender;
  category: Category;
  rawStatus: string | null;
  department: string | null;
  source: "member" | "kid" | "visitor";
  active: boolean;
  age: number | null;
  registeredDate: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  sundayCount: number;
  totalPresentCount: number;
};

const personValidator = v.object({
  id: v.string(),
  name: v.string(),
  contact: v.union(v.string(), v.null()),
  residence: v.union(v.string(), v.null()),
  gender: v.string(),
  category: v.string(),
  rawStatus: v.union(v.string(), v.null()),
  department: v.union(v.string(), v.null()),
  source: v.string(), // "member" | "kid" | "visitor"
  active: v.boolean(),
  age: v.union(v.number(), v.null()),
  registeredDate: v.union(v.string(), v.null()),
  firstSeen: v.union(v.string(), v.null()),
  lastSeen: v.union(v.string(), v.null()),
  sundayCount: v.number(),
  totalPresentCount: v.number(),
});

// Sunday attendance counts keyed by person id (member, kid or visitor), so the
// admin directory can filter and sort people by how often they actually show up.
export const attendanceCounts = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      sundayCount: v.number(),
      totalPresentCount: v.number(),
      firstSeen: v.union(v.string(), v.null()),
      lastSeen: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity);

    const attendance = await ctx.db.query("attendance").collect();

    // Dates are deduplicated so a double-marked Sunday is not counted twice.
    const byPerson = new Map<string, { sundays: Set<string>; presentDates: Set<string> }>();
    for (const record of attendance) {
      if (!record.present) continue;
      const key = record.memberId as unknown as string;
      let entry = byPerson.get(key);
      if (!entry) {
        entry = { sundays: new Set<string>(), presentDates: new Set<string>() };
        byPerson.set(key, entry);
      }
      entry.presentDates.add(record.date);
      if (isSunday(record.date)) entry.sundays.add(record.date);
    }

    return Array.from(byPerson.entries()).map(([id, entry]) => {
      const dates = Array.from(entry.presentDates).sort();
      return {
        id,
        sundayCount: entry.sundays.size,
        totalPresentCount: entry.presentDates.size,
        firstSeen: dates[0] ?? null,
        lastSeen: dates[dates.length - 1] ?? null,
      };
    });
  },
});

export const demographicDirectory = query({
  args: {
    onlyActive: v.optional(v.boolean()),
  },
  returns: v.object({
    generatedAt: v.string(),
    people: v.array(personValidator),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    requireAdmin(identity);

    const onlyActive = args.onlyActive ?? false;

    const [members, kids, visitors, attendance] = await Promise.all([
      ctx.db.query("members").collect(),
      ctx.db.query("kids").collect(),
      ctx.db.query("visitors").collect(),
      ctx.db.query("attendance").collect(),
    ]);

    // One pass over attendance instead of a query per person.
    // Dates are deduplicated so a double-marked Sunday is not counted twice.
    const statsById = new Map<
      string,
      { sundays: Set<string>; presentDates: Set<string> }
    >();

    for (const record of attendance) {
      if (!record.present) continue;
      const key = record.memberId as unknown as string;
      let entry = statsById.get(key);
      if (!entry) {
        entry = { sundays: new Set<string>(), presentDates: new Set<string>() };
        statsById.set(key, entry);
      }
      entry.presentDates.add(record.date);
      if (isSunday(record.date)) entry.sundays.add(record.date);
    }

    function statsFor(id: string) {
      const entry = statsById.get(id);
      if (!entry) {
        return { sundayCount: 0, totalPresentCount: 0, firstPresent: null, lastPresent: null };
      }
      const dates = Array.from(entry.presentDates).sort();
      return {
        sundayCount: entry.sundays.size,
        totalPresentCount: entry.presentDates.size,
        firstPresent: dates[0] ?? null,
        lastPresent: dates[dates.length - 1] ?? null,
      };
    }

    const people: DirectoryPerson[] = [];

    for (const m of members) {
      if (onlyActive && !m.active) continue;
      const s = statsFor(m._id);
      // Members promoted from the visitor pipeline keep a graduation date; their
      // pre-graduation attendance is migrated across, so the earliest present date
      // is still the truest "first time at church" signal.
      const candidates = [s.firstPresent, m.graduationDate ?? null].filter(
        (d): d is string => !!d
      );
      people.push({
        id: m._id,
        name: m.name,
        contact: m.contact,
        residence: m.residence,
        gender: normalizeGender(m.gender),
        category: normalizeCategory(m.status),
        rawStatus: m.status,
        department: m.department,
        source: "member",
        active: m.active,
        age: null,
        registeredDate: m.graduationDate ?? null,
        firstSeen: candidates.length ? candidates.sort()[0] : null,
        lastSeen: s.lastPresent,
        sundayCount: s.sundayCount,
        totalPresentCount: s.totalPresentCount,
      });
    }

    // The kids register has no gender or status column, so every kid lands in the
    // "child" life stage with gender unrecorded — the directory page gives them
    // their own section rather than burying them under "gender not recorded".
    for (const k of kids) {
      if (onlyActive && !k.active) continue;
      const s = statsFor(k._id);
      const candidates = [s.firstPresent, k.graduationDate ?? null].filter(
        (d): d is string => !!d
      );
      people.push({
        id: k._id,
        name: k.name,
        contact: k.contact,
        residence: k.residence,
        gender: "unspecified",
        category: "child",
        rawStatus: "Kid",
        department: null,
        source: "kid",
        active: k.active,
        age: k.age ?? null,
        registeredDate: k.graduationDate ?? null,
        firstSeen: candidates.length ? candidates.sort()[0] : null,
        lastSeen: s.lastPresent,
        sundayCount: s.sundayCount,
        totalPresentCount: s.totalPresentCount,
      });
    }

    for (const vis of visitors) {
      if (onlyActive && !vis.active) continue;
      const s = statsFor(vis._id);
      // `visitors.date` is the recorded first-visit date; attendance may predate
      // it only in odd data, so take the earlier of the two.
      const candidates = [s.firstPresent, vis.date].filter((d): d is string => !!d);
      people.push({
        id: vis._id,
        name: vis.name,
        contact: vis.contact,
        residence: vis.residence,
        gender: normalizeGender(vis.gender),
        category: normalizeCategory(vis.relationshipStatus),
        rawStatus: vis.relationshipStatus,
        department: null,
        source: "visitor",
        active: vis.active,
        age: vis.age ?? null,
        registeredDate: vis.date,
        firstSeen: candidates.length ? candidates.sort()[0] : null,
        lastSeen: s.lastPresent ?? vis.lastAttendanceDate ?? null,
        sundayCount: s.sundayCount,
        totalPresentCount: s.totalPresentCount,
      });
    }

    people.sort((a, b) => a.name.localeCompare(b.name));

    return {
      generatedAt: new Date().toISOString(),
      people,
    };
  },
});
