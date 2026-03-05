"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState<ClusterHead | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const heads = useQuery(api.clusterHeads.list, isAuthenticated ? {} : "skip");
  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  
  const inviteHead = useMutation(api.clerkInvitations.createInvitation);
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

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    
    setIsInviting(true);
    try {
      await inviteHead({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
      });
      setInviteSuccess(true);
      setTimeout(() => {
        setInviteSuccess(false);
        setInviteEmail("");
        setInviteName("");
        setShowInviteModal(false);
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
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
              Please sign in to manage cluster heads
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
          {/* Action Button */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="w-full mb-6 py-3 rounded-xl text-sm"
            style={{ backgroundColor: theme.accent, color: '#fff' }}
          >
            + Invite New Cluster Head
          </button>

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
                          <span className="text-xs" style={{ color: theme.text.muted }}>
                            {head.email}
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
                          <span className="text-xs" style={{ color: theme.text.muted }}>
                            {head.email}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowArchiveModal(head)}
                        className="px-3 py-1.5 rounded-lg text-xs border"
                        style={{ borderColor: theme.border, color: theme.text.secondary }}
                      >
                        Archive
                      </button>
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

          {/* Archived Heads */}
          {archivedHeads.length > 0 && (
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
                          <span className="text-xs" style={{ color: theme.text.muted }}>
                            {head.email}
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowInviteModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Invite Cluster Head</h3>
            </div>
            <div className="p-5 space-y-4">
              {inviteSuccess ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${theme.success}15` }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="2">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: theme.success }}>Invitation sent!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Enter full name..."
                      className="w-full px-3 py-2.5 text-sm rounded-xl border"
                      style={{ borderColor: theme.border, color: theme.text.primary }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-2 block" style={{ color: theme.text.muted }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter email address..."
                      className="w-full px-3 py-2.5 text-sm rounded-xl border"
                      style={{ borderColor: theme.border, color: theme.text.primary }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 py-2.5 text-sm rounded-xl border"
                      style={{ borderColor: theme.border, color: theme.text.secondary }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || !inviteName.trim() || isInviting}
                      className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                      style={{ backgroundColor: theme.accent, color: '#fff' }}
                    >
                      {isInviting ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal */}
      {showArchiveModal && (
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
