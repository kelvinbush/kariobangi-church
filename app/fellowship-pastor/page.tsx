"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
const colors = {
  cream: '#faf8f5',
  warmWhite: '#ffffff',
  amber: '#d4a574',
  amberLight: '#e8d5c4',
  sage: '#7c9a6d',
  sageLight: '#c5d4be',
  terracotta: '#c17a5c',
  terracottaLight: '#e8d0c4',
  charcoal: '#2d2a26',
  charcoalLight: '#5c5854',
  charcoalMuted: '#8a8682',
};

// Custom SVG Pattern
const CrossPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="crossPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M20 8v24M8 20h24" stroke="currentColor" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#crossPattern)"/>
  </svg>
);

export default function FellowshipPastorDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");

  return (
    <AuthenticatedLayout>
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.cream }}>
        <CrossPattern />
      </div>

      <div className="relative">
        {/* Simple Header */}
        <header className="sticky top-0 z-30 border-b backdrop-blur-md bg-white/80 px-4 h-14 flex items-center justify-between">
          <h1 className="text-base font-medium" style={{ color: colors.charcoal }}>Fellowship Pastor</h1>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {/* Welcome */}
          <div className="text-center py-4 mb-6">
            <h2 className="text-2xl font-light mb-2" style={{ color: colors.charcoal }}>
              Welcome, <span className="font-medium">Pastor</span>
            </h2>
            <p className="text-sm" style={{ color: colors.charcoalMuted }}>
              Oversee clusters, view demographics, and manage church groups
            </p>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="rounded-2xl p-4 border text-center"
                style={{ backgroundColor: colors.warmWhite, borderColor: colors.amberLight }}>
                <div className="text-2xl font-semibold" style={{ color: colors.charcoal }}>
                  {stats.totalClusters}
                </div>
                <div className="text-xs" style={{ color: colors.charcoalMuted }}>Clusters</div>
              </div>
              <div className="rounded-2xl p-4 border text-center"
                style={{ backgroundColor: colors.warmWhite, borderColor: colors.sageLight }}>
                <div className="text-2xl font-semibold" style={{ color: colors.charcoal }}>
                  {stats.totalMembersInClusters}
                </div>
                <div className="text-xs" style={{ color: colors.charcoalMuted }}>In Clusters</div>
              </div>
              <div className="rounded-2xl p-4 border text-center"
                style={{ backgroundColor: colors.warmWhite, borderColor: colors.terracottaLight }}>
                <div className="text-2xl font-semibold" style={{ color: colors.charcoal }}>
                  {stats.unassignedMembers}
                </div>
                <div className="text-xs" style={{ color: colors.charcoalMuted }}>Unassigned</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-8">
            <h3 className="text-sm font-medium mb-3 px-1" style={{ color: colors.charcoalLight }}>
              Quick Access
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActionCard 
                href="/cluster-admin" 
                icon="🏛️" 
                title="All Clusters"
                subtitle="View & monitor"
                color={colors.amber}
                bgColor={colors.amberLight}
              />
              <ActionCard 
                href="/cluster-admin/heads" 
                icon="👑" 
                title="Cluster Heads"
                subtitle="Manage leaders"
                color={colors.terracotta}
                bgColor={colors.terracottaLight}
              />
              <ActionCard 
                href="/cluster-head" 
                icon="✓" 
                title="My Cluster"
                subtitle="Submit reports"
                color={colors.sage}
                bgColor={colors.sageLight}
              />
              <ActionCard 
                href="/master-list" 
                icon="👥" 
                title="All Members"
                subtitle="Full directory"
                color={colors.charcoalLight}
                bgColor={colors.amberLight}
              />
            </div>
          </div>

          {/* Demographics Section */}
          <div className="mb-8">
            <h3 className="text-sm font-medium mb-3 px-1" style={{ color: colors.charcoalLight }}>
              Demographics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DemographicCard 
                href="/youth/men" 
                title="Youth Men" 
                icon="👨"
                gradient="from-blue-500/10 to-blue-600/10"
                borderColor="#dbeafe"
              />
              <DemographicCard 
                href="/youth/ladies" 
                title="Youth Ladies" 
                icon="👩"
                gradient="from-rose-500/10 to-rose-600/10"
                borderColor="#fce7f3"
              />
              <DemographicCard 
                href="/married/men" 
                title="Married Men" 
                icon="💍"
                gradient="from-emerald-500/10 to-emerald-600/10"
                borderColor="#d1fae5"
              />
              <DemographicCard 
                href="/married/women" 
                title="Married Women" 
                icon="💍"
                gradient="from-purple-500/10 to-purple-600/10"
                borderColor="#f3e8ff"
              />
            </div>
          </div>

          {/* Active Clusters List */}
          <div>
            <h3 className="text-sm font-medium mb-3 px-1" style={{ color: colors.charcoalLight }}>
              Active Clusters ({clusters?.length || 0})
            </h3>
            <div className="space-y-2">
              {clusters?.map((cluster: any) => (
                <Link
                  key={cluster._id}
                  href={`/cluster-admin/detail/${cluster._id}`}
                  className="flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md"
                  style={{ backgroundColor: colors.warmWhite, borderColor: colors.amberLight }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: colors.amberLight }}
                    >
                      ⛪
                    </div>
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: colors.charcoal }}>
                        {cluster.name}
                      </h4>
                      <p className="text-xs" style={{ color: colors.charcoalMuted }}>
                        {cluster.leaderName || 'No leader assigned'} • {cluster.memberCount} members
                      </p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.charcoalMuted} strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
              {(!clusters || clusters.length === 0) && (
                <div className="text-center py-8 rounded-xl border" 
                  style={{ backgroundColor: colors.warmWhite, borderColor: colors.amberLight }}>
                  <p className="text-sm" style={{ color: colors.charcoalMuted }}>No active clusters</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

// Component: Action Card
function ActionCard({ href, icon, title, subtitle, color, bgColor }: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
}) {
  return (
    <Link
      href={href}
      className="group block p-4 rounded-2xl border transition-all hover:shadow-md"
      style={{ backgroundColor: colors.warmWhite, borderColor: bgColor }}
    >
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 transition-transform group-hover:scale-110"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>
      <h4 className="text-sm font-medium" style={{ color: colors.charcoal }}>{title}</h4>
      <p className="text-xs mt-0.5" style={{ color: colors.charcoalMuted }}>{subtitle}</p>
    </Link>
  );
}

// Component: Demographic Card
function DemographicCard({ href, title, icon, gradient, borderColor }: {
  href: string;
  title: string;
  icon: string;
  gradient: string;
  borderColor: string;
}) {
  return (
    <Link
      href={href}
      className={`group block p-4 rounded-2xl border bg-gradient-to-br ${gradient} hover:shadow-md transition-all`}
      style={{ borderColor }}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="text-sm font-medium" style={{ color: colors.charcoal }}>{title}</h4>
      <p className="text-xs mt-1" style={{ color: colors.charcoalMuted }}>View members</p>
    </Link>
  );
}
