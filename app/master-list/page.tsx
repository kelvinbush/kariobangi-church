"use client";

import { useMemo, useState, useEffect } from "react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import type { Id } from "@/convex/_generated/dataModel";

// ── Icons (inline SVG) ─────────────────────────────────────
const Icons = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.24a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 22 16.92z"/></svg>,
  pin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  sort: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M3 12h12M3 18h6"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 18 6-6-6-6"/></svg>,
};

// ── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDate();
  const suffix = [, "st", "nd", "rd"][day % 10 > 3 ? 0 : (day % 100) - (day % 10) !== 10 ? day % 10 : 0] || "th";
  const mon = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}${suffix} ${mon} ${y}`;
}

function getLast12Sundays(): string[] {
  const sundays: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // most recent Sunday
  for (let i = 0; i < 12; i++) {
    const iso = d.toISOString().split("T")[0];
    sundays.push(iso);
    d.setDate(d.getDate() - 7);
  }
  return sundays.reverse();
}

function getRecencyFromDate(dateStr: string | null | undefined): { label: string; color: string; dot: string } {
  if (!dateStr) return { label: "No data", color: "#c4c0ba", dot: "#d4d0ca" };
  const [y, m, d] = dateStr.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, d));
  const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return { label: "Today", color: "#6b8a5e", dot: "#6b8a5e" };
  if (days <= 7) return { label: `${days}d ago`, color: "#6b8a5e", dot: "#6b8a5e" };
  if (days <= 14) return { label: `${Math.floor(days / 7)}w ago`, color: "#9a7d4e", dot: "#c9a87c" };
  if (days <= 28) return { label: `${Math.floor(days / 7)}w ago`, color: "#8a7a64", dot: "#b0a898" };
  if (days <= 60) return { label: `${Math.floor(days / 30)}mo ago`, color: "#999", dot: "#c4c0ba" };
  return { label: `${Math.floor(days / 30)}mo ago`, color: "#b0ada8", dot: "#d4d0ca" };
}

// ── Toast ───────────────────────────────────────────────────
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm bg-[#303030] text-white/90 rounded-xl px-4 py-3 z-50 text-sm flex items-center justify-between gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/40 hover:text-white/70">{Icons.close}</button>
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────
type PersonType = "member" | "kid" | "visitor";
type Person = {
  _id: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  active: boolean;
  type: PersonType;
  age?: number | null;
  relationshipStatus?: string | null;
  previousChurch?: string | null;
  date?: string;
  lastAttendanceDate?: string | null;
  pipelineStage?: string;
};

// ── Type badges ─────────────────────────────────────────────
const typeBadge: Record<PersonType, { bg: string; text: string; label: string }> = {
  member: { bg: "#c5d4be", text: "#5a7a4e", label: "Member" },
  kid: { bg: "#e8dcc8", text: "#9a7d4e", label: "Kid" },
  visitor: { bg: "#e8e6e3", text: "#6b6864", label: "Visitor" },
};

// ── Main page ───────────────────────────────────────────────
export default function MasterListPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [typeFilter, setTypeFilter] = useState<"all" | PersonType>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [copied, setCopied] = useState(false);

  const members = useQuery(api.members.list, isAuthenticated ? { active: undefined } : "skip");
  const kids = useQuery(api.kids.list, isAuthenticated ? { active: undefined } : "skip");
  const visitors = useQuery(api.visitors.list, isAuthenticated ? {} : "skip");

  const updateMember = useMutation(api.members.update);

  // Sidesheet attendance data
  const attendanceHistory = useQuery(
    api.attendance.historyForMember,
    isAuthenticated && selectedPerson ? { memberId: selectedPerson._id as any } : "skip"
  );

  // Build combined list
  const allPeople = useMemo(() => {
    const list: Person[] = [
      ...(members || []).map((m: any) => ({
        ...m, type: "member" as const,
      })),
      ...(kids || []).map((k: any) => ({
        ...k, type: "kid" as const, gender: null, department: null, status: null,
      })),
      ...(visitors || [])
        .filter((v: any) => {
          const stage = v.pipelineStage || "new";
          return stage !== "graduated" && stage !== "dropped";
        })
        .map((v: any) => ({
          ...v, type: "visitor" as const, department: null, status: null,
        })),
    ];
    return list;
  }, [members, kids, visitors]);

  // Filter
  const filtered = useMemo(() => {
    return allPeople
      .filter((p) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const searchable = `${p.name} ${p.contact || ""} ${p.residence || ""} ${p.department || ""} ${p.status || ""}`.toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        if (typeFilter !== "all" && p.type !== typeFilter) return false;
        if (statusFilter === "active" && !p.active) return false;
        if (statusFilter === "inactive" && p.active) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPeople, searchQuery, typeFilter, statusFilter]);

  // Stats (active only)
  const stats = useMemo(() => {
    const activeMembers = (members || []).filter((m: any) => m.active).length;
    const activeKids = (kids || []).filter((k: any) => k.active).length;
    const activeVisitors = (visitors || []).filter((v: any) => {
      const stage = v.pipelineStage || "new";
      return v.active && stage !== "graduated" && stage !== "dropped";
    }).length;
    const inactive =
      (members || []).filter((m: any) => !m.active).length +
      (kids || []).filter((k: any) => !k.active).length;
    return { total: activeMembers + activeKids + activeVisitors, members: activeMembers, kids: activeKids, visitors: activeVisitors, inactive };
  }, [members, kids, visitors]);

  // Copy phone numbers
  const copyPhoneNumbers = async () => {
    const phones = filtered
      .filter((p) => p.type !== "kid" && p.contact?.trim())
      .map((p) => p.contact!.trim());
    if (!phones.length) return;
    try {
      await navigator.clipboard.writeText(phones.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  // CSV export
  const exportCSV = () => {
    if (!filtered.length) return;
    const prefix = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const headers = ["Name Prefix", "First Name", "Phone 1 - Value", "Address 1 - Street", "Notes"];
    const rows = filtered.map((p) => {
      const notes: string[] = [];
      if (p.type === "member") {
        if (p.status) notes.push(`Status: ${p.status}`);
        if (p.department) notes.push(`Dept: ${p.department}`);
        notes.push("Type: Member");
      } else if (p.type === "kid") {
        notes.push("Type: Kid");
        if (p.age) notes.push(`Age: ${p.age}`);
      } else {
        notes.push("Type: Visitor");
      }
      return [prefix, p.name, p.contact || "", p.residence || "", notes.join(" | ")];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `master-list-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Toggle active
  const handleToggleActive = async (person: Person) => {
    if (person.type !== "member") return;
    try {
      await updateMember({ memberId: person._id as Id<"members">, active: !person.active });
      setToast(`${person.name} marked ${person.active ? "inactive" : "active"}`);
      setSelectedPerson(null);
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
  };

  // Heatmap data
  const sundays = getLast12Sundays();
  const heatmapData = useMemo(() => {
    if (!attendanceHistory) return null;
    const map = new Map<string, boolean>();
    attendanceHistory.forEach((r: any) => { if (r.present !== undefined) map.set(r.date, r.present); });
    return sundays.map((date) => ({
      date,
      day: new Date(date + "T00:00:00Z").getUTCDate(),
      status: map.has(date) ? (map.get(date) ? "present" : "absent") : "none",
    }));
  }, [attendanceHistory, sundays]);

  // Attendance stats for sidesheet
  const attendanceStats = useMemo(() => {
    if (!attendanceHistory) return null;
    const present = attendanceHistory.filter((r: any) => r.present).length;
    const total = attendanceHistory.length;
    const lastPresent = attendanceHistory.find((r: any) => r.present);
    return { present, total, rate: total > 0 ? Math.round((present / total) * 100) : 0, lastSeen: lastPresent?.date || null };
  }, [attendanceHistory]);

  const typeFilterLabels: Record<string, string> = { all: "All types", member: "Members", kid: "Kids", visitor: "Visitors" };
  const cycleType = () => {
    const types: ("all" | PersonType)[] = ["all", "member", "kid", "visitor"];
    const i = types.indexOf(typeFilter);
    setTypeFilter(types[(i + 1) % types.length]);
  };
  const cycleStatus = () => {
    const opts: ("active" | "inactive" | "all")[] = ["active", "inactive", "all"];
    const i = opts.indexOf(statusFilter);
    setStatusFilter(opts[(i + 1) % opts.length]);
  };

  const phoneCount = filtered.filter((p) => p.type !== "kid" && p.contact?.trim()).length;

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: "#f5f3ef" }} />

      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: "#f5f3ef", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <span className="text-sm text-[#6b6864]">Master List</span>
          <div className="flex items-center gap-2">
            <button id="copy-numbers" onClick={copyPhoneNumbers} disabled={phoneCount === 0} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40" style={{ backgroundColor: copied ? "#c5d4be" : "transparent", color: copied ? "#5a7a4e" : "#8a8784" }}>
              {Icons.copy} {copied ? "Copied!" : `Copy (${phoneCount})`}
            </button>
            <button id="export-csv" onClick={exportCSV} disabled={!filtered.length} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-[#8a8784] hover:text-[#6b6864] disabled:opacity-40 transition-colors">
              {Icons.download} Export
            </button>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-24">
          {/* Stats banner */}
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: "#3d3a36" }}>
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { value: stats.total, label: "Active" },
                { value: stats.members, label: "Members" },
                { value: stats.kids, label: "Kids" },
                { value: stats.visitors, label: "Visitors" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-light text-white/90">{s.value}</div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
            {stats.inactive > 0 && (
              <div className="text-center mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-xs text-white/30">{stats.inactive} inactive</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4c0ba]">{Icons.search}</div>
            <input
              id="master-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search everyone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-transparent text-sm text-[#3d3a36] placeholder-[#c4c0ba] outline-none focus:border-[#c9a87c] transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5">
            <button id="type-filter" onClick={cycleType} className="px-3 py-1.5 rounded-full text-xs transition-colors" style={{ backgroundColor: typeFilter === "all" ? "transparent" : "#e8dcc8", color: typeFilter === "all" ? "#8a8784" : "#9a7d4e" }}>
              {typeFilterLabels[typeFilter]}
            </button>
            <button id="status-filter" onClick={cycleStatus} className="px-3 py-1.5 rounded-full text-xs transition-colors" style={{ backgroundColor: statusFilter === "active" ? "#c5d4be" : statusFilter === "inactive" ? "#e8d8cc" : "transparent", color: statusFilter === "active" ? "#5a7a4e" : statusFilter === "inactive" ? "#c49a84" : "#8a8784" }}>
              {statusFilter === "active" ? "Active" : statusFilter === "inactive" ? "Inactive" : "All status"}
            </button>
            {(searchQuery || typeFilter !== "all" || statusFilter !== "active") && (
              <button id="clear-filters" onClick={() => { setSearchQuery(""); setTypeFilter("all"); setStatusFilter("active"); }} className="px-2 py-1 text-xs text-[#c4c0ba] hover:text-[#8a8784]">
                Clear
              </button>
            )}
            <div className="flex-1" />
            <span className="text-[11px] text-[#c4c0ba]">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* List */}
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#c4c0ba]">No results found</div>
            ) : (
              filtered.map((p) => {
                const badge = typeBadge[p.type];
                const lastDate = p.type === "visitor" ? (p.lastAttendanceDate || p.date) : null;
                const recency = lastDate ? getRecencyFromDate(lastDate) : null;
                return (
                  <button
                    key={p._id}
                    id={`person-${p._id}`}
                    onClick={() => setSelectedPerson(p)}
                    className="w-full text-left rounded-xl px-4 py-3 bg-white transition-colors hover:bg-white/70 flex items-center gap-3"
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Row 1: name + badges */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-[#3d3a36] truncate">{p.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.text }}>{badge.label}</span>
                        {!p.active && <span className="text-[10px] text-[#c4c0ba]">(inactive)</span>}
                      </div>
                      {/* Row 2: details */}
                      <div className="flex items-center gap-3 text-[11px] text-[#8a8784]">
                        {p.contact && <span>{p.contact}</span>}
                        {p.residence && <span className="truncate max-w-[120px]">{p.residence}</span>}
                        {p.type === "member" && p.department && <span>{p.department}</span>}
                        {p.type === "member" && p.status && <span>{p.status}</span>}
                      </div>
                    </div>
                    {/* Recency or status */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {recency ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: recency.dot }} />
                          <span className="text-[11px]" style={{ color: recency.color }}>{recency.label}</span>
                        </>
                      ) : (
                        p.active ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6b8a5e]" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d4d0ca]" />
                        )
                      )}
                      <span className="text-[#d4d0ca]">{Icons.chevron}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </main>

        {/* ── Sidesheet ─────────────────────────────────────── */}
        {selectedPerson && (
          <div className="fixed inset-0 z-50" onClick={() => setSelectedPerson(null)}>
            <div className="absolute inset-0 bg-black/20" />
            <div
              className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-base text-[#3d3a36]">{selectedPerson.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: typeBadge[selectedPerson.type].bg, color: typeBadge[selectedPerson.type].text }}>
                        {typeBadge[selectedPerson.type].label}
                      </span>
                      <span className="text-[11px]" style={{ color: selectedPerson.active ? "#6b8a5e" : "#c49a84" }}>
                        {selectedPerson.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <button id="close-sidesheet" onClick={() => setSelectedPerson(null)} className="text-[#c4c0ba] hover:text-[#8a8784] p-1">{Icons.close}</button>
                </div>

                {/* Contact info */}
                <div className="space-y-2 mb-6">
                  {selectedPerson.contact && (
                    <a href={`tel:${selectedPerson.contact}`} className="flex items-center gap-2 text-sm text-[#c9a87c] hover:underline">
                      {Icons.phone} {selectedPerson.contact}
                    </a>
                  )}
                  {selectedPerson.residence && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.pin} {selectedPerson.residence}</div>
                  )}
                  {selectedPerson.type === "member" && selectedPerson.department && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                      {selectedPerson.department}
                    </div>
                  )}
                  {selectedPerson.type === "member" && selectedPerson.status && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.user} {selectedPerson.status}</div>
                  )}
                  {selectedPerson.gender && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.user} {selectedPerson.gender}</div>
                  )}
                  {selectedPerson.type === "visitor" && selectedPerson.previousChurch && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 21H6a1 1 0 0 1-1-1v-8l7-7 7 7v8a1 1 0 0 1-1 1z"/><path d="M12 2v4"/><path d="M10 4h4"/></svg>
                      From {selectedPerson.previousChurch}
                    </div>
                  )}
                </div>

                {/* Attendance stats */}
                {attendanceStats && (
                  <div className="mb-6">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Attendance</div>
                    <div className="flex items-center gap-6 mb-3">
                      <div>
                        <div className="text-xl text-[#3d3a36]">{attendanceStats.present}</div>
                        <div className="text-[10px] text-[#8a8784]">Present</div>
                      </div>
                      <div>
                        <div className="text-xl text-[#3d3a36]">{attendanceStats.rate}%</div>
                        <div className="text-[10px] text-[#8a8784]">Rate</div>
                      </div>
                      <div>
                        <div className="text-sm text-[#3d3a36]">{attendanceStats.lastSeen ? formatDate(attendanceStats.lastSeen) : "Never"}</div>
                        <div className="text-[10px] text-[#8a8784]">Last seen</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-[#e8e6e3] rounded-full overflow-hidden">
                      <div className="h-full bg-[#6b8a5e] rounded-full transition-all" style={{ width: `${attendanceStats.rate}%` }} />
                    </div>
                  </div>
                )}

                {/* Attendance heatmap */}
                <div className="mb-6">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Last 12 Sundays</div>
                  {heatmapData ? (
                    <div className="grid grid-cols-6 gap-1.5">
                      {heatmapData.map((s) => (
                        <div key={s.date} className="flex flex-col items-center gap-1">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[9px]"
                            style={{
                              backgroundColor: s.status === "present" ? "#6b8a5e" : s.status === "absent" ? "#e8e6e3" : "transparent",
                              border: s.status === "none" ? "1px solid #e8e6e3" : "none",
                              color: s.status === "present" ? "white" : "#b0ada8",
                            }}
                            title={`${formatDate(s.date)} - ${s.status === "present" ? "Present" : s.status === "absent" ? "Absent" : "No data"}`}
                          >
                            {s.day}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="w-7 h-7 rounded-md bg-[#e8e6e3] animate-pulse" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-[#6b8a5e]" />
                      <span className="text-[10px] text-[#8a8784]">Present</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-[#e8e6e3]" />
                      <span className="text-[10px] text-[#8a8784]">Absent</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm" style={{ border: "1px solid #e8e6e3" }} />
                      <span className="text-[10px] text-[#8a8784]">No data</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-2">Actions</div>
                  {selectedPerson.type === "member" && (
                    <button
                      id="toggle-active"
                      onClick={() => handleToggleActive(selectedPerson)}
                      className="w-full py-2.5 rounded-xl text-sm transition-colors"
                      style={{
                        backgroundColor: selectedPerson.active ? "#e8d8cc" : "#c5d4be",
                        color: selectedPerson.active ? "#c49a84" : "#5a7a4e",
                      }}
                    >
                      {selectedPerson.active ? "Mark inactive" : "Mark active"}
                    </button>
                  )}
                  {selectedPerson.contact && (
                    <a
                      href={`tel:${selectedPerson.contact}`}
                      className="block w-full py-2.5 rounded-xl text-sm text-center bg-[#3d3a36] text-[#f5f3ef] hover:bg-[#4d4a46] transition-colors"
                    >
                      Call {selectedPerson.name.split(" ")[0]}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
