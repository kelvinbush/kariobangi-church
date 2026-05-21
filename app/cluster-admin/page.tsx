"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate, getLastSunday, getPreviousSundays } from "@/lib/date";
import { Download } from "lucide-react";

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

// Simple arrow
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

interface Cluster {
  _id: string;
  name: string;
  type?: string | null | undefined;
  memberCount: number;
  leaderName?: string | null | undefined;
}

const CLUSTER_TYPES = [
  { value: "men", label: "Men", color: "#5a7a8a", bgColor: "rgba(90, 122, 138, 0.06)" },
  { value: "youth_men", label: "Youth Men", color: "#5a7a5a", bgColor: "rgba(90, 122, 90, 0.06)" },
  { value: "youth_ladies", label: "Youth Ladies", color: "#c49a84", bgColor: "rgba(196, 154, 132, 0.06)" },
  { value: "pastors", label: "Pastors", color: "#7c6f5a", bgColor: "rgba(124, 111, 90, 0.06)" },
  { value: "women", label: "Women", color: "#9b8cb8", bgColor: "rgba(155, 140, 184, 0.06)" },
];

const DEFAULT_TYPE = { label: "General", color: "#9a9793", bgColor: "transparent" };

function getClusterTypeInfo(type: string | null | undefined) {
  if (!type) return DEFAULT_TYPE;
  return CLUSTER_TYPES.find(t => t.value === type) || DEFAULT_TYPE;
}

interface ClusterProgress {
  clusterId: string;
  completionRate: number;
  absentCount: number;
  loggedCount: number;
}

