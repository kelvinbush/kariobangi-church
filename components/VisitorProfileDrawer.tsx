"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatIsoDateWithOrdinal } from "@/lib/date";
import { PipelineBadge } from "./PipelineBadge";
import { WeekIndicator } from "./WeekIndicator";
import {
  X,
  User,
  Phone,
  MapPin,
  Church,
  Calendar,
  Clock,
  MessageCircle,
  Heart,
  TrendingUp,
  UserCheck,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface VisitorJourneyData {
  visitor: {
    _id: string;
    name: string;
    contact: string | null;
    residence: string | null;
    previousChurch: string | null;
    relationshipStatus: string | null;
    gender: string | null;
    date: string;
    pipelineStage: string;
    visitType: string;
    sundayCount: number;
    lastAttendanceDate: string | null;
  };
  followUp: {
    _id: string;
    status: string;
    assignedDate: string;
    assignedToClerkId: string;
    assigneeName: string;
    lastContactDate: string | null;
    weekNumber: number;
  } | null;
  logs: Array<{
    _id: string;
    status: string;
    comment: string;
    loggedAt: number;
  }>;
  attendanceRecords: Array<{
    date: string;
    present: boolean;
  }>;
}

type Props = {
  data: VisitorJourneyData | null;
  onClose: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}${suffix} ${month} ${year}, ${time}`;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function statusColor(status: string): string {
  switch (status) {
    case "contacted":
      return "bg-blue-100 text-blue-700";
    case "not_contacted":
      return "bg-gray-100 text-gray-600";
    case "needs_follow_up":
      return "bg-amber-100 text-amber-700";
    case "graduated":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "contacted":
      return "Contacted";
    case "not_contacted":
      return "Not Contacted";
    case "needs_follow_up":
      return "Needs Follow-up";
    case "graduated":
      return "Graduated";
    default:
      return status.replace(/_/g, " ");
  }
}

// ── Component ──────────────────────────────────────────────────────────

export function VisitorProfileDrawer({ data, onClose }: Props) {
  const isOpen = data !== null;

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Attendance stats
  const totalRecords = data?.attendanceRecords.length ?? 0;
  const presentCount =
    data?.attendanceRecords.filter((r) => r.present).length ?? 0;
  const attendanceRate =
    totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md",
          "bg-white/95 backdrop-blur-xl shadow-2xl shadow-black/10",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {data && (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200/60">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium text-zinc-900 truncate">
                  {data.visitor.name}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <PipelineBadge
                    stage={data.visitor.pipelineStage}
                    size="sm"
                  />
                  <span className="text-xs text-zinc-500 capitalize">
                    {data.visitor.visitType.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-2 rounded-full hover:bg-zinc-100 active:scale-95 transition-all duration-200"
                aria-label="Close drawer"
              >
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            {/* ── Scrollable content ────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {/* Contact Info */}
              <section className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Contact Information
                </h3>
                <div className="space-y-2.5">
                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={
                      data.visitor.contact ? (
                        <a
                          href={`tel:${data.visitor.contact}`}
                          className="text-amber-700 underline decoration-amber-300 underline-offset-2"
                        >
                          {data.visitor.contact}
                        </a>
                      ) : null
                    }
                  />
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Residence"
                    value={data.visitor.residence}
                  />
                  <InfoRow
                    icon={<Church className="h-4 w-4" />}
                    label="Previous Church"
                    value={data.visitor.previousChurch}
                  />
                  <InfoRow
                    icon={<Heart className="h-4 w-4" />}
                    label="Status"
                    value={data.visitor.relationshipStatus}
                  />
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Gender"
                    value={data.visitor.gender}
                  />
                </div>
              </section>

              {/* Pipeline & Dates */}
              <section className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Pipeline Status
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="First Visit"
                    value={formatIsoDateWithOrdinal(data.visitor.date)}
                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                  />
                  <StatCard
                    label="Last Attendance"
                    value={
                      data.visitor.lastAttendanceDate
                        ? formatIsoDateWithOrdinal(
                            data.visitor.lastAttendanceDate
                          )
                        : "—"
                    }
                    icon={<Clock className="h-4 w-4 text-amber-500" />}
                  />
                </div>
              </section>

              {/* Attendance Summary */}
              <section className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Attendance Summary
                </h3>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <span className="text-2xl font-semibold text-zinc-900">
                      {data.visitor.sundayCount}
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">Sundays</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-semibold text-zinc-900">
                      {presentCount}
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">Present</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-semibold text-amber-600">
                      {attendanceRate}%
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">Rate</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>

                {/* Attendance dots */}
                {totalRecords > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {data.attendanceRecords.map((rec) => (
                      <div
                        key={rec.date}
                        title={`${formatIsoDateWithOrdinal(rec.date)} — ${rec.present ? "Present" : "Absent"}`}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full transition-all",
                          rec.present ? "bg-emerald-500" : "bg-rose-300"
                        )}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Follow-up Timeline */}
              <section className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Follow-up
                </h3>

                {data.followUp ? (
                  <div className="space-y-3">
                    {/* Week progress */}
                    <div className="flex items-center justify-between">
                      <WeekIndicator
                        currentWeek={data.followUp.weekNumber}
                        showLabel
                      />
                      <span
                        className={cn(
                          "text-xs font-medium rounded-full px-2.5 py-0.5",
                          statusColor(data.followUp.status)
                        )}
                      >
                        {statusLabel(data.followUp.status)}
                      </span>
                    </div>

                    {/* Assignee */}
                    <div className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2">
                      <UserCheck className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm text-zinc-700">
                        Assigned to{" "}
                        <span className="font-medium text-zinc-900">
                          {data.followUp.assigneeName}
                        </span>
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                      <div>
                        <span className="block text-zinc-400">Assigned</span>
                        {formatIsoDateWithOrdinal(data.followUp.assignedDate)}
                      </div>
                      {data.followUp.lastContactDate && (
                        <div>
                          <span className="block text-zinc-400">
                            Last Contact
                          </span>
                          {formatIsoDateWithOrdinal(
                            data.followUp.lastContactDate
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <TrendingUp className="h-8 w-8 text-zinc-300 mb-2" />
                    <p className="text-sm text-zinc-400">
                      No follow-up assigned yet
                    </p>
                  </div>
                )}
              </section>

              {/* Follow-up Logs */}
              <section className="px-5 py-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
                  Follow-up Logs
                </h3>

                {data.logs.length > 0 ? (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-200" />

                    <div className="space-y-4">
                      {data.logs.map((log) => (
                        <div key={log._id} className="relative pl-6">
                          {/* Timeline dot */}
                          <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400 shadow-sm" />

                          <div className="rounded-xl bg-white/60 p-3 shadow-sm shadow-black/5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={cn(
                                  "text-xs font-medium rounded-full px-2 py-0.5",
                                  statusColor(log.status)
                                )}
                              >
                                {statusLabel(log.status)}
                              </span>
                              <span className="text-[11px] text-zinc-400 shrink-0">
                                {formatTimestamp(log.loggedAt)}
                              </span>
                            </div>
                            {log.comment && (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <MessageCircle className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-zinc-700 leading-relaxed">
                                  {log.comment}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <MessageCircle className="h-8 w-8 text-zinc-300 mb-2" />
                    <p className="text-sm text-zinc-400">No log entries yet</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-zinc-400 block">{label}</span>
        <span className="text-sm text-zinc-800 truncate block">
          {value ?? <span className="text-zinc-300 italic">Not provided</span>}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/60 p-3 shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <p className="text-sm font-medium text-zinc-800">{value}</p>
    </div>
  );
}

export default VisitorProfileDrawer;
