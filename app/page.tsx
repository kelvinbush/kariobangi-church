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

  const members = roster ?? [];
  // Separate members from visitors
  const membersOnly = useMemo(() => members.filter((m: any) => m.type !== "visitor"), [members]);
  const visitors = useMemo(() => members.filter((m: any) => m.type === "visitor"), [members]);
  
  const present = useMemo(
    () => membersOnly.filter((m) => m.presentToday).length,
    [membersOnly]
  );
  const presentVisitors = useMemo(
    () => visitors.filter((m) => m.presentToday).length,
    [visitors]
  );
  const totalMembers = membersOnly.length;
  const totalVisitors = visitors.length;
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
              href="/attendance/history"
              className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
            >
              History
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
          {/* Highlights */}
          <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
                  {formatDate(new Date())}
                </span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Members: {totalMembers}</span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Present: {present}</span>
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Visitors: {totalVisitors}</span>
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
                <Stat label="Visitors" value={`${presentVisitors}`} />
              </div>
              <div className="flex-1 max-w-xl">
                <div className="text-sm mb-1">ATTENDANCE RATE</div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${rate}%` }} />
                </div>
                <div className="text-xs mt-1">{rate}%</div>
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
              <SummaryCard label="Total Visitors" value={summaries.totalVisitors} />
            </div>
          )}

          {/* Charts */}
          {trends && trends.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttendanceAreaChart
                data={trends.map((t) => ({ date: t.date, present: t.present }))}
                dataKey="present"
                color="#10b981"
                title="Attendance Trend (Last 7 Days)"
              />
              <MultiAreaChart
                data={trends}
                dataKeys={[
                  { key: "members", color: "#3b82f6", name: "Members" },
                  { key: "kids", color: "#f59e0b", name: "Kids" },
                  { key: "visitors", color: "#8b5cf6", name: "Visitors" },
                ]}
                title="Attendance by Category"
              />
            </div>
          )}

          {summaries && trends && trends.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AttendancePieChart
                data={[
                  { name: "Men", value: summaries.totalMen, color: "#3b82f6" },
                  { name: "Women", value: summaries.totalWomen, color: "#ec4899" },
                  { name: "Kids", value: summaries.totalKids, color: "#f59e0b" },
                  { name: "Youths", value: summaries.totalYouths, color: "#10b981" },
                ]}
                title="Member Demographics"
              />
              <AttendanceBarChart
                data={trends.map((t) => ({ date: t.date, total: t.total }))}
                dataKey="total"
                color="#8b5cf6"
                title="Total Attendance (Last 7 Days)"
              />
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
