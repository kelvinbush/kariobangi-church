"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate, getLastSunday, getPreviousSundays } from "@/lib/date";

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
  memberCount: number;
  leaderName: string | null;
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
  
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(getLastSunday());

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
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

              {canEdit && (
                <button
                  onClick={() => setShowCreateCluster(true)}
                  className="mt-6 text-sm px-4 py-2 rounded-full transition-colors"
                  style={{ 
                    backgroundColor: colors.accent.amber,
                    color: colors.bg
                  }}
                >
                  Create new cluster
                </button>
              )}
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

          {/* Follow-up Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                Follow-up Progress
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
            
            <div className="space-y-2">
              {clusters?.map((cluster: Cluster) => {
                const progress = progressMap[cluster._id];
                const percent = progress?.completionRate ?? 0;
                const absentCount = progress?.absentCount ?? 0;
                
                return (
                  <Link
                    key={cluster._id}
                    href={`/cluster-admin/detail/${cluster._id}`}
                    className="block p-4 rounded-xl transition-colors"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <span 
                          className="text-sm truncate block"
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
                      <div className="text-right ml-4">
                        <span 
                          className="text-lg"
                          style={{ 
                            color: absentCount === 0 
                              ? colors.text.muted 
                              : percent === 100 
                                ? colors.accent.sage 
                                : colors.text.primary
                          }}
                        >
                          {absentCount === 0 ? '—' : `${percent}%`}
                        </span>
                      </div>
                    </div>
                    {absentCount > 0 && (
                      <div 
                        className="h-1 rounded-full"
                        style={{ backgroundColor: 'rgba(201, 168, 124, 0.2)' }}
                      >
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percent}%`, 
                            backgroundColor: percent === 100 
                              ? colors.accent.sage 
                              : colors.accent.amber
                          }}
                        />
                      </div>
                    )}
                  </Link>
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
