"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate } from "@/lib/date";

// Dashboard Color Palette - Warm but functional
const colors = {
  bg: '#faf9f6',
  card: '#ffffff',
  border: '#e8e4df',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5c5a56',
    muted: '#9a9590',
  },
  
  accent: '#8b7355',
  success: '#5a7a5a',
  warning: '#b8a050',
  danger: '#a06060',
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", color: colors.success },
  { value: "not_reachable", label: "Not Reachable", color: colors.warning },
  { value: "excused", label: "Excused", color: colors.accent },
  { value: "needs_attention", label: "Needs Attention", color: colors.danger },
] as const;

export default function ClusterFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
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

  const lastSunday = getLastSunday();

  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    isAuthenticated && myCluster?._id ? { clusterId: myCluster._id, date: lastSunday } : "skip"
  );

  const addLog = useMutation(api.clusterFollowUps.addLog);

  const handleSubmit = async () => {
    if (!selectedMember || !myCluster) return;

    setIsSubmitting(true);
    try {
      await addLog({
        clusterId: myCluster._id,
        memberId: selectedMember.memberId,
        date: lastSunday,
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
  const progress = totalAbsent > 0 ? Math.round((completedCount / totalAbsent) * 100) : 100;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.card, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/cluster-head"
              className="flex items-center gap-1.5 text-sm"
              style={{ color: colors.text.secondary }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 12L6 8l4-4" />
              </svg>
              Back
            </Link>
            <span className="text-sm" style={{ color: colors.text.muted }}>|</span>
            <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
              {myCluster?.name}
            </span>
          </div>
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {formatIsoDate(lastSunday)}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              Please sign in to submit follow-ups
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm border rounded"
                style={{ borderColor: colors.text.primary, color: colors.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: colors.text.primary }}>
                    {totalAbsent}
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Absent
                  </p>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: completedCount === totalAbsent && totalAbsent > 0 ? colors.success : colors.text.primary }}>
                    {completedCount}
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Completed
                  </p>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: pendingCount > 0 ? colors.warning : colors.text.primary }}>
                    {pendingCount}
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Pending
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs mb-2" style={{ color: colors.text.muted }}>
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${progress}%`, 
                      backgroundColor: progress === 100 ? colors.success : colors.accent 
                    }}
                  />
                </div>
              </div>

              {/* Members Table */}
              <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                {/* Table Header */}
                <div 
                  className="grid grid-cols-12 gap-4 px-4 py-3 text-xs uppercase tracking-wide"
                  style={{ 
                    backgroundColor: colors.bg,
                    color: colors.text.muted,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <div className="col-span-5">Member</div>
                  <div className="col-span-4">Contact</div>
                  <div className="col-span-3 text-right">Action</div>
                </div>

                {/* Table Body */}
                {absentMembers && absentMembers.length > 0 ? (
                  absentMembers.map((member) => (
                    <div 
                      key={member.memberId}
                      className="grid grid-cols-12 gap-4 px-4 py-3 items-center"
                      style={{ borderBottom: `1px solid ${colors.border}` }}
                    >
                      <div className="col-span-5">
                        <div className="flex items-center gap-2">
                          {member.hasExistingLog && (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={colors.success} strokeWidth="2">
                              <path d="M3 8l3 3 7-7" />
                            </svg>
                          )}
                          <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                            {member.memberName}
                          </span>
                        </div>
                        {member.memberResidence && (
                          <p className="text-xs mt-0.5 ml-5" style={{ color: colors.text.muted }}>
                            {member.memberResidence}
                          </p>
                        )}
                      </div>
                      <div className="col-span-4">
                        {member.memberContact ? (
                          <a 
                            href={`tel:${member.memberContact}`}
                            className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                            style={{ color: colors.accent }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M3 5a2 2 0 012-2h1.28a1 1 0 01.948.684l.548 1.644a1 1 0 01-.577 1.213l-.876.389a11.03 11.03 0 005.068 5.069l.388-.876a1 1 0 011.213-.577l1.644.548A1 1 0 0113 12.72V14a2 2 0 01-2 2C6.82 16 1 10.18 1 4a2 2 0 012-2h0z" />
                            </svg>
                            {member.memberContact}
                          </a>
                        ) : (
                          <span className="text-sm" style={{ color: colors.text.muted }}>—</span>
                        )}
                      </div>
                      <div className="col-span-3 text-right">
                        {member.hasExistingLog ? (
                          <span 
                            className="text-xs px-2 py-1 rounded border"
                            style={{ 
                              borderColor: colors.success,
                              color: colors.success,
                              backgroundColor: `${colors.success}10`
                            }}
                          >
                            Done
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedMember({
                              memberId: member.memberId,
                              name: member.memberName,
                              contact: member.memberContact,
                            })}
                            className="text-xs px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
                            style={{ borderColor: colors.text.primary, color: colors.text.primary }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm" style={{ color: colors.text.secondary }}>
                      No absent members recorded
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full max-w-md rounded-lg overflow-hidden"
            style={{ backgroundColor: colors.card }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              <div>
                <h3 className="text-base font-medium" style={{ color: colors.text.primary }}>
                  {selectedMember.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                  {formatIsoDate(lastSunday)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1.5 hover:opacity-70 transition-opacity"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={colors.text.secondary} strokeWidth="1.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5">
              {/* Status Selection */}
              <div>
                <label className="text-xs uppercase tracking-wide mb-3 block" style={{ color: colors.text.muted }}>
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className="px-3 py-2.5 text-sm rounded border text-left transition-all"
                      style={{ 
                        borderColor: status === opt.value ? opt.color : colors.border,
                        backgroundColor: status === opt.value ? `${opt.color}10` : 'transparent',
                        color: status === opt.value ? opt.color : colors.text.primary
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs uppercase tracking-wide mb-3 block" style={{ color: colors.text.muted }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border rounded resize-none focus:outline-none focus:ring-1"
                  style={{ 
                    borderColor: colors.border, 
                    color: colors.text.primary,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-2.5 text-sm rounded border transition-colors"
                  style={{ borderColor: colors.border, color: colors.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-sm rounded font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: colors.accent, color: '#fff' }}
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

function getLastSunday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day;
  const lastSunday = new Date(today.setDate(diff));
  return lastSunday.toISOString().split("T")[0];
}
