"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Eye,
  MessageCircle,
  Phone,
  Send,
  X,
} from "lucide-react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { WeekIndicator } from "@/components/WeekIndicator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate } from "@/lib/date";

const colors = {
  bg: "#f5f3ef",
  surface: "#faf9f7",
  surfaceHover: "#f0ede8",
  border: "#e8e4de",
  text: {
    primary: "#3d3a36",
    secondary: "#6b6864",
    muted: "#9a9793",
  },
  accent: {
    amber: "#c9a87c",
    amberLight: "#e8dcc8",
    sage: "#7f9d6f",
    sageLight: "#d4e4c8",
    terracotta: "#c49a84",
    terracottaLight: "#ead8cf",
    ink: "#303030",
  },
};

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

type FollowUpRow = {
  _id: Id<"followUps">;
  visitorId: Id<"visitors">;
  visitorName: string;
  visitorContact: string | null;
  visitorResidence: string | null;
  visitorDate: string;
  status: string;
  assignedDate: string | null;
  lastContactDate: string | null;
  weekNumber: number;
  sundayCount: number;
  lastAttendance: string | null;
  removalRequested: boolean;
  logs: Array<{ _id: Id<"followUpLogs">; status: string; comment: string; loggedAt: number }>;
  visitorPipelineStage: string;
};

type DashboardData = {
  byWeek: Record<1 | 2 | 3 | 4, FollowUpRow[]>;
  all: FollowUpRow[];
  stats: {
    active: number;
    graduated: number;
    total: number;
    graduationRate: number;
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    notContacted: number;
    contacted: number;
    needsFollowUp: number;
  };
};

type ReportModalState = FollowUpRow | null;
type RemovalModalState = FollowUpRow | null;

function getUserRoles(user: ReturnType<typeof useUser>["user"]): Set<string> {
  const metadata = user?.publicMetadata as { role?: string; roles?: string[]; secondaryRole?: string } | undefined;
  const roles = new Set<string>();
  if (metadata?.role) roles.add(metadata.role);
  metadata?.roles?.forEach((role) => roles.add(role));
  if (metadata?.secondaryRole) roles.add(metadata.secondaryRole);
  return roles;
}

function DotPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="myFollowUpDotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#myFollowUpDotPattern)" />
    </svg>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-xl bg-[#303030] px-4 py-3 text-sm text-white shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

function formatMaybeDate(date: string | null | undefined) {
  return date ? formatIsoDate(date) : "-";
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status.replace(/_/g, " ");
}

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    new: "New",
    assigned: "Assigned",
    in_progress: "In progress",
    ready: "Graduation ready",
    dormant: "Dormant",
    graduated: "Graduated",
    dropped: "Dropped",
  };
  return map[stage] ?? stage;
}

