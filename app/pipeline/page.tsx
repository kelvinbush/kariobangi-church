"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PipelineBadge } from "@/components/PipelineBadge";
import { WeekIndicator } from "@/components/WeekIndicator";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Date formatter
function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDate();
  const suffix = [, "st", "nd", "rd"][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)] || "th";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}${suffix} ${months[date.getUTCMonth()]} ${y}`;
}

// Stage configuration
const STAGES = [
  { key: "new", label: "New", color: "bg-blue-500", lightBg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700" },
  { key: "assigned", label: "Assigned", color: "bg-indigo-500", lightBg: "bg-indigo-50", border: "border-indigo-400", text: "text-indigo-700" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500", lightBg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700" },
  { key: "ready", label: "Ready", color: "bg-green-500", lightBg: "bg-green-50", border: "border-green-400", text: "text-green-700" },
  { key: "dormant", label: "Dormant", color: "bg-gray-400", lightBg: "bg-gray-50", border: "border-gray-300", text: "text-gray-600" },
  { key: "dropped", label: "Dropped", color: "bg-red-500", lightBg: "bg-red-50", border: "border-red-300", text: "text-red-600" },
] as const;

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm bg-[#303030] text-white rounded-xl p-4 z-50 shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white">×</button>
    </div>
  );
}

export default function PipelinePage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  // Pipeline data
  const overview = useQuery(api.visitorPipeline.getPipelineOverview, isAuthenticated ? {} : "skip");
  const funnel = useQuery(api.visitorPipeline.getConversionFunnel, isAuthenticated ? {} : "skip");

  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [graduateModal, setGraduateModal] = useState<any | null>(null);
  const [gradDepartment, setGradDepartment] = useState("");
  const [gradStatus, setGradStatus] = useState("");
  const [gradGender, setGradGender] = useState("");
  const [selectedVisitorJourney, setSelectedVisitorJourney] = useState<Id<"visitors"> | null>(null);

  // Filtered visitor list
  const visitors = useQuery(
    api.visitorPipeline.getVisitorsByStage,
    isAuthenticated ? {
      stage: selectedStage || undefined,
      includeInactive: selectedStage === "graduated" || selectedStage === "dropped",
    } : "skip"
  );

  const protocolMembers = useQuery(api.protocolMembers.list, isAuthenticated ? { activeOnly: true } : "skip");
  const journeyData = useQuery(
    api.visitorPipeline.getVisitorJourney,
    isAuthenticated && selectedVisitorJourney ? { visitorId: selectedVisitorJourney } : "skip"
  );

  // Mutations
  const graduateMutation = useMutation(api.visitors.graduateToMember);
  const markDormantMutation = useMutation(api.visitorPipeline.markDormant);
  const dropMutation = useMutation(api.visitorPipeline.dropVisitor);
  const reactivateMutation = useMutation(api.visitorPipeline.reactivateVisitor);
  const autoArchiveMutation = useMutation(api.visitorPipeline.autoArchiveDormant);

  const handleGraduate = async () => {
    if (!graduateModal) return;
    try {
      await graduateMutation({
        visitorId: graduateModal._id,
        department: gradDepartment || undefined,
        status: gradStatus || undefined,
        gender: gradGender || undefined,
      });
      setToast(`${graduateModal.name} graduated to member!`);
      setGraduateModal(null);
      setGradDepartment("");
      setGradStatus("");
      setGradGender("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to graduate");
    }
  };

  const handleAutoArchive = async () => {
    try {
      const count = await autoArchiveMutation({});
      setToast(count > 0 ? `${count} dormant visitor${count > 1 ? "s" : ""} archived` : "No dormant visitors found");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to auto-archive");
    }
  };

  // Filter by search
  const filteredVisitors = (visitors ?? []).filter((v: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.contact?.toLowerCase().includes(q) ||
      v.residence?.toLowerCase().includes(q)
    );
  });

  const loading = overview === undefined;

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen" style={{ backgroundColor: "#f5f3ef" }}>
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between border-b border-black/5" style={{ backgroundColor: "#f5f3ef" }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-[#9a9793] hover:text-[#6b6864]">←</Link>
            <span className="text-sm tracking-wide text-[#6b6864] font-medium">Visitor Pipeline</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/follow-ups" className="text-xs px-3 py-1.5 rounded-full bg-white text-[#6b6864]">Follow-ups</Link>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
          {/* Stage Cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {/* All card */}
            <button
              id="stage-all"
              onClick={() => setSelectedStage(null)}
              className={`flex-shrink-0 rounded-2xl p-4 min-w-[120px] transition-all duration-200 border ${
                selectedStage === null ? "border-[#303030] shadow-md" : "border-transparent"
              }`}
              style={{ backgroundColor: selectedStage === null ? "#303030" : "#fff" }}
            >
              <div className={`text-2xl font-semibold mb-1 ${selectedStage === null ? "text-white" : "text-[#3d3a36]"}`}>
                {loading ? "—" : overview?.totalActive ?? 0}
              </div>
              <div className={`text-xs ${selectedStage === null ? "text-white/70" : "text-[#9a9793]"}`}>All Active</div>
            </button>
            {STAGES.map((stage) => {
              const count = overview?.stages?.[stage.key as keyof typeof overview.stages] ?? 0;
              const isSelected = selectedStage === stage.key;
              return (
                <button
                  key={stage.key}
                  id={`stage-${stage.key}`}
                  onClick={() => setSelectedStage(isSelected ? null : stage.key)}
                  className={`flex-shrink-0 rounded-2xl p-4 min-w-[120px] transition-all duration-200 border-l-4 ${stage.border} ${
                    isSelected ? "shadow-md ring-1 ring-black/10" : ""
                  }`}
                  style={{ backgroundColor: isSelected ? "#faf9f7" : "#fff" }}
                >
                  <div className="text-2xl font-semibold mb-1 text-[#3d3a36]">{loading ? "—" : count}</div>
                  <div className="text-xs text-[#9a9793]">{stage.label}</div>
                </button>
              );
            })}
          </div>

          {/* Conversion Funnel */}
          {funnel && (
            <div className="bg-[#303030] rounded-2xl p-5 mb-6">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-4">Conversion Funnel</div>
              <div className="space-y-3">
                {[
                  { label: "Total Visitors", value: funnel.totalVisitors, pct: 100, color: "bg-white/20" },
                  { label: "Followed Up", value: funnel.withFollowUp, pct: funnel.followUpRate, color: "bg-amber-400" },
                  { label: "Graduated", value: funnel.graduated, pct: funnel.graduationRate, color: "bg-emerald-400" },
                  { label: "Retained (3+ visits)", value: funnel.retained, pct: funnel.retentionRate, color: "bg-blue-400" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-white/70 flex-shrink-0">{row.label}</div>
                    <div className="flex-1 h-6 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${row.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(row.pct, 2)}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm text-white font-medium">{row.value} <span className="text-white/50 text-xs">({row.pct}%)</span></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                <span className="text-xs text-white/40">Dormant: {funnel.dormant}</span>
                <span className="text-xs text-white/40">Dropped: {funnel.dropped}</span>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9793]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="pipeline-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, contact, residence..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-sm text-[#3d3a36] placeholder-[#9a9793] outline-none focus:ring-1 focus:ring-amber-300"
              />
            </div>
            <button
              id="auto-archive-btn"
              onClick={handleAutoArchive}
              className="px-4 py-2.5 rounded-xl text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors whitespace-nowrap"
            >
              Auto-archive Dormant
            </button>
          </div>

          {/* Visitor List */}
          <div className="space-y-3">
            {visitors === undefined ? (
              <div className="py-16 text-center text-sm text-[#9a9793]">
                <div className="inline-block w-6 h-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin mb-3" />
                <div>Loading pipeline data...</div>
              </div>
            ) : filteredVisitors.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#9a9793]">
                {searchQuery ? "No visitors match your search" : selectedStage ? `No visitors in "${selectedStage}" stage` : "No active visitors"}
              </div>
            ) : (
              filteredVisitors.map((v: any) => (
                <div
                  key={v._id}
                  id={`visitor-${v._id}`}
                  className="bg-white rounded-2xl border border-[#e8e6e3] p-4 hover:shadow-md transition-all duration-200"
                >
                  {/* Top row: name + badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-[#3d3a36]">{v.name}</span>
                        <PipelineBadge stage={v.pipelineStage || "new"} size="sm" />
                        {v.visitType && v.visitType !== "regular" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            {v.visitType.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {v.contact && (
                        <a href={`tel:${v.contact}`} className="text-xs text-amber-600 hover:underline">{v.contact}</a>
                      )}
                    </div>
                    {v.followUpWeekNumber && (
                      <WeekIndicator currentWeek={v.followUpWeekNumber} showLabel />
                    )}
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="text-xs">
                      <span className="text-[#9a9793]">First visit: </span>
                      <span className="text-[#6b6864]">{formatDate(v.date)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-[#9a9793]">Sundays: </span>
                      <span className="text-[#6b6864] font-medium">{v.sundayCount ?? 0}</span>
                      {(v.sundayCount ?? 0) >= 3 && <span className="text-emerald-500 ml-1">✓</span>}
                    </div>
                    {v.lastAttendanceDate && (
                      <div className="text-xs">
                        <span className="text-[#9a9793]">Last seen: </span>
                        <span className="text-[#6b6864]">{formatDate(v.lastAttendanceDate)}</span>
                      </div>
                    )}
                    {v.followUpAssignee && (
                      <div className="text-xs">
                        <span className="text-[#9a9793]">Assignee: </span>
                        <span className="text-[#6b6864]">{v.followUpAssignee}</span>
                      </div>
                    )}
                  </div>

                  {/* Follow-up status */}
                  {v.followUpStatus && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        v.followUpStatus === "contacted" ? "bg-green-100 text-green-700" :
                        v.followUpStatus === "needs_follow_up" ? "bg-amber-100 text-amber-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {v.followUpStatus.replace(/_/g, " ")}
                      </span>
                      {v.followUpAssignedDate && (
                        <span className="text-[10px] text-[#9a9793]">since {formatDate(v.followUpAssignedDate)}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      id={`journey-${v._id}`}
                      onClick={() => setSelectedVisitorJourney(v._id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-[#f0ede8] text-[#6b6864] hover:bg-[#e8e6e3] transition-colors"
                    >
                      View Journey
                    </button>
                    {(v.pipelineStage === "ready" || (v.sundayCount ?? 0) >= 3) && v.pipelineStage !== "graduated" && (
                      <button
                        id={`graduate-${v._id}`}
                        onClick={() => setGraduateModal(v)}
                        className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                      >
                        Graduate
                      </button>
                    )}
                    {v.pipelineStage === "new" && (
                      <button
                        id={`dormant-${v._id}`}
                        onClick={async () => {
                          try {
                            await markDormantMutation({ visitorId: v._id });
                            setToast(`${v.name} marked as dormant`);
                          } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        Mark Dormant
                      </button>
                    )}
                    {(v.pipelineStage === "dormant" || v.pipelineStage === "dropped") && (
                      <button
                        id={`reactivate-${v._id}`}
                        onClick={async () => {
                          try {
                            await reactivateMutation({ visitorId: v._id });
                            setToast(`${v.name} reactivated`);
                          } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                    {v.pipelineStage !== "dropped" && v.pipelineStage !== "graduated" && (
                      <button
                        id={`drop-${v._id}`}
                        onClick={async () => {
                          try {
                            await dropMutation({ visitorId: v._id });
                            setToast(`${v.name} dropped`);
                          } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Drop
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Results count */}
          {visitors && (
            <div className="mt-4 text-center text-xs text-[#9a9793]">
              {filteredVisitors.length} visitor{filteredVisitors.length !== 1 ? "s" : ""}
              {selectedStage ? ` in "${selectedStage}"` : ""}{searchQuery ? ` matching "${searchQuery}"` : ""}
            </div>
          )}
        </main>

        {/* Graduate Modal */}
        {graduateModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <div
              className="w-full max-w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ backgroundColor: "#faf9f7" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-[#3d3a36]">Graduate to Member</div>
                  <div className="text-xs text-[#9a9793]">{graduateModal.name}</div>
                </div>
                <button onClick={() => setGraduateModal(null)} className="text-[#9a9793] hover:text-[#3d3a36]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#9a9793] block mb-1">Department (optional)</label>
                  <input
                    id="grad-department"
                    type="text"
                    value={gradDepartment}
                    onChange={(e) => setGradDepartment(e.target.value)}
                    placeholder="e.g. Worship, Ushering"
                    className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9a9793] block mb-1">Status</label>
                  <select
                    id="grad-status"
                    value={gradStatus}
                    onChange={(e) => setGradStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-white text-sm outline-none"
                  >
                    <option value="">Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Youth">Youth</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#9a9793] block mb-1">Gender</label>
                  <select
                    id="grad-gender"
                    value={gradGender}
                    onChange={(e) => setGradGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-white text-sm outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <button
                  id="confirm-graduate"
                  onClick={handleGraduate}
                  className="w-full py-3 rounded-xl text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium"
                >
                  Graduate to Member
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visitor Journey Drawer */}
        {selectedVisitorJourney && journeyData && (
          <div className="fixed inset-0 z-50" onClick={() => setSelectedVisitorJourney(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-[#3d3a36]">{journeyData.visitor.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <PipelineBadge stage={journeyData.visitor.pipelineStage} size="sm" />
                      {journeyData.visitor.visitType !== "regular" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {journeyData.visitor.visitType?.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedVisitorJourney(null)} className="text-[#9a9793] hover:text-[#3d3a36] p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-6 p-4 bg-[#faf9f7] rounded-xl">
                  {journeyData.visitor.contact && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#9a9793]">📱</span>
                      <a href={`tel:${journeyData.visitor.contact}`} className="text-amber-600 hover:underline">{journeyData.visitor.contact}</a>
                    </div>
                  )}
                  {journeyData.visitor.residence && (
                    <div className="flex items-center gap-2 text-sm text-[#6b6864]"><span className="text-[#9a9793]">🏠</span>{journeyData.visitor.residence}</div>
                  )}
                  {journeyData.visitor.previousChurch && (
                    <div className="flex items-center gap-2 text-sm text-[#6b6864]"><span className="text-[#9a9793]">⛪</span>{journeyData.visitor.previousChurch}</div>
                  )}
                  {journeyData.visitor.relationshipStatus && (
                    <div className="flex items-center gap-2 text-sm text-[#6b6864]"><span className="text-[#9a9793]">👤</span>{journeyData.visitor.relationshipStatus}</div>
                  )}
                </div>

                {/* Attendance Summary */}
                <div className="mb-6">
                  <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Attendance</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-[#3d3a36]">{journeyData.visitor.sundayCount}</div>
                      <div className="text-[10px] text-[#9a9793]">Sundays</div>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((journeyData.visitor.sundayCount / 3) * 100, 100)}%` }} />
                    </div>
                    <div className="text-xs text-[#9a9793]">{journeyData.visitor.sundayCount >= 3 ? "✅ Ready" : `${3 - journeyData.visitor.sundayCount} to go`}</div>
                  </div>
                  <div className="flex gap-2 mt-3 text-xs text-[#9a9793]">
                    <span>First: {formatDate(journeyData.visitor.date)}</span>
                    {journeyData.visitor.lastAttendanceDate && <span>• Last: {formatDate(journeyData.visitor.lastAttendanceDate)}</span>}
                  </div>
                </div>

                {/* Follow-up Info */}
                {journeyData.followUp && (
                  <div className="mb-6">
                    <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Follow-up</h3>
                    <div className="p-4 bg-[#faf9f7] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          journeyData.followUp.status === "contacted" ? "bg-green-100 text-green-700" :
                          journeyData.followUp.status === "needs_follow_up" ? "bg-amber-100 text-amber-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {journeyData.followUp.status.replace(/_/g, " ")}
                        </span>
                        {journeyData.followUp.weekNumber && (
                          <WeekIndicator currentWeek={journeyData.followUp.weekNumber} showLabel />
                        )}
                      </div>
                      {journeyData.followUp.assigneeName && (
                        <div className="text-xs text-[#6b6864]">Assigned to: <strong>{journeyData.followUp.assigneeName}</strong></div>
                      )}
                      {journeyData.followUp.assignedDate && (
                        <div className="text-xs text-[#9a9793]">Since: {formatDate(journeyData.followUp.assignedDate)}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Follow-up Logs Timeline */}
                {journeyData.logs && journeyData.logs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Follow-up Timeline</h3>
                    <div className="space-y-3 relative pl-4 border-l-2 border-[#e8e6e3]">
                      {journeyData.logs.map((log: any) => (
                        <div key={log._id} className="relative">
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                            log.status === "contacted" ? "bg-green-400" :
                            log.status === "needs_follow_up" ? "bg-amber-400" :
                            "bg-orange-400"
                          }`} />
                          <div className="text-[10px] text-[#9a9793] mb-0.5">
                            {new Date(log.loggedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            log.status === "contacted" ? "bg-green-100 text-green-700" :
                            log.status === "needs_follow_up" ? "bg-amber-100 text-amber-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {log.status.replace(/_/g, " ")}
                          </span>
                          <p className="text-sm text-[#6b6864] mt-1">{log.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attendance Records */}
                {journeyData.attendanceRecords && journeyData.attendanceRecords.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#9a9793] mb-3">Attendance History</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {journeyData.attendanceRecords.map((a: any, i: number) => (
                        <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] ${
                          a.present ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-400"
                        }`} title={`${a.date}: ${a.present ? "Present" : "Absent"}`}>
                          {a.date.split("-")[2]}
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
