"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ArrowRight, AlertCircle, Users, Calendar, ChevronRight, Phone, Clock, History } from "lucide-react";

// Color Palette - Same as admin
const colors: any = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  accent: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
  },
  success: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  bg: {
    main: '#fafaf9',
    card: '#ffffff',
    subtle: '#f5f5f4',
    hover: '#e7e5e4',
  },
  text: {
    primary: '#1c1917',
    secondary: '#57534e',
    muted: '#78716c',
    inverse: '#fafaf9',
  },
  border: {
    light: '#e7e5e4',
    medium: '#d6d3d1',
  },
};

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');

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
      ? { clusterId: myCluster._id, limit: 10 }
      : "skip"
  );

  const unloggedCount = absentMembers?.filter((m) => !m.hasExistingLog).length || 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.bg.card, borderBottom: `1px solid ${colors.border.light}` }}>
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: colors.primary[100] }}
            >
              <Users className="w-5 h-5" style={{ color: colors.primary[600] }} />
            </div>
            <div>
              <span className="text-base tracking-tight" style={{ color: colors.text.primary }}>
                My Cluster
              </span>
              <p className="text-xs" style={{ color: colors.text.muted }}>
                {myCluster?.name || "Loading..."}
              </p>
            </div>
          </div>
          <SignedIn>
            <div className="text-right">
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: colors.primary[100], color: colors.primary[700] }}>
                Head
              </span>
            </div>
          </SignedIn>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-16 text-center">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: colors.primary[100] }}
            >
              <Users className="w-8 h-8" style={{ color: colors.primary[600] }} />
            </div>
            <p className="text-base mb-8" style={{ color: colors.text.secondary }}>
              Sign in to access your cluster
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-8 py-3 text-base rounded-xl"
                style={{ backgroundColor: colors.primary[600], color: colors.text.inverse }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="mt-16 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: colors.warning[500] }} />
              <p className="text-lg tracking-tight mb-2" style={{ color: colors.text.primary }}>
                No cluster assigned
              </p>
              <p className="text-base" style={{ color: colors.text.secondary }}>
                Contact your administrator
              </p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className="flex-1 py-3 text-base rounded-xl transition-colors"
                  style={{ 
                    backgroundColor: activeTab === 'overview' ? colors.primary[600] : colors.bg.card,
                    color: activeTab === 'overview' ? colors.text.inverse : colors.text.secondary,
                    border: `1px solid ${activeTab === 'overview' ? colors.primary[600] : colors.border.light}`,
                  }}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className="flex-1 py-3 text-base rounded-xl transition-colors"
                  style={{ 
                    backgroundColor: activeTab === 'members' ? colors.primary[600] : colors.bg.card,
                    color: activeTab === 'members' ? colors.text.inverse : colors.text.secondary,
                    border: `1px solid ${activeTab === 'members' ? colors.primary[600] : colors.border.light}`,
                  }}
                >
                  Members ({myCluster.memberCount})
                </button>
              </div>

              {activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Sunday Reporting Card */}
                  <div 
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: colors.primary[100] }}
                      >
                        <Calendar className="w-7 h-7" style={{ color: colors.primary[600] }} />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.text.muted }}>
                          Last Sunday
                        </p>
                        <p className="text-xl tracking-tight" style={{ color: colors.text.primary }}>
                          {formatIsoDate(lastSundayIso)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div 
                        className="rounded-xl p-4"
                        style={{ backgroundColor: colors.bg.subtle }}
                      >
                        <p className="text-3xl tracking-tight mb-1" style={{ color: colors.text.primary }}>
                          {absentMembers?.length || 0}
                        </p>
                        <p className="text-sm" style={{ color: colors.text.muted }}>Absent</p>
                      </div>
                      <div 
                        className="rounded-xl p-4"
                        style={{ 
                          backgroundColor: unloggedCount > 0 ? colors.accent[50] : colors.success[50],
                        }}
                      >
                        <p 
                          className="text-3xl tracking-tight mb-1"
                          style={{ color: unloggedCount > 0 ? colors.accent[600] : colors.success[600] }}
                        >
                          {unloggedCount}
                        </p>
                        <p className="text-sm" style={{ color: colors.text.muted }}>Need Follow-up</p>
                      </div>
                    </div>

                    {unloggedCount > 0 ? (
                      <Link
                        href="/cluster-head/follow-ups"
                        className="flex items-center justify-center gap-2 w-full py-4 text-base rounded-xl transition-colors"
                        style={{ backgroundColor: colors.primary[600], color: colors.text.inverse }}
                      >
                        Report Follow-ups
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    ) : (
                      <div 
                        className="flex items-center justify-center gap-2 w-full py-4 text-base rounded-xl"
                        style={{ backgroundColor: colors.success[100], color: colors.success[600] }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.success[500] }} />
                        All caught up
                      </div>
                    )}
                  </div>

                  {/* Recent Reports */}
                  {recentLogs && recentLogs.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                          Recent Reports
                        </h2>
                        <Link 
                          href="/cluster-head/follow-ups"
                          className="flex items-center gap-1 text-sm"
                          style={{ color: colors.primary[600] }}
                        >
                          View all
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                      <div 
                        className="rounded-2xl overflow-hidden"
                        style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
                      >
                        {recentLogs.slice(0, 5).map((log, index) => (
                          <div 
                            key={log._id}
                            className="px-5 py-4 border-b last:border-0 flex items-start gap-3"
                            style={{ 
                              borderColor: colors.border.light,
                              backgroundColor: index % 2 === 0 ? colors.bg.card : colors.bg.subtle,
                            }}
                          >
                            <div 
                              className="w-2 h-2 rounded-full mt-2"
                              style={{ 
                                backgroundColor: 
                                  log.status === "contacted" ? colors.success[500] :
                                  log.status === "not_reachable" ? colors.accent[500] :
                                  log.status === "excused" ? colors.primary[500] :
                                  colors.warning[500]
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base" style={{ color: colors.text.primary }}>
                                  {log.memberName}
                                </span>
                                <span className="text-xs" style={{ color: colors.text.muted }}>
                                  {formatIsoDate(log.date)}
                                </span>
                              </div>
                              <p className="text-sm line-clamp-1" style={{ color: colors.text.secondary }}>
                                {log.comment}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ClusterMembersList cluster={myCluster} />
              )}
            </>
          )}
        </SignedIn>
      </main>
    </div>
  );
}

