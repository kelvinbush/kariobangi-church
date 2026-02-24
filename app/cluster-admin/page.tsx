"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import {
  Users,
  UserCog,
  UserPlus,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  LogOut,
  BarChart3,
  Search,
  X,
} from "lucide-react";

export default function ClusterAdminDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const [navOpen, setNavOpen] = useState(false);

  const stats = useQuery(api.clusters.stats, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const pendingRequests = useQuery(
    api.clusterFollowUps.getBishopAttentionRequests,
    isAuthenticated ? { resolved: false } : "skip"
  );

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/90 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="text-zinc-900 font-medium tracking-tight text-lg">Cluster Admin</div>
              <div className="text-xs text-zinc-500 hidden sm:block">Manage clusters and cluster heads</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-0.5">
              <Link href="/cluster-admin" className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200">
                Dashboard
              </Link>
              <Link href="/cluster-admin/clusters" className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Clusters
              </Link>
              <Link href="/cluster-admin/members" className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Members
              </Link>
              <Link href="/cluster-admin/heads" className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Heads
              </Link>
              {role === "admin" && (
                <Link href="/" className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                  Main Dashboard
                </Link>
              )}
            </nav>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-zinc-200/80 bg-white px-4 py-3 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
            <Link href="/cluster-admin" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Dashboard
            </Link>
            <Link href="/cluster-admin/clusters" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Clusters
            </Link>
            <Link href="/cluster-admin/members" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Members
            </Link>
            <Link href="/cluster-admin/heads" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Heads
            </Link>
            {role === "admin" && (
              <Link href="/" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
                Main Dashboard
              </Link>
            )}
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700">Please sign in to access the cluster admin dashboard.</p>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<Users className="w-5 h-5 text-amber-600" />}
                label="Active Clusters"
                value={stats.totalClusters}
              />
              <StatCard
                icon={<UserCog className="w-5 h-5 text-emerald-600" />}
                label="Members in Clusters"
                value={stats.totalMembersInClusters}
              />
              <StatCard
                icon={<UserPlus className="w-5 h-5 text-blue-600" />}
                label="Unassigned Members"
                value={stats.unassignedMembers}
              />
              <StatCard
                icon={<AlertCircle className="w-5 h-5 text-rose-600" />}
                label="Needs Attention"
                value={stats.clustersNeedingAttention}
              />
            </div>
          )}

          {/* Bishop Attention Requests */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-medium text-rose-900">
                  Bishop Attention Requests ({pendingRequests.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingRequests.slice(0, 5).map((req) => (
                  <div key={req._id} className="flex items-center justify-between p-3 bg-white rounded-xl">
                    <div>
                      <div className="font-medium text-zinc-900">{req.memberName}</div>
                      <div className="text-sm text-zinc-600">
                        {req.clusterName} • {formatIsoDate(req.date)}
                      </div>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${req.clusterId}`}
                      className="px-3 py-1.5 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
            <h3 className="font-medium mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <ActionCard
                icon={<BarChart3 className="w-5 h-5" />}
                title="Manage Clusters"
                description="Create, edit, or archive clusters"
                href="/cluster-admin/clusters"
              />
              <ActionCard
                icon={<Users className="w-5 h-5" />}
                title="Assign Members"
                description="Add members to clusters"
                href="/cluster-admin/members"
              />
              <ActionCard
                icon={<UserCog className="w-5 h-5" />}
                title="Manage Heads"
                description="Invite or remove cluster heads"
                href="/cluster-admin/heads"
              />
              <ActionCard
                icon={<TrendingUp className="w-5 h-5" />}
                title="View Reports"
                description="See cluster follow-up reports"
                href="/cluster-admin/clusters"
              />
            </div>
          </div>

          {/* Clusters Overview */}
          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900">Active Clusters</h3>
              <Link
                href="/cluster-admin/clusters"
                className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {clusters && clusters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clusters.slice(0, 6).map((cluster) => (
                  <div
                    key={cluster._id}
                    className="p-4 rounded-xl bg-white border border-zinc-100 hover:border-amber-200 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-zinc-900">{cluster.name}</h4>
                        <p className="text-sm text-zinc-600 mt-1">
                          {cluster.memberCount} members
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${cluster.leaderName ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-100">
                      <p className="text-sm text-zinc-600">
                        Leader: {cluster.leaderName ?? "Not assigned"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600">
                <p>No active clusters yet.</p>
                <Link
                  href="/cluster-admin/clusters"
                  className="inline-block mt-2 px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                >
                  Create First Cluster
                </Link>
              </div>
            )}
          </div>
        </SignedIn>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl min-h-[80px] flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-600">{label}</span>
      </div>
      <div className="text-2xl font-medium text-zinc-900">{value}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
    >
      <div className="p-2 rounded-lg bg-white/10">{icon}</div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-white/70">{description}</div>
      </div>
    </Link>
  );
}
