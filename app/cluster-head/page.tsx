"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getLastSunday, formatIsoDate } from "@/lib/date";

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
  loggedAt: number;
}

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState<'present' | 'absent'>('present');
  const [isMarking, setIsMarking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const myCluster = useQuery(
    api.clusters.myCluster,
    isAuthenticated ? {} : "skip"
  );

  const myLogs = useQuery(
    api.clusterFollowUps.getLogs,
    isAuthenticated && myCluster?._id ? { clusterId: myCluster._id, limit: 50 } : "skip"
  );

  const lastSunday = getLastSunday();
  
  const markPresent = useMutation(api.attendance.markPresent);
  const markAbsent = useMutation(api.attendance.unmarkPresent);

  // Get attendance status for selected member on last Sunday
  const attendanceStatus = useQuery(
    api.attendance.getMemberStatus,
    selectedMember ? { memberId: selectedMember._id, date: lastSunday } : "skip"
  );

  const memberCount = myCluster?.members?.length || 0;

  const handleMarkAttendance = async () => {
    if (!selectedMember) return;
    setIsMarking(true);
    try {
      if (attendanceAction === 'present') {
        await markPresent({ memberId: selectedMember._id, date: lastSunday });
      } else {
        await markAbsent({ memberId: selectedMember._id, date: lastSunday });
      }
      setShowMarkAttendance(false);
      setSelectedMember(null);
      setSuccessMessage(`${selectedMember.name} marked ${attendanceAction === 'present' ? 'present' : 'absent'}`);
      setTimeout(() => setSuccessMessage(null), 3000);
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
  const logsByDate = myLogs?.reduce((acc: Record<string, FollowUpLog[]>, log: FollowUpLog) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});

  return (
    <AuthenticatedLayout>
      {/* Simple Header */}
      <header className="sticky top-0 z-30 border-b bg-white px-4 h-14 flex items-center justify-between">
        <h1 className="text-base font-medium text-zinc-900">
          {myCluster?.name || "My Cluster"}
        </h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 bg-emerald-100 text-emerald-800">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-4">
        {!myCluster ? (
          <div className="text-center py-20">
            <p className="text-sm text-zinc-500">
              You are not assigned to a cluster
            </p>
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="space-y-3 mb-6">
              <Link
                href="/cluster-head/follow-ups"
                className="block p-4 rounded-xl border border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c6f5a" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm text-zinc-900">Submit Follow-ups</h2>
                      <p className="text-xs mt-0.5 text-zinc-500">{formatIsoDate(lastSunday)}</p>
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9a9997" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full p-4 rounded-xl border border-zinc-200 bg-white text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" strokeWidth="2">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm text-zinc-900">My Previous Reports</h2>
                      <p className="text-xs mt-0.5 text-zinc-500">{myLogs?.length || 0} logs</p>
                    </div>
                  </div>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#9a9997" 
                    strokeWidth="2"
                    style={{ transform: showLogs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Previous Logs Section */}
            {showLogs && (
              <div className="mb-6 space-y-4">
                {logsByDate && Object.keys(logsByDate).length > 0 ? (
                  Object.entries(logsByDate)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .map(([date, logs]) => (
                      <div key={date}>
                        <h3 className="text-xs uppercase tracking-wide mb-2 px-1 text-zinc-500">
                          {formatIsoDate(date)}
                        </h3>
                        <div className="space-y-2">
                          {(logs as FollowUpLog[]).map((log) => (
                            <div 
                              key={log._id}
                              className="p-3 rounded-xl border border-zinc-200 bg-white"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-900">{log.memberName}</p>
                                  {log.comment && (
                                    <p className="text-xs mt-1 text-zinc-500">{log.comment}</p>
                                  )}
                                </div>
                                <span 
                                  className={`px-2 py-1 rounded-lg text-xs flex-shrink-0 ${
                                    log.status === 'contacted' ? 'bg-emerald-100 text-emerald-700' :
                                    log.status === 'needs_attention' ? 'bg-rose-100 text-rose-700' :
                                    log.status === 'not_reachable' ? 'bg-amber-100 text-amber-700' :
                                    'bg-zinc-100 text-zinc-600'
                                  }`}
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
                  <div className="text-center py-8">
                    <p className="text-sm text-zinc-500">No reports yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" strokeWidth="2">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl text-zinc-900">{memberCount}</p>
                  <p className="text-xs text-zinc-500">Total Members</p>
                </div>
              </div>
            </div>

            {/* Members Header */}
            <h2 className="text-xs uppercase tracking-wide mb-3 px-1 text-zinc-500">Members</h2>

            {/* Member Cards */}
            <div className="space-y-2">
              {myCluster.members && myCluster.members.length > 0 ? (
                myCluster.members.map((member: Member) => (
                  <button
                    key={member._id}
                    onClick={() => setSelectedMember(member)}
                    className="w-full p-3 rounded-xl border border-zinc-200 bg-white text-left hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar with initials */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-zinc-100 text-zinc-600">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      
                      {/* Name and contact */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm truncate text-zinc-900">{member.name}</h3>
                        {member.contact ? (
                          <a 
                            href={`tel:${member.contact}`}
                            className="text-xs truncate block mt-0.5 text-amber-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {member.contact}
                          </a>
                        ) : (
                          <span className="text-xs mt-0.5 block text-zinc-400">No contact</span>
                        )}
                      </div>

                      {/* Arrow */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9997" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-zinc-500">No members in cluster</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Mark Attendance Modal */}
      {showMarkAttendance && selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowMarkAttendance(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-200">
              <h3 className="text-base text-zinc-900">
                Mark {selectedMember.name} {attendanceAction === 'present' ? 'Present' : 'Absent'}?
              </h3>
              <p className="text-xs mt-1 text-zinc-500">For {formatIsoDate(lastSunday)}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMarkAttendance(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkAttendance}
                  disabled={isMarking}
                  className={`flex-1 py-2.5 text-sm rounded-xl text-white disabled:opacity-50 ${
                    attendanceAction === 'present' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isMarking ? 'Saving...' : `Mark ${attendanceAction === 'present' ? 'Present' : 'Absent'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-zinc-200">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base bg-zinc-100 text-zinc-600">
                {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base truncate text-zinc-900">{selectedMember.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 text-zinc-500 hover:text-zinc-700"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick Attendance Action */}
              {attendanceStatus !== undefined && (
                <div>
                  <label className="text-xs mb-2 block text-zinc-500">
                    Current Status: {attendanceStatus?.present ? 'Present' : 'Absent'}
                  </label>
                  <button
                    onClick={openAttendanceModal}
                    className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                      attendanceStatus?.present 
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {attendanceStatus?.present ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Mark as Absent
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        Mark as Present
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="border-t border-zinc-200" />

              {selectedMember.contact && (
                <div>
                  <label className="text-xs mb-1 block text-zinc-500">Contact</label>
                  <a 
                    href={`tel:${selectedMember.contact}`}
                    className="flex items-center gap-2 text-sm text-amber-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {selectedMember.contact}
                  </a>
                </div>
              )}
              
              {selectedMember.residence && (
                <div>
                  <label className="text-xs mb-1 block text-zinc-500">Residence</label>
                  <p className="text-sm text-zinc-900">{selectedMember.residence}</p>
                </div>
              )}
              
              {selectedMember.gender && (
                <div>
                  <label className="text-xs mb-1 block text-zinc-500">Gender</label>
                  <p className="text-sm text-zinc-900">{selectedMember.gender}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