function ClusterMembersList({ cluster }: { cluster: any }) {
  const [selectedMember, setSelectedMember] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
      >
        {cluster.members.map((member: any, index: number) => (
          <button
            key={member._id}
            onClick={() => setSelectedMember(member)}
            className="w-full px-5 py-4 border-b last:border-0 flex items-center gap-4 text-left transition-colors"
            style={{ 
              borderColor: colors.border.light,
              backgroundColor: index % 2 === 0 ? colors.bg.card : colors.bg.subtle,
            }}
          >
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
              style={{ backgroundColor: colors.primary[100], color: colors.primary[700] }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-base mb-0.5" style={{ color: colors.text.primary }}>{member.name}</p>
              {member.contact && (
                <p className="text-sm flex items-center gap-1" style={{ color: colors.text.muted }}>
                  <Phone className="w-3 h-3" />
                  {member.contact}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: colors.text.muted }} />
          </button>
        ))}
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal 
          member={selectedMember} 
          clusterId={cluster._id}
          onClose={() => setSelectedMember(null)} 
        />
      )}
    </div>
  );
}

function MemberDetailModal({ member, clusterId, onClose }: { member: any; clusterId: string; onClose: () => void }) {
  const logs = useQuery(
    api.clusterFollowUps.getMemberLogs,
    { memberId: member._id, limit: 10 }
  );

  const attendance = useQuery(
    api.attendance.historyForMember,
    { memberId: member._id }
  );

  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'attendance'>('info');

  // Calculate attendance stats
  const attendanceStats = attendance ? {
    total: attendance.length,
    present: attendance.filter((a: any) => a.present).length,
    rate: attendance.length > 0 ? Math.round((attendance.filter((a: any) => a.present).length / attendance.length) * 100) : 0,
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between" style={{ borderColor: colors.border.light }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
              style={{ backgroundColor: colors.primary[100], color: colors.primary[700] }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg tracking-tight" style={{ color: colors.text.primary }}>{member.name}</p>
              {member.contact && (
                <a 
                  href={`tel:${member.contact}`}
                  className="text-sm flex items-center gap-1"
                  style={{ color: colors.primary[600] }}
                >
                  <Phone className="w-3 h-3" />
                  {member.contact}
                </a>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-colors"
            style={{ backgroundColor: colors.bg.subtle }}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-3 border-b" style={{ borderColor: colors.border.light, backgroundColor: colors.bg.subtle }}>
          {(['info', 'history', 'attendance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-sm rounded-lg capitalize transition-colors"
              style={{ 
                backgroundColor: activeTab === tab ? colors.bg.card : 'transparent',
                color: activeTab === tab ? colors.text.primary : colors.text.muted,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {attendanceStats && (
                  <>
                    <div 
                      className="rounded-2xl p-4 text-center"
                      style={{ backgroundColor: colors.bg.subtle }}
                    >
                      <p className="text-3xl tracking-tight mb-1" style={{ color: colors.text.primary }}>
                        {attendanceStats.rate}%
                      </p>
                      <p className="text-sm" style={{ color: colors.text.muted }}>Attendance Rate</p>
                    </div>
                    <div 
                      className="rounded-2xl p-4 text-center"
                      style={{ backgroundColor: colors.bg.subtle }}
                    >
                      <p className="text-3xl tracking-tight mb-1" style={{ color: colors.text.primary }}>
                        {logs?.length || 0}
                      </p>
                      <p className="text-sm" style={{ color: colors.text.muted }}>Follow-ups</p>
                    </div>
                  </>
                )}
              </div>

              {member.contact && (
                <a
                  href={`tel:${member.contact}`}
                  className="flex items-center justify-center gap-2 w-full py-4 text-base rounded-xl"
                  style={{ backgroundColor: colors.success[500], color: colors.text.inverse }}
                >
                  <Phone className="w-5 h-5" />
                  Call {member.name}
                </a>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {logs && logs.length > 0 ? (
                logs.map((log: any) => (
                  <div 
                    key={log._id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: colors.bg.subtle }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: 
                            log.status === "contacted" ? colors.success[500] :
                            log.status === "not_reachable" ? colors.accent[500] :
                            log.status === "excused" ? colors.primary[500] :
                            colors.warning[500]
                        }}
                      />
                      <span className="text-sm" style={{ color: colors.text.muted }}>
                        {formatIsoDate(log.date)}
                      </span>
                    </div>
                    <p className="text-sm mb-1" style={{ color: colors.text.primary }}>
                      {log.comment}
                    </p>
                    {log.absenceReason && (
                      <p className="text-xs" style={{ color: colors.text.muted }}>
                        Reason: {log.absenceReason}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
                  <p style={{ color: colors.text.secondary }}>No follow-up history</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-3">
              {attendance && attendance.length > 0 ? (
                attendance.slice(0, 20).map((record: any) => (
                  <div 
                    key={record._id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                    style={{ borderColor: colors.border.light }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: record.present ? colors.success[500] : colors.accent[500]
                        }}
                      />
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {formatIsoDate(record.date)}
                      </span>
                    </div>
                    <span 
                      className="text-sm"
                      style={{ 
                        color: record.present ? colors.success[600] : colors.accent[600]
                      }}
                    >
                      {record.present ? 'Present' : 'Absent'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
                  <p style={{ color: colors.text.secondary }}>No attendance records</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
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
