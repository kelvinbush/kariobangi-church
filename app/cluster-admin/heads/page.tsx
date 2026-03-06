"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { amber: '#c9a87c', amberLight: '#e8dcc8', sage: '#9db88c', sageLight: '#c5d4be', terracotta: '#c49a84', terracottaLight: '#e8d8cc' }
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

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
      await addHead({ clerkId: clerkId.trim(), displayName: displayName.trim(), email: email.trim() || undefined });
      setClerkId(""); setDisplayName(""); setEmail(""); setShowAddModal(false);
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
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/cluster-admin" className="p-2 -ml-2" style={{ color: colors.text.secondary }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <span className="text-base" style={{ color: colors.text.primary }}>Cluster Heads</span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-24">
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="w-full mb-6 py-3 rounded-xl text-sm" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>+ Add Cluster Head</button>
          )}

          {/* Stats */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 p-4 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
              <p className="text-xl" style={{ color: colors.text.primary }}>{activeHeads.length}</p>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>Active</p>
            </div>
            <div className="flex-1 p-4 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
              <p className="text-xl" style={{ color: colors.accent.sage }}>{assignedHeads.length}</p>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>Assigned</p>
            </div>
            <div className="flex-1 p-4 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
              <p className="text-xl" style={{ color: colors.text.muted }}>{unassignedHeads.length}</p>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>Unassigned</p>
            </div>
          </div>

          {/* Assigned Heads */}
          <div className="mb-6">
            <span className="text-xs block mb-3" style={{ color: colors.text.muted }}>Assigned ({assignedHeads.length})</span>
            {assignedHeads.length > 0 ? (
              <div className="space-y-2">
                {assignedHeads.map((head: ClusterHead) => (
                  <div key={head._id} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
                          <span className="text-sm" style={{ color: colors.text.secondary }}>{head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: colors.text.primary }}>{head.displayName}</span>
                          <span className="text-xs block" style={{ color: colors.text.muted }}>{head.clerkId.slice(0, 12)}...</span>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}>{head.clusterName}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                <p className="text-sm" style={{ color: colors.text.secondary }}>No assigned heads</p>
              </div>
            )}
          </div>

          {/* Unassigned Heads */}
          <div className="mb-6">
            <span className="text-xs block mb-3" style={{ color: colors.text.muted }}>Unassigned ({unassignedHeads.length})</span>
            {unassignedHeads.length > 0 ? (
              <div className="space-y-2">
                {unassignedHeads.map((head: ClusterHead) => (
                  <div key={head._id} className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
                          <span className="text-sm" style={{ color: colors.text.secondary }}>{head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: colors.text.primary }}>{head.displayName}</span>
                          <span className="text-xs block" style={{ color: colors.text.muted }}>{head.clerkId.slice(0, 12)}...</span>
                        </div>
                      </div>
                      {isAdmin && <button onClick={() => setShowArchiveModal(head)} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Archive</button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                <p className="text-sm" style={{ color: colors.text.secondary }}>No unassigned heads</p>
              </div>
            )}
          </div>

          {/* Archived Heads */}
          {isAdmin && archivedHeads.length > 0 && (
            <div>
              <span className="text-xs block mb-3" style={{ color: colors.text.muted }}>Archived ({archivedHeads.length})</span>
              <div className="space-y-2">
                {archivedHeads.map((head: ClusterHead) => (
                  <div key={head._id} className="p-4 rounded-xl opacity-60" style={{ backgroundColor: colors.surface }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
                          <span className="text-sm" style={{ color: colors.text.muted }}>{head.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-sm block" style={{ color: colors.text.secondary }}>{head.displayName}</span>
                          <span className="text-xs block" style={{ color: colors.text.muted }}>{head.clerkId.slice(0, 12)}...</span>
                        </div>
                      </div>
                      <button onClick={() => handleReactivate(head._id)} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>Reactivate</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Add Head Modal */}
        {showAddModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }} onClick={() => setShowAddModal(false)}>
            <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
                <h3 className="text-base" style={{ color: colors.text.primary }}>Add Cluster Head</h3>
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>Paste the Clerk ID from Clerk Dashboard</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs mb-2 block" style={{ color: colors.text.muted }}>Clerk ID *</label>
                  <input type="text" value={clerkId} onChange={(e) => setClerkId(e.target.value)} placeholder="user_xxxxxxxxxxxx" className="w-full px-3 py-2.5 text-sm rounded-xl outline-none font-mono" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                </div>
                <div>
                  <label className="text-xs mb-2 block" style={{ color: colors.text.muted }}>Full Name *</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter full name..." className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                </div>
                <div>
                  <label className="text-xs mb-2 block" style={{ color: colors.text.muted }}>Email (optional)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Cancel</button>
                  <button onClick={handleAdd} disabled={!clerkId.trim() || !displayName.trim() || isAdding} className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{isAdding ? 'Adding...' : 'Add Head'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirm Modal */}
        {showArchiveModal && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }} onClick={() => setShowArchiveModal(null)}>
            <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
                <h3 className="text-base" style={{ color: colors.text.primary }}>Archive Cluster Head</h3>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm" style={{ color: colors.text.secondary }}>Are you sure you want to archive <strong>{showArchiveModal.displayName}</strong>?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowArchiveModal(null)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Cancel</button>
                  <button onClick={handleArchive} className="flex-1 py-2.5 text-sm rounded-xl" style={{ backgroundColor: colors.accent.terracotta, color: '#fff' }}>Archive</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
