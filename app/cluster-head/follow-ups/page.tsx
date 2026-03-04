"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import { ChevronLeft, Phone, PhoneOff, CheckCircle, AlertCircle, X, ArrowRight } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", icon: Phone, color: "emerald" },
  { value: "not_reachable", label: "Not Reachable", icon: PhoneOff, color: "rose" },
  { value: "excused", label: "Excused", icon: CheckCircle, color: "blue" },
  { value: "needs_attention", label: "Needs Attention", icon: AlertCircle, color: "amber" },
];

const REQUEST_OPTIONS = [
  { value: "none", label: "No action needed" },
  { value: "bishop_attention", label: "Needs bishop attention" },
];

export default function ClusterFollowUps() {
  const { isAuthenticated } = useConvexAuth();
  
  // Always use previous Sunday - no date selection
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

  // Form state
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [status, setStatus] = useState("contacted");
  const [absenceReason, setAbsenceReason] = useState("");
  const [comment, setComment] = useState("");
  const [requestType, setRequestType] = useState("none");
  const [showForm, setShowForm] = useState(false);

  const unloggedAbsences = absentMembers?.filter((m) => !m.hasExistingLog) || [];
  const loggedAbsences = absentMembers?.filter((m) => m.hasExistingLog) || [];

  const handleOpenForm = (memberId: string) => {
    setSelectedMember(memberId);
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
        memberId: selectedMember as any,
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

  const selectedMemberData = absentMembers?.find(m => m.memberId === selectedMember);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/cluster-head" className="p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <span className="font-semibold text-slate-900">Follow-ups</span>
            <p className="text-xs text-slate-500">{formatIsoDate(lastSundayIso)}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-sm text-slate-600">Sign in to access follow-ups</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="mt-12 text-center text-slate-600">No cluster assigned</div>
          ) : (
            <div className="space-y-4">
              {/* Progress */}
              {absentMembers && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Progress</span>
                    <span className="text-sm font-medium text-slate-900">
                      {loggedAbsences.length} / {absentMembers.length}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-900 transition-all"
                      style={{ 
                        width: `${absentMembers.length > 0 ? (loggedAbsences.length / absentMembers.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Need Follow-up */}
              {unloggedAbsences.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Need Follow-up ({unloggedAbsences.length})
                  </h2>
                  <div className="space-y-2">
                    {unloggedAbsences.map((member) => (
                      <button
                        key={member.memberId}
                        onClick={() => handleOpenForm(member.memberId)}
                        className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{member.memberName}</p>
                            {member.memberContact && (
                              <p className="text-sm text-slate-500">{member.memberContact}</p>
                            )}
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {loggedAbsences.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Completed ({loggedAbsences.length})
                  </h2>
                  <div className="space-y-2">
                    {loggedAbsences.map((member) => (
                      <div
                        key={member.memberId}
                        className="bg-slate-50 rounded-xl border border-slate-100 p-4"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="font-medium text-slate-900">{member.memberName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Present */}
              {absentMembers?.length === 0 && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-slate-900 font-medium">All members present</p>
                  <p className="text-sm text-slate-600 mt-1">No follow-ups needed</p>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </main>

      {/* Report Form Modal */}
      {showForm && selectedMemberData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Report Follow-up</p>
                <p className="text-sm text-slate-500">{selectedMemberData.memberName}</p>
              </div>
              <button 
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setStatus(option.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                          status === option.value
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${status === option.value ? "text-slate-900" : "text-slate-400"}`} />
                        <span className={`text-sm ${status === option.value ? "font-medium text-slate-900" : "text-slate-600"}`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Absence Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for absence
                </label>
                <input
                  type="text"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="e.g., Sick, travel, work..."
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes <span className="text-slate-400">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Details from your conversation..."
                  rows={4}
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                />
              </div>

              {/* Action Request */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action needed</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
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
            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!comment.trim()}
                className="flex-1 px-4 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
