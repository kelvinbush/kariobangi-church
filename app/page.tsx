"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QuickAddMember from "@/components/QuickAddMember";
import { AttendanceAreaChart, MultiAreaChart, AttendanceBarChart, AttendancePieChart } from "@/components/charts";
import { formatDate, formatIsoDate } from "@/lib/date";

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const roster = useQuery(
    api.attendance.rosterForDate,
    isAuthenticated ? { date: todayIso } : "skip"
  );
  const summaries = useQuery(
    api.attendance.summaries,
    isAuthenticated ? {} : "skip"
  );
  const recent = useQuery(
    api.attendance.recentActivity,
    isAuthenticated ? { limit: 10 } : "skip"
  );

  const trends = useQuery(
    api.attendance.attendanceTrends,
    isAuthenticated ? { days: 7 } : "skip"
  );

  const lastSundayRate = useQuery(
    api.attendance.lastSundayAttendanceRate,
    isAuthenticated ? {} : "skip"
  );

  const retention = useQuery(
    api.attendance.visitorRetention,
    isAuthenticated ? {} : "skip"
  );

  const members = roster ?? [];
  // Separate members from visitors and returning visitors
  // IMPORTANT: Exclude both "visitor" AND "returningVisitor" from members count
  const membersOnly = useMemo(() => 
    members.filter((m: any) => m.type !== "visitor" && m.type !== "returningVisitor"), 
    [members]
  );
  
  // For totals, use summaries query (direct from database) instead of roster
  // Roster includes returning visitors which should not be counted as members
  const totalMembers = summaries ? summaries.totalMen + summaries.totalWomen : membersOnly.length;
  const totalKids = summaries ? summaries.totalKids : 0;
  
  const present = useMemo(
    () => membersOnly.filter((m) => m.presentToday).length,
    [membersOnly]
  );
  
  // Use lastSundayRate for visitor counts (accurate for that date)
  // Don't count from roster as it may include returning visitors incorrectly
  const totalVisitors = lastSundayRate ? lastSundayRate.visitorsTotal : 0;
  const presentVisitors = lastSundayRate ? lastSundayRate.visitorsPresent : 0;
  const totalAttendance = present + presentVisitors;
  const rate = totalMembers > 0 ? Math.round((present / totalMembers) * 100) : 0;
  const absent = Math.max(totalMembers - present, 0);

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <div className="backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-zinc-900 font-light tracking-tight text-xl">Dashboard</div>
            <div className="text-xs text-zinc-600">Quick overview and actions</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/attendance"
              className="inline-flex px-3 py-1.5 rounded-full bg-zinc-900/90 text-white hover:bg-zinc-900 text-xs sm:text-sm"
            >
              Mark Attendance
            </Link>
            <Link
              href="/visitors"
              className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
            >
              Visitors
            </Link>
            <Link
              href="/attendance/history"
              className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
            >
              History
            </Link>
            <Link
              href="/master-list"
              className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
            >
              Master List
            </Link>
            <Link
              href="/members/import"
              className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
            >
              Import CSV
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700">Please sign in to access the dashboard.</p>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Merge Notification Banner */}
          {retention && retention.visitorsReadyToMerge.length > 0 && (
            <div className="rounded-2xl p-4 bg-amber-400/90 text-zinc-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="font-medium mb-1">
                    {retention.visitorsReadyToMerge.length} Visitor{retention.visitorsReadyToMerge.length > 1 ? 's' : ''} Ready to Merge
                  </div>
                  <div className="text-sm text-zinc-700">
                    These visitors have attended 4+ Sundays and can be merged into the member list.
                  </div>
                </div>
                <Link
                  href="/attendance"
                  className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm hover:bg-zinc-800"
                >
                  Review & Merge
                </Link>
              </div>
            </div>
          )}

          {/* Highlights */}
          <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
                  {formatDate(new Date())}
                </span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Members: {totalMembers}</span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Present: {present}</span>
                {lastSundayRate && (
                  <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
                    Visitors ({formatIsoDate(lastSundayRate.date)}): {lastSundayRate.visitorsPresent}
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <Link
                  href="/attendance"
                  className="px-3 py-2 sm:py-1.5 rounded-full bg-amber-300 text-zinc-900 text-sm text-center"
                >
                  Open Attendance
                </Link>
                <QuickAddMember dateIso={todayIso} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-8">
                <Stat label="Total Attendance" value={`${totalAttendance}`} />
                <Stat label="Members Present" value={`${present} / ${totalMembers}`} />
                {lastSundayRate && (
                  <Stat label="Visitors" value={`${lastSundayRate.visitorsPresent}`} />
                )}
              </div>
              <div className="flex-1 max-w-xl">
                <div className="text-sm mb-1">
                  ATTENDANCE RATE {lastSundayRate && `(${formatIsoDate(lastSundayRate.date)})`}
                </div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400" 
                    style={{ width: `${lastSundayRate ? lastSundayRate.rate : rate}%` }} 
                  />
                </div>
                <div className="text-xs mt-1">{lastSundayRate ? lastSundayRate.rate : rate}%</div>
              </div>
            </div>
          </div>

          {/* Summaries */}
          {summaries && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Total Men" value={summaries.totalMen} />
              <SummaryCard label="Total Women" value={summaries.totalWomen} />
              <SummaryCard label="Total Kids" value={summaries.totalKids} />
              <SummaryCard label="Total Youths" value={summaries.totalYouths} />
              <SummaryCard 
                label={lastSundayRate ? `Total Visitors (${formatIsoDate(lastSundayRate.date)})` : "Total Visitors"} 
                value={lastSundayRate ? lastSundayRate.visitorsTotal : (summaries?.totalVisitors || 0)} 
              />
            </div>
          )}

          {/* Demographics Chart Only */}
          {summaries && (
            <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl">
              <AttendancePieChart
                data={[
                  { name: "Men", value: summaries.totalMen, color: "#3b82f6" },
                  { name: "Women", value: summaries.totalWomen, color: "#ec4899" },
                  { name: "Kids", value: summaries.totalKids, color: "#f59e0b" },
                  { name: "Youths", value: summaries.totalYouths, color: "#10b981" },
                ]}
                title="Member Demographics"
              />
            </div>
          )}

          {/* Retention Rate Card */}
          {retention && (
            <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl">
              <h3 className="text-lg font-medium text-zinc-900 mb-4">Retention Rate (Last 4 Weeks)</h3>
              <div className="space-y-4">
                {retention.weeks.map((week, index) => (
                  <div key={week.date} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-white/50">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900 mb-1">
                        Week {retention.weeks.length - index} ({formatIsoDate(week.date)})
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                        <span>New: {week.newVisitors}</span>
                        <span>Returning: {week.returningVisitors}</span>
                        <span>Total: {week.totalVisitors}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-zinc-200 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400" 
                          style={{ width: `${week.totalVisitors > 0 ? Math.round((week.returningVisitors / week.totalVisitors) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-600 min-w-[3rem]">
                        {week.totalVisitors > 0 ? Math.round((week.returningVisitors / week.totalVisitors) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-zinc-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-zinc-600 text-xs mb-1">Total Unique Visitors</div>
                      <div className="text-lg font-medium text-zinc-900">{retention.totalUnique}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 text-xs mb-1">Ready to Merge</div>
                      <div className="text-lg font-medium text-amber-600">{retention.visitorsReadyToMerge.length}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 text-xs mb-1">Avg. Weekly Visitors</div>
                      <div className="text-lg font-medium text-zinc-900">
                        {retention.weeks.length > 0 
                          ? Math.round(retention.weeks.reduce((sum, w) => sum + w.totalVisitors, 0) / retention.weeks.length)
                          : 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-600 text-xs mb-1">Avg. Retention Rate</div>
                      <div className="text-lg font-medium text-zinc-900">
                        {retention.weeks.length > 0
                          ? Math.round(
                              retention.weeks.reduce((sum, w) => 
                                sum + (w.totalVisitors > 0 ? (w.returningVisitors / w.totalVisitors) * 100 : 0), 0
                              ) / retention.weeks.length
                            )
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/attendance" className="px-3 py-2 sm:py-1.5 rounded-full bg-zinc-900/90 text-white hover:bg-zinc-900 text-sm">
              Mark Attendance
            </Link>
            <Link href="/attendance/history" className="px-3 py-2 sm:py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-sm">
              Attendance History
            </Link>
            <Link href="/members/import" className="px-3 py-2 sm:py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-sm">
              Import Members
            </Link>
            <Link href="/kids/import" className="px-3 py-2 sm:py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-sm">
              Import Kids
            </Link>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-zinc-900 font-medium">Recent activity</div>
              <Link href="/attendance" className="text-sm text-zinc-600 hover:text-zinc-900">View →</Link>
            </div>
            <ul className="divide-y divide-white/60">
              {(recent ?? []).map((a) => (
                <li
                  key={a._id as any}
                  className="py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${a.present ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="text-zinc-900 truncate">{a.memberName}</span>
                  </div>
                  <div className="text-zinc-600">
                    {a.present ? "Present" : "Absent"} • {formatIsoDate(a.date)}
                  </div>
                </li>
              ))}
              {(recent ?? []).length === 0 && (
                <li className="py-4 text-sm text-zinc-600">No activity yet.</li>
              )}
            </ul>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/70">{label}</span>
      <span className="text-xl font-medium">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
      <div className="text-xs text-zinc-600 mb-1">{label}</div>
      <div className="text-2xl font-medium text-zinc-900">{value}</div>
    </div>
  );
}
