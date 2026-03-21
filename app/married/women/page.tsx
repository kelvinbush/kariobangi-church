"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ChevronDown, ChevronUp } from "lucide-react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

const colors = {
  bg: '#f5f3ef', surface: '#faf9f7', surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { purple: '#9a8cb8', purpleLight: '#d4d0e4', sage: '#9db88c', sageLight: '#c5d4be', terracotta: '#c49a84', terracottaLight: '#e8d8cc' }
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

export default function WomenMarriedPage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [viewMode, setViewMode] = useState<"list" | "history">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const marriedStats = useQuery(api.attendance.marriedSummaries, isAuthenticated ? {} : "skip");
  const roster = useQuery(api.attendance.marriedRoster, isAuthenticated ? { gender: "female", date: todayIso } : "skip");
  const trends = useQuery(api.attendance.marriedSundayTrends, isAuthenticated ? { gender: "female", weeks: 8 } : "skip");

  const filteredMembers = useMemo(() => {
    if (!roster) return [];
    if (!searchQuery.trim()) return roster;
    const query = searchQuery.toLowerCase();
    return roster.filter((m) => m.name.toLowerCase().includes(query) || (m.contact && m.contact.toLowerCase().includes(query)));
  }, [roster, searchQuery]);

  const stats = useMemo(() => {
    const total = marriedStats?.totalMarriedWomen || 0;
    const presentToday = roster?.filter((m) => m.presentToday).length || 0;
    const totalRoster = roster?.length || 0;
    const rate = totalRoster > 0 ? Math.round((presentToday / totalRoster) * 100) : 0;
    return { total, presentToday, totalRoster, rate };
  }, [marriedStats, roster]);

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>Women Married</span>
          <div className="flex items-center gap-3">
            <Link href="/married/men" className="text-xs px-3 py-1.5 rounded-full transition-colors" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Men</Link>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: colors.accent.purple }}>
            <div className="flex items-center gap-6">
              <div><div className="text-4xl font-light mb-1 text-white">{stats.total}</div><div className="text-xs text-white/60">Total</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.presentToday}</div><div className="text-xs text-white/60">Present today</div></div>
              <div className="w-px h-10 bg-white/20" />
              <div><div className="text-2xl font-light mb-1 text-white">{stats.rate}%</div><div className="text-xs text-white/60">Rate</div></div>
            </div>
          </div>
          <div className="flex gap-2 mb-6">
            {[{ id: "list", label: "Members" }, { id: "history", label: "Trends" }].map((tab) => (
              <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className="flex-1 py-2 rounded-full text-xs transition-colors" style={{ backgroundColor: viewMode === tab.id ? colors.accent.purpleLight : colors.surface, color: viewMode === tab.id ? colors.accent.purple : colors.text.secondary, fontWeight: viewMode === tab.id ? 500 : 400 }}>{tab.label}</button>
            ))}
          </div>
          {viewMode === "list" && (
            <div className="space-y-4">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search members..." className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }} />
              <div className="space-y-2">
                {roster === undefined ? <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>Loading...</div> : filteredMembers.length === 0 ? <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>No members found</div> : filteredMembers.map((member) => (
                  <div key={member.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: member.presentToday ? colors.accent.sage : colors.text.muted }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ color: colors.text.primary }}>{member.name}</div>
                        {member.department && <div className="text-xs" style={{ color: colors.text.muted }}>{member.department}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viewMode === "history" && (
            <div className="space-y-6">
              {trends && trends.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>Sunday Trends (8 weeks)</div>
                  <div className="space-y-3">
                    {trends.map((day) => (
                      <div key={day.date} className="flex items-center gap-3">
                        <div className="w-16 text-xs shrink-0" style={{ color: colors.text.secondary }}>{formatIsoDate(day.date)}</div>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceHover }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${day.rate}%`, backgroundColor: colors.accent.purple }} />
                        </div>
                        <div className="w-12 text-right text-xs" style={{ color: colors.text.secondary }}>{day.present}/{day.total}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs mb-3" style={{ color: colors.text.muted }}>Member attendance history</div>
                <div className="space-y-2">{roster?.map((member) => <MemberHistoryRow key={member.memberId} member={member} isExpanded={expandedMemberId === member.memberId} onToggle={() => setExpandedMemberId(expandedMemberId === member.memberId ? null : member.memberId)} />)}</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

function MemberHistoryRow({ member, isExpanded, onToggle }: { member: any; isExpanded: boolean; onToggle: () => void }) {
  const history = useQuery(api.attendance.historyForMember, { memberId: member.memberId });
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: colors.text.muted }} /> : <ChevronDown className="w-4 h-4" style={{ color: colors.text.muted }} />}
          <span className="text-sm" style={{ color: colors.text.primary }}>{member.name}</span>
        </div>
        <span className="text-xs" style={{ color: colors.text.muted }}>{history?.length || 0} records</span>
      </button>
      {isExpanded && history && (
        <div className="px-4 pb-3">
          {history.length === 0 ? <p className="text-xs py-2" style={{ color: colors.text.muted }}>No records</p> : (
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 14).map((record: any) => (
                <span key={record._id} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: record.present ? colors.accent.sageLight : colors.accent.terracottaLight, color: record.present ? colors.accent.sage : colors.accent.terracotta }}>{formatIsoDate(record.date)}</span>
              ))}
              {history.length > 14 && <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: colors.surfaceHover, color: colors.text.muted }}>+{history.length - 14}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
