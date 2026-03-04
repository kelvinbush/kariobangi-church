"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";

// Luxury Color Palette - Warm, muted, earth-toned
const palette = {
  // Backgrounds
  canvas: '#faf9f6',      // Warm ivory
  surface: '#ffffff',     // Pure white
  muted: '#f5f3ef',       // Soft stone
  
  // Text
  primary: '#1a1a1a',     // Soft black (not pure #000)
  secondary: '#6b6560',   // Warm gray
  tertiary: '#9a9590',    // Light warm gray
  
  // Accents - Muted bronze/mocha
  accent: '#8b7355',      // Muted bronze
  accentLight: '#c4b5a0', // Light bronze
  
  // Functional
  border: '#e8e4df',      // Warm border
  divider: '#f0ece6',     // Subtle divider
  
  // States
  success: '#6b8e6b',     // Muted sage
  attention: '#b87070',   // Muted rose
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
    <div className="min-h-screen" style={{ backgroundColor: palette.canvas }}>
      {/* Header - Minimal, elegant */}
      <header style={{ backgroundColor: palette.surface }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={palette.primary} strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <><path d="M15 5L5 15M5 5l10 10" /></>
                ) : (
                  <><path d="M3 6h14M3 10h14M3 14h14" /></>
                )}
              </svg>
            </button>
            <span className="text-base tracking-wide" style={{ color: palette.primary }}>
              Cluster Overview
            </span>
          </div>
          <Link 
            href="/" 
            className="text-sm tracking-wide hidden sm:block"
            style={{ color: palette.tertiary }}
          >
            Return to Dashboard
          </Link>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t px-6 py-4 space-y-1" style={{ borderColor: palette.divider, backgroundColor: palette.surface }}>
            <Link href="/cluster-admin" className="block py-2 text-sm" style={{ color: palette.primary }}>
              Overview
            </Link>
            <Link href="/cluster-admin/clusters" className="block py-2 text-sm" style={{ color: palette.secondary }}>
              Clusters
            </Link>
            <Link href="/cluster-admin/members" className="block py-2 text-sm" style={{ color: palette.secondary }}>
              Members
            </Link>
            <Link href="/cluster-admin/heads" className="block py-2 text-sm" style={{ color: palette.secondary }}>
              Heads
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-8" style={{ color: palette.secondary }}>
              Please sign in to view cluster information
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-8 py-3 text-sm tracking-wide border transition-colors"
                style={{ borderColor: palette.primary, color: palette.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Page Title */}
          <div className="mb-12">
            <h1 className="text-2xl tracking-tight mb-2" style={{ color: palette.primary }}>
              Clusters
            </h1>
            <p className="text-sm" style={{ color: palette.secondary }}>
              Monitor cluster attendance and follow-ups
            </p>
          </div>

          {/* Stats - Inline, minimal */}
          {stats && (
            <div className="flex flex-wrap gap-8 mb-16 pb-12 border-b" style={{ borderColor: palette.divider }}>
              <div>
                <p className="text-3xl tracking-tight mb-1" style={{ color: palette.primary }}>
                  {stats.totalClusters}
                </p>
                <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                  Active Clusters
                </p>
              </div>
              <div>
                <p className="text-3xl tracking-tight mb-1" style={{ color: palette.primary }}>
                  {stats.totalMembersInClusters}
                </p>
                <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                  Members
                </p>
              </div>
              <div>
                <p className="text-3xl tracking-tight mb-1" style={{ color: stats.unassignedMembers > 0 ? palette.attention : palette.primary }}>
                  {stats.unassignedMembers}
                </p>
                <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                  Unassigned
                </p>
              </div>
              {stats.clustersNeedingAttention > 0 && (
                <div>
                  <p className="text-3xl tracking-tight mb-1" style={{ color: palette.attention }}>
                    {stats.clustersNeedingAttention}
                  </p>
                  <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                    Need Attention
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-16">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.attention }} />
                <h2 className="text-sm tracking-wide" style={{ color: palette.primary }}>
                  Attention Requests
                </h2>
                <span className="text-xs" style={{ color: palette.tertiary }}>
                  ({pendingRequests.length})
                </span>
              </div>
              <div className="space-y-4">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div 
                    key={req._id}
                    className="flex items-center justify-between py-4 border-b"
                    style={{ borderColor: palette.divider }}
                  >
                    <div>
                      <p className="text-sm mb-1" style={{ color: palette.primary }}>{req.memberName}</p>
                      <p className="text-xs" style={{ color: palette.tertiary }}>
                        {req.clusterName} — {formatIsoDate(req.date)}
                      </p>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${req.clusterId}`}
                      className="text-xs tracking-wide"
                      style={{ color: palette.accent }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className="mb-16">
            <div className="flex gap-6 text-sm">
              <Link href="/cluster-admin/clusters" className="tracking-wide" style={{ color: palette.accent }}>
                View Clusters
              </Link>
              <Link href="/cluster-admin/members" className="tracking-wide" style={{ color: palette.secondary }}>
                Members
              </Link>
              <Link href="/cluster-admin/heads" className="tracking-wide" style={{ color: palette.secondary }}>
                Heads
              </Link>
            </div>
          </div>

          {/* Clusters List */}
          <div>
            <h2 className="text-sm tracking-wide mb-6" style={{ color: palette.tertiary }}>
              Active Clusters
            </h2>
            
            {clusters && clusters.length > 0 ? (
              <div className="space-y-0">
                {clusters.map((cluster) => (
                  <Link
                    key={cluster._id}
                    href={`/cluster-admin/clusters?id=${cluster._id}`}
                    className="group flex items-center justify-between py-5 border-b transition-colors"
                    style={{ borderColor: palette.divider }}
                  >
                    <div>
                      <p className="text-base mb-1 group-hover:opacity-70 transition-opacity" style={{ color: palette.primary }}>
                        {cluster.name}
                      </p>
                      <p className="text-xs" style={{ color: palette.tertiary }}>
                        {cluster.memberCount} members
                        {cluster.leaderName && ` — ${cluster.leaderName}`}
                      </p>
                    </div>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      stroke={palette.tertiary}
                      strokeWidth="1.5"
                      className="group-hover:translate-x-1 transition-transform"
                    >
                      <path d="M6 12l4-4-4-4" />
                    </svg>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm py-8" style={{ color: palette.secondary }}>
                No active clusters
              </p>
            )}
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
