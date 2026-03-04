"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ChevronLeft, Phone, PhoneOff, CheckCircle, AlertCircle, X, ArrowRight, Clock } from "lucide-react";

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

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", icon: Phone, color: colors.success },
  { value: "not_reachable", label: "Not Reachable", icon: PhoneOff, color: colors.accent },
  { value: "excused", label: "Excused", icon: CheckCircle, color: colors.primary },
  { value: "needs_attention", label: "Needs Attention", icon: AlertCircle, color: colors.warning },
];

const REQUEST_OPTIONS = [
  { value: "none", label: "No action needed" },
  { value: "bishop_attention", label: "Needs bishop attention" },
];

export default function ClusterFollowUps() {
  const { isAuthenticated } = useConvexAuth();
  
  // Always use previous Sunday
  const lastSunday = getPreviousSunday(new Date());
  const lastSundayIso = toISODate(lastSunday);

  const myCluster = useQuery(api.clusters.myCluster, isAuthenticated ? {} : "skip");
  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, date: lastSundayIso }
      : "skip"
  );

  const addLog = useMutation(api.clusterFollowUps.addLog);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [status, setStatus] = useState("contacted");
  const [absenceReason, setAbsenceReason] = useState("");
  const [comment, setComment] = useState("");
  const [requestType, setRequestType] = useState("none");
  const [showForm, setShowForm] = useState(false);

  const unloggedAbsences = absentMembers?.filter((m) => !m.hasExistingLog) || [];
  const loggedAbsences = absentMembers?.filter((m) => m.hasExistingLog) || [];

  const handleOpenForm = (member: any) => {
    setSelectedMember(member);
    setStatus("contacted");
    setAbsenceReason("");
    setComment("");
    setRequestType("none");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!myCluster || !selectedMember || !comment.trim()) return;

    try {
      await addLog({
        clusterId: myCluster._id,
        memberId: selectedMember.memberId,
        date: lastSundayIso,
        status,
        absenceReason: absenceReason || undefined,
        comment,
        requestType: requestType as any,
      });
      setShowForm(false);
      setSelectedMember(null);
    } catch (e) {
      alert("Failed to save. Please try again.");
    }
  };

  const progress = absentMembers && absentMembers.length > 0
    ? Math.round((loggedAbsences.length / absentMembers.length) * 100)
    : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.bg.card, borderBottom: `1px solid ${colors.border.light}` }}>
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link 
            href="/cluster-head" 
            className="p-2 -ml-2 rounded-lg transition-colors"
            style={{ backgroundColor: colors.bg.subtle }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: colors.text.secondary }} />
          </Link>
          <div className="flex-1">
            <span className="text-base tracking-tight" style={{ color: colors.text.primary }}>
              Sunday Follow-ups
            </span>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              {formatIsoDate(lastSundayIso)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-16 text-center">
            <p className="text-base" style={{ color: colors.text.secondary }}>
              Sign in to access follow-ups
            </p>
            <SignInButton mode="modal">
              <button 
                className="mt-4 px-8 py-3 text-base rounded-xl"
                style={{ backgroundColor: colors.primary[600], color: colors.text.inverse }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="mt-12 text-center" style={{ color: colors.text.secondary }}>
              No cluster assigned
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Card */}
              {absentMembers && absentMembers.length > 0 && (
                <div 
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm" style={{ color: colors.text.muted }}>Progress</span>
                    <span className="text-sm" style={{ color: colors.text.primary }}>
                      {loggedAbsences.length} of {absentMembers.length}
                    </span>
                  </div>
                  <div 
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.bg.subtle }}
                  >
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${progress}%`,
                        backgroundColor: progress === 100 ? colors.success[500] : colors.primary[500],
                      }}
                    />
                  </div>
                  {progress === 100 && (
                    <div 
                      className="mt-3 text-center py-3 rounded-xl"
                      style={{ backgroundColor: colors.success[50] }}
                    >
                      <span style={{ color: colors.success[600] }}>
                        All follow-ups completed!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Need Follow-up */}
              {unloggedAbsences.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                    Need Follow-up
                    <span 
                      className="ml-2 px-2.5 py-0.5 text-sm rounded-full"
                      style={{ backgroundColor: colors.accent[100], color: colors.accent[600] }}
                    >
                      {unloggedAbsences.length}
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {unloggedAbsences.map((member) => (
                      <div
                        key={member.memberId}
                        className="rounded-2xl overflow-hidden"
                        style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
                                style={{ backgroundColor: colors.accent[50], color: colors.accent[600] }}
                              >
                                {member.memberName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-base" style={{ color: colors.text.primary }}>
                                  {member.memberName}
                                </p>
                                {member.memberContact && (
                                  <p className="text-sm" style={{ color: colors.text.muted }}>
                                    {member.memberContact}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex gap-3">
                            {member.memberContact && (
                              <a
                                href={`tel:${member.memberContact}`}
                                className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-base transition-colors"
                                style={{ backgroundColor: colors.success[500], color: colors.text.inverse }}
                              >
                                <Phone className="w-5 h-5" />
                                Call
                              </a>
                            )}
                            <button
                              onClick={() => handleOpenForm(member)}
                              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-base transition-colors"
                              style={{ backgroundColor: colors.primary[600], color: colors.text.inverse }}
                            >
                              <CheckCircle className="w-5 h-5" />
                              Log Report
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {loggedAbsences.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                    Completed
                    <span 
                      className="ml-2 px-2.5 py-0.5 text-sm rounded-full"
                      style={{ backgroundColor: colors.success[100], color: colors.success[600] }}
                    >
                      {loggedAbsences.length}
                    </span>
                  </h2>
                  <div 
                    className="rounded-2xl overflow-hidden"
                    style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
                  >
                    {loggedAbsences.map((member, index) => (
                      <div
                        key={member.memberId}
                        className="px-5 py-4 border-b last:border-0 flex items-center gap-3"
                        style={{ 
                          borderColor: colors.border.light,
                          backgroundColor: index % 2 === 0 ? colors.bg.card : colors.bg.subtle,
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: colors.success[100] }}
                        >
                          <CheckCircle className="w-5 h-5" style={{ color: colors.success[600] }} />
                        </div>
                        <span className="flex-1 text-base" style={{ color: colors.text.primary }}>
                          {member.memberName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Present */}
              {absentMembers?.length === 0 && (
                <div 
                  className="rounded-2xl p-12 text-center"
                  style={{ backgroundColor: colors.success[50], border: `1px solid ${colors.success[100]}` }}
                >
                  <div 
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: colors.success[100] }}
                  >
                    <CheckCircle className="w-8 h-8" style={{ color: colors.success[600] }} />
                  </div>
                  <p className="text-lg tracking-tight mb-2" style={{ color: colors.text.primary }}>
                    All members present
                  </p>
                  <p className="text-base" style={{ color: colors.text.secondary }}>
                    No follow-ups needed for {formatIsoDate(lastSundayIso)}
                  </p>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </main>

      {/* Report Form Modal */}
      {showForm && selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div 
            className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div 
              className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between"
              style={{ borderColor: colors.border.light }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: colors.primary[100], color: colors.primary[700] }}
                >
                  {selectedMember.memberName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                    Report Follow-up
                  </p>
                  <p className="text-sm" style={{ color: colors.text.muted }}>
                    {selectedMember.memberName}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl transition-colors"
                style={{ backgroundColor: colors.bg.subtle }}
              >
                <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {/* Status Selection */}
              <div className="mb-5">
                <label className="block text-sm mb-3" style={{ color: colors.text.secondary }}>
                  Call Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setStatus(option.value)}
                        className="flex items-center gap-2 p-4 rounded-xl border-2 text-left transition-all"
                        style={{ 
                          borderColor: status === option.value ? option.color[500] : colors.border.light,
                          backgroundColor: status === option.value ? option.color[50] : colors.bg.card,
                        }}
                      >
                        <Icon 
                          className="w-5 h-5" 
                          style={{ color: status === option.value ? option.color[600] : colors.text.muted }} 
                        />
                        <span 
                          className="text-sm"
                          style={{ 
                            color: status === option.value ? option.color[700] : colors.text.secondary,
                          }}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Absence Reason */}
              <div className="mb-5">
                <label className="block text-sm mb-2" style={{ color: colors.text.secondary }}>
                  Reason for absence (optional)
                </label>
                <input
                  type="text"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="e.g., Sick, travel, work..."
                  className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.light,
                  }}
                />
              </div>

              {/* Notes */}
              <div className="mb-5">
                <label className="block text-sm mb-2" style={{ color: colors.text.secondary }}>
                  Notes <span style={{ color: colors.text.muted }}>*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did they say? Any concerns?"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2 resize-none"
                  style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.light,
                  }}
                />
              </div>

              {/* Action Request */}
              <div className="mb-5">
                <label className="block text-sm mb-2" style={{ color: colors.text.secondary }}>
                  Action needed
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.light,
                  }}
                >
                  {REQUEST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="sticky bottom-0 bg-white border-t p-5 flex gap-3"
              style={{ borderColor: colors.border.light }}
            >
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-4 rounded-xl text-base transition-colors"
                style={{ 
                  backgroundColor: colors.bg.subtle,
                  color: colors.text.secondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!comment.trim()}
                className="flex-1 py-4 rounded-xl text-base transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: colors.primary[600],
                  color: colors.text.inverse,
                }}
              >
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}
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
