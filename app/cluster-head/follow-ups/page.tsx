"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useUser, SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { getLastSunday, getPreviousSundays, formatIsoDate } from "@/lib/date";

// Subtle dot pattern (matching cluster-head page)
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
  ],
};

// Demo absent members (subset of cluster members)
const getDemoAbsentMembers = (date: string) => [
  { memberId: "demo-2" as Id<"members">, memberName: "Mary Wanjiku", memberContact: "+254723456789", memberResidence: "Nairobi, Langata", hasExistingLog: false },
  { memberId: "demo-3" as Id<"members">, memberName: "Peter Omondi", memberContact: "+254734567890", memberResidence: "Nairobi, Westlands", hasExistingLog: false },
  { memberId: "demo-5" as Id<"members">, memberName: "James Mwangi", memberContact: null, memberResidence: "Nairobi, Kileleshwa", hasExistingLog: false },
];

type DemoLog = {
  _id: string;
  clusterId: Id<"clusters">;
  memberId: Id<"members">;
  memberName: string;
  date: string;
  status: string;
  comment: string;
};

// Warm Color Palette (matching cluster-head page)
const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  border: '#e8e4de',
  borderLight: '#f2efe9',
  
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

// Status colors using the accent palette
const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", color: colors.accent.sage },
  { value: "not_reachable", label: "Not Reachable", color: '#c9a04c' },
  { value: "excused", label: "Excused", color: colors.text.muted },
  { value: "needs_attention", label: "Needs Attention", color: colors.accent.terracotta },
] as const;

