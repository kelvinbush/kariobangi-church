"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import { Menu, X, ChevronRight, Users, LayoutGrid, ArrowUpRight } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-semibold text-slate-900">Cluster Overview</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              Main Dashboard
              <ChevronRight className="w-4 h-4" />
            </Link>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            <Link href="/cluster-admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-100 font-medium">
              <LayoutGrid className="w-4 h-4" /> Overview
            </Link>
            <Link href="/cluster-admin/clusters" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700">
              <Users className="w-4 h-4" /> Clusters
            </Link>
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700">
              <ArrowUpRight className="w-4 h-4" /> Main Dashboard
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <h1 className="text-lg font-semibold text-slate-900">Cluster Overview</h1>
            <p className="text-sm text-slate-600 mt-2">Sign in to view cluster statistics</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard label="Active Clusters" value={stats.totalClusters} />
              <StatCard label="Members Assigned" value={stats.totalMembersInClusters} />
              <StatCard label="Unassigned" value={stats.unassignedMembers} />
              <StatCard 
                label="Need Attention" 
                value={stats.clustersNeedingAttention} 
                highlight={stats.clustersNeedingAttention > 0}
              />
            </div>
          )}

          {/* Bishop Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Attention Requests
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full">
                  {pendingRequests.length}
                </span>
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div 
                    key={req._id} 
                    className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{req.memberName}</p>
                      <p className="text-xs text-slate-500">{req.clusterName} • {formatIsoDate(req.date)}</p>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${req.clusterId}`}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clusters List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Active Clusters</h2>
              <Link 
                href="/cluster-admin/clusters"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                View all
              </Link>
            </div>
            
            {clusters && clusters.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {clusters.map((cluster) => (
                  <Link
                    key={cluster._id}
                    href={`/cluster-admin/clusters?id=${cluster._id}`}
                    className="flex items-center justify-between px-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{cluster.name}</p>
                      <p className="text-xs text-slate-500">
                        {cluster.memberCount} members • {cluster.leaderName || "No leader"}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-600">No active clusters</p>
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
  highlight = false 
}: { 
  label: string; 
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 border ${highlight ? 'border-rose-200' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
