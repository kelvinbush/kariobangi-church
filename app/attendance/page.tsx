"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import QuickAddMember from "@/components/QuickAddMember";
import MemberEditor, { MemberSummary } from "@/components/MemberEditor";
import QuickAddKid from "@/components/QuickAddKid";
import KidEditor, { KidSummary } from "@/components/KidEditor";
import QuickAddVisitor from "@/components/QuickAddVisitor";
import VisitorEditor, { VisitorSummary } from "@/components/VisitorEditor";
import SwipeableMemberCard from "@/components/SwipeableMemberCard";
import AttendanceHistoryModal from "@/components/AttendanceHistoryModal";
import { formatDate, formatIsoDate } from "@/lib/date";

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Member = {
  memberId: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  relationshipStatus?: string | null;
  previousChurch?: string | null;
  type?: "member" | "kid" | "visitor";
  presentToday: boolean;
  lastAttendance: { date: string; present: boolean } | null;
};

export default function AttendancePage() {
  const { isAuthenticated } = useConvexAuth();
  const todayIso = toISODate(new Date());
  const [tab, setTab] = useState<"all" | "male" | "female" | "kids" | "visitors">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberSummary | null>(null);
  const [kidEditorOpen, setKidEditorOpen] = useState(false);
  const [editingKid, setEditingKid] = useState<KidSummary | null>(null);
  const [visitorEditorOpen, setVisitorEditorOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(20);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [viewingMemberName, setViewingMemberName] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const roster = useQuery(
    api.attendance.rosterForDate,
    isAuthenticated ? { date: todayIso } : "skip"
  );

  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  // Pull to refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || window.scrollY > 0) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setPullDistance(Math.min(deltaY, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      // Trigger refresh by updating a state that causes re-query
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsRefreshing(false);
      setToast("Refreshed");
    }
    setPullDistance(0);
    touchStartY.current = null;
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex !== null && listRef.current) {
      const element = listRef.current.children[focusedIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [focusedIndex]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const members = roster ?? [];
  // Separate members from visitors
  const membersOnly = useMemo(() => members.filter((m: any) => m.type !== "visitor"), [members]);
  const visitors = useMemo(() => members.filter((m: any) => m.type === "visitor"), [members]);
  
  const presentTodayCount = useMemo(
    () => membersOnly.filter((m) => m.presentToday).length,
    [membersOnly]
  );
  const presentVisitorsCount = useMemo(
    () => visitors.filter((m) => m.presentToday).length,
    [visitors]
  );

  // Filter by tab
  const filtered = useMemo(() => {
    if (tab === "all") return members;
    if (tab === "kids") return members.filter((m) => (m as any).type === "kid");
    if (tab === "visitors") return members.filter((m) => (m as any).type === "visitor");
    return members.filter((m) => (m.gender ?? "").toLowerCase() === tab);
  }, [members, tab]);

  // Apply client-side search
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    const terms = q.split(/\s+/).filter(Boolean);
    return filtered.filter((m: any) => {
      const hay = `${m.name ?? ""} ${m.contact ?? ""} ${m.residence ?? ""} ${m.department ?? ""} ${m.status ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [filtered, query]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(searched.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searched.slice(start, start + pageSize);
  }, [searched, currentPage, pageSize]);

  // Reset page when dependencies change
  useEffect(() => {
    setPage(1);
  }, [query, tab, pageSize]);

  const handleToggleAttendance = useCallback(async (
    memberId: string,
    isPresent: boolean
  ) => {
    const payload = { memberId: memberId as any, date: todayIso } as any;
    try {
      if (isPresent) {
        await unmarkPresent(payload);
        setToast("Marked absent");
      } else {
        await markPresent(payload);
        setToast("Marked present");
      }
      // Haptic feedback
      if ("vibrate" in navigator) {
        navigator.vibrate(10);
      }
    } catch (e) {
      setToast("Error updating attendance");
    }
  }, [todayIso, markPresent, unmarkPresent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === " " && focusedIndex !== null && !e.repeat) {
        e.preventDefault();
        const member = paged[focusedIndex];
        if (member) {
          handleToggleAttendance(member.memberId, member.presentToday);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (focusedIndex === null) {
          setFocusedIndex(0);
        } else {
          setFocusedIndex(Math.min(paged.length - 1, focusedIndex + 1));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (focusedIndex === null) {
          setFocusedIndex(0);
        } else {
          setFocusedIndex(Math.max(0, focusedIndex - 1));
        }
      } else if (e.key === "Escape") {
        setBulkMode(false);
        setSelectedMembers(new Set());
        setFocusedIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, paged, handleToggleAttendance, bulkMode]);

  const handleBulkMark = async (present: boolean) => {
    const promises = Array.from(selectedMembers).map((id) =>
      handleToggleAttendance(id, !present)
    );
    await Promise.all(promises);
    setToast(`Marked ${selectedMembers.size} members as ${present ? "present" : "absent"}`);
    setSelectedMembers(new Set());
    setBulkMode(false);
  };

  const handleSelectMember = (memberId: string, selected: boolean) => {
    const newSet = new Set(selectedMembers);
    if (selected) {
      newSet.add(memberId);
    } else {
      newSet.delete(memberId);
    }
    setSelectedMembers(newSet);
  };

  const handleViewHistory = (member: Member) => {
    setViewingMemberId(member.memberId);
    setViewingMemberName(member.name);
    setHistoryModalOpen(true);
  };

  const exportAttendance = () => {
    const presentMembers = members.filter((m) => m.presentToday);
    const csv = [
      ["Name", "Contact", "Residence", "Gender", "Department", "Status", "Present"].join(","),
      ...presentMembers.map((m) =>
        [
          m.name,
          m.contact ?? "",
          m.residence ?? "",
          m.gender ?? "",
          (m as any).department ?? "",
          (m as any).status ?? "",
          "Yes",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Exported to CSV");
  };

  return (
    <div
      className="text-foreground font-light min-h-screen bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <SignedOut>
        <div className="max-w-3xl mx-auto p-8">
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
            <p className="mb-4 text-zinc-700">
              Please sign in to mark attendance.
            </p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Pull to refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 bg-amber-400/80 backdrop-blur"
            style={{ transform: `translateY(${Math.min(pullDistance, 100)}px)` }}
          >
            <span className="text-sm text-zinc-900">
              {pullDistance > 50 ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        )}

        {/* Sticky Header */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div>
              <h1 className="text-3xl md:text-[2.1rem] font-light tracking-tight text-zinc-900">
                Attendance
              </h1>
              <p className="text-sm text-zinc-600">
                Mark arrivals quickly and accurately
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportAttendance}
                className="px-3 py-1.5 rounded-full text-sm bg-zinc-200 text-zinc-900"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
          {/* Highlights Panel */}
          <HighlightsPanel
            dateStr={formatDate(new Date())}
            dateIso={todayIso}
            total={membersOnly.length}
            present={presentTodayCount}
            visitors={visitors.length}
            presentVisitors={presentVisitorsCount}
            tab={tab}
          />

          {/* Bulk Actions Bar */}
          {bulkMode && selectedMembers.size > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl flex items-center justify-between">
              <span className="text-sm text-zinc-700">
                {selectedMembers.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkMark(true)}
                  className="px-4 py-2 rounded-full text-sm bg-emerald-500 text-white"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => handleBulkMark(false)}
                  className="px-4 py-2 rounded-full text-sm bg-rose-500 text-white"
                >
                  Mark All Absent
                </button>
                <button
                  onClick={() => {
                    setSelectedMembers(new Set());
                    setBulkMode(false);
                  }}
                  className="px-4 py-2 rounded-full text-sm bg-zinc-200 text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Gender Tabs */}
          <div className="border-b border-white/20">
            <div className="flex items-center gap-6 overflow-x-auto">
              {([
                { key: "all", label: "All" },
                { key: "male", label: "Male" },
                { key: "female", label: "Female" },
                { key: "kids", label: "Kids" },
                { key: "visitors", label: "Visitors" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pb-2 -mb-px text-sm whitespace-nowrap transition-colors border-b-2 ${
                    tab === t.key
                      ? "text-[#303030] border-[#303030]"
                      : "text-[#89888a] border-transparent hover:text-[#303030]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, residence, department, status"
                className="flex-1 px-4 py-2.5 rounded-full border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={() => {
                  setBulkMode(!bulkMode);
                  if (bulkMode) setSelectedMembers(new Set());
                }}
                className={`px-3 py-2 rounded-full text-sm ${
                  bulkMode
                    ? "bg-amber-400 text-zinc-900"
                    : "bg-zinc-200 text-zinc-900"
                }`}
              >
                {bulkMode ? "Cancel Select" : "Select"}
              </button>
            </div>
            <div className="flex items-center justify-between md:justify-start gap-2 text-sm">
              <span className="text-zinc-700">Per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize((Number(e.target.value) as 10 | 20))}
                className="px-3 py-1.5 rounded-full border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          {/* Loading Skeleton */}
          {roster === undefined && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl animate-pulse"
                >
                  <div className="h-4 w-3/4 rounded bg-zinc-200" />
                  <div className="h-3 w-1/2 rounded mt-2 bg-zinc-200" />
                </div>
              ))}
            </div>
          )}

          {/* Mobile roster (cards) */}
          {roster !== undefined && searched.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white/30 backdrop-blur-xl text-center">
              <EmptyState
                icon="👥"
                title="No members found"
                description="No members available for this filter."
              />
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2" ref={listRef}>
                {paged.map((m, index) => (
                  <div
                    key={m.memberId as any}
                    onClick={() => {
                      if (!bulkMode) {
                        handleViewHistory(m as Member);
                      }
                    }}
                    className={focusedIndex === index ? "ring-2 ring-amber-400 rounded-2xl" : ""}
                  >
                    <SwipeableMemberCard
                      member={m as Member}
                      onToggleAttendance={handleToggleAttendance}
                      onEdit={() => {
                        if ((m as any).type === "kid") {
                          setEditingKid(m as any);
                          setKidEditorOpen(true);
                        } else if ((m as any).type === "visitor") {
                          setEditingVisitor(m as any);
                          setVisitorEditorOpen(true);
                        } else {
                          setEditingMember(m as any);
                          setEditorOpen(true);
                        }
                      }}
                      onSelect={bulkMode ? handleSelectMember : undefined}
                      selected={selectedMembers.has(m.memberId as any)}
                      searchQuery={query}
                    />
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-2xl bg-white/60 backdrop-blur-xl">
                <table className="min-w-full table-auto border-separate border-spacing-y-1 border-spacing-x-0">
                  <thead className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Name
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Phone
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Residence
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Gender
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Last Attendance
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-light tracking-wide text-zinc-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((m, index) => {
                      const wasPresentToday = m.presentToday;
                      return (
                        <tr
                          key={m.memberId as any}
                          className={`transition-colors hover:bg-white/35 ${
                            focusedIndex === index ? "ring-2 ring-amber-400" : ""
                          }`}
                          onClick={() => {
                            if (!bulkMode) {
                              handleViewHistory(m as Member);
                            }
                          }}
                        >
                          <td className="px-5 py-3 text-sm font-light text-zinc-900 rounded-l-xl">
                            <span className="inline-flex items-center gap-2">
                              {bulkMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedMembers.has(m.memberId as any)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleSelectMember(m.memberId as any, e.target.checked);
                                  }}
                                  className="w-4 h-4 rounded border-zinc-300 text-amber-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  wasPresentToday ? "bg-emerald-500" : "bg-zinc-400"
                                }`}
                              />
                              {m.name}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800">
                            {m.contact ?? "-"}
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800">
                            {m.residence ?? "-"}
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800 capitalize">
                            <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900">
                              {m.gender ?? "-"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-800">
                            {m.lastAttendance ? (
                              <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    m.lastAttendance.present ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                <span
                                  className={
                                    m.lastAttendance.present
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {m.lastAttendance.present ? "Present" : "Absent"}
                                </span>
                                <span className="text-zinc-500">
                                  {formatIsoDate(m.lastAttendance.date)}
                                </span>
                              </span>
                            ) : (
                              <span className="italic text-zinc-500">
                                No records
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm rounded-r-xl">
                            <div className="flex justify-end gap-2">
                              <button
                                className={`px-3 py-2 rounded-full text-sm font-light transition-all cursor-pointer hover:scale-105 ${
                                  wasPresentToday
                                    ? "bg-zinc-900/80 text-white hover:bg-zinc-900"
                                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAttendance(m.memberId as any, Boolean(wasPresentToday));
                                }}
                              >
                                {wasPresentToday ? "Unmark" : "Mark Present"}
                              </button>
                              <button
                                className="px-3 py-2 rounded-full text-sm font-light bg-white/60 text-zinc-900 hover:bg-white cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if ((m as any).type === "kid") {
                                    setEditingKid(m as any);
                                    setKidEditorOpen(true);
                                  } else if ((m as any).type === "visitor") {
                                    setEditingVisitor(m as any);
                                    setVisitorEditorOpen(true);
                                  } else {
                                    setEditingMember(m as any);
                                    setEditorOpen(true);
                                  }
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination controls */}
          {searched.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-zinc-700">
              <div>
                Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, searched.length)} of{" "}
                {searched.length}
              </div>
              <div className="flex items-center justify-between md:justify-end gap-2">
                <button
                  className="px-3 py-2 rounded-full bg-white/70 border-zinc-200 text-zinc-900 backdrop-blur border disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  className="px-3 py-2 rounded-full bg-white/70 border-zinc-200 text-zinc-900 backdrop-blur border disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </SignedIn>

      {/* Modals */}
      {editingMember && (
        <MemberEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          member={editingMember}
          onSaved={() => setToast("Member updated")}
        />
      )}
      {editingKid && (
        <KidEditor
          open={kidEditorOpen}
          onClose={() => setKidEditorOpen(false)}
          kid={editingKid}
          onSaved={() => setToast("Kid updated")}
        />
      )}
      {editingVisitor && (
        <VisitorEditor
          open={visitorEditorOpen}
          onClose={() => setVisitorEditorOpen(false)}
          visitor={editingVisitor}
          onSaved={() => setToast("Visitor updated")}
        />
      )}
      {viewingMemberId && (
        <AttendanceHistoryModal
          open={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setViewingMemberId(null);
          }}
          memberId={viewingMemberId}
          memberName={viewingMemberName}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[11000] px-4 py-2 rounded-full bg-emerald-500 text-white text-sm shadow-lg animate-in slide-in-from-top">
          {toast}
        </div>
      )}
    </div>
  );
}

function HighlightsPanel({
  dateStr,
  dateIso,
  total,
  present,
  visitors,
  presentVisitors,
  tab,
}: {
  dateStr: string;
  dateIso: string;
  total: number;
  present: number;
  visitors: number;
  presentVisitors: number;
  tab: string;
}) {
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  const absent = total - present;
  const totalAttendance = present + presentVisitors;
  return (
    <div className="rounded-2xl p-4 md:p-5 bg-zinc-900/90 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
            {dateStr}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
            Members: {total}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
            Present: {present}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
            Visitors: {visitors}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">
            Total Attendance: {totalAttendance}
          </span>
        </div>
        <div className="w-full sm:w-auto">
          {tab === "kids" ? (
            <QuickAddKid dateIso={dateIso} />
          ) : tab === "visitors" ? (
            <QuickAddVisitor dateIso={dateIso} />
          ) : (
            <QuickAddMember dateIso={dateIso} />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-8">
          <Stat label="Members Present" value={`${present} / ${total}`} />
          <Stat label="Visitors" value={`${presentVisitors}`} />
          <Stat label="Absent" value={`${absent}`} />
        </div>
        <div className="flex-1 max-w-xl">
          <div className="text-sm mb-1">ATTENDANCE RATE</div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${rate}%` }}
            />
          </div>
          <div className="text-xs mt-1">{rate}%</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/70">{label}</span>
      <span className="text-xl font-medium">{value}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-3xl">{icon}</div>
      <div className="text-zinc-900">{title}</div>
      <div className="text-sm text-zinc-600">
        {description}
      </div>
    </div>
  );
}
