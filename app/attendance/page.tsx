"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QuickAddMember from "@/components/QuickAddMember";
import MemberEditor, { MemberSummary } from "@/components/MemberEditor";
import QuickAddKid from "@/components/QuickAddKid";
import KidEditor, { KidSummary } from "@/components/KidEditor";
import QuickAddVisitor from "@/components/QuickAddVisitor";
import VisitorEditor, { VisitorSummary } from "@/components/VisitorEditor";
import AttendanceHistoryModal from "@/components/AttendanceHistoryModal";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatDate } from "@/lib/date";
import { Check, Pencil } from "lucide-react";

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7', sage: '#154618', sageLight: '#c3d3c4', terracotta: '#0D9762', terracottaLight: '#a7ddc7', blue: '#154618', rose: '#c49a9a' }
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 2000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[11000] px-5 py-3 rounded-full text-sm" style={{ backgroundColor: colors.text.primary, color: '#fff' }}>
      {message}
    </div>
  );
}

type Member = {
  memberId: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  type?: "member" | "kid" | "returningVisitor";
  presentToday: boolean;
  arrivalTime?: string | null;
  lastAttendance: { date: string; present: boolean } | null;
  sundayCount?: number;
  sundaysAttended?: number;
  fromOtherChurch?: boolean | null;
};

// Height of the sticky page header (h-10), used when scrolling the filter bar into place.
const HEADER_HEIGHT = 40;

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Sundays a returning visitor attended before today, whichever field the roster carries.
function visitorSundays(m: { sundaysAttended?: number; sundayCount?: number }): number | null {
  const count = m.sundaysAttended ?? m.sundayCount;
  return typeof count === "number" ? count : null;
}

