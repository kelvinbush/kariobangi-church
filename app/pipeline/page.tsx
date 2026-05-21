"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WeekIndicator } from "@/components/WeekIndicator";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// ── Helpers ──────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDate();
  const suffix = [, "st", "nd", "rd"][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)] || "th";
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day}${suffix} ${months[date.getUTCMonth()]} ${y}`;
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDate();
  const suffix = [, "st", "nd", "rd"][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)] || "th";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}${suffix} ${months[date.getUTCMonth()]}`;
}

// ── Inline SVG Icons ─────────────────────────────────────
const Icons = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  pin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  church: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 21H6a1 1 0 0 1-1-1v-8l7-7 7 7v8a1 1 0 0 1-1 1z"/><path d="M12 2v4"/><path d="M10 4h4"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  calendar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>,
  archive: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m21 8-2-3H5L3 8"/><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M10 12h4"/></svg>,
};

// ── Stage config (warm palette only) ─────────────────────
function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    new: "New", assigned: "Assigned", in_progress: "In progress",
    ready: "Ready", graduated: "Graduated", dormant: "Dormant", dropped: "Dropped",
  };
  return map[stage] || stage;
}

function stageTextColor(stage: string): string {
  const map: Record<string, string> = {
    new: "#8a7a64", assigned: "#7a6c5a", in_progress: "#9a7d4e",
    ready: "#6b8a5e", graduated: "#6b8a5e", dormant: "#999", dropped: "#b08080",
  };
  return map[stage] || "#8a7a64";
}

