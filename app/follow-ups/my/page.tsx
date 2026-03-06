"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateLong } from "@/lib/date";

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

export default function MyFollowUpsPage() {
  const searchParams = useSearchParams();
  const clerkIdParam = searchParams.get("clerkId");

  const { isAuthenticated } = useConvexAuth();
  const myProtocol = useQuery(api.protocolMembers.myProtocolMember, isAuthenticated ? {} : "skip");
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const logsFor = useQuery(
    api.followUps.logsForFollowUp,
    logsOpenFor ? { followUpId: logsOpenFor } : "skip"
  );

  const notContacted = useMemo(
    () => (list ?? []).filter((f) => f.status === "not_contacted").length,
    [list]
  );
  const needsFollowUp = useMemo(
    () => (list ?? []).filter((f) => f.status === "needs_follow_up").length,
    [list]
  );

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
      setToast("Removal requested. Admin will review.");
      setRemovalModal(null);
      setRemovalReason("");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to request removal");
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      setToast("Notifications not supported in this browser");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        setToast("Notifications enabled. You may get reminders for follow-ups.");
      } else {
        setToast("Notifications blocked. You can enable them later in browser settings.");
      }
    } catch {
      setToast("Could not request notification permission");
    }
  };

  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const canAccess =
    myProtocol !== null ||
    clerkIdParam ||
    role === "admin" ||
    role === "follow-up-admin";
  if (typeof window !== "undefined" && isAuthenticated && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50">
        <div className="rounded-2xl p-8 bg-white/80 backdrop-blur text-center max-w-md">
          <p className="text-zinc-700 mb-4">You are not on the protocol list. Ask an admin to add you.</p>
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
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-sm font-light hover:bg-zinc-800"
            >
              Home
            </Link>
            <Link
              href="/follow-ups"
              className="px-3 py-1.5 rounded-full bg-white/70 border border-zinc-200 text-zinc-900 text-sm"
            >
              Follow-ups (admin)
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-light tracking-tight text-zinc-900">
                My follow-ups
              </h1>
              <p className="text-sm text-zinc-600">
                {clerkIdParam ? "Viewing another protocol member's list" : "Your assigned visitors"}
              </p>
            </div>
          </div>
          <UserButton />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">

          {toast && (
            <div className="rounded-lg px-4 py-2 bg-zinc-900 text-white text-sm">
              {toast}
            </div>
          )}

          {/* Reminders */}
          {(notContacted > 0 || needsFollowUp > 0) && (
            <div className="rounded-2xl p-4 bg-amber-400/90 text-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-sm">
                  {notContacted > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-white/80">
                      {notContacted} not contacted
                    </span>
                  )}
                  {needsFollowUp > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-white/80">
                      {needsFollowUp} need follow-up
                    </span>
                  )}
                </div>
                {typeof window !== "undefined" && "Notification" in window && !notificationsEnabled && (
                  <button
                    onClick={handleEnableNotifications}
                    className="px-3 py-2 rounded-xl bg-white border-2 border-zinc-300 text-zinc-900 text-sm font-medium hover:bg-zinc-50"
                  >
                    Enable browser notifications
                  </button>
                )}
              </div>
            </div>
          )}

          {list === undefined ? (
            <p className="text-zinc-500">Loading…</p>
          ) : list.length === 0 ? (
            <div className="rounded-2xl p-6 bg-white border border-zinc-200 shadow-sm text-center text-zinc-600">
              No follow-ups assigned to you yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((f) => (
                <li
                  key={f._id}
                  className="rounded-2xl p-4 bg-white border-2 border-zinc-200 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">{f.visitorName}</div>
                      {f.visitorContact && (
                        <a
                          href={`tel:${f.visitorContact}`}
                          className="text-sm text-amber-700 hover:underline"
                        >
                          {f.visitorContact}
                        </a>
                      )}
                      <div className="text-xs text-zinc-500 mt-1">
                        Visit: {formatDateLong(f.visitorDate)}
                      </div>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                        {STATUS_OPTIONS.find((s) => s.value === f.status)?.label ?? f.status}
                      </span>
                      {f.removalRequested && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs">
                          Removal requested
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setLogModal({ followUpId: f._id, visitorName: f.visitorName })}
                        className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium border-2 border-zinc-900"
                      >
                        Add log
                      </button>
                      {!f.removalRequested && (
                        <button
                          onClick={() =>
                            setRemovalModal({ followUpId: f._id, visitorName: f.visitorName })
                          }
                          className="px-3 py-2 rounded-xl border-2 border-zinc-300 bg-zinc-50 text-zinc-800 text-sm font-medium"
                        >
                          Request removal
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setLogsOpenFor(logsOpenFor === f._id ? null : f._id)
                        }
                        className="px-3 py-2 rounded-xl border-2 border-amber-300 bg-amber-100 text-amber-900 text-sm font-medium"
                      >
                        {logsOpenFor === f._id ? "Hide history" : "History"}
                      </button>
                    </div>
                  </div>
                  {logsOpenFor === f._id && (
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      {logsFor === undefined ? (
                        <p className="text-sm text-zinc-500">Loading logs…</p>
                      ) : logsFor.length === 0 ? (
                        <p className="text-sm text-zinc-500">No logs yet.</p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {logsFor.map((log) => (
                            <li key={log._id} className="flex flex-col gap-0.5">
                              <span className="text-zinc-500">
                                {formatDate(new Date(log.loggedAt))} — {log.status}
                              </span>
                              <span className="text-zinc-700">{log.comment}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </div>

      {/* Add log modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-2xl p-6 bg-white max-w-md w-full">
            <h3 className="font-medium text-zinc-900 mb-2">Add log — {logModal.visitorName}</h3>
            <select
              value={logStatus}
              onChange={(e) => setLogStatus(e.target.value)}
              className="w-full rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-sm mb-3 text-zinc-900"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <textarea
              value={logComment}
              onChange={(e) => setLogComment(e.target.value)}
              placeholder="Comment / notes from the call"
              rows={3}
              className="w-full rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-sm resize-none mb-4 text-zinc-900"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddLog}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium border-2 border-zinc-900"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setLogModal(null);
                  setLogComment("");
                }}
                className="px-4 py-2.5 rounded-xl border-2 border-zinc-300 bg-zinc-50 text-zinc-800 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request removal modal */}
      {removalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-2xl p-6 bg-white max-w-md w-full">
            <h3 className="font-medium text-zinc-900 mb-2">
              Request removal — {removalModal.visitorName}
            </h3>
            <p className="text-sm text-zinc-600 mb-3">
              Only an admin can remove the visitor. Your request will be reviewed.
            </p>
            <textarea
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="Reason (e.g. confirmed won't be with us, travelled)"
              rows={3}
              className="w-full rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-sm resize-none mb-4 text-zinc-900"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRequestRemoval}
                disabled={!removalReason.trim()}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium border-2 border-zinc-900 disabled:opacity-50"
              >
                Submit request
              </button>
              <button
                onClick={() => {
                  setRemovalModal(null);
                  setRemovalReason("");
                }}
                className="px-4 py-2.5 rounded-xl border-2 border-zinc-300 bg-zinc-50 text-zinc-800 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
