"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AttendancePieChart } from "@/components/charts";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ChevronDown, ChevronUp, TrendingUp, Calendar, Users, Activity } from "lucide-react";

export default function LadiesYouthPage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState<"list" | "history">("list");
  const [historyView, setHistoryView] = useState<"byDate" | "byMember">("byDate");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  const youthStats = useQuery(api.attendance.youthSummaries, isAuthenticated ? {} : "skip");
  const roster = useQuery(
    api.attendance.youthRoster,
    isAuthenticated ? { gender: "female", date: todayIso } : "skip"
  );
  const lastSundayStats = useQuery(
    api.attendance.lastSundayYouthAttendanceRate,
    isAuthenticated ? { gender: "female" } : "skip"
  );
  const attendanceHistory = useQuery(
    api.attendance.youthAttendanceByDate,
    isAuthenticated ? { gender: "female", date: selectedDate } : "skip"
  );
  const trends = useQuery(
    api.attendance.youthAttendanceTrends,
    isAuthenticated ? { gender: "female", days: 7 } : "skip"
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
    const total = youthStats?.totalFemaleYouth || 0;
    const active = youthStats?.activeFemaleYouth || 0;
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

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-rose-50 via-pink-50 to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.05), rgba(48,48,48,0.05)), linear-gradient(135deg, #FFF1F2 0%, #FDF2F8 50%, #F4F4F5 100%)",
      }}
    >
      {/* Header */}
      <div className="backdrop-blur-xl sticky top-0 z-10 border-b border-zinc-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-full bg-zinc-900/90 text-white text-sm font-light hover:bg-zinc-900 transition-colors"
              >
                ← Home
              </Link>
              <div>
                <div className="text-zinc-900 font-light tracking-tight text-xl flex items-center gap-2">
                  <span className="text-xl">👩</span> Ladies Youth
                </div>
                <div className="text-xs text-zinc-600">Female Youth Members Dashboard</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/youth/men"
                className="px-3 py-1.5 rounded-full bg-blue-100/70 text-blue-700 text-sm hover:bg-blue-100 transition-colors"
              >
                👨 Men Youth →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700">Please sign in to access the Ladies Youth dashboard.</p>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard 
              label="Total Female Youth" 
              value={stats.total} 
              icon={<Users className="w-4 h-4" />}
              color="rose"
            />
            <StatCard 
              label="Active Members" 
              value={stats.active} 
              icon={<Activity className="w-4 h-4" />}
              color="emerald"
            />
            <StatCard 
              label="Present Today" 
              value={stats.presentToday} 
              icon={<TrendingUp className="w-4 h-4" />}
              color="amber"
            />
            <StatCard 
              label="Attendance Rate" 
              value={`${stats.rate}%`} 
              icon={<Calendar className="w-4 h-4" />}
              color="pink"
            />
          </div>

          {/* Last Sunday Stats */}
          {lastSundayStats && (
            <div className="rounded-2xl p-4 md:p-5 bg-rose-600 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-sm text-rose-100 mb-1">
                    Last Sunday Attendance ({formatIsoDate(lastSundayStats.date)})
                  </div>
                  <div className="text-3xl font-medium">
                    {lastSundayStats.present} <span className="text-lg text-rose-200">/ {lastSundayStats.total}</span>
                  </div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Attendance Rate</span>
                    <span>{lastSundayStats.rate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-800/50 overflow-hidden">
                    <div 
                      className="h-full bg-white" 
                      style={{ width: `${lastSundayStats.rate}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                viewMode === "list"
                  ? "bg-rose-600 text-white"
                  : "bg-white/70 text-zinc-700 hover:bg-white"
              }`}
            >
              📋 Master List
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                viewMode === "history"
                  ? "bg-rose-600 text-white"
                  : "bg-white/70 text-zinc-700 hover:bg-white"
              }`}
            >
              📅 Attendance History
            </button>
          </div>

          {/* Master List View */}
          {viewMode === "list" && (
            <>
              {/* Search & Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-zinc-900">Master List</h3>
                    <span className="text-sm text-zinc-600">
                      {filteredMembers.length} members
                    </span>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, contact, residence, or department..."
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-white/70 text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-rose-300 mb-4"
                  />
                  
                  {roster === undefined ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-xl p-4 bg-white/40 animate-pulse">
                          <div className="h-4 w-3/4 rounded bg-zinc-200" />
                          <div className="h-3 w-1/2 rounded mt-2 bg-zinc-200" />
                        </div>
                      ))}
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="rounded-xl p-8 bg-white/30 text-center">
                      <div className="text-3xl mb-2">🔍</div>
                      <div className="text-zinc-600">No members found</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredMembers.map((member) => (
                        <div
                          key={member.memberId}
                          className="rounded-xl p-3 bg-white/40 hover:bg-white/60 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${member.presentToday ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <div>
                              <div className="font-medium text-zinc-900 text-sm">{member.name}</div>
                              <div className="text-xs text-zinc-600 flex items-center gap-2">
                                {member.contact && <span>📞 {member.contact}</span>}
                                {member.residence && <span>📍 {member.residence}</span>}
                                {member.department && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                    {member.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-zinc-500">
                            {member.lastAttendance ? (
                              <span>
                                Last: {formatIsoDate(member.lastAttendance.date)} {" "}
                                {member.lastAttendance.present ? "✓" : "✗"}
                              </span>
                            ) : (
                              <span className="text-zinc-400">No attendance yet</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today's Attendance Chart */}
                <div className="rounded-2xl bg-white/60 backdrop-blur-xl flex flex-col">
                  <div className="px-6 pt-5 pb-0">
                    <h3 className="text-sm font-medium text-zinc-900">Today&apos;s Attendance</h3>
                    <p className="text-xs text-zinc-500 mt-1">{formatIsoDate(todayIso)}</p>
                  </div>
                  <div className="px-4 pb-0">
                    <AttendancePieChart
                      data={chartData}
                      title="Attendance"
                    />
                  </div>
                  <div className="px-6 pb-5 pt-3 text-xs text-zinc-600">
                    <div className="flex items-center justify-between">
                      <span>Present: {roster?.filter(m => m.presentToday).length || 0}</span>
                      <span>Absent: {(roster?.length || 0) - (roster?.filter(m => m.presentToday).length || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Attendance History View */}
          {viewMode === "history" && (
            <>
              {/* History View Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistoryView("byDate")}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    historyView === "byDate"
                      ? "bg-rose-600 text-white"
                      : "bg-white/70 text-zinc-700 hover:bg-white"
                  }`}
                >
                  By Date
                </button>
                <button
                  onClick={() => setHistoryView("byMember")}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    historyView === "byMember"
                      ? "bg-rose-600 text-white"
                      : "bg-white/70 text-zinc-700 hover:bg-white"
                  }`}
                >
                  By Member
                </button>
              </div>

              {/* Date Selector for By Date View */}
              {historyView === "byDate" && (
                <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm text-zinc-700">Select Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>

                  {attendanceHistory && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <StatCardSmall label="Total" value={attendanceHistory.total} />
                        <StatCardSmall 
                          label="Present" 
                          value={attendanceHistory.present} 
                          color="emerald"
                        />
                        <StatCardSmall 
                          label="Absent" 
                          value={attendanceHistory.absent} 
                          color="rose"
                        />
                      </div>

                      <div className="rounded-xl bg-white/40 overflow-hidden">
                        <table className="min-w-full">
                          <thead className="bg-zinc-100/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-700">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-700">Department</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-zinc-700">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {attendanceHistory.members.map((m) => (
                              <tr key={m.memberId} className="hover:bg-white/50">
                                <td className="px-4 py-2 text-sm text-zinc-900">{m.name}</td>
                                <td className="px-4 py-2 text-sm text-zinc-600">{m.department || "-"}</td>
                                <td className="px-4 py-2 text-center">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
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
                  )}
                </div>
              )}

              {/* By Member View */}
              {historyView === "byMember" && (
                <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                  <h3 className="font-medium text-zinc-900 mb-4">Member Attendance Records</h3>
                  {roster === undefined ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-xl p-4 bg-white/40 animate-pulse">
                          <div className="h-4 w-3/4 rounded bg-zinc-200" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {roster.map((member) => (
                        <MemberHistoryRow key={member.memberId} member={member} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trends Chart */}
              {trends && trends.length > 0 && (
                <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                  <h3 className="font-medium text-zinc-900 mb-4">Attendance Trends (Last 7 Days)</h3>
                  <div className="space-y-2">
                    {trends.map((day) => (
                      <div key={day.date} className="flex items-center gap-4">
                        <div className="w-24 text-xs text-zinc-600">{formatIsoDate(day.date)}</div>
                        <div className="flex-1 h-6 rounded-full bg-zinc-100 overflow-hidden relative">
                          <div
                            className="h-full bg-rose-500 transition-all"
                            style={{ width: `${day.rate}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-xs">
                            <span className="bg-white/80 px-1 rounded">
                              {day.present}/{day.total} ({day.rate}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SignedIn>
      </div>
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
  color?: "zinc" | "rose" | "emerald" | "amber" | "pink";
}) {
  const colorClasses = {
    zinc: "bg-zinc-900/90 text-white",
    rose: "bg-rose-600 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    pink: "bg-pink-600 text-white",
  };

  return (
    <div className={`rounded-2xl p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 opacity-80 mb-1 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-medium">{value}</div>
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
    <div className={`rounded-xl px-4 py-2 ${colorClasses[color]}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-medium">{value}</div>
    </div>
  );
}

function MemberHistoryRow({ member }: { member: any }) {
  const [expanded, setExpanded] = useState(false);
  const history = useQuery(
    api.attendance.historyForMember,
    { memberId: member.memberId }
  );

  return (
    <div className="rounded-xl bg-white/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          <span className="font-medium text-sm text-zinc-900">{member.name}</span>
          {member.department && (
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs">
              {member.department}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {history?.length || 0} records
        </div>
      </button>
      
      {expanded && history && (
        <div className="px-4 pb-3 pt-0">
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">No attendance records yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 20).map((record: any) => (
                <span
                  key={record._id}
                  className={`px-2 py-1 rounded-lg text-xs ${
                    record.present
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                  title={record.present ? "Present" : "Absent"}
                >
                  {formatIsoDate(record.date)}
                </span>
              ))}
              {history.length > 20 && (
                <span className="px-2 py-1 rounded-lg text-xs bg-zinc-100 text-zinc-600">
                  +{history.length - 20} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
