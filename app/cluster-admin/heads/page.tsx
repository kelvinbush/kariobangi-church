"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ChevronLeft,
  UserCog,
  Plus,
  X,
  RotateCcw,
  UserMinus,
  AlertCircle,
  Trash2,
  CheckCircle,
} from "lucide-react";

export default function ClusterHeadsManagement() {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const preselectedClusterId = searchParams.get("clusterId");

  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [clerkId, setClerkId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCluster, setSelectedCluster] = useState(preselectedClusterId || "");

  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const isAdmin = role === "admin";

  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const clusterHeads = useQuery(
    api.clusterHeads.list,
    isAuthenticated ? { activeOnly: activeTab === "active" } : "skip"
  );

  const addClusterHead = useMutation(api.clusterHeads.add);
  const archiveClusterHead = useMutation(api.clusterHeads.archive);
  const reactivateClusterHead = useMutation(api.clusterHeads.reactivate);
  const removeClusterHead = useMutation(api.clusterHeads.remove);

  const handleAdd = async () => {
    if (!clerkId.trim() || !displayName.trim()) {
      alert("Clerk ID and Display Name are required");
      return;
    }

    try {
      await addClusterHead({
        clerkId: clerkId.trim(),
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        clusterId: selectedCluster ? (selectedCluster as any) : undefined,
      });
      setShowAddModal(false);
      setClerkId("");
      setDisplayName("");
      setEmail("");
      setSelectedCluster("");
    } catch (e: any) {
      alert("Failed to add cluster head: " + e.message);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archive this cluster head? They will no longer be able to access the cluster head dashboard.")) return;
    try {
      await archiveClusterHead({ id: id as any });
    } catch (e: any) {
      alert("Failed to archive: " + e.message);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await reactivateClusterHead({ id: id as any });
    } catch (e: any) {
      alert("Failed to reactivate: " + e.message);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Permanently delete this cluster head? This cannot be undone.")) return;
    try {
      await removeClusterHead({ id: id as any });
    } catch (e: any) {
      alert("Failed to remove: " + e.message);
    }
  };

  const activeHeads = clusterHeads?.filter((h) => h.active) || [];
  const archivedHeads = clusterHeads?.filter((h) => !h.active) || [];

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
              <div className="text-zinc-900 font-medium tracking-tight text-lg flex items-center gap-2">
                <Link href="/cluster-admin" className="text-zinc-500 hover:text-zinc-700">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                Cluster Heads
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
        {navOpen && (
          <div className="md:hidden border-t border-zinc-200/80 bg-white px-4 py-3 flex flex-col gap-0.5">
            <Link href="/cluster-admin" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Dashboard
            </Link>
            <Link href="/cluster-admin/clusters" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Clusters
            </Link>
            <Link href="/cluster-admin/members" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Members
            </Link>
            <Link href="/cluster-admin/heads" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Heads
            </Link>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto text-center py-12">
            <p className="mb-4 text-zinc-700">Please sign in to access cluster head management.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-zinc-200">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "active"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Active ({activeHeads.length})
            </button>
            <button
              onClick={() => setActiveTab("archived")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "archived"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Archived ({archivedHeads.length})
            </button>
          </div>

          {/* Admin Only - Add Button */}
          {isAdmin && activeTab === "active" && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
              >
                <Plus className="w-4 h-4" />
                Add Cluster Head
              </button>
            </div>
          )}

          {/* Instructions for Admin */}
          {isAdmin && activeTab === "active" && (
            <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200">
              <h4 className="font-medium text-amber-900 mb-2">How to add a cluster head:</h4>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Create the user in Clerk Dashboard with email and password</li>
                <li>Set their role to &quot;cluster-head&quot; in the user&apos;s Public Metadata</li>
                <li>Copy their Clerk User ID (starts with &quot;user_&quot;)</li>
                <li>Paste the ID and name here, then click &quot;Add Cluster Head&quot;</li>
              </ol>
            </div>
          )}

          {/* Cluster Heads List */}
          {activeTab === "active" ? (
            <div className="space-y-4">
              {activeHeads.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeHeads.map((head) => (
                    <div
                      key={head._id}
                      className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-zinc-900">{head.displayName}</h4>
                          <p className="text-sm text-zinc-600 font-mono mt-1">{head.clerkId}</p>
                          {head.email && <p className="text-sm text-zinc-500">{head.email}</p>}
                          {head.clusterName ? (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                              {head.clusterName}
                            </span>
                          ) : (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              No cluster assigned
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleArchive(head._id)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                            title="Archive"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemove(head._id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <UserCog className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-600">No active cluster heads.</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-3 px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                    >
                      Add First Cluster Head
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Archived Tab */
            <div className="space-y-4">
              {archivedHeads.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedHeads.map((head) => (
                    <div
                      key={head._id}
                      className="p-4 rounded-xl bg-zinc-100 border border-zinc-200 opacity-60"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-zinc-900">{head.displayName}</h4>
                          <p className="text-sm text-zinc-600 font-mono mt-1">{head.clerkId}</p>
                          {head.email && <p className="text-sm text-zinc-500">{head.email}</p>}
                          <span className="inline-block mt-2 px-2 py-0.5 bg-zinc-200 text-zinc-600 text-xs rounded-full">
                            Archived
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReactivate(head._id)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="Reactivate"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleRemove(head._id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <p className="text-zinc-600">No archived cluster heads.</p>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Add Cluster Head Modal - Admin Only */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">Add Cluster Head</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Clerk User ID *</label>
                <input
                  type="text"
                  placeholder="user_xxxxx..."
                  value={clerkId}
                  onChange={(e) => setClerkId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-zinc-900"
                  autoFocus
                />
                <p className="text-xs text-zinc-500 mt-1">Find this in Clerk Dashboard → Users</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-600 mb-1">Display Name *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-600 mb-1">Email (optional)</label>
                <input
                  type="email"
                  placeholder="e.g., john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-600 mb-1">Assign to Cluster (optional)</label>
                <select
                  value={selectedCluster}
                  onChange={(e) => setSelectedCluster(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-zinc-900"
                >
                  <option value="">Select cluster...</option>
                  {clusters?.map((cluster) => (
                    <option key={cluster._id} value={cluster._id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-zinc-100 mt-4">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setClerkId("");
                  setDisplayName("");
                  setEmail("");
                  setSelectedCluster("");
                }}
                className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!clerkId.trim() || !displayName.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Cluster Head
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
