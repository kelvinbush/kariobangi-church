"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import { Menu, X, ChevronRight, Users, LayoutGrid, ArrowUpRight, AlertCircle } from "lucide-react";

// Color Palette
const colors = {
  // Primary - Deep Indigo
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  // Accent - Warm Coral
  accent: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
  },
  // Success - Soft Teal
  success: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    500: '#14b8a6',
    600: '#0d9488',
  },
  // Warning - Amber
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },
  // Background - Warm Slate
  bg: {
    main: '#fafaf9', // stone-50
    card: '#ffffff',
    subtle: '#f5f5f4', // stone-100
    hover: '#e7e5e4', // stone-200
  },
  // Text
  text: {
    primary: '#1c1917', // stone-900
    secondary: '#57534e', // stone-600
    muted: '#78716c', // stone-500
    inverse: '#fafaf9', // stone-50
  },
  // Border
  border: {
    light: '#e7e5e4',
    medium: '#d6d3d1',
  },
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
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.bg.card, borderBottom: `1px solid ${colors.border.light}` }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg transition-colors"
              style={{ backgroundColor: mobileMenuOpen ? colors.bg.subtle : 'transparent' }}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: colors.primary[100] }}
              >
                <LayoutGrid className="w-4 h-4" style={{ color: colors.primary[600] }} />
              </div>
              <span className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                Cluster Overview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="hidden sm:flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: colors.text.muted }}
            >
              Main Dashboard
              <ChevronRight className="w-4 h-4" />
            </Link>
            <SignedIn><div style={{ color: colors.text.muted }}><span className="text-sm">Admin</span></div></SignedIn>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: colors.border.light, backgroundColor: colors.bg.card }}>
            <Link href="/cluster-admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: colors.bg.subtle }}>
              <LayoutGrid className="w-4 h-4" style={{ color: colors.primary[600] }} /> 
              <span style={{ color: colors.text.primary }}>Overview</span>
            </Link>
            <Link href="/cluster-admin/clusters" className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ color: colors.text.secondary }}>
              <Users className="w-4 h-4" /> Clusters
            </Link>
            <Link href="/cluster-admin/members" className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ color: colors.text.secondary }}>
              <Users className="w-4 h-4" /> Members
            </Link>
            <Link href="/cluster-admin/heads" className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ color: colors.text.secondary }}>
              <Users className="w-4 h-4" /> Heads
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-16 text-center">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: colors.primary[100] }}
            >
              <LayoutGrid className="w-8 h-8" style={{ color: colors.primary[600] }} />
            </div>
            <h1 className="text-2xl tracking-tight mb-2" style={{ color: colors.text.primary }}>
              Cluster Overview
            </h1>
            <p className="text-base mb-8" style={{ color: colors.text.secondary }}>
              Sign in to view cluster statistics and reports
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-8 py-3 text-base rounded-xl transition-colors"
                style={{ backgroundColor: colors.primary[600], color: colors.text.inverse }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-3xl tracking-tight mb-2" style={{ color: colors.text.primary }}>
              Dashboard
            </h1>
            <p className="text-base" style={{ color: colors.text.secondary }}>
              Monitor cluster health and attendance
            </p>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard 
                label="Active Clusters" 
                value={stats.totalClusters}
                icon={<LayoutGrid className="w-5 h-5" />}
                color={colors.primary}
              />
              <StatCard 
                label="Members Assigned" 
                value={stats.totalMembersInClusters}
                icon={<Users className="w-5 h-5" />}
                color={colors.success}
              />
              <StatCard 
                label="Unassigned" 
                value={stats.unassignedMembers}
                icon={<Users className="w-5 h-5" />}
                color={colors.warning}
              />
              <StatCard 
                label="Need Attention" 
                value={stats.clustersNeedingAttention}
                icon={<AlertCircle className="w-5 h-5" />}
                color={stats.clustersNeedingAttention > 0 ? colors.accent : colors.primary}
                highlight={stats.clustersNeedingAttention > 0}
              />
            </div>
          )}

          {/* Bishop Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colors.accent[500] }}
                />
                <h2 className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                  Attention Requests
                </h2>
                <span 
                  className="px-2.5 py-0.5 text-sm rounded-full"
                  style={{ backgroundColor: colors.accent[100], color: colors.accent[600] }}
                >
                  {pendingRequests.length}
                </span>
              </div>
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
              >
                {pendingRequests.slice(0, 5).map((req) => (
                  <div 
                    key={req._id} 
                    className="px-5 py-4 border-b last:border-0 flex items-center justify-between"
                    style={{ borderColor: colors.border.light }}
                  >
                    <div>
                      <p className="text-base mb-1" style={{ color: colors.text.primary }}>{req.memberName}</p>
                      <p className="text-sm" style={{ color: colors.text.muted }}>
                        {req.clusterName} • {formatIsoDate(req.date)}
                      </p>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${req.clusterId}`}
                      className="px-4 py-2 text-sm rounded-lg transition-colors"
                      style={{ backgroundColor: colors.bg.subtle, color: colors.text.secondary }}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="mb-8">
            <h2 className="text-lg tracking-tight mb-4" style={{ color: colors.text.primary }}>
              Quick Access
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickLinkCard
                href="/cluster-admin/clusters"
                title="Clusters"
                subtitle="View all clusters"
                color={colors.primary}
              />
              <QuickLinkCard
                href="/cluster-admin/members"
                title="Members"
                subtitle="Manage assignments"
                color={colors.success}
              />
              <QuickLinkCard
                href="/cluster-admin/heads"
                title="Heads"
                subtitle="Cluster leaders"
                color={colors.warning}
              />
            </div>
          </div>

          {/* Clusters List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg tracking-tight" style={{ color: colors.text.primary }}>
                Active Clusters
              </h2>
              <Link 
                href="/cluster-admin/clusters"
                className="flex items-center gap-1 text-sm"
                style={{ color: colors.primary[600] }}
              >
                View all
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            
            {clusters && clusters.length > 0 ? (
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
              >
                {clusters.slice(0, 6).map((cluster, index) => (
                  <Link
                    key={cluster._id}
                    href={`/cluster-admin/clusters?id=${cluster._id}`}
                    className="flex items-center justify-between px-5 py-5 border-b last:border-0 transition-colors"
                    style={{ 
                      borderColor: colors.border.light,
                      backgroundColor: index % 2 === 0 ? colors.bg.card : colors.bg.subtle,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-base"
                        style={{ 
                          backgroundColor: colors.primary[100],
                          color: colors.primary[700],
                        }}
                      >
                        {cluster.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-base mb-0.5" style={{ color: colors.text.primary }}>{cluster.name}</p>
                        <p className="text-sm" style={{ color: colors.text.muted }}>
                          {cluster.memberCount} members
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm" style={{ color: cluster.leaderName ? colors.success[600] : colors.accent[500] }}>
                        {cluster.leaderName || "No leader"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div 
                className="rounded-2xl p-12 text-center"
                style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
              >
                <p style={{ color: colors.text.secondary }}>No active clusters found.</p>
              </div>
            )}
          </div>
        </SignedIn>
      </main>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon,
  color,
  highlight = false,
}: { 
  label: string; 
  value: number;
  icon: React.ReactNode;
  color: any;
  highlight?: boolean;
}) {
  return (
    <div 
      className="rounded-2xl p-5 transition-all"
      style={{ 
        backgroundColor: colors.bg.card,
        border: `1px solid ${highlight ? color[200] : colors.border.light}`,
      }}
    >
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: color[100], color: color[600] }}
      >
        {icon}
      </div>
      <p className="text-3xl tracking-tight mb-1" style={{ color: colors.text.primary }}>
        {value}
      </p>
      <p className="text-sm" style={{ color: colors.text.muted }}>{label}</p>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  subtitle,
  color,
}: {
  href: string;
  title: string;
  subtitle: string;
  color: any;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-5 rounded-2xl transition-colors group"
      style={{ backgroundColor: colors.bg.card, border: `1px solid ${colors.border.light}` }}
    >
      <div>
        <p className="text-lg mb-1" style={{ color: colors.text.primary }}>{title}</p>
        <p className="text-sm" style={{ color: colors.text.muted }}>{subtitle}</p>
      </div>
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        style={{ backgroundColor: color[50], color: color[600] }}
      >
        <ChevronRight className="w-5 h-5" />
      </div>
    </Link>
  );
}


