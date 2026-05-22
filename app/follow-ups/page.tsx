"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Phone,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { WeekIndicator } from "@/components/WeekIndicator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate, getLastSunday } from "@/lib/date";

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

const STAGE_TONES: Record<string, { bg: string; text: string }> = {
  eligible: { bg: "#f0ede8", text: "#6b6864" },
  week1: { bg: "#e8dcc8", text: "#7a5f38" },
  week2: { bg: "#ece1d7", text: "#8a6552" },
  week3: { bg: "#e1e8d8", text: "#637c55" },
  week4: { bg: "#ead8cf", text: "#9a654e" },
  graduation_ready: { bg: "#d4e4c8", text: "#5f7f4d" },
  dormant_candidates: { bg: "#ebe9e4", text: "#77716a" },
  removal_requests: { bg: "#ead8cf", text: "#9a5f52" },
};

type WorkspaceRow = {
  followUpId: Id<"followUps"> | null;
  visitorId: Id<"visitors">;
  visitorName: string;
  visitorContact: string | null;
  visitorResidence: string | null;
  firstVisitDate: string;
  lastAttendanceDate: string | null;
  assignedDate: string | null;
  assignedToClerkId: string | null;
  assigneeName: string | null;
  assigneePhone: string | null;
  assigneeAccessMode: string | null;
  status: string | null;
  statusLabel: string;
  pipelineStage: string;
  pipelineStageLabel: string;
  weekNumber: number | null;
  sundayCount: number;
  lastContactDate: string | null;
  latestNote: string | null;
  removalRequested: boolean;
  removalReason: string | null;
  daysAssigned: number | null;
  daysSinceLastVisit?: number;
  dormantReason?: string;
};

type WorkspaceBucket = {
  key: string;
  label: string;
  rows: WorkspaceRow[];
};

type TeamMember = {
  _id: Id<"protocolMembers">;
  clerkId: string;
  displayName: string;
  active: boolean;
  accessMode: string;
  phone: string | null;
  activeAssignments: number;
  pendingReports: number;
  readyCount: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
};

type WorkspaceData = {
  referenceDate: string;
  generatedAt: number;
  buckets: WorkspaceBucket[];
  stats: {
    activeAssignments: number;
    eligible: number;
    pendingReports: number;
    graduationReady: number;
    dormantCandidates: number;
    removalRequests: number;
    graduatedAllTime: number;
  };
  team: TeamMember[];
};

type ReportModalState = {
  followUpId: Id<"followUps">;
  visitorName: string;
  reportedByClerkId: string;
  reporterName: string;
};

type GraduateModalState = {
  visitorId: Id<"visitors">;
  visitorName: string;
  visitorContact: string | null;
  visitorResidence: string | null;
  sundayCount: number;
};

function DotPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="followUpDotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#followUpDotPattern)" />
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

