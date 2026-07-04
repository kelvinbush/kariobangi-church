"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: {
    primary: '#141414',
    secondary: '#525252',
    muted: '#a1a1a1',
  },
  accent: {
    amber: '#0D9762',
    amberLight: '#a7ddc7',
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

export default function AttendanceHistoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const rollCalls = useQuery(api.attendance.recentRollCalls, isAuthenticated ? { limit: 30 } : "skip");

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
            borderBottom: `1px solid rgba(0, 0, 0, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            History
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/attendance"
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              Mark attendance
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-light mb-1" style={{ color: colors.text.primary }}>
              Past Sundays
            </h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Browse previous roll calls
            </p>
          </div>

          {/* List */}
          <div className="space-y-2">
            {(rollCalls ?? []).length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                No roll calls yet
              </div>
            ) : (
              (rollCalls ?? []).map((rc) => (
                <Link
                  key={rc.date}
                  href={`/attendance/history/${encodeURIComponent(rc.date)}`}
                  className="flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div>
                    <div className="text-sm mb-1" style={{ color: colors.text.primary }}>
                      {formatIsoDate(rc.date)}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      {rc.present} present
                    </div>
                  </div>
                  <span 
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: colors.accent.amberLight, color: colors.accent.amber }}
                  >
                    View
                  </span>
                </Link>
              ))
            )}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
