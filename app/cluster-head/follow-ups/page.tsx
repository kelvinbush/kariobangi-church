"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import {
  ChevronLeft,
  Phone,
  PhoneOff,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  X,
  Save,
  Calendar,
  Filter,
  History,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted", icon: Phone, color: "emerald" },
  { value: "not_reachable", label: "Not Reachable", icon: PhoneOff, color: "rose" },
  { value: "excused", label: "Excused Absence", icon: CheckCircle, color: "blue" },
  { value: "needs_attention", label: "Needs Attention", icon: AlertCircle, color: "amber" },
];

const REQUEST_OPTIONS = [
  { value: "none", label: "No Request" },
  { value: "removal", label: "Request Removal" },
  { value: "bishop_attention", label: "Request Bishop's Attention" },
];

export default function ClusterFollowUps() {
  const { isAuthenticated } = useConvexAuth();
  const [navOpen, setNavOpen] = useState(false);

  // Get selected date (default to last Sunday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - daysToSubtract);
  const [selectedDate, setSelectedDate] = useState(lastSunday.toISOString().split("T")[0]);

  const myCluster = useQuery(api.clusters.myCluster, isAuthenticated ? {} : "skip");
  const absentMembers = useQuery(
    api.clusterFollowUps.getAbsentMembers,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id, date: selectedDate }
      : "skip"
  );
  const allLogs = useQuery(
    api.clusterFollowUps.getLogs,
    myCluster && isAuthenticated
      ? { clusterId: myCluster._id }
      : "skip"
  );

  const addLog = useMutation(api.clusterFollowUps.addLog);

  // Form states
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [status, setStatus] = useState("contacted");
  const [absenceReason, setAbsenceReason] = useState("");
  const [comment, setComment] = useState("");
  const [requestType, setRequestType] = useState("none");
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);

  const memberLogs = useQuery(
    api.clusterFollowUps.getMemberLogs,
    historyMemberId && isAuthenticated
      ? { memberId: historyMemberId as any, limit: 10 }
      : "skip"
  );

  const unloggedAbsences = absentMembers?.filter((m) => !m.hasExistingLog) || [];
  const loggedAbsences = absentMembers?.filter((m) => m.hasExistingLog) || [];

  const handleOpenLog = (member: NonNullable<typeof absentMembers>[number]) => {
    setSelectedMember(member.memberId);
    if (member.hasExistingLog && member.existingLogId) {
      // Load existing log data if editing
      const existingLog = allLogs?.find((l) => l._id === member.existingLogId);
      if (existingLog) {
        setStatus(existingLog.status);
        setAbsenceReason(existingLog.absenceReason || "");
        setComment(existingLog.comment);
        setRequestType(existingLog.requestType);
      }
    } else {
      // Reset form for new log
      setStatus("contacted");
      setAbsenceReason("");
      setComment("");
      setRequestType("none");
    }
    setShowLogModal(true);
  };

  const handleSaveLog = async () => {
    if (!myCluster || !selectedMember) return;

    try {
      await addLog({
        clusterId: myCluster._id,
        memberId: selectedMember as any,
        date: selectedDate,
        status,
        absenceReason: absenceReason || undefined,
        comment,
        requestType: requestType as any,
      });
      setShowLogModal(false);
      setSelectedMember(null);
      setAbsenceReason("");
      setComment("");
      setRequestType("none");
    } catch (e) {
      alert("Failed to save follow-up log: " + e);
    }
  };

  const handleViewHistory = (memberId: string) => {
    setHistoryMemberId(memberId);
    setShowHistoryModal(true);
  };

  const selectedStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/90 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="text-zinc-900 font-medium tracking-tight text-lg flex items-center gap-2">
                <Link href="/cluster-head" className="text-zinc-500 hover:text-zinc-700">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                Follow-ups
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-zinc-200/80 bg-white px-4 py-3 flex flex-col gap-0.5">
            <Link href="/cluster-head" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Dashboard
            </Link>
            <Link href="/cluster-head/follow-ups" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Follow-ups
            </Link>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto text-center py-12">
            <p className="mb-4 text-zinc-700">Please sign in to access follow-ups.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-12">
              <p className="text-zinc-600">No cluster assigned.</p>
            </div>
          ) : (
            <>
              {/* Date Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <label className="text-sm text-zinc-600">Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div className="text-sm text-zinc-600">
                  {absentMembers?.length || 0} absent members
                </div>
              </div>

              {/* Need Follow-up Section */}
              {unloggedAbsences.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Need Follow-up ({unloggedAbsences.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unloggedAbsences.map((member) => (
                      <div
                        key={member.memberId}
                        className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-amber-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-zinc-900">{member.memberName}</h4>
                            {member.memberContact && (
                              <p className="text-sm text-zinc-600">{member.memberContact}</p>
                            )}
                            {member.memberResidence && (
                              <p className="text-sm text-zinc-500">{member.memberResidence}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleOpenLog(member)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-800"
                            >
                              Log Follow-up
                            </button>
                            <button
                              onClick={() => handleViewHistory(member.memberId)}
                              className="px-3 py-1.5 rounded-lg text-zinc-600 text-sm hover:bg-zinc-100 flex items-center justify-center gap-1"
                            >
                              <History className="w-3 h-3" /> History
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Follow-ups */}
              {loggedAbsences.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Completed ({loggedAbsences.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {loggedAbsences.map((member) => {
                      const log = allLogs?.find((l) => l._id === member.existingLogId);
                      const statusOption = STATUS_OPTIONS.find((s) => s.value === log?.status);
                      const StatusIcon = statusOption?.icon || CheckCircle;

                      return (
                        <div
                          key={member.memberId}
                          className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-zinc-900">{member.memberName}</h4>
                                <span className={`px-2 py-0.5 rounded text-xs bg-${statusOption?.color}-100 text-${statusOption?.color}-700`}>
                                  {statusOption?.label}
                                </span>
                              </div>
                              {log?.absenceReason && (
                                <p className="text-sm text-zinc-600 mt-1">
                                  Reason: {log.absenceReason}
                                </p>
                              )}
                              {log?.comment && (
                                <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                                  "{log.comment}"
                                </p>
                              )}
                              {log && log.requestType !== "none" && (
                                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${
                                  log.requestType === "bishop_attention"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-zinc-100 text-zinc-700"
                                }`}>
                                  {log.requestType === "bishop_attention" ? "Bishop's Attention" : "Removal Requested"}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleOpenLog(member)}
                                className="px-3 py-1.5 rounded-lg text-zinc-600 text-sm hover:bg-zinc-100"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {absentMembers?.length === 0 && (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-zinc-600">All members were present on {formatIsoDate(selectedDate)}!</p>
                </div>
              )}
            </>
          )}
        </SignedIn>
      </div>

      {/* Log Modal */}
      {showLogModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">
                Log Follow-up
              </h3>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Selection */}
              <div>
                <label className="block text-sm text-zinc-600 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setStatus(option.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                          status === option.value
                            ? `border-${option.color}-500 bg-${option.color}-50`
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${status === option.value ? `text-${option.color}-600` : "text-zinc-400"}`} />
                        <span className={`text-sm ${status === option.value ? "font-medium" : ""}`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Absence Reason */}
              <div>
                <label className="block text-sm text-zinc-600 mb-1">
                  Absence Reason (Optional)
                </label>
                <input
                  type="text"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="e.g., Sick, Travel, Family emergency..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm text-zinc-600 mb-1">
                  Notes <span className="text-zinc-400">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Details about the follow-up call..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                />
              </div>

              {/* Request Type */}
              <div>
                <label className="block text-sm text-zinc-600 mb-2">Request</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {REQUEST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLog}
                  disabled={!comment.trim()}
                  className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyMemberId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">Follow-up History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>

            {memberLogs && memberLogs.length > 0 ? (
              <div className="space-y-3">
                {memberLogs.map((log) => {
                  const statusOption = STATUS_OPTIONS.find((s) => s.value === log.status);
                  return (
                    <div key={log._id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          log.status === "contacted" ? "bg-emerald-100 text-emerald-700" :
                          log.status === "not_reachable" ? "bg-rose-100 text-rose-700" :
                          log.status === "excused" ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {statusOption?.label}
                        </span>
                        <span className="text-xs text-zinc-500">{formatIsoDate(log.date)}</span>
                      </div>
                      {log.absenceReason && (
                        <p className="text-sm text-zinc-600">Reason: {log.absenceReason}</p>
                      )}
                      <p className="text-sm text-zinc-700 mt-1">{log.comment}</p>
                      {log.requestType !== "none" && (
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${
                          log.requestType === "bishop_attention"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}>
                          {log.requestType === "bishop_attention" ? "Bishop's Attention" : "Removal"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-8">No follow-up history found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