function getUserRoles(user: ReturnType<typeof useUser>["user"]): Set<string> {
  const metadata = user?.publicMetadata as { role?: string; roles?: string[]; secondaryRole?: string } | undefined;
  const roles = new Set<string>();
  if (metadata?.role) roles.add(metadata.role);
  metadata?.roles?.forEach((role) => roles.add(role));
  if (metadata?.secondaryRole) roles.add(metadata.secondaryRole);
  return roles;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obfuscateContact(contact?: string | null): string {
  if (!contact) return "-";
  const cleaned = contact.trim();
  if (cleaned.length < 5) return cleaned;
  if (cleaned.startsWith("+")) {
    if (cleaned.length >= 9) {
      const firstPart = cleaned.slice(0, 5); // "+2547"
      const lastPart = cleaned.slice(-3);   // "678"
      const middleLength = cleaned.length - 8;
      const stars = "*".repeat(Math.max(3, middleLength));
      return `${firstPart}${stars}${lastPart}`;
    }
  }
  if (cleaned.length >= 7) {
    const firstPart = cleaned.slice(0, 2); // "07"
    const lastPart = cleaned.slice(-3);   // "930"
    const middleLength = cleaned.length - 5;
    const stars = "*".repeat(Math.max(3, middleLength));
    return `${firstPart}${stars}${lastPart}`;
  }
  const firstPart = cleaned.slice(0, 1);
  const lastPart = cleaned.slice(-1);
  const stars = "*".repeat(Math.max(2, cleaned.length - 2));
  return `${firstPart}${stars}${lastPart}`;
}

function formatMaybeDate(date: string | null | undefined) {
  return date ? formatIsoDate(date) : "-";
}

function openPrintDocument(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

function buildWeeklyPdf(workspace: WorkspaceData, title: string, buckets: WorkspaceBucket[]) {
  const rows = buckets
    .map((bucket) => {
      const body = bucket.rows.length
        ? bucket.rows
            .map(
              (row) => `
                <tr>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36;">
                    <strong>${escapeHtml(row.visitorName)}</strong><br/>
                    <span style="color: #6b6864; font-size: 10px;">${escapeHtml(obfuscateContact(row.visitorContact))}</span>
                  </td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${escapeHtml(row.visitorResidence || "-")}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${escapeHtml(row.assigneeName || "Unassigned")}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #3d3a36;">${row.weekNumber ? `Week ${row.weekNumber}` : "-"}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${escapeHtml(row.statusLabel)}</td>
                  <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864; max-width: 200px; word-wrap: break-word;">${escapeHtml(row.latestNote || row.removalReason || "-")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="6" style="padding: 15px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #9a9793;">No visitors</td></tr>`;

      return `
        <section>
          <h2>
            <span>${escapeHtml(bucket.label)}</span>
            <span class="section-count">Count: ${bucket.rows.length}</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Residence</th>
                <th>Assignee</th>
                <th style="text-align: center;">Week</th>
                <th style="text-align: center;">Status</th>
                <th>Latest Note</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #3d3a36;
            margin: 30px;
            background-color: #fff;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .logo-cell-left {
            width: 70px;
            text-align: left;
            vertical-align: middle;
          }
          .logo-cell-right {
            width: 70px;
            text-align: right;
            vertical-align: middle;
          }
          .logo-img {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }
          .title-cell-center {
            text-align: center;
            vertical-align: middle;
            padding: 0 10px;
          }
          .title-ministry {
            font-size: 14px;
            font-weight: 700;
            color: #3d3a36;
            margin: 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .title-altar {
            font-size: 11px;
            font-weight: 600;
            color: #c9a87c;
            margin: 3px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .title-report {
            font-size: 11px;
            font-weight: 500;
            color: #5d5a56;
            margin: 3px 0 0 0;
          }
          .title-date {
            font-size: 10px;
            color: #8b8884;
            margin: 2px 0 0 0;
          }
          .stats-row {
            display: flex;
            justify-content: space-between;
            border: 1px solid #e8e6e3;
            background-color: #faf9f7;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 10px;
            margin-bottom: 20px;
          }
          section {
            margin: 22px 0;
            page-break-inside: avoid;
          }
          h2 {
            font-size: 13px;
            color: #3d3a36;
            margin: 16px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #c9a87c;
            display: flex;
            justify-content: space-between;
          }
          .section-count {
            color: #8b8884;
            font-weight: normal;
            font-size: 11px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th {
            background-color: #3d3a36;
            color: #fff;
            padding: 5px 8px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e8e6e3;
            color: #9a9793;
            font-size: 10px;
            text-align: center;
          }
          @media print {
            body {
              margin: 15px;
            }
            tr {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body onload="window.print()">
        <table class="header-table">
          <tr>
            <td class="logo-cell-left">
              <img src="/ministry-logo.png" class="logo-img" alt="Ministry Logo" />
            </td>
            <td class="title-cell-center">
              <div class="title-ministry">THE MINISTRY OF REPENTANCE AND HOLINESS</div>
              <div class="title-altar">The Imaara Mall 3rd Floor — Follow-up Department</div>
              <div class="title-report">${escapeHtml(title)}</div>
              <div class="title-date">Week Ending: ${escapeHtml(formatIsoDate(workspace.referenceDate))} | Generated: ${escapeHtml(new Date(workspace.generatedAt).toLocaleString("en-GB"))}</div>
            </td>
            <td class="logo-cell-right">
              <img src="/convex.svg" class="logo-img" alt="Church Logo" />
            </td>
          </tr>
        </table>

        <div class="stats-row">
          <span><strong>Active Assignments:</strong> ${workspace.stats.activeAssignments}</span>
          <span><strong>Eligible Unassigned:</strong> ${workspace.stats.eligible}</span>
          <span><strong>Pending Reports:</strong> ${workspace.stats.pendingReports}</span>
          <span><strong>Graduation Ready:</strong> ${workspace.stats.graduationReady}</span>
          <span><strong>Dormant Candidates:</strong> ${workspace.stats.dormantCandidates}</span>
        </div>

        ${rows}

        <div class="footer">Imaara Church Management System</div>
      </body>
    </html>
  `;
}

function buildWhatsAppReport(workspace: WorkspaceData, title: string, buckets: WorkspaceBucket[]) {
  let report = `*${title}*\n`;
  report += `Week ending: ${formatIsoDate(workspace.referenceDate)}\n`;
  report += `Active: ${workspace.stats.activeAssignments} | Eligible: ${workspace.stats.eligible} | Pending: ${workspace.stats.pendingReports} | Ready: ${workspace.stats.graduationReady}\n`;
  report += `====================\n\n`;

  buckets.forEach((bucket) => {
    report += `*${bucket.label.toUpperCase()} (${bucket.rows.length})*\n`;
    if (bucket.rows.length === 0) {
      report += `No visitors\n\n`;
      return;
    }
    bucket.rows.forEach((row, index) => {
      report += `${index + 1}. *${row.visitorName}*\n`;
      if (row.visitorContact) report += `Contact: ${row.visitorContact}\n`;
      if (row.visitorResidence) report += `Residence: ${row.visitorResidence}\n`;
      report += `Stage: ${bucket.label}${row.weekNumber ? ` / Week ${row.weekNumber}` : ""}\n`;
      report += `Assignee: ${row.assigneeName || "Unassigned"}\n`;
      report += `Status: ${row.statusLabel}\n`;
      if (row.latestNote) report += `Latest note: "${row.latestNote}"\n`;
      if (row.removalReason) report += `Removal reason: ${row.removalReason}\n`;
      report += `\n`;
    });
  });

  report += `====================\n`;
  report += `_Imaara Follow-up System_`;
  return report;
}

function buildAssigneeWhatsAppReport(workspace: WorkspaceData) {
  let report = `*IMAARA FOLLOW-UP ASSIGNMENTS (BY ASSIGNEE)*\n`;
  report += `Week ending: ${formatIsoDate(workspace.referenceDate)}\n`;
  report += `====================\n\n`;

  const allAssigned = workspace.buckets.flatMap((b) => b.rows).filter((r) => r.followUpId);

  const grouped: { [assignee: string]: typeof allAssigned } = {};
  allAssigned.forEach((row) => {
    const assignee = row.assigneeName || "Unassigned";
    if (!grouped[assignee]) {
      grouped[assignee] = [];
    }
    grouped[assignee].push(row);
  });

  const assignees = Object.keys(grouped).sort();

  if (assignees.length === 0) {
    report += `No active assignments.\n`;
  } else {
    assignees.forEach((assignee) => {
      const rows = grouped[assignee];
      report += `👤 *${assignee.toUpperCase()} (${rows.length})*\n`;
      rows.forEach((row, idx) => {
        const contactPart = row.visitorContact ? ` (${row.visitorContact})` : "";
        const stagePart = row.weekNumber ? ` [Week ${row.weekNumber}]` : ` [${row.pipelineStageLabel}]`;
        report += `${idx + 1}. *${row.visitorName}*${contactPart}${stagePart}\n`;
      });
      report += `\n`;
    });
  }

  report += `====================\n`;
  report += `_Imaara Follow-up System_`;
  return report;
}


async function shareWhatsApp(text: string, title: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      // Fall back to WhatsApp if native share is cancelled or unavailable.
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

export default function FollowUpsAdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const userRoles = getUserRoles(user);
  const canAccess = userRoles.has("admin") || userRoles.has("follow-up-admin");
  const isAdmin = userRoles.has("admin");

  const [referenceDate, setReferenceDate] = useState(getLastSunday());
  const [selectedStage, setSelectedStage] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<Set<Id<"visitors">>>(new Set());
  const [reassignFollowUpId, setReassignFollowUpId] = useState<Id<"followUps"> | null>(null);
  const [manualReport, setManualReport] = useState<ReportModalState | null>(null);
  const [manualStatus, setManualStatus] = useState("contacted");
  const [manualComment, setManualComment] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamMember | null>(null);
  const [graduateModal, setGraduateModal] = useState<GraduateModalState | null>(null);
  const [promoteType, setPromoteType] = useState<"member" | "kid">("member");
  const [gradDepartment, setGradDepartment] = useState("");
  const [gradStatus, setGradStatus] = useState("");
  const [gradGender, setGradGender] = useState("");
  const [gradAge, setGradAge] = useState("");
  const [newProtocolClerkId, setNewProtocolClerkId] = useState("");
  const [newProtocolDisplayName, setNewProtocolDisplayName] = useState("");
  const [isWhatsAppOnly, setIsWhatsAppOnly] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const workspace = useQuery(
    api.followUps.adminWorkspace,
    isAuthenticated && canAccess ? { referenceDate } : "skip",
  ) as WorkspaceData | undefined;

  const assignMutation = useMutation(api.followUps.assign);
  const reassignMutation = useMutation(api.followUps.reassign);
  const addManualLogMutation = useMutation(api.followUps.addManualLog);
  const requestReadyMutation = useMutation(api.followUps.markReadyForGraduation);
  const removeVisitorMutation = useMutation(api.followUps.removeVisitorAndArchiveFollowUp);
  const markDormantMutation = useMutation(api.visitorPipeline.markDormant);
  const graduateToMemberMutation = useMutation(api.visitors.graduateToMember);
  const graduateToKidMutation = useMutation(api.visitors.graduateToKid);
  const addProtocolMutation = useMutation(api.protocolMembers.add);
  const updateProtocolMutation = useMutation(api.protocolMembers.update);

  const activeTeam = useMemo(() => workspace?.team.filter((member) => member.active) ?? [], [workspace]);
  const buckets = workspace?.buckets ?? [];
  const bucketByKey = useMemo(() => new Map(buckets.map((bucket) => [bucket.key, bucket])), [buckets]);
  const eligibleRows = bucketByKey.get("eligible")?.rows ?? [];
  const readyBucket = bucketByKey.get("graduation_ready");
  const allAssignedRows = useMemo(
    () => buckets.flatMap((bucket) => bucket.rows).filter((row) => row.followUpId),
    [buckets],
  );
  const selectedTeamRows = selectedTeam
    ? allAssignedRows.filter((row) => row.assignedToClerkId === selectedTeam.clerkId)
    : [];

  const filteredBuckets = useMemo(() => {
    const source = selectedStage === "all" ? buckets : buckets.filter((bucket) => bucket.key === selectedStage);
    if (!searchQuery.trim()) return source;
    const query = searchQuery.toLowerCase();
    return source
      .map((bucket) => ({
        ...bucket,
        rows: bucket.rows.filter((row) =>
          [row.visitorName, row.visitorContact, row.visitorResidence, row.assigneeName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)),
        ),
      }))
      .filter((bucket) => bucket.rows.length > 0);
  }, [buckets, searchQuery, selectedStage]);

  const getProtocolOptions = () => {
    const currentUserOption =
      user?.id && !activeTeam.some((member) => member.clerkId === user.id)
        ? [{ clerkId: user.id, displayName: (user.fullName ?? "Me").trim() || "Me", active: true }]
        : [];
    return [...currentUserOption, ...activeTeam];
  };

  const handleExportWeeklyPdf = () => {
    if (!workspace) return;
    const ok = openPrintDocument(buildWeeklyPdf(workspace, "Weekly Follow-up Assignments", workspace.buckets));
    if (!ok) setToast("Please allow popups to export PDF");
  };

  const handleExportReadyPdf = () => {
    if (!workspace || !readyBucket) return;
    const ok = openPrintDocument(buildWeeklyPdf(workspace, "Graduation Ready List", [readyBucket]));
    if (!ok) setToast("Please allow popups to export PDF");
  };

  const handleExportWeeklyWhatsApp = async () => {
    if (!workspace) return;
    await shareWhatsApp(buildWhatsAppReport(workspace, "IMAARA WEEKLY FOLLOW-UP ASSIGNMENTS", workspace.buckets), "Weekly Follow-up Assignments");
  };

  const handleExportReadyWhatsApp = async () => {
    if (!workspace || !readyBucket) return;
    await shareWhatsApp(buildWhatsAppReport(workspace, "IMAARA GRADUATION READY LIST", [readyBucket]), "Graduation Ready List");
  };

  const handleExportAssigneeWhatsApp = async () => {
    if (!workspace) return;
    await shareWhatsApp(buildAssigneeWhatsAppReport(workspace), "Follow-up Assignments by Assignee");
  };


  const openAssignDrawer = (visitorId?: Id<"visitors">) => {
    if (visitorId) setSelectedVisitorIds(new Set([visitorId]));
    setAssignmentOpen(true);
  };

  const handleAssignSelected = async () => {
    if (!selectedAssignee || selectedVisitorIds.size === 0) {
      setToast("Choose an assignee and at least one visitor");
      return;
    }
    try {
      const visitorIds = Array.from(selectedVisitorIds);
      await Promise.all(visitorIds.map((visitorId) => assignMutation({ visitorId, assignedToClerkId: selectedAssignee })));
      setToast(`Assigned ${visitorIds.length} visitor${visitorIds.length === 1 ? "" : "s"}`);
      setSelectedVisitorIds(new Set());
      setAssignmentOpen(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to assign visitors");
    }
  };

  const handleReassignTo = async (assignedToClerkId: string) => {
    if (!reassignFollowUpId) return;
    try {
      await reassignMutation({ followUpId: reassignFollowUpId, assignedToClerkId });
      setToast("Follow-up reassigned");
      setReassignFollowUpId(null);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to reassign");
    }
  };

  const handleManualReport = async () => {
    if (!manualReport || !manualComment.trim()) {
      setToast("Add a report note");
      return;
    }
    try {
      await addManualLogMutation({
        followUpId: manualReport.followUpId,
        reportedByClerkId: manualReport.reportedByClerkId,
        status: manualStatus,
        comment: manualComment.trim(),
      });
      setToast(`Report recorded for ${manualReport.visitorName}`);
      setManualReport(null);
      setManualComment("");
      setManualStatus("contacted");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to record report");
    }
  };

  const handleMarkDormant = async (visitorId: Id<"visitors">, visitorName: string) => {
    try {
      await markDormantMutation({ visitorId });
      setToast(`${visitorName} marked dormant`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to mark dormant");
    }
  };

  const handleMarkReady = async (followUpId: Id<"followUps">, visitorName: string) => {
    try {
      await requestReadyMutation({ followUpId });
      setToast(`${visitorName} moved to graduation-ready`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to mark ready");
    }
  };

  const handleApproveRemoval = async (row: WorkspaceRow) => {
    if (!isAdmin || !row.followUpId) return;
    try {
      await removeVisitorMutation({ visitorId: row.visitorId, followUpId: row.followUpId });
      setToast(`${row.visitorName} removed and archived`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to remove visitor");
    }
  };

  const handleGraduate = async () => {
    if (!graduateModal) return;
    try {
      if (promoteType === "kid") {
        await graduateToKidMutation({
          visitorId: graduateModal.visitorId,
          age: gradAge ? Number.parseInt(gradAge, 10) : undefined,
        });
        setToast(`${graduateModal.visitorName} promoted to kids`);
      } else {
        await graduateToMemberMutation({
          visitorId: graduateModal.visitorId,
          department: gradDepartment || undefined,
          status: gradStatus || undefined,
          gender: gradGender || undefined,
        });
        setToast(`${graduateModal.visitorName} promoted to members`);
      }
      setGraduateModal(null);
      setGradDepartment("");
      setGradStatus("");
      setGradGender("");
      setGradAge("");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to promote visitor");
    }
  };

  const handleAddProtocol = async () => {
    const phone = whatsappPhone.trim();
    const clerkId = isWhatsAppOnly ? `wa:phone:${phone}` : newProtocolClerkId.trim();
    if (!clerkId || !newProtocolDisplayName.trim()) {
      setToast(isWhatsAppOnly ? "Enter phone and display name" : "Enter Clerk ID and display name");
      return;
    }
    try {
      await addProtocolMutation({
        clerkId,
        displayName: newProtocolDisplayName.trim(),
        accessMode: isWhatsAppOnly ? "whatsapp_only" : "system",
        phone: isWhatsAppOnly ? phone : null,
      });
      setToast("Protocol member added");
      setNewProtocolClerkId("");
      setNewProtocolDisplayName("");
      setWhatsappPhone("");
      setIsWhatsAppOnly(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to add protocol member");
    }
  };

  const handleToggleProtocolActive = async (member: TeamMember) => {
    try {
      await updateProtocolMutation({ id: member._id, active: !member.active });
      setToast(member.active ? "Protocol member deactivated" : "Protocol member activated");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to update protocol member");
    }
  };

  if (typeof window !== "undefined" && isAuthenticated && user && !canAccess) {
    return (
      <AuthenticatedLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: colors.bg }}>
          <div className="text-center text-sm" style={{ color: colors.text.secondary }}>
            You need follow-up-admin or admin role to access this page.
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.04] px-4" style={{ backgroundColor: colors.bg }}>
          <div className="flex items-center gap-3">
            <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>Follow-up Pipeline</span>
            <span className="hidden rounded-full px-2 py-0.5 text-[11px] sm:inline-flex" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>
              Week ending {formatMaybeDate(referenceDate)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/follow-ups/my" className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>
              My list
            </Link>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6">
          {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

          <div className="mb-4 grid grid-cols-5 gap-1.5 sm:gap-3">
            {[
              { label: "Active", value: workspace?.stats.activeAssignments ?? 0, icon: ClipboardList },
              { label: "Eligible", value: workspace?.stats.eligible ?? 0, icon: UserPlus },
              { label: "Pending", value: workspace?.stats.pendingReports ?? 0, icon: CalendarDays },
              { label: "Ready", value: workspace?.stats.graduationReady ?? 0, icon: CheckCircle2 },
              { label: "Dormant", value: workspace?.stats.dormantCandidates ?? 0, icon: Archive },
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


          <div className="mb-5 flex flex-col gap-3 rounded-xl p-4" style={{ backgroundColor: colors.surface }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: colors.border, color: colors.text.secondary }}>
                  <CalendarDays size={15} />
                  <input
                    type="date"
                    value={referenceDate}
                    onChange={(event) => setReferenceDate(event.target.value)}
                    className="bg-transparent outline-none"
                  />
                </label>
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.muted }} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search visitor, phone, residence, assignee"
                    className="w-full rounded-xl border bg-transparent py-2 pl-9 pr-3 text-sm outline-none"
                    style={{ borderColor: colors.border, color: colors.text.primary }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openAssignDrawer()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-white" style={{ backgroundColor: colors.accent.ink }}>
                  <UserPlus size={14} /> Assign
                </button>
                <button onClick={handleExportWeeklyPdf} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                  <FileText size={14} /> Weekly PDF
                </button>
                <button onClick={handleExportWeeklyWhatsApp} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>
                  <MessageCircle size={14} /> Weekly WhatsApp
                </button>
                <button onClick={handleExportAssigneeWhatsApp} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>
                  <MessageCircle size={14} /> Assignee WhatsApp
                </button>

                <button onClick={handleExportReadyPdf} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}>
                  <Download size={14} /> Graduation PDF
                </button>
                <button onClick={handleExportReadyWhatsApp} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>
                  <Send size={14} /> Graduation WhatsApp
                </button>
              </div>
            </div>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedStage("all")}
              className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs whitespace-nowrap"
              style={{ backgroundColor: selectedStage === "all" ? colors.accent.ink : "transparent", color: selectedStage === "all" ? colors.bg : colors.text.secondary }}
            >
              All <span>{buckets.reduce((sum, bucket) => sum + bucket.rows.length, 0)}</span>
            </button>
            {buckets.map((bucket) => (
              <button
                key={bucket.key}
                onClick={() => setSelectedStage(bucket.key)}
                className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs whitespace-nowrap"
                style={{ backgroundColor: selectedStage === bucket.key ? colors.accent.ink : "transparent", color: selectedStage === bucket.key ? colors.bg : colors.text.secondary }}
              >
                {bucket.label} <span>{bucket.rows.length}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedStage("team")}
              className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs whitespace-nowrap"
              style={{ backgroundColor: selectedStage === "team" ? colors.accent.ink : "transparent", color: selectedStage === "team" ? colors.bg : colors.text.secondary }}
            >
              Team <span>{workspace?.team.length ?? 0}</span>
            </button>
          </div>

          {workspace === undefined ? (
            <div className="py-20 text-center text-sm" style={{ color: colors.text.muted }}>Loading follow-up pipeline...</div>
          ) : selectedStage === "team" ? (
            <TeamView
              team={workspace.team}
              onSelect={setSelectedTeam}
              onToggleActive={handleToggleProtocolActive}
              onAddProtocol={handleAddProtocol}
              newProtocolClerkId={newProtocolClerkId}
              setNewProtocolClerkId={setNewProtocolClerkId}
              newProtocolDisplayName={newProtocolDisplayName}
              setNewProtocolDisplayName={setNewProtocolDisplayName}
              isWhatsAppOnly={isWhatsAppOnly}
              setIsWhatsAppOnly={setIsWhatsAppOnly}
              whatsappPhone={whatsappPhone}
              setWhatsappPhone={setWhatsappPhone}
            />
          ) : (
            <div className="space-y-5">
              {filteredBuckets.length === 0 ? (
                <div className="rounded-xl py-16 text-center text-sm" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>
                  No visitors match this view
                </div>
              ) : (
                filteredBuckets.map((bucket) => (
                  <section key={bucket.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2.5 py-1 text-xs" style={{ backgroundColor: STAGE_TONES[bucket.key]?.bg, color: STAGE_TONES[bucket.key]?.text }}>
                          {bucket.label}
                        </span>
                        <span className="text-xs" style={{ color: colors.text.muted }}>{bucket.rows.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {bucket.rows.map((row) => (
                        <PipelineRow
                          key={`${bucket.key}-${row.visitorId}-${row.followUpId ?? "new"}`}
                          row={row}
                          bucketKey={bucket.key}
                          onAssign={() => openAssignDrawer(row.visitorId)}
                          onReassign={() => row.followUpId && setReassignFollowUpId(row.followUpId)}
                          onManualReport={(reportedByClerkId, reporterName) => row.followUpId && setManualReport({
                            followUpId: row.followUpId,
                            visitorName: row.visitorName,
                            reportedByClerkId,
                            reporterName,
                          })}
                          onMarkDormant={() => handleMarkDormant(row.visitorId, row.visitorName)}
                          onMarkReady={() => row.followUpId && handleMarkReady(row.followUpId, row.visitorName)}
                          onApproveRemoval={() => handleApproveRemoval(row)}
                          onGraduate={() => setGraduateModal({
                            visitorId: row.visitorId,
                            visitorName: row.visitorName,
                            visitorContact: row.visitorContact,
                            visitorResidence: row.visitorResidence,
                            sundayCount: row.sundayCount,
                          })}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {assignmentOpen && (
        <AssignmentDrawer
          rows={eligibleRows}
          protocolOptions={getProtocolOptions()}
          selectedAssignee={selectedAssignee}
          setSelectedAssignee={setSelectedAssignee}
          selectedVisitorIds={selectedVisitorIds}
          setSelectedVisitorIds={setSelectedVisitorIds}
          onSubmit={handleAssignSelected}
          onClose={() => setAssignmentOpen(false)}
        />
      )}

      {reassignFollowUpId && (
        <ChoiceDrawer
          title="Reassign follow-up"
          onClose={() => setReassignFollowUpId(null)}
          options={getProtocolOptions().map((member) => ({
            key: member.clerkId,
            label: member.displayName,
            onSelect: () => handleReassignTo(member.clerkId),
          }))}
        />
      )}

      {manualReport && (
        <ReportModal
          state={manualReport}
          status={manualStatus}
          setStatus={setManualStatus}
          comment={manualComment}
          setComment={setManualComment}
          onSubmit={handleManualReport}
          onClose={() => setManualReport(null)}
        />
      )}

      {selectedTeam && (
        <TeamDrawer
          team={selectedTeam}
          rows={selectedTeamRows}
          onClose={() => setSelectedTeam(null)}
          onReport={(row) => row.followUpId && setManualReport({
            followUpId: row.followUpId,
            visitorName: row.visitorName,
            reportedByClerkId: selectedTeam.clerkId,
            reporterName: selectedTeam.displayName,
          })}
        />
      )}

      {graduateModal && (
        <GraduateModal
          state={graduateModal}
          promoteType={promoteType}
          setPromoteType={setPromoteType}
          gradDepartment={gradDepartment}
          setGradDepartment={setGradDepartment}
          gradStatus={gradStatus}
          setGradStatus={setGradStatus}
          gradGender={gradGender}
          setGradGender={setGradGender}
          gradAge={gradAge}
          setGradAge={setGradAge}
          onSubmit={handleGraduate}
          onClose={() => setGraduateModal(null)}
        />
      )}
    </AuthenticatedLayout>
  );
}

function PipelineRow({
  row,
  bucketKey,
  onAssign,
  onReassign,
  onManualReport,
  onMarkDormant,
  onMarkReady,
  onApproveRemoval,
  onGraduate,
  isAdmin,
}: {
  row: WorkspaceRow;
  bucketKey: string;
  onAssign: () => void;
  onReassign: () => void;
  onManualReport: (reportedByClerkId: string, reporterName: string) => void;
  onMarkDormant: () => void;
  onMarkReady: () => void;
  onApproveRemoval: () => void;
  onGraduate: () => void;
  isAdmin: boolean;
}) {
  const tone = STAGE_TONES[bucketKey] ?? STAGE_TONES.eligible;
  const canRecordReport = Boolean(row.followUpId && row.assignedToClerkId && row.assigneeName);

  return (
    <div className="rounded-xl border bg-white px-4 py-3 transition-colors hover:bg-white/80" style={{ borderColor: colors.border }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium" style={{ color: colors.text.primary }}>{row.visitorName}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: tone.bg, color: tone.text }}>
              {row.weekNumber ? `Week ${row.weekNumber}` : row.pipelineStageLabel}
            </span>
            {row.assigneeAccessMode === "whatsapp_only" && (
              <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>
                WhatsApp-only
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: colors.text.muted }}>
            {row.visitorContact && (
              <a href={`tel:${row.visitorContact}`} className="flex items-center gap-1 hover:underline" style={{ color: colors.accent.amber }}>
                <Phone size={12} /> {row.visitorContact}
              </a>
            )}
            {row.visitorResidence && <span>{row.visitorResidence}</span>}
            <span>First seen {formatMaybeDate(row.firstVisitDate)}</span>
            <span>{row.sundayCount} Sunday{row.sundayCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: colors.text.secondary }}>
            <span>Assignee: {row.assigneeName || "Unassigned"}</span>
            <span>Status: {row.statusLabel}</span>
            {row.lastContactDate && <span>Last report: {formatMaybeDate(row.lastContactDate)}</span>}
            {row.latestNote && <span className="italic" style={{ color: colors.text.muted }}>"{row.latestNote}"</span>}
            {row.removalReason && <span style={{ color: colors.accent.terracotta }}>{row.removalReason}</span>}
            {row.dormantReason && <span>{row.dormantReason}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {row.weekNumber && <WeekIndicator currentWeek={row.weekNumber} />}
          {bucketKey === "eligible" && (
            <button onClick={onAssign} className="rounded-full px-3 py-1.5 text-xs text-white" style={{ backgroundColor: colors.accent.ink }}>
              Assign
            </button>
          )}
          {bucketKey === "dormant_candidates" && (
            <button onClick={onMarkDormant} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
              Mark dormant
            </button>
          )}
          {bucketKey === "graduation_ready" && (
            <button onClick={onGraduate} className="rounded-full px-3 py-1.5 text-xs text-white" style={{ backgroundColor: colors.accent.sage }}>
              Promote
            </button>
          )}
          {bucketKey !== "graduation_ready" && isAdmin && (
            <button onClick={onGraduate} className="rounded-full px-3 py-1.5 text-xs text-white" style={{ backgroundColor: colors.accent.sage }}>
              Graduate
            </button>
          )}
          {bucketKey === "removal_requests" && isAdmin && (
            <button onClick={onApproveRemoval} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}>
              Approve removal
            </button>
          )}
          {row.followUpId && bucketKey !== "removal_requests" && bucketKey !== "graduation_ready" && (
            <button onClick={onMarkReady} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>
              Mark ready
            </button>
          )}
          {row.followUpId && (
            <button onClick={onReassign} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
              Reassign
            </button>
          )}
          {canRecordReport && (
            <button
              onClick={() => onManualReport(row.assignedToClerkId!, row.assigneeName!)}
              className="rounded-full px-3 py-1.5 text-xs"
              style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}
            >
              Record report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamView({
  team,
  onSelect,
  onToggleActive,
  onAddProtocol,
  newProtocolClerkId,
  setNewProtocolClerkId,
  newProtocolDisplayName,
  setNewProtocolDisplayName,
  isWhatsAppOnly,
  setIsWhatsAppOnly,
  whatsappPhone,
  setWhatsappPhone,
}: {
  team: TeamMember[];
  onSelect: (member: TeamMember) => void;
  onToggleActive: (member: TeamMember) => void;
  onAddProtocol: () => void;
  newProtocolClerkId: string;
  setNewProtocolClerkId: (value: string) => void;
  newProtocolDisplayName: string;
  setNewProtocolDisplayName: (value: string) => void;
  isWhatsAppOnly: boolean;
  setIsWhatsAppOnly: (value: boolean) => void;
  whatsappPhone: string;
  setWhatsappPhone: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="rounded-xl p-4" style={{ backgroundColor: colors.surface }}>
        <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: colors.text.primary }}>
          <UserPlus size={16} /> Add protocol member
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs" style={{ color: colors.text.secondary }}>
            <input
              type="checkbox"
              checked={isWhatsAppOnly}
              onChange={(event) => setIsWhatsAppOnly(event.target.checked)}
            />
            WhatsApp-only member
          </label>
          {isWhatsAppOnly ? (
            <input value={whatsappPhone} onChange={(event) => setWhatsappPhone(event.target.value)} placeholder="+254..." className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }} />
          ) : (
            <input value={newProtocolClerkId} onChange={(event) => setNewProtocolClerkId(event.target.value)} placeholder="Clerk user ID" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }} />
          )}
          <input value={newProtocolDisplayName} onChange={(event) => setNewProtocolDisplayName(event.target.value)} placeholder="Display name" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }} />
          <button onClick={onAddProtocol} className="w-full rounded-xl py-2.5 text-sm text-white" style={{ backgroundColor: colors.accent.ink }}>
            Add member
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {team.map((member) => (
          <div key={member.clerkId} className="rounded-xl border bg-white p-4" style={{ borderColor: colors.border }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: member.active ? colors.text.primary : colors.text.muted }}>{member.displayName}</span>
                  {member.accessMode === "whatsapp_only" && (
                    <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>WhatsApp-only</span>
                  )}
                  {!member.active && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: colors.surfaceHover, color: colors.text.muted }}>Inactive</span>}
                </div>
                <div className="mt-1 text-xs" style={{ color: colors.text.muted }}>
                  {member.activeAssignments} active · {member.pendingReports} pending · {member.readyCount} ready
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onSelect(member)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                  <Eye size={13} /> View
                </button>
                <button onClick={() => onToggleActive(member)} className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: member.active ? colors.accent.sageLight : colors.surfaceHover, color: member.active ? colors.accent.sage : colors.text.muted }}>
                  {member.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentDrawer({
  rows,
  protocolOptions,
  selectedAssignee,
  setSelectedAssignee,
  selectedVisitorIds,
  setSelectedVisitorIds,
  onSubmit,
  onClose,
}: {
  rows: WorkspaceRow[];
  protocolOptions: Array<{ clerkId: string; displayName: string }>;
  selectedAssignee: string;
  setSelectedAssignee: (value: string) => void;
  selectedVisitorIds: Set<Id<"visitors">>;
  setSelectedVisitorIds: Dispatch<SetStateAction<Set<Id<"visitors">>>>;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-[#faf9f7] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium" style={{ color: colors.text.primary }}>Assign visitors</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{rows.length} eligible unassigned visitors</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-xs" style={{ color: colors.text.muted }}>Assign to</div>
          <div className="flex flex-wrap gap-2">
            {protocolOptions.map((member) => (
              <button
                key={member.clerkId}
                onClick={() => setSelectedAssignee(member.clerkId)}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ backgroundColor: selectedAssignee === member.clerkId ? colors.accent.ink : colors.surface, color: selectedAssignee === member.clerkId ? colors.bg : colors.text.secondary }}
              >
                {member.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 space-y-2">
          {rows.length === 0 ? (
            <div className="rounded-xl py-12 text-center text-sm" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>No eligible visitors</div>
          ) : (
            rows.map((row) => {
              const checked = selectedVisitorIds.has(row.visitorId);
              return (
                <label key={row.visitorId} className="flex cursor-pointer items-center gap-3 rounded-xl p-3" style={{ backgroundColor: colors.surface }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setSelectedVisitorIds((previous) => {
                        const next = new Set(previous);
                        if (event.target.checked) next.add(row.visitorId);
                        else next.delete(row.visitorId);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm" style={{ color: colors.text.primary }}>{row.visitorName}</div>
                    <div className="text-xs" style={{ color: colors.text.muted }}>{row.visitorContact || "No contact"} · {formatMaybeDate(row.firstVisitDate)}</div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <button
          onClick={onSubmit}
          disabled={!selectedAssignee || selectedVisitorIds.size === 0}
          className="sticky bottom-0 w-full rounded-xl py-3 text-sm text-white disabled:opacity-40"
          style={{ backgroundColor: colors.accent.ink }}
        >
          Assign {selectedVisitorIds.size || ""} visitor{selectedVisitorIds.size === 1 ? "" : "s"}
        </button>
      </aside>
    </div>
  );
}

function ChoiceDrawer({ title, options, onClose }: { title: string; options: Array<{ key: string; label: string; onSelect: () => void }>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl" style={{ backgroundColor: colors.surface }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: colors.text.primary }}>{title}</h2>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <div className="space-y-2">
          {options.map((option) => (
            <button key={option.key} onClick={option.onSelect} className="w-full rounded-xl px-4 py-3 text-left text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportModal({
  state,
  status,
  setStatus,
  comment,
  setComment,
  onSubmit,
  onClose,
}: {
  state: ReportModalState;
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
            <h2 className="text-sm font-medium" style={{ color: colors.text.primary }}>Record report</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{state.visitorName} · {state.reporterName}</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                className="rounded-xl py-2 text-xs"
                style={{ backgroundColor: status === option.value ? colors.accent.amberLight : colors.bg, color: status === option.value ? colors.text.primary : colors.text.secondary }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="Report notes" className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
          <button onClick={onSubmit} className="w-full rounded-xl py-3 text-sm text-white" style={{ backgroundColor: colors.accent.ink }}>Save report</button>
        </div>
      </div>
    </div>
  );
}

function TeamDrawer({ team, rows, onClose, onReport }: { team: TeamMember; rows: WorkspaceRow[]; onClose: () => void; onReport: (row: WorkspaceRow) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-[#faf9f7] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium" style={{ color: colors.text.primary }}>{team.displayName}</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{rows.length} active assignments</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <div className="space-y-2">
          {rows.length === 0 ? (
            <div className="rounded-xl py-12 text-center text-sm" style={{ backgroundColor: colors.surface, color: colors.text.muted }}>No active assignments</div>
          ) : (
            rows.map((row) => (
              <div key={`${row.followUpId}-${row.visitorId}`} className="rounded-xl border bg-white p-3" style={{ borderColor: colors.border }}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium" style={{ color: colors.text.primary }}>{row.visitorName}</span>
                  {row.weekNumber && <WeekIndicator currentWeek={row.weekNumber} />}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>{row.statusLabel} · {row.visitorContact || "No contact"}</div>
                {row.latestNote && <div className="mt-2 text-xs italic" style={{ color: colors.text.secondary }}>"{row.latestNote}"</div>}
                <button onClick={() => onReport(row)} className="mt-3 rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}>
                  Record report
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function GraduateModal({
  state,
  promoteType,
  setPromoteType,
  gradDepartment,
  setGradDepartment,
  gradStatus,
  setGradStatus,
  gradGender,
  setGradGender,
  gradAge,
  setGradAge,
  onSubmit,
  onClose,
}: {
  state: GraduateModalState;
  promoteType: "member" | "kid";
  setPromoteType: (value: "member" | "kid") => void;
  gradDepartment: string;
  setGradDepartment: (value: string) => void;
  gradStatus: string;
  setGradStatus: (value: string) => void;
  gradGender: string;
  setGradGender: (value: string) => void;
  gradAge: string;
  setGradAge: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" style={{ backgroundColor: colors.surface }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium" style={{ color: colors.text.primary }}>Promote visitor</h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>{state.visitorName} · {state.sundayCount} Sundays</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><X size={18} /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border" style={{ borderColor: colors.border }}>
          <button onClick={() => setPromoteType("member")} className="py-2 text-xs" style={{ backgroundColor: promoteType === "member" ? colors.accent.ink : "transparent", color: promoteType === "member" ? colors.bg : colors.text.secondary }}>Member</button>
          <button onClick={() => setPromoteType("kid")} className="py-2 text-xs" style={{ backgroundColor: promoteType === "kid" ? colors.accent.ink : "transparent", color: promoteType === "kid" ? colors.bg : colors.text.secondary }}>Kid</button>
        </div>
        <div className="space-y-3">
          {promoteType === "member" ? (
            <>
              <input value={gradDepartment} onChange={(event) => setGradDepartment(event.target.value)} placeholder="Department" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }} />
              <select value={gradStatus} onChange={(event) => setGradStatus(event.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }}>
                <option value="">Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Youth">Youth</option>
              </select>
              <select value={gradGender} onChange={(event) => setGradGender(event.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }}>
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </>
          ) : (
            <input value={gradAge} onChange={(event) => setGradAge(event.target.value)} type="number" placeholder="Age" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ backgroundColor: colors.bg }} />
          )}
          <button onClick={onSubmit} className="w-full rounded-xl py-3 text-sm text-white" style={{ backgroundColor: colors.accent.ink }}>
            Promote to {promoteType}
          </button>
        </div>
      </div>
    </div>
  );
}
