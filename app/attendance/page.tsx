"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { formatDate, formatIsoDate } from "@/lib/date";

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
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [viewingMemberName, setViewingMemberName] = useState<string>("");

  const roster = useQuery(api.attendance.rosterForDate, isAuthenticated ? { date: todayIso } : "skip");
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);

  const members = roster ?? [];
  const presentTodayCount = useMemo(() => members.filter((m) => m.presentToday).length, [members]);

  const returningVisitorCount = useMemo(
    () => members.filter((m: any) => m.type === "returningVisitor").length,
    [members]
  );

  const activeCount = useMemo(() => {
    return members.filter((m: any) => (m.active !== false && m.pipelineStage !== "dormant" && m.pipelineStage !== "dropped") || m.presentToday).length;
  }, [members]);

  // Filter by tab
  const filtered = useMemo(() => {
    let list = members;
    const q = query.trim().toLowerCase();
    if (!q) {
      // Hide inactive/dormant/dropped members unless they are present today
      list = members.filter((m: any) => (m.active !== false && m.pipelineStage !== "dormant" && m.pipelineStage !== "dropped") || m.presentToday);
    }

    if (tab === "all") return list;
    if (tab === "kids") return list.filter((m) => (m as any).type === "kid");
    if (tab === "visitors") return list.filter((m) => (m as any).type === "returningVisitor");
    return list.filter((m) => (m as any).type !== "returningVisitor" && (m as any).type !== "kid" && (m.gender ?? "").toLowerCase() === tab);
  }, [members, tab, query]);

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
    const visibleMembers = query.trim() 
      ? members 
      : members.filter((m: any) => (m.active !== false && m.pipelineStage !== "dormant" && m.pipelineStage !== "dropped") || m.presentToday);
    const total = visibleMembers.length;
    const present = presentTodayCount;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent: total - present, rate };
  }, [members, presentTodayCount, query]);

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Home</Link>
            <span className="text-sm" style={{ color: colors.text.secondary }}>{formatDate(new Date())}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportAttendance} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Export</button>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-32">
          {/* Stats Card */}
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: colors.text.primary }}>
            <div className="flex items-center gap-6 mb-4">
              <div><div className="text-4xl font-light mb-1 text-white">{stats.present}</div><div className="text-xs text-white/60">Present</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.total}</div><div className="text-xs text-white/60">Total</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.rate}%</div><div className="text-xs text-white/60">Rate</div></div>
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.rate}%`, backgroundColor: colors.accent.sage }} />
            </div>
          </div>

          {/* Quick Add Visitor */}
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
            <div className="text-xs mb-3" style={{ color: colors.text.muted }}>Quick add visitor</div>
            <QuickAddVisitor dateIso={todayIso} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {[{ key: "all", label: `All (${query.trim() ? members.length : activeCount})` }, { key: "male", label: "Men" }, { key: "female", label: "Women" }, { key: "kids", label: "Kids" }, { key: "visitors", label: `Visitors (${returningVisitorCount})` }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as any)} className="flex-1 py-2 rounded-full text-xs transition-colors" style={{ backgroundColor: tab === t.key ? colors.accent.amberLight : colors.surface, color: tab === t.key ? colors.accent.amber : colors.text.secondary, fontWeight: tab === t.key ? 500 : 400 }}>{t.label}</button>
            ))}
          </div>

          {/* Search */}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members..." className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={{ backgroundColor: colors.surface, color: colors.text.primary }} />

          {/* Add Button based on tab */}
          <div className="mb-4">
            {tab === "kids" ? <QuickAddKid dateIso={todayIso} /> : <QuickAddMember dateIso={todayIso} />}
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
              {searched.map((m: any) => (
                <div key={m.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleViewHistory(m as Member)}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.presentToday ? colors.accent.sage : colors.text.muted }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: colors.text.primary }}>
                          <span>{m.name}</span>
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
                        {m.contact && <div className="text-xs truncate" style={{ color: colors.text.muted }}>{m.contact}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.presentToday && m.arrivalTime && (
                        <span className="text-xs" style={{ color: colors.text.muted }}>
                          {m.arrivalTime}
                        </span>
                      )}
                      <button onClick={() => handleToggleAttendance(m.memberId, m.presentToday)} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: m.presentToday ? colors.surfaceHover : colors.accent.sage, color: m.presentToday ? colors.text.secondary : '#fff' }}>{m.presentToday ? 'Absent' : 'Present'}</button>
                      <button onClick={() => { 
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
                      }} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}
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
