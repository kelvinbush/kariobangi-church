"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

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
    blue: '#8fa8c4',
    blueLight: '#d4e0ec',
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

export default function FellowshipPastorDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const clusterStats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");

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
            Fellowship Pastor
          </span>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Greeting */}
          <div className="mb-10">
            <p className="text-sm mb-1" style={{ color: colors.text.muted }}>
              Welcome
            </p>
            <h1 className="text-2xl font-light tracking-tight">
              Pastor
            </h1>
          </div>

          {/* Stats Overview - Single Card */}
          {clusterStats && (
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
                    {clusterStats.totalClusters}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    Active Clusters
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
                    {clusterStats.totalMembersInClusters}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    Members Assigned
                  </div>
                </div>

                {clusterStats.unassignedMembers > 0 && (
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
                        {clusterStats.unassignedMembers}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        Unassigned
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Demographics */}
          <div className="mb-8">
            <span className="text-sm block mb-4" style={{ color: colors.text.secondary }}>
              Demographics
            </span>
            
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/youth/men"
                className="p-4 rounded-xl transition-colors"
                style={{ backgroundColor: colors.accent.blueLight }}
              >
                <span className="text-sm" style={{ color: colors.text.primary }}>
                  Youth Men
                </span>
              </Link>
              <Link
                href="/youth/ladies"
                className="p-4 rounded-xl transition-colors"
                style={{ backgroundColor: colors.accent.terracottaLight }}
              >
                <span className="text-sm" style={{ color: colors.text.primary }}>
                  Youth Ladies
                </span>
              </Link>
              <Link
                href="/married/men"
                className="p-4 rounded-xl transition-colors"
                style={{ backgroundColor: colors.accent.sageLight }}
              >
                <span className="text-sm" style={{ color: colors.text.primary }}>
                  Married Men
                </span>
              </Link>
              <Link
                href="/married/women"
                className="p-4 rounded-xl transition-colors"
                style={{ backgroundColor: colors.accent.amberLight }}
              >
                <span className="text-sm" style={{ color: colors.text.primary }}>
                  Married Women
                </span>
              </Link>
            </div>
          </div>

          {/* Clusters */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                Clusters
              </span>
              <Link 
                href="/cluster-admin" 
                className="text-xs flex items-center gap-1"
                style={{ color: colors.text.muted }}
              >
                View all <ArrowRight />
              </Link>
            </div>
            
            <div className="space-y-2">
              {clusters?.map((cluster: any) => (
                <Link
                  key={cluster._id}
                  href={`/cluster-admin/detail/${cluster._id}`}
                  className="flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div>
                    <span 
                      className="text-sm block"
                      style={{ color: colors.text.primary }}
                    >
                      {cluster.name}
                    </span>
                    <span 
                      className="text-xs mt-0.5 block"
                      style={{ color: colors.text.muted }}
                    >
                      {cluster.leaderName || 'No leader'} • {cluster.memberCount} members
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
              ))}
              
              {(!clusters || clusters.length === 0) && (
                <div 
                  className="p-4 rounded-xl text-center text-sm"
                  style={{ color: colors.text.muted }}
                >
                  No active clusters
                </div>
              )}
            </div>
          </div>

          {/* Leadership */}
          <div>
            <span className="text-sm block mb-4" style={{ color: colors.text.secondary }}>
              Leadership
            </span>
            
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
                  View and manage cluster leaders
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
    </AuthenticatedLayout>
  );
}
