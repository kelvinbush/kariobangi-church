"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateLong } from "@/lib/date";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: {
    primary: '#3d3a36',
    secondary: '#6b6864',
    muted: '#9a9793',
  },
  accent: {
    amber: '#c9a87c',
    amberLight: '#e8dcc8',
    sage: '#9db88c',
    sageLight: '#c5d4be',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
  }
};

// Subtle dot pattern
const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

export default function MyFollowUpsPage() {
  const searchParams = useSearchParams();
  const clerkIdParam = searchParams.get("clerkId");

  const { isAuthenticated } = useConvexAuth();
  const list = useQuery(
    api.followUps.myFollowUps,
    isAuthenticated ? (clerkIdParam ? { clerkId: clerkIdParam } : {}) : "skip"
  );

  const addLogMutation = useMutation(api.followUps.addLog);
  const requestRemovalMutation = useMutation(api.followUps.requestRemoval);

  const [toast, setToast] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{
    followUpId: Id<"followUps">;
    visitorName: string;
  } | null>(null);
  const [logStatus, setLogStatus] = useState("contacted");
  const [logComment, setLogComment] = useState("");
  const [removalModal, setRemovalModal] = useState<{
    followUpId: Id<"followUps">;
    visitorName: string;
  } | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [logsOpenFor, setLogsOpenFor] = useState<Id<"followUps"> | null>(null);

  const logsFor = useQuery(
    api.followUps.logsForFollowUp,
    logsOpenFor ? { followUpId: logsOpenFor } : "skip"
  );

  const stats = useMemo(() => {
    const notContacted = (list ?? []).filter((f) => f.status === "not_contacted").length;
    const needsFollowUp = (list ?? []).filter((f) => f.status === "needs_follow_up").length;
    const contacted = (list ?? []).filter((f) => f.status === "contacted").length;
    return { notContacted, needsFollowUp, contacted, total: (list ?? []).length };
  }, [list]);

  const handleAddLog = async () => {
    if (!logModal) return;
    try {
      await addLogMutation({
        followUpId: logModal.followUpId,
        status: logStatus,
        comment: logComment.trim() || "(no comment)",
      });
      setToast("Log added");
      setLogModal(null);
      setLogComment("");
      setLogStatus("contacted");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to add log");
    }
  };

  const handleRequestRemoval = async () => {
    if (!removalModal || !removalReason.trim()) {
      setToast("Please enter a reason");
      return;
    }
    try {
      await requestRemovalMutation({
        followUpId: removalModal.followUpId,
        reason: removalReason.trim(),
      });
      setToast("Removal requested");
      setRemovalModal(null);
      setRemovalReason("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to request removal");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "not_contacted": return colors.accent.terracotta;
      case "contacted": return colors.accent.sage;
      case "needs_follow_up": return colors.accent.amber;
      default: return colors.text.muted;
    }
  };

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            My Follow-ups
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/follow-ups"
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              Admin
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Toast */}
          {toast && (
            <div 
              className="mb-4 p-3 rounded-xl text-sm text-center"
              style={{ backgroundColor: colors.text.primary, color: '#fff' }}
            >
              {toast}
            </div>
          )}

          {/* Stats */}
          {stats.total > 0 && (
            <div 
              className="rounded-2xl p-5 mb-6"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex items-center gap-6">
                {stats.notContacted > 0 && (
                  <div>
                    <div 
                      className="text-3xl font-light mb-1"
                      style={{ color: colors.accent.terracotta }}
                    >
                      {stats.notContacted}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      Not contacted
                    </div>
                  </div>
                )}
                {stats.needsFollowUp > 0 && (
                  <>
                    {stats.notContacted > 0 && (
                      <div 
                        className="w-px h-10"
                        style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
                      />
                    )}
                    <div>
                      <div 
                        className="text-3xl font-light mb-1"
                        style={{ color: colors.accent.amber }}
                      >
                        {stats.needsFollowUp}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        Needs follow-up
                      </div>
                    </div>
                  </>
                )}
                {stats.contacted > 0 && stats.notContacted === 0 && stats.needsFollowUp === 0 && (
                  <div>
                    <div 
                      className="text-3xl font-light mb-1"
                      style={{ color: colors.accent.sage }}
                    >
                      {stats.contacted}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      Contacted
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* List */}
          {list === undefined ? (
            <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
              Loading…
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
              No follow-ups assigned yet
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((f) => (
                <div
                  key={f._id}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm mb-1" style={{ color: colors.text.primary }}>
                        {f.visitorName}
                      </div>
                      {f.visitorContact && (
                        <a
                          href={`tel:${f.visitorContact}`}
                          className="text-xs block mb-1"
                          style={{ color: colors.accent.amber }}
                        >
                          {f.visitorContact}
                        </a>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: colors.text.muted }}>
                          {formatDateLong(f.visitorDate)}
                        </span>
                        <span 
                          className="text-xs"
                          style={{ color: getStatusColor(f.status) }}
                        >
                          • {STATUS_OPTIONS.find((s) => s.value === f.status)?.label ?? f.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setLogModal({ followUpId: f._id, visitorName: f.visitorName })}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.text.primary, color: '#fff' }}
                    >
                      Add log
                    </button>
                    {!f.removalRequested && (
                      <button
                        onClick={() => setRemovalModal({ followUpId: f._id, visitorName: f.visitorName })}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                      >
                        Request removal
                      </button>
                    )}
                    <button
                      onClick={() => setLogsOpenFor(logsOpenFor === f._id ? null : f._id)}
                      className="text-xs px-3 py-1.5 rounded-full ml-auto"
                      style={{ 
                        backgroundColor: logsOpenFor === f._id ? colors.accent.amberLight : colors.surfaceHover,
                        color: logsOpenFor === f._id ? colors.accent.amber : colors.text.secondary
                      }}
                    >
                      {logsOpenFor === f._id ? "Hide" : "History"}
                    </button>
                  </div>

                  {/* History */}
                  {logsOpenFor === f._id && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid rgba(61, 58, 54, 0.06)` }}>
                      {logsFor === undefined ? (
                        <div className="text-xs" style={{ color: colors.text.muted }}>Loading…</div>
                      ) : logsFor.length === 0 ? (
                        <div className="text-xs" style={{ color: colors.text.muted }}>No logs yet</div>
                      ) : (
                        <div className="space-y-2">
                          {logsFor.map((log) => (
                            <div key={log._id} className="text-xs">
                              <span style={{ color: colors.text.muted }}>
                                {formatDate(new Date(log.loggedAt))} — {log.status}
                              </span>
                              <p style={{ color: colors.text.secondary }}>{log.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Add Log Modal */}
        {logModal && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm mb-4" style={{ color: colors.text.primary }}>
                {logModal.visitorName}
              </div>
              <select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm mb-3 outline-none"
                style={{ backgroundColor: colors.bg, color: colors.text.primary }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <textarea
                value={logComment}
                onChange={(e) => setLogComment(e.target.value)}
                placeholder="Notes from the call"
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none mb-4 outline-none"
                style={{ backgroundColor: colors.bg, color: colors.text.primary }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddLog}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: colors.text.primary, color: '#fff' }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setLogModal(null);
                    setLogComment("");
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request Removal Modal */}
        {removalModal && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm mb-2" style={{ color: colors.text.primary }}>
                Request removal
              </div>
              <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                {removalModal.visitorName}
              </div>
              <textarea
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                placeholder="Reason (e.g. moved away, not interested)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none mb-4 outline-none"
                style={{ backgroundColor: colors.bg, color: colors.text.primary }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRequestRemoval}
                  disabled={!removalReason.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50"
                  style={{ backgroundColor: colors.accent.terracotta, color: '#fff' }}
                >
                  Submit
                </button>
                <button
                  onClick={() => {
                    setRemovalModal(null);
                    setRemovalReason("");
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