export default function ClusterAdminDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  
  const userRoles = useMemo(() => {
    const metadata = user?.publicMetadata as { roles?: string[]; role?: string } | undefined;
    const roles = new Set<string>();
    if (metadata?.role) roles.add(metadata.role);
    if (metadata?.roles) metadata.roles.forEach((r) => roles.add(r));
    return Array.from(roles);
  }, [user]);
  
  const isAdmin = userRoles.includes("admin");
  const canEdit = isAdmin || userRoles.includes("cluster-admin");
  const isClusterHead = userRoles.includes("cluster-head");
  
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterType, setNewClusterType] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(getLastSunday());

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const unassignedList = useQuery(api.clusterMembers.unassignedMembers, isAuthenticated ? {} : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );
  const clustersProgress = useQuery(
    api.clusterFollowUps.getAllClustersProgress,
    isAuthenticated ? { date: selectedDate } : "skip"
  );

  const createCluster = useMutation(api.clusters.create);
  const recentSundays = useMemo(() => getPreviousSundays(4), []);

  const progressMap = useMemo(() => {
    const map: Record<string, ClusterProgress> = {};
    clustersProgress?.forEach((p: ClusterProgress) => {
      map[p.clusterId] = p;
    });
    return map;
  }, [clustersProgress]);

  // Group clusters by type
  const groupedClusters = useMemo(() => {
    const groups: Record<string, Cluster[]> = {};
    
    // Initialize with known types in order
    CLUSTER_TYPES.forEach(t => {
      groups[t.value] = [];
    });
    groups["general"] = []; // For clusters without type
    
    clusters?.forEach((cluster: Cluster) => {
      const type = cluster.type || "general";
      if (!groups[type]) groups[type] = [];
      groups[type].push(cluster);
    });
    
    return groups;
  }, [clusters]);

  const handleCreateCluster = async () => {
    if (!newClusterName.trim()) return;
    try {
      await createCluster({ 
        name: newClusterName.trim(),
        type: newClusterType || undefined,
      });
      setNewClusterName("");
      setNewClusterType("");
      setShowCreateCluster(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create cluster");
    }
  };

  const handleExportUnassignedPdf = () => {
    if (!unassignedList || unassignedList.length === 0) {
      alert("No unassigned members to export.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }

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

    const sortedList = [...unassignedList].sort((a, b) => {
      if (!a.firstSeen && !b.firstSeen) return a.name.localeCompare(b.name);
      if (!a.firstSeen) return 1;
      if (!b.firstSeen) return -1;
      const dateCompare = a.firstSeen.localeCompare(b.firstSeen);
      if (dateCompare !== 0) return dateCompare;
      return a.name.localeCompare(b.name);
    });

    const rows = sortedList.map((m, idx) => `
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
            <strong>Summary:</strong> There are currently <strong>${unassignedList.length}</strong> active members who are not assigned to any active cluster. Please assign them to a cluster to ensure correct coordination and follow-up.
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

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            Clusters
          </span>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Stats - Single Card */}
          {stats && (
            <div 
              className="rounded-2xl p-6 mb-8"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex items-center gap-8">
                <div>
                  <div 
                    className="text-4xl font-light mb-1"
                    style={{ color: colors.text.primary }}
                  >
                    {stats.totalClusters}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    Active
                  </div>
                </div>
                
                <div 
                  className="w-px h-10"
                  style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
                />
                
                <div>
                  <div 
                    className="text-4xl font-light mb-1"
                    style={{ color: colors.text.primary }}
                  >
                    {stats.totalMembersInClusters}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    Members
                  </div>
                </div>

                {stats.unassignedMembers > 0 && (
                  <>
                    <div 
                      className="w-px h-10"
                      style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
                    />
                    <div>
                      <div 
                        className="text-4xl font-light mb-1"
                        style={{ color: colors.accent.terracotta }}
                      >
                        {stats.unassignedMembers}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        Unassigned
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                {canEdit && (
                  <button
                    onClick={() => setShowCreateCluster(true)}
                    className="text-sm px-4 py-2 rounded-full transition-colors cursor-pointer"
                    style={{ 
                      backgroundColor: colors.accent.amber,
                      color: colors.bg
                    }}
                  >
                    Create new cluster
                  </button>
                )}
                {stats && stats.unassignedMembers > 0 && (
                  <>
                    <Link
                      href="/cluster-admin/unassigned"
                      className="text-sm px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                      style={{ 
                        backgroundColor: 'rgba(61, 58, 54, 0.06)',
                        color: colors.text.primary,
                      }}
                    >
                      Manage unassigned
                      <ArrowRight />
                    </Link>
                    <button
                      onClick={handleExportUnassignedPdf}
                      className="text-sm px-4 py-2 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer"
                      style={{ 
                        borderColor: 'rgba(61, 58, 54, 0.2)',
                        color: colors.text.primary,
                        backgroundColor: 'transparent'
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export unassigned members
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* My Cluster (for cluster-heads) */}
          {isClusterHead && (
            <div className="mb-8">
              <Link
                href="/cluster-head"
                className="flex items-center justify-between p-4 rounded-xl transition-colors"
                style={{ backgroundColor: colors.accent.sageLight }}
              >
                <div>
                  <span 
                    className="text-sm block"
                    style={{ color: colors.text.primary }}
                  >
                    My Cluster
                  </span>
                  <span 
                    className="text-xs mt-0.5 block"
                    style={{ color: colors.text.secondary }}
                  >
                    Submit follow-up report
                  </span>
                </div>
                <ArrowRight />
              </Link>
            </div>
          )}

          {/* Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-8">
              <div 
                className="rounded-xl p-4"
                style={{ backgroundColor: colors.accent.terracottaLight }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span 
                      className="text-sm block"
                      style={{ color: colors.text.primary }}
                    >
                      {pendingRequests.length} attention request{pendingRequests.length > 1 ? 's' : ''}
                    </span>
                    <span 
                      className="text-xs mt-0.5 block"
                      style={{ color: colors.text.secondary }}
                    >
                      Members needing bishop attention
                    </span>
                  </div>
                  <ArrowRight />
                </div>
              </div>
            </div>
          )}

          {/* Clusters with Progress - Grouped by Type */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                Clusters
              </span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg bg-transparent"
                style={{ color: colors.text.muted }}
              >
                {recentSundays.map((sunday) => (
                  <option key={sunday} value={sunday}>
                    {formatIsoDate(sunday)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-6">
              {/* Render groups in order */}
              {[
                ...CLUSTER_TYPES,
                { value: "general", label: "General", color: DEFAULT_TYPE.color, bgColor: DEFAULT_TYPE.bgColor }
              ].map((typeInfo) => {
                const typeClusters = groupedClusters[typeInfo.value] || [];
                if (typeClusters.length === 0) return null;
                
                return (
                  <div key={typeInfo.value}>
                    {/* Type Header */}
                    <div 
                      className="flex items-center gap-2 mb-3 px-1"
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: typeInfo.color, opacity: 0.6 }}
                      />
                      <span 
                        className="text-[11px] uppercase tracking-wide"
                        style={{ color: colors.text.muted }}
                      >
                        {typeInfo.label}
                      </span>
                      <span 
                        className="text-[11px]"
                        style={{ color: colors.text.muted }}
                      >
                        ({typeClusters.length})
                      </span>
                    </div>
                    
                    {/* Clusters in this group */}
                    <div className="space-y-2">
                      {typeClusters.map((cluster: Cluster) => {
                        const progress = progressMap[cluster._id];
                        const percent = progress?.completionRate ?? 0;
                        const absentCount = progress?.absentCount ?? 0;
                        
                        // Determine status text
                        const statusText = absentCount === 0 
                          ? 'Complete' 
                          : percent === 100 
                            ? 'Complete' 
                            : percent === 0 
                              ? 'Pending' 
                              : `${percent}%`;
                        
                        const statusColor = absentCount === 0 || percent === 100
                          ? colors.accent.sage
                          : percent === 0
                            ? colors.accent.terracotta
                            : colors.accent.amber;
                        
                        return (
                          <Link
                            key={cluster._id}
                            href={`/cluster-admin/detail/${cluster._id}`}
                            className="block p-4 rounded-xl transition-colors"
                            style={{ backgroundColor: typeInfo.bgColor }}
                          >
                            {/* Main content */}
                            <div className="mb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <span 
                                    className="text-sm block mb-0.5"
                                    style={{ color: colors.text.primary }}
                                  >
                                    {cluster.name}
                                  </span>
                                  <span 
                                    className="text-xs block"
                                    style={{ color: colors.text.muted }}
                                  >
                                    {cluster.leaderName || 'No leader'} • {cluster.memberCount} members
                                  </span>
                                </div>
                                
                                {/* Status text */}
                                <span 
                                  className="text-xs"
                                  style={{ color: statusColor }}
                                >
                                  {statusText}
                                </span>
                              </div>
                            </div>
                            
                            {/* Progress bar */}
                            <div 
                              className="h-px rounded-full overflow-hidden"
                              style={{ backgroundColor: 'rgba(0, 0, 0, 0.08)' }}
                            >
                              <div 
                                className="h-full transition-all duration-500"
                                style={{ 
                                  width: absentCount === 0 ? '100%' : `${percent}%`, 
                                  backgroundColor: absentCount === 0 || percent === 100
                                    ? colors.accent.sage 
                                    : colors.accent.amber
                                }}
                              />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {(!clusters || clusters.length === 0) && (
                <div 
                  className="p-4 rounded-xl text-center text-sm"
                  style={{ color: colors.text.muted }}
                >
                  No clusters yet
                </div>
              )}
            </div>
          </div>

          {/* Cluster Heads */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                Leadership
              </span>
              <Link 
                href="/cluster-admin/heads" 
                className="text-xs flex items-center gap-1"
                style={{ color: colors.text.muted }}
              >
                View heads <ArrowRight />
              </Link>
            </div>
            
            <Link
              href="/cluster-admin/heads"
              className="flex items-center justify-between p-4 rounded-xl transition-colors"
              style={{ backgroundColor: colors.surface }}
            >
              <div>
                <span 
                  className="text-sm block"
                  style={{ color: colors.text.primary }}
                >
                  Cluster Heads
                </span>
                <span 
                  className="text-xs mt-0.5 block"
                  style={{ color: colors.text.muted }}
                >
                  Manage cluster leaders and assignments
                </span>
              </div>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={colors.text.muted} 
                strokeWidth="1.5"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </main>
      </div>

      {/* Create Cluster Modal */}
      {showCreateCluster && canEdit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(61, 58, 54, 0.5)' }}
          onClick={() => setShowCreateCluster(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h3 className="text-base" style={{ color: colors.text.primary }}>
                Create Cluster
              </h3>
            </div>
            <div className="px-5 pb-5 space-y-4">
              <div>
                <label 
                  className="text-xs mb-2 block"
                  style={{ color: colors.text.muted }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="Enter cluster name"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border-0 focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.surface,
                    color: colors.text.primary
                  }}
                />
              </div>
              <div>
                <label 
                  className="text-xs mb-2 block"
                  style={{ color: colors.text.muted }}
                >
                  Type
                </label>
                <select
                  value={newClusterType}
                  onChange={(e) => setNewClusterType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border-0 focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.surface,
                    color: colors.text.primary
                  }}
                >
                  <option value="">Select type...</option>
                  {CLUSTER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateCluster(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl transition-colors"
                  style={{ 
                    backgroundColor: colors.surfaceHover,
                    color: colors.text.secondary
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCluster}
                  disabled={!newClusterName.trim()}
                  className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50 transition-colors"
                  style={{ 
                    backgroundColor: colors.accent.amber,
                    color: colors.bg
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
