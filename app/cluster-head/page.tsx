"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getLastSunday, formatIsoDate } from "@/lib/date";

// Demo data for testing
const DEMO_CLUSTER = {
  _id: "demo-cluster" as Id<"clusters">,
  name: "Demo Cluster (Testing)",
  members: [
    { _id: "demo-1" as Id<"members">, name: "John Kamau", contact: "+254712345678", gender: "Male", residence: "Nairobi, Karen" },
    { _id: "demo-2" as Id<"members">, name: "Mary Wanjiku", contact: "+254723456789", gender: "Female", residence: "Nairobi, Langata" },
    { _id: "demo-3" as Id<"members">, name: "Peter Omondi", contact: "+254734567890", gender: "Male", residence: "Nairobi, Westlands" },
    { _id: "demo-4" as Id<"members">, name: "Grace Achieng", contact: "+254745678901", gender: "Female", residence: "Nairobi, Eastleigh" },
    { _id: "demo-5" as Id<"members">, name: "James Mwangi", contact: null, gender: "Male", residence: "Nairobi, Kileleshwa" },
  ] as Member[],
};

const DEMO_LOGS: FollowUpLog[] = [
  { _id: "log-1" as Id<"clusterFollowUpLogs">, memberId: "demo-1" as Id<"members">, memberName: "John Kamau", date: "2026-03-02", status: "contacted", comment: "Called and confirmed he was sick" },
  { _id: "log-2" as Id<"clusterFollowUpLogs">, memberId: "demo-2" as Id<"members">, memberName: "Mary Wanjiku", date: "2026-03-02", status: "not_reachable", comment: "Phone was off" },
  { _id: "log-3" as Id<"clusterFollowUpLogs">, memberId: "demo-1" as Id<"members">, memberName: "John Kamau", date: "2026-02-23", status: "contacted", comment: "Was traveling upcountry" },
  { _id: "log-4" as Id<"clusterFollowUpLogs">, memberId: "demo-4" as Id<"members">, memberName: "Grace Achieng", date: "2026-02-23", status: "needs_attention", comment: "Has been absent for 3 weeks, needs pastoral visit" },
  { _id: "log-5" as Id<"clusterFollowUpLogs">, memberId: "demo-3" as Id<"members">, memberName: "Peter Omondi", date: "2026-02-16", status: "contacted", comment: "Excused - work commitment" },
];

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
    sageLight: '#d4e4c8',
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

interface Member {
  _id: Id<"members">;
  name: string;
  contact: string | null;
  gender: string | null;
  residence: string | null;
}

