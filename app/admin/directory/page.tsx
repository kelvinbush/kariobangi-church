"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate, getTodayLocal } from "@/lib/date";
import { buildDirectoryReportHtml, type DirectoryPerson } from "@/lib/directoryReport";

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7', sage: '#154618' },
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

const CATEGORIES = ["married", "youth", "single", "widowed", "child", "other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  married: "Married",
  youth: "Youth",
  single: "Single",
  widowed: "Widowed",
  child: "Child",
  other: "Unspecified",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Men",
  female: "Women",
  unspecified: "Gender not recorded",
};

// Section order in the report: men first, then women, then the unclassified tail.
const SECTION_ORDER: Array<{ gender: string; category: Category }> = [
  { gender: "male", category: "married" },
  { gender: "male", category: "youth" },
  { gender: "male", category: "single" },
  { gender: "male", category: "widowed" },
  { gender: "male", category: "other" },
  { gender: "male", category: "child" },
  { gender: "female", category: "married" },
  { gender: "female", category: "youth" },
  { gender: "female", category: "single" },
  { gender: "female", category: "widowed" },
  { gender: "female", category: "other" },
  { gender: "female", category: "child" },
  { gender: "unspecified", category: "married" },
  { gender: "unspecified", category: "youth" },
  { gender: "unspecified", category: "single" },
  { gender: "unspecified", category: "widowed" },
  { gender: "unspecified", category: "other" },
  { gender: "unspecified", category: "child" },
];

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function DemographicDirectoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  const isAdmin = useMemo(() => {
    const meta = user?.publicMetadata as { role?: string; roles?: string[] } | undefined;
    const roles = new Set<string>();
    if (meta?.role) roles.add(meta.role);
    meta?.roles?.forEach((r) => roles.add(r));
    return roles.has("admin");
  }, [user]);

  // Filters
  const [onlyActive, setOnlyActive] = useState(true);
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeVisitors, setIncludeVisitors] = useState(true);
  const [genders, setGenders] = useState<Set<string>>(new Set(["male", "female"]));
  const [categories, setCategories] = useState<Set<Category>>(new Set(["married", "youth"]));
  const [minSundays, setMinSundays] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const data = useQuery(
    api.directory.demographicDirectory,
    isAuthenticated && isAdmin ? { onlyActive } : "skip"
  );

  const people: DirectoryPerson[] = useMemo(
    () => (data?.people ?? []) as DirectoryPerson[],
    [data]
  );

  const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return people.filter((p) => {
      if (p.source === "member" && !includeMembers) return false;
      if (p.source === "visitor" && !includeVisitors) return false;
      if (!genders.has(p.gender)) return false;
      if (!categories.has(p.category as Category)) return false;
      if (p.sundayCount < minSundays) return false;
      if (q) {
        const haystack = `${p.name} ${p.contact ?? ""} ${p.residence ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [people, includeMembers, includeVisitors, genders, categories, minSundays, searchQuery]);

  // Sections used by both the on-screen preview and the PDF.
  const sections = useMemo(() => {
    return SECTION_ORDER.map(({ gender, category }) => ({
      gender,
      category,
      title: `${GENDER_LABELS[gender] ?? gender} — ${CATEGORY_LABELS[category]}`,
      rows: filtered
        .filter((p) => p.gender === gender && p.category === category)
        .sort((a, b) => b.sundayCount - a.sundayCount || a.name.localeCompare(b.name)),
    })).filter((s) => s.rows.length > 0);
  }, [filtered]);

  const summary = useMemo(() => {
    const count = (gender: string, category: Category) =>
      filtered.filter((p) => p.gender === gender && p.category === category).length;
    return {
      total: filtered.length,
      men: filtered.filter((p) => p.gender === "male").length,
      women: filtered.filter((p) => p.gender === "female").length,
      marriedMen: count("male", "married"),
      youthMen: count("male", "youth"),
      marriedWomen: count("female", "married"),
      youthWomen: count("female", "youth"),
      members: filtered.filter((p) => p.source === "member").length,
      visitors: filtered.filter((p) => p.source === "visitor").length,
      neverAttended: filtered.filter((p) => p.sundayCount === 0).length,
    };
  }, [filtered]);

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      Array.from(genders)
        .map((g) => GENDER_LABELS[g] ?? g)
        .join(" + ") || "No gender selected"
    );
    parts.push(
      Array.from(categories)
        .map((c) => CATEGORY_LABELS[c])
        .join(", ") || "No category selected"
    );
    const sources = [includeMembers ? "Members" : null, includeVisitors ? "Visitors" : null].filter(Boolean);
    parts.push(sources.join(" + ") || "No source selected");
    parts.push(onlyActive ? "Active profiles only" : "Active + inactive profiles");
    if (minSundays > 0) parts.push(`Attended ${minSundays}+ Sundays`);
    return parts.join(" · ");
  }, [genders, categories, includeMembers, includeVisitors, onlyActive, minSundays]);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Group", "Category", "Name", "Phone", "Residence", "Source", "Department",
      "Recorded Status", "First Visit", "Sundays Attended", "Total Services Attended",
      "Last Seen", "Profile Active",
    ];
    const rows = filtered
      .slice()
      .sort(
        (a, b) =>
          SECTION_ORDER.findIndex((s) => s.gender === a.gender && s.category === a.category) -
            SECTION_ORDER.findIndex((s) => s.gender === b.gender && s.category === b.category) ||
          b.sundayCount - a.sundayCount ||
          a.name.localeCompare(b.name)
      )
      .map((p) => [
        GENDER_LABELS[p.gender] ?? p.gender,
        CATEGORY_LABELS[p.category as Category] ?? p.category,
        p.name,
        // Excel formula wrapper keeps the leading zero on Kenyan numbers.
        p.contact ? `="${p.contact.replace(/\s+/g, "")}"` : "",
        p.residence ?? "",
        p.source === "member" ? "Member" : "Visitor",
        p.department ?? "",
        p.rawStatus ?? "",
        p.firstSeen ?? "",
        p.sundayCount,
        p.totalPresentCount,
        p.lastSeen ?? "",
        p.active ? "Yes" : "No",
      ]);

    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((r) =>
        r
          .map((cell, i) =>
            // Column 3 (phone) is already a raw Excel formula — do not quote it.
            i === 3 && typeof cell === "string" && cell.startsWith('="') ? cell : csvCell(cell)
          )
          .join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Kariobangi_Demographic_Directory_${getTodayLocal()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportPdf = () => {
    if (filtered.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    printWindow.document.write(
      buildDirectoryReportHtml({
        sections,
        summary,
        filterSummaryText,
        today: getTodayLocal(),
      })
    );
    printWindow.document.close();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <span className="text-sm" style={{ color: colors.text.muted }}>Loading session...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: colors.bg }}>
        <div className="text-center space-y-3">
          <h2 className="text-xl font-light">Access Denied</h2>
          <p className="text-sm text-zinc-500 max-w-sm">This page is only accessible by administrators.</p>
          <Link href="/" className="inline-block px-4 py-2 bg-[#0D9762] text-white rounded-xl text-sm mt-2">Go Home</Link>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Married Men", value: summary.marriedMen },
    { label: "Youth Men", value: summary.youthMen },
    { label: "Married Women", value: summary.marriedWomen },
    { label: "Youth Women", value: summary.youthWomen },
  ];

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>

      <div className="relative min-h-screen">
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/admin/members" className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Manage &amp; Export</Link>
            <span className="text-sm" style={{ color: colors.text.secondary }}>Demographics</span>
          </div>
          <SignedIn><UserButton /></SignedIn>
        </header>

        <main className="max-w-5xl mx-auto px-5 py-8 pb-32">
          <div className="mb-6">
            <h1 className="text-2xl font-light tracking-tight" style={{ color: colors.text.primary }}>
              Demographic Directory
            </h1>
            <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
              Men and women by life stage — members and visitors together, with first visit and Sundays attended.
            </p>
          </div>

          {/* Summary + export */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between" style={{ backgroundColor: colors.surface }}>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.text.muted }}>Selection Overview</h3>
                <div className="flex items-baseline gap-4 mb-3">
                  <span className="text-4xl font-light">{data === undefined ? "—" : summary.total}</span>
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    people · {summary.members} members, {summary.visitors} visitors
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statCards.map((c) => (
                    <div key={c.label} className="px-3 py-2 rounded-xl" style={{ backgroundColor: colors.bg }}>
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>{c.label}</div>
                      <div className="text-lg font-light" style={{ color: colors.text.primary }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleExportPdf}
                  disabled={filtered.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                  Export PDF
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={filtered.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: colors.text.secondary, backgroundColor: colors.surface }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Excel (CSV)
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="p-5 rounded-2xl shadow-sm border border-zinc-100 space-y-3.5" style={{ backgroundColor: colors.surface }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Who to include</h3>

              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>Group</div>
                <div className="flex flex-wrap gap-3">
                  {(["male", "female", "unspecified"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                      <input type="checkbox" checked={genders.has(g)} onChange={() => toggle(genders, g, setGenders)} className="rounded accent-[#0D9762]" />
                      {GENDER_LABELS[g]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>Life stage</div>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                      <input type="checkbox" checked={categories.has(c)} onChange={() => toggle(categories, c, setCategories)} className="rounded accent-[#0D9762]" />
                      {CATEGORY_LABELS[c]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-zinc-100" />

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                  <input type="checkbox" checked={includeMembers} onChange={(e) => setIncludeMembers(e.target.checked)} className="rounded accent-[#0D9762]" />
                  Members
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                  <input type="checkbox" checked={includeVisitors} onChange={(e) => setIncludeVisitors(e.target.checked)} className="rounded accent-[#0D9762]" />
                  Visitors
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                  <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="rounded accent-[#0D9762]" />
                  Only active profiles
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: colors.text.secondary }}>Minimum Sundays attended</span>
                <input
                  type="number"
                  min={0}
                  value={minSundays}
                  onChange={(e) => setMinSundays(Math.max(0, parseInt(e.target.value || "0", 10)))}
                  className="w-20 px-2 py-1.5 rounded-lg border border-zinc-200 outline-none text-sm"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone or residence..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none text-sm shadow-sm"
              style={{ backgroundColor: colors.surface, color: colors.text.primary }}
            />
          </div>

          {/* Preview grouped exactly as the PDF */}
          {data === undefined ? (
            <div className="rounded-2xl border border-zinc-100 p-8 text-center text-sm shadow-sm" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>
              Loading directory...
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-2xl border border-zinc-100 p-8 text-center text-sm shadow-sm" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>
              No one matches the current selection.
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm" style={{ backgroundColor: colors.surface }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', borderLeft: `3px solid ${colors.accent.amber}` }}>
                    <span className="text-sm font-medium" style={{ color: colors.text.primary }}>{section.title}</span>
                    <span className="text-xs" style={{ color: colors.text.muted }}>{section.rows.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                          {["Name", "Phone", "Residence", "Source", "First Visit", "Sundays", "Last Seen"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: colors.text.muted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((p) => (
                          <tr key={p.id} className="border-b last:border-none" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                            <td className="px-4 py-2.5 text-sm font-medium" style={{ color: colors.text.primary }}>
                              <div className="flex items-center gap-2">
                                <span>{p.name}</span>
                                {!p.active && <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded-full font-normal">Inactive</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm whitespace-nowrap" style={{ color: colors.text.secondary }}>{p.contact || "—"}</td>
                            <td className="px-4 py-2.5 text-sm" style={{ color: colors.text.secondary }}>{p.residence || "—"}</td>
                            <td className="px-4 py-2.5 text-xs" style={{ color: p.source === "visitor" ? colors.accent.amber : colors.text.muted }}>
                              {p.source === "visitor" ? "Visitor" : "Member"}
                            </td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: colors.text.secondary }}>
                              {p.firstSeen ? formatIsoDate(p.firstSeen) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm font-medium text-center" style={{ color: p.sundayCount === 0 ? colors.text.muted : colors.text.primary }}>
                              {p.sundayCount}
                            </td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: colors.text.secondary }}>
                              {p.lastSeen ? formatIsoDate(p.lastSeen) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
