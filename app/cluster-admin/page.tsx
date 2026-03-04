"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";

// Dashboard Color Palette
const colors = {
  bg: '#faf9f6',
  card: '#ffffff',
  border: '#e8e4df',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5c5a56',
    muted: '#9a9590',
  },
  
  accent: '#8b7355',
  success: '#5a7a5a',
  warning: '#b8a050',
  danger: '#a06060',
};

export default function ClusterAdminDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.card, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke={colors.text.primary} strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <><path d="M15 5L5 15M5 5l10 10" /></>
                ) : (
                  <><path d="M3 6h14M3 10h14M3 14h14" /></>
                )}
              </svg>
            </button>
            <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
              Cluster Admin
            </span>
          </div>
          <Link 
            href="/" 
            className="text-sm"
            style={{ color: colors.text.secondary }}
          >
            Dashboard
          </Link>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <Link href="/cluster-admin" className="block py-2 text-sm" style={{ color: colors.text.primary }}>
              Overview
            </Link>
            <Link href="/cluster-admin/clusters" className="block py-2 text-sm" style={{ color: colors.text.secondary }}>
              Clusters
            </Link>
            <Link href="/cluster-admin/members" className="block py-2 text-sm" style={{ color: colors.text.secondary }}>
              Members
            </Link>
            <Link href="/cluster-admin/heads" className="block py-2 text-sm" style={{ color: colors.text.secondary }}>
              Heads
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              Please sign in to view cluster information
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm border rounded"
                style={{ borderColor: colors.text.primary, color: colors.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <p className="text-2xl font-semibold mb-1" style={{ color: colors.text.primary }}>
                  {stats.totalClusters}
                </p>
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                  Clusters
                </p>
              </div>
              <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <p className="text-2xl font-semibold mb-1" style={{ color: colors.text.primary }}>
                  {stats.totalMembersInClusters}
                </p>
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                  Members
                </p>
              </div>
              <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <p className="text-2xl font-semibold mb-1" style={{ color: stats.unassignedMembers > 0 ? colors.warning : colors.text.primary }}>
                  {stats.unassignedMembers}
                </p>
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                  Unassigned
                </p>
              </div>
              <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <p className="text-2xl font-semibold mb-1" style={{ color: stats.clustersNeedingAttention > 0 ? colors.danger : colors.text.primary }}>
                  {stats.clustersNeedingAttention}
                </p>
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                  Attention
                </p>
              </div>
            </div>
          )}

          {/* Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.danger }} />
                <h2 className="text-xs uppercase tracking-wide font-medium" style={{ color: colors.text.primary }}>
                  Attention Requests ({pendingRequests.length})
                </h2>
              </div>
              <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                {pendingRequests.slice(0, 5).map((req, idx) => (
                  <div 
                    key={req._id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: idx < pendingRequests.length - 1 ? `1px solid ${colors.border}` : 'none' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{req.memberName}</p>
                      <p className="text-xs" style={{ color: colors.text.muted }}>
                        {req.clusterName} — {formatIsoDate(req.date)}
                      </p>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${req.clusterId}`}
                      className="text-xs px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
                      style={{ borderColor: colors.border, color: colors.text.secondary }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              href="/cluster-admin/clusters"
              className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.text.primary }}
            >
              Manage Clusters
            </Link>
            <Link
              href="/cluster-admin/members"
              className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.text.primary }}
            >
              All Members
            </Link>
            <Link
              href="/cluster-admin/heads"
              className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.text.primary }}
            >
              Cluster Heads
            </Link>
          </div>

          {/* Clusters Table */}
          <div>
            <h2 className="text-xs uppercase tracking-wide font-medium mb-3" style={{ color: colors.text.muted }}>
              Active Clusters
            </h2>
            <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              {clusters && clusters.length > 0 ? (
                <>
                  {/* Table Header */}
                  <div 
                    className="grid grid-cols-12 gap-4 px-4 py-3 text-xs uppercase tracking-wide"
                    style={{ 
                      backgroundColor: colors.bg,
                      color: colors.text.muted,
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <div className="col-span-6 sm:col-span-5">Cluster</div>
                    <div className="col-span-3 sm:col-span-3">Members</div>
                    <div className="col-span-3 sm:col-span-4 text-right">Action</div>
                  </div>
                  {/* Table Body */}
                  {clusters.map((cluster) => (
                    <div 
                      key={cluster._id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 items-center"
                      style={{ borderBottom: `1px solid ${colors.border}` }}
                    >
                      <div className="col-span-6 sm:col-span-5">
                        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                          {cluster.name}
                        </p>
                        {cluster.leaderName && (
                          <p className="text-xs" style={{ color: colors.text.muted }}>
                            {cluster.leaderName}
                          </p>
                        )}
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {cluster.memberCount}
                        </span>
                      </div>
                      <div className="col-span-3 sm:col-span-4 text-right">
                        <Link
                          href={`/cluster-admin/clusters?id=${cluster._id}`}
                          className="text-xs px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
                          style={{ borderColor: colors.border, color: colors.text.secondary }}
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    No active clusters
                  </p>
                </div>
              )}
            </div>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
