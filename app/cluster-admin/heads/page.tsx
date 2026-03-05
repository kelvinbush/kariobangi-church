"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  success: '#5a7a5a',
  danger: '#a06060',
};

interface ClusterHead {
  _id: Id<"clusterHeads">;
  clerkId: string;
  displayName: string;
  email: string | null;
  clusterId: Id<"clusters"> | null;
  clusterName?: string | null;
  active: boolean;
}

export default function ClusterHeadsPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const isAdmin = role === "admin";
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState<ClusterHead | null>(null);
  const [clerkId, setClerkId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const heads = useQuery(api.clusterHeads.list, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  
  const addHead = useMutation(api.clusterHeads.add);
  const archiveHead = useMutation(api.clusterHeads.archive);
  const reactivateHead = useMutation(api.clusterHeads.reactivate);

  // Map cluster names to heads
  const headsWithClusters = heads?.map((head: ClusterHead) => {
    const cluster = clusters?.find((c: { _id: Id<"clusters"> }) => c._id === head.clusterId);
    return { ...head, clusterName: cluster?.name };
  });

  const activeHeads = headsWithClusters?.filter((h: ClusterHead) => h.active) || [];
  const archivedHeads = headsWithClusters?.filter((h: ClusterHead) => !h.active) || [];
  const assignedHeads = activeHeads.filter((h: ClusterHead) => h.clusterId);
  const unassignedHeads = activeHeads.filter((h: ClusterHead) => !h.clusterId);

  const handleAdd = async () => {
    if (!clerkId.trim() || !displayName.trim()) return;
    
    setIsAdding(true);
    try {
      await addHead({
        clerkId: clerkId.trim(),
        displayName: displayName.trim(),
        email: email.trim() || undefined,
      });
      setClerkId("");
      setDisplayName("");
      setEmail("");
      setShowAddModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add cluster head");
    } finally {
      setIsAdding(false);
    }
  };

  const handleArchive = async () => {
    if (!showArchiveModal) return;
    try {
      await archiveHead({ id: showArchiveModal._id });
      setShowArchiveModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  const handleReactivate = async (id: Id<"clusterHeads">) => {
    try {
      await reactivateHead({ id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cluster-admin" 
              className="p-2 -ml-2"
              style={{ color: theme.text.secondary }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-base" style={{ color: theme.text.primary }}>
              Cluster Heads
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to view cluster heads
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm rounded-xl border"
                style={{ borderColor: theme.text.primary, color: theme.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Admin-only Add Button */}
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full mb-6 py-3 rounded-xl text-sm"
              style={{ backgroundColor: theme.accent, color: '#fff' }}
            >
              + Add Cluster Head (Manual)
            </button>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div 
              className="p-4 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <p className="text-xl" style={{ color: theme.text.primary }}>
                {activeHeads.length}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                Active
              </p>
            </div>
            <div 
              className="p-4 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <p className="text-xl" style={{ color: theme.success }}>
                {assignedHeads.length}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                Assigned
              </p>
            </div>
            <div 
              className="p-4 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <p className="text-xl" style={{ color: theme.text.muted }}>
                {unassignedHeads.length}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                Unassigned
              </p>
            </div>
          </div>

          {/* Assigned Heads */}
          <div className="mb-6">
            <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
              Assigned ({assignedHeads.length})
            </span>
            {assignedHeads.length > 0 ? (
              <div className="space-y-2">
                {assignedHeads.map((head: ClusterHead) => (
                  <div 
                    key={head._id}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: theme.bg }}
                        >
                          <span className="text-sm" style={{ color: theme.text.secondary }}>
                            {head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: theme.text.primary }}>
                            {head.displayName}
                          </span>
                          <span className="text-xs block font-mono" style={{ color: theme.text.muted }}>
                            {head.clerkId.slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span 
                          className="px-2 py-1 rounded-lg text-xs"
                          style={{ backgroundColor: `${theme.success}15`, color: theme.success }}
                        >
                          {head.clusterName}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-sm" style={{ color: theme.text.secondary }}>No assigned heads</p>
              </div>
            )}
          </div>

          {/* Unassigned Heads */}
          <div className="mb-6">
            <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
              Unassigned ({unassignedHeads.length})
            </span>
            {unassignedHeads.length > 0 ? (
              <div className="space-y-2">
                {unassignedHeads.map((head: ClusterHead) => (
                  <div 
                    key={head._id}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: theme.bg }}
                        >
                          <span className="text-sm" style={{ color: theme.text.secondary }}>
                            {head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: theme.text.primary }}>
                            {head.displayName}
                          </span>
                          <span className="text-xs block font-mono" style={{ color: theme.text.muted }}>
                            {head.clerkId.slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setShowArchiveModal(head)}
                          className="px-3 py-1.5 rounded-lg text-xs border"
                          style={{ borderColor: theme.border, color: theme.text.secondary }}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <p className="text-sm" style={{ color: theme.text.secondary }}>No unassigned heads</p>
              </div>
            )}
          </div>

          {/* Archived Heads - Admin only */}
          {isAdmin && archivedHeads.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
                Archived ({archivedHeads.length})
              </span>
              <div className="space-y-2">
                {archivedHeads.map((head: ClusterHead) => (
                  <div 
                    key={head._id}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: theme.bg, borderColor: theme.border, opacity: 0.7 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: theme.surface }}
                        >
                          <span className="text-sm" style={{ color: theme.text.muted }}>
                            {head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: theme.text.secondary }}>
                            {head.displayName}
                          </span>
                          <span className="text-xs block font-mono" style={{ color: theme.text.muted }}>
                            {head.clerkId.slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivate(head._id)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: theme.accent, color: '#fff' }}
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SignedIn>
      </main>

      {/* Add Head Modal - Admin only */}
      {showAddModal && isAdmin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Add Cluster Head</h3>
              <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                Paste the Clerk ID from Clerk Dashboard
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Clerk ID *
                </label>
                <input
                  type="text"
                  value={clerkId}
                  onChange={(e) => setClerkId(e.target.value)}
                  placeholder="user_xxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border font-mono"
                  style={{ borderColor: theme.border, color: theme.text.primary }}
                />
              </div>
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter full name..."
                  className="w-full px-3 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.primary }}
                />
              </div>
              <div>
                <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.primary }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!clerkId.trim() || !displayName.trim() || isAdding}
                  className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                >
                  {isAdding ? 'Adding...' : 'Add Head'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal - Admin only */}
      {showArchiveModal && isAdmin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowArchiveModal(null)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Archive Cluster Head</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                Are you sure you want to archive <strong>{showArchiveModal.displayName}</strong>? They will no longer be able to access the cluster head features.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveModal(null)}
                  className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="flex-1 py-2.5 text-sm rounded-xl"
                  style={{ backgroundColor: theme.danger, color: '#fff' }}
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