// Format status for display
function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function ClusterFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<string>(getLastSunday());
  const [selectedMember, setSelectedMember] = useState<{
    memberId: Id<"members">;
    name: string;
    contact: string | null;
  } | null>(null);
  const [status, setStatus] = useState<string>("contacted");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [demoLogs, setDemoLogs] = useState<DemoLog[]>([]);

  const myCluster = useQuery(
    api.clusters.myCluster,
    isAuthenticated ? {} : "skip"
  );

  // Use demo cluster when no real cluster assigned
  const cluster = myCluster || (useDemoMode ? DEMO_CLUSTER : null);
  const isDemoMode = useDemoMode || (!myCluster && cluster !== null);

  const availableSundays = useMemo(() => getPreviousSundays(4), []);

  const absentMembersData = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    isAuthenticated && myCluster?._id && selectedDate
      ? { clusterId: myCluster._id, date: selectedDate }
      : "skip"
  );

  // Get all cluster logs for this date to include comments
  const clusterLogsData = useQuery(
    api.clusterFollowUps.getLogs,
    isAuthenticated && myCluster?._id ? { clusterId: myCluster._id, limit: 100 } : "skip"
  );

  // Use demo data when in demo mode
  const absentMembers = isDemoMode ? getDemoAbsentMembers(selectedDate).map(m => {
    // Check if there's a demo log for this member on this date
    const hasLog = demoLogs.some(l => l.memberId === m.memberId && l.date === selectedDate);
    return { ...m, hasExistingLog: hasLog };
  }) : absentMembersData;

  const clusterLogs = isDemoMode ? demoLogs : clusterLogsData;

  const addLog = useMutation(api.clusterFollowUps.addLog);

  const handleSubmit = async () => {
    if (!selectedMember || !cluster) return;

    // Demo mode: just store locally
    if (isDemoMode) {
      const newLog: DemoLog = {
        _id: `demo-log-${Date.now()}`,
        clusterId: cluster._id,
        memberId: selectedMember.memberId,
        memberName: selectedMember.name,
        date: selectedDate,
        status,
        comment: comment.trim() || "",
      };
      setDemoLogs(prev => [...prev, newLog]);
      setSelectedMember(null);
      setComment("");
      setStatus("contacted");
      return;
    }

    setIsSubmitting(true);
    try {
      await addLog({
        clusterId: cluster._id,
        memberId: selectedMember.memberId,
        date: selectedDate,
        status,
        comment: comment.trim() || "",
      });
      setSelectedMember(null);
      setComment("");
      setStatus("contacted");
    } catch (err) {
      console.error("Failed to submit:", err);
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create a map of memberId to log for quick lookup
  const logsByMember = useMemo(() => {
    const map: Record<string, { status: string; comment: string }> = {};
    clusterLogs?.forEach((log: { memberId: Id<"members">; date: string; status: string; comment: string }) => {
      if (log.date === selectedDate) {
        map[log.memberId] = { status: log.status, comment: log.comment };
      }
    });
    return map;
  }, [clusterLogs, selectedDate]);

  // Generate WhatsApp-formatted report
  const generateReport = useMemo(() => {
    if (!cluster || !absentMembers) return "";

    const completedMembers = absentMembers.filter((m: { hasExistingLog: boolean }) => m.hasExistingLog);
    const pendingMembers = absentMembers.filter((m: { hasExistingLog: boolean }) => !m.hasExistingLog);
    
    // Calculate present members
    const totalMembers = cluster.members?.length || 0;
    const presentCount = totalMembers - absentMembers.length;
    
    const leaderName = user?.fullName || user?.firstName || "Cluster Head";
    const dateFormatted = formatIsoDate(selectedDate);
    const progress = absentMembers.length > 0 
      ? Math.round((completedMembers.length / absentMembers.length) * 100) 
      : 100;

    let report = `*CLUSTER FOLLOW-UP REPORT*\n`;
    report += `==================\n\n`;
    
    report += `Date: ${dateFormatted}\n`;
    report += `Cluster: ${cluster.name}${isDemoMode ? " (DEMO)" : ""}\n`;
    report += `Leader: ${leaderName}\n\n`;

    // Summary section
    report += `*SUMMARY*\n`;
    report += `Total Members: ${totalMembers}\n`;
    report += `Present: ${presentCount}\n`;
    report += `Absent: ${absentMembers.length}\n`;
    report += `Follow-up Progress: ${completedMembers.length}/${absentMembers.length} (${progress}%)\n\n`;

    // Present members section
    if (presentCount > 0) {
      report += `*PRESENT (${presentCount})*\n`;
      const presentMembers = cluster.members?.filter((m: { _id: Id<"members"> }) => 
        !absentMembers.some((a: { memberId: Id<"members"> }) => a.memberId === m._id)
      ) || [];
      
      presentMembers.forEach((member: { name: string }) => {
        report += `✓ ${member.name}\n`;
      });
      report += `\n`;
    }

    // Absent with reports section
    if (completedMembers.length > 0) {
      report += `*ABSENT - REPORTED (${completedMembers.length})*\n`;
      completedMembers.forEach((member: { memberId: Id<"members">; memberName: string; memberContact?: string | null }) => {
        const log = logsByMember[member.memberId];
        report += `\n${member.memberName}\n`;
        if (member.memberContact) {
          report += `Contact: ${member.memberContact}\n`;
        }
        if (log) {
          report += `Status: ${formatStatus(log.status)}\n`;
          if (log.comment && log.comment.trim()) {
            report += `Note: "${log.comment}"\n`;
          }
        }
      });
      report += `\n`;
    }

    // Absent pending section
    if (pendingMembers.length > 0) {
      report += `*ABSENT - PENDING (${pendingMembers.length})*\n`;
      pendingMembers.forEach((member: { memberName: string; memberContact?: string | null }) => {
        report += `• ${member.memberName}`;
        if (member.memberContact) {
          report += ` (${member.memberContact})`;
        }
        report += `\n`;
      });
      report += `\n`;
    }

    report += `==================\n`;
    report += `_Imaara Follow-up System_`;

    return report;
  }, [myCluster, absentMembers, selectedDate, user, logsByMember]);

  // Handle share/export
  const handleShare = async () => {
    const report = generateReport;
    if (!report) return;

    // Check if Web Share API is available (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Follow-up Report - ${cluster?.name}`,
          text: report,
        });
        return;
      } catch (err) {
        console.log("Share cancelled, falling back to WhatsApp");
      }
    }

    // Fallback to WhatsApp
    const encodedReport = encodeURIComponent(report);
    window.open(`https://wa.me/?text=${encodedReport}`, '_blank');
  };

  const totalAbsent = absentMembers?.length || 0;
  const completedCount = absentMembers?.filter((m: { hasExistingLog: boolean }) => m.hasExistingLog).length || 0;
  const pendingCount = totalAbsent - completedCount;
  const progress = totalAbsent > 0 ? Math.round((completedCount / totalAbsent) * 100) : 0;

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
          <Link 
            href="/cluster-head"
            className="flex items-center gap-1 text-sm"
            style={{ color: colors.text.secondary }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </Link>
          
          <span className="text-sm" style={{ color: colors.text.secondary }}>
            Follow-ups
          </span>

          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Date Selector */}
          <div className="mb-6">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-xl"
              style={{ 
                backgroundColor: colors.surface,
                color: colors.text.primary,
                border: 'none',
              }}
            >
              {availableSundays.map((sunday) => (
                <option key={sunday} value={sunday}>
                  {formatIsoDate(sunday)}
                </option>
              ))}
            </select>
          </div>

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
                      Reports are stored locally only
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUseDemoMode(false);
                      setDemoLogs([]);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: colors.bg, color: colors.text.secondary }}
                  >
                    Exit Demo
                  </button>
                </div>
              )}
              {/* Progress Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div 
                  className="p-4 rounded-xl text-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <p className="text-2xl font-light" style={{ color: colors.text.primary }}>
                    {totalAbsent}
                  </p>
                  <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                    Absent
                  </p>
                </div>
                <div 
                  className="p-4 rounded-xl text-center"
                  style={{ backgroundColor: colors.accent.sageLight }}
                >
                  <p className="text-2xl font-light" style={{ color: colors.accent.sage }}>
                    {completedCount}
                  </p>
                  <p className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                    Done
                  </p>
                </div>
                <div 
                  className="p-4 rounded-xl text-center"
                  style={{ backgroundColor: pendingCount > 0 ? colors.accent.amberLight : colors.surface }}
                >
                  <p className="text-2xl font-light" style={{ color: pendingCount > 0 ? colors.accent.amber : colors.text.primary }}>
                    {pendingCount}
                  </p>
                  <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                    Pending
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`, 
                      backgroundColor: progress === 100 ? colors.accent.sage : colors.accent.amber 
                    }}
                  />
                </div>
              </div>

              {/* Share Report Button */}
              {totalAbsent > 0 && (
                <button
                  onClick={handleShare}
                  className="w-full mb-6 py-3 rounded-full text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  Share Report
                </button>
              )}

              {/* Member Cards */}
              <div className="space-y-4">
                {absentMembers && absentMembers.length > 0 ? (
                  absentMembers.map((member: { 
                    memberId: Id<"members">; 
                    memberName: string; 
                    memberContact: string | null;
                    memberResidence: string | null;
                    hasExistingLog: boolean;
                  }) => {
                    const log = logsByMember[member.memberId];
                    return (
                    <div 
                      key={member.memberId}
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: colors.surface }}
                    >
                      {/* Top Row: Name & Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base truncate" style={{ color: colors.text.primary }}>
                            {member.memberName}
                          </h3>
                          {member.memberResidence && (
                            <p className="text-xs mt-1 truncate" style={{ color: colors.text.muted }}>
                              {member.memberResidence}
                            </p>
                          )}
                        </div>
                        
                        {member.hasExistingLog ? (
                          <span 
                            className="px-2.5 py-1 rounded-full text-xs flex-shrink-0"
                            style={{ 
                              backgroundColor: colors.accent.sageLight,
                              color: colors.accent.sage,
                            }}
                          >
                            Done
                          </span>
                        ) : (
                          <span 
                            className="px-2.5 py-1 rounded-full text-xs flex-shrink-0"
                            style={{ 
                              backgroundColor: colors.bg,
                              color: colors.text.muted,
                            }}
                          >
                            To do
                          </span>
                        )}
                      </div>

                      {/* Show status/comment if completed */}
                      {member.hasExistingLog && log && (
                        <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: colors.bg }}>
                          <p className="text-xs" style={{ color: colors.text.secondary }}>
                            {formatStatus(log.status)}
                          </p>
                          {log.comment && log.comment.trim() && (
                            <p className="text-xs mt-1 italic" style={{ color: colors.text.muted }}>
                              "{log.comment}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bottom Row: Contact & Action */}
                      <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
                        <div className="flex-1 min-w-0">
                          {member.memberContact ? (
                            <a 
                              href={`tel:${member.memberContact}`}
                              className="text-sm flex items-center gap-1.5"
                              style={{ color: colors.accent.amber }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="truncate">{member.memberContact}</span>
                            </a>
                          ) : (
                            <span className="text-sm" style={{ color: colors.text.muted }}>No contact</span>
                          )}
                        </div>

                        {member.hasExistingLog ? (
                          <span className="text-xs px-3 py-1.5 rounded-full" style={{ color: colors.text.muted }}>
                            Reported
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedMember({
                              memberId: member.memberId,
                              name: member.memberName,
                              contact: member.memberContact,
                            })}
                            className="px-5 py-1.5 rounded-full text-sm"
                            style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  );})
                ) : (
                  <div 
                    className="text-center py-12 rounded-xl"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <p className="text-sm" style={{ color: colors.text.secondary }}>
                      No absent members
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                      Everyone was present on {formatIsoDate(selectedDate)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Report Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: colors.surface, maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              <div>
                <h3 className="text-base" style={{ color: colors.text.primary }}>
                  {selectedMember.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                  {formatIsoDate(selectedDate)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1"
                style={{ color: colors.text.secondary }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 70px)' }}>
              {/* Quick Call Button */}
              {selectedMember.contact && (
                <a
                  href={`tel:${selectedMember.contact}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm"
                  style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {selectedMember.contact}
                </a>
              )}

              {/* Status Selection */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: colors.text.muted }}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="px-3 py-3 rounded-xl text-sm text-center"
                      style={{ 
                        backgroundColor: status === opt.value ? `${opt.color}15` : colors.bg,
                        color: status === opt.value ? opt.color : colors.text.primary,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: colors.text.muted }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm rounded-xl resize-none"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary, border: 'none' }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-3 text-sm rounded-full"
                  style={{ backgroundColor: colors.bg, color: colors.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm rounded-full disabled:opacity-50"
                  style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                >
                  {isSubmitting ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
