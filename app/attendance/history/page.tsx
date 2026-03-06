"use client";

import Link from "next/link";
import { SignedIn } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";

export default function AttendanceHistoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const rollCalls = useQuery(
    api.attendance.recentRollCalls,
    isAuthenticated ? { limit: 30 } : "skip"
  );

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <div className="backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-zinc-900 font-light tracking-tight text-xl">Attendance History</div>
              <div className="text-xs text-zinc-600">Browse previous roll calls</div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
              >
                Dashboard
              </Link>
              <Link
                href="/attendance"
                className="inline-flex px-3 py-1.5 rounded-full bg-zinc-900/90 text-white hover:bg-zinc-900 text-xs sm:text-sm"
              >
                Mark Attendance
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            {(rollCalls ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-600">No roll calls yet.</div>
            ) : (
              <ul className="divide-y divide-white/60">
                {(rollCalls ?? []).map((rc) => (
                  <li key={rc.date} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-900">{formatIsoDate(rc.date)}</div>
                      <div className="text-xs text-zinc-600">
                        Total present: {rc.present}
                      </div>
                    </div>
                    <Link
                      href={`/attendance/history/${encodeURIComponent(rc.date)}`}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-amber-300 text-zinc-900 text-xs sm:text-sm"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </div>
  );
}
