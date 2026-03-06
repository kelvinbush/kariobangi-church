"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getLastSunday, getPreviousSundays, formatIsoDate } from "@/lib/date";

// Light, clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  borderLight: '#f0eeeb',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  success: '#5a7a5a',
  warning: '#b8a050',
  danger: '#a06060',
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", color: theme.success },
  { value: "not_reachable", label: "Not Reachable", color: theme.warning },
  { value: "excused", label: "Excused", color: theme.text.muted },
  { value: "needs_attention", label: "Needs Attention", color: theme.danger },
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

  const myCluster = useQuery(
    api.clusters.myCluster,
    isAuthenticated ? {} : "skip"
  );

  const availableSundays = useMemo(() => getPreviousSundays(4), []);

  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    isAuthenticated && myCluster?._id && selectedDate
      ? { clusterId: myCluster._id, date: selectedDate }
      : "skip"
  );

  // Get all cluster logs for this date to include comments
  const clusterLogs = useQuery(
    api.clusterFollowUps.getLogs,
    isAuthenticated && myCluster?._id ? { clusterId: myCluster._id, limit: 100 } : "skip"
  );

  const addLog = useMutation(api.clusterFollowUps.addLog);

  const handleSubmit = async () => {
    if (!selectedMember || !myCluster) return;

    setIsSubmitting(true);
    try {
      await addLog({
        clusterId: myCluster._id,
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
    if (!myCluster || !absentMembers) return "";

    const completedMembers = absentMembers.filter((m: { hasExistingLog: boolean }) => m.hasExistingLog);
    const pendingMembers = absentMembers.filter((m: { hasExistingLog: boolean }) => !m.hasExistingLog);
    
    // Calculate present members
    const totalMembers = myCluster.members?.length || 0;
    const presentCount = totalMembers - absentMembers.length;
    
    const leaderName = user?.fullName || user?.firstName || "Cluster Head";
    const dateFormatted = formatIsoDate(selectedDate);
    const progress = absentMembers.length > 0 
      ? Math.round((completedMembers.length / absentMembers.length) * 100) 
      : 100;

    let report = `*CLUSTER FOLLOW-UP REPORT*\n`;
    report += `==================\n\n`;
    
    report += `Date: ${dateFormatted}\n`;
    report += `Cluster: ${myCluster.name}\n`;
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
      const presentMembers = myCluster.members?.filter((m: { _id: Id<"members"> }) => 
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
          title: `Follow-up Report - ${myCluster?.name}`,
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
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link 
            href="/cluster-head"
            className="flex items-center gap-1 text-sm"
            style={{ color: theme.text.secondary }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ 
              borderColor: theme.border, 
              backgroundColor: theme.bg,
              color: theme.text.primary,
            }}
          >
            {availableSundays.map((sunday) => (
              <option key={sunday} value={sunday}>
                {formatIsoDate(sunday)}
              </option>
            ))}
          </select>

          <div className="w-5" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">

          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Progress Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div 
                  className="p-3 rounded-xl border text-center"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <p className="text-xl" style={{ color: theme.text.primary }}>
                    {totalAbsent}
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                    Absent
                  </p>
                </div>
                <div 
                  className="p-3 rounded-xl border text-center"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <p className="text-xl" style={{ color: theme.success }}>
                    {completedCount}
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                    Done
                  </p>
                </div>
                <div 
                  className="p-3 rounded-xl border text-center"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <p className="text-xl" style={{ color: pendingCount > 0 ? theme.warning : theme.text.primary }}>
                    {pendingCount}
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                    Pending
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`, 
                      backgroundColor: progress === 100 ? theme.success : theme.accent 
                    }}
                  />
                </div>
              </div>

              {/* Share Report Button */}
              {totalAbsent > 0 && (
                <button
                  onClick={handleShare}
                  className="w-full mb-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#25D366', color: '#fff' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share Report
                </button>
              )}

              {/* Member Cards */}
              <div className="space-y-3">
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
                      className="p-4 rounded-xl border"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      {/* Top Row: Name & Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base truncate" style={{ color: theme.text.primary }}>
                            {member.memberName}
                          </h3>
                          {member.memberResidence && (
                            <p className="text-xs mt-1 truncate" style={{ color: theme.text.muted }}>
                              {member.memberResidence}
                            </p>
                          )}
                        </div>
                        
                        {member.hasExistingLog ? (
                          <span 
                            className="px-2 py-1 rounded-lg text-xs border flex-shrink-0"
                            style={{ 
                              backgroundColor: `${theme.success}15`,
                              color: theme.success,
                              borderColor: `${theme.success}30`,
                            }}
                          >
                            Done
                          </span>
                        ) : (
                          <span 
                            className="px-2 py-1 rounded-lg text-xs border flex-shrink-0"
                            style={{ 
                              backgroundColor: theme.borderLight,
                              color: theme.text.muted,
                              borderColor: theme.border,
                            }}
                          >
                            To do
                          </span>
                        )}
                      </div>

                      {/* Show status/comment if completed */}
                      {member.hasExistingLog && log && (
                        <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: theme.bg }}>
                          <p className="text-xs" style={{ color: theme.text.secondary }}>
                            {formatStatus(log.status)}
                          </p>
                          {log.comment && log.comment.trim() && (
                            <p className="text-xs mt-1 italic" style={{ color: theme.text.muted }}>
                              "{log.comment}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bottom Row: Contact & Action */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: theme.border }}>
                        <div className="flex-1 min-w-0">
                          {member.memberContact ? (
                            <a 
                              href={`tel:${member.memberContact}`}
                              className="text-sm flex items-center gap-1.5"
                              style={{ color: theme.accent }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="truncate">{member.memberContact}</span>
                            </a>
                          ) : (
                            <span className="text-sm" style={{ color: theme.text.muted }}>No contact</span>
                          )}
                        </div>

                        {member.hasExistingLog ? (
                          <span className="text-xs px-3 py-1.5 rounded-lg" style={{ color: theme.text.muted }}>
                            Reported
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedMember({
                              memberId: member.memberId,
                              name: member.memberName,
                              contact: member.memberContact,
                            })}
                            className="px-4 py-1.5 rounded-lg text-sm"
                            style={{ backgroundColor: theme.accent, color: '#fff' }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  );})
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: theme.text.secondary }}>
                      No absent members
                    </p>
                    <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                      Everyone was present on {formatIsoDate(selectedDate)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
      </main>

      {/* Report Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: theme.surface, maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.border }}
            >
              <div>
                <h3 className="text-base" style={{ color: theme.text.primary }}>
                  {selectedMember.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: theme.text.muted }}>
                  {formatIsoDate(selectedDate)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1"
                style={{ color: theme.text.secondary }}
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
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: `${theme.success}15`, color: theme.success }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {selectedMember.contact}
                </a>
              )}

              {/* Status Selection */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="px-3 py-2.5 rounded-xl border text-sm text-center"
                      style={{ 
                        borderColor: status === opt.value ? opt.color : theme.border,
                        backgroundColor: status === opt.value ? `${opt.color}10` : theme.surface,
                        color: status === opt.value ? opt.color : theme.text.primary,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border resize-none"
                  style={{ borderColor: theme.border, color: theme.text.primary }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                >
                  {isSubmitting ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
