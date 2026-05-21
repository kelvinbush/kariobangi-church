"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, formatDateLong } from "@/lib/date";
import MemberEditor, { type MemberSummary } from "@/components/MemberEditor";
import KidEditor, { type KidSummary } from "@/components/KidEditor";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { 
  Clock, 
  Printer, 
  ChevronLeft, 
  User, 
  Users, 
  Baby, 
  Calendar, 
  FileText, 
  UserCheck, 
  AlertCircle, 
  Download,
  Search,
  CheckCircle,
  HelpCircle
} from "lucide-react";

// Color Palette
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

// Recency color coding function for absent list
function getRecencyStyle(lastSeenDate: string | null) {
  if (!lastSeenDate) {
    return {
      text: "Never seen",
      style: { color: "#71717a", backgroundColor: "rgba(113, 113, 122, 0.1)" }
    };
  }

  const lastSeen = new Date(lastSeenDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastSeen.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      style: { color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)" } // Green for recent
    };
  } else if (diffDays <= 60) {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      style: { color: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.1)" } // Amber for older
    };
  } else {
    return {
      text: `Seen: ${formatIsoDate(lastSeenDate)}`,
      style: { color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" } // Red for dormant/long absent
    };
  }
}

// Subtle dot pattern for ambient background decoration
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

  // Stats Breakdown
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

  // Search Filter logic
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

  // PDF Generation function (Print-optimized HTML window)
  const handlePrintPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    const formattedDate = formatDateLong(date);

    const allPresent = [
      ...presentMen.map((m: any) => ({ ...m, category: "Member (Male)" })),
      ...presentWomen.map((m: any) => ({ ...m, category: "Member (Female)" })),
      ...presentKids.map((m: any) => ({ ...m, category: "Kid" })),
      ...presentUnknown.map((m: any) => ({ ...m, category: "Member (Unknown)" })),
      ...returningVisitorsPresent.map((m: any) => ({ ...m, category: "Returning Visitor" })),
      ...presentVisitors.map((m: any) => ({ ...m, category: "New Visitor", arrivalTime: m.arrivalTime || "-" })),
    ];

    const allAbsent = [
      ...absentMembers.map((m: any) => ({ ...m, category: m.type === "kid" ? "Kid" : "Member", lastSeen: m.lastSeenDate })),
      ...returningVisitorsAbsent.map((m: any) => ({ ...m, category: "Returning Visitor", lastSeen: m.lastSeenDate })),
    ];

    const presentRows = allPresent.map((p, idx) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">${idx + 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #1f2937;">${p.name}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">${p.category}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; color: #4b5563;">${p.contact || "-"}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #c9a87c;">
          ${p.arrivalTime || "-"}
        </td>
      </tr>
    `).join("");

    const absentRows = allAbsent.map((a, idx) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">${idx + 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #1f2937;">${a.name}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">${a.category}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; color: #4b5563;">${a.contact || "-"}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #ef4444; font-weight: 500;">
          ${a.lastSeen ? formatIsoDate(a.lastSeen) : "Never seen"}
        </td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Protocol Department Report - ${date}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
            body {
              font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #3d3a36;
              margin: 40px;
              background-color: #fff;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .logo-cell {
              width: 80px;
              vertical-align: middle;
            }
            .logo-img {
              width: 70px;
              height: 70px;
              object-fit: contain;
            }
            .title-cell {
              padding-left: 20px;
              vertical-align: middle;
            }
            .title-main {
              font-size: 24px;
              font-weight: 700;
              color: #303030;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .title-sub {
              font-size: 14px;
              color: #c9a87c;
              margin: 5px 0 0 0;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .stats-grid {
              display: grid;
              grid-template-cols: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 35px;
            }
            .stat-card {
              border: 1px solid #e8e6e3;
              padding: 15px;
              border-radius: 12px;
              background-color: #faf9f7;
              text-align: center;
            }
            .stat-value {
              font-size: 22px;
              font-weight: 700;
              color: #3d3a36;
            }
            .stat-label {
              font-size: 11px;
              color: #8b8884;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 5px;
              font-weight: 600;
            }
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #3d3a36;
              margin: 35px 0 15px 0;
              padding-bottom: 8px;
              border-bottom: 2px solid #c9a87c;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .section-count {
              font-size: 14px;
              color: #8b8884;
              font-weight: 400;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
              margin-bottom: 15px;
            }
            table.data-table th {
              background-color: #3d3a36;
              color: #fff;
              padding: 10px;
              font-weight: 500;
              text-align: left;
            }
            table.data-table td {
              padding: 10px;
            }
            @media print {
              body {
                margin: 20px;
              }
              .no-print {
                display: none;
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
              <td class="logo-cell">
                <img src="/convex.svg" class="logo-img" alt="Church Logo" />
              </td>
              <td class="title-cell">
                <h1 class="title-main">Imaara Daima Main Altar</h1>
                <h2 class="title-sub">Protocol Department Report</h2>
                <div style="font-size: 14px; color: #6b6864; font-weight: 500; margin-top: 5px;">
                  Sunday Attendance Roster — ${formattedDate}
                </div>
              </td>
            </tr>
          </table>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalPresent}</div>
              <div class="stat-label">Total Present</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${presentMembersKids}</div>
              <div class="stat-label">Members & Kids</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${presentVisitors.length + returningVisitorsPresent.length}</div>
              <div class="stat-label">Visitors</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalAbsent}</div>
              <div class="stat-label">Absent</div>
            </div>
          </div>

          <div class="section-title">
            <span>Present Members & Visitors</span>
            <span class="section-count">Count: ${allPresent.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th style="width: 120px; text-align: center;">Arrival Time</th>
              </tr>
            </thead>
            <tbody>
              ${presentRows || '<tr><td colspan="5" style="text-align: center; color: #9a9793; padding: 25px;">No attendance recorded</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">
            <span>Absent Members & Visitors</span>
            <span class="section-count">Count: ${allAbsent.length}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">#</th>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th style="width: 150px; text-align: center;">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              ${absentRows || '<tr><td colspan="5" style="text-align: center; color: #9a9793; padding: 25px;">No absences recorded</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 50px; font-size: 11px; color: #9a9793; text-align: center; border-top: 1px dashed #e8e6e3; padding-top: 15px;">
            Generated by Imaara Church Attendance & Follow-up Management System.
          </div>

          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 400);
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
      m.lastSeenDate ?? "Never"
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
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between backdrop-blur-md bg-white/80 border-b border-[#3d3a36]/10"
        >
          <div className="flex items-center gap-2">
            <Link
              href="/attendance/history"
              className="p-1.5 rounded-full hover:bg-zinc-200 transition-colors mr-1"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-600" />
            </Link>
            <span className="text-sm font-semibold tracking-wide text-zinc-700">
              {formatIsoDate(date)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintPdf}
              className="text-xs px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 bg-[#c9a87c] text-white hover:bg-[#b8976b] hover:shadow-md cursor-pointer font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
          
          {/* Refreshed Stats Dashboard */}
          <div 
            className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden shadow-lg"
            style={{ 
              backgroundImage: 'linear-gradient(135deg, #3d3a36 0%, #252321 100%)',
            }}
          >
            {/* Ambient glows */}
            <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-48 h-48 rounded-full bg-white/[0.02] blur-2xl pointer-events-none" />
            <div className="absolute left-1/4 top-1/4 w-32 h-32 rounded-full bg-[#c9a87c]/[0.05] blur-xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5 pb-5 border-b border-white/10">
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mb-0.5">Attendance Analytics</div>
                  <h2 className="text-xl font-light tracking-wide">Sunday Service Summary</h2>
                </div>
                <div>
                  <div className="text-3xl font-light text-[#c9a87c]">{attendanceRate}%</div>
                  <div className="text-[9px] text-white/40 text-right uppercase tracking-wider font-semibold">Attendance Rate</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.05]">
                  <div className="text-2xl font-light text-[#c9a87c]">{totalPresent}</div>
                  <div className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#c9a87c]" />
                    Total Present
                  </div>
                </div>
                <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.05]">
                  <div className="text-2xl font-light">{presentMembersKids}</div>
                  <div className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-white/40" />
                    Members & Kids
                  </div>
                </div>
                <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.05]">
                  <div className="text-2xl font-light">{presentVisitors.length + returningVisitorsPresent.length}</div>
                  <div className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-white/40" />
                    Visitors
                  </div>
                </div>
                <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.05]">
                  <div className="text-2xl font-light text-white/40">{totalAbsent}</div>
                  <div className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-white/30" />
                    Absent
                  </div>
                </div>
              </div>

              {/* Sub-breakdown of Gender/Kids */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-white/5 text-[10px] text-white/50">
                <div className="text-center">Men: <span className="text-white font-semibold">{presentMen.length}</span></div>
                <div className="text-center">Women: <span className="text-white font-semibold">{presentWomen.length}</span></div>
                <div className="text-center">Kids: <span className="text-white font-semibold">{presentKids.length}</span></div>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-5">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-zinc-400" />
            </span>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-zinc-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a87c] focus:border-[#c9a87c] transition-all shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-5 p-1 bg-zinc-200/50 rounded-full">
            {[
              { id: "present", label: `Present`, count: filteredPresentMen.length + filteredPresentWomen.length + filteredPresentKids.length + filteredPresentUnknown.length + filteredReturningVisitorsPresent.length },
              { id: "absent", label: `Absent`, count: filteredAbsentMembers.length + filteredReturningVisitorsAbsent.length },
              { id: "visitors", label: `New Visitors`, count: filteredPresentVisitors.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: activeTab === tab.id ? '#ffffff' : 'transparent',
                  color: activeTab === tab.id ? colors.text.primary : colors.text.secondary,
                  boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <span>{tab.label}</span>
                <span 
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: activeTab === tab.id ? colors.accent.amberLight : 'rgba(0,0,0,0.05)',
                    color: activeTab === tab.id ? '#8b6c43' : colors.text.secondary
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Present Tab */}
          {activeTab === "present" && (
            <div className="space-y-6">
              {/* Men */}
              {filteredPresentMen.length > 0 && (
                <div>
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c9a87c]" />
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
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9db88c]" />
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
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c49a84]" />
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
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    Unknown gender ({filteredPresentUnknown.length})
                  </div>
                  <div className="space-y-2">
                    {filteredPresentUnknown.map((m: any) => (
                      <div key={m.memberId} className="p-3 rounded-xl border border-zinc-200/50" style={{ backgroundColor: colors.surface }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>{m.name}</div>
                            <div className="text-xs text-zinc-500">{m.contact || "No contact info"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingUnknown({
                                memberId: m.memberId, name: m.name, contact: m.contact ?? null,
                                residence: m.residence ?? null, gender: m.gender ?? null,
                                department: m.department ?? null, status: m.status ?? null,
                              })}
                              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all hover:opacity-90"
                              style={{ backgroundColor: colors.accent.amberLight, color: '#8b6c43' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => togglePresent(m.memberId, true)}
                              className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all hover:bg-zinc-200"
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
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c9a87c]" />
                    Returning Visitors ({filteredReturningVisitorsPresent.length})
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
                  No one present matches the search query
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
                  className="w-full py-2.5 rounded-xl text-sm transition-all hover:bg-zinc-200 flex items-center justify-center gap-1.5 border border-zinc-200/50 cursor-pointer font-medium"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  <Download className="w-4 h-4" />
                  Export absent members CSV
                </button>
              )}

              {/* Members/Kids */}
              {filteredAbsentMembers.length > 0 && (
                <div>
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c49a84]" />
                    Members & Kids Absent ({filteredAbsentMembers.length})
                  </div>
                  <div className="space-y-2">
                    {filteredAbsentMembers.map((m: any) => {
                      const recency = getRecencyStyle(m.lastSeenDate);
                      return (
                        <div key={m.memberId} className="p-3 rounded-xl border border-zinc-200/50 hover:shadow-sm transition-all" style={{ backgroundColor: colors.surface }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: colors.text.primary }}>
                                {m.name}
                                <span className="inline-flex items-center text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={recency.style}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5 text-zinc-500">
                                {m.gender || "Member"}{m.department && ` • ${m.department}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                                className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-200 font-medium"
                                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                              >
                                History
                              </button>
                              <button
                                onClick={() => togglePresent(m.memberId, false)}
                                className="text-xs px-2.5 py-1 rounded-full cursor-pointer font-semibold shadow-sm hover:opacity-90"
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
                  <div className="text-xs mb-2 font-medium flex items-center gap-1.5" style={{ color: colors.text.secondary }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c9a87c]" />
                    Returning Visitors Absent ({filteredReturningVisitorsAbsent.length})
                  </div>
                  <div className="space-y-2">
                    {filteredReturningVisitorsAbsent.map((m: any) => {
                      const recency = getRecencyStyle(m.lastSeenDate);
                      return (
                        <div key={m.memberId} className="p-3 rounded-xl border border-zinc-200/50 hover:shadow-sm transition-all" style={{ backgroundColor: colors.surface }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: colors.text.primary }}>
                                {m.name}
                                <span className="inline-flex items-center text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={recency.style}>
                                  {recency.text}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5 text-zinc-500">
                                Visitor{m.residence && ` • ${m.residence}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setHistoryVisitor({ name: m.name, memberId: m.memberId })}
                                className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:bg-zinc-200 font-medium"
                                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                              >
                                History
                              </button>
                              <button
                                onClick={() => togglePresent(m.memberId, false)}
                                className="text-xs px-2.5 py-1 rounded-full cursor-pointer font-semibold shadow-sm hover:opacity-90"
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
                  No absences match the search query
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
                  className="w-full py-2.5 rounded-xl text-sm transition-all hover:bg-zinc-200 flex items-center justify-center gap-1.5 border border-zinc-200/50 cursor-pointer font-medium"
                  style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                >
                  <Download className="w-4 h-4" />
                  Export visitors CSV
                </button>
              )}

              {filteredPresentVisitors.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No new visitors match the search query
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPresentVisitors.map((v: any) => (
                    <div key={v.memberId} className="p-4 rounded-xl border border-zinc-200/50 hover:shadow-sm transition-all" style={{ backgroundColor: colors.surface }}>
                      <div className="text-sm font-semibold mb-1" style={{ color: colors.text.primary }}>{v.name}</div>
                      {v.contact && (
                        <a href={`tel:${v.contact}`} className="text-xs block mb-1 hover:underline font-medium" style={{ color: colors.accent.amber }}>
                          📞 {v.contact}
                        </a>
                      )}
                      {v.residence && (
                        <div className="text-xs mb-2 text-zinc-500">📍 {v.residence}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-200/40">
                        <button
                          onClick={() => setHistoryVisitor({ name: v.name, memberId: v.memberId })}
                          className="text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-zinc-200 transition-all font-medium"
                          style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                        >
                          History
                        </button>
                        <button
                          onClick={() => togglePresent(v.memberId, true)}
                          className="text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all font-semibold"
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
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto shadow-2xl"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm font-semibold mb-4 text-zinc-800 pb-2 border-b border-zinc-200">
                {historyVisitor.name} — Attendance History
              </div>
              {visitorHistory === undefined ? (
                <div className="py-4 text-sm text-center text-zinc-500">Loading…</div>
              ) : !visitorHistory?.length ? (
                <div className="py-4 text-sm text-center text-zinc-500">No attendance records found</div>
              ) : (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
                  {visitorHistory.map((r: any) => (
                    <div key={r._id} className="flex items-center justify-between py-2 text-sm border-b border-zinc-100 last:border-0">
                      <span className="text-zinc-600">{formatDateLong(r.date)}</span>
                      <span 
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          r.present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.present ? "Present" : "Absent"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setHistoryVisitor(null)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:bg-zinc-200 cursor-pointer"
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
      sage: '#9db88c',
      sageLight: '#c5d4be',
      terracotta: '#c49a84',
      terracottaLight: '#e8d8cc',
    }
  };

  return (
    <div className="p-3 rounded-xl hover:shadow-sm transition-all border border-zinc-200/50" style={{ backgroundColor: colors.surface }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
              {person.name}
              {present && person.arrivalTime && (
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-[#c9a87c] font-bold border border-[#e8dcc8] uppercase tracking-wider">
                  <Clock className="w-2.5 h-2.5" />
                  {person.arrivalTime}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5 text-zinc-500">
              {person.contact || "No contact info"}
              {person.department && ` • ${person.department}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onHistory}
            className="text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium hover:bg-zinc-200"
            style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
          >
            History
          </button>
          <button
            onClick={onToggle}
            className="text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer font-semibold shadow-sm hover:opacity-90"
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
