"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

export default function FollowUpsAdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";

  const eligible = useQuery(
    api.followUps.visitorsEligibleForFollowUp,
    isAuthenticated ? {} : "skip"
  );
  const protocolList = useQuery(
    api.protocolMembers.list,
    isAuthenticated ? { activeOnly: true } : "skip"
  );
  const listAll = useQuery(api.followUps.listAll, isAuthenticated ? {} : "skip");
  const removalQueue = useQuery(api.followUps.removalQueue, isAuthenticated ? {} : "skip");
  const graduates = useQuery(
    api.followUps.graduatesByProtocolMember,
    isAuthenticated ? {} : "skip"
  );
  const recentGrads = useQuery(
    api.followUps.recentGraduates,
    isAuthenticated ? { limit: 5 } : "skip"
  );

  const protocolListAll = useQuery(
    api.protocolMembers.list,
    isAuthenticated ? {} : "skip"
  );
  const assignMutation = useMutation(api.followUps.assign);
  const reassignMutation = useMutation(api.followUps.reassign);
  const removeVisitorMutation = useMutation(api.followUps.removeVisitorAndArchiveFollowUp);
  const markAsGraduatedMutation = useMutation(api.followUps.markAsGraduated);
  const addProtocolMutation = useMutation(api.protocolMembers.add);
  const updateProtocolMutation = useMutation(api.protocolMembers.update);

  const [assignVisitorId, setAssignVisitorId] = useState<Id<"visitors"> | "">("");
  const [assignClerkId, setAssignClerkId] = useState("");
  const [reassignFollowUpId, setReassignFollowUpId] = useState<Id<"followUps"> | null>(null);
  const [reassignClerkId, setReassignClerkId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "assign" | "removal" | "graduates" | "protocol">("list");
  const [newProtocolClerkId, setNewProtocolClerkId] = useState("");
  const [newProtocolDisplayName, setNewProtocolDisplayName] = useState("");

  const canAccess =
    role === "admin" || role === "follow-up-admin";
  const isAdmin = role === "admin";

  const handleAssign = async () => {
    if (!assignVisitorId || !assignClerkId) {
      setToast("Select a visitor and a protocol member");
      return;
    }
    try {
      await assignMutation({ visitorId: assignVisitorId as Id<"visitors">, assignedToClerkId: assignClerkId });
      setToast("Assigned");
      setAssignVisitorId("");
      setAssignClerkId("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to assign");
    }
  };

  const handleReassign = async () => {
    if (!reassignFollowUpId || !reassignClerkId) return;
    try {
      await reassignMutation({ followUpId: reassignFollowUpId, assignedToClerkId: reassignClerkId });
      setToast("Reassigned");
      setReassignFollowUpId(null);
      setReassignClerkId("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to reassign");
    }
  };

  const handleApproveRemoval = async (visitorId: Id<"visitors">, followUpId: Id<"followUps">) => {
    if (!isAdmin) return;
    try {
      await removeVisitorMutation({ visitorId, followUpId });
      setToast("Visitor removed and follow-up archived");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const handleAddProtocol = async () => {
    if (!newProtocolClerkId.trim() || !newProtocolDisplayName.trim()) {
      setToast("Enter Clerk ID and display name");
      return;
    }
    try {
      await addProtocolMutation({
        clerkId: newProtocolClerkId.trim(),
        displayName: newProtocolDisplayName.trim(),
      });
      setToast("Protocol member added");
      setNewProtocolClerkId("");
      setNewProtocolDisplayName("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const handleToggleProtocolActive = async (
    id: Id<"protocolMembers">,
    currentActive: boolean
  ) => {
    try {
      await updateProtocolMutation({ id, active: !currentActive });
      setToast(currentActive ? "Deactivated" : "Activated");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleMarkGraduated = async (followUpId: Id<"followUps">) => {
    try {
      await markAsGraduatedMutation({ followUpId });
      setToast("Marked as graduated");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to mark graduated");
    }
  };

  if (typeof window !== "undefined" && isAuthenticated && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50">
        <div className="rounded-2xl p-8 bg-white/80 backdrop-blur text-center max-w-md">
          <p className="text-zinc-700 mb-4">You need follow-up-admin or admin role to access this page.</p>
          <Link href="/" className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-sm font-light hover:bg-zinc-800"
            >
              Home
            </Link>
            <Link
              href="/follow-ups/my"
              className="px-3 py-1.5 rounded-full bg-white/70 border border-zinc-200 text-zinc-900 text-sm"
            >
              My follow-ups
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-light tracking-tight text-zinc-900">
                Follow-ups
              </h1>
              <p className="text-sm text-zinc-600">Assign and manage visitor follow-ups</p>
            </div>
          </div>
          <UserButton />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <SignedOut>
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
            <p className="mb-4 text-zinc-700">Please sign in.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {toast && (
            <div className="rounded-lg px-4 py-2 bg-zinc-900 text-white text-sm">
              {toast}
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
            {(["list", "assign", "removal", "graduates", "protocol"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  activeTab === tab
                    ? "bg-zinc-900 text-white"
                    : "bg-white/70 border border-zinc-200 text-zinc-700"
                }`}
              >
                {tab === "list" && "All follow-ups"}
                {tab === "assign" && "Assign"}
                {tab === "removal" && `Removal queue (${removalQueue?.length ?? 0})`}
                {tab === "graduates" && "Graduates"}
                {tab === "protocol" && "Protocol members"}
              </button>
            ))}
          </div>

          {activeTab === "list" && (
            <div className="rounded-2xl p-4 bg-white/70 backdrop-blur-xl">
              <h2 className="text-lg font-medium text-zinc-900 mb-3">Active follow-ups</h2>
              {listAll === undefined ? (
                <p className="text-zinc-500">Loading…</p>
              ) : listAll.length === 0 ? (
                <p className="text-zinc-500">No active follow-ups.</p>
              ) : (
                <ul className="space-y-2">
                  {listAll.map((f) => (
                    <li
                      key={f._id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                    >
                      <div>
                        <span className="font-medium text-zinc-900">{f.visitorName}</span>
                        {f.visitorContact && (
                          <span className="text-zinc-500 text-sm ml-2">{f.visitorContact}</span>
                        )}
                        <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                          {STATUS_OPTIONS.find((s) => s.value === f.status)?.label ?? f.status}
                        </span>
                        {f.removalRequested && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs">
                            Removal requested
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">
                          → {protocolList?.find((p) => p.clerkId === f.assignedToClerkId)?.displayName ?? f.assignedToClerkId}
                        </span>
                        <button
                          onClick={() => {
                            setReassignFollowUpId(f._id);
                            setReassignClerkId(f.assignedToClerkId);
                          }}
                          className="px-2 py-1 rounded bg-zinc-200 text-zinc-800 text-xs"
                        >
                          Reassign
                        </button>
                        <button
                          onClick={() => handleMarkGraduated(f._id)}
                          className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs"
                        >
                          Mark graduated
                        </button>
                        <Link
                          href={`/follow-ups/my?clerkId=${encodeURIComponent(f.assignedToClerkId)}`}
                          className="px-2 py-1 rounded bg-amber-100 text-amber-900 text-xs"
                        >
                          View
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "assign" && (
            <div className="rounded-2xl p-4 bg-white/70 backdrop-blur-xl">
              <h2 className="text-lg font-medium text-zinc-900 mb-3">Assign visitor to protocol member</h2>
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <select
                  value={assignVisitorId}
                  onChange={(e) => setAssignVisitorId(e.target.value as Id<"visitors">)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm min-w-[200px]"
                >
                  <option value="">Select visitor</option>
                  {(eligible ?? []).map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name} ({v.date})
                    </option>
                  ))}
                </select>
                <select
                  value={assignClerkId}
                  onChange={(e) => setAssignClerkId(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm min-w-[180px]"
                >
                  <option value="">Select protocol member</option>
                  {role === "admin" || role === "follow-up-admin"
                    ? (() => {
                        const currentUserId = user?.id;
                        const currentUserOption =
                          currentUserId && !(protocolList ?? []).some((p) => p.clerkId === currentUserId)
                            ? [
                                {
                                  clerkId: currentUserId,
                                  displayName: (user?.fullName ?? "Me (you)").trim() || "Me (you)",
                                },
                              ]
                            : [];
                        const fromTable = protocolList ?? [];
                        return [...currentUserOption, ...fromTable];
                      })().map((p, i) => (
                        <option key={p.clerkId + String(i)} value={p.clerkId}>
                          {p.displayName}
                        </option>
                      ))
                    : (protocolList ?? []).map((p) => (
                        <option key={p._id} value={p.clerkId}>
                          {p.displayName}
                        </option>
                      ))}
                </select>
                <button
                  onClick={handleAssign}
                  className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                >
                  Assign
                </button>
              </div>
              {eligible?.length === 0 && (
                <p className="text-zinc-500 text-sm mt-2">
                  No eligible visitors (past 3 Sundays, not children, not already assigned).
                </p>
              )}
            </div>
          )}

          {activeTab === "removal" && (
            <div className="rounded-2xl p-4 bg-white/70 backdrop-blur-xl">
              <h2 className="text-lg font-medium text-zinc-900 mb-3">Removal queue (admin only)</h2>
              {removalQueue === undefined ? (
                <p className="text-zinc-500">Loading…</p>
              ) : removalQueue.length === 0 ? (
                <p className="text-zinc-500">No removal requests.</p>
              ) : (
                <ul className="space-y-2">
                  {removalQueue.map((f) => (
                    <li
                      key={f._id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-red-50/50 border border-red-100"
                    >
                      <div>
                        <span className="font-medium text-zinc-900">{f.visitorName}</span>
                        <span className="text-zinc-500 text-sm ml-2">{f.visitorContact ?? ""}</span>
                        <p className="text-sm text-zinc-600 mt-1">{f.removalReason ?? ""}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleApproveRemoval(f.visitorId, f._id)}
                          className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-sm"
                        >
                          Remove visitor
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "protocol" && (
            <div className="rounded-2xl p-4 bg-white/70 backdrop-blur-xl">
              <h2 className="text-lg font-medium text-zinc-900 mb-3">Protocol members</h2>
              <p className="text-sm text-zinc-600 mb-4">
                Add users by their Clerk user ID (from Clerk dashboard) and a display name. Only active members appear in the Assign dropdown.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  value={newProtocolClerkId}
                  onChange={(e) => setNewProtocolClerkId(e.target.value)}
                  placeholder="Clerk user ID"
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm min-w-[200px]"
                />
                <input
                  type="text"
                  value={newProtocolDisplayName}
                  onChange={(e) => setNewProtocolDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm min-w-[160px]"
                />
                <button
                  onClick={handleAddProtocol}
                  className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                >
                  Add
                </button>
              </div>
              {protocolListAll === undefined ? (
                <p className="text-zinc-500">Loading…</p>
              ) : protocolListAll.length === 0 ? (
                <p className="text-zinc-500">No protocol members yet.</p>
              ) : (
                <ul className="space-y-2">
                  {protocolListAll.map((p) => (
                    <li
                      key={p._id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100"
                    >
                      <span className={p.active ? "text-zinc-900" : "text-zinc-400"}>
                        {p.displayName}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{p.clerkId}</span>
                      <button
                        onClick={() => handleToggleProtocolActive(p._id, p.active)}
                        className={`px-2 py-1 rounded text-xs ${
                          p.active
                            ? "bg-amber-100 text-amber-800"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "graduates" && (
            <div className="rounded-2xl p-4 bg-white/70 backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-medium text-zinc-900">Graduates by protocol member</h2>
              {graduates === undefined ? (
                <p className="text-zinc-500">Loading…</p>
              ) : graduates.length === 0 ? (
                <p className="text-zinc-500">No graduates yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {graduates.map((g) => (
                    <span
                      key={g.clerkId}
                      className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-sm"
                    >
                      {g.displayName}: {g.count}
                    </span>
                  ))}
                </div>
              )}
              <h3 className="text-base font-medium text-zinc-800 mt-4">Recent graduates</h3>
              {recentGrads === undefined ? (
                <p className="text-zinc-500">Loading…</p>
              ) : recentGrads.length === 0 ? (
                <p className="text-zinc-500">None.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {recentGrads.map((g) => (
                    <li key={g.followUpId}>
                      {g.visitorName} — {protocolList?.find((p) => p.clerkId === g.assignedToClerkId)?.displayName ?? g.assignedToClerkId}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Reassign modal */}
          {reassignFollowUpId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="rounded-2xl p-6 bg-white max-w-sm w-full">
                <h3 className="font-medium text-zinc-900 mb-3">Reassign to</h3>
                <select
                  value={reassignClerkId}
                  onChange={(e) => setReassignClerkId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm mb-4"
                >
                  {(() => {
                    const currentUserId = user?.id;
                    const currentUserOption =
                      currentUserId && !(protocolList ?? []).some((p) => p.clerkId === currentUserId)
                        ? [
                            {
                              clerkId: currentUserId,
                              displayName: (user?.fullName ?? "Me (you)").trim() || "Me (you)",
                            },
                          ]
                        : [];
                    const fromTable = protocolList ?? [];
                    return [...currentUserOption, ...fromTable].map((p, i) => (
                      <option key={"r-" + p.clerkId + String(i)} value={p.clerkId}>
                        {p.displayName}
                      </option>
                    ));
                  })()}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleReassign}
                    className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => setReassignFollowUpId(null)}
                    className="px-4 py-2 rounded-full border border-zinc-200 text-zinc-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </SignedIn>
      </div>
    </div>
  );
}
