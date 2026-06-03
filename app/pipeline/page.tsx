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

function getSundayOfWeek(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown Week";
  try {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "Unknown Week";
    const [y, m, d] = parts.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = day === 0 ? 0 : 7 - day; // Days to add to reach Sunday
    const sunday = new Date(date.getTime() + diff * 24 * 60 * 60 * 1000);
    return sunday.toISOString().split("T")[0];
  } catch (e) {
    return "Unknown Week";
  }
}

function formatStatusCategory(gender?: string | null, relStatus?: string | null): string {
  const g = (gender || "").toLowerCase().trim();
  const r = (relStatus || "").toLowerCase().trim();
  
  if (r === "child" || r.includes("child") || r === "kid" || r.includes("kid")) {
    return "Child";
  }
  
  if (r === "married" || r.includes("married")) {
    if (g === "male" || g.includes("male") && !g.includes("female")) {
      return "Men(Married)";
    }
    if (g === "female" || g.includes("female")) {
      return "Women(Married)";
    }
    return "Married";
  }
  
  if (r === "youth" || r === "single" || r.includes("youth") || r.includes("single")) {
    if (g === "male" || g.includes("male") && !g.includes("female")) {
      return "Youth Men";
    }
    if (g === "female" || g.includes("female")) {
      return "Youth Ladies";
    }
    return "Youth";
  }
  
  if (g === "male" || g.includes("male") && !g.includes("female")) {
    return "Men";
  }
  if (g === "female" || g.includes("female")) {
    return "Ladies";
  }
  
  if (r) {
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  
  return "-";
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

// ── Recency signal ───────────────────────────────────────
function getRecency(lastDate: string | null | undefined, firstDate: string): { label: string; color: string; dotColor: string } {
  const ref = lastDate || firstDate;
  if (!ref) return { label: "No visits", color: "#b0ada8", dotColor: "#d4d0ca" };
  const [y, m, d] = ref.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 1) return { label: "Today", color: "#6b8a5e", dotColor: "#6b8a5e" };
  if (days <= 7) return { label: `${days}d ago`, color: "#6b8a5e", dotColor: "#6b8a5e" };
  if (days <= 14) return { label: `${Math.floor(days / 7)}w ago`, color: "#9a7d4e", dotColor: "#c9a87c" };
  if (days <= 28) return { label: `${Math.floor(days / 7)}w ago`, color: "#8a7a64", dotColor: "#b0a898" };
  if (days <= 60) return { label: `${Math.floor(days / 30)}mo ago`, color: "#999", dotColor: "#c4c0ba" };
  return { label: `${Math.floor(days / 30)}mo ago`, color: "#b0ada8", dotColor: "#d4d0ca" };
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
  const [promoteType, setPromoteType] = useState<"member" | "kid">("member");
  const [gradDepartment, setGradDepartment] = useState("");
  const [gradStatus, setGradStatus] = useState("");
  const [gradGender, setGradGender] = useState("");
  const [gradAge, setGradAge] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "visits_desc" | "visits_asc" | "recent" | "oldest">("default");
  const [journeyId, setJourneyId] = useState<Id<"visitors"> | null>(null);

  // Auto-fill gender/status when opening graduate modal
  const openGraduateModal = (v: any, type: "member" | "kid" = "member") => {
    setGraduateModal(v);
    setPromoteType(type);
    if (type === "member") {
      const rs = (v.relationshipStatus || "").toLowerCase();
      if (rs.includes("married")) setGradStatus("Married");
      else if (rs.includes("single")) setGradStatus("Single");
      else if (rs.includes("youth")) setGradStatus("Youth");
      else setGradStatus("");
      const g = (v.gender || "").toLowerCase();
      if (g.includes("male") && !g.includes("female")) setGradGender("male");
      else if (g.includes("female")) setGradGender("female");
      else setGradGender("");
      setGradDepartment("");
    }
    setGradAge("");
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
  const graduateToKidMutation = useMutation(api.visitors.graduateToKid);
  const markDormantMutation = useMutation(api.visitorPipeline.markDormant);
  const dropMutation = useMutation(api.visitorPipeline.dropVisitor);
  const reactivateMutation = useMutation(api.visitorPipeline.reactivateVisitor);
  const autoArchiveMutation = useMutation(api.visitorPipeline.autoArchiveDormant);

  useEffect(() => {
    if (isAuthenticated) {
      autoArchiveMutation({}).catch((err) => {
        console.error("Silent auto-archive failed:", err);
      });
    }
  }, [isAuthenticated, autoArchiveMutation]);

  const handleGraduate = async () => {
    if (!graduateModal) return;
    try {
      if (promoteType === "kid") {
        await graduateToKidMutation({
          visitorId: graduateModal._id,
          age: gradAge ? parseInt(gradAge) : undefined,
        });
        setToast(`${graduateModal.name} promoted to kids`);
      } else {
        await graduateMutation({
          visitorId: graduateModal._id,
          department: gradDepartment || undefined,
          status: gradStatus || undefined,
          gender: gradGender || undefined,
        });
        setToast(`${graduateModal.name} promoted to member`);
      }
      setGraduateModal(null);
      setGradDepartment(""); setGradStatus(""); setGradGender(""); setGradAge("");
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
  };

  const handleAutoArchive = async () => {
    try {
      const count = await autoArchiveMutation({});
      setToast(count > 0 ? `${count} dormant visitor${count > 1 ? "s" : ""} archived` : "No dormant visitors to archive");
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
  };

  const handlePDFExport = () => {
    const sortedGraduates = [...filtered].sort((a: any, b: any) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    });

    const rowsHtml = sortedGraduates.map((v: any, idx: number) => {
      const name = v.name || "";
      const contact = v.contact || "-";
      const residence = v.residence || "-";
      const status = formatStatusCategory(v.gender, v.relationshipStatus);
      const batchWeek = formatDateShort(getSundayOfWeek(v.graduationDate || v.lastAttendanceDate || v.date));
      const weekGraduated = v.graduationDate ? formatDateShort(v.graduationDate) : "Pending";
      return `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-weight: 500;">${name}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${contact}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${residence}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${status}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${batchWeek}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-weight: 500;">${weekGraduated}</td>
        </tr>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Graduation Candidates Report</title>
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
            font-size: 11px;
            margin-bottom: 20px;
          }
          .section-title {
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
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          table.data-table th {
            background-color: #3d3a36;
            color: #fff;
            padding: 5px 8px;
            text-align: left;
          }
          table.data-table td {
            padding: 5px 8px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #9a9793;
            border-top: 1px solid #e8e6e3;
            padding-top: 12px;
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
              <div class="title-altar">Imara Daima Main Altar — Protocol Department</div>
              <div class="title-report">Graduation Candidates Report</div>
              <div class="title-date">Generated on: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            </td>
            <td class="logo-cell-right">
              <img src="/convex.svg" class="logo-img" alt="Church Logo" />
            </td>
          </tr>
        </table>

        <div class="stats-row">
          <span><strong>Total Candidates:</strong> ${sortedGraduates.length}</span>
          <span><strong>Status:</strong> Ready for promotion</span>
          <span><strong>Generated by:</strong> Imaara Admin System</span>
        </div>

        <div class="section-title">
          <span>Candidates Ready for Graduation</span>
          <span class="section-count">Count: ${sortedGraduates.length}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">#</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Residence</th>
              <th>Status</th>
              <th>Batch Week</th>
              <th>Week Graduated</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; color: #9a9793; padding: 12px;">No candidates ready for graduation</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Imaara Church Management System · Imara Daima Main Altar
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppExport = () => {
    const sortedGraduates = [...filtered].sort((a: any, b: any) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    });

    let report = "*IMAARA GRADUATION LIST*\n";
    report += "*Date:* " + new Date().toLocaleDateString("en-GB") + "\n";
    report += "*Total Candidates:* " + sortedGraduates.length + "\n\n";
    report += "The following visitors have completed Week 4 of follow-ups and are ready to graduate:\n\n";

    sortedGraduates.forEach((v: any, index: number) => {
      const status = formatStatusCategory(v.gender, v.relationshipStatus);
      report += (index + 1) + ". *" + v.name + "*\n";
      report += "   Contact: " + (v.contact || "N/A") + "\n";
      report += "   Residence: " + (v.residence || "N/A") + "\n";
      report += "   Category: " + status + "\n";
      report += "   First Seen: " + formatDateShort(v.date) + "\n";
      report += "   Attendance: " + (v.sundayCount ?? 0) + " Sundays\n";
      if (v.followUpAssignee) {
        report += "   Follow-up: " + v.followUpAssignee + "\n";
      }
      report += "\n";
    });

    report += "*The Imaara Mall 3rd Floor*\n*Imara Daima Altar*";

    const encodedText = encodeURIComponent(report);
    window.open("https://wa.me/?text=" + encodedText, "_blank");
  };

  const handleBatchWhatsAppExport = (sunday: string, batchGraduates: any[]) => {
    const sorted = [...batchGraduates].sort((a: any, b: any) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(sunday);
    const scopeLabel = isIsoDate ? formatDate(sunday) : sunday;

    let report = `*IMAARA GRADUATES REPORT*\n`;
    report += `*Scope / Batch:* ${scopeLabel}\n`;
    report += `*Total Graduates:* ${sorted.length}\n\n`;
    report += `The following members/children have successfully graduated and been promoted to their respective departments:\n\n`;

    sorted.forEach((v: any, index: number) => {
      const status = formatStatusCategory(v.gender, v.relationshipStatus);
      report += `${index + 1}. *${v.name}*\n`;
      report += `   Contact: ${v.contact || "N/A"}\n`;
      report += `   Residence: ${v.residence || "N/A"}\n`;
      report += `   Category: ${status}\n`;
      report += `\n`;
    });

    report += `*The Imaara Mall 3rd Floor*\n*Imara Daima Altar — Follow-up Department*`;

    const encodedText = encodeURIComponent(report);
    window.open(`https://wa.me/?text=${encodedText}`, `_blank`);
  };

  const handleBatchPDFExport = (sunday: string, batchGraduates: any[]) => {
    const sorted = [...batchGraduates].sort((a: any, b: any) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(sunday);
    const scopeLabel = isIsoDate ? formatDate(sunday) : sunday;
    const formattedTitle = isIsoDate ? `Batch of ${formatDateShort(sunday)}` : sunday;

    const rowsHtml = sorted.map((v: any, idx: number) => {
      const name = v.name || "";
      const contact = v.contact || "-";
      const residence = v.residence || "-";
      const status = formatStatusCategory(v.gender, v.relationshipStatus);
      const batchWeek = formatDateShort(getSundayOfWeek(v.graduationDate || v.lastAttendanceDate || v.date));
      const weekGraduated = formatDateShort(v.graduationDate || v.lastAttendanceDate || v.date);
      return `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-weight: 500;">${name}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${contact}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${residence}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${status}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${batchWeek}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-weight: 500;">${weekGraduated}</td>
        </tr>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Graduates Report - ${formattedTitle}</title>
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
            background-color: #f5f3ef;
            padding: 10px 15px;
            border-radius: 12px;
            font-size: 11px;
            color: #6b6864;
            margin-bottom: 25px;
            border: 1px solid #e8e6e3;
          }
          .section-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #3d3a36;
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          .section-title span {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #3d3a36;
          }
          .section-title .section-count {
            font-size: 11px;
            font-weight: 500;
            color: #8a8784;
            text-transform: none;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 30px;
          }
          table.data-table th {
            background-color: #f5f3ef;
            color: #3d3a36;
            text-align: left;
            padding: 8px;
            font-weight: 600;
            border-bottom: 2px solid #e8e6e3;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
          }
          table.data-table td {
            padding: 5px 8px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #9a9793;
            border-top: 1px solid #e8e6e3;
            padding-top: 12px;
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
              <div class="title-altar">Imara Daima Main Altar — Protocol Department</div>
              <div class="title-report">Graduates Batch & Cohort Report</div>
              <div class="title-date">Scope: ${scopeLabel}</div>
            </td>
            <td class="logo-cell-right">
              <img src="/convex.svg" class="logo-img" alt="Church Logo" />
            </td>
          </tr>
        </table>

        <div class="stats-row">
          <span><strong>Total Graduates:</strong> ${sorted.length}</span>
          <span><strong>Scope:</strong> ${scopeLabel}</span>
          <span><strong>Generated on:</strong> ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        <div class="section-title">
          <span>Graduated Members List</span>
          <span class="section-count">Count: ${sorted.length}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">#</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Residence</th>
              <th>Status</th>
              <th>Batch Week</th>
              <th>Week Graduated</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; color: #9a9793; padding: 12px;">No graduates in this batch</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Imaara Church Management System · Imara Daima Main Altar
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = (visitors ?? []).filter((v: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.name?.toLowerCase().includes(q) || v.contact?.toLowerCase().includes(q) || v.residence?.toLowerCase().includes(q);
  }).sort((a: any, b: any) => {
    if (sortBy === "visits_desc") return (b.sundayCount ?? 0) - (a.sundayCount ?? 0);
    if (sortBy === "visits_asc") return (a.sundayCount ?? 0) - (b.sundayCount ?? 0);
    if (sortBy === "recent" || sortBy === "oldest") {
      const dateA = a.lastAttendanceDate || a.date || "";
      const dateB = b.lastAttendanceDate || b.date || "";
      return sortBy === "recent" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    }
    return 0;
  });

  const loading = overview === undefined;
  const sortOptions = ["default", "visits_desc", "visits_asc", "recent", "oldest"] as const;
  const sortLabels: Record<string, string> = { default: "Default", visits_desc: "Most visits", visits_asc: "Least visits", recent: "Last seen", oldest: "Oldest seen" };
  const nextSort = () => {
    const idx = sortOptions.indexOf(sortBy);
    setSortBy(sortOptions[(idx + 1) % sortOptions.length]);
  };
  const stages = ["new", "assigned", "in_progress", "ready", "graduated", "dormant", "dropped"] as const;

  const renderVisitorCard = (v: any) => {
    const recency = getRecency(v.lastAttendanceDate, v.date);
    return (
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

        {/* Row 2: meta + recency */}
        <div className="flex items-center justify-between gap-3 text-[11px] text-[#8a8784] mb-2">
          <div className="flex items-center gap-3">
            {v.pipelineStage === "graduated" ? (
              <span className="text-[#6b8a5e] font-medium">🎓 Graduated: {formatDateShort(v.graduationDate || v.lastAttendanceDate || v.date)}</span>
            ) : (
              <span>{formatDateShort(v.date)}</span>
            )}
            {v.followUpAssignee && <span>{v.followUpAssignee}</span>}
            {v.followUpWeekNumber && (
              <WeekIndicator currentWeek={v.followUpWeekNumber} />
            )}
          </div>
          {v.pipelineStage !== "graduated" && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: recency.dotColor }} />
              <span style={{ color: recency.color }}>{recency.label}</span>
            </div>
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
          {v.pipelineStage !== "graduated" && v.pipelineStage !== "dropped" && (
            <>
              <button
                id={`graduate-${v._id}`}
                onClick={() => openGraduateModal(v, "member")}
                className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#6b8a5e] hover:bg-[#6b8a5e]/10 transition-colors"
              >
                Promote to member
              </button>
              <button
                id={`graduate-kid-${v._id}`}
                onClick={() => openGraduateModal(v, "kid")}
                className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#9a7d4e] hover:bg-[#9a7d4e]/10 transition-colors"
              >
                Promote to kid
              </button>
            </>
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
              id={`dormant-${v._id}`}
              onClick={async () => {
                try { await markDormantMutation({ visitorId: v._id }); setToast(`${v.name} marked dormant`); }
                catch (e: unknown) { setToast(e instanceof Error ? e.message : "Failed"); }
              }}
              className="text-[11px] font-light px-2.5 py-1 rounded-full text-[#b0ada8] hover:text-[#8a8784] hover:bg-[#8a8784]/10 transition-colors"
            >
              Mark dormant
            </button>
          )}
          {v.pipelineStage !== "dropped" && v.pipelineStage !== "dormant" && (
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
    );
  };

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

          {/* ── Search + sort + actions ────────────────────── */}
          <div className="flex items-center gap-2 mb-5">
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
              id="sort-toggle"
              onClick={nextSort}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#6b6864] border border-[#e8e6e3] hover:border-[#d4d0ca] transition-colors whitespace-nowrap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
              {sortLabels[sortBy]}
            </button>
            <button
              id="auto-archive-btn"
              onClick={handleAutoArchive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#9a9793] hover:text-[#6b6864] border border-[#e8e6e3] hover:border-[#d4d0ca] transition-colors whitespace-nowrap"
            >
              {Icons.archive}
              Archive dormant
            </button>
          </div>

          {selectedStage === "ready" && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 mb-4 rounded-xl border border-[#6b8a5e]/20 bg-[#6b8a5e]/5">
              <div>
                <h3 className="text-sm font-medium text-[#3d3a36]">Graduation Ready Candidates</h3>
                <p className="text-xs text-[#6b6864] font-light">
                  {filtered.length} candidates have completed Week 4 follow-up.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="export-pdf-btn"
                  onClick={handlePDFExport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs bg-[#3d3a36] text-[#f5f3ef] hover:bg-[#4d4a46] transition-colors whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Export PDF
                </button>
                <button
                  id="export-whatsapp-btn"
                  onClick={handleWhatsAppExport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs bg-[#6b8a5e] text-[#f5f3ef] hover:bg-[#5a784d] transition-colors whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Export to WhatsApp
                </button>
              </div>
            </div>
          )}

          {selectedStage === "graduated" && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 mb-4 rounded-xl border border-[#6b8a5e]/20 bg-[#6b8a5e]/5">
              <div>
                <h3 className="text-sm font-medium text-[#3d3a36]">Graduated Members & Kids</h3>
                <p className="text-xs text-[#6b6864] font-light">
                  {filtered.length} individuals have successfully graduated and been promoted.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="export-all-graduates-pdf-btn"
                  onClick={() => handleBatchPDFExport("All Graduates", filtered)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs bg-[#3d3a36] text-[#f5f3ef] hover:bg-[#4d4a46] transition-colors whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Export All PDF
                </button>
                <button
                  id="export-all-graduates-whatsapp-btn"
                  onClick={() => handleBatchWhatsAppExport("All Graduates", filtered)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs bg-[#6b8a5e] text-[#f5f3ef] hover:bg-[#5a784d] transition-colors whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Export All WhatsApp
                </button>
              </div>
            </div>
          )}

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
            ) : selectedStage === "graduated" ? (
              (() => {
                const groups: Record<string, any[]> = {};
                filtered.forEach((v: any) => {
                  const sunday = getSundayOfWeek(v.graduationDate || v.lastAttendanceDate || v.date);
                  if (!groups[sunday]) groups[sunday] = [];
                  groups[sunday].push(v);
                });
                const sortedSundays = Object.keys(groups).sort((a, b) => b.localeCompare(a));
                
                return sortedSundays.map((sunday) => (
                  <div key={sunday} className="space-y-2 mb-6">
                    <div className="mt-4 mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#3d3a36]">
                          Batch of {sunday === "Unknown Week" ? "Unknown Week" : formatDate(sunday)}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#6b8a5e]/10 text-[#6b8a5e]">
                          {groups[sunday].length} graduate{groups[sunday].length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          id={`export-batch-${sunday}`}
                          onClick={() => handleBatchPDFExport(sunday, groups[sunday])}
                          className="text-[10px] font-light px-2.5 py-1 rounded-full text-[#6b8a5e] border border-[#6b8a5e]/20 hover:bg-[#6b8a5e]/5 transition-colors flex items-center gap-1"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          Export Batch PDF
                        </button>
                        <button
                          id={`export-batch-wa-${sunday}`}
                          onClick={() => handleBatchWhatsAppExport(sunday, groups[sunday])}
                          className="text-[10px] font-light px-2.5 py-1 rounded-full text-[#25d366] border border-[#25d366]/20 hover:bg-[#25d366]/5 transition-colors flex items-center gap-1"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                          </svg>
                          WhatsApp Report
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {groups[sunday].map((v: any) => renderVisitorCard(v))}
                    </div>
                  </div>
                ));
              })()
            ) : (
              filtered.map((v: any) => renderVisitorCard(v))
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
                  <div className="text-sm font-normal text-[#3d3a36]">Promote {graduateModal.name}</div>
                  <div className="text-xs text-[#8a8784]">Move to {promoteType === "kid" ? "kids" : "members"} list</div>
                </div>
                <button onClick={() => setGraduateModal(null)} className="text-[#c4c0ba] hover:text-[#9a9793]">{Icons.close}</button>
              </div>

              {/* Type toggle */}
              <div className="flex rounded-xl border border-[#e8e6e3] mb-4 overflow-hidden">
                <button
                  id="toggle-member"
                  onClick={() => setPromoteType("member")}
                  className="flex-1 py-2 text-xs text-center transition-colors"
                  style={{ backgroundColor: promoteType === "member" ? "#3d3a36" : "transparent", color: promoteType === "member" ? "#f5f3ef" : "#8a8784" }}
                >
                  Member
                </button>
                <button
                  id="toggle-kid"
                  onClick={() => setPromoteType("kid")}
                  className="flex-1 py-2 text-xs text-center transition-colors"
                  style={{ backgroundColor: promoteType === "kid" ? "#3d3a36" : "transparent", color: promoteType === "kid" ? "#f5f3ef" : "#8a8784" }}
                >
                  Kid
                </button>
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
                <div className="flex items-center gap-2 text-sm text-[#6b6864]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 21H6a1 1 0 0 1-1-1v-8l7-7 7 7v8a1 1 0 0 1-1 1z"/><path d="M12 2v4"/><path d="M10 4h4"/></svg>
                  {graduateModal.sundayCount ?? 0} {(graduateModal.sundayCount ?? 0) === 1 ? "Sunday" : "Sundays"} attended
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                {promoteType === "member" ? (
                  <>
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
                  </>
                ) : (
                  <input id="grad-age" type="number" value={gradAge} onChange={(e) => setGradAge(e.target.value)} placeholder="Age (optional)" className="w-full px-3 py-2 rounded-xl border border-[#e8e6e3] bg-transparent text-sm outline-none" />
                )}
                <button id="confirm-graduate" onClick={handleGraduate} className="w-full py-2.5 rounded-xl text-sm bg-[#3d3a36] text-[#f5f3ef] hover:bg-[#4d4a46] transition-colors">
                  Promote to {promoteType === "kid" ? "kid" : "member"}
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
