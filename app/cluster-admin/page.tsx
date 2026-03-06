"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate, getLastSunday, getPreviousSundays } from "@/lib/date";

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
  const userRoles = useMemo(() => {
    const metadata = user?.publicMetadata as { roles?: string[]; role?: string } | undefined;
    const roles = new Set<string>();
    if (metadata?.role) roles.add(metadata.role);
    if (metadata?.roles) metadata.roles.forEach((r) => roles.add(r));
    return Array.from(roles);
  }, [user]);
  const isAdmin = userRoles.includes("admin");
  const canEdit = isAdmin || userRoles.includes("cluster-admin");
  
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
    <AuthenticatedLayout>
      {/* Simple Header */}
      <header className="sticky top-0 z-30 border-b bg-white px-4 h-14 flex items-center justify-between">
        <h1 className="text-base font-medium text-zinc-900">Clusters</h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {canEdit && (
            <button
              onClick={() => setShowCreateCluster(true)}
              className="px-4 py-2.5 rounded-xl text-sm whitespace-nowrap bg-amber-700 text-white hover:bg-amber-800"
            >
              + New Cluster
            </button>
          )}
          <Link
            href="/cluster-admin/heads"
            className="px-4 py-2.5 rounded-xl text-sm border border-zinc-200 bg-white whitespace-nowrap hover:bg-zinc-50"
          >
            {canEdit ? 'Manage Heads' : 'View Heads'}
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-4 rounded-xl border border-zinc-200 bg-white text-center">
              <p className="text-xl text-zinc-900">{stats.totalClusters}</p>
              <p className="text-xs mt-1 text-zinc-500">Clusters</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 bg-white text-center">
              <p className="text-xl text-zinc-900">{stats.totalMembersInClusters}</p>
              <p className="text-xs mt-1 text-zinc-500">Members</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 bg-white text-center">
              <p className={`text-xl ${stats.unassignedMembers > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                {stats.unassignedMembers}
              </p>
              <p className="text-xs mt-1 text-zinc-500">Unassigned</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 bg-white text-center">
              <p className={`text-xl ${stats.clustersNeedingAttention > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                {stats.clustersNeedingAttention}
              </p>
              <p className="text-xs mt-1 text-zinc-500">Attention</p>
            </div>
          </div>
        )}

        {/* Follow-up Progress Overview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Follow-up Progress
            </span>
            <select
              value={selectedProgressDate}
              onChange={(e) => setSelectedProgressDate(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-zinc-200 bg-white"
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
                  className="block p-4 rounded-xl border border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block text-zinc-900">
                        {cluster.name}
                      </span>
                      <span className="text-xs block text-zinc-500">
                        {cluster.leaderName || 'No leader'} • {cluster.memberCount} members
                        {absentCount > 0 && ` • ${absentCount} absent`}
                      </span>
                    </div>
                    <div className="text-right ml-4">
                      <span 
                        className={`text-lg ${
                          percent === 100 && absentCount > 0 ? 'text-emerald-600' : 
                          percent === 0 && absentCount > 0 ? 'text-rose-600' :
                          absentCount === 0 ? 'text-zinc-400' :
                          'text-zinc-900'
                        }`}
                      >
                        {absentCount === 0 ? '—' : `${percent}%`}
                      </span>
                      {absentCount > 0 && (
                        <p className="text-xs text-zinc-500">
                          {loggedCount}/{absentCount}
                        </p>
                      )}
                    </div>
                  </div>
                  {absentCount > 0 && (
                    <div className="h-1.5 rounded-full overflow-hidden bg-zinc-200">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${percent}%`, 
                          backgroundColor: percent === 100 ? '#10b981' : '#7c6f5a'
                        }}
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
            <span className="text-xs uppercase tracking-wide mb-3 px-1 block text-rose-600">
              Attention Requests ({pendingRequests.length})
            </span>
            <div className="space-y-2">
              {pendingRequests.slice(0, 5).map((req: any) => (
                <Link
                  key={req._id}
                  href={`/cluster-admin/detail/${req.clusterId}`}
                  className="block p-4 rounded-xl border border-zinc-200 bg-white hover:border-rose-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm block text-zinc-900">
                        {req.memberName}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {req.clusterName} • {formatIsoDate(req.date)}
                      </span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9997" strokeWidth="2">
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
      {showCreateCluster && canEdit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowCreateCluster(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-200">
              <h3 className="text-base text-zinc-900">Create New Cluster</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs mb-2 block text-zinc-500">
                  Cluster Name
                </label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="Enter cluster name..."
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateCluster(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCluster}
                  disabled={!newClusterName.trim()}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-amber-700 text-white disabled:opacity-50 hover:bg-amber-800"
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
