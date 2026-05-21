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

// Original Color Palette
const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: {
    primary: '#3d3a36',
    secondary: '#6b6864',
    muted: '#9a9793',
  },
  accent: {
    amber: '#c9a87c',
    amberLight: '#e8dcc8',
    sage: '#9db88c',
    sageLight: '#c5d4be',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
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

    const formatCategory = (m: any) => {
      const genderLower = (m.gender || "").toLowerCase();
      const statusLower = (m.status || "").toLowerCase();
      
      if (m.type === "kid") return "Kid";
      
      if (statusLower === "married") {
        if (genderLower === "male") return "Men (Married)";
        if (genderLower === "female") return "Women (Married)";
        return "Married";
      }
      
      if (statusLower === "youth" || statusLower === "single") {
        if (genderLower === "male") return "Youth Men";
        if (genderLower === "female") return "Youth Ladies";
        return "Youth";
      }
      
      if (genderLower === "male") return "Male Member";
      if (genderLower === "female") return "Female Member";
      return "Member";
    };

    const presentMembers = [
      ...presentMen.map((m: any) => ({ ...m, category: formatCategory(m) })),
      ...presentWomen.map((m: any) => ({ ...m, category: formatCategory(m) })),
      ...presentUnknown.map((m: any) => ({ ...m, category: formatCategory(m) })),
    ];

    const returningVisitors = [
      ...returningVisitorsPresent.map((m: any) => ({ ...m, category: "Returning Visitor" })),
    ];

    const newVisitors = [
      ...presentVisitors.map((m: any) => ({ ...m, category: "New Visitor", arrivalTime: m.arrivalTime || "-" })),
    ];

    const parseTime = (timeStr?: string) => {
      if (!timeStr || timeStr === "-") return 999999;
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    // Sort by arrivalTime ascending
    const sortedPresentMembers = [...presentMembers].sort((a, b) => parseTime(a.arrivalTime) - parseTime(b.arrivalTime));
    const sortedReturningVisitors = [...returningVisitors].sort((a, b) => parseTime(a.arrivalTime) - parseTime(b.arrivalTime));
    const sortedNewVisitors = [...newVisitors].sort((a, b) => parseTime(a.arrivalTime) - parseTime(b.arrivalTime));

    const allAbsent = [
      ...absentMembers.filter((m: any) => m.type !== "kid").map((m: any) => ({ ...m, category: formatCategory(m), lastSeen: m.lastSeenDate })),
      ...returningVisitorsAbsent.map((m: any) => ({ ...m, category: "Returning Visitor", lastSeen: m.lastSeenDate })),
    ];

    const presentMembersRows = sortedPresentMembers.map((p, idx) => `
      <tr>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36;">${p.name}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.category}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.contact || "-"}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #c9a87c;">
          ${p.arrivalTime || "-"}
        </td>
      </tr>
    `).join("");

    const returningVisitorsRows = sortedReturningVisitors.map((p, idx) => {
      const totalSundays = (p.sundayCount || 0) + 1;
      const isGraduate = totalSundays >= 3;
      const statusText = isGraduate 
        ? `<span style="background-color: #c5d4be; color: #3d3a36; padding: 2px 6px; border-radius: 4px; font-weight: 500;">Graduate</span>` 
        : `<span style="color: #6b6864;">Regular Visitor</span>`;
      return `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36;">${p.name}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.residence || "-"}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.contact || "-"}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #3d3a36;">
            Visit #${totalSundays} (attended ${p.sundayCount || 0} previous Sunday${(p.sundayCount || 0) === 1 ? '' : 's'})
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #c9a87c;">
            ${p.arrivalTime || "-"}
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center;">
            ${statusText}
          </td>
        </tr>
      `;
    }).join("");

    const newVisitorsRows = sortedNewVisitors.map((p, idx) => `
      <tr>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36;">${p.name}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.residence || "-"}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${p.contact || "-"}</td>
        <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #c9a87c;">
          ${p.arrivalTime || "-"}
        </td>
      </tr>
    `).join("");

    const absentRows = allAbsent.map((a, idx) => {
      const clusterInfo = a.clusterName 
        ? `${a.clusterName} (${a.clusterLeader ? `Leader: ${a.clusterLeader}` : 'No leader'})` 
        : "-";
      return `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864;">${idx + 1}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36;">${a.name}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${a.category}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${a.contact || "-"}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864;">${clusterInfo}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #c49a84;">
            ${a.lastSeen ? formatIsoDate(a.lastSeen) : "Never seen"}
          </td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Protocol Department Report - ${date}</title>
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
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell-left">
                <img src="/ministry-logo.png" class="logo-img" alt="Ministry Logo" />
              </td>
              <td class="title-cell-center">
                <div class="title-ministry">THE MINISTRY OF REPENTANCE AND HOLINESS</div>
                <div class="title-altar">Imara Daima Main Altar — Protocol Department</div>
                <div class="title-report">Sunday Service Roster & Attendance Report</div>
                <div class="title-date">Service Date: ${formattedDate}</div>
              </td>
              <td class="logo-cell-right">
                <img src="/convex.svg" class="logo-img" alt="Church Logo" />
              </td>
            </tr>
          </table>

          <div class="stats-row">
            <span><strong>Total Present:</strong> ${totalPresent}</span>
            <span><strong>Adult Members:</strong> ${sortedPresentMembers.length}</span>
            <span><strong>Kids (Present):</strong> ${presentKids.length}</span>
            <span><strong>Returning Visitors:</strong> ${sortedReturningVisitors.length}</span>
            <span><strong>New Visitors:</strong> ${sortedNewVisitors.length}</span>
            <span><strong>Absent (Adults & Visitors):</strong> ${allAbsent.length}</span>
            <span><strong>Attendance Rate:</strong> ${attendanceRate}%</span>
          </div>

          <div class="section-title">
            <span>Present Members</span>
            <span class="section-count">Count: ${sortedPresentMembers.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th style="width: 100px; text-align: center;">Arrival Time</th>
              </tr>
            </thead>
            <tbody>
              ${presentMembersRows || '<tr><td colspan="5" style="text-align: center; color: #9a9793; padding: 12px;">No members present</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">
            <span>Returning Visitors (Present)</span>
            <span class="section-count">Count: ${sortedReturningVisitors.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th>Name</th>
                <th>Residence</th>
                <th>Contact</th>
                <th>Sundays Attended</th>
                <th style="width: 100px; text-align: center;">Arrival Time</th>
                <th style="width: 100px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${returningVisitorsRows || '<tr><td colspan="7" style="text-align: center; color: #9a9793; padding: 12px;">No returning visitors present</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">
            <span>New Visitors (Present)</span>
            <span class="section-count">Count: ${sortedNewVisitors.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th>Name</th>
                <th>Residence</th>
                <th>Contact</th>
                <th style="width: 100px; text-align: center;">Arrival Time</th>
              </tr>
            </thead>
            <tbody>
              ${newVisitorsRows || '<tr><td colspan="5" style="text-align: center; color: #9a9793; padding: 12px;">No new visitors today</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">
            <span>Absent Members & Visitors</span>
            <span class="section-count">Count: ${allAbsent.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Cluster</th>
                <th style="width: 120px; text-align: center;">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              ${absentRows || '<tr><td colspan="6" style="text-align: center; color: #9a9793; padding: 12px;">No absences</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding: 10px; border: 1px solid #e8e6e3; background-color: #faf9f7; border-radius: 6px; font-size: 10px; color: #8b8884; text-align: center; font-style: italic;">
            * Note: To optimize report size, children are not listed individually in the tables above. They are included in the summary counts (Present Kids: ${presentKids.length}, Absent Kids are not listed).
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

  const exportVisitorsCsv = () => {
    if (!presentVisitors.length) return;
    const prefix = new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const headers = ["Name Prefix", "First Name", "Phone 1 - Value", "Address 1 - Street", "Notes"];
    const rows = presentVisitors.map((v: any) => {
      const notesParts = [];
      if (v.relationshipStatus) notesParts.push(`Status: ${v.relationshipStatus}`);
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
    if (!absentMembers.length) return;
    const headers = ["Name", "Contact", "Residence", "Gender", "Department", "Status", "Last Seen"];
    const rows = absentMembers.map((m: any) => [
      m.name, 
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
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
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
              borderColor: `rgba(61, 58, 54, 0.08)`
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
                  Imara Daima Main Altar — Protocol Department
                </h2>
                <p className="text-[9px] sm:text-[10px] mt-0.5" style={{ color: colors.text.secondary }}>
                  Sunday Service Roster & Attendance Report
                </p>
              </div>
            </div>
            <img 
              src="/convex.svg" 
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
              {/* Export button */}
              {filteredAbsentMembers.length > 0 && (
                <button
                  onClick={exportAbsentCsv}
                  className="w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer border border-[#3d3a36]/10"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  Export absent members CSV
                </button>
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
                      return (
                        <div key={m.memberId} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm flex flex-wrap items-baseline gap-x-2" style={{ color: colors.text.primary }}>
                                <span>{m.name}</span>
                                <span className="text-[10px]" style={{ color: recency.color }}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                                {m.gender || "Member"}{m.department && ` • ${m.department}`}
                                {m.clusterName && ` • ${m.clusterName} (${m.clusterLeader ? `Leader: ${m.clusterLeader}` : 'No leader'})`}
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
                      return (
                        <div key={m.memberId} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm flex flex-wrap items-baseline gap-x-2" style={{ color: colors.text.primary }}>
                                <span>{m.name}</span>
                                <span className="text-[10px]" style={{ color: recency.color }}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                                Visitor{m.residence && ` • ${m.residence}`}
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
                  className="w-full py-2.5 rounded-xl text-sm transition-colors cursor-pointer border border-[#3d3a36]/10"
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
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
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
    bg: '#f5f3ef',
    surface: '#faf9f7',
    surfaceHover: '#f0ede8',
    text: {
      primary: '#3d3a36',
      secondary: '#6b6864',
      muted: '#9a9793',
    },
    accent: {
      amber: '#c9a87c',
      sage: '#9db88c',
      sageLight: '#c5d4be',
      terracotta: '#c49a84',
      terracottaLight: '#e8d8cc',
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