export default function AttendancePage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [tab, setTab] = useState<"all" | "male" | "female" | "kids" | "visitors">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberSummary | null>(null);
  const [kidEditorOpen, setKidEditorOpen] = useState(false);
  const [editingKid, setEditingKid] = useState<KidSummary | null>(null);
  const [visitorEditorOpen, setVisitorEditorOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visitorFormOpen, setVisitorFormOpen] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [viewingMemberName, setViewingMemberName] = useState<string>("");

  const roster = useQuery(api.attendance.rosterForDate, isAuthenticated ? { date: todayIso } : "skip");
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);

  const members = roster ?? [];
  const presentTodayCount = useMemo(() => members.filter((m) => m.presentToday).length, [members]);

  // While searching everyone is in scope; otherwise inactive/dormant/dropped are
  // hidden unless they turned up today.
  const visibleList = useMemo(() => {
    if (query.trim()) return members;
    return members.filter((m: any) => (m.active !== false && m.pipelineStage !== "dormant" && m.pipelineStage !== "dropped") || m.presentToday);
  }, [members, query]);

  const inTab = (m: any, key: typeof tab) => {
    if (key === "all") return true;
    if (key === "kids") return m.type === "kid";
    if (key === "visitors") return m.type === "returningVisitor";
    return m.type !== "returningVisitor" && m.type !== "kid" && (m.gender ?? "").toLowerCase() === key;
  };

  const tabCounts = useMemo(() => ({
    all: visibleList.length,
    male: visibleList.filter((m: any) => inTab(m, "male")).length,
    female: visibleList.filter((m: any) => inTab(m, "female")).length,
    kids: visibleList.filter((m: any) => inTab(m, "kids")).length,
    visitors: visibleList.filter((m: any) => inTab(m, "visitors")).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visibleList]);

  // Filter by tab
  const filtered = useMemo(
    () => visibleList.filter((m: any) => inTab(m, tab)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleList, tab]
  );

  // Apply search
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((m: any) => `${m.name ?? ""} ${m.contact ?? ""} ${m.residence ?? ""}`.toLowerCase().includes(q));
  }, [filtered, query]);

  const handleToggleAttendance = useCallback(async (memberId: string, isPresent: boolean) => {
    const payload = { memberId: memberId as any, date: todayIso } as any;
    try {
      if (isPresent) { await unmarkPresent(payload); setToast("Marked absent"); }
      else { await markPresent(payload); setToast("Marked present"); }
      if ("vibrate" in navigator) navigator.vibrate(10);
    } catch (e) { setToast("Error updating"); }
  }, [todayIso, markPresent, unmarkPresent]);

  // Tapping search on a phone opens the keyboard over the lower half of the screen.
  // Scroll the filter bar up to the header so the roster gets the space that is left.
  const handleSearchFocus = () => {
    setTimeout(() => {
      const el = filterBarRef.current;
      if (!el) return;
      const target = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      if (target > window.scrollY) window.scrollTo({ top: target, behavior: "smooth" });
    }, 100);
  };

  const handleViewHistory = (member: Member) => {
    setViewingMemberId(member.memberId);
    setViewingMemberName(member.name);
    setHistoryModalOpen(true);
  };

  const exportAttendance = () => {
    const presentMembers = members.filter((m) => m.presentToday);
    const csv = [["Name", "Contact", "Gender", "Present"].join(","), ...presentMembers.map((m) => [m.name, m.contact ?? "", m.gender ?? "", "Yes"].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Exported CSV");
  };

  const stats = useMemo(() => {
    const total = visibleList.length;
    const present = presentTodayCount;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent: total - present, rate };
  }, [visibleList, presentTodayCount]);

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-10 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Home</Link>
            <span className="text-xs" style={{ color: colors.text.secondary }}>{formatDate(new Date())}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportAttendance} className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Export</button>
            <SignedIn>
              <UserButton appearance={{ elements: { avatarBox: { width: 24, height: 24 } } }} />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-32">
          {/* Stats strip — one line, with the attendance rate filling it from the left */}
          <div className="relative overflow-hidden rounded-xl mb-4 flex items-center gap-x-3 px-4 py-2.5" style={{ backgroundColor: colors.text.primary }}>
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{ width: `${stats.rate}%`, backgroundColor: 'rgba(255,255,255,0.09)' }}
            />
            <div className="relative flex items-baseline gap-1.5">
              <span className="text-xl font-medium leading-none text-white">{stats.present}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">Present</span>
            </div>
            <div className="relative w-px h-4 shrink-0 bg-white/20" />
            <div className="relative flex items-baseline gap-1.5">
              <span className="text-base font-light leading-none text-white">{stats.total}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">Total</span>
            </div>
            <div className="relative w-px h-4 shrink-0 bg-white/20" />
            <div className="relative flex items-baseline gap-1.5 ml-auto">
              <span className="text-base font-light leading-none text-white">{stats.rate}%</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">Rate</span>
            </div>
          </div>

          {/* Quick Add Visitor — collapsed by default so it costs one line when unused */}
          <div className="rounded-xl mb-4 overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <button
              onClick={() => setVisitorFormOpen(!visitorFormOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
              aria-expanded={visitorFormOpen}
            >
              <span className="text-xs flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                <span style={{ color: colors.accent.amber }}>+</span>
                Quick add visitor
              </span>
              <span
                className="text-[10px] transition-transform duration-200"
                style={{ color: colors.text.muted, transform: visitorFormOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▼
              </span>
            </button>
            {visitorFormOpen && (
              <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <QuickAddVisitor
                  dateIso={todayIso}
                  onDone={() => { setVisitorFormOpen(false); setToast("Visitor added"); }}
                />
              </div>
            )}
          </div>

          {/* Tabs + search stay pinned under the header so the roster keeps whatever
              space the on-screen keyboard leaves. */}
          <div
            ref={filterBarRef}
            className="sticky top-10 z-20 -mx-5 px-5 py-2 space-y-2 mb-2"
            style={{ backgroundColor: colors.bg }}
          >
            {/* Tabs — one segmented control, counts inline so nothing needs its own row */}
            <div className="flex p-0.5 rounded-full" style={{ backgroundColor: colors.surface }}>
            {([
              { key: "all", label: "All", count: tabCounts.all },
              { key: "male", label: "Men", count: tabCounts.male },
              { key: "female", label: "Women", count: tabCounts.female },
              { key: "kids", label: "Kids", count: tabCounts.kids },
              { key: "visitors", label: "Visitors", count: tabCounts.visitors },
            ] as const).map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 min-w-0 py-1.5 px-1 rounded-full text-[11px] leading-none transition-colors flex items-baseline justify-center gap-1"
                  style={{
                    backgroundColor: active ? colors.accent.amberLight : 'transparent',
                    color: active ? colors.text.primary : colors.text.secondary,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span className="truncate">{t.label}</span>
                  <span className="text-[10px]" style={{ color: active ? colors.accent.sage : colors.text.muted }}>
                    {t.count}
                  </span>
                </button>
              );
            })}
            </div>

            {/* Search + add trigger */}
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
              <input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onKeyDown={(e) => {
                  // Enter has nothing to submit — use it to drop the keyboard.
                  if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                }}
                placeholder="Search members..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
                style={{ backgroundColor: colors.surface, color: colors.text.primary }}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => { setQuery(""); searchInputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-0 px-3 text-sm"
                  style={{ color: colors.text.muted }}
                >
                  ✕
                </button>
              )}
              </div>
              {tab === "kids"
                ? <QuickAddKid dateIso={todayIso} compact />
                : <QuickAddMember dateIso={todayIso} compact />}
            </div>
          </div>

          {/* Members List */}
          {roster === undefined ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="p-4 rounded-xl animate-pulse" style={{ backgroundColor: colors.surface }}><div className="h-4 w-2/3 rounded" style={{ backgroundColor: colors.surfaceHover }} /></div>)}
            </div>
          ) : searched.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>No members found</div>
          ) : (
            <div className="space-y-2">
              {searched.map((m: any) => {
                // Presence reads from the row itself: a green edge and tint, plus the
                // filled check on the right. No dot stealing space from the name.
                const meta = [
                  m.contact,
                  m.department,
                  m.presentToday && m.arrivalTime ? `Arrived ${m.arrivalTime}` : null,
                ].filter(Boolean).join(" · ");

                return (
                <div
                  key={m.memberId}
                  className="pl-3 pr-2 py-2.5 rounded-xl border-l-[3px]"
                  style={{
                    backgroundColor: m.presentToday ? 'rgba(21, 70, 24, 0.05)' : colors.surface,
                    borderLeftColor: m.presentToday ? colors.accent.sage : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0" onClick={() => handleViewHistory(m as Member)}>
                      <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ color: colors.text.primary }}>
                        <span className="truncate">{m.name}</span>
                        {m.type === "returningVisitor" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.sage }}
                          >
                            Returning visitor
                            {typeof visitorSundays(m) === "number" ? ` · ${visitorSundays(m)} Sunday${visitorSundays(m) === 1 ? "" : "s"}` : ""}
                          </span>
                        )}
                        {m.type === "returningVisitor" && m.fromOtherChurch === false && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                            Our branch
                          </span>
                        )}
                        {(m.active === false || m.pipelineStage === "dormant" || m.pipelineStage === "dropped") && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200/40 font-light whitespace-nowrap">
                            {m.pipelineStage === "dormant" ? "Dormant" : m.pipelineStage === "dropped" ? "Dropped" : "Inactive"}
                          </span>
                        )}
                      </div>
                      {meta && <div className="text-[11px] truncate mt-0.5" style={{ color: colors.text.muted }}>{meta}</div>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleAttendance(m.memberId, m.presentToday)}
                        aria-label={m.presentToday ? `Mark ${m.name} absent` : `Mark ${m.name} present`}
                        title={m.presentToday ? "Mark absent" : "Mark present"}
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: m.presentToday ? colors.accent.sage : colors.surfaceHover,
                          color: m.presentToday ? '#fff' : colors.text.muted,
                        }}
                      >
                        <Check className="w-4 h-4" strokeWidth={m.presentToday ? 3 : 2} />
                      </button>
                      <button
                        onClick={() => {
                          if (m.type === "kid") {
                            setEditingKid(m);
                            setKidEditorOpen(true);
                          } else if (m.type === "returningVisitor") {
                            setEditingVisitor(m as any);
                            setVisitorEditorOpen(true);
                          } else {
                            setEditingMember(m);
                            setEditorOpen(true);
                          }
                        }}
                        aria-label={`Edit ${m.name}`}
                        title="Edit"
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'transparent', color: colors.text.muted }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Modals */}
        {editingMember && <MemberEditor open={editorOpen} onClose={() => setEditorOpen(false)} member={editingMember} onSaved={() => setToast("Member updated")} />}
        {editingKid && <KidEditor open={kidEditorOpen} onClose={() => setKidEditorOpen(false)} kid={editingKid} onSaved={() => setToast("Kid updated")} />}
        {editingVisitor && <VisitorEditor open={visitorEditorOpen} onClose={() => setVisitorEditorOpen(false)} visitor={editingVisitor} onSaved={() => setToast("Visitor updated")} />}
        {viewingMemberId && <AttendanceHistoryModal open={historyModalOpen} onClose={() => { setHistoryModalOpen(false); setViewingMemberId(null); }} memberId={viewingMemberId} memberName={viewingMemberName} />}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
