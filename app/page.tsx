"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { formatIsoDate, getLastSunday } from "@/lib/date";

// Soft, warm color palette
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
    sageLight: '#d4e4c8',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
    blue: '#8fa8c4',
    blueLight: '#d4e0ec',
  }
};

// Subtle background pattern
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

export default function Home() {
  const { isAuthenticated } = useConvexAuth();

  const lastSunday = getLastSunday();

  // Data queries
  const summaries = useQuery(api.attendance.summaries, isAuthenticated ? {} : "skip");
  const lastSundayData = useQuery(api.attendance.lastSundayAttendanceRate, isAuthenticated ? {} : "skip");

  // Get history for recent Sundays
  const sundayHistories = useQuery(
    api.attendance.recentRollCalls,
    isAuthenticated ? { limit: 4 } : "skip"
  );

  const totalMembers = summaries 
    ? summaries.totalMen + summaries.totalWomen + summaries.totalKids 
    : 0;
    
  const lastSundayPresent = lastSundayData?.present || 0;
  const lastSundayVisitors = lastSundayData?.visitorsPresent || 0;
  const lastSundayRate = lastSundayData?.rate || 0;

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header - Same bg as page, subtle border */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            Kariobangi
          </span>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <main 
          className="max-w-2xl mx-auto px-5 py-8 pb-24"
          style={{ color: colors.text.primary }}
        >
          {/* Greeting */}
          <div className="mb-10">
            <p className="text-sm mb-1" style={{ color: colors.text.muted }}>
              {formatIsoDate(lastSunday)}
            </p>
            <h1 className="text-2xl font-light tracking-tight">
              Last Sunday
            </h1>
          </div>

          {/* Main Stats - Single Card */}
          <div 
            className="rounded-2xl p-6 mb-8"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-light tracking-tight">
                {lastSundayPresent + lastSundayVisitors}
              </span>
              <span className="text-sm" style={{ color: colors.text.muted }}>
                present
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm mb-6" style={{ color: colors.text.secondary }}>
              <span>{lastSundayPresent} members</span>
              <span style={{ color: colors.text.muted }}>•</span>
              <span>{lastSundayVisitors} visitors</span>
            </div>

            {/* Attendance Rate Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: colors.text.muted }}>
                <span>Attendance rate</span>
                <span>{lastSundayRate}% of {totalMembers}</span>
              </div>
              <div 
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(201, 168, 124, 0.2)' }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-700"
                  style={{ 
                    width: `${lastSundayRate}%`,
                    backgroundColor: colors.accent.amber
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sunday History */}
          <div className="mb-8">
            <span className="text-sm block mb-4" style={{ color: colors.text.secondary }}>
              Recent Sundays
            </span>
            
            <div className="space-y-2">
              {sundayHistories?.slice(0, 4).map((sunday: any, index: number) => {
                const present = sunday.present;
                const total = sunday.total;
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                const isLastSunday = index === 0;
                
                return (
                  <Link
                    key={sunday.date}
                    href={`/attendance/history/${sunday.date}`}
                    className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                    style={{ 
                      backgroundColor: isLastSunday ? colors.surface : 'transparent',
                    }}
                  >
                    <div 
                      className="w-12 text-sm"
                      style={{ color: colors.text.muted }}
                    >
                      {formatIsoDate(sunday.date).split(' ').slice(0, 2).join(' ')}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{present}</span>
                        <span className="text-xs" style={{ color: colors.text.muted }}>
                          of {total}
                        </span>
                      </div>
                      <div 
                        className="h-1 rounded-full w-full"
                        style={{ backgroundColor: 'rgba(201, 168, 124, 0.15)' }}
                      >
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${rate}%`,
                            backgroundColor: isLastSunday ? colors.accent.amber : colors.accent.amberLight
                          }}
                        />
                      </div>
                    </div>
                    
                    <div 
                      className="text-xs w-10 text-right"
                      style={{ color: colors.text.muted }}
                    >
                      {rate}%
                    </div>
                  </Link>
                );
              })}
              
              {(!sundayHistories || sundayHistories.length === 0) && (
                <div 
                  className="p-4 rounded-xl text-center text-sm"
                  style={{ color: colors.text.muted }}
                >
                  No Sunday history yet
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </AuthenticatedLayout>
  );
}
