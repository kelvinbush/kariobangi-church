"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import {
  Users,
  Phone,
  MapPin,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  PhoneCall,
  UserCheck,
  Calendar,
} from "lucide-react";

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [navOpen, setNavOpen] = useState(false);

  const myCluster = useQuery(api.clusters.myCluster, isAuthenticated ? {} : "skip");
  const pendingCount = useQuery(api.clusterFollowUps.getPendingFollowUpCount, isAuthenticated ? {} : "skip");

  // Get last Sunday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - daysToSubtract);
  const lastSundayIso = lastSunday.toISOString().split("T")[0];

  // Get absent members for last Sunday
  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, date: lastSundayIso }
      : "skip"
  );

  // Get recent logs
  const recentLogs = useQuery(
    api.clusterFollowUps.getLogs,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, limit: 5 }
      : "skip"
  );

  const unloggedAbsences = absentMembers?.filter((m) => !m.hasExistingLog) || [];

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/90 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="text-zinc-900 font-medium tracking-tight text-lg">My Cluster</div>
              <div className="text-xs text-zinc-500 hidden sm:block">
                {myCluster?.name || "Loading..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-zinc-200/80 bg-white px-4 py-3 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
            <Link href="/cluster-head" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Dashboard
            </Link>
            <Link href="/cluster-head/follow-ups" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Follow-ups
            </Link>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700">Please sign in to access your cluster dashboard.</p>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 mb-2">No Cluster Assigned</h3>
                <p className="text-zinc-600">
                  You are not currently assigned as a cluster head. Please contact your cluster admin.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Cluster Overview */}
              <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-medium">{myCluster.name}</h2>
                    <p className="text-white/70 text-sm mt-1">
                      {myCluster.memberCount} members in your cluster
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-full bg-white/10 text-sm">
                      Last Sunday: {formatIsoDate(lastSundayIso)}
                    </span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-2xl font-medium">{myCluster.memberCount}</div>
                    <div className="text-xs text-white/70">Total Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-medium">{absentMembers?.length || 0}</div>
                    <div className="text-xs text-white/70">Absent Last Sunday</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-medium text-amber-400">{unloggedAbsences.length}</div>
                    <div className="text-xs text-white/70">Need Follow-up</div>
                  </div>
                </div>
              </div>

              {/* Pending Follow-ups Alert */}
              {unloggedAbsences.length > 0 && (
                <div className="rounded-2xl p-4 bg-amber-400/90 text-zinc-900">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-6 h-6" />
                      <div>
                        <div className="font-medium">
                          {unloggedAbsences.length} member{unloggedAbsences.length > 1 ? "s" : ""} absent on {formatIsoDate(lastSundayIso)}
                        </div>
                        <div className="text-sm text-zinc-700">
                          Please follow up and log the reason for their absence
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/cluster-head/follow-ups"
                      className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm text-center hover:bg-zinc-800"
                    >
                      Log Follow-ups
                    </Link>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                <h3 className="font-medium text-zinc-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/cluster-head/follow-ups"
                    className="flex items-center gap-3 p-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900">Log Follow-ups</div>
                      <div className="text-sm text-zinc-600">Record absence reasons</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 ml-auto" />
                  </Link>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-100">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900">View Members</div>
                      <div className="text-sm text-zinc-600">{myCluster.memberCount} members</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-zinc-900">Cluster Members</h3>
                  <span className="text-sm text-zinc-600">{myCluster.members.length} total</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myCluster.members.slice(0, 6).map((member) => (
                    <div
                      key={member._id}
                      className="p-3 rounded-xl bg-white border border-zinc-100 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-zinc-900 truncate">{member.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          {member.contact && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {member.contact}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {myCluster.members.length > 6 && (
                  <p className="text-center text-sm text-zinc-600 mt-4">
                    +{myCluster.members.length - 6} more members
                  </p>
                )}
              </div>

              {/* Recent Activity */}
              {recentLogs && recentLogs.length > 0 && (
                <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-zinc-900">Recent Follow-ups</h3>
                    <Link
                      href="/cluster-head/follow-ups"
                      className="text-sm text-zinc-600 hover:text-zinc-900"
                    >
                      View All →
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <div
                        key={log._id}
                        className="p-3 rounded-xl bg-white border border-zinc-100 flex items-center gap-3"
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          log.status === "contacted" ? "bg-emerald-500" :
                          log.status === "not_reachable" ? "bg-rose-500" :
                          log.status === "excused" ? "bg-blue-500" :
                          "bg-amber-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900">{log.memberName}</span>
                            <span className="text-xs text-zinc-500">{formatIsoDate(log.date)}</span>
                          </div>
                          <p className="text-sm text-zinc-600 truncate">{log.comment}</p>
                        </div>
                        {log.requestType !== "none" && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.requestType === "bishop_attention"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {log.requestType === "bishop_attention" ? "Bishop" : "Removal"}
                          </span>
                        )}
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
