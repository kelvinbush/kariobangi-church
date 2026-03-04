"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getLastSunday, getPreviousSundays, formatIsoDate } from "@/lib/date";

// Clean, readable color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  status: {
    done: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
    todo: { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
  },
  
  accent: '#7c6f5a',
  accentHover: '#6a5f4d',
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", color: theme.status.done },
  { value: "not_reachable", label: "Not Reachable", color: { bg: '#fff3e0', text: '#ef6c00', border: '#ffcc80' } },
  { value: "excused", label: "Excused", color: theme.status.todo },
  { value: "needs_attention", label: "Needs Attention", color: { bg: '#ffebee', text: '#c62828', border: '#ef9a9a' } },
] as const;

export default function ClusterFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
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

  const totalAbsent = absentMembers?.length || 0;
  const completedCount = absentMembers?.filter((m) => m.hasExistingLog).length || 0;
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border"
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

          <div className="w-10" /> {/* Spacer for balance */}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-base mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to submit follow-ups
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-3 text-base font-medium rounded-xl border"
                style={{ borderColor: theme.text.primary, color: theme.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-base" style={{ color: theme.text.secondary }}>
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
                  <p className="text-2xl font-bold" style={{ color: theme.text.primary }}>
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
                  <p className="text-2xl font-bold" style={{ color: theme.status.done.text }}>
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
                  <p className="text-2xl font-bold" style={{ color: pendingCount > 0 ? '#ef6c00' : theme.text.primary }}>
                    {pendingCount}
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                    Pending
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`, 
                      backgroundColor: progress === 100 ? theme.status.done.text : theme.accent 
                    }}
                  />
                </div>
              </div>

              {/* Member Cards - Mobile First */}
              <div className="space-y-3">
                {absentMembers && absentMembers.length > 0 ? (
                  absentMembers.map((member) => (
                    <div 
                      key={member.memberId}
                      className="p-4 rounded-xl border"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      {/* Top Row: Name & Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 
                            className="text-lg font-semibold leading-tight"
                            style={{ color: theme.text.primary }}
                          >
                            {member.memberName}
                          </h3>
                          {member.memberResidence && (
                            <p className="text-sm mt-1 truncate" style={{ color: theme.text.muted }}>
                              {member.memberResidence}
                            </p>
                          )}
                        </div>
                        
                        {member.hasExistingLog ? (
                          <span 
                            className="px-2 py-1 rounded-lg text-xs font-medium border flex-shrink-0"
                            style={{ 
                              backgroundColor: theme.status.done.bg,
                              color: theme.status.done.text,
                              borderColor: theme.status.done.border,
                            }}
                          >
                            Done
                          </span>
                        ) : (
                          <span 
                            className="px-2 py-1 rounded-lg text-xs font-medium border flex-shrink-0"
                            style={{ 
                              backgroundColor: theme.status.todo.bg,
                              color: theme.status.todo.text,
                              borderColor: theme.status.todo.border,
                            }}
                          >
                            To do
                          </span>
                        )}
                      </div>

                      {/* Bottom Row: Contact & Action */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: theme.border }}>
                        <div className="flex-1 min-w-0">
                          {member.memberContact ? (
                            <a 
                              href={`tel:${member.memberContact}`}
                              className="text-base flex items-center gap-2"
                              style={{ color: theme.accent }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="truncate">{member.memberContact}</span>
                            </a>
                          ) : (
                            <span className="text-base" style={{ color: theme.text.muted }}>No contact</span>
                          )}
                        </div>

                        {member.hasExistingLog ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg text-sm font-medium opacity-50"
                            style={{ color: theme.text.muted }}
                          >
                            Reported
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedMember({
                              memberId: member.memberId,
                              name: member.memberName,
                              contact: member.memberContact,
                            })}
                            className="px-4 py-2 rounded-lg text-sm font-medium"
                            style={{ 
                              backgroundColor: theme.accent, 
                              color: '#fff'
                            }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div 
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: theme.border }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-base font-medium" style={{ color: theme.text.secondary }}>
                      No absent members
                    </p>
                    <p className="text-sm mt-1" style={{ color: theme.text.muted }}>
                      Everyone was present on {formatIsoDate(selectedDate)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SignedIn>
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
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: theme.border }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: theme.text.primary }}>
                  {selectedMember.name}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: theme.text.muted }}>
                  {formatIsoDate(selectedDate)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2"
                style={{ color: theme.text.secondary }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {/* Quick Call Button */}
              {selectedMember.contact && (
                <a
                  href={`tel:${selectedMember.contact}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-base font-medium"
                  style={{ 
                    backgroundColor: theme.status.done.bg, 
                    color: theme.status.done.text,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {selectedMember.contact}
                </a>
              )}

              {/* Status Selection */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: theme.text.secondary }}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="px-3 py-3 rounded-xl border text-sm font-medium text-center"
                      style={{ 
                        borderColor: status === opt.value ? opt.color.border : theme.border,
                        backgroundColor: status === opt.value ? opt.color.bg : theme.surface,
                        color: status === opt.value ? opt.color.text : theme.text.primary,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: theme.text.secondary }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-4 py-3 text-base rounded-xl border resize-none"
                  style={{ 
                    borderColor: theme.border, 
                    color: theme.text.primary,
                    backgroundColor: theme.surface,
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-3 text-base font-medium rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-base font-medium rounded-xl disabled:opacity-50"
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