async function shareWhatsApp(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "Protocol Follow-up Report", text });
      return;
    } catch {
      // Fall back to WhatsApp.
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

export default function MyFollowUpsPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const roles = getUserRoles(user);
  const isAdminOrFUAdmin = roles.has("admin") || roles.has("follow-up-admin");
  const clerkIdParam = searchParams.get("clerkId");
  const targetClerkId = clerkIdParam || user?.id;

  const dashboard = useQuery(
    api.visitorPipeline.getProtocolDashboard,
    isAuthenticated && targetClerkId ? { clerkId: targetClerkId } : "skip",
  ) as DashboardData | undefined;
  const alerts = useQuery(
    api.visitorPipeline.getAlerts,
    isAuthenticated && targetClerkId ? { clerkId: targetClerkId } : "skip",
  ) as Array<{ severity: "urgent" | "warning" | "info"; message: string }> | undefined;

  const addLogMutation = useMutation(api.followUps.addLog);
  const requestRemovalMutation = useMutation(api.followUps.requestRemoval);

  const [selectedWeek, setSelectedWeek] = useState<"all" | 1 | 2 | 3 | 4>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<ReportModalState>(null);
  const [reportStatus, setReportStatus] = useState("contacted");
  const [reportComment, setReportComment] = useState("");
  const [removalModal, setRemovalModal] = useState<RemovalModalState>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [journeyId, setJourneyId] = useState<Id<"visitors"> | null>(null);

  const journeyData = useQuery(
    api.visitorPipeline.getVisitorJourney,
    isAuthenticated && journeyId ? { visitorId: journeyId } : "skip",
  ) as any;

  const visibleRows = useMemo(() => {
    if (!dashboard) return [];
    if (selectedWeek === "all") return dashboard.all;
    return dashboard.byWeek[selectedWeek] ?? [];
  }, [dashboard, selectedWeek]);

  const readyRows = dashboard?.all.filter((row) => row.visitorPipelineStage === "ready") ?? [];
  const pendingRows = dashboard?.all.filter((row) => row.status === "not_contacted") ?? [];

  const handleShareReport = async () => {
    if (!dashboard || dashboard.all.length === 0) {
      setToast("No assignments to report");
      return;
    }
    const displayName = user?.fullName || user?.firstName || "Protocol Member";
    let report = `*IMAARA PROTOCOL FOLLOW-UP REPORT*\n`;
    report += `Follow-up team member: ${displayName}\n`;
    report += `Date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}\n`;
    report += `Active assignments: ${dashboard.stats.active}\n`;
    report += `Week breakdown: W1 ${dashboard.stats.week1} | W2 ${dashboard.stats.week2} | W3 ${dashboard.stats.week3} | W4 ${dashboard.stats.week4}\n`;
    report += `====================\n\n`;

    ([1, 2, 3, 4] as const).forEach((week) => {
      const rows = dashboard.byWeek[week] ?? [];
      report += `*WEEK ${week} (${rows.length})*\n`;
      if (rows.length === 0) {
        report += `No visitors\n\n`;
        return;
      }
      rows.forEach((row, index) => {
        const latestLog = [...row.logs].sort((a, b) => b.loggedAt - a.loggedAt)[0];
        report += `${index + 1}. *${row.visitorName}*\n`;
        if (row.visitorContact) report += `Contact: ${row.visitorContact}\n`;
        if (row.visitorResidence) report += `Residence: ${row.visitorResidence}\n`;
        report += `Stage: ${stageLabel(row.visitorPipelineStage)} / Week ${row.weekNumber}\n`;
        report += `Status: ${statusLabel(row.status)}\n`;
        if (latestLog?.comment) report += `Latest note: "${latestLog.comment}"\n`;
        report += `\n`;
      });
    });

    report += `====================\n`;
    report += `_Imaara Follow-up System_`;
    await shareWhatsApp(report);
  };

  const handleSubmitReport = async () => {
    if (!reportModal || !reportComment.trim()) {
      setToast("Add a report note");
      return;
    }
    try {
      await addLogMutation({
        followUpId: reportModal._id,
        status: reportStatus,
        comment: reportComment.trim(),
      });
      setToast(`Report added for ${reportModal.visitorName}`);
      setReportModal(null);
      setReportComment("");
      setReportStatus("contacted");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to add report");
    }
  };

  const handleRequestRemoval = async () => {
    if (!removalModal || !removalReason.trim()) {
      setToast("Add a removal reason");
      return;
    }
    try {
      await requestRemovalMutation({
        followUpId: removalModal._id,
        reason: removalReason.trim(),
      });
      setToast("Removal requested");
      setRemovalModal(null);
      setRemovalReason("");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to request removal");
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.04] px-4" style={{ backgroundColor: colors.bg }}>
          <div className="flex items-center gap-3">
            <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>My Follow-ups</span>
            {clerkIdParam && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}>Admin view</span>}
          </div>
          <div className="flex items-center gap-2">
            {isAdminOrFUAdmin && (
              <Link href="/follow-ups" className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>
                Admin
              </Link>
            )}
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6">
          {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

          {dashboard === undefined ? (
            <div className="py-20 text-center text-sm" style={{ color: colors.text.muted }}>Loading your follow-ups...</div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-5 gap-1.5 sm:gap-3">
                {[
                  { label: "Active", value: dashboard.stats.active, icon: ClipboardList },
                  { label: "Pending", value: dashboard.stats.notContacted, icon: AlertCircle },
                  { label: "Reported", value: dashboard.stats.contacted + dashboard.stats.needsFollowUp, icon: CheckCircle2 },
                  { label: "Ready", value: readyRows.length, icon: CheckCircle2 },
                  { label: "Graduated", value: dashboard.stats.graduated, icon: CheckCircle2 },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="rounded-xl p-2 sm:p-3 flex flex-col justify-between" style={{ backgroundColor: card.label === "Pending" && card.value > 0 ? colors.accent.amberLight : colors.surface }}>
                      <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1.5">
                        <span className="text-[9px] xs:text-[10px] sm:text-[11px] truncate font-medium sm:font-normal" style={{ color: colors.text.muted }}>{card.label}</span>
                        <Icon size={12} className="hidden sm:block" style={{ color: colors.text.muted }} />
                      </div>
                      <div className="text-base xs:text-lg sm:text-xl font-medium sm:font-light" style={{ color: colors.text.primary }}>{card.value}</div>
                    </div>
                  );
                })}
              </div>


              {alerts && alerts.length > 0 && (
                <div className="mb-5 space-y-2">
                  {alerts.slice(0, 3).map((alert, index) => (
                    <div key={`${alert.message}-${index}`} className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: alert.severity === "urgent" ? colors.accent.terracottaLight : colors.accent.amberLight, color: colors.text.primary }}>
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-5 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: colors.surface }}>
                <div className="flex gap-2 overflow-x-auto">
                  <button onClick={() => setSelectedWeek("all")} className="rounded-full px-3 py-1.5 text-xs whitespace-nowrap" style={{ backgroundColor: selectedWeek === "all" ? colors.accent.ink : colors.surfaceHover, color: selectedWeek === "all" ? colors.bg : colors.text.secondary }}>
                    All {dashboard.all.length}
                  </button>
                  {([1, 2, 3, 4] as const).map((week) => (
                    <button key={week} onClick={() => setSelectedWeek(week)} className="rounded-full px-3 py-1.5 text-xs whitespace-nowrap" style={{ backgroundColor: selectedWeek === week ? colors.accent.ink : colors.surfaceHover, color: selectedWeek === week ? colors.bg : colors.text.secondary }}>
                      Week {week} {dashboard.byWeek[week]?.length ?? 0}
                    </button>
                  ))}
                </div>
                <button onClick={handleShareReport} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-white" style={{ backgroundColor: colors.accent.sage }}>
                  <MessageCircle size={14} /> WhatsApp report
                </button>
              </div>

              {pendingRows.length > 0 && selectedWeek === "all" && (
                <div className="mb-5 rounded-xl p-4" style={{ backgroundColor: colors.accent.amberLight }}>
                  <div className="text-sm" style={{ color: colors.text.primary }}>{pendingRows.length} visitor{pendingRows.length === 1 ? "" : "s"} still need a first report.</div>
                </div>
              )}

              <div className="space-y-2">
                {visibleRows.length === 0 ? (
                  <div className="rounded-xl py-16 text-center" style={{ backgroundColor: colors.surface }}>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>No active follow-ups</div>
                    <div className="mt-1 text-xs" style={{ color: colors.text.muted }}>New assignments will appear here.</div>
                  </div>
                ) : (
                  visibleRows.map((row) => (
                    <FollowUpCard
                      key={row._id}
                      row={row}
                      onReport={() => {
                        setReportModal(row);
                        setReportStatus(row.status === "not_contacted" ? "contacted" : row.status);
                      }}
                      onRemoval={() => setRemovalModal(row)}
                      onJourney={() => setJourneyId(row.visitorId)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {reportModal && (
        <ReportModal
          row={reportModal}
          status={reportStatus}
          setStatus={setReportStatus}
          comment={reportComment}
          setComment={setReportComment}
          onSubmit={handleSubmitReport}
          onClose={() => setReportModal(null)}
        />
      )}

      {removalModal && (
        <RemovalModal
          row={removalModal}
          reason={removalReason}
          setReason={setRemovalReason}
          onSubmit={handleRequestRemoval}
          onClose={() => setRemovalModal(null)}
        />
      )}

      {journeyId && journeyData && (
        <JourneyDrawer data={journeyData} onClose={() => setJourneyId(null)} />
      )}
    </AuthenticatedLayout>
  );
}

function FollowUpCard({ row, onReport, onRemoval, onJourney }: { row: FollowUpRow; onReport: () => void; onRemoval: () => void; onJourney: () => void }) {
  const latestLog = [...row.logs].sort((a, b) => b.loggedAt - a.loggedAt)[0];

  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: colors.border }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium" style={{ color: colors.text.primary }}>{row.visitorName}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: row.visitorPipelineStage === "ready" ? colors.accent.sageLight : colors.accent.amberLight, color: row.visitorPipelineStage === "ready" ? colors.accent.sage : colors.text.primary }}>
              {stageLabel(row.visitorPipelineStage)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: colors.text.muted }}>
            {row.visitorContact && (
              <a href={`tel:${row.visitorContact}`} className="flex items-center gap-1 hover:underline" style={{ color: colors.accent.amber }}>
                <Phone size={12} /> {row.visitorContact}
              </a>
            )}
            {row.visitorResidence && <span>{row.visitorResidence}</span>}
            <span>First seen {formatMaybeDate(row.visitorDate)}</span>
            <span>{row.sundayCount} Sunday{row.sundayCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: colors.text.secondary }}>
            <span>Status: {statusLabel(row.status)}</span>
            {row.lastContactDate && <span>Last report: {formatMaybeDate(row.lastContactDate)}</span>}
            {latestLog?.comment && <span className="italic" style={{ color: colors.text.muted }}>"{latestLog.comment}"</span>}
            {row.removalRequested && <span style={{ color: colors.accent.terracotta }}>Removal requested</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <WeekIndicator currentWeek={row.weekNumber} />
          <button onClick={onReport} className="rounded-full px-3 py-1.5 text-xs text-white" style={{ backgroundColor: colors.accent.ink }}>
            Report
          </button>
          <button onClick={onJourney} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
            <Eye size={13} /> Details
          </button>
          {!row.removalRequested && (
            <button onClick={onRemoval} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}>
              Request removal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportModal({
  row,
  status,
  setStatus,
  comment,
  setComment,
  onSubmit,
  onClose,
}: {
  row: FollowUpRow;
  status: string;
  setStatus: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" style={{ backgroundColor: colors.surface }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium" style={{ color: colors.text.primary }}>Report follow-up</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{row.visitorName}</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button key={option.value} onClick={() => setStatus(option.value)} className="rounded-xl py-2 text-xs" style={{ backgroundColor: status === option.value ? colors.accent.amberLight : colors.bg, color: status === option.value ? colors.text.primary : colors.text.secondary }}>
                {option.label}
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="How did the follow-up go?" className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
          <button onClick={onSubmit} className="w-full rounded-xl py-3 text-sm text-white" style={{ backgroundColor: colors.accent.ink }}>
            Save report
          </button>
        </div>
      </div>
    </div>
  );
}

function RemovalModal({ row, reason, setReason, onSubmit, onClose }: { row: FollowUpRow; reason: string; setReason: (value: string) => void; onSubmit: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" style={{ backgroundColor: colors.surface }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium" style={{ color: colors.text.primary }}>Request removal</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{row.visitorName}</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Reason for removal request" className="mb-4 w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        <button onClick={onSubmit} className="w-full rounded-xl py-3 text-sm text-white" style={{ backgroundColor: colors.accent.terracotta }}>
          Submit request
        </button>
      </div>
    </div>
  );
}

function JourneyDrawer({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium" style={{ color: colors.text.primary }}>{data.visitor.name}</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{stageLabel(data.visitor.pipelineStage)}</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>

        <div className="mb-5 rounded-xl p-4" style={{ backgroundColor: colors.bg }}>
          {data.visitor.contact && <a href={`tel:${data.visitor.contact}`} className="mb-2 flex items-center gap-2 text-sm" style={{ color: colors.accent.amber }}><Phone size={14} /> {data.visitor.contact}</a>}
          {data.visitor.residence && <div className="text-sm" style={{ color: colors.text.secondary }}>{data.visitor.residence}</div>}
          {data.visitor.previousChurch && <div className="mt-1 text-sm" style={{ color: colors.text.secondary }}>{data.visitor.previousChurch}</div>}
        </div>

        <div className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>Attendance</div>
          <div className="rounded-xl border p-4" style={{ borderColor: colors.border }}>
            <div className="text-2xl font-light" style={{ color: colors.text.primary }}>{data.visitor.sundayCount}</div>
            <div className="text-xs" style={{ color: colors.text.muted }}>Sundays attended</div>
          </div>
        </div>

        {data.followUp && (
          <div className="mb-5">
            <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>Follow-up</div>
            <div className="rounded-xl border p-4" style={{ borderColor: colors.border }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm" style={{ color: colors.text.primary }}>{statusLabel(data.followUp.status)}</span>
                {data.followUp.weekNumber && <WeekIndicator currentWeek={data.followUp.weekNumber} />}
              </div>
              {data.followUp.assigneeName && <div className="text-xs" style={{ color: colors.text.muted }}>Assigned to {data.followUp.assigneeName}</div>}
            </div>
          </div>
        )}

        {data.logs && data.logs.length > 0 && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>Timeline</div>
            <div className="space-y-3 border-l pl-4" style={{ borderColor: colors.border }}>
              {data.logs.map((log: any) => (
                <div key={log._id}>
                  <div className="text-[11px]" style={{ color: colors.text.muted }}>{new Date(log.loggedAt).toLocaleDateString("en-GB")}</div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>{statusLabel(log.status)}</div>
                  <p className="text-sm" style={{ color: colors.text.primary }}>{log.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
