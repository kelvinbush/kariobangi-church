"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, formatDateLong } from "@/lib/date";
import MemberEditor, { type MemberSummary } from "@/components/MemberEditor";
import KidEditor, { type KidSummary } from "@/components/KidEditor";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: {
    primary: '#3d3a36',
    secondary: '#6b6864',
    muted: '#9a9793',
  },
  accent: {
    amber: '#c9a87c',
    amberLight: '#e8dcc8',
    sage: '#9db88c',
    sageLight: '#c5d4be',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
  }
};

// Subtle dot pattern
const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

export default function RollCallDetailPage() {
  const params = useParams<{ date: string }>();
  const date = decodeURIComponent(params.date);
  const [editingUnknown, setEditingUnknown] = useState<MemberSummary | null>(null);
  const [editingAbsentMember, setEditingAbsentMember] = useState<MemberSummary | null>(null);
  const [editingAbsentKid, setEditingAbsentKid] = useState<KidSummary | null>(null);
  const [historyVisitor, setHistoryVisitor] = useState<{ name: string; memberId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"present" | "absent" | "visitors">("present");

  const { isAuthenticated } = useConvexAuth();
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);
  const removeVisitor = useMutation(api.visitors.remove);
  const removeMember = useMutation(api.members.remove);
  const removeKid = useMutation(api.kids.remove);
  const roster = useQuery(api.attendance.rosterForDate, isAuthenticated ? { date } : "skip");
  const visitorsRoster = useQuery(api.attendance.visitorsRosterForDate, isAuthenticated ? { date } : "skip");
  const visitorHistory = useQuery(
    api.attendance.historyForMember,
    isAuthenticated && historyVisitor ? { memberId: historyVisitor.memberId as any } : "skip"
  );

  const rosterList = roster ?? [];
  const visitors = visitorsRoster ?? [];

  // Stats
  const membersOnly = rosterList.filter((m: any) => m.type === "member" || m.type === "kid");
  const total = membersOnly.length;
  const presentMembersKids = membersOnly.filter((m: any) => m.presentToday).length;
  const absentMembers = membersOnly.filter((m: any) => !m.presentToday);

  const presentMen = membersOnly.filter((m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "male");
  const presentWomen = membersOnly.filter((m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "female");
  const presentKids = membersOnly.filter((m: any) => m.presentToday && m.type === "kid");
  const presentUnknown = membersOnly.filter((m: any) => m.presentToday && m.type !== "kid" && !["male", "female"].includes((m.gender ?? "").toLowerCase()));

  const returningVisitorsPresent = rosterList.filter((m: any) => m.type === "returningVisitor" && m.presentToday);
  const returningVisitorsAbsent = rosterList.filter((m: any) => m.type === "returningVisitor" && !m.presentToday);
  const presentVisitors = visitors.filter((v: any) => v.presentToday);

  const totalPresent = presentMembersKids + returningVisitorsPresent.length + presentVisitors.length;

  const togglePresent = async (memberId: string, current: boolean) => {
    const payload = { memberId, date };
    if (current) await unmarkPresent(payload as any);
    else await markPresent(payload as any);
  };

  const exportVisitorsCsv = () => {
    if (!presentVisitors.length) return;
    const prefix = new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const headers = ["Name Prefix", "First Name", "Phone 1 - Value", "Address 1 - Street", "Notes"];
    const rows = presentVisitors.map((v: any) => {
      const notesParts = [];
      if (v.relationshipStatus) notesParts.push(`Status: ${v.relationshipStatus}`);
      if (v.previousChurch) notesParts.push(`From: ${v.previousChurch}`);
      return [prefix, v.name || "", v.contact || "", v.residence || "", notesParts.join(" | ")];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `visitors-${date}.csv`;
    link.click();
  };

  const exportAbsentCsv = () => {
    if (!absentMembers.length) return;
    const headers = ["Name", "Contact", "Residence", "Gender", "Department", "Status"];
    const rows = absentMembers.map((m: any) => [m.name, m.contact ?? "", m.residence ?? "", m.gender ?? "", m.department ?? "", m.status ?? ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `absent-${date}.csv`;
    link.click();
  };

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            {formatIsoDate(date)}
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/attendance/history"
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              Back
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Stats */}
          <div 
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: colors.text.primary }}
          >
            <div className="flex items-center gap-6">
              <div>
                <div className="text-4xl font-light mb-1 text-white">{totalPresent}</div>
                <div className="text-xs text-white/60">Total present</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">{presentMembersKids}</div>
                <div className="text-xs text-white/60">Members & kids</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">{presentVisitors.length}</div>
                <div className="text-xs text-white/60">Visitors</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: "present", label: `Present (${presentMembersKids + returningVisitorsPresent.length})` },
              { id: "absent", label: `Absent (${absentMembers.length + returningVisitorsAbsent.length})` },
              { id: "visitors", label: `New visitors (${presentVisitors.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 py-2 rounded-full text-xs transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? colors.accent.amberLight : colors.surface,
                  color: activeTab === tab.id ? colors.text.primary : colors.text.secondary,
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Present Tab */}
          {activeTab === "present" && (
            <div className="space-y-6">
              {/* Men */}
              {presentMen.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Men ({presentMen.length})
                  </div>
                  <div className="space-y-2">
                    {presentMen.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Women */}
              {presentWomen.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Women ({presentWomen.length})
                  </div>
                  <div className="space-y-2">
                    {presentWomen.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Kids */}
              {presentKids.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Kids ({presentKids.length})
                  </div>
                  <div className="space-y-2">
                    {presentKids.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown gender */}
              {presentUnknown.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Unknown gender ({presentUnknown.length})
                  </div>
                  <div className="space-y-2">
                    {presentUnknown.map((m: any) => (
                      <div key={m.memberId} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm" style={{ color: colors.text.primary }}>{m.name}</div>
                            <div className="text-xs" style={{ color: colors.text.muted }}>{m.contact}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingUnknown({
                                memberId: m.memberId, name: m.name, contact: m.contact ?? null,
                                residence: m.residence ?? null, gender: m.gender ?? null,
                                department: m.department ?? null, status: m.status ?? null,
                              })}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.amber }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => togglePresent(m.memberId, true)}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Returning visitors */}
              {returningVisitorsPresent.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Returning visitors ({returningVisitorsPresent.length})
                  </div>
                  <div className="space-y-2">
                    {returningVisitorsPresent.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Absent Tab */}
          {activeTab === "absent" && (
            <div className="space-y-6">
              {/* Export button */}
              {absentMembers.length > 0 && (
                <button
                  onClick={exportAbsentCsv}
                  className="w-full py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  Export absent members CSV
                </button>
              )}

              {/* Members/Kids */}
              {absentMembers.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Members & kids ({absentMembers.length})
                  </div>
                  <div className="space-y-2">
                    {absentMembers.map((m: any) => (
                      <div key={m.memberId} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm" style={{ color: colors.text.primary }}>{m.name}</div>
                            <div className="text-xs" style={{ color: colors.text.muted }}>
                              {m.gender}{m.department && ` • ${m.department}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                            >
                              History
                            </button>
                            <button
                              onClick={() => togglePresent(m.memberId, false)}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                            >
                              Present
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Returning visitors absent */}
              {returningVisitorsAbsent.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Returning visitors absent ({returningVisitorsAbsent.length})
                  </div>
                  <div className="space-y-2">
                    {returningVisitorsAbsent.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present={false}
                        onToggle={() => togglePresent(m.memberId, false)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {absentMembers.length === 0 && returningVisitorsAbsent.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No absences
                </div>
              )}
            </div>
          )}

          {/* Visitors Tab */}
          {activeTab === "visitors" && (
            <div className="space-y-4">
              {/* Export button */}
              {presentVisitors.length > 0 && (
                <button
                  onClick={exportVisitorsCsv}
                  className="w-full py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  Export visitors CSV
                </button>
              )}

              {presentVisitors.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No visitors this Sunday
                </div>
              ) : (
                <div className="space-y-2">
                  {presentVisitors.map((v: any) => (
                    <div key={v.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                      <div className="text-sm mb-1" style={{ color: colors.text.primary }}>{v.name}</div>
                      {v.contact && (
                        <a href={`tel:${v.contact}`} className="text-xs block mb-1" style={{ color: colors.accent.amber }}>
                          {v.contact}
                        </a>
                      )}
                      {v.residence && (
                        <div className="text-xs mb-2" style={{ color: colors.text.muted }}>{v.residence}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => setHistoryVisitor({ name: v.name, memberId: v.memberId })}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                        >
                          History
                        </button>
                        <button
                          onClick={() => togglePresent(v.memberId, true)}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* History Modal */}
        {historyVisitor && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm mb-4" style={{ color: colors.text.primary }}>
                {historyVisitor.name}
              </div>
              {visitorHistory === undefined ? (
                <div className="py-4 text-sm" style={{ color: colors.text.muted }}>Loading…</div>
              ) : !visitorHistory?.length ? (
                <div className="py-4 text-sm" style={{ color: colors.text.muted }}>No attendance records</div>
              ) : (
                <div className="space-y-2 mb-4">
                  {visitorHistory.map((r: any) => (
                    <div key={r._id} className="flex items-center justify-between py-2 text-sm">
                      <span style={{ color: colors.text.secondary }}>{formatDateLong(r.date)}</span>
                      <span style={{ color: r.present ? colors.accent.sage : colors.text.muted }}>
                        {r.present ? "Present" : "Absent"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setHistoryVisitor(null)}
                className="w-full py-3 rounded-xl text-sm"
                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Edit Modals */}
        {editingUnknown && (
          <MemberEditor
            open={!!editingUnknown}
            onClose={() => setEditingUnknown(null)}
            member={editingUnknown}
            onSaved={() => setEditingUnknown(null)}
            allowMoveToKids
          />
        )}
        {editingAbsentMember && (
          <MemberEditor
            open={!!editingAbsentMember}
            onClose={() => setEditingAbsentMember(null)}
            member={editingAbsentMember}
            onSaved={() => setEditingAbsentMember(null)}
            allowMoveToKids
          />
        )}
        {editingAbsentKid && (
          <KidEditor
            open={!!editingAbsentKid}
            onClose={() => setEditingAbsentKid(null)}
            kid={editingAbsentKid}
            onSaved={() => setEditingAbsentKid(null)}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}

// Helper component for person rows
function PersonRow({ person, present, onToggle, onHistory }: { 
  person: any; 
  present: boolean; 
  onToggle: () => void;
  onHistory: () => void;
}) {
  const colors = {
    bg: '#f5f3ef',
    surface: '#faf9f7',
    surfaceHover: '#f0ede8',
    text: {
      primary: '#3d3a36',
      secondary: '#6b6864',
      muted: '#9a9793',
    },
    accent: {
      sage: '#9db88c',
      sageLight: '#c5d4be',
      terracotta: '#c49a84',
      terracottaLight: '#e8d8cc',
    }
  };

  return (
    <div className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ color: colors.text.primary }}>{person.name}</div>
          <div className="text-xs" style={{ color: colors.text.muted }}>{person.contact}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onHistory}
            className="text-xs px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
          >
            History
          </button>
          <button
            onClick={onToggle}
            className="text-xs px-2 py-1 rounded-full"
            style={{ 
              backgroundColor: present ? colors.accent.terracottaLight : colors.accent.sageLight,
              color: present ? colors.accent.terracotta : colors.accent.sage
            }}
          >
            {present ? 'Absent' : 'Present'}
          </button>
        </div>
      </div>
    </div>
  );
}
