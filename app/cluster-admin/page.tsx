"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate, getLastSunday, getPreviousSundays } from "@/lib/date";

// Clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  success: '#5a7a5a',
  warning: '#b8a050',
  danger: '#a06060',
  
  status: {
    done: { bg: '#e8f5e9', text: '#2e7d32' },
    inProgress: { bg: '#fff3e0', text: '#ef6c00' },
    todo: { bg: '#f5f5f5', text: '#616161' },
    blocked: { bg: '#ffebee', text: '#c62828' },
  },
};

interface Cluster {
  _id: Id<"clusters">;
  name: string;
  memberCount: number;
  leaderName: string | null;
  leaderClerkId: string | null;
}

interface FollowUpLog {
  _id: Id<"clusterFollowUpLogs">;
  memberId: Id<"members">;
  memberName: string;
  date: string;
  status: string;
  comment: string;
  loggedAt: number;
}

interface ClusterProgress {
  clusterId: Id<"clusters">;
  clusterName: string;
  totalMembers: number;
  absentCount: number;
  loggedCount: number;
  pendingCount: number;
  completionRate: number;
}

export default function ClusterAdminDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedProgressDate, setSelectedProgressDate] = useState<string>(getLastSunday());

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );

  // Get real follow-up progress for all clusters
  const clustersProgress = useQuery(
    api.clusterFollowUps.getAllClustersProgress,
    isAuthenticated ? { date: selectedProgressDate } : "skip"
  );

  // Get logs for selected cluster
  const clusterLogs = useQuery(
    api.clusterFollowUps.getLogs,
    selectedCluster ? { clusterId: selectedCluster._id, limit: 100 } : "skip"
  );

  // Get recent Sundays for filtering
  const recentSundays = useMemo(() => getPreviousSundays(4), []);
  const lastSunday = getLastSunday();

  // Create a map of progress by cluster ID
  const progressMap = useMemo(() => {
    const map: Record<string, ClusterProgress> = {};
    clustersProgress?.forEach((p: ClusterProgress) => {
      map[p.clusterId] = p;
    });
    return map;
  }, [clustersProgress]);

  // Filter logs by date
  const filteredLogs = useMemo(() => {
    if (!clusterLogs) return [];
    if (selectedDateFilter === 'all') return clusterLogs;
    return clusterLogs.filter((log: FollowUpLog) => log.date === selectedDateFilter);
  }, [clusterLogs, selectedDateFilter]);

  // Group logs by date for history view
  const logsByDate = useMemo(() => {
    const grouped: Record<string, FollowUpLog[]> = {};
    filteredLogs.forEach((log: FollowUpLog) => {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    });
    return grouped;
  }, [filteredLogs]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: theme.text.primary }}>
            Cluster Admin
          </span>
          <Link 
            href="/" 
            className="text-sm"
            style={{ color: theme.text.secondary }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-base mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to view cluster information
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-3 text-base font-medium rounded-xl border"
                style={{ borderColor: theme.text.primary, color: theme.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div 
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-2xl font-bold" style={{ color: theme.text.primary }}>
                  {stats.totalClusters}
                </p>
                <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: theme.text.muted }}>
                  Clusters
                </p>
              </div>
              <div 
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-2xl font-bold" style={{ color: theme.text.primary }}>
                  {stats.totalMembersInClusters}
                </p>
                <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: theme.text.muted }}>
                  Members
                </p>
              </div>
              <div 
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-2xl font-bold" style={{ color: stats.unassignedMembers > 0 ? theme.warning : theme.text.primary }}>
                  {stats.unassignedMembers}
                </p>
                <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: theme.text.muted }}>
                  Unassigned
                </p>
              </div>
              <div 
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-2xl font-bold" style={{ color: stats.clustersNeedingAttention > 0 ? theme.danger : theme.text.primary }}>
                  {stats.clustersNeedingAttention}
                </p>
                <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: theme.text.muted }}>
                  Attention
                </p>
              </div>
            </div>
          )}

          {/* Follow-up Progress Overview */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.text.muted }}>
                Follow-up Progress
              </h2>
              <select
                value={selectedProgressDate}
                onChange={(e) => setSelectedProgressDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border"
                style={{ 
                  borderColor: theme.border, 
                  backgroundColor: theme.bg,
                  color: theme.text.primary,
                }}
              >
                {recentSundays.map((sunday) => (
                  <option key={sunday} value={sunday}>
                    {formatIsoDate(sunday)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-3">
              {clusters && clusters.map((cluster: Cluster) => {
                const progress = progressMap[cluster._id];
                const percent = progress?.completionRate ?? 0;
                const absentCount = progress?.absentCount ?? 0;
                const loggedCount = progress?.loggedCount ?? 0;
                
                return (
                  <button
                    key={cluster._id}
                    onClick={() => setSelectedCluster(cluster)}
                    className="w-full p-4 rounded-2xl border text-left"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold truncate" style={{ color: theme.text.primary }}>
                          {cluster.name}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: theme.text.muted }}>
                          {cluster.leaderName || 'No leader'} • {cluster.memberCount} members
                          {absentCount > 0 && ` • ${absentCount} absent`}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <span 
                          className="text-lg font-bold" 
                          style={{ 
                            color: percent === 100 && absentCount > 0 ? theme.success : 
                                   percent === 0 && absentCount > 0 ? theme.danger :
                                   absentCount === 0 ? theme.text.muted :
                                   theme.text.primary 
                          }}
                        >
                          {absentCount === 0 ? '—' : `${percent}%`}
                        </span>
                        {absentCount > 0 && (
                          <p className="text-xs" style={{ color: theme.text.muted }}>
                            {loggedCount}/{absentCount} done
                          </p>
                        )}
                      </div>
                    </div>
                    {absentCount > 0 && (
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percent}%`, 
                            backgroundColor: percent === 100 ? theme.success : theme.accent 
                          }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wide mb-3 px-1" style={{ color: theme.danger }}>
                Attention Requests ({pendingRequests.length})
              </h2>
              <div className="space-y-2">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div 
                    key={req._id}
                    className="p-4 rounded-2xl border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold" style={{ color: theme.text.primary }}>
                          {req.memberName}
                        </p>
                        <p className="text-sm" style={{ color: theme.text.muted }}>
                          {req.clusterName} • {formatIsoDate(req.date)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const cluster = clusters?.find((c: Cluster) => c._id === req.clusterId);
                          if (cluster) setSelectedCluster(cluster);
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm border"
                        style={{ borderColor: theme.border, color: theme.text.secondary }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SignedIn>
      </main>

      {/* Cluster Detail Modal */}
      {selectedCluster && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedCluster(null)}
        >
          <div 
            className="w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: theme.surface, maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.border }}
            >
              <div>
                <h3 className="text-xl font-bold" style={{ color: theme.text.primary }}>
                  {selectedCluster.name}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: theme.text.muted }}>
                  {selectedCluster.leaderName || 'No leader'} • {selectedCluster.memberCount} members
                </p>
              </div>
              <button 
                onClick={() => setSelectedCluster(null)}
                className="p-2"
                style={{ color: theme.text.secondary }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div 
              className="flex border-b"
              style={{ borderColor: theme.border }}
            >
              {(['overview', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm font-medium capitalize"
                  style={{ 
                    color: activeTab === tab ? theme.text.primary : theme.text.muted,
                    borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : '2px solid transparent',
                    marginBottom: '-2px'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div 
                      className="p-4 rounded-xl border text-center"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <p className="text-2xl font-bold" style={{ color: theme.text.primary }}>
                        {selectedCluster.memberCount}
                      </p>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                        Members
                      </p>
                    </div>
                    <div 
                      className="p-4 rounded-xl border text-center"
                      style={{ backgroundColor: theme.status.done.bg, borderColor: theme.status.done.bg }}
                    >
                      <p className="text-2xl font-bold" style={{ color: theme.status.done.text }}>
                        {clusterLogs?.filter((l: FollowUpLog) => l.date === lastSunday).length || 0}
                      </p>
                      <p className="text-xs mt-1" style={{ color: theme.status.done.text, opacity: 0.8 }}>
                        This Sunday
                      </p>
                    </div>
                    <div 
                      className="p-4 rounded-xl border text-center"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <p className="text-2xl font-bold" style={{ color: theme.text.primary }}>
                        {clusterLogs?.length || 0}
                      </p>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                        Total Logs
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <h4 className="text-sm font-semibold mb-3" style={{ color: theme.text.secondary }}>
                      Recent Activity
                    </h4>
                    {clusterLogs && clusterLogs.length > 0 ? (
                      <div className="space-y-2">
                        {clusterLogs.slice(0, 5).map((log: FollowUpLog) => (
                          <div 
                            key={log._id}
                            className="p-3 rounded-xl border"
                            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
                                {log.memberName}
                              </span>
                              <span 
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ 
                                  backgroundColor: theme.status.done.bg,
                                  color: theme.status.done.text
                                }}
                              >
                                {log.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                              {formatIsoDate(log.date)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm py-4 text-center" style={{ color: theme.text.muted }}>
                        No follow-up logs yet
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {/* Date Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setSelectedDateFilter('all')}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border"
                      style={{ 
                        borderColor: selectedDateFilter === 'all' ? theme.accent : theme.border,
                        backgroundColor: selectedDateFilter === 'all' ? theme.accent : 'transparent',
                        color: selectedDateFilter === 'all' ? '#fff' : theme.text.primary,
                      }}
                    >
                      All Time
                    </button>
                    {recentSundays.map((sunday) => (
                      <button
                        key={sunday}
                        onClick={() => setSelectedDateFilter(sunday)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border"
                        style={{ 
                          borderColor: selectedDateFilter === sunday ? theme.accent : theme.border,
                          backgroundColor: selectedDateFilter === sunday ? theme.accent : 'transparent',
                          color: selectedDateFilter === sunday ? '#fff' : theme.text.primary,
                        }}
                      >
                        {formatIsoDate(sunday)}
                      </button>
                    ))}
                  </div>

                  {/* Logs by Date */}
                  {Object.keys(logsByDate).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(logsByDate)
                        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                        .map(([date, logs]) => (
                        <div key={date}>
                          <h4 className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: theme.text.muted }}>
                            {formatIsoDate(date)}
                          </h4>
                          <div className="space-y-2">
                            {logs.map((log: FollowUpLog) => (
                              <div 
                                key={log._id}
                                className="p-4 rounded-xl border"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="text-base font-semibold" style={{ color: theme.text.primary }}>
                                      {log.memberName}
                                    </p>
                                    {log.comment && (
                                      <p className="text-sm mt-1" style={{ color: theme.text.secondary }}>
                                        {log.comment}
                                      </p>
                                    )}
                                  </div>
                                  <span 
                                    className="px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0"
                                    style={{ 
                                      backgroundColor: 
                                        log.status === 'contacted' ? theme.status.done.bg :
                                        log.status === 'needs_attention' ? theme.status.blocked.bg :
                                        log.status === 'not_reachable' ? theme.status.inProgress.bg :
                                        theme.status.todo.bg,
                                      color: 
                                        log.status === 'contacted' ? theme.status.done.text :
                                        log.status === 'needs_attention' ? theme.status.blocked.text :
                                        log.status === 'not_reachable' ? theme.status.inProgress.text :
                                        theme.status.todo.text,
                                    }}
                                  >
                                    {log.status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs mt-2" style={{ color: theme.text.muted }}>
                                  {new Date(log.loggedAt).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div 
                        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: theme.border }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-base font-medium" style={{ color: theme.text.secondary }}>
                        No logs found
                      </p>
                      <p className="text-sm mt-1" style={{ color: theme.text.muted }}>
                        {selectedDateFilter === 'all' 
                          ? 'No follow-up history for this cluster'
                          : `No logs for ${formatIsoDate(selectedDateFilter)}`
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
