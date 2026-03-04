"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getLastSunday, getPreviousSundays, formatIsoDate, isSunday } from "@/lib/date";

// ClickUp-inspired color palette
const theme = {
  // Backgrounds
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  
  // Borders
  border: '#e8e6e3',
  borderLight: '#f0eeeb',
  
  // Text
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  // Status colors (ClickUp style)
    status: {
    done: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
    inProgress: { bg: '#fff3e0', text: '#ef6c00', border: '#ffcc80' },
    todo: { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    blocked: { bg: '#ffebee', text: '#c62828', border: '#ef9a9a' },
  },
  
  // Accent
  accent: '#7c6f5a',
  accentHover: '#6a5f4d',
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", style: theme.status.done },
  { value: "not_reachable", label: "Not Reachable", style: theme.status.inProgress },
  { value: "excused", label: "Excused", style: theme.status.todo },
  { value: "needs_attention", label: "Needs Attention", style: theme.status.blocked },
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

  // Get last 4 Sundays for the dropdown
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
      {/* Header - ClickUp style */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/cluster-head"
              className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
              style={{ color: theme.text.secondary }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 16l-4-4 4-4" />
              </svg>
              Back
            </Link>
            <div className="h-4 w-px" style={{ backgroundColor: theme.border }} />
            <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
              {myCluster?.name || "My Cluster"}
            </span>
          </div>
          
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs hidden sm:block" style={{ color: theme.text.muted }}>
              Sunday:
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-md border focus:outline-none focus:ring-2"
              style={{ 
                borderColor: theme.border, 
                backgroundColor: theme.surface,
                color: theme.text.primary,
              }}
            >
              {availableSundays.map((sunday) => (
                <option key={sunday} value={sunday}>
                  {formatIsoDate(sunday)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to submit follow-ups
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm font-medium rounded-lg border transition-all hover:shadow-sm"
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
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Progress Overview - ClickUp style cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div 
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                      Total Absent
                    </span>
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ backgroundColor: theme.status.todo.bg, color: theme.status.todo.text }}
                    >
                      {totalAbsent}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.borderLight }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: '100%', backgroundColor: theme.status.todo.text }}
                    />
                  </div>
                </div>

                <div 
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                      Completed
                    </span>
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ backgroundColor: theme.status.done.bg, color: theme.status.done.text }}
                    >
                      {completedCount}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.borderLight }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: theme.status.done.text }}
                    />
                  </div>
                </div>

                <div 
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                      Pending
                    </span>
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ backgroundColor: theme.status.inProgress.bg, color: theme.status.inProgress.text }}
                    >
                      {pendingCount}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.borderLight }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${100 - progress}%`, backgroundColor: theme.status.inProgress.text }}
                    />
                  </div>
                </div>
              </div>

              {/* Task List - ClickUp style */}
              <div 
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                {/* List Header */}
                <div 
                  className="px-4 py-3 flex items-center gap-4 border-b"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex-1 text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Member
                  </div>
                  <div className="w-32 hidden sm:block text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Contact
                  </div>
                  <div className="w-24 text-center text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Status
                  </div>
                  <div className="w-20 text-right text-xs font-medium uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Action
                  </div>
                </div>

                {/* List Items */}
                {absentMembers && absentMembers.length > 0 ? (
                  absentMembers.map((member) => (
                    <div 
                      key={member.memberId}
                      className="px-4 py-3 flex items-center gap-4 border-b last:border-b-0 hover:transition-colors"
                      style={{ borderColor: theme.borderLight }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.surfaceHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.surface}
                    >
                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* Checkbox style indicator */}
                          <div 
                            className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0"
                            style={{ 
                              borderColor: member.hasExistingLog ? theme.status.done.border : theme.border,
                              backgroundColor: member.hasExistingLog ? theme.status.done.bg : 'transparent'
                            }}
                          >
                            {member.hasExistingLog && (
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={theme.status.done.text} strokeWidth="2">
                                <path d="M3 8l3 3 7-7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: theme.text.primary }}>
                              {member.memberName}
                            </p>
                            {member.memberResidence && (
                              <p className="text-xs truncate" style={{ color: theme.text.muted }}>
                                {member.memberResidence}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="w-32 hidden sm:block">
                        {member.memberContact ? (
                          <a 
                            href={`tel:${member.memberContact}`}
                            className="text-sm hover:underline truncate block"
                            style={{ color: theme.accent }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {member.memberContact}
                          </a>
                        ) : (
                          <span className="text-sm" style={{ color: theme.text.muted }}>—</span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="w-24 text-center">
                        {member.hasExistingLog ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border"
                            style={{ 
                              backgroundColor: theme.status.done.bg,
                              color: theme.status.done.text,
                              borderColor: theme.status.done.border,
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 8l3 3 7-7" />
                            </svg>
                            Done
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border"
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

                      {/* Action */}
                      <div className="w-20 text-right">
                        {member.hasExistingLog ? (
                          <button
                            disabled
                            className="px-3 py-1.5 rounded-md text-xs font-medium opacity-50 cursor-not-allowed"
                            style={{ color: theme.text.muted }}
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedMember({
                              memberId: member.memberId,
                              name: member.memberName,
                              contact: member.memberContact,
                            })}
                            className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all hover:shadow-sm"
                            style={{ 
                              borderColor: theme.accent, 
                              color: theme.accent,
                              backgroundColor: 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.accent;
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = theme.accent;
                            }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <div 
                      className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{ backgroundColor: theme.bg }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="1.5">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: theme.text.secondary }}>
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
        </SignedIn>
      </main>

      {/* Report Modal - ClickUp style */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: theme.border }}
            >
              <div>
                <h3 className="text-base font-semibold" style={{ color: theme.text.primary }}>
                  Follow-up Report
                </h3>
                <p className="text-xs mt-0.5" style={{ color: theme.text.muted }}>
                  {selectedMember.name} • {formatIsoDate(selectedDate)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg hover:transition-colors"
                style={{ color: theme.text.secondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bg}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5">
              {/* Quick Call Button */}
              {selectedMember.contact && (
                <a
                  href={`tel:${selectedMember.contact}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
                  style={{ 
                    backgroundColor: theme.status.done.bg, 
                    color: theme.status.done.text,
                    border: `1px solid ${theme.status.done.border}`
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call {selectedMember.contact}
                </a>
              )}

              {/* Status Selection */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: theme.text.muted }}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all"
                      style={{ 
                        borderColor: status === opt.value ? opt.style.border : theme.border,
                        backgroundColor: status === opt.value ? opt.style.bg : theme.surface,
                        color: status === opt.value ? opt.style.text : theme.text.primary,
                      }}
                      onMouseEnter={(e) => {
                        if (status !== opt.value) {
                          e.currentTarget.style.backgroundColor = theme.bg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (status !== opt.value) {
                          e.currentTarget.style.backgroundColor = theme.surface;
                        }
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2"
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
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg border transition-all"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) e.currentTarget.style.backgroundColor = theme.accentHover;
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.accent}
                >
                  {isSubmitting ? 'Saving...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
