"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate } from "@/lib/date";

// Luxury Color Palette - Warm, muted, earth-toned
const palette = {
  canvas: '#faf9f6',
  surface: '#ffffff',
  muted: '#f5f3ef',
  
  primary: '#1a1a1a',
  secondary: '#6b6560',
  tertiary: '#9a9590',
  
  accent: '#8b7355',
  accentLight: '#c4b5a0',
  
  border: '#e8e4df',
  divider: '#f0ece6',
  
  success: '#6b8e6b',
  attention: '#b87070',
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted" },
  { value: "not_reachable", label: "Not Reachable" },
  { value: "excused", label: "Excused" },
  { value: "needs_attention", label: "Needs Attention" },
] as const;

export default function ClusterFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
  const [selectedMember, setSelectedMember] = useState<{
    memberId: Id<"members">;
    name: string;
    contact: string;
  } | null>(null);
  const [status, setStatus] = useState<string>("contacted");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedMember(null);
        setComment("");
        setStatus("contacted");
      }, 1500);
    } catch (err) {
      console.error("Failed to submit:", err);
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAbsent = absentMembers?.length || 0;
  const completedCount = absentMembers?.filter((m: { hasExistingLog: boolean }) => m.hasExistingLog).length || 0;
  const progress = totalAbsent > 0 ? Math.round((completedCount / totalAbsent) * 100) : 100;

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.canvas }}>
      {/* Header */}
      <header style={{ backgroundColor: palette.surface }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link 
            href="/cluster-head"
            className="flex items-center gap-2 text-sm tracking-wide"
            style={{ color: palette.secondary }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back to Cluster
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-8" style={{ color: palette.secondary }}>
              Please sign in to submit follow-ups
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-8 py-3 text-sm tracking-wide border transition-colors"
                style={{ borderColor: palette.primary, color: palette.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: palette.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Page Header */}
              <div className="mb-12">
                <p className="text-xs tracking-wide uppercase mb-2" style={{ color: palette.tertiary }}>
                  Follow-ups for {formatIsoDate(lastSunday)}
                </p>
                <h1 className="text-2xl tracking-tight mb-4" style={{ color: palette.primary }}>
                  Absent Members
                </h1>
                
                {/* Progress */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-0.5" style={{ backgroundColor: palette.divider }}>
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: progress === 100 ? palette.success : palette.accent }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: palette.tertiary }}>
                    {completedCount} / {totalAbsent}
                  </span>
                </div>
              </div>

              {/* Absent Members List */}
              {absentMembers && absentMembers.length > 0 ? (
                <div className="space-y-4">
                  {absentMembers.map((member: { 
                    memberId: Id<"members">; 
                    memberName: string; 
                    memberContact: string | null;
                    hasExistingLog: boolean;
                  }) => (
                    <div 
                      key={member.memberId}
                      className="flex items-center justify-between py-4 border-b"
                      style={{ borderColor: palette.divider }}
                    >
                      <div>
                        <p className="text-base mb-1 flex items-center gap-2" style={{ color: palette.primary }}>
                          {member.memberName}
                          {member.hasExistingLog && (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={palette.success} strokeWidth="1.5">
                              <path d="M3 8l3 3 7-7" />
                            </svg>
                          )}
                        </p>
                        {member.memberContact && (
                          <a 
                            href={`tel:${member.memberContact}`}
                            className="text-sm flex items-center gap-1"
                            style={{ color: palette.accent }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M3 5a2 2 0 012-2h1.28a1 1 0 01.948.684l.548 1.644a1 1 0 01-.577 1.213l-.876.389a11.03 11.03 0 005.068 5.069l.388-.876a1 1 0 011.213-.577l1.644.548A1 1 0 0113 12.72V14a2 2 0 01-2 2C6.82 16 1 10.18 1 4a2 2 0 012-2h0z" />
                            </svg>
                            {member.memberContact}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedMember({
                          memberId: member.memberId,
                          name: member.memberName,
                          contact: member.memberContact || "",
                        })}
                        disabled={member.hasExistingLog}
                        className="px-4 py-2 text-xs tracking-wide border transition-colors disabled:opacity-40"
                        style={{ 
                          borderColor: member.hasExistingLog ? palette.border : palette.primary, 
                          color: member.hasExistingLog ? palette.tertiary : palette.primary 
                        }}
                      >
                        {member.hasExistingLog ? 'Reported' : 'Report'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: palette.secondary }}>
                    No absent members recorded for {formatIsoDate(lastSunday)}
                  </p>
                </div>
              )}
            </>
          )}
        </SignedIn>
      </main>

      {/* Report Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(26, 26, 26, 0.3)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl overflow-hidden"
            style={{ backgroundColor: palette.surface, maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: palette.divider }}>
              <div>
                <h3 className="text-base mb-1" style={{ color: palette.primary }}>
                  {selectedMember.name}
                </h3>
                <p className="text-xs" style={{ color: palette.tertiary }}>
                  {formatIsoDate(lastSunday)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 -mr-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={palette.secondary} strokeWidth="1.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status Selection */}
              <div>
                <label className="text-xs tracking-wide uppercase mb-3 block" style={{ color: palette.tertiary }}>
                  Status
                </label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label 
                      key={opt.value}
                      className="flex items-center gap-3 py-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={status === opt.value}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-4 h-4"
                        style={{ accentColor: palette.accent }}
                      />
                      <span className="text-sm" style={{ color: palette.primary }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-xs tracking-wide uppercase mb-3 block" style={{ color: palette.tertiary }}>
                  Notes
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comments..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm border resize-none focus:outline-none"
                  style={{ borderColor: palette.border, color: palette.primary }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex-1 py-3 text-sm tracking-wide border transition-colors"
                  style={{ borderColor: palette.border, color: palette.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm tracking-wide border transition-colors disabled:opacity-50"
                  style={{ borderColor: palette.primary, color: palette.primary, backgroundColor: palette.primary }}
                >
                  <span style={{ color: palette.surface }}>
                    {isSubmitting ? 'Submitting...' : showSuccess ? 'Saved' : 'Submit'}
                  </span>
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
