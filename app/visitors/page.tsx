"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QuickAddVisitor from "@/components/QuickAddVisitor";
import VisitorEditor, { VisitorSummary } from "@/components/VisitorEditor";
import AttendanceHistoryModal from "@/components/AttendanceHistoryModal";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate } from "@/lib/date";

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7', sage: '#154618', sageLight: '#c3d3c4' }
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

type Visitor = {
  memberId: string;
  name: string;
  contact: string | null;
  residence: string | null;
  relationshipStatus: string | null;
  previousChurch: string | null;
  type: "visitor";
  presentToday: boolean;
  arrivalTime?: string | null;
  firstSeen?: string;
  lastAttendance: { date: string; present: boolean } | null;
};

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VisitorsPage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [viewingVisitorId, setViewingVisitorId] = useState<string | null>(null);
  const [viewingVisitorName, setViewingVisitorName] = useState<string>("");

  const todayRoster = useQuery(
    api.attendance.visitorsRosterForDate,
    isAuthenticated && !showAll ? { date: todayIso } : "skip"
  );
  const allRoster = useQuery(
    api.attendance.allVisitorsRoster,
    isAuthenticated && showAll ? { date: todayIso } : "skip"
  );
  const roster = showAll ? allRoster : todayRoster;

  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);

  const visitors = roster ?? [];
  const presentTodayCount = useMemo(() => visitors.filter((v) => v.presentToday).length, [visitors]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visitors;
    const terms = q.split(/\s+/).filter(Boolean);
    return visitors.filter((v: any) => {
      const hay = `${v.name ?? ""} ${v.contact ?? ""} ${v.residence ?? ""} ${v.relationshipStatus ?? ""} ${v.previousChurch ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [visitors, query]);

  const handleToggleAttendance = useCallback(async (visitorId: string, isPresent: boolean) => {
    const payload = { memberId: visitorId as any, date: todayIso } as any;
    try {
      if (isPresent) { await unmarkPresent(payload); setToast("Marked absent"); }
      else { await markPresent(payload); setToast("Marked present"); }
      if ("vibrate" in navigator) navigator.vibrate(10);
    } catch (e) { setToast("Error updating"); }
  }, [todayIso, markPresent, unmarkPresent]);

  const handleViewHistory = (visitor: Visitor) => {
    setViewingVisitorId(visitor.memberId);
    setViewingVisitorName(visitor.name);
    setHistoryModalOpen(true);
  };

  const stats = useMemo(() => {
    const total = visitors.length;
    const present = presentTodayCount;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, rate };
  }, [visitors, presentTodayCount]);

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Home</Link>
            <span className="text-sm" style={{ color: colors.text.secondary }}>Visitors</span>
          </div>
          <SignedIn><UserButton /></SignedIn>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-32">
          {/* Stats Card */}
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: colors.text.primary }}>
            <div className="flex items-center gap-6 mb-4">
              <div><div className="text-4xl font-light mb-1 text-white">{stats.present}</div><div className="text-xs text-white/60">Present today</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.total}</div><div className="text-xs text-white/60">{showAll ? "All visitors" : "Today"}</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.rate}%</div><div className="text-xs text-white/60">Present rate</div></div>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.rate}%`, backgroundColor: colors.accent.amber }} />
            </div>
          </div>

          {/* Quick Add Visitor */}
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
            <div className="text-xs mb-3" style={{ color: colors.text.muted }}>Quick add visitor</div>
            <QuickAddVisitor dateIso={todayIso} />
          </div>

          {/* Today / All history toggle */}
          <div className="flex gap-2 mb-4">
            {[{ key: false, label: "Today" }, { key: true, label: "All (history)" }].map((t) => (
              <button
                key={String(t.key)}
                onClick={() => setShowAll(t.key)}
                className="flex-1 py-2 rounded-full text-xs transition-colors"
                style={{
                  backgroundColor: showAll === t.key ? colors.accent.amberLight : colors.surface,
                  color: showAll === t.key ? colors.accent.amber : colors.text.secondary,
                  fontWeight: showAll === t.key ? 500 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, residence..." className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={{ backgroundColor: colors.surface, color: colors.text.primary }} />

          {/* Visitors List */}
          {roster === undefined ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="p-4 rounded-xl animate-pulse" style={{ backgroundColor: colors.surface }}><div className="h-4 w-2/3 rounded" style={{ backgroundColor: colors.surfaceHover }} /></div>)}
            </div>
          ) : searched.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
              {showAll ? "No visitors registered yet" : "No visitors today — switch to All (history) to see everyone"}
            </div>
          ) : (
            <div className="space-y-2">
              {searched.map((v: any) => (
                <div key={v.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => handleViewHistory(v as Visitor)}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.presentToday ? colors.accent.amber : colors.text.muted }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: colors.text.primary }}>
                          <span>{v.name}</span>
                          {v.relationshipStatus && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize whitespace-nowrap" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                              {v.relationshipStatus}
                            </span>
                          )}
                          {v.fromOtherChurch === true && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.sage }}>
                              Other church
                            </span>
                          )}
                          {v.fromOtherChurch === false && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                              Our branch
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: colors.text.muted }}>
                          {[v.contact, v.residence].filter(Boolean).join(" • ") || "No contact details"}
                        </div>
                        {v.lastAttendance ? (
                          <div className="text-[11px] mt-1" style={{ color: colors.text.muted }}>
                            Last seen {formatIsoDate(v.lastAttendance.date)}
                            {v.lastAttendance.present ? " · present" : " · absent"}
                          </div>
                        ) : (
                          <div className="text-[11px] mt-1 italic" style={{ color: colors.text.muted }}>No attendance yet</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggleAttendance(v.memberId, v.presentToday)} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: v.presentToday ? colors.surfaceHover : colors.accent.amber, color: v.presentToday ? colors.text.secondary : '#fff' }}>{v.presentToday ? 'Absent' : 'Present'}</button>
                      <button onClick={() => { setEditingVisitor(v as any); setEditorOpen(true); }} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Modals */}
        {editingVisitor && <VisitorEditor open={editorOpen} onClose={() => setEditorOpen(false)} visitor={editingVisitor} onSaved={() => setToast("Visitor updated")} />}
        {viewingVisitorId && <AttendanceHistoryModal open={historyModalOpen} onClose={() => { setHistoryModalOpen(false); setViewingVisitorId(null); }} memberId={viewingVisitorId} memberName={viewingVisitorName} />}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