interface FollowUpLog {
  _id: Id<"clusterFollowUpLogs">;
  memberId: Id<"members">;
  memberName: string;
  date: string;
  status: string;
  comment: string;
}

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState<'present' | 'absent'>('present');
  const [isMarking, setIsMarking] = useState(false);
  const [useDemoMode, setUseDemoMode] = useState(false);

  const myCluster = useQuery(api.clusters.myCluster, isAuthenticated ? {} : "skip");
  const myLogs = useQuery(
    api.clusterFollowUps.getLogs,
    isAuthenticated && myCluster?._id ? { clusterId: myCluster._id, limit: 50 } : "skip"
  );

  // Use demo data when no cluster is assigned and demo mode is enabled
  const cluster = myCluster || (useDemoMode ? DEMO_CLUSTER : null);
  const logs = myLogs || (useDemoMode ? DEMO_LOGS : undefined);

  const lastSunday = getLastSunday();
  const markPresent = useMutation(api.attendance.markPresent);
  const markAbsent = useMutation(api.attendance.unmarkPresent);
  
  const attendanceStatus = useQuery(
    api.attendance.getMemberStatus,
    selectedMember && !selectedMember._id.toString().startsWith('demo-') 
      ? { memberId: selectedMember._id, date: lastSunday } 
      : "skip"
  );

  const handleMarkAttendance = async () => {
    if (!selectedMember) return;
    // Don't try to mark attendance for demo members
    if (selectedMember._id.toString().startsWith('demo-')) {
      alert("This is demo data - attendance marking is disabled for demo members");
      setShowMarkAttendance(false);
      return;
    }
    setIsMarking(true);
    try {
      if (attendanceAction === 'present') {
        await markPresent({ memberId: selectedMember._id, date: lastSunday });
      } else {
        await markAbsent({ memberId: selectedMember._id, date: lastSunday });
      }
      setShowMarkAttendance(false);
      setSelectedMember(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark attendance");
    } finally {
      setIsMarking(false);
    }
  };

  const openAttendanceModal = () => {
    const currentIsPresent = attendanceStatus?.present ?? false;
    setAttendanceAction(currentIsPresent ? 'absent' : 'present');
    setShowMarkAttendance(true);
  };

  // Group logs by date
  const logsByDate = logs?.reduce((acc: Record<string, FollowUpLog[]>, log: FollowUpLog) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});

  const memberCount = cluster?.members?.length || 0;
  const isDemoMode = useDemoMode || (!myCluster && cluster !== null);

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
            {cluster?.name || "My Cluster"}
            {isDemoMode && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.amber }}>
                Demo
              </span>
            )}
          </span>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {!cluster ? (
            <div className="text-center py-20">
              <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
                You are not assigned to a cluster
              </p>
              <button
                onClick={() => setUseDemoMode(true)}
                className="text-sm px-4 py-2 rounded-full"
                style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.amber }}
              >
                Try Demo Mode
              </button>
            </div>
          ) : (
            <>
              {/* Demo Mode Banner */}
              {isDemoMode && (
                <div 
                  className="p-4 rounded-xl mb-6 flex items-center justify-between"
                  style={{ backgroundColor: colors.accent.amberLight }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.accent.amber }}>
                      Demo Mode
                    </p>
                    <p className="text-xs" style={{ color: colors.text.secondary }}>
                      This is sample data for testing
                    </p>
                  </div>
                  <button
                    onClick={() => setUseDemoMode(false)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: colors.bg, color: colors.text.secondary }}
                  >
                    Exit Demo
                  </button>
                </div>
              )}
              {/* Quick Actions */}
              <div className="space-y-3 mb-8">
                <Link
                  href="/cluster-head/follow-ups"
                  className="flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ backgroundColor: colors.accent.amberLight }}
                >
                  <div>
                    <span 
                      className="text-sm block"
                      style={{ color: colors.text.primary }}
                    >
                      Submit Follow-ups
                    </span>
                    <span 
                      className="text-xs mt-0.5 block"
                      style={{ color: colors.text.secondary }}
                    >
                      {formatIsoDate(lastSunday)}
                    </span>
                  </div>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={colors.text.muted} 
                    strokeWidth="1.5"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div>
                    <span 
                      className="text-sm block"
                      style={{ color: colors.text.primary }}
                    >
                      Previous Reports
                    </span>
                    <span 
                      className="text-xs mt-0.5 block"
                      style={{ color: colors.text.muted }}
                    >
                      {logs?.length || 0} entries
                    </span>
                  </div>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={colors.text.muted} 
                    strokeWidth="1.5"
                    style={{ transform: showLogs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Previous Logs */}
              {showLogs && (
                <div className="mb-8 space-y-4">
                  {logsByDate && Object.keys(logsByDate).length > 0 ? (
                    Object.entries(logsByDate)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .map(([date, logs]) => (
                        <div key={date}>
                          <h3 
                            className="text-xs uppercase tracking-wide mb-2 px-1"
                            style={{ color: colors.text.muted }}
                          >
                            {formatIsoDate(date)}
                          </h3>
                          <div className="space-y-2">
                            {(logs as FollowUpLog[]).map((log) => (
                              <div 
                                key={log._id}
                                className="p-3 rounded-xl"
                                style={{ backgroundColor: colors.surface }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p 
                                      className="text-sm"
                                      style={{ color: colors.text.primary }}
                                    >
                                      {log.memberName}
                                    </p>
                                    {log.comment && (
                                      <p 
                                        className="text-xs mt-1"
                                        style={{ color: colors.text.secondary }}
                                      >
                                        {log.comment}
                                      </p>
                                    )}
                                  </div>
                                  <span 
                                    className="px-2 py-1 rounded-lg text-xs flex-shrink-0"
                                    style={{ 
                                      backgroundColor: 
                                        log.status === 'contacted' ? colors.accent.sageLight :
                                        log.status === 'needs_attention' ? colors.accent.terracottaLight :
                                        colors.surfaceHover,
                                      color: 
                                        log.status === 'contacted' ? colors.accent.sage :
                                        log.status === 'needs_attention' ? colors.accent.terracotta :
                                        colors.text.secondary
                                    }}
                                  >
                                    {log.status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div 
                      className="text-center py-8 text-sm"
                      style={{ color: colors.text.muted }}
                    >
                      No reports yet
                    </div>
                  )}
                </div>
              )}

              {/* Member Count */}
              <div 
                className="rounded-2xl p-6 mb-8"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="text-4xl font-light"
                    style={{ color: colors.text.primary }}
                  >
                    {memberCount}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    Members in<br/>your cluster
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div>
                <span 
                  className="text-sm block mb-4"
                  style={{ color: colors.text.secondary }}
                >
                  Members
                </span>
                
                <div className="space-y-2">
                  {cluster.members && cluster.members.length > 0 ? (
                    cluster.members.map((member: Member) => (
                      <button
                        key={member._id}
                        onClick={() => setSelectedMember(member)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                        style={{ backgroundColor: colors.surface }}
                      >
                        {/* Avatar with initials */}
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ 
                            backgroundColor: colors.surfaceHover,
                            color: colors.text.secondary
                          }}
                        >
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Name and contact */}
                        <div className="flex-1 min-w-0">
                          <h3 
                            className="text-sm truncate"
                            style={{ color: colors.text.primary }}
                          >
                            {member.name}
                          </h3>
                          {member.contact ? (
                            <a 
                              href={`tel:${member.contact}`}
                              className="text-xs truncate block mt-0.5"
                              style={{ color: colors.accent.amber }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {member.contact}
                            </a>
                          ) : (
                            <span 
                              className="text-xs mt-0.5 block"
                              style={{ color: colors.text.muted }}
                            >
                              No contact
                            </span>
                          )}
                        </div>

                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke={colors.text.muted} 
                          strokeWidth="1.5"
                        >
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))
                  ) : (
                    <div 
                      className="text-center py-12 text-sm"
                      style={{ color: colors.text.muted }}
                    >
                      No members in cluster
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkAttendance && selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(61, 58, 54, 0.5)' }}
          onClick={() => setShowMarkAttendance(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h3 style={{ color: colors.text.primary }}>
                Mark {selectedMember.name}
              </h3>
              <p 
                className="text-xs mt-1"
                style={{ color: colors.text.muted }}
              >
                {attendanceAction === 'present' ? 'Present' : 'Absent'} for {formatIsoDate(lastSunday)}
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowMarkAttendance(false)}
                className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
                style={{ 
                  backgroundColor: colors.surfaceHover,
                  color: colors.text.secondary
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAttendance}
                disabled={isMarking}
                className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50 transition-colors"
                style={{ 
                  backgroundColor: attendanceAction === 'present' 
                    ? colors.accent.sage 
                    : colors.accent.terracotta,
                  color: colors.bg
                }}
              >
                {isMarking ? 'Saving...' : `Mark ${attendanceAction === 'present' ? 'Present' : 'Absent'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(61, 58, 54, 0.5)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-base"
                style={{ 
                  backgroundColor: colors.surfaceHover,
                  color: colors.text.secondary
                }}
              >
                {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-base truncate"
                  style={{ color: colors.text.primary }}
                >
                  {selectedMember.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                style={{ color: colors.text.secondary }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Attendance Action */}
              {attendanceStatus !== undefined && (
                <div>
                  <label 
                    className="text-xs mb-2 block"
                    style={{ color: colors.text.muted }}
                  >
                    Status: {attendanceStatus?.present ? 'Present' : 'Absent'}
                  </label>
                  <button
                    onClick={openAttendanceModal}
                    className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                    style={{ 
                      backgroundColor: attendanceStatus?.present 
                        ? colors.accent.terracottaLight 
                        : colors.accent.sageLight,
                      color: attendanceStatus?.present 
                        ? colors.accent.terracotta 
                        : colors.accent.sage
                    }}
                  >
                    {attendanceStatus?.present ? 'Mark as Absent' : 'Mark as Present'}
                  </button>
                </div>
              )}

              <div 
                className="h-px"
                style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
              />

              {selectedMember.contact && (
                <div>
                  <label 
                    className="text-xs mb-1 block"
                    style={{ color: colors.text.muted }}
                  >
                    Contact
                  </label>
                  <a 
                    href={`tel:${selectedMember.contact}`}
                    className="text-sm flex items-center gap-2"
                    style={{ color: colors.accent.amber }}
                  >
                    {selectedMember.contact}
                  </a>
                </div>
              )}
              
              {selectedMember.residence && (
                <div>
                  <label 
                    className="text-xs mb-1 block"
                    style={{ color: colors.text.muted }}
                  >
                    Residence
                  </label>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {selectedMember.residence}
                  </p>
                </div>
              )}
              
              {selectedMember.gender && (
                <div>
                  <label 
                    className="text-xs mb-1 block"
                    style={{ color: colors.text.muted }}
                  >
                    Gender
                  </label>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {selectedMember.gender}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
