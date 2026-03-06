"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
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
};

interface Cluster {
  _id: string;
  name: string;
  memberCount: number;
  leaderName: string | null;
  leaderClerkId: string | null;
}

interface ClusterProgress {
  clusterId: string;
  clusterName: string;
  totalMembers: number;
  absentCount: number;
  loggedCount: number;
  pendingCount: number;
  completionRate: number;
}

export default function ClusterAdminDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const isAdmin = role === "admin";
  
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [selectedProgressDate, setSelectedProgressDate] = useState<string>(getLastSunday());

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );

  const clustersProgress = useQuery(
    api.clusterFollowUps.getAllClustersProgress,
    isAuthenticated ? { date: selectedProgressDate } : "skip"
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-base" style={{ color: theme.text.primary }}>
            Clusters
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
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            {isAdmin && (
              <button
                onClick={() => setShowCreateCluster(true)}
                className="px-4 py-2.5 rounded-xl text-sm whitespace-nowrap"
                style={{ backgroundColor: theme.accent, color: '#fff' }}
              >
                + New Cluster
              </button>
            )}
            <Link
              href="/cluster-admin/heads"
              className="px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text.primary }}
            >
              {isAdmin ? 'Manage Heads' : 'View Heads'}
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
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-xl" style={{ color: theme.text.primary }}>{stats.totalClusters}</p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Clusters</p>
              </div>
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-xl" style={{ color: theme.text.primary }}>{stats.totalMembersInClusters}</p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Members</p>
              </div>
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-xl" style={{ color: stats.unassignedMembers > 0 ? theme.warning : theme.text.primary }}>
                  {stats.unassignedMembers}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Unassigned</p>
              </div>
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-xl" style={{ color: stats.clustersNeedingAttention > 0 ? theme.danger : theme.text.primary }}>
                  {stats.clustersNeedingAttention}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Attention</p>
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
                  <Link
                    key={cluster._id}
                    href={`/cluster-admin/detail/${cluster._id}`}
                    className="block p-4 rounded-xl border"
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
                            {loggedCount}/{absentCount}
                          </p>
                        )}
                      </div>
                    </div>
                    {absentCount > 0 && (
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
                        <div 
                          className="h-full rounded-full"
                          style={{ width: `${percent}%`, backgroundColor: percent === 100 ? theme.success : theme.accent }}
                        />
                      </div>
                    )}
                  </Link>
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
                {pendingRequests.slice(0, 5).map((req: any) => (
                  <Link
                    key={req._id}
                    href={`/cluster-admin/detail/${req.clusterId}`}
                    className="block p-4 rounded-xl border"
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
      </main>

      {/* Create Cluster Modal - Admin only */}
      {showCreateCluster && isAdmin && (
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
    </div>
  );
}
