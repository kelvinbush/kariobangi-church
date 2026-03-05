"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
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
    todo: { bg: '#f5f5f5', text: '#616161' },
    inProgress: { bg: '#fff3e0', text: '#ef6c00' },
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
  
  // Modals
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [showAssignLeader, setShowAssignLeader] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState<string>("");

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );
  const clusterHeads = useQuery(api.clusterHeads.list, isAuthenticated ? { activeOnly: true } : "skip");

  const clustersProgress = useQuery(
    api.clusterFollowUps.getAllClustersProgress,
    isAuthenticated ? { date: selectedProgressDate } : "skip"
  );

  const clusterLogs = useQuery(
    api.clusterFollowUps.getLogs,
    selectedCluster ? { clusterId: selectedCluster._id, limit: 100 } : "skip"
  );

  const createCluster = useMutation(api.clusters.create);
  const assignLeader = useMutation(api.clusters.assignLeader);
  const removeLeader = useMutation(api.clusters.removeLeader);

  const recentSundays = useMemo(() => getPreviousSundays(4), []);
  const lastSunday = getLastSunday();

  const progressMap = useMemo(() => {
    const map: Record<string, ClusterProgress> = {};
    clustersProgress?.forEach((p: ClusterProgress) => {
      map[p.clusterId] = p;
    });
    return map;
  }, [clustersProgress]);

  const filteredLogs = useMemo(() => {
    if (!clusterLogs) return [];
    if (selectedDateFilter === 'all') return clusterLogs;
    return clusterLogs.filter((log: FollowUpLog) => log.date === selectedDateFilter);
  }, [clusterLogs, selectedDateFilter]);

  const logsByDate = useMemo(() => {
    const grouped: Record<string, FollowUpLog[]> = {};
    filteredLogs.forEach((log: FollowUpLog) => {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    });
    return grouped;
  }, [filteredLogs]);

  // Unassigned heads (available to assign)
  const unassignedHeads = clusterHeads?.filter((h: { clusterId: Id<"clusters"> | null }) => !h.clusterId) || [];

  const handleCreateCluster = async () => {
    if (!newClusterName.trim()) return;
    try {
      await createCluster({ name: newClusterName.trim() });
      setNewClusterName("");
      setShowCreateCluster(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create cluster");
    }
  };

  const handleAssignLeader = async () => {
    if (!selectedCluster || !selectedHeadId) return;
    try {
      await assignLeader({ 
        clusterId: selectedCluster._id, 
        clerkId: selectedHeadId 
      });
      setSelectedHeadId("");
      setShowAssignLeader(false);
      setSelectedCluster(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign leader");
    }
  };

  const handleRemoveLeader = async () => {
    if (!selectedCluster) return;
    if (!confirm(`Remove ${selectedCluster.leaderName} as leader of ${selectedCluster.name}?`)) return;
    try {
      await removeLeader({ clusterId: selectedCluster._id });
      setSelectedCluster(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove leader");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-base" style={{ color: theme.text.primary }}>
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
            <p className="text-sm mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to view cluster information
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm rounded-xl border"
                style={{ borderColor: theme.text.primary, color: theme.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setShowCreateCluster(true)}
              className="px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap"
              style={{ backgroundColor: theme.accent, color: '#fff', borderColor: theme.accent }}
            >
              + New Cluster
            </button>
            <Link
              href="/cluster-admin/heads"
              className="px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text.primary }}
            >
              Manage Heads
            </Link>
            <Link
              href="/cluster-admin/members"
              className="px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text.primary }}
            >
              All Members
            </Link>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div 
                className="p-4 rounded-xl border text-center"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-xl" style={{ color: theme.text.primary }}>
                  {stats.totalClusters}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                  Clusters
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-xl" style={{ color: theme.text.primary }}>
                  {stats.totalMembersInClusters}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                  Members
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-xl" style={{ color: stats.unassignedMembers > 0 ? theme.warning : theme.text.primary }}>
                  {stats.unassignedMembers}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                  Unassigned
                </p>
              </div>
              <div 
                className="p-4 rounded-xl border text-center"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <p className="text-xl" style={{ color: stats.clustersNeedingAttention > 0 ? theme.danger : theme.text.primary }}>
                  {stats.clustersNeedingAttention}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                  Attention
                </p>
              </div>
            </div>
          )}

          {/* Follow-up Progress Overview */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs uppercase tracking-wide" style={{ color: theme.text.muted }}>
                Follow-up Progress
              </span>
              <select
                value={selectedProgressDate}
                onChange={(e) => setSelectedProgressDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border"
                style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text.primary }}
              >
                {recentSundays.map((sunday) => (
                  <option key={sunday} value={sunday}>
                    {formatIsoDate(sunday)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              {clusters && clusters.map((cluster: Cluster) => {
                const progress = progressMap[cluster._id];
                const percent = progress?.completionRate ?? 0;
                const absentCount = progress?.absentCount ?? 0;
                const loggedCount = progress?.loggedCount ?? 0;
                
                return (
                  <button
                    key={cluster._id}
                    onClick={() => setSelectedCluster(cluster)}
                    className="w-full p-4 rounded-xl border text-left"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block" style={{ color: theme.text.primary }}>
                          {cluster.name}
                        </span>
                        <span className="text-xs block" style={{ color: theme.text.muted }}>
                          {cluster.leaderName || 'No leader'} • {cluster.memberCount} members
                          {absentCount > 0 && ` • ${absentCount} absent`}
                        </span>
                      </div>
                      <div className="text-right ml-4">
                        <span 
                          className="text-lg" 
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
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percent}%`, backgroundColor: percent === 100 ? theme.success : theme.accent }}
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
              <span className="text-xs uppercase tracking-wide mb-3 px-1 block" style={{ color: theme.danger }}>
                Attention Requests ({pendingRequests.length})
              </span>
              <div className="space-y-2">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div 
                    key={req._id}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm block" style={{ color: theme.text.primary }}>
                          {req.memberName}
                        </span>
                        <span className="text-xs" style={{ color: theme.text.muted }}>
                          {req.clusterName} • {formatIsoDate(req.date)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const cluster = clusters?.find((c: Cluster) => c._id === req.clusterId);
                          if (cluster) setSelectedCluster(cluster);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs border"
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

      {/* Create Cluster Modal */}
      {showCreateCluster && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowCreateCluster(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Create New Cluster</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Cluster Name
                </label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="Enter cluster name..."
                  className="w-full px-3 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.primary }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateCluster(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCluster}
                  disabled={!newClusterName.trim()}
                  className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
              <div>
                <span className="text-base block" style={{ color: theme.text.primary }}>
                  {selectedCluster.name}
                </span>
                <span className="text-xs" style={{ color: theme.text.muted }}>
                  {selectedCluster.memberCount} members
                </span>
              </div>
              <button onClick={() => setSelectedCluster(null)} className="p-2" style={{ color: theme.text.secondary }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Leader Management */}
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
                Leader Management
              </span>
              {selectedCluster.leaderName ? (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: theme.bg }}>
                  <div>
                    <span className="text-sm block" style={{ color: theme.text.primary }}>
                      {selectedCluster.leaderName}
                    </span>
                    <span className="text-xs" style={{ color: theme.text.muted }}>Current Leader</span>
                  </div>
                  <button
                    onClick={handleRemoveLeader}
                    className="px-3 py-1.5 rounded-lg text-xs border"
                    style={{ borderColor: theme.danger, color: theme.danger }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm mb-3" style={{ color: theme.text.secondary }}>No leader assigned</p>
                  {unassignedHeads.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={selectedHeadId}
                        onChange={(e) => setSelectedHeadId(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border"
                        style={{ borderColor: theme.border, color: theme.text.primary }}
                      >
                        <option value="">Select a head...</option>
                        {unassignedHeads.map((head: { clerkId: string; displayName: string }) => (
                          <option key={head.clerkId} value={head.clerkId}>
                            {head.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignLeader}
                        disabled={!selectedHeadId}
                        className="px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                        style={{ backgroundColor: theme.accent, color: '#fff' }}
                      >
                        Assign
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: theme.text.muted }}>
                      No unassigned heads available. <Link href="/cluster-admin/heads" className="underline">Invite a head</Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: theme.border }}>
              {(['overview', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm capitalize"
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
                    <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <p className="text-xl" style={{ color: theme.text.primary }}>{selectedCluster.memberCount}</p>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Members</p>
                    </div>
                    <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.status.done.bg, borderColor: theme.status.done.bg }}>
                      <p className="text-xl" style={{ color: theme.status.done.text }}>
                        {clusterLogs?.filter((l: FollowUpLog) => l.date === lastSunday).length || 0}
                      </p>
                      <p className="text-xs mt-1" style={{ color: theme.status.done.text, opacity: 0.8 }}>This Sunday</p>
                    </div>
                    <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                      <p className="text-xl" style={{ color: theme.text.primary }}>{clusterLogs?.length || 0}</p>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Total Logs</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <span className="text-xs uppercase tracking-wide mb-3 block" style={{ color: theme.text.muted }}>
                      Recent Activity
                    </span>
                    {clusterLogs && clusterLogs.length > 0 ? (
                      <div className="space-y-2">
                        {clusterLogs.slice(0, 5).map((log: FollowUpLog) => (
                          <div key={log._id} className="p-3 rounded-xl border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm" style={{ color: theme.text.primary }}>{log.memberName}</span>
                              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: theme.status.done.bg, color: theme.status.done.text }}>
                                {log.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs mt-1" style={{ color: theme.text.muted }}>{formatIsoDate(log.date)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm py-4 text-center" style={{ color: theme.text.muted }}>No follow-up logs yet</p>
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
                      className="px-3 py-1.5 rounded-lg text-xs border"
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
                        className="px-3 py-1.5 rounded-lg text-xs border"
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
                          <span className="text-xs uppercase tracking-wide mb-2 px-1 block" style={{ color: theme.text.muted }}>
                            {formatIsoDate(date)}
                          </span>
                          <div className="space-y-2">
                            {(logs as FollowUpLog[]).map((log) => (
                              <div key={log._id} className="p-4 rounded-xl border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <span className="text-sm block" style={{ color: theme.text.primary }}>{log.memberName}</span>
                                    {log.comment && <span className="text-xs block mt-1" style={{ color: theme.text.secondary }}>{log.comment}</span>}
                                  </div>
                                  <span className="px-2 py-1 rounded-lg text-xs flex-shrink-0"
                                    style={{ 
                                      backgroundColor: 
                                        log.status === 'contacted' ? theme.status.done.bg :
                                        log.status === 'needs_attention' ? theme.status.blocked.bg :
                                        log.status === 'not_reachable' ? theme.status.inProgress.bg : theme.status.todo.bg,
                                      color: 
                                        log.status === 'contacted' ? theme.status.done.text :
                                        log.status === 'needs_attention' ? theme.status.blocked.text :
                                        log.status === 'not_reachable' ? theme.status.inProgress.text : theme.status.todo.text,
                                    }}
                                  >
                                    {log.status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs mt-2" style={{ color: theme.text.muted }}>{new Date(log.loggedAt).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-sm" style={{ color: theme.text.secondary }}>No logs found</p>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                        {selectedDateFilter === 'all' ? 'No follow-up history for this cluster' : `No logs for ${formatIsoDate(selectedDateFilter)}`}
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