// ── Toast ────────────────────────────────────────────────
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm bg-[#303030] text-white/90 rounded-xl px-4 py-3 z-50 text-sm font-light flex items-center justify-between gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/40 hover:text-white/70">{Icons.close}</button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function PipelinePage() {
  const { isAuthenticated } = useConvexAuth();

  const overview = useQuery(api.visitorPipeline.getPipelineOverview, isAuthenticated ? {} : "skip");
  const funnel = useQuery(api.visitorPipeline.getConversionFunnel, isAuthenticated ? {} : "skip");

  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [graduateModal, setGraduateModal] = useState<any | null>(null);
  const [gradDepartment, setGradDepartment] = useState("");
  const [gradStatus, setGradStatus] = useState("");
  const [gradGender, setGradGender] = useState("");
  const [journeyId, setJourneyId] = useState<Id<"visitors"> | null>(null);

  // Auto-fill gender/status when opening graduate modal
  const openGraduateModal = (v: any) => {
    setGraduateModal(v);
    // Map relationshipStatus to member status
    const rs = (v.relationshipStatus || "").toLowerCase();
    if (rs.includes("married")) setGradStatus("Married");
    else if (rs.includes("single")) setGradStatus("Single");
    else if (rs.includes("youth")) setGradStatus("Youth");
    else setGradStatus("");
    // Map gender
    const g = (v.gender || "").toLowerCase();
    if (g.includes("male") && !g.includes("female")) setGradGender("male");
    else if (g.includes("female")) setGradGender("female");
    else setGradGender("");
    setGradDepartment("");
  };

  const visitors = useQuery(
    api.visitorPipeline.getVisitorsByStage,
    isAuthenticated ? {
      stage: selectedStage || undefined,
      includeInactive: selectedStage === "graduated" || selectedStage === "dropped",
    } : "skip"
  );

  const journeyData = useQuery(
    api.visitorPipeline.getVisitorJourney,
    isAuthenticated && journeyId ? { visitorId: journeyId } : "skip"
  );

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
      setToast(`${graduateModal.name} promoted to member`);
      setGraduateModal(null);
      setGradDepartment(""); setGradStatus(""); setGradGender("");
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
  };

  const handleAutoArchive = async () => {
    try {
      const count = await autoArchiveMutation({});
      setToast(count > 0 ? `${count} dormant visitor${count > 1 ? "s" : ""} archived` : "No dormant visitors to archive");
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
  };

  const filtered = (visitors ?? []).filter((v: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.name?.toLowerCase().includes(q) || v.contact?.toLowerCase().includes(q) || v.residence?.toLowerCase().includes(q);
  });

  const loading = overview === undefined;
  const stages = ["new", "assigned", "in_progress", "ready", "dormant", "dropped"] as const;

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen" style={{ backgroundColor: "#f5f3ef" }}>
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: "#f5f3ef", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#9a9793] hover:text-[#6b6864] transition-colors">{Icons.arrow}</Link>
            <span className="text-sm font-light tracking-wide text-[#6b6864]">Pipeline</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/follow-ups" className="text-xs px-3 py-1.5 rounded-full text-[#9a9793] hover:text-[#6b6864] transition-colors">Follow-ups</Link>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
          {/* ── Stage pills ────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
            <button
              id="stage-all"
              onClick={() => setSelectedStage(null)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition-colors"
              style={{
                backgroundColor: selectedStage === null ? "#3d3a36" : "transparent",
                color: selectedStage === null ? "#f5f3ef" : "#6b6864",
              }}
            >
              All
              <span className="font-medium">{loading ? "–" : overview?.totalActive ?? 0}</span>
            </button>
            {stages.map((s) => {
              const count = overview?.stages?.[s] ?? 0;
              const active = selectedStage === s;
              return (
                <button
                  key={s} id={`stage-${s}`}
                  onClick={() => setSelectedStage(active ? null : s)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: active ? "#3d3a36" : "transparent",
                    color: active ? "#f5f3ef" : "#6b6864",
                  }}
                >
                  {stageLabel(s)}
                  <span className="font-medium">{loading ? "–" : count}</span>
                </button>
              );
            })}
          </div>

          {/* ── Funnel ─────────────────────────────────────── */}
          {funnel && (
            <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: "#3d3a36" }}>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mb-4">Conversion</div>
              <div className="space-y-2.5">
                {[
                  { label: "Visitors", value: funnel.totalVisitors, pct: 100 },
                  { label: "Followed up", value: funnel.withFollowUp, pct: funnel.followUpRate },
                  { label: "Graduated", value: funnel.graduated, pct: funnel.graduationRate },
                  { label: "Retained", value: funnel.retained, pct: funnel.retentionRate },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-20 text-[11px] text-white/60">{row.label}</div>
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/35 rounded-full transition-all duration-700" style={{ width: `${Math.max(row.pct, 1)}%` }} />
                    </div>
                    <div className="w-14 text-right text-[11px] text-white/80 tabular-nums">
                      {row.value} <span className="text-white/40">{row.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Search + actions ───────────────────────────── */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4c0ba]">{Icons.search}</div>
              <input
                id="pipeline-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search visitors..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#e8e6e3] bg-transparent text-sm text-[#3d3a36] placeholder-[#c4c0ba] outline-none font-light focus:border-[#c9a87c] transition-colors"
              />
            </div>
            <button
              id="auto-archive-btn"
              onClick={handleAutoArchive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light text-[#9a9793] hover:text-[#6b6864] border border-[#e8e6e3] hover:border-[#d4d0ca] transition-colors whitespace-nowrap"
            >
              {Icons.archive}
              Archive dormant
            </button>
          </div>

          {/* ── Visitor list ───────────────────────────────── */}
          <div className="space-y-1">
            {visitors === undefined ? (
              <div className="py-20 text-center">
                <div className="inline-block w-5 h-5 border border-[#c9a87c] border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-xs font-light text-[#9a9793]">Loading</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-xs font-light text-[#9a9793]">
                {searchQuery ? "No match" : selectedStage ? `No visitors in ${stageLabel(selectedStage).toLowerCase()}` : "No visitors"}
              </div>
            ) : (
              filtered.map((v: any) => (
                <div
                  key={v._id}
                  id={`visitor-${v._id}`}
                  className="group rounded-xl px-4 py-3 bg-white transition-colors hover:bg-white/80"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                >
                  {/* Row 1: name + stage + sundays */}
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-normal text-[#3d3a36] truncate">{v.name}</span>
                      <span className="text-[10px] font-light px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: stageTextColor(v.pipelineStage), backgroundColor: `${stageTextColor(v.pipelineStage)}10` }}>
                        {stageLabel(v.pipelineStage)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#7a7875] flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 21H6a1 1 0 0 1-1-1v-8l7-7 7 7v8a1 1 0 0 1-1 1z"/><path d="M12 2v4"/><path d="M10 4h4"/></svg>
                      {v.sundayCount ?? 0} {(v.sundayCount ?? 0) === 1 ? "Sunday" : "Sundays"}
                    </div>
                  </div>

                  {/* Row 2: meta */}
                  <div className="flex items-center gap-4 text-[11px] text-[#8a8784] mb-2">
                    <span>{formatDateShort(v.date)}</span>
                    {v.followUpAssignee && <span>{v.followUpAssignee}</span>}
                    {v.lastAttendanceDate && <span>Last {formatDateShort(v.lastAttendanceDate)}</span>}
                    {v.followUpWeekNumber && (
                      <WeekIndicator currentWeek={v.followUpWeekNumber} />
                    )}
                  </div>

                  {/* Row 3: actions (show on hover / always on mobile) */}
                  <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      id={`journey-${v._id}`}
                      onClick={() => setJourneyId(v._id)}
                      className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#9a9793] hover:text-[#6b6864] hover:bg-[#e8e6e3]/60 transition-colors"
                    >
                      Details
                    </button>
                    {(v.pipelineStage === "ready" || (v.sundayCount ?? 0) >= 3) && v.pipelineStage !== "graduated" && (
                      <button
                        id={`graduate-${v._id}`}
                        onClick={() => openGraduateModal(v)}
                        className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#6b8a5e] hover:bg-[#6b8a5e]/10 transition-colors"
                      >
                        Promote to member
                      </button>
                    )}
                    {(v.pipelineStage === "dormant" || v.pipelineStage === "dropped") && (
                      <button
                        id={`reactivate-${v._id}`}
                        onClick={async () => {
                          try { await reactivateMutation({ visitorId: v._id }); setToast(`${v.name} reactivated`); }
                          catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#8a7a64] hover:bg-[#8a7a64]/10 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                    {v.pipelineStage !== "dropped" && v.pipelineStage !== "graduated" && v.pipelineStage !== "dormant" && (
                      <button
                        id={`drop-${v._id}`}
                        onClick={async () => {
                          try { await dropMutation({ visitorId: v._id }); setToast(`${v.name} dropped`); }
                          catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
                        }}
                        className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#b0ada8] hover:text-[#b08080] hover:bg-[#b08080]/10 transition-colors"
                      >
                        Drop
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {visitors && (
            <div className="mt-6 text-center text-[11px] font-light text-[#c4c0ba]">
              {filtered.length} visitor{filtered.length !== 1 ? "s" : ""}
            </div>
          )}
        </main>

        {/* ── Graduate modal ──────────────────────────────── */}
        {graduateModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setGraduateModal(null)}>
            <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 bg-white" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-normal text-[#3d3a36]">Promote to member</div>
                  <div className="text-xs text-[#8a8784]">{graduateModal.name}</div>
                </div>
                <button onClick={() => setGraduateModal(null)} className="text-[#c4c0ba] hover:text-[#9a9793]">{Icons.close}</button>
              </div>

              {/* Visitor details */}
              <div className="rounded-xl border border-[#e8e6e3] p-3 mb-4 space-y-1.5">
                {graduateModal.contact && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6864]">{Icons.phone} {graduateModal.contact}</div>
                )}
                {graduateModal.residence && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6864]">{Icons.pin} {graduateModal.residence}</div>
                )}
                {graduateModal.relationshipStatus && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6864]">{Icons.user} {graduateModal.relationshipStatus}</div>
                )}
                {graduateModal.gender && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6864]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
                    {graduateModal.gender}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-[#6b6864]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 21H6a1 1 0 0 1-1-1v-8l7-7 7 7v8a1 1 0 0 1-1 1z"/><path d="M12 2v4"/><path d="M10 4h4"/></svg>
                  {graduateModal.sundayCount ?? 0} {(graduateModal.sundayCount ?? 0) === 1 ? "Sunday" : "Sundays"} attended
                </div>
                {graduateModal.date && (
                  <div className="flex items-center gap-2 text-sm text-[#6b6864]">{Icons.calendar} First visit {formatDateShort(graduateModal.date)}</div>
                )}
              </div>

              <div className="space-y-3">
                <input id="grad-department" type="text" value={gradDepartment} onChange={(e) => setGradDepartment(e.target.value)} placeholder="Department (optional)" className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-transparent text-sm outline-none" />
                <select id="grad-status" value={gradStatus} onChange={(e) => setGradStatus(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-transparent text-sm outline-none">
                  <option value="">Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Youth">Youth</option>
                </select>
                <select id="grad-gender" value={gradGender} onChange={(e) => setGradGender(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-transparent text-sm outline-none">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <button id="confirm-graduate" onClick={handleGraduate} className="w-full py-2.5 rounded-xl text-sm bg-[#3d3a36] text-[#f5f3ef] hover:bg-[#4d4a46] transition-colors">
                  Promote to member
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Journey sidesheet ───────────────────────────── */}
        {journeyId && journeyData && (
          <div className="fixed inset-0 z-50" onClick={() => setJourneyId(null)}>
            <div className="absolute inset-0 bg-black/20" />
            <div
              className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-base font-normal text-[#3d3a36]">{journeyData.visitor.name}</h2>
                    <span className="text-[11px]" style={{ color: stageTextColor(journeyData.visitor.pipelineStage) }}>
                      {stageLabel(journeyData.visitor.pipelineStage)}
                    </span>
                  </div>
                  <button onClick={() => setJourneyId(null)} className="text-[#c4c0ba] hover:text-[#9a9793] p-1">{Icons.close}</button>
                </div>

                {/* Contact */}
                <div className="space-y-2 mb-6">
                  {journeyData.visitor.contact && (
                    <a href={`tel:${journeyData.visitor.contact}`} className="flex items-center gap-2 text-sm text-[#c9a87c] hover:underline">
                      {Icons.phone} {journeyData.visitor.contact}
                    </a>
                  )}
                  {journeyData.visitor.residence && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.pin} {journeyData.visitor.residence}</div>
                  )}
                  {journeyData.visitor.previousChurch && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.church} {journeyData.visitor.previousChurch}</div>
                  )}
                  {journeyData.visitor.relationshipStatus && (
                    <div className="flex items-center gap-2 text-sm text-[#5a5856]">{Icons.user} {journeyData.visitor.relationshipStatus}</div>
                  )}
                </div>

                {/* Attendance */}
                <div className="mb-6">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Attendance</div>
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <div className="text-xl text-[#3d3a36]">{journeyData.visitor.sundayCount}</div>
                      <div className="text-[10px] text-[#8a8784]">Sundays</div>
                    </div>
                    <div className="flex-1 h-0.5 bg-[#e8e6e3] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c9a87c] rounded-full" style={{ width: `${Math.min((journeyData.visitor.sundayCount / 3) * 100, 100)}%` }} />
                    </div>
                    <div className="text-[11px] text-[#8a8784]">
                      {journeyData.visitor.sundayCount >= 3 ? "Ready" : `${3 - journeyData.visitor.sundayCount} more`}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#8a8784]">
                    First visit: {formatDate(journeyData.visitor.date)}
                    {journeyData.visitor.lastAttendanceDate && ` · Last: ${formatDate(journeyData.visitor.lastAttendanceDate)}`}
                  </div>
                </div>

                {/* Follow-up */}
                {journeyData.followUp && (
                  <div className="mb-6">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Follow-up</div>
                    <div className="p-3 rounded-xl border border-[#e8e6e3]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: stageTextColor(journeyData.followUp.status === "contacted" ? "ready" : "in_progress") }}>
                          {journeyData.followUp.status.replace(/_/g, " ")}
                        </span>
                        {journeyData.followUp.weekNumber && <WeekIndicator currentWeek={journeyData.followUp.weekNumber} showLabel />}
                      </div>
                      {journeyData.followUp.assigneeName && (
                        <div className="text-[11px] text-[#5a5856]">Assigned to {journeyData.followUp.assigneeName}</div>
                      )}
                      {journeyData.followUp.assignedDate && (
                        <div className="text-[11px] text-[#8a8784]">Since {formatDate(journeyData.followUp.assignedDate)}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {journeyData.logs && journeyData.logs.length > 0 && (
                  <div className="mb-6">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Timeline</div>
                    <div className="space-y-3 pl-3 border-l border-[#e8e6e3]">
                      {journeyData.logs.map((log: any) => (
                        <div key={log._id} className="relative">
                          <div className="absolute -left-[7px] top-1.5 w-2 h-2 rounded-full bg-[#c9a87c]" />
                          <div className="text-[10px] text-[#8a8784] mb-0.5">
                            {formatDate(new Date(log.loggedAt).toISOString().split("T")[0])}
                          </div>
                          <div className="text-[11px] text-[#7a7875] mb-0.5">
                            {log.status.replace(/_/g, " ")}
                          </div>
                          <p className="text-sm text-[#5a5856]">{log.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attendance History */}
                {journeyData.attendanceRecords && journeyData.attendanceRecords.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#8a8784] mb-3">Attendance history</div>
                    <div className="space-y-1">
                      {journeyData.attendanceRecords.map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                          <span className="text-sm text-[#5a5856]">{formatDate(a.date)}</span>
                          <span className="text-[11px]" style={{ color: a.present ? "#6b8a5e" : "#999" }}>
                            {a.present ? "Present" : "Absent"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
