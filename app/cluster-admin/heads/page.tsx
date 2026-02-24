"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ChevronLeft,
  UserCog,
  Plus,
  X,
  Mail,
  RotateCcw,
  UserMinus,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "@/lib/date";

export default function ClusterHeadsManagement() {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const preselectedClusterId = searchParams.get("clusterId");

  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"heads" | "invitations">("heads");
  const [searchTerm, setSearchTerm] = useState("");

  // Invitation modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>(preselectedClusterId || "");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";

  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const invitations = useQuery(
    api.clerkInvitations.listInvitations,
    isAuthenticated ? {} : "skip"
  );

  const cancelInvitation = useMutation(api.clerkInvitations.cancelInvitation);
  const resendInvitation = useMutation(api.clerkInvitations.resendInvitation);
  const revokeHead = useMutation(api.clerkInvitations.revokeClusterHead);
  
  const [isInviting, setIsInviting] = useState(false);

  const clustersWithLeaders = useMemo(
    () => clusters?.filter((c) => c.leaderName) || [],
    [clusters]
  );

  const clustersWithoutLeaders = useMemo(
    () => clusters?.filter((c) => !c.leaderName) || [],
    [clusters]
  );

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      alert("Please enter both name and email");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      alert("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    try {
      // Call the API route which handles both existing users and new invitations
      const response = await fetch("/api/invite-cluster-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          clusterId: selectedCluster || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation");
      }

      if (result.preExisting) {
        // User was promoted immediately
        alert(`${inviteName} was already a user and has been promoted to cluster head.`);
      } else {
        // Invitation was sent
        alert(`Invitation sent to ${inviteEmail}`);
      }

      setShowInviteModal(false);
      setInviteName("");
      setInviteEmail("");
      setSelectedCluster("");
    } catch (e: any) {
      alert("Failed to create invitation: " + e.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (id: Id<"clusterHeadInvitations">) => {
    if (!confirm("Cancel this invitation?")) return;
    try {
      await cancelInvitation({ invitationId: id });
    } catch (e) {
      alert("Failed to cancel invitation: " + e);
    }
  };

  const handleResendInvite = async (id: Id<"clusterHeadInvitations">) => {
    try {
      await resendInvitation({ invitationId: id });
    } catch (e) {
      alert("Failed to resend invitation: " + e);
    }
  };

  const handleRevoke = async (clusterId: string) => {
    if (!confirm("Revoke this cluster head's access? They will no longer be able to access the cluster head dashboard.")) return;
    try {
      await revokeHead({ clusterId: clusterId as any });
    } catch (e) {
      alert("Failed to revoke access: " + e);
    }
  };

  const pendingInvitations = invitations?.filter((i) => i.status === "pending") || [];
  const acceptedInvitations = invitations?.filter((i) => i.status === "accepted") || [];

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
              onClick={() => setActiveTab("heads")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "heads"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Current Heads ({clustersWithLeaders.length})
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "invitations"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Invitations ({pendingInvitations.length})
            </button>
          </div>

          {activeTab === "heads" ? (
            <>
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 bg-white/60 backdrop-blur-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
                >
                  <Plus className="w-4 h-4" />
                  Invite Head
                </button>
              </div>

              {/* Clusters with Leaders */}
              <div className="space-y-4">
                <h3 className="font-medium text-zinc-900">Active Cluster Heads</h3>
                {clustersWithLeaders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clustersWithLeaders
                      .filter((c) =>
                        c.leaderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((cluster) => (
                        <div
                          key={cluster._id}
                          className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-100"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-zinc-900">{cluster.name}</h4>
                              <div className="flex items-center gap-2 mt-2">
                                <UserCog className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm text-emerald-700 font-medium">
                                  {cluster.leaderName}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-600 mt-1">
                                {cluster.memberCount} members
                              </p>
                            </div>
                            {role === "admin" && (
                              <button
                                onClick={() => handleRevoke(cluster._id)}
                                className="p-2 min-h-[36px] min-w-[36px] rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                                title="Revoke access"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white/60 backdrop-blur-xl rounded-2xl">
                    <p className="text-zinc-600">No cluster heads assigned yet.</p>
                  </div>
                )}
              </div>

              {/* Clusters without Leaders */}
              {clustersWithoutLeaders.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-zinc-900">Clusters Without Leaders</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clustersWithoutLeaders.map((cluster) => (
                      <div
                        key={cluster._id}
                        className="p-4 rounded-xl bg-amber-50/50 border border-amber-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-zinc-900">{cluster.name}</h4>
                            <div className="flex items-center gap-2 mt-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-sm text-amber-700">No leader assigned</span>
                            </div>
                            <p className="text-sm text-zinc-600 mt-1">
                              {cluster.memberCount} members
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCluster(cluster._id);
                              setShowInviteModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm hover:bg-amber-200"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Invitations Tab */
            <div className="space-y-4">
              {pendingInvitations.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv._id}
                      className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-zinc-900">{inv.memberName}</h4>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              Pending
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600">{inv.email}</p>
                          {inv.clusterName && (
                            <p className="text-sm text-zinc-500 mt-1">
                              For cluster: {inv.clusterName}
                            </p>
                          )}
                          <p className="text-xs text-zinc-400 mt-2">
                            Invited {formatDistanceToNow(inv.invitedAt)} • Expires{" "}
                            {formatDistanceToNow(inv.expiresAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleResendInvite(inv._id)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100"
                            title="Resend invitation"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(inv._id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            title="Cancel invitation"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <Mail className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-600">No pending invitations.</p>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">Invite Cluster Head</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                />
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g., john@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Cluster Selection */}
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Assign to Cluster (Optional)</label>
                <select
                  value={selectedCluster}
                  onChange={(e) => setSelectedCluster(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">Select later...</option>
                  {clusters?.map((cluster) => (
                    <option key={cluster._id} value={cluster._id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-zinc-500">
                An invitation email will be sent to create their account. If they already have an account, they will be promoted immediately.
              </p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-zinc-100 mt-4">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteName("");
                  setInviteEmail("");
                  setSelectedCluster("");
                }}
                className="flex-1 px-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteName.trim() || !inviteEmail.trim() || isInviting}
                className="flex-1 px-4 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isInviting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
