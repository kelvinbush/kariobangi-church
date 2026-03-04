"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ArrowRight, AlertCircle, Users, Calendar, ChevronRight } from "lucide-react";

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();

  const myCluster = useQuery(api.clusters.myCluster, isAuthenticated ? {} : "skip");
  
  // Get previous Sunday
  const lastSunday = getPreviousSunday(new Date());
  const lastSundayIso = toISODate(lastSunday);
  
  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, date: lastSundayIso }
      : "skip"
  );

  const recentLogs = useQuery(
    api.clusterFollowUps.getLogs,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, limit: 5 }
      : "skip"
  );

  const unloggedCount = absentMembers?.filter((m) => !m.hasExistingLog).length || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-slate-900">My Cluster</span>
          <SignedIn>
            <span className="text-sm text-slate-500">{myCluster?.name}</span>
          </SignedIn>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-sm text-slate-600">Sign in to access your cluster</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="mt-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No cluster assigned</p>
              <p className="text-sm text-slate-500 mt-1">Contact your administrator</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sunday Reporting Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Last Sunday</p>
                    <p className="text-sm text-slate-500">{formatIsoDate(lastSundayIso)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-2xl font-semibold text-slate-900">
                      {absentMembers?.length || 0}
                    </p>
                    <p className="text-xs text-slate-500">Absent Members</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-2xl font-semibold text-slate-900">
                      {unloggedCount}
                    </p>
                    <p className="text-xs text-slate-500">Need Follow-up</p>
                  </div>
                </div>

                {unloggedCount > 0 ? (
                  <Link
                    href="/cluster-head/follow-ups"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
                  >
                    Report Follow-ups
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
                    All caught up
                  </div>
                )}
              </div>

              {/* Members Quick View */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-900">Members</span>
                  </div>
                  <span className="text-sm text-slate-500">{myCluster.memberCount} total</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {myCluster.members.slice(0, 5).map((member) => (
                    <div key={member._id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                        {member.contact && (
                          <p className="text-xs text-slate-500">{member.contact}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {myCluster.members.length > 5 && (
                  <div className="px-4 py-2 text-center text-sm text-slate-500">
                    +{myCluster.members.length - 5} more members
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              {recentLogs && recentLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <span className="font-medium text-slate-900">Recent Reports</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {recentLogs.slice(0, 3).map((log) => (
                      <div key={log._id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${
                            log.status === "contacted" ? "bg-emerald-500" :
                            log.status === "not_reachable" ? "bg-rose-500" :
                            log.status === "excused" ? "bg-blue-500" :
                            "bg-amber-500"
                          }`} />
                          <span className="text-sm font-medium text-slate-900">{log.memberName}</span>
                          <span className="text-xs text-slate-500 ml-auto">{formatIsoDate(log.date)}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">{log.comment}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/cluster-head/follow-ups"
                    className="flex items-center justify-center gap-1 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 border-t border-slate-100"
                  >
                    View all reports
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  );
}

function getPreviousSunday(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 7 : dayOfWeek;
  d.setDate(d.getDate() - daysToSubtract);
  d.setHours(0, 0, 0, 0);
  return d;
}
