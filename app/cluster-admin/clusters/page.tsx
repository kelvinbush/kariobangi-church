"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Plus,
  Search,
  Users,
  UserCog,
  Archive,
  RotateCcw,
  Trash2,
  X,
  ChevronLeft,
  Edit3,
} from "lucide-react";

export default function ClustersManagement() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const clusters = useQuery(
    api.clusters.list,
    isAuthenticated ? { includeInactive: showInactive } : "skip"
  );
  const createCluster = useMutation(api.clusters.create);
  const updateCluster = useMutation(api.clusters.update);
  const archiveCluster = useMutation(api.clusters.archive);
  const reactivateCluster = useMutation(api.clusters.reactivate);
  const deleteCluster = useMutation(api.clusters.remove);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCluster, setEditingCluster] = useState<any>(null);
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterDesc, setNewClusterDesc] = useState("");
  


  const filteredClusters = clusters?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.leaderName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const handleCreate = async () => {
    if (!newClusterName.trim()) return;
    try {
      await createCluster({
        name: newClusterName.trim(),
        description: newClusterDesc.trim() || undefined,
      });
      setNewClusterName("");
      setNewClusterDesc("");
      setShowCreateModal(false);
    } catch (e) {
      alert("Failed to create cluster: " + e);
    }
  };

  const handleUpdate = async () => {
    if (!editingCluster || !newClusterName.trim()) return;
    try {
      await updateCluster({
        id: editingCluster._id,
        name: newClusterName.trim(),
        description: newClusterDesc.trim() || undefined,
      });
      setEditingCluster(null);
      setNewClusterName("");
      setNewClusterDesc("");
      setShowEditModal(false);
    } catch (e) {
      alert("Failed to update cluster: " + e);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this cluster?")) return;
    try {
      await archiveCluster({ id: id as any });
    } catch (e) {
      alert("Failed to archive cluster: " + e);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await reactivateCluster({ id: id as any });
    } catch (e) {
      alert("Failed to reactivate cluster: " + e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("WARNING: This will permanently delete the cluster and all its data. Continue?")) return;
    try {
      await deleteCluster({ id: id as any });
    } catch (e) {
      alert("Failed to delete cluster: " + e);
    }
  };

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
                Clusters
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
            <Link href="/cluster-admin/clusters" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Clusters
            </Link>
            <Link href="/cluster-admin/members" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Members
            </Link>
            <Link href="/cluster-admin/heads" className="px-3 py-3 rounded-lg text-zinc-700 hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
              Heads
            </Link>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto text-center py-12">
            <p className="mb-4 text-zinc-700">Please sign in to access cluster management.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search clusters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-zinc-200 bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Show archived
              </label>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
              >
                <Plus className="w-4 h-4" />
                Create Cluster
              </button>
            </div>
          </div>

          {/* Clusters Grid */}
          {filteredClusters && filteredClusters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClusters.map((cluster) => (
                <div
                  key={cluster._id}
                  className={`rounded-2xl p-4 bg-white/60 backdrop-blur-xl border ${
                    cluster.active ? "border-zinc-100" : "border-zinc-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-zinc-900">{cluster.name}</h3>
                      {cluster.description && (
                        <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{cluster.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1.5 text-zinc-600">
                      <Users className="w-4 h-4" />
                      <span>{cluster.memberCount} members</span>
                    </div>
                  </div>

                  {/* Inline Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100">
                    {cluster.active ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingCluster(cluster);
                            setNewClusterName(cluster.name);
                            setNewClusterDesc(cluster.description || "");
                            setShowEditModal(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <Link
                          href={`/cluster-admin/members?clusterId=${cluster._id}`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5" /> Members
                        </Link>
                        <Link
                          href={`/cluster-admin/heads?clusterId=${cluster._id}`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center gap-1.5"
                        >
                          <UserCog className="w-3.5 h-3.5" /> Leader
                        </Link>
                        <button
                          onClick={() => handleArchive(cluster._id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1.5"
                        >
                          <Archive className="w-3.5 h-3.5" /> Archive
                        </button>
                        {role === "admin" && (
                          <button
                            onClick={() => handleDelete(cluster._id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleReactivate(cluster._id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                        </button>
                        {role === "admin" && (
                          <button
                            onClick={() => handleDelete(cluster._id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm text-zinc-600">
                        {cluster.leaderName ? (
                          <span className="text-emerald-700">{cluster.leaderName}</span>
                        ) : (
                          <span className="text-amber-600">No leader assigned</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {!cluster.active && (
                    <div className="mt-3 px-2 py-1 bg-zinc-100 rounded text-xs text-zinc-500 text-center">
                      Archived
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
              <p className="text-zinc-600 mb-4">
                {searchTerm ? "No clusters match your search." : "No clusters yet."}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                >
                  Create First Cluster
                </button>
              )}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">Create New Cluster</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Cluster Name *</label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="e.g., Youth Fellowship"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Description</label>
                <textarea
                  value={newClusterDesc}
                  onChange={(e) => setNewClusterDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newClusterName.trim()}
                  className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCluster && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">Edit Cluster</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Cluster Name *</label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Description</label>
                <textarea
                  value={newClusterDesc}
                  onChange={(e) => setNewClusterDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!newClusterName.trim()}
                  className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
