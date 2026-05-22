"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import { PipelineBadge } from "@/components/PipelineBadge";
import { WeekIndicator } from "@/components/WeekIndicator";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Date formatter
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDate();
  const suffix = [, "st", "nd", "rd"][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)] || "th";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}${suffix} ${months[date.getUTCMonth()]}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted", bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400" },
  { value: "contacted", label: "Contacted", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-400" },
  { value: "needs_follow_up", label: "Needs follow-up", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
];

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm bg-[#303030] text-white rounded-xl p-4 z-50 shadow-lg flex items-center justify-between gap-3">
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white">×</button>
    </div>
  );
}

export default function MyFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();

  // Multi-role support
  const metadata = user?.publicMetadata as { role?: string; roles?: string[]; secondaryRole?: string } | undefined;
  const userRoles = new Set<string>();
  if (metadata?.role) userRoles.add(metadata.role);
  if (metadata?.roles?.length) metadata.roles.forEach((r: string) => userRoles.add(r));
  if (metadata?.secondaryRole) userRoles.add(metadata.secondaryRole);
  const isAdminOrFUAdmin = userRoles.has("admin") || userRoles.has("follow-up-admin");

  const clerkIdParam = searchParams.get("clerkId");
  const targetClerkId = clerkIdParam || user?.id;

  // Queries
  const dashboard = useQuery(
    api.visitorPipeline.getProtocolDashboard,
    isAuthenticated && targetClerkId ? { clerkId: targetClerkId } : "skip"
  );
  const alerts = useQuery(
    api.visitorPipeline.getAlerts,
    isAuthenticated && targetClerkId ? { clerkId: targetClerkId } : "skip"
  );

  // Mutations
  const addLogMutation = useMutation(api.followUps.addLog);
  const requestRemovalMutation = useMutation(api.followUps.requestRemoval);

  // State
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [toast, setToast] = useState<string | null>(null);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [logModal, setLogModal] = useState<any | null>(null);
  const [logStatus, setLogStatus] = useState("contacted");
  const [logComment, setLogComment] = useState("");
  const [removalModal, setRemovalModal] = useState<any | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedVisitorJourney, setSelectedVisitorJourney] = useState<Id<"visitors"> | null>(null);

  const journeyData = useQuery(
    api.visitorPipeline.getVisitorJourney,
    isAuthenticated && selectedVisitorJourney ? { visitorId: selectedVisitorJourney } : "skip"
  );

  const handleShareReport = async () => {
    if (!dashboard || !dashboard.all || dashboard.all.length === 0) {
      setToast("No assignments to report");
      return;
    }

    const displayName = user?.fullName || user?.firstName || "Protocol Member";
    let report = `*⛪ IMAARA PROTOCOL FOLLOW-UP REPORT*\n`;
    report += `*Follow-up Team Member:* ${displayName}\n`;
    report += `*Date:* ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}\n`;
    report += `*Total Active Assignments:* ${dashboard.stats?.active ?? 0}\n`;
    report += `*Week Breakdown:* W1: ${dashboard.stats?.week1 ?? 0} | W2: ${dashboard.stats?.week2 ?? 0} | W3: ${dashboard.stats?.week3 ?? 0} | W4: ${dashboard.stats?.week4 ?? 0}\n`;
    report += `=========================\n\n`;

    dashboard.all.forEach((fu: any, index: number) => {
      report += `${index + 1}. *${fu.visitorName}*\n`;
      if (fu.visitorContact) {
        report += `📱 Contact: ${fu.visitorContact}\n`;
      }
      if (fu.visitorResidence) {
        report += `🏠 Residence: ${fu.visitorResidence}\n`;
      }
      report += `⏳ Pipeline Stage: *${fu.visitorPipelineStage ? fu.visitorPipelineStage.replace(/_/g, " ").toUpperCase() : "NEW"}*\n`;
      report += `📅 Current week: Week ${fu.weekNumber ?? 1}\n`;
      
      const statusLabel = STATUS_OPTIONS.find(s => s.value === fu.status)?.label || fu.status;
      report += `💬 Call Status: ${statusLabel}\n`;
      
      if (fu.logs && fu.logs.length > 0) {
        const sortedLogs = [...fu.logs].sort((a: any, b: any) => b.loggedAt - a.loggedAt);
        report += `📝 Latest Note: "${sortedLogs[0].comment}"\n`;
      }
      report += `\n`;
    });

    report += `=========================\n`;
    report += `_Generated via Imaara Church System_`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Protocol Follow-up Report`,
          text: report,
        });
        return;
      } catch (err) {
        console.log("Share cancelled, falling back to WhatsApp");
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
  };

  const toggleCard = useCallback((id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleAddLog = async () => {
    if (!logModal || !logComment.trim()) {
      setToast("Please add a comment");
      return;
    }
    try {
      await addLogMutation({ followUpId: logModal._id, status: logStatus, comment: logComment.trim() });
      setToast(`Log added for ${logModal.visitorName}`);
      setLogModal(null);
      setLogComment("");
      setLogStatus("contacted");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to add log");
    }
  };

  const handleRequestRemoval = async () => {
    if (!removalModal || !removalReason.trim()) {
      setToast("Please provide a reason");
      return;
    }
    try {
      await requestRemovalMutation({ followUpId: removalModal._id, reason: removalReason.trim() });
      setToast("Removal requested");
      setRemovalModal(null);
      setRemovalReason("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to request removal");
    }
  };

  const loading = dashboard === undefined;
  const stats = dashboard?.stats;
  const urgentAlerts = (alerts ?? []).filter((a: any) => a.severity === "urgent");
  const warningAlerts = (alerts ?? []).filter((a: any) => a.severity === "warning");
  const infoAlerts = (alerts ?? []).filter((a: any) => a.severity === "info");

  // Visitor card used in both kanban and list views
  const VisitorCard = ({ fu, compact = false }: { fu: any; compact?: boolean }) => {
    const statusConfig = STATUS_OPTIONS.find((s) => s.value === fu.status);
    const isExpanded = expandedCards.has(fu._id);

    return (
      <div
        id={`followup-${fu._id}`}
        className="bg-white rounded-xl shadow-sm border border-[#e8e6e3] p-3 transition-all duration-200 hover:shadow-md"
      >
        {/* Name + Status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[#3d3a36] truncate">{fu.visitorName}</div>
            {fu.visitorContact && (
              <a href={`tel:${fu.visitorContact}`} className="text-xs text-amber-600 hover:underline block truncate">{fu.visitorContact}</a>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusConfig?.bg ?? "bg-gray-100"} ${statusConfig?.text ?? "text-gray-600"}`}>
            {statusConfig?.label ?? fu.status}
          </span>
        </div>

        {/* Quick info */}
        <div className="flex items-center gap-3 text-xs text-[#9a9793] mb-2">
          <span>⛪ {fu.sundayCount} Sun{fu.sundayCount !== 1 ? "s" : ""}</span>
          {fu.lastContactDate ? (
            <span>Last: {fmtDate(fu.lastContactDate)}</span>
          ) : (
            <span className="text-orange-500">Not contacted</span>
          )}
        </div>

        {/* Week indicator (on list mode only) */}
        {!compact && fu.weekNumber && (
          <div className="mb-2">
            <WeekIndicator currentWeek={fu.weekNumber} showLabel />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            id={`log-${fu._id}`}
            onClick={() => setLogModal(fu)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            + Log
          </button>
          <button
            id={`expand-${fu._id}`}
            onClick={() => toggleCard(fu._id)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-[#f0ede8] text-[#6b6864] hover:bg-[#e8e6e3] transition-colors"
          >
            {isExpanded ? "Less" : "More"}
          </button>
        </div>

        {/* Expanded: timeline + actions */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[#e8e6e3]">
            {/* Visitor details */}
            <div className="text-xs space-y-1 mb-3 text-[#6b6864]">
              {fu.visitorResidence && <div>📍 {fu.visitorResidence}</div>}
              <div>📅 First visit: {fmtDate(fu.visitorDate)}</div>
              {fu.lastAttendance && <div>🕐 Last attendance: {fmtDate(fu.lastAttendance)}</div>}
              {fu.assignedDate && <div>🎯 Assigned: {fmtDate(fu.assignedDate)}</div>}
            </div>

            {/* Timeline */}
            {fu.logs && fu.logs.length > 0 && (
              <div className="space-y-2 relative pl-4 border-l-2 border-[#e8e6e3] mb-3">
                {fu.logs.map((log: any) => {
                  const logStatus = STATUS_OPTIONS.find((s) => s.value === log.status);
                  return (
                    <div key={log._id} className="relative">
                      <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full ${logStatus?.dot ?? "bg-gray-400"}`} />
                      <div className="text-[10px] text-[#9a9793]">{timeAgo(log.loggedAt)}</div>
                      <p className="text-xs text-[#6b6864]">{log.comment}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* More actions */}
            <div className="flex items-center gap-1.5">
              <button
                id={`journey-${fu._id}`}
                onClick={() => setSelectedVisitorJourney(fu.visitorId)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Journey
              </button>
              {!fu.removalRequested && (
                <button
                  id={`remove-${fu._id}`}
                  onClick={() => setRemovalModal(fu)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Request Removal
                </button>
              )}
              {fu.removalRequested && (
                <span className="text-[10px] text-orange-500 italic">Removal pending</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen" style={{ backgroundColor: "#f5f3ef" }}>
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between border-b border-black/5" style={{ backgroundColor: "#f5f3ef" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm tracking-wide text-[#6b6864] font-medium">My Follow-ups</span>
            {clerkIdParam && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Viewing as other</span>}
          </div>
          <div className="flex items-center gap-3">
            {isAdminOrFUAdmin && (
              <Link href="/follow-ups" className="text-xs px-3 py-1.5 rounded-full bg-white text-[#6b6864]">Admin</Link>
            )}
            {isAdminOrFUAdmin && (
              <Link href="/pipeline" className="text-xs px-3 py-1.5 rounded-full bg-white text-[#6b6864]">Pipeline</Link>
            )}
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-24">
          {/* Alerts Banner */}
          {alerts && alerts.length > 0 && (
            <div className="mb-5">
              <button
                id="toggle-alerts"
                onClick={() => setAlertsExpanded(!alertsExpanded)}
                className="flex items-center gap-2 mb-2"
              >
                <span className="text-xs font-medium text-[#3d3a36]">
                  Alerts
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                  {alerts.length}
                </span>
                <svg className={`w-3 h-3 text-[#9a9793] transition-transform ${alertsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {alertsExpanded && (
                <div className="space-y-1.5">
                  {urgentAlerts.map((a: any, i: number) => (
                    <div key={`u-${i}`} className="text-xs p-2.5 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      {a.message}
                    </div>
                  ))}
                  {warningAlerts.map((a: any, i: number) => (
                    <div key={`w-${i}`} className="text-xs p-2.5 rounded-xl bg-amber-50 text-amber-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      {a.message}
                    </div>
                  ))}
                  {infoAlerts.map((a: any, i: number) => (
                    <div key={`i-${i}`} className="text-xs p-2.5 rounded-xl bg-blue-50 text-blue-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      {a.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
              <div className="bg-[#303030] rounded-xl p-3 text-center">
                <div className="text-xl font-semibold text-white">{stats.active}</div>
                <div className="text-[10px] text-white/50">Active</div>
              </div>
              <div className="bg-[#303030] rounded-xl p-3 text-center">
                <div className="text-xl font-semibold text-emerald-400">{stats.graduated}</div>
                <div className="text-[10px] text-white/50">Graduated</div>
              </div>
              <div className="bg-[#303030] rounded-xl p-3 text-center">
                <div className="text-xl font-semibold text-white">{stats.graduationRate}%</div>
                <div className="text-[10px] text-white/50">Rate</div>
              </div>
              <div className={`rounded-xl p-3 text-center ${stats.notContacted > 0 ? "bg-orange-500" : "bg-[#303030]"}`}>
                <div className="text-xl font-semibold text-white">{stats.notContacted}</div>
                <div className="text-[10px] text-white/70">Pending</div>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-1 bg-white rounded-full p-0.5 border border-[#e8e6e3]">
              <button
                id="view-kanban"
                onClick={() => setViewMode("kanban")}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${viewMode === "kanban" ? "bg-[#303030] text-white" : "text-[#6b6864]"}`}
              >
                Kanban
              </button>
              <button
                id="view-list"
                onClick={() => setViewMode("list")}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${viewMode === "list" ? "bg-[#303030] text-white" : "text-[#6b6864]"}`}
              >
                List
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {stats && (
                <div className="text-xs text-[#9a9793]">
                  W1: {stats.week1} • W2: {stats.week2} • W3: {stats.week3} • W4: {stats.week4}
                </div>
              )}
              <button
                id="share-whatsapp"
                onClick={handleShareReport}
                className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm font-medium"
              >
                💬 WhatsApp Report
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm text-[#9a9793]">Loading your follow-ups...</div>
            </div>
          )}

          {/* Kanban View */}
          {!loading && viewMode === "kanban" && (
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {[
                { week: 1, label: "Week 1", accent: "border-blue-400", headerBg: "bg-blue-50/70", emptyText: "No new assignments" },
                { week: 2, label: "Week 2", accent: "border-indigo-400", headerBg: "bg-indigo-50/70", emptyText: "No visitors in week 2" },
                { week: 3, label: "Week 3", accent: "border-amber-400", headerBg: "bg-amber-50/70", emptyText: "No visitors in week 3" },
                { week: 4, label: "Week 4 · Final", accent: "border-red-400", headerBg: "bg-red-50/70", emptyText: "No visitors in final week" },
              ].map((col) => {
                const items = dashboard?.byWeek?.[col.week as 1 | 2 | 3 | 4] ?? [];
                return (
                  <div
                    key={col.week}
                    className={`flex-shrink-0 min-w-[280px] sm:flex-1 rounded-2xl border-t-4 ${col.accent} bg-white overflow-hidden`}
                  >
                    {/* Column header */}
                    <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between`}>
                      <span className="text-sm font-medium text-[#3d3a36]">{col.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-[#6b6864] font-medium">{items.length}</span>
                    </div>

                    {/* Column body */}
                    <div className="p-3 space-y-2 min-h-[200px]">
                      {items.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#9a9793]">
                          {col.emptyText}
                        </div>
                      ) : (
                        items.map((fu: any) => (
                          <VisitorCard key={fu._id} fu={fu} compact />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {!loading && viewMode === "list" && (
            <div className="space-y-3">
              {(dashboard?.all ?? []).length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-3xl mb-3">🎉</div>
                  <div className="text-sm text-[#6b6864]">No active follow-ups</div>
                  <div className="text-xs text-[#9a9793] mt-1">Check back when visitors are assigned to you</div>
                </div>
              ) : (
                (dashboard?.all ?? []).map((fu: any) => (
                  <div key={fu._id} className="relative">
                    {fu.weekNumber >= 4 && (
                      <div className="absolute -top-1 -right-1 text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-medium z-10 shadow-sm">
                        🔥 Final week
                      </div>
                    )}
                    <VisitorCard fu={fu} />
                  </div>
                ))
              )}
            </div>
          )}
        </main>

        {/* Add Log Modal */}
        {logModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div
              className="w-full max-w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ backgroundColor: "#faf9f7" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-[#3d3a36]">Add Log</div>
                  <div className="text-xs text-[#9a9793]">{logModal.visitorName}</div>
                </div>
                <button onClick={() => setLogModal(null)} className="text-[#9a9793] hover:text-[#3d3a36]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#9a9793] block mb-1.5">Status</label>
                  <div className="flex gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLogStatus(opt.value)}
                        className={`flex-1 text-xs py-2 rounded-xl transition-colors ${
                          logStatus === opt.value ? `${opt.bg} ${opt.text} font-medium` : "bg-[#f0ede8] text-[#9a9793]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#9a9793] block mb-1.5">Comment *</label>
                  <textarea
                    id="log-comment"
                    value={logComment}
                    onChange={(e) => setLogComment(e.target.value)}
                    placeholder="How did the call go? Any notes..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-white text-sm outline-none resize-none"
                  />
                </div>
                <button
                  id="submit-log"
                  onClick={handleAddLog}
                  disabled={!logComment.trim()}
                  className="w-full py-3 rounded-xl text-sm bg-[#303030] text-white hover:bg-[#404040] transition-colors disabled:opacity-50"
                >
                  Add Log
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request Removal Modal */}
        {removalModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div
              className="w-full max-w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: "#faf9f7" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-[#3d3a36]">Request Removal</div>
                  <div className="text-xs text-[#9a9793]">{removalModal.visitorName}</div>
                </div>
                <button onClick={() => setRemovalModal(null)} className="text-[#9a9793] hover:text-[#3d3a36]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-3">
                <textarea
                  id="removal-reason"
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Why should this visitor be removed?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-white text-sm outline-none resize-none"
                />
                <button
                  id="submit-removal"
                  onClick={handleRequestRemoval}
                  disabled={!removalReason.trim()}
                  className="w-full py-3 rounded-xl text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Journey Drawer */}
        {selectedVisitorJourney && journeyData && (
          <div className="fixed inset-0 z-50" onClick={() => setSelectedVisitorJourney(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-[#3d3a36]">{journeyData.visitor.name}</h2>
                    <PipelineBadge stage={journeyData.visitor.pipelineStage} size="sm" />
                  </div>
                  <button onClick={() => setSelectedVisitorJourney(null)} className="text-[#9a9793] hover:text-[#3d3a36] p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Contact */}
                <div className="space-y-2 mb-5 p-4 bg-[#faf9f7] rounded-xl">
                  {journeyData.visitor.contact && (
                    <a href={`tel:${journeyData.visitor.contact}`} className="flex items-center gap-2 text-sm text-amber-600 hover:underline">📱 {journeyData.visitor.contact}</a>
                  )}
                  {journeyData.visitor.residence && <div className="text-sm text-[#6b6864]">🏠 {journeyData.visitor.residence}</div>}
                  {journeyData.visitor.previousChurch && <div className="text-sm text-[#6b6864]">⛪ {journeyData.visitor.previousChurch}</div>}
                </div>

                {/* Attendance */}
                <div className="mb-5">
                  <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Attendance</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-[#3d3a36]">{journeyData.visitor.sundayCount}</div>
                      <div className="text-[10px] text-[#9a9793]">Sundays</div>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((journeyData.visitor.sundayCount / 3) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Follow-up */}
                {journeyData.followUp && (
                  <div className="mb-5">
                    <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Follow-up</h3>
                    <div className="p-4 bg-[#faf9f7] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          journeyData.followUp.status === "contacted" ? "bg-green-100 text-green-700" :
                          journeyData.followUp.status === "needs_follow_up" ? "bg-amber-100 text-amber-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>{journeyData.followUp.status.replace(/_/g, " ")}</span>
                        {journeyData.followUp.weekNumber && <WeekIndicator currentWeek={journeyData.followUp.weekNumber} showLabel />}
                      </div>
                      {journeyData.followUp.assigneeName && <div className="text-xs text-[#6b6864]">By: {journeyData.followUp.assigneeName}</div>}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {journeyData.logs && journeyData.logs.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Timeline</h3>
                    <div className="space-y-3 pl-4 border-l-2 border-[#e8e6e3]">
                      {journeyData.logs.map((log: any) => (
                        <div key={log._id} className="relative">
                          <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full ${
                            log.status === "contacted" ? "bg-green-400" : log.status === "needs_follow_up" ? "bg-amber-400" : "bg-orange-400"
                          }`} />
                          <div className="text-[10px] text-[#9a9793]">
                            {new Date(log.loggedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </div>
                          <p className="text-xs text-[#6b6864]">{log.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
