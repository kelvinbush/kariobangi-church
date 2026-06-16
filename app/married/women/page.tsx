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
  const [filterFrequent, setFilterFrequent] = useState(false);

  const marriedStats = useQuery(api.attendance.marriedSummaries, isAuthenticated ? {} : "skip");
  const roster = useQuery(api.attendance.marriedRoster, isAuthenticated ? { gender: "female", date: todayIso } : "skip");
  const trends = useQuery(api.attendance.marriedSundayTrends, isAuthenticated ? { gender: "female", weeks: 8 } : "skip");

  const filteredMembers = useMemo(() => {
    if (!roster) return [];
    let list = roster;

    // Apply frequent attendance filter (3+ times in last 3 months)
    if (filterFrequent) {
      list = list.filter((m) => (m.past3MonthsAttendanceCount ?? 0) >= 3);
    }

    // Apply search filter (name, contact, location)
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter((m) => 
      m.name.toLowerCase().includes(query) || 
      (m.contact && m.contact.toLowerCase().includes(query)) ||
      (m.residence && m.residence.toLowerCase().includes(query))
    );
  }, [roster, searchQuery, filterFrequent]);

  const handleShareWhatsapp = () => {
    if (filteredMembers.length === 0) return;

    const formattedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let message = `*MARRIED WOMEN ROSTER*\n`;
    message += `Altar: Imara Daima Altar — The Imaara Mall 3rd Floor\n`;
    message += `Date: ${formattedDate}\n`;
    if (filterFrequent) {
      message += `Filter: Attended 3+ times in last 3 months\n`;
    }
    message += `Total Married Women: ${filteredMembers.length}\n\n`;

    filteredMembers.forEach((m, idx) => {
      const name = m.name;
      const phone = m.contact || "No Phone";
      const residence = m.residence || "No Residence";
      const countInfo = m.past3MonthsAttendanceCount !== undefined ? ` (${m.past3MonthsAttendanceCount} visits)` : "";
      message += `${idx + 1}. *${name}* - ${phone} - ${residence}${countInfo}\n`;
    });

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
  };

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
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search members by name, contact, residence..." className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }} />
              
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setFilterFrequent(!filterFrequent)}
                  id="filter-frequent-btn"
                  className="px-3.5 py-2 rounded-full text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: filterFrequent ? colors.accent.purpleLight : colors.surface,
                    color: filterFrequent ? colors.accent.purple : colors.text.secondary,
                    fontWeight: filterFrequent ? 500 : 400
                  }}
                >
                  <span>Attended 3+ times (3mo)</span>
                  {filterFrequent && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.accent.purple }} />
                  )}
                </button>

                <button
                  onClick={handleShareWhatsapp}
                  id="share-whatsapp-btn"
                  disabled={filteredMembers.length === 0}
                  className="px-4 py-2 rounded-full text-xs transition-colors flex items-center gap-1.5 text-white disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: "#25d366" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                  </svg>
                  <span>Share WhatsApp</span>
                </button>
              </div>

              <div className="space-y-2">
                {roster === undefined ? (
                  <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>Loading...</div>
                ) : filteredMembers.length === 0 ? (
                  <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>No members found</div>
                ) : filteredMembers.map((member) => (
                  <div key={member.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: member.presentToday ? colors.accent.sage : colors.text.muted }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: colors.text.primary }}>{member.name}</div>
                        <div className="mt-1 space-y-0.5">
                          {member.contact && (
                            <div className="text-xs flex items-center gap-1" style={{ color: colors.text.secondary }}>
                              <span className="opacity-60 text-[10px]">📞</span> <span>{member.contact}</span>
                            </div>
                          )}
                          {member.residence && (
                            <div className="text-xs flex items-center gap-1" style={{ color: colors.text.secondary }}>
                              <span className="opacity-60 text-[10px]">📍</span> <span>{member.residence}</span>
                            </div>
                          )}
                          {member.past3MonthsAttendanceCount !== undefined && (
                            <div className="text-xs flex items-center gap-1" style={{ color: colors.accent.purple, fontWeight: 500 }}>
                              <span className="opacity-80 text-[10px]">⛪</span> <span>{member.past3MonthsAttendanceCount} visits in last 3 months</span>
                            </div>
                          )}
                        </div>
                        {member.department && (
                          <div className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                            {member.department}
                          </div>
                        )}
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
