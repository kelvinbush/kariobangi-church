"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate } from "@/lib/date";
import { Download, Search, ArrowLeft, UserX, AlertTriangle, X, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

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
    sageLight: '#d4e4c8',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
  }
};

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

interface UnassignedMember {
  _id: Id<"members">;
  name: string;
  contact: string | null;
  gender: string | null;
  residence: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  status: string | null;
  attendanceCount: number;
}

export default function UnassignedMembersPage() {
  const { isAuthenticated } = useConvexAuth();
  
  // Queries & Mutations
  const unassignedList = useQuery(api.clusterMembers.unassignedMembers, isAuthenticated ? {} : "skip");
  const updateMember = useMutation(api.members.update);
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<"name" | "firstSeen" | "lastSeen" | "attendanceCount">("firstSeen");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Modals & Feedback
  const [memberToDeactivate, setMemberToDeactivate] = useState<UnassignedMember | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Show toast utility
  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper for Category Classification mapping
  const formatCategory = (gender?: string | null, status?: string | null) => {
    const genderLower = (gender || "").toLowerCase();
    const statusLower = (status || "").toLowerCase();

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

    if (genderLower === "male") return "Male";
    if (genderLower === "female") return "Female";
    return "-";
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    try {
      return formatIsoDate(dateStr);
    } catch (e) {
      return dateStr;
    }
  };

  // Deactivate handler
  const handleMarkInactive = async () => {
    if (!memberToDeactivate) return;
    setIsDeactivating(true);
    try {
      await updateMember({
        memberId: memberToDeactivate._id,
        active: false,
      });
      showToast(`${memberToDeactivate.name} has been successfully marked as inactive.`, "success");
      setMemberToDeactivate(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to mark member as inactive", "error");
    } finally {
      setIsDeactivating(false);
    }
  };

  // Export PDF (Sorted from oldest to newest by first record)
  const handleExportPdf = () => {
    if (!unassignedList || unassignedList.length === 0) {
      showToast("No unassigned members to export.", "error");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

    // PDF MUST always be sorted oldest to newest first seen date
    const pdfSortedList = [...unassignedList].sort((a, b) => {
      if (!a.firstSeen && !b.firstSeen) return a.name.localeCompare(b.name);
      if (!a.firstSeen) return 1;
      if (!b.firstSeen) return -1;
      const dateCompare = a.firstSeen.localeCompare(b.firstSeen);
      if (dateCompare !== 0) return dateCompare;
      return a.name.localeCompare(b.name);
    });

    const rows = pdfSortedList.map((m, idx) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #6b6864; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-size: 12px; font-weight: 500;">${m.name}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864; font-size: 11px;">${formatCategory(m.gender, m.status)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864; font-size: 11px;">${m.residence || "-"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #3d3a36; font-size: 11px; font-family: monospace; letter-spacing: 0.5px;">${m.contact || "-"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; text-align: center; color: #3d3a36; font-size: 11px;">${m.attendanceCount} ${m.attendanceCount === 1 ? 'Sun' : 'Suns'}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864; font-size: 11px;">${formatDate(m.firstSeen)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e8e6e3; color: #6b6864; font-size: 11px;">${formatDate(m.lastSeen)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Unassigned Members Report - ${new Date().toLocaleDateString()}</title>
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
              margin-bottom: 25px;
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
              width: 55px;
              height: 55px;
              object-fit: contain;
            }
            .title-cell-center {
              text-align: center;
              vertical-align: middle;
              padding: 0 10px;
            }
            .title-ministry {
              font-size: 13px;
              font-weight: 700;
              color: #3d3a36;
              margin: 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .title-altar {
              font-size: 10px;
              font-weight: 600;
              color: #6b6864;
              margin: 3px 0 0 0;
              text-transform: uppercase;
            }
            .title-report {
              font-size: 15px;
              font-weight: 700;
              color: #c9a87c;
              margin: 8px 0 0 0;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .report-meta {
              font-size: 10px;
              color: #9a9793;
              margin-top: 4px;
            }
            .stats-container {
              background-color: #faf9f7;
              border: 1px solid #e8e6e3;
              border-radius: 8px;
              padding: 12px 15px;
              margin-bottom: 20px;
              font-size: 12px;
            }
            .table-title {
              font-size: 11px;
              font-weight: 700;
              color: #3d3a36;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 15px 0 6px 0;
              border-bottom: 1px solid #3d3a36;
              padding-bottom: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #3d3a36;
              color: #fff;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 5px 8px;
              text-align: left;
            }
            .footer-disclaimer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px dashed #e8e6e3;
              font-size: 9px;
              color: #9a9793;
              text-align: center;
              line-height: 1.4;
            }
            @media print {
              body { margin: 15px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="logo-cell-left">
                <img class="logo-img" src="/ministry-logo.png" alt="Ministry Logo" />
              </td>
              <td class="title-cell-center">
                <h1 class="title-ministry">The Ministry of Repentance and Holiness</h1>
                <h2 class="title-altar">Imara Daima Altar — The Imaara Mall 3rd Floor</h2>
                <h2 class="title-report">Unassigned Active Members Report</h2>
                <div class="report-meta">Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </td>
              <td class="logo-cell-right">
                <img class="logo-img" src="/convex.svg" alt="Church Logo" />
              </td>
            </tr>
          </table>

          <div class="stats-container">
            <strong>Summary:</strong> There are currently <strong>${pdfSortedList.length}</strong> active members who are not assigned to any active cluster. Sorted by earliest first seen record.
          </div>

          <div class="table-title">Members Rosters (Active &amp; Unassigned)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 20%;">Name</th>
                <th style="width: 13%;">Category</th>
                <th style="width: 16%;">Residence</th>
                <th style="width: 14%;">Contact</th>
                <th style="width: 8%; text-align: center;">Attended</th>
                <th style="width: 12%;">First Record</th>
                <th style="width: 12%;">Most Recent</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="footer-disclaimer">
            This document is strictly confidential and for internal use within the Imara Daima Main Altar Protocol Department only.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter & Search Logic
  const filteredAndSortedList = useMemo(() => {
    if (!unassignedList) return [];

    let list = [...unassignedList];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) ||
        (m.residence && m.residence.toLowerCase().includes(q)) ||
        (m.contact && m.contact.includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter(m => {
        const cat = formatCategory(m.gender, m.status).toLowerCase();
        return cat.includes(selectedCategory.toLowerCase());
      });
    }

    // Sort sorting logic
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "attendanceCount") {
        comparison = (a.attendanceCount || 0) - (b.attendanceCount || 0);
        if (comparison === 0) {
          comparison = a.name.localeCompare(b.name);
        }
      } else {
        const aVal = a[sortField] || "";
        const bVal = b[sortField] || "";
        
        if (!aVal && !bVal) comparison = a.name.localeCompare(b.name);
        else if (!aVal) comparison = 1;
        else if (!bVal) comparison = -1;
        else comparison = aVal.localeCompare(bVal);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [unassignedList, searchQuery, selectedCategory, sortField, sortDirection]);

  // Demographic stats count
  const demographicStats = useMemo(() => {
    const stats = {
      youthMen: 0,
      youthLadies: 0,
      menMarried: 0,
      womenMarried: 0,
      other: 0,
    };

    if (!unassignedList) return stats;

    unassignedList.forEach(m => {
      const category = formatCategory(m.gender, m.status);
      if (category === "Youth Men") stats.youthMen++;
      else if (category === "Youth Ladies") stats.youthLadies++;
      else if (category === "Men (Married)") stats.menMarried++;
      else if (category === "Women (Married)") stats.womenMarried++;
      else stats.other++;
    });

    return stats;
  }, [unassignedList]);

  // Handle Sort Change
  const toggleSort = (field: "name" | "firstSeen" | "lastSeen" | "attendanceCount") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIndicator = ({ field }: { field: "name" | "firstSeen" | "lastSeen" | "attendanceCount" }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />;
  };

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Top Header */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <div className="flex items-center gap-2">
            <Link 
              href="/cluster-admin"
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors text-[#6b6864] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Unassigned Members
            </span>
          </div>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
          {/* Header Title Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-light tracking-tight" style={{ color: colors.text.primary }}>
                Manage Unassigned Members
              </h1>
              <p className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                Active adult members not yet assigned to any active cluster.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExportPdf}
                className="text-xs px-4 py-2 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ 
                  borderColor: 'rgba(61, 58, 54, 0.2)',
                  color: colors.text.primary,
                  backgroundColor: colors.surface
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF (Oldest First)
              </button>
            </div>
          </div>

          {/* Demographic Breakdown Stats Row */}
          {unassignedList && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <StatItem label="Total Unassigned" count={unassignedList.length} color={colors.accent.amber} />
              <StatItem label="Men (Married)" count={demographicStats.menMarried} color={colors.accent.sage} />
              <StatItem label="Women (Married)" count={demographicStats.womenMarried} color="#9b8cb8" />
              <StatItem label="Youth Men" count={demographicStats.youthMen} color="#5a7a8a" />
              <StatItem label="Youth Ladies" count={demographicStats.youthLadies} color={colors.accent.terracotta} />
            </div>
          )}

          {/* Filter & Search Bar */}
          <div 
            className="rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm border border-[#e8e6e3]"
            style={{ backgroundColor: colors.surface }}
          >
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#9a9793]">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search name, residence, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#e8e6e3] focus:outline-none focus:ring-1 focus:ring-[#c9a87c]"
                style={{ backgroundColor: colors.bg, color: colors.text.primary }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute inset-y-0 right-3 flex items-center text-[#9a9793] hover:text-[#3d3a36]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {[
                { value: "all", label: "All" },
                { value: "men (married)", label: "Men (Married)" },
                { value: "women (married)", label: "Women (Married)" },
                { value: "youth men", label: "Youth Men" },
                { value: "youth ladies", label: "Youth Ladies" }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedCategory(tab.value)}
                  className="text-[11px] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === tab.value ? colors.text.primary : 'rgba(61, 58, 54, 0.05)',
                    color: selectedCategory === tab.value ? '#ffffff' : colors.text.secondary,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List/Table Container */}
          <div 
            className="rounded-2xl overflow-hidden shadow-sm border border-[#e8e6e3]"
            style={{ backgroundColor: colors.surface }}
          >
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(61, 58, 54, 0.04)', borderBottom: '1px solid #e8e6e3' }}>
                    <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: colors.text.secondary, width: '4%' }}>#</th>
                    <th 
                      onClick={() => toggleSort("name")}
                      className="p-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/5" 
                      style={{ color: colors.text.secondary, width: '20%' }}
                    >
                      Name <SortIndicator field="name" />
                    </th>
                    <th className="p-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.text.secondary, width: '14%' }}>Category</th>
                    <th className="p-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.text.secondary, width: '16%' }}>Residence</th>
                    <th className="p-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.text.secondary, width: '14%' }}>Contact</th>
                    <th 
                      onClick={() => toggleSort("attendanceCount")}
                      className="p-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/5 text-center" 
                      style={{ color: colors.text.secondary, width: '8%' }}
                    >
                      Attended <SortIndicator field="attendanceCount" />
                    </th>
                    <th 
                      onClick={() => toggleSort("firstSeen")}
                      className="p-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/5" 
                      style={{ color: colors.text.secondary, width: '12%' }}
                    >
                      First Record <SortIndicator field="firstSeen" />
                    </th>
                    <th 
                      onClick={() => toggleSort("lastSeen")}
                      className="p-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/5" 
                      style={{ color: colors.text.secondary, width: '12%' }}
                    >
                      Most Recent <SortIndicator field="lastSeen" />
                    </th>
                    <th className="p-3 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: colors.text.secondary, width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e6e3]">
                  {filteredAndSortedList.map((m, idx) => (
                    <tr key={m._id} className="hover:bg-black/[0.01] transition-colors">
                      <td className="p-3 text-center text-xs" style={{ color: colors.text.secondary }}>{idx + 1}</td>
                      <td className="p-3">
                        <div className="text-xs font-semibold" style={{ color: colors.text.primary }}>{m.name}</div>
                      </td>
                      <td className="p-3">
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full inline-block font-medium"
                          style={getCategoryTagStyles(formatCategory(m.gender, m.status))}
                        >
                          {formatCategory(m.gender, m.status)}
                        </span>
                      </td>
                      <td className="p-3 text-xs" style={{ color: colors.text.secondary }}>{m.residence || "-"}</td>
                      <td className="p-3 text-xs">
                        {m.contact ? (
                          <a 
                            href={`tel:${m.contact}`} 
                            className="font-mono hover:underline hover:text-[#c9a87c] tracking-wide"
                            style={{ color: colors.text.primary }}
                          >
                            {m.contact}
                          </a>
                        ) : (
                          <span style={{ color: colors.text.muted }}>-</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-xs font-medium" style={{ color: colors.text.primary }}>
                        {m.attendanceCount} {m.attendanceCount === 1 ? 'Sun' : 'Suns'}
                      </td>
                      <td className="p-3 text-xs" style={{ color: colors.text.secondary }}>{formatDate(m.firstSeen)}</td>
                      <td className="p-3 text-xs" style={{ color: colors.text.secondary }}>{formatDate(m.lastSeen)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setMemberToDeactivate(m)}
                          className="p-1.5 rounded-full hover:bg-red-50 hover:text-red-600 text-neutral-400 transition-colors cursor-pointer group"
                          title="Mark Inactive"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSortedList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs" style={{ color: colors.text.muted }}>
                        No unassigned members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-[#e8e6e3]">
              {filteredAndSortedList.map((m, idx) => (
                <div key={m._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                        {idx + 1}. {m.name}
                      </div>
                      <span 
                        className="text-[9px] px-2 py-0.5 rounded-full inline-block mt-1 font-medium"
                        style={getCategoryTagStyles(formatCategory(m.gender, m.status))}
                      >
                        {formatCategory(m.gender, m.status)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => setMemberToDeactivate(m)}
                      className="p-2 rounded-full bg-red-50 text-red-600 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-1 border-t border-black/[0.03]">
                    <div>
                      <span style={{ color: colors.text.muted }}>Residence:</span>
                      <div className="font-medium mt-0.5" style={{ color: colors.text.secondary }}>
                        {m.residence || "-"}
                      </div>
                    </div>
                    
                    <div>
                      <span style={{ color: colors.text.muted }}>Contact:</span>
                      <div className="mt-0.5 font-mono">
                        {m.contact ? (
                          <a href={`tel:${m.contact}`} className="hover:underline text-[#c9a87c]">{m.contact}</a>
                        ) : "-"}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: colors.text.muted }}>Attended:</span>
                      <div className="font-medium mt-0.5" style={{ color: colors.text.secondary }}>
                        {m.attendanceCount} {m.attendanceCount === 1 ? 'Sunday' : 'Sundays'}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: colors.text.muted }}>First Record:</span>
                      <div className="font-medium mt-0.5" style={{ color: colors.text.secondary }}>
                        {formatDate(m.firstSeen)}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: colors.text.muted }}>Most Recent:</span>
                      <div className="font-medium mt-0.5" style={{ color: colors.text.secondary }}>
                        {formatDate(m.lastSeen)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAndSortedList.length === 0 && (
                <div className="p-8 text-center text-xs" style={{ color: colors.text.muted }}>
                  No unassigned members found.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal overlay */}
      {memberToDeactivate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setMemberToDeactivate(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border border-red-100 flex flex-col"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-50 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                  Mark Member Inactive
                </h3>
                <p className="text-xs mt-2" style={{ color: colors.text.secondary }}>
                  Are you sure you want to mark <strong className="text-neutral-800">{memberToDeactivate.name}</strong> as inactive?
                </p>
                <p className="text-[10px] text-red-500 mt-1">
                  This will remove them from the coordination system.
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-black/[0.04] bg-black/[0.01] flex items-center justify-end gap-2">
              <button
                disabled={isDeactivating}
                onClick={() => setMemberToDeactivate(null)}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 hover:bg-neutral-50 transition-colors text-[#6b6864] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeactivating}
                onClick={handleMarkInactive}
                className="text-xs px-3 py-1.5 rounded-full text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-1"
              >
                {isDeactivating ? "Processing..." : "Mark Inactive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom glassmorphism Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div 
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-xl"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.9)', 
              borderColor: toastMessage.type === "success" ? colors.accent.sage : '#fca5a5'
            }}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <span className="text-xs font-medium" style={{ color: colors.text.primary }}>
              {toastMessage.text}
            </span>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}

// Stats Card Component
function StatItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div 
      className="rounded-xl p-3 border border-[#e8e6e3] shadow-sm flex flex-col justify-between"
      style={{ backgroundColor: colors.surface }}
    >
      <span className="text-[10px]" style={{ color: colors.text.secondary }}>{label}</span>
      <span className="text-2xl font-light mt-1" style={{ color }}>{count}</span>
    </div>
  );
}

// Styling Helper for Demographics Badge
function getCategoryTagStyles(category: string) {
  const cat = category.toLowerCase();
  if (cat === "men (married)") {
    return { backgroundColor: 'rgba(157, 184, 140, 0.12)', color: '#688c52' };
  }
  if (cat === "women (married)") {
    return { backgroundColor: 'rgba(155, 140, 184, 0.12)', color: '#74599a' };
  }
  if (cat === "youth men") {
    return { backgroundColor: 'rgba(90, 122, 138, 0.12)', color: '#416070' };
  }
  if (cat === "youth ladies") {
    return { backgroundColor: 'rgba(196, 154, 132, 0.12)', color: '#976249' };
  }
  return { backgroundColor: 'rgba(154, 151, 147, 0.12)', color: '#6b6864' };
}
