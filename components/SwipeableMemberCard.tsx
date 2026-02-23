"use client";

import { useState, useRef, useEffect } from "react";
import { formatIsoDate } from "@/lib/date";

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
  age?: number | null;
  type?: "member" | "kid" | "visitor" | "returningVisitor";
  presentToday: boolean;
  lastAttendance: { date: string; present: boolean } | null;
  sundayCount?: number;
};

type Props = {
  member: Member;
  onToggleAttendance: (memberId: string, isPresent: boolean) => Promise<void>;
  onEdit: () => void;
  onSelect?: (memberId: string, selected: boolean) => void;
  selected?: boolean;
  searchQuery?: string;
};

export default function SwipeableMemberCard({
  member,
  onToggleAttendance,
  onEdit,
  onSelect,
  selected = false,
  searchQuery = "",
}: Props) {
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isMarking, setIsMarking] = useState(false);
  const [justMarked, setJustMarked] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 80;

  // Haptic feedback helper
  const triggerHaptic = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  // Highlight search terms
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let highlighted = text;
    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      highlighted = highlighted.replace(
        regex,
        '<mark class="bg-amber-200 text-amber-900 rounded px-0.5">$1</mark>'
      );
    });
    return highlighted;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    // Only allow swiping right (to mark present) or left (to unmark)
    if (member.presentToday) {
      // If present, allow left swipe to unmark
      setSwipeOffset(Math.min(0, deltaX));
    } else {
      // If absent, allow right swipe to mark
      setSwipeOffset(Math.max(0, deltaX));
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      triggerHaptic();
      handleToggleAttendance();
    }
    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  const handleToggleAttendance = async () => {
    if (isMarking) return;
    setIsMarking(true);
    setJustMarked(true);
    triggerHaptic();
    try {
      await onToggleAttendance(member.memberId, member.presentToday);
    } catch (e) {
      // Error handling is done in parent
    } finally {
      setIsMarking(false);
      setTimeout(() => setJustMarked(false), 500);
    }
  };

  const wasPresentToday = member.presentToday;

  return (
    <div
      ref={cardRef}
      className={`relative rounded-2xl bg-white/60 backdrop-blur-xl p-4 transition-all duration-200 ${
        selected ? "ring-2 ring-amber-400 bg-amber-50/60" : ""
      } ${justMarked ? "scale-105 ring-2 ring-emerald-400" : ""} ${
        isMarking ? "opacity-70" : ""
      }`}
      style={{
        transform: isSwiping ? `translateX(${swipeOffset}px)` : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe indicator */}
      {isSwiping && Math.abs(swipeOffset) > 20 && (
        <div
          className={`absolute inset-0 rounded-2xl flex items-center justify-center text-white font-medium ${
            swipeOffset > 0
              ? "bg-emerald-500"
              : swipeOffset < 0
              ? "bg-rose-500"
              : ""
          }`}
          style={{ opacity: Math.min(1, Math.abs(swipeOffset) / SWIPE_THRESHOLD) }}
        >
          {swipeOffset > 0 ? "Mark Present →" : swipeOffset < 0 ? "← Unmark" : ""}
        </div>
      )}

      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute top-2 right-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(member.memberId, e.target.checked);
              triggerHaptic();
            }}
            className="w-5 h-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                wasPresentToday ? "bg-emerald-500" : "bg-zinc-400"
              } ${justMarked ? "scale-150" : ""}`}
            />
            <div
              className="text-sm font-light text-zinc-900 truncate"
              dangerouslySetInnerHTML={{
                __html: highlightText(member.name),
              }}
            />
            {member.type === "returningVisitor" && (() => {
              const count =
                typeof member.sundayCount === "number"
                  ? Math.max(0, member.sundayCount - 1)
                  : 0;
              return (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/80 text-xs text-zinc-900 font-medium">
                  Returning
                  {count > 0 ? ` (${count})` : ""}
                </span>
              );
            })()}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {member.contact ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: highlightText(member.contact),
                }}
              />
            ) : (
              "-"
            )}
            {member.residence && (
              <>
                {" • "}
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlightText(member.residence),
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-white/40 text-xs text-zinc-900 capitalize">
            {member.gender ?? "-"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-700">
          {member.lastAttendance ? (
            <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/40">
              <span
                className={`h-2 w-2 rounded-full ${
                  member.lastAttendance.present ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span
                className={
                  member.lastAttendance.present
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {member.lastAttendance.present ? "Present" : "Absent"}
              </span>
              <span className="text-zinc-500">
                {formatIsoDate(member.lastAttendance.date)}
              </span>
            </span>
          ) : (
            <span className="italic text-zinc-500">No records</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className={`w-full px-3 py-2 rounded-full text-sm font-light transition-all ${
            wasPresentToday
              ? "bg-zinc-900/80 text-white hover:bg-zinc-900 active:scale-95"
              : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95"
          } ${isMarking ? "animate-pulse" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleAttendance();
          }}
          disabled={isMarking}
        >
          {wasPresentToday ? "Unmark" : "Mark Present"}
        </button>
        <button
          className="w-full px-3 py-2 rounded-full text-sm font-light bg-white/70 text-zinc-900 hover:bg-white active:scale-95 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
