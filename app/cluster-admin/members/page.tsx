"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Search,
  ChevronLeft,
  Users,
  Plus,
  X,
  Check,
  ArrowRightLeft,
  UserPlus,
  Filter,
} from "lucide-react";

export default function MemberAssignment() {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const preselectedClusterId = searchParams.get("clusterId");

  const [navOpen, setNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(preselectedClusterId);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetCluster, setTargetCluster] = useState<string>("");

  const clusters = useQuery(api.clusters.list, isAuthenticated ? { includeInactive: false } : "skip");
  const members = useQuery(
    api.clusterMembers.listAllWithClusterStatus,
    isAuthenticated ? { search: searchTerm || undefined } : "skip"
  );
  const unassigned = useQuery(api.clusterMembers.unassignedMembers, isAuthenticated ? {} : "skip");

  const addMember = useMutation(api.clusterMembers.addMember);
  const addMembers = useMutation(api.clusterMembers.addMembers);
  const removeMember = useMutation(api.clusterMembers.removeMember);
  const moveMember = useMutation(api.clusterMembers.moveMember);

  const currentCluster = useMemo(
    () => clusters?.find((c) => c._id === selectedCluster),
    [clusters, selectedCluster]
  );

  const clusterMembers = useQuery(
    api.clusterMembers.listByCluster,
    selectedCluster && isAuthenticated ? { clusterId: selectedCluster as any } : "skip"
  );

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!unassigned) return;
    if (selectedMembers.size === unassigned.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(unassigned.map((m) => m._id)));
    }
  };

  const handleAssign = async () => {
    if (!selectedCluster || selectedMembers.size === 0) return;
    try {
      await addMembers({
        clusterId: selectedCluster as any,
        memberIds: Array.from(selectedMembers) as any,
      });
      setSelectedMembers(new Set());
      setShowAssignModal(false);
    } catch (e) {
      alert("Failed to assign members: " + e);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!selectedCluster) return;
    if (!confirm("Remove this member from the cluster?")) return;
    try {
      await removeMember({
        clusterId: selectedCluster as any,
        memberId: memberId as any,
      });
    } catch (e) {
      alert("Failed to remove member: " + e);
    }
  };

  const handleMove = async () => {
    if (!selectedCluster || !targetCluster || selectedMembers.size === 0) return;
    try {
      // Move members one by one
      for (const memberId of selectedMembers) {
        await moveMember({
          memberId: memberId as any,
          fromClusterId: selectedCluster as any,
          toClusterId: targetCluster as any,
        });
      }
      setSelectedMembers(new Set());
      setShowMoveModal(false);
      setTargetCluster("");
    } catch (e) {
      alert("Failed to move members: " + e);
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
                Assign Members
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
            <Link href="/cluster-admin/members" className="px-3 py-3 rounded-lg text-zinc-800 font-medium hover:bg-zinc-100" onClick={() => setNavOpen(false)}>
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
            <p className="mb-4 text-zinc-700">Please sign in to access member assignment.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Cluster Selector */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <select
                value={selectedCluster || ""}
                onChange={(e) => {
                  setSelectedCluster(e.target.value || null);
                  setSelectedMembers(new Set());
                }}
                className="px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 bg-white/60 backdrop-blur-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">All Members</option>
                {clusters?.map((cluster) => (
                  <option key={cluster._id} value={cluster._id}>
                    {cluster.name} ({cluster.memberCount} members)
                  </option>
                ))}
              </select>
            </div>

            {selectedCluster && clusterMembers && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMoveModal(true)}
                  disabled={selectedMembers.size === 0}
                  className="flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Move Selected ({selectedMembers.size})
                </button>
              </div>
            )}

            {!selectedCluster && unassigned && unassigned.length > 0 && (
              <button
                onClick={() => setShowAssignModal(true)}
                disabled={selectedMembers.size === 0}
                className="flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                <UserPlus className="w-4 h-4" />
                Assign {selectedMembers.size > 0 && `(${selectedMembers.size})`}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 bg-white/60 backdrop-blur-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Members List */}
          {selectedCluster ? (
            // Show cluster members
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900">
                  {currentCluster?.name} Members ({clusterMembers?.length || 0})
                </h3>
              </div>
              {clusterMembers && clusterMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clusterMembers.map((member) => (
                    <div
                      key={member._id}
                      className={`p-4 rounded-xl bg-white/60 backdrop-blur-sm border min-h-[80px] ${
                        selectedMembers.has(member.memberId)
                          ? "border-amber-500 bg-amber-50/50"
                          : "border-zinc-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedMembers.has(member.memberId)}
                          onChange={() => handleSelectMember(member.memberId)}
                          className="mt-1 rounded border-zinc-300 w-5 h-5 min-w-[20px]"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-zinc-900">{member.memberName}</h4>
                          <p className="text-sm text-zinc-600">
                            {member.memberContact || "No contact"}
                          </p>
                          {member.memberResidence && (
                            <p className="text-sm text-zinc-500">{member.memberResidence}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemove(member.memberId)}
                          className="p-2 min-h-[36px] min-w-[36px] rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                          title="Remove from cluster"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <p className="text-zinc-600">No members in this cluster yet.</p>
                  <button
                    onClick={() => setSelectedCluster(null)}
                    className="mt-2 text-amber-600 hover:text-amber-700 text-sm"
                  >
                    View unassigned members →
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Show all members with cluster status
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900">
                  All Members {members && `(${members.length})`}
                </h3>
                {unassigned && unassigned.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.size === unassigned.length && unassigned.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-zinc-300"
                    />
                    Select all unassigned ({unassigned.length})
                  </label>
                )}
              </div>
              {members && members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map((member) => (
                    <div
                      key={member._id}
                      className={`p-4 rounded-xl bg-white/60 backdrop-blur-sm border min-h-[80px] ${
                        member.clusterId
                          ? "border-zinc-100"
                          : selectedMembers.has(member._id)
                          ? "border-amber-500 bg-amber-50/50"
                          : "border-zinc-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!member.clusterId && (
                          <input
                            type="checkbox"
                            checked={selectedMembers.has(member._id)}
                            onChange={() => handleSelectMember(member._id)}
                            className="mt-1 rounded border-zinc-300 w-5 h-5 min-w-[20px]"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-zinc-900">{member.name}</h4>
                          <p className="text-sm text-zinc-600">
                            {member.contact || "No contact"}
                          </p>
                          {member.residence && (
                            <p className="text-sm text-zinc-500">{member.residence}</p>
                          )}
                          {member.clusterName ? (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                              {member.clusterName}
                            </span>
                          ) : (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl">
                  <p className="text-zinc-600">No members found.</p>
                </div>
              )}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">
                Assign {selectedMembers.size} Member{selectedMembers.size > 1 ? "s" : ""}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-600 mb-1">Select Cluster</label>
                <select
                  value={targetCluster}
                  onChange={(e) => setTargetCluster(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">Choose a cluster...</option>
                  {clusters?.map((cluster) => (
                    <option key={cluster._id} value={cluster._id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!targetCluster}
                  className="flex-1 px-4 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-zinc-900">
                Move {selectedMembers.size} Member{selectedMembers.size > 1 ? "s" : ""}
              </h3>
              <button onClick={() => setShowMoveModal(false)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-600 mb-1">From</label>
                <div className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-700">
                  {currentCluster?.name}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-600 mb-1">To Cluster</label>
                <select
                  value={targetCluster}
                  onChange={(e) => setTargetCluster(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="">Choose a cluster...</option>
                  {clusters
                    ?.filter((c) => c._id !== selectedCluster)
                    .map((cluster) => (
                      <option key={cluster._id} value={cluster._id}>
                        {cluster.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="flex-1 px-4 py-3 min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMove}
                  disabled={!targetCluster}
                  className="flex-1 px-4 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
