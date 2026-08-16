"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, formatDateLong } from "@/lib/date";
import { Clock } from "lucide-react";
import MemberEditor, { type MemberSummary } from "@/components/MemberEditor";
import KidEditor, { type KidSummary } from "@/components/KidEditor";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";


const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: {
    primary: '#141414',
    secondary: '#525252',
    muted: '#a1a1a1',
  },
  accent: {
    amber: '#0D9762',
    amberLight: '#a7ddc7',
    sage: '#154618',
    sageLight: '#c3d3c4',
    terracotta: '#0D9762',
    terracottaLight: '#a7ddc7',
  }
};

// Organic sand/amber recency labels using original colors
function getRecencyStyle(lastSeenDate: string | null) {
  if (!lastSeenDate) {
    return {
      text: "Never seen",
      color: colors.text.muted
    };
  }

  const lastSeen = new Date(lastSeenDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastSeen.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      color: colors.text.secondary
    };
  } else if (diffDays <= 60) {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      color: colors.accent.amber
    };
  } else {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      color: colors.accent.terracotta
    };
  }
}

// Subtle dot pattern
const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

export default function RollCallDetailPage() {
  const params = useParams<{ date: string }>();
  const date = decodeURIComponent(params.date);
  const [editingUnknown, setEditingUnknown] = useState<MemberSummary | null>(null);
  const [editingAbsentMember, setEditingAbsentMember] = useState<MemberSummary | null>(null);
  const [editingAbsentKid, setEditingAbsentKid] = useState<KidSummary | null>(null);
  const [historyVisitor, setHistoryVisitor] = useState<{ name: string; memberId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"present" | "absent" | "visitors">("present");
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed Admin Report States
  const [successes, setSuccesses] = useState("");
  const [challenges, setChallenges] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [showAdminReportForm, setShowAdminReportForm] = useState(false);
  const [excludedGraduates, setExcludedGraduates] = useState<Set<string>>(new Set());

  // Absent export configuration
  const [showAbsentExportOptions, setShowAbsentExportOptions] = useState(false);
  const [exportIncludeMembers, setExportIncludeMembers] = useState(true);
  const [exportIncludeKids, setExportIncludeKids] = useState(false);
  const [exportIncludeReturningVisitors, setExportIncludeReturningVisitors] = useState(false);
  const [exportOnlyWithContact, setExportOnlyWithContact] = useState(false);
  const [exportMinSundays, setExportMinSundays] = useState("");
  const [exportMaxSundays, setExportMaxSundays] = useState("");

  const { isAuthenticated } = useConvexAuth();
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);
  const removeVisitor = useMutation(api.visitors.remove);
  const removeMember = useMutation(api.members.remove);
  const removeKid = useMutation(api.kids.remove);
  const roster = useQuery(api.attendance.rosterForDate, isAuthenticated ? { date } : "skip");
  const visitorsRoster = useQuery(api.attendance.visitorsRosterForDate, isAuthenticated ? { date } : "skip");
  const visitorHistory = useQuery(
    api.attendance.historyForMember,
    isAuthenticated && historyVisitor ? { memberId: historyVisitor.memberId as any } : "skip"
  );
  const sundayMetrics = useQuery(
    api.attendance.getSundayReportMetrics,
    isAuthenticated ? { date } : "skip"
  );

  const rosterList = roster ?? [];
  const visitors = visitorsRoster ?? [];

  // Stats
  const membersOnly = rosterList.filter((m: any) => m.type === "member" || m.type === "kid");
  const total = membersOnly.length;
  const presentMembersKids = membersOnly.filter((m: any) => m.presentToday).length;
  const absentMembers = membersOnly.filter((m: any) => !m.presentToday);

  const presentMen = membersOnly.filter((m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "male");
  const presentWomen = membersOnly.filter((m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "female");
  const presentKids = membersOnly.filter((m: any) => m.presentToday && m.type === "kid");
  const presentUnknown = membersOnly.filter((m: any) => m.presentToday && m.type !== "kid" && !["male", "female"].includes((m.gender ?? "").toLowerCase()));

  const returningVisitorsPresent = rosterList.filter((m: any) => m.type === "returningVisitor" && m.presentToday);
  const returningVisitorsAbsent = rosterList.filter((m: any) => m.type === "returningVisitor" && !m.presentToday);
  const presentVisitors = visitors.filter((v: any) => v.presentToday);

  const totalPresent = presentMembersKids + returningVisitorsPresent.length + presentVisitors.length;
  const totalAbsent = absentMembers.length + returningVisitorsAbsent.length;
  
  const attendanceRate = totalPresent + totalAbsent > 0 
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 1000) / 10
    : 0;

  // Search Filters
  const filteredPresentMen = presentMen.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPresentWomen = presentWomen.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPresentKids = presentKids.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPresentUnknown = presentUnknown.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredReturningVisitorsPresent = returningVisitorsPresent.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const filteredAbsentMembers = absentMembers.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredReturningVisitorsAbsent = returningVisitorsAbsent.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const filteredPresentVisitors = presentVisitors.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Absent export selection — who ends up in the CSV
  const parseSundayBound = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number.parseInt(trimmed, 10);
    return Number.isNaN(n) ? null : Math.max(0, n);
  };
  const minSundays = parseSundayBound(exportMinSundays);
  const maxSundays = parseSundayBound(exportMaxSundays);

  const isInAbsentExport = (p: any) => {
    if (p.type === "kid") {
      if (!exportIncludeKids) return false;
    } else if (p.type === "returningVisitor") {
      if (!exportIncludeReturningVisitors) return false;
    } else if (!exportIncludeMembers) {
      return false;
    }

    const sundays = p.sundaysAttended ?? 0;
    if (minSundays !== null && sundays < minSundays) return false;
    if (maxSundays !== null && sundays > maxSundays) return false;

    if (exportOnlyWithContact && !String(p.contact ?? "").trim()) return false;

    return true;
  };

  const absentExportList = [...absentMembers, ...returningVisitorsAbsent].filter(isInAbsentExport);

  const togglePresent = async (memberId: string, current: boolean) => {
    const payload = { memberId, date };
    if (current) await unmarkPresent(payload as any);
    else await markPresent(payload as any);
  };

  // PDF Export
  const handlePrintPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    const formattedDate = formatDateLong(date);

    // Collect all present arrival times
    const allPresent = [
      ...presentMen,
      ...presentWomen,
      ...presentUnknown,
      ...returningVisitorsPresent,
      ...presentVisitors
    ];

    const arrivalTimes = allPresent
      .map((p: any) => p.arrivalTime)
      .filter((t): t is string => !!t && t !== "-");

    // Buckets configuration: 30-minute slots from 07:00 to 12:00
    const buckets = [
      { label: "Before 7:30", start: "00:00", end: "07:30", count: 0 },
      { label: "7:30 - 8:00", start: "07:30", end: "08:00", count: 0 },
      { label: "8:00 - 8:30", start: "08:00", end: "08:30", count: 0 },
      { label: "8:30 - 9:00", start: "08:30", end: "09:00", count: 0 },
      { label: "9:00 - 9:30", start: "09:00", end: "09:30", count: 0 },
      { label: "9:30 - 10:00", start: "09:30", end: "10:00", count: 0 },
      { label: "10:00 - 10:30", start: "10:00", end: "10:30", count: 0 },
      { label: "10:30 - 11:00", start: "10:30", end: "11:00", count: 0 },
      { label: "After 11:00", start: "11:00", end: "23:59", count: 0 },
    ];

    arrivalTimes.forEach((t) => {
      for (const bucket of buckets) {
        if (t >= bucket.start && t < bucket.end) {
          bucket.count++;
          break;
        }
      }
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    printWindow.document.write(`
      <html>
        <head>
          <title>Protocol Department Report - ${date}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #141414;
              margin: 30px;
              background-color: #fff;
              line-height: 1.5;
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
              color: #141414;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .title-altar {
              font-size: 11px;
              font-weight: 600;
              color: #0D9762;
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
            @media print {
              body {
                margin: 15px;
              }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell-left">
                <img src="/ministry-logo.png" class="logo-img" alt="Ministry Logo" />
              </td>
              <td class="title-cell-center">
                <div class="title-ministry">THE MINISTRY OF REPENTANCE AND HOLINESS</div>
                <div class="title-altar">Kariobangi Church — Protocol Department</div>
                <div class="title-report">Sunday Service Attendance & Arrival Insights Report</div>
                <div class="title-date">Service Date: ${formattedDate}</div>
              </td>
              <td class="logo-cell-right">
                <img src="/convex.jpeg" class="logo-img" alt="Church Logo" />
              </td>
            </tr>
          </table>

          <div style="border-bottom: 2px solid #0D9762; margin-bottom: 25px;"></div>

          <div style="border: 1px solid #e8e6e3; padding: 20px; border-radius: 12px; background-color: #ffffff; margin-bottom: 25px;">
            <div style="font-size: 13px; font-weight: 600; color: #141414; margin-bottom: 15px; border-bottom: 1px solid #e8e6e3; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
              Sunday Attendance Summary
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px;">
              <!-- Left: Service Total -->
              <div style="display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #e8e6e3; padding-right: 20px;">
                <div style="font-size: 10px; font-weight: 600; color: #525252; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total present today</div>
                <div style="font-size: 40px; font-weight: 300; color: #141414; line-height: 1;">${totalPresent}</div>
              </div>
              
              <!-- Right: Demographic Breakdown -->
              <div>
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 6px 0; color: #525252; font-weight: 500;">Adult Men (Present)</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #141414;">${presentMen.length}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 6px 0; color: #525252; font-weight: 500;">Adult Women (Present)</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #141414;">${presentWomen.length}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 6px 0; color: #525252; font-weight: 500;">Kids (Present)</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #141414;">${presentKids.length}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 6px 0; color: #525252; font-weight: 500;">Returning Visitors (Present)</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0D9762;">${returningVisitorsPresent.length}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #525252; font-weight: 500;">First-Time Visitors (Present)</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0D9762;">${presentVisitors.length}</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>

          <div style="border: 1px solid #e8e6e3; padding: 20px; border-radius: 12px; background-color: #ffffff; margin-bottom: 25px;">
            <div style="font-size: 13px; font-weight: 600; color: #141414; margin-bottom: 15px; border-bottom: 1px solid #e8e6e3; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
              Arrival Times Distribution
            </div>
            
            <!-- CSS Bar Graph -->
            <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 140px; padding: 20px 10px 10px 10px; border-bottom: 2px solid #141414; margin-bottom: 15px; gap: 12px;">
              ${buckets.map((b, idx) => {
                const heightPercent = Math.round((b.count / maxCount) * 100);
                const hasCount = b.count > 0;
                
                // Color coding: Early = Sage, Peak = Amber, Late = Terracotta
                let gradient = 'linear-gradient(to top, #0D9762, #a7ddc7)';
                let border = '#0D9762';
                if (hasCount) {
                  if (idx <= 2) {
                    gradient = 'linear-gradient(to top, #154618, #c3d3c4)'; // Sage
                    border = '#154618';
                  } else if (idx <= 5) {
                    gradient = 'linear-gradient(to top, #0D9762, #a7ddc7)'; // Amber
                    border = '#0D9762';
                  } else {
                    gradient = 'linear-gradient(to top, #0D9762, #a7ddc7)'; // Terracotta
                    border = '#0D9762';
                  }
                }

                return `
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; height: 100%; justify-content: flex-end;">
                    ${hasCount ? `
                      <span style="font-size: 10px; font-weight: 700; color: #141414; margin-bottom: 6px;">
                        ${b.count}
                      </span>
                    ` : ''}
                    <div style="
                      width: 100%; 
                      height: ${Math.max(4, heightPercent)}%; 
                      background: ${hasCount ? gradient : '#fcfbfa'}; 
                      border: 1px solid ${hasCount ? border : '#e8e6e3'}; 
                      border-radius: 6px 6px 0 0;
                    "></div>
                  </div>
                `;
              }).join("")}
            </div>
            
            <!-- X Axis Labels -->
            <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 25px;">
              ${buckets.map(b => `
                <div style="flex: 1; text-align: center; font-size: 9px; color: #525252; font-weight: 600; line-height: 1.2;">
                  ${b.label}
                </div>
              `).join("")}
            </div>
          </div>

          <div style="margin-top: 30px; padding: 10px; border: 1px solid #e8e6e3; background-color: #ffffff; border-radius: 6px; font-size: 10px; color: #8b8884; text-align: center; font-style: italic;">
            Report generated by the Kariobangi Church Attendance System on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. All data is managed in accordance with Altar records.
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsapp = () => {
    const formattedDate = formatDateLong(date);
    
    // Collect present arrival times
    const allPresent = [
      ...presentMen,
      ...presentWomen,
      ...presentKids,
      ...presentUnknown,
      ...returningVisitorsPresent,
      ...presentVisitors
    ];

    const arrivalTimes = allPresent
      .map((p: any) => p.arrivalTime)
      .filter((t): t is string => !!t && t !== "-");

    const buckets = [
      { label: "Before 7:30", start: "00:00", end: "07:30", count: 0 },
      { label: "7:30 - 8:00", start: "07:30", end: "08:00", count: 0 },
      { label: "8:00 - 8:30", start: "08:00", end: "08:30", count: 0 },
      { label: "8:30 - 9:00", start: "08:30", end: "09:00", count: 0 },
      { label: "9:00 - 9:30", start: "09:00", end: "09:30", count: 0 },
      { label: "9:30 - 10:00", start: "09:30", end: "10:00", count: 0 },
      { label: "10:00 - 10:30", start: "10:00", end: "10:30", count: 0 },
      { label: "10:30 - 11:00", start: "10:30", end: "11:00", count: 0 },
      { label: "After 11:00", start: "11:00", end: "23:59", count: 0 },
    ];

    arrivalTimes.forEach((t) => {
      for (const bucket of buckets) {
        if (t >= bucket.start && t < bucket.end) {
          bucket.count++;
          break;
        }
      }
    });

    const text = `*THE MINISTRY OF REPENTANCE AND HOLINESS*
*Kariobangi Church · Protocol Team*
*Sunday Attendance Report*

*Service Date:* ${formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━
*ATTENDANCE SUMMARY*
━━━━━━━━━━━━━━━━━━━━━━━━
• *Total Present:* ${totalPresent}
• *Adult Men:* ${presentMen.length}
• *Adult Women:* ${presentWomen.length}
• *Present Kids:* ${presentKids.length}
• *Returning Visitors:* ${returningVisitorsPresent.length}
• *First-Time Visitors:* ${presentVisitors.length}

━━━━━━━━━━━━━━━━━━━━━━━━
*ARRIVAL TIMES DISTRIBUTION*
━━━━━━━━━━━━━━━━━━━━━━━━
${buckets.filter(b => b.count > 0).map(b => `• ${b.label}: *${b.count}* arrived`).join("\n") || "No arrival times recorded."}

_Report generated by Kariobangi Church Attendance System._`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const exportVisitorsCsv = () => {
    if (!presentVisitors.length) return;
    const prefix = new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const headers = ["Name Prefix", "First Name", "Phone 1 - Value", "Address 1 - Street", "Notes"];
    const rows = presentVisitors.map((v: any) => {
      const notesParts = [];
      if (v.relationshipStatus) notesParts.push(`Status: ${v.relationshipStatus}`);
      if (v.fromOtherChurch === true) notesParts.push("Source: Another church");
      if (v.fromOtherChurch === false) notesParts.push("Source: Our branch");
      if (v.previousChurch) notesParts.push(`From: ${v.previousChurch}`);
      return [prefix, v.name || "", v.contact || "", v.residence || "", notesParts.join(" | ")];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `visitors-${date}.csv`;
    link.click();
  };

  const exportAbsentCsv = () => {
    if (!absentExportList.length) return;
    const headers = ["Name", "Type", "Sundays Attended", "Contact", "Residence", "Gender", "Department", "Status", "Last Seen"];
    const rows = absentExportList.map((m: any) => [
      m.name,
      m.type === "kid" ? "Kid" : m.type === "returningVisitor" ? "Returning visitor" : "Member",
      m.sundaysAttended ?? 0,
      m.contact ?? "",
      m.residence ?? "",
      m.gender ?? "",
      m.department ?? "",
      m.status ?? "",
      m.lastSeenDate ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `absent-${date}.csv`;
    link.click();
  };

  const handlePrintDetailedAdminPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    const formattedDate = formatDateLong(date);
    const allGraduatesList = sundayMetrics?.graduates ?? [];
    const graduatesList = allGraduatesList.filter((g: any) => !excludedGraduates.has(g.name));
    const graduatesCount = graduatesList.length;

    printWindow.document.write(`
      <html>
        <head>
          <title>Detailed Sunday Admin Report - ${date}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #141414;
              margin: 30px;
              background-color: #fff;
              line-height: 1.5;
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
              color: #141414;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .title-altar {
              font-size: 11px;
              font-weight: 600;
              color: #0D9762;
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
            .section-card {
              border: 1px solid #e8e6e3;
              padding: 18px;
              border-radius: 12px;
              background-color: #ffffff;
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #141414;
              margin-bottom: 12px;
              border-bottom: 1px solid #e8e6e3;
              padding-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .grid-stats {
              display: grid;
              grid-template-columns: 1fr 1.5fr;
              gap: 20px;
            }
            .stat-box {
              border-right: 1px solid #e8e6e3;
              padding-right: 15px;
            }
            .stat-box:last-child {
              border-right: none;
            }
            .content-block {
              margin-bottom: 15px;
            }
            .content-label {
              font-size: 10px;
              font-weight: 600;
              color: #8b8884;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .content-text {
              font-size: 12px;
              color: #141414;
              white-space: pre-wrap;
            }
            .table-list {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            .table-list th {
              background-color: #f4f4f5;
              color: #5d5a56;
              font-weight: 600;
              text-align: left;
              padding: 6px 8px;
              border: 1px solid #e8e6e3;
            }
            .table-list td {
              padding: 6px 8px;
              border: 1px solid #e8e6e3;
            }
            .signature-table {
              width: 100%;
              margin-top: 40px;
              font-size: 11px;
            }
            .signature-line {
              border-top: 1px solid #0D9762;
              margin-top: 45px;
              padding-top: 5px;
              color: #525252;
            }
            @media print {
              body {
                margin: 15px;
              }
              .section-card {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell-left">
                <img src="/ministry-logo.png" class="logo-img" alt="Ministry Logo" />
              </td>
              <td class="title-cell-center">
                <div class="title-ministry">THE MINISTRY OF REPENTANCE AND HOLINESS</div>
                <div class="title-altar">Kariobangi Church — Protocol Department</div>
                <div class="title-report">Detailed Sunday Service Report</div>
                <div class="title-date">Service Date: ${formattedDate}</div>
              </td>
              <td class="logo-cell-right">
                <img src="/convex.jpeg" class="logo-img" alt="Church Logo" />
              </td>
            </tr>
          </table>

          <div style="border-bottom: 2px solid #0D9762; margin-bottom: 20px;"></div>

          <!-- Section 1: Executive Summary -->
          <div class="section-card">
            <div class="section-title">I. Attendance & Pipeline Summary</div>
            <div class="grid-stats">
              <div class="stat-box" style="display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size: 9px; font-weight: 600; color: #8b8884; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Service Attendance</div>
                <div style="font-size: 32px; font-weight: 300; color: #141414; line-height: 1;">${totalPresent}</div>
                <div style="font-size: 10px; color: #525252; margin-top: 5px;">
                  Men: ${presentMen.length} | Women: ${presentWomen.length} | Kids: ${presentKids.length}
                </div>
              </div>
              
              <div style="display: flex; flex-direction: column; justify-content: center; padding-left: 10px;">
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 4px 0; color: #525252;">First-Time Visitors</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #141414;">${presentVisitors.length}</td>
                  </tr>
                  <tr style="border-bottom: 1px dashed #e8e6e3;">
                    <td style="padding: 4px 0; color: #525252;">Returning Visitors</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #141414;">${returningVisitorsPresent.length}</td>
                  </tr>
                  ${graduatesCount > 0 ? `<tr>
                     <td style="padding: 4px 0; color: #525252;">Graduates for the Week</td>
                     <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #154618;">${graduatesCount}</td>
                   </tr>` : ''}
                </table>
              </div>
            </div>
          </div>

          <!-- Section 2: Admin Briefing -->
          <div class="section-card">
            <div class="section-title">II. Weekly Admin Briefing</div>
            
            <div class="content-block">
              <div class="content-label">Key Successes & Highlights</div>
              <div class="content-text">${successes ? successes.trim() : "No successes or highlights were logged for this week."}</div>
            </div>

            <div class="content-block">
              <div class="content-label">Challenges & Pain Points</div>
              <div class="content-text">${challenges ? challenges.trim() : "No challenges or concerns were logged for this week."}</div>
            </div>

            <div class="content-block">
              <div class="content-label">Strategic Next Steps</div>
              <div class="content-text">${nextSteps ? nextSteps.trim() : "No next steps were logged for the upcoming week."}</div>
            </div>
          </div>

          ${graduatesCount > 0 ? `
          <!-- Section 3: Graduates of the Week -->
          <div class="section-card">
            <div class="section-title">III. Pipeline Graduates of the Week (${graduatesCount})</div>
              <table class="table-list">
                <thead>
                  <tr>
                    <th>Graduand Name</th>
                    <th>Gender</th>
                    <th>Assigned Department</th>
                    <th>Graduation Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${graduatesList.map((g: any) => `
                    <tr>
                      <td style="font-weight: 600;">${g.name}</td>
                      <td>${g.gender}</td>
                      <td>${g.department || "None Specified"}</td>
                      <td>${formatIsoDate(g.graduationDate)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
          </div>` : ''}

          <!-- Signature Block -->
          <table class="signature-table">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <div class="signature-line">
                  <strong>Prepared By:</strong><br />
                  ${preparedBy || "Altar Protocol Head"}
                </div>
              </td>
              <td style="width: 50%;"></td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding: 10px; border: 1px solid #e8e6e3; background-color: #ffffff; border-radius: 6px; font-size: 9px; color: #8b8884; text-align: center; font-style: italic; page-break-inside: avoid;">
            Report generated by the Kariobangi Church Attendance System on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. All protocol activities are supervised under Altar guidance.
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareDetailedAdminWhatsapp = () => {
    const formattedDate = formatDateLong(date);
    const allGradsList = sundayMetrics?.graduates ?? [];
    const filteredGradsList = allGradsList.filter((g: any) => !excludedGraduates.has(g.name));
    const graduatesCount = filteredGradsList.length;

    const text = `*THE MINISTRY OF REPENTANCE AND HOLINESS*
*Kariobangi Church · Protocol Team*
*Detailed Sunday Admin Report*

*Service Date:* ${formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━
*I. ATTENDANCE & VISITOR METRICS*
━━━━━━━━━━━━━━━━━━━━━━━━
• *Total Service Attendance:* ${totalPresent}
• *Adult Men:* ${presentMen.length}
• *Adult Women:* ${presentWomen.length}
• *Present Kids:* ${presentKids.length}
• *Returning Visitors:* ${returningVisitorsPresent.length}
• *First-Time Visitors:* ${presentVisitors.length}

${graduatesCount > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━
*II. WEEKLY GRADUATIONS*
━━━━━━━━━━━━━━━━━━━━━━━━
• *Weekly Pipeline Graduates:* ${graduatesCount}
` : ''}
${successes || challenges || nextSteps ? `━━━━━━━━━━━━━━━━━━━━━━━━
*${graduatesCount > 0 ? 'III' : 'II'}. WEEKLY BRIEFING HIGHLIGHTS*
━━━━━━━━━━━━━━━━━━━━━━━━
*Successes & Highlights:*
${successes ? successes.trim() : "None logged."}

*Challenges & Pain Points:*
${challenges ? challenges.trim() : "None logged."}

*Strategic Next Steps:*
${nextSteps ? nextSteps.trim() : "None logged."}` : `━━━━━━━━━━━━━━━━━━━━━━━━
*${graduatesCount > 0 ? 'III' : 'II'}. WEEKLY BRIEFING HIGHLIGHTS*
━━━━━━━━━━━━━━━━━━━━━━━━
*Successes & Highlights:*
None logged.

*Challenges & Pain Points:*
None logged.

*Strategic Next Steps:*
None logged.`}
${graduatesCount > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━
*IV. GRADUATES RECORDED*
━━━━━━━━━━━━━━━━━━━━━━━━
${filteredGradsList.map((g: any) => `• *${g.name}* (${g.gender}) → ${g.department || "No Department"}`).join("\n") || "No graduations recorded."}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━
*Prepared By:* ${preparedBy || "Altar Protocol Head"}

_Report generated by Kariobangi Church Attendance System._`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <AuthenticatedLayout>
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header bar */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(0, 0, 0, 0.06)`
          }}
        >
          <span className="text-sm" style={{ color: colors.text.secondary }}>
            {formatIsoDate(date)}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintPdf}
              className="text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}
            >
              Export PDF
            </button>
            <button
              onClick={handleShareWhatsapp}
              className="text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: "#25d366", color: "#ffffff" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
              </svg>
              Share Whatsapp
            </button>
            <Link
              href="/attendance/history"
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              Back
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          
          {/* Brand Header */}
          <div 
            className="flex items-center justify-between gap-4 mb-6 p-4 rounded-2xl border"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: `rgba(0, 0, 0, 0.08)`
            }}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <img 
                src="/ministry-logo.png" 
                alt="Ministry Logo" 
                className="w-14 h-14 object-contain flex-shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold tracking-wider uppercase truncate" style={{ color: colors.text.primary }}>
                  THE MINISTRY OF REPENTANCE AND HOLINESS
                </h1>
                <h2 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: colors.accent.amber }}>
                  Kariobangi Church — Protocol Department
                </h2>
                <p className="text-[9px] sm:text-[10px] mt-0.5" style={{ color: colors.text.secondary }}>
                  Sunday Service Roster & Attendance Report
                </p>
              </div>
            </div>
            <img 
              src="/convex.jpeg"
              alt="Church Logo" 
              className="w-12 h-12 object-contain flex-shrink-0 hidden sm:block"
            />
          </div>
          
          {/* Flat Clean Stats Banner */}
          <div 
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: colors.text.primary }}
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div>
                <div className="text-4xl font-light mb-1 text-white">{totalPresent}</div>
                <div className="text-xs text-white/60">Total present</div>
              </div>
              <div className="w-px h-10 bg-white/20 hidden sm:block" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">{presentMembersKids}</div>
                <div className="text-xs text-white/60">Members & kids</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">{presentVisitors.length + returningVisitorsPresent.length}</div>
                <div className="text-xs text-white/60">Visitors</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white/60">{totalAbsent}</div>
                <div className="text-xs text-white/40">Absent</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white/60">{attendanceRate}%</div>
                <div className="text-xs text-white/40">Rate</div>
              </div>
            </div>

            {/* Flat Gender Breakdown */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60">
              <div>Men: <span className="text-white font-light">{presentMen.length}</span></div>
              <div>Women: <span className="text-white font-light">{presentWomen.length}</span></div>
              <div>Kids: <span className="text-white font-light">{presentKids.length}</span></div>
            </div>
          </div>

          {/* Detailed Sunday Admin Report Card */}
          <div 
            className="rounded-2xl p-5 mb-6 border transition-all"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: showAdminReportForm ? colors.accent.amber : 'rgba(0, 0, 0, 0.08)' 
            }}
          >
            <button
              id="toggle-admin-report-btn"
              onClick={() => setShowAdminReportForm(!showAdminReportForm)}
              className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
            >
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: colors.text.primary }}>
                  <span>📋 Detailed Sunday Admin Report</span>
                </h3>
                <p className="text-[10px] mt-1" style={{ color: colors.text.secondary }}>
                  Prepare weekly graduation metrics, successes, and next steps before exporting.
                </p>
              </div>
              <span className="text-xs transition-transform duration-200" style={{ transform: showAdminReportForm ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </button>

            {showAdminReportForm && (
              <div className="mt-5 space-y-4 pt-4 border-t border-[#141414]/6">
                {/* Stats summary preview */}
                <div className="p-3 rounded-xl bg-[#141414]/4 grid grid-cols-2 gap-3 text-xs">
                  {sundayMetrics !== undefined && (sundayMetrics?.graduatesCount ?? 0) > 0 && (
                    <div>
                      <span style={{ color: colors.text.secondary }}>Weekly Graduates:</span>
                      <span className="font-bold ml-1.5" style={{ color: colors.accent.sage }}>
                        {(() => {
                          const total = sundayMetrics?.graduatesCount ?? 0;
                          const excluded = (sundayMetrics?.graduates ?? []).filter((g: any) => excludedGraduates.has(g.name)).length;
                          return excluded > 0 ? `${total - excluded} / ${total}` : total;
                        })()}
                      </span>
                    </div>
                  )}
                  {sundayMetrics !== undefined && (sundayMetrics?.graduatesCount ?? 0) === 0 && (
                    <div className="col-span-2">
                      <span className="text-[10px] italic" style={{ color: colors.text.muted }}>No graduation activity recorded for this week.</span>
                    </div>
                  )}
                  {sundayMetrics === undefined && (
                    <div className="col-span-2">
                      <span style={{ color: colors.text.muted }}>Loading metrics...</span>
                    </div>
                  )}
                </div>

                {/* Textarea & Text Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider block mb-1.5" style={{ color: colors.text.secondary }}>
                      Prepared By
                    </label>
                    <input
                      id="report-preparedby-input"
                      type="text"
                      placeholder="e.g. Altar Protocol Head"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      className="w-full p-3 rounded-xl text-xs focus:outline-none border bg-white"
                      style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider block mb-1.5" style={{ color: colors.text.secondary }}>
                      Key Successes & Highlights
                    </label>
                    <textarea
                      id="report-successes-input"
                      placeholder="Input any successes, breakthroughs or positive highlights from the weekly service..."
                      value={successes}
                      onChange={(e) => setSuccesses(e.target.value)}
                      className="w-full p-3 rounded-xl text-xs focus:outline-none border bg-white min-h-[70px] resize-y"
                      style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider block mb-1.5" style={{ color: colors.text.secondary }}>
                      Challenges & Pain Points
                    </label>
                    <textarea
                      id="report-challenges-input"
                      placeholder="Input any challenges, concerns, absent trends or difficulties faced..."
                      value={challenges}
                      onChange={(e) => setChallenges(e.target.value)}
                      className="w-full p-3 rounded-xl text-xs focus:outline-none border bg-white min-h-[70px] resize-y"
                      style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider block mb-1.5" style={{ color: colors.text.secondary }}>
                      Strategic Next Steps
                    </label>
                    <textarea
                      id="report-nextsteps-input"
                      placeholder="Input action points, planned outreach, assignments or strategic interventions..."
                      value={nextSteps}
                      onChange={(e) => setNextSteps(e.target.value)}
                      className="w-full p-3 rounded-xl text-xs focus:outline-none border bg-white min-h-[70px] resize-y"
                      style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                    />
                  </div>
                </div>

                {/* Graduates List - Editable */}
                {sundayMetrics && (sundayMetrics.graduates ?? []).length > 0 && (
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider block mb-1.5" style={{ color: colors.text.secondary }}>
                      Graduates of the Week ({(sundayMetrics.graduates ?? []).filter((g: any) => !excludedGraduates.has(g.name)).length} / {(sundayMetrics.graduates ?? []).length})
                    </label>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0, 0, 0, 0.12)' }}>
                      {(sundayMetrics.graduates ?? []).map((g: any, i: number) => {
                        const isExcluded = excludedGraduates.has(g.name);
                        return (
                          <div
                            key={g.name + i}
                            className={`flex items-center justify-between px-3 py-2.5 transition-all ${
                              i > 0 ? 'border-t' : ''
                            }`}
                            style={{
                              borderColor: 'rgba(0, 0, 0, 0.06)',
                              backgroundColor: isExcluded ? 'rgba(0, 0, 0, 0.03)' : '#ffffff',
                              opacity: isExcluded ? 0.5 : 1,
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-sm">🎓</span>
                              <div className="min-w-0">
                                <span
                                  className={`text-xs font-semibold block truncate ${isExcluded ? 'line-through' : ''}`}
                                  style={{ color: colors.text.primary }}
                                >
                                  {g.name}
                                </span>
                                <span className="text-[10px] block" style={{ color: colors.text.muted }}>
                                  {g.gender} · {g.department || 'No Dept'} · {g.type === 'kid' ? '👶 Kid' : 'Member'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setExcludedGraduates(prev => {
                                  const next = new Set(prev);
                                  if (next.has(g.name)) {
                                    next.delete(g.name);
                                  } else {
                                    next.add(g.name);
                                  }
                                  return next;
                                });
                              }}
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors flex-shrink-0"
                              style={{
                                backgroundColor: isExcluded ? 'rgba(157, 184, 140, 0.15)' : 'rgba(176, 128, 128, 0.1)',
                                color: isExcluded ? colors.accent.sage : '#b08080',
                              }}
                            >
                              {isExcluded ? 'Restore' : 'Remove'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {excludedGraduates.size > 0 && (
                      <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: colors.accent.terracotta }}>
                        <span>⚠️</span> {excludedGraduates.size} graduate{excludedGraduates.size > 1 ? 's' : ''} excluded from export
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    id="export-detailed-pdf-btn"
                    onClick={handlePrintDetailedAdminPdf}
                    className="flex-1 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                    style={{ backgroundColor: colors.text.primary, color: '#ffffff' }}
                  >
                    Export Detailed PDF
                  </button>
                  <button
                    id="share-detailed-whatsapp-btn"
                    onClick={handleShareDetailedAdminWhatsapp}
                    className="flex-1 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "#25d366", color: "#ffffff" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                    </svg>
                    Share WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Flat Search bar */}
          <div className="relative mb-5">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none transition-colors border-0"
              style={{
                backgroundColor: colors.surface,
                color: colors.text.primary
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs cursor-pointer"
                style={{ color: colors.text.muted }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Flat Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: "present", label: `Present (${filteredPresentMen.length + filteredPresentWomen.length + filteredPresentKids.length + filteredPresentUnknown.length + filteredReturningVisitorsPresent.length})` },
              { id: "absent", label: `Absent (${filteredAbsentMembers.length + filteredReturningVisitorsAbsent.length})` },
              { id: "visitors", label: `New visitors (${filteredPresentVisitors.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 py-2 rounded-full text-xs transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeTab === tab.id ? colors.accent.amberLight : colors.surface,
                  color: activeTab === tab.id ? colors.text.primary : colors.text.secondary,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Present Tab */}
          {activeTab === "present" && (
            <div className="space-y-6">
              {/* Men */}
              {filteredPresentMen.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Men ({filteredPresentMen.length})
                  </div>
                  <div className="space-y-2">
                    {filteredPresentMen.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Women */}
              {filteredPresentWomen.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Women ({filteredPresentWomen.length})
                  </div>
                  <div className="space-y-2">
                    {filteredPresentWomen.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Kids */}
              {filteredPresentKids.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Kids ({filteredPresentKids.length})
                  </div>
                  <div className="space-y-2">
                    {filteredPresentKids.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown gender */}
              {filteredPresentUnknown.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Unknown gender ({filteredPresentUnknown.length})
                  </div>
                  <div className="space-y-2">
                    {filteredPresentUnknown.map((m: any) => (
                      <div key={m.memberId} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm" style={{ color: colors.text.primary }}>{m.name}</div>
                            <div className="text-xs" style={{ color: colors.text.muted }}>{m.contact || "No contact"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingUnknown({
                                memberId: m.memberId, name: m.name, contact: m.contact ?? null,
                                residence: m.residence ?? null, gender: m.gender ?? null,
                                department: m.department ?? null, status: m.status ?? null,
                              })}
                              className="text-xs px-2 py-1 rounded-full font-light"
                              style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => togglePresent(m.memberId, true)}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Returning visitors */}
              {filteredReturningVisitorsPresent.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Returning visitors ({filteredReturningVisitorsPresent.length})
                  </div>
                  <div className="space-y-2">
                    {filteredReturningVisitorsPresent.map((m: any) => (
                      <PersonRow 
                        key={m.memberId} 
                        person={m} 
                        present 
                        onToggle={() => togglePresent(m.memberId, true)}
                        onHistory={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredPresentMen.length === 0 && 
               filteredPresentWomen.length === 0 && 
               filteredPresentKids.length === 0 && 
               filteredPresentUnknown.length === 0 && 
               filteredReturningVisitorsPresent.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No matches
                </div>
              )}
            </div>
          )}

          {/* Absent Tab */}
          {activeTab === "absent" && (
            <div className="space-y-6">
              {/* Export configuration */}
              {(absentMembers.length > 0 || returningVisitorsAbsent.length > 0) && (
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: showAbsentExportOptions ? colors.accent.amber : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <button
                    onClick={() => setShowAbsentExportOptions(!showAbsentExportOptions)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm" style={{ color: colors.text.primary }}>
                        Export absent list
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: colors.text.secondary }}>
                        {absentExportList.length} of {absentMembers.length + returningVisitorsAbsent.length} absentees selected
                      </div>
                    </div>
                    <span className="text-xs transition-transform duration-200 flex-shrink-0" style={{ transform: showAbsentExportOptions ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>

                  {showAbsentExportOptions && (
                    <div className="px-4 pb-4 space-y-4 border-t pt-4" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                      {/* Who to include */}
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: colors.text.secondary }}>
                          Include
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                            <input
                              type="checkbox"
                              checked={exportIncludeMembers}
                              onChange={(e) => setExportIncludeMembers(e.target.checked)}
                              className="rounded accent-[#0D9762]"
                            />
                            Members
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                            <input
                              type="checkbox"
                              checked={exportIncludeKids}
                              onChange={(e) => setExportIncludeKids(e.target.checked)}
                              className="rounded accent-[#0D9762]"
                            />
                            Kids
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                            <input
                              type="checkbox"
                              checked={exportIncludeReturningVisitors}
                              onChange={(e) => setExportIncludeReturningVisitors(e.target.checked)}
                              className="rounded accent-[#0D9762]"
                            />
                            Returning visitors
                          </label>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer mt-2" style={{ color: colors.text.secondary }}>
                          <input
                            type="checkbox"
                            checked={exportOnlyWithContact}
                            onChange={(e) => setExportOnlyWithContact(e.target.checked)}
                            className="rounded accent-[#0D9762]"
                          />
                          Only people with a phone number
                        </label>
                      </div>

                      {/* Sundays attended range */}
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: colors.text.secondary }}>
                          Sundays attended before {formatIsoDate(date)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] block mb-1" style={{ color: colors.text.muted }}>Minimum</label>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              placeholder="Any"
                              value={exportMinSundays}
                              onChange={(e) => setExportMinSundays(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs focus:outline-none border bg-white"
                              style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] block mb-1" style={{ color: colors.text.muted }}>Maximum</label>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              placeholder="Any"
                              value={exportMaxSundays}
                              onChange={(e) => setExportMaxSundays(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs focus:outline-none border bg-white"
                              style={{ borderColor: 'rgba(0, 0, 0, 0.12)', color: colors.text.primary }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[
                            { label: "Any", min: "", max: "" },
                            { label: "Never attended", min: "", max: "0" },
                            { label: "1–3 Sundays", min: "1", max: "3" },
                            { label: "4+ Sundays", min: "4", max: "" },
                          ].map((preset) => {
                            const active = exportMinSundays === preset.min && exportMaxSundays === preset.max;
                            return (
                              <button
                                key={preset.label}
                                onClick={() => {
                                  setExportMinSundays(preset.min);
                                  setExportMaxSundays(preset.max);
                                }}
                                className="text-[10px] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                                style={{
                                  backgroundColor: active ? colors.accent.amberLight : colors.surfaceHover,
                                  color: active ? colors.text.primary : colors.text.secondary,
                                }}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="px-4 pb-4">
                    <button
                      onClick={exportAbsentCsv}
                      disabled={absentExportList.length === 0}
                      className="w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: absentExportList.length === 0 ? colors.surfaceHover : colors.text.primary,
                        color: absentExportList.length === 0 ? colors.text.muted : '#ffffff',
                      }}
                    >
                      {absentExportList.length === 0
                        ? "No one matches the export filters"
                        : `Export ${absentExportList.length} absentee${absentExportList.length > 1 ? "s" : ""} CSV`}
                    </button>
                  </div>
                </div>
              )}

              {/* Members/Kids */}
              {filteredAbsentMembers.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Members & kids ({filteredAbsentMembers.length})
                  </div>
                  <div className="space-y-2">
                    {filteredAbsentMembers.map((m: any) => {
                      const recency = getRecencyStyle(m.lastSeenDate);
                      const included = isInAbsentExport(m);
                      return (
                        <div
                          key={m.memberId}
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: colors.surface, opacity: included ? 1 : 0.55 }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm flex flex-wrap items-baseline gap-x-2" style={{ color: colors.text.primary }}>
                                <span>{m.name}</span>
                                <span className="text-[10px]" style={{ color: recency.color }}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5" style={{ color: colors.text.muted }}>
                                <span>
                                  {m.type === "kid" ? "Kid" : m.gender || "Member"}{m.department && ` • ${m.department}`}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                                  {m.sundaysAttended ?? 0} Sunday{(m.sundaysAttended ?? 0) === 1 ? "" : "s"}
                                </span>
                                {!included && (
                                  <span className="text-[10px]" style={{ color: colors.text.muted }}>· not in export</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                                className="text-xs px-2 py-1 rounded-full cursor-pointer"
                                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                              >
                                History
                              </button>
                              <button
                                onClick={() => togglePresent(m.memberId, false)}
                                className="text-xs px-2 py-1 rounded-full cursor-pointer"
                                style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                              >
                                Present
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Returning visitors absent */}
              {filteredReturningVisitorsAbsent.length > 0 && (
                <div>
                  <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                    Returning visitors absent ({filteredReturningVisitorsAbsent.length})
                  </div>
                  <div className="space-y-2">
                    {filteredReturningVisitorsAbsent.map((m: any) => {
                      const recency = getRecencyStyle(m.lastSeenDate);
                      const included = isInAbsentExport(m);
                      return (
                        <div
                          key={m.memberId}
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: colors.surface, opacity: included ? 1 : 0.55 }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm flex flex-wrap items-baseline gap-x-2" style={{ color: colors.text.primary }}>
                                <span>{m.name}</span>
                                <span className="text-[10px]" style={{ color: recency.color }}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5" style={{ color: colors.text.muted }}>
                                <span>Visitor{m.residence && ` • ${m.residence}`}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>
                                  {m.sundaysAttended ?? 0} Sunday{(m.sundaysAttended ?? 0) === 1 ? "" : "s"}
                                </span>
                                {!included && (
                                  <span className="text-[10px]" style={{ color: colors.text.muted }}>· not in export</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                                className="text-xs px-2 py-1 rounded-full cursor-pointer"
                                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                              >
                                History
                              </button>
                              <button
                                onClick={() => togglePresent(m.memberId, false)}
                                className="text-xs px-2 py-1 rounded-full cursor-pointer"
                                style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                              >
                                Present
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredAbsentMembers.length === 0 && filteredReturningVisitorsAbsent.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No matches
                </div>
              )}
            </div>
          )}

          {/* Visitors Tab */}
          {activeTab === "visitors" && (
            <div className="space-y-4">
              {/* Export button */}
              {filteredPresentVisitors.length > 0 && (
                <button
                  onClick={exportVisitorsCsv}
                  className="w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer border border-[#141414]/10"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  Export visitors CSV
                </button>
              )}

              {filteredPresentVisitors.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No visitors match
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPresentVisitors.map((v: any) => (
                    <div key={v.memberId} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                      <div className="text-sm mb-1" style={{ color: colors.text.primary }}>{v.name}</div>
                      {v.contact && (
                        <a href={`tel:${v.contact}`} className="text-xs block mb-1" style={{ color: colors.accent.amber }}>
                          {v.contact}
                        </a>
                      )}
                      {v.residence && (
                        <div className="text-xs mb-2" style={{ color: colors.text.muted }}>{v.residence}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => setHistoryVisitor({ name: v.name, memberId: v.memberId })}
                          className="text-xs px-2 py-1 rounded-full cursor-pointer"
                          style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                        >
                          History
                        </button>
                        <button
                          onClick={() => togglePresent(v.memberId, true)}
                          className="text-xs px-2 py-1 rounded-full cursor-pointer"
                          style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* History Modal */}
        {historyVisitor && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm mb-4" style={{ color: colors.text.primary }}>
                {historyVisitor.name}
              </div>
              {visitorHistory === undefined ? (
                <div className="py-4 text-sm" style={{ color: colors.text.muted }}>Loading…</div>
              ) : !visitorHistory?.length ? (
                <div className="py-4 text-sm" style={{ color: colors.text.muted }}>No attendance records</div>
              ) : (
                <div className="space-y-2 mb-4">
                  {visitorHistory.map((r: any) => (
                    <div key={r._id} className="flex items-center justify-between py-2 text-sm">
                      <span style={{ color: colors.text.secondary }}>{formatDateLong(r.date)}</span>
                      <span style={{ color: r.present ? colors.accent.sage : colors.text.muted }}>
                        {r.present ? "Present" : "Absent"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setHistoryVisitor(null)}
                className="w-full py-3 rounded-xl text-sm cursor-pointer"
                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Edit Modals */}
        {editingUnknown && (
          <MemberEditor
            open={!!editingUnknown}
            onClose={() => setEditingUnknown(null)}
            member={editingUnknown}
            onSaved={() => setEditingUnknown(null)}
            allowMoveToKids
          />
        )}
        {editingAbsentMember && (
          <MemberEditor
            open={!!editingAbsentMember}
            onClose={() => setEditingAbsentMember(null)}
            member={editingAbsentMember}
            onSaved={() => setEditingAbsentMember(null)}
            allowMoveToKids
          />
        )}
        {editingAbsentKid && (
          <KidEditor
            open={!!editingAbsentKid}
            onClose={() => setEditingAbsentKid(null)}
            kid={editingAbsentKid}
            onSaved={() => setEditingAbsentKid(null)}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}

// Helper component for person rows
function PersonRow({ person, present, onToggle, onHistory }: { 
  person: any; 
  present: boolean; 
  onToggle: () => void;
  onHistory: () => void;
}) {
  const colors = {
    bg: '#f4f4f5',
    surface: '#ffffff',
    surfaceHover: '#ececee',
    text: {
      primary: '#141414',
      secondary: '#525252',
      muted: '#a1a1a1',
    },
    accent: {
      amber: '#0D9762',
      sage: '#154618',
      sageLight: '#c3d3c4',
      terracotta: '#0D9762',
      terracottaLight: '#a7ddc7',
    }
  };

  return (
    <div className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ color: colors.text.primary }}>
            {person.name}
            {present && person.arrivalTime && (
              <span className="text-[10px] ml-2 font-light flex items-center inline-flex gap-1" style={{ color: colors.accent.amber }}>
                <Clock className="w-2.5 h-2.5" />
                <span>{person.arrivalTime}</span>
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {person.contact || "No contact"}
            {person.department && ` • ${person.department}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onHistory}
            className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
          >
            History
          </button>
          <button
            onClick={onToggle}
            className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors"
            style={{ 
              backgroundColor: present ? colors.accent.terracottaLight : colors.accent.sageLight,
              color: present ? colors.accent.terracotta : colors.accent.sage
            }}
          >
            {present ? 'Absent' : 'Present'}
          </button>
        </div>
      </div>
    </div>
  );
}
