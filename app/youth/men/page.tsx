"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AttendancePieChart } from "@/components/charts";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ChevronDown, ChevronUp, TrendingUp, Calendar, Users, Activity, Menu, X } from "lucide-react";

export default function MenYouthPage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState<"list" | "history">("list");
  const [historyView, setHistoryView] = useState<"byDate" | "byMember">("byDate");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Fetch data
  const youthStats = useQuery(api.attendance.youthSummaries, isAuthenticated ? {} : "skip");
  const roster = useQuery(
    api.attendance.youthRoster,
    isAuthenticated ? { gender: "male", date: todayIso } : "skip"
  );
  const lastSundayStats = useQuery(
    api.attendance.lastSundayYouthAttendanceRate,
    isAuthenticated ? { gender: "male" } : "skip"
  );
  const attendanceHistory = useQuery(
    api.attendance.youthAttendanceByDate,
    isAuthenticated ? { gender: "male", date: selectedDate } : "skip"
  );
  const trends = useQuery(
    api.attendance.youthAttendanceTrends,
    isAuthenticated ? { gender: "male", days: 7 } : "skip"
  );

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!roster) return [];
    if (!searchQuery.trim()) return roster;
    const query = searchQuery.toLowerCase();
    return roster.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.contact && m.contact.toLowerCase().includes(query)) ||
        (m.residence && m.residence.toLowerCase().includes(query)) ||
        (m.department && m.department.toLowerCase().includes(query))
    );
  }, [roster, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = youthStats?.totalMaleYouth || 0;
    const active = youthStats?.activeMaleYouth || 0;
    const presentToday = roster?.filter((m) => m.presentToday).length || 0;
    const totalRoster = roster?.length || 0;
    const rate = totalRoster > 0 ? Math.round((presentToday / totalRoster) * 100) : 0;
    return { total, active, presentToday, totalRoster, rate };
  }, [youthStats, roster]);

  // Chart data
  const chartData = useMemo(() => {
    if (!roster) return [];
    const present = roster.filter((m) => m.presentToday).length;
    const absent = roster.length - present;
    return [
      { name: "Present", value: present, color: "#10b981" },
      { name: "Absent", value: absent, color: "#f43f5e" },
    ];
  }, [roster]);

  const toggleMemberExpand = (memberId: string) => {
    setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
  };

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-blue-50 via-slate-50 to-zinc-50 pb-20"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.05), rgba(48,48,48,0.05)), linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 50%, #F4F4F5 100%)",
      }}
    >
      {/* Header - Mobile Optimized */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/90 border-b border-zinc-200/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Home + Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link
                href="/"
                className="shrink-0 p-2 sm:px-3 sm:py-1.5 rounded-full bg-zinc-900/90 text-white text-sm font-light hover:bg-zinc-900 transition-colors flex items-center gap-1"
              >
                <span className="hidden sm:inline">←</span>
                <span className="text-xs sm:text-sm">Home</span>
              </Link>
              <div className="min-w-0">
                <h1 className="text-zinc-900 font-medium text-base sm:text-lg truncate flex items-center gap-1">
                  <span>👨</span>
                  <span className="hidden sm:inline">Men Youth</span>
                  <span className="sm:hidden">Men Youth</span>
                </h1>
                <p className="text-[10px] sm:text-xs text-zinc-500 truncate hidden sm:block">Male Youth Members Dashboard</p>
              </div>
            </div>

            {/* Right: Mobile Menu + Nav */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/youth/ladies"
                className="hidden sm:inline-flex px-3 py-1.5 rounded-full bg-rose-100/70 text-rose-700 text-xs sm:text-sm hover:bg-rose-100 transition-colors items-center gap-1"
              >
                👩 Ladies →
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-3 pt-3 border-t border-zinc-200/50 space-y-2">
              <Link
                href="/youth/ladies"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-100/70 text-rose-700 text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>👩</span> Ladies Youth
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => { setViewMode("list"); setMobileMenuOpen(false); }}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  📋 Master List
                </button>
                <button
                  onClick={() => { setViewMode("history"); setMobileMenuOpen(false); }}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm ${viewMode === "history" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  📅 History
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <SignedOut>
          <div className="max-w-md mx-auto">
            <div className="rounded-2xl p-6 sm:p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700 text-sm">Please sign in to access the Men Youth dashboard.</p>
              <SignInButton mode="modal">
                <button className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-sm">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Overview - Mobile: 2 columns, Desktop: 4 columns */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <StatCard 
              label="Total" 
              value={stats.total} 
              icon={<Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              color="blue"
            />
            <StatCard 
              label="Active" 
              value={stats.active} 
              icon={<Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              color="emerald"
            />
            <StatCard 
              label="Present" 
              value={stats.presentToday} 
              icon={<TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              color="amber"
            />
            <StatCard 
              label="Rate" 
              value={`${stats.rate}%`} 
              icon={<Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              color="indigo"
            />
          </div>

          {/* Last Sunday Stats - Mobile Optimized */}
          {lastSundayStats && (
            <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-blue-600 text-white">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-100">Last Sunday</div>
                    <div className="text-lg sm:text-2xl font-medium">
                      {lastSundayStats.present} <span className="text-sm sm:text-base text-blue-200">/ {lastSundayStats.total}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-blue-100">Rate</div>
                    <div className="text-lg font-medium">{lastSundayStats.rate}%</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-blue-800/50 overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-500" 
                    style={{ width: `${lastSundayStats.rate}%` }} 
                  />
                </div>
                <div className="text-[10px] sm:text-xs text-blue-200">
                  {formatIsoDate(lastSundayStats.date)}
                </div>
              </div>
            </div>
          )}

          {/* Desktop View Toggle - Hidden on mobile (in menu instead) */}
          <div className="hidden sm:flex items-center gap-2">
            <ViewToggleButton active={viewMode === "list"} onClick={() => setViewMode("list")} color="blue">
              📋 Master List
            </ViewToggleButton>
            <ViewToggleButton active={viewMode === "history"} onClick={() => setViewMode("history")} color="blue">
              📅 Attendance History
            </ViewToggleButton>
          </div>

          {/* Master List View */}
          {viewMode === "list" && (
            <div className="space-y-4">
              {/* Search - Mobile Optimized */}
              <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-white/60 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-zinc-900 text-sm sm:text-base">Master List</h3>
                  <span className="text-xs sm:text-sm text-zinc-600">
                    {filteredMembers.length} members
                  </span>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-200 bg-white/70 text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Members List & Chart Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Members List */}
                <div className="lg:col-span-2 space-y-2">
                  {roster === undefined ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-xl p-3 sm:p-4 bg-white/40 animate-pulse">
                          <div className="h-4 w-3/4 rounded bg-zinc-200" />
                          <div className="h-3 w-1/2 rounded mt-2 bg-zinc-200" />
                        </div>
                      ))}
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="rounded-xl p-6 sm:p-8 bg-white/30 text-center">
                      <div className="text-2xl sm:text-3xl mb-2">🔍</div>
                      <div className="text-zinc-600 text-sm">No members found</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredMembers.map((member) => (
                        <div
                          key={member.memberId}
                          className="rounded-xl p-3 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${member.presentToday ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-zinc-900 text-sm">{member.name}</span>
                                {member.department && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs">
                                    {member.department}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
                                {member.contact && <span>📞 {member.contact}</span>}
                                {member.residence && <span>📍 {member.residence}</span>}
                              </div>
                              <div className="mt-1.5 text-[10px] sm:text-xs text-zinc-400">
                                {member.lastAttendance ? (
                                  <span>
                                    Last: {formatIsoDate(member.lastAttendance.date)} {" "}
                                    <span className={member.lastAttendance.present ? "text-emerald-600" : "text-rose-500"}>
                                      {member.lastAttendance.present ? "✓ Present" : "✗ Absent"}
                                    </span>
                                  </span>
                                ) : (
                                  <span>No attendance yet</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today's Attendance Chart - Sticky on desktop */}
                <div className="lg:sticky lg:top-24 h-fit">
                  <div className="rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-xl p-3 sm:p-4">
                    <div className="mb-2">
                      <h3 className="text-sm font-medium text-zinc-900">Today&apos;s Attendance</h3>
                      <p className="text-[10px] sm:text-xs text-zinc-500">{formatIsoDate(todayIso)}</p>
                    </div>
                    <div className="max-w-[200px] mx-auto">
                      <AttendancePieChart data={chartData} title="Attendance" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-200/50 flex justify-between text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Present: {roster?.filter(m => m.presentToday).length || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Absent: {(roster?.length || 0) - (roster?.filter(m => m.presentToday).length || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attendance History View */}
          {viewMode === "history" && (
            <div className="space-y-4">
              {/* Desktop History Toggle */}
              <div className="hidden sm:flex items-center gap-2">
                <HistoryToggleButton active={historyView === "byDate"} onClick={() => setHistoryView("byDate")} color="blue">
                  By Date
                </HistoryToggleButton>
                <HistoryToggleButton active={historyView === "byMember"} onClick={() => setHistoryView("byMember")} color="blue">
                  By Member
                </HistoryToggleButton>
              </div>

              {/* Mobile History Toggle */}
              <div className="flex sm:hidden gap-2">
                <button
                  onClick={() => setHistoryView("byDate")}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm ${historyView === "byDate" ? "bg-blue-600 text-white" : "bg-white/70 text-zinc-700"}`}
                >
                  By Date
                </button>
                <button
                  onClick={() => setHistoryView("byMember")}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm ${historyView === "byMember" ? "bg-blue-600 text-white" : "bg-white/70 text-zinc-700"}`}
                >
                  By Member
                </button>
              </div>

              {/* Date Selector for By Date View */}
              {historyView === "byDate" && (
                <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-white/60 backdrop-blur-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <label className="text-sm text-zinc-700 font-medium">Select Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  {attendanceHistory && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <StatCardSmall label="Total" value={attendanceHistory.total} />
                        <StatCardSmall label="Present" value={attendanceHistory.present} color="emerald" />
                        <StatCardSmall label="Absent" value={attendanceHistory.absent} color="rose" />
                      </div>

                      <div className="rounded-lg sm:rounded-xl bg-white/40 overflow-hidden -mx-3 sm:mx-0">
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-zinc-100/50">
                              <tr>
                                <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] sm:text-xs font-medium text-zinc-700">Name</th>
                                <th className="hidden sm:table-cell px-4 py-2.5 text-left text-xs font-medium text-zinc-700">Dept</th>
                                <th className="px-3 sm:px-4 py-2.5 text-center text-[10px] sm:text-xs font-medium text-zinc-700">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {attendanceHistory.members.map((m) => (
                                <tr key={m.memberId} className="hover:bg-white/50">
                                  <td className="px-3 sm:px-4 py-2.5 text-sm text-zinc-900">
                                    <div className="font-medium">{m.name}</div>
                                    <div className="sm:hidden text-[10px] text-zinc-500">{m.department || "-"}</div>
                                  </td>
                                  <td className="hidden sm:table-cell px-4 py-2.5 text-sm text-zinc-600">{m.department || "-"}</td>
                                  <td className="px-3 sm:px-4 py-2.5 text-center">
                                    <span
                                      className={`inline-flex px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                        m.present
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-rose-100 text-rose-700"
                                      }`}
                                    >
                                      {m.present ? "Present" : "Absent"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* By Member View */}
              {historyView === "byMember" && (
                <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-white/60 backdrop-blur-xl">
                  <h3 className="font-medium text-zinc-900 mb-3 text-sm sm:text-base">Member Attendance Records</h3>
                  {roster === undefined ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-xl p-3 sm:p-4 bg-white/40 animate-pulse">
                          <div className="h-4 w-3/4 rounded bg-zinc-200" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roster.map((member) => (
                        <MobileMemberHistoryRow 
                          key={member.memberId} 
                          member={member}
                          isExpanded={expandedMemberId === member.memberId}
                          onToggle={() => toggleMemberExpand(member.memberId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trends Chart */}
              {trends && trends.length > 0 && (
                <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-white/60 backdrop-blur-xl">
                  <h3 className="font-medium text-zinc-900 mb-3 text-sm sm:text-base">Attendance Trends (7 Days)</h3>
                  <div className="space-y-2">
                    {trends.map((day) => (
                      <div key={day.date} className="flex items-center gap-3">
                        <div className="w-16 sm:w-24 text-[10px] sm:text-xs text-zinc-600 shrink-0">{formatIsoDate(day.date)}</div>
                        <div className="flex-1 h-5 sm:h-6 rounded-full bg-zinc-100 overflow-hidden relative">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${day.rate}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] sm:text-xs bg-white/90 px-1.5 rounded">
                              {day.present}/{day.total}
                            </span>
                          </div>
                        </div>
                        <div className="w-8 sm:w-10 text-right text-[10px] sm:text-xs text-zinc-600">{day.rate}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon,
  color = "zinc"
}: { 
  label: string; 
  value: string | number;
  icon: React.ReactNode;
  color?: "zinc" | "blue" | "emerald" | "amber" | "indigo" | "rose";
}) {
  const colorClasses = {
    zinc: "bg-zinc-900/90 text-white",
    blue: "bg-blue-600 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    indigo: "bg-indigo-600 text-white",
    rose: "bg-rose-600 text-white",
  };

  return (
    <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 opacity-80 mb-1 text-[10px] sm:text-xs">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-medium">{value}</div>
    </div>
  );
}

function StatCardSmall({ 
  label, 
  value, 
  color = "zinc"
}: { 
  label: string; 
  value: number;
  color?: "zinc" | "emerald" | "rose";
}) {
  const colorClasses = {
    zinc: "bg-zinc-100 text-zinc-900",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <div className={`rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 ${colorClasses[color]}`}>
      <div className="text-[10px] sm:text-xs opacity-70">{label}</div>
      <div className="text-lg sm:text-xl font-medium">{value}</div>
    </div>
  );
}

function ViewToggleButton({ 
  active, 
  onClick, 
  children,
  color = "blue"
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  color?: "blue" | "rose";
}) {
  const activeClasses = color === "blue" ? "bg-blue-600 text-white" : "bg-rose-600 text-white";
  const inactiveClasses = "bg-white/70 text-zinc-700 hover:bg-white";

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm transition-colors ${active ? activeClasses : inactiveClasses}`}
    >
      {children}
    </button>
  );
}

function HistoryToggleButton({ 
  active, 
  onClick, 
  children,
  color = "blue"
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  color?: "blue" | "rose";
}) {
  const activeClasses = color === "blue" ? "bg-blue-600 text-white" : "bg-rose-600 text-white";
  const inactiveClasses = "bg-white/70 text-zinc-700 hover:bg-white";

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? activeClasses : inactiveClasses}`}
    >
      {children}
    </button>
  );
}

function MobileMemberHistoryRow({ 
  member, 
  isExpanded, 
  onToggle 
}: { 
  member: any; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const history = useQuery(
    api.attendance.historyForMember,
    { memberId: member.memberId }
  );

  return (
    <div className="rounded-lg sm:rounded-xl bg-white/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-white/70 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
          <span className="font-medium text-sm text-zinc-900 truncate">{member.name}</span>
          {member.department && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
              {member.department}
            </span>
          )}
        </div>
        <div className="text-[10px] sm:text-xs text-zinc-500 shrink-0">
          {history?.length || 0} records
        </div>
      </button>
      
      {isExpanded && history && (
        <div className="px-3 sm:px-4 pb-3 pt-0">
          {history.length === 0 ? (
            <p className="text-xs sm:text-sm text-zinc-500 py-2">No attendance records yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 16).map((record: any) => (
                <span
                  key={record._id}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs ${
                    record.present
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {formatIsoDate(record.date)}
                </span>
              ))}
              {history.length > 16 && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs bg-zinc-100 text-zinc-600">
                  +{history.length - 16}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
