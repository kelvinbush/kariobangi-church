"use client";

import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

// Clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  border: '#e8e6e3',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  men: '#5a7a9a',
  women: '#9a5a7a',
  youth: '#5a9a7a',
};

export default function FellowshipPastorDashboard() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-base" style={{ color: theme.text.primary }}>
            Fellowship Pastor
          </span>
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="text-sm"
              style={{ color: theme.text.secondary }}
            >
              Back
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

          {/* Welcome */}
          <div className="mb-6">
            <h1 className="text-lg mb-1" style={{ color: theme.text.primary }}>
              Welcome, Pastor
            </h1>
            <p className="text-sm" style={{ color: theme.text.secondary }}>
              Select a section to view demographics and cluster information
            </p>
          </div>

          {/* Demographics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Youth Men */}
            <Link
              href="/youth/men"
              className="p-5 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${theme.men}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.men} strokeWidth="1.5">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm block mb-1" style={{ color: theme.text.primary }}>
                Youth Men
              </span>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                View members
              </span>
            </Link>

            {/* Youth Ladies */}
            <Link
              href="/youth/ladies"
              className="p-5 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${theme.women}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.women} strokeWidth="1.5">
                  <path d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <span className="text-sm block mb-1" style={{ color: theme.text.primary }}>
                Youth Ladies
              </span>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                View members
              </span>
            </Link>

            {/* Married Men */}
            <Link
              href="/married/men"
              className="p-5 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${theme.men}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.men} strokeWidth="1.5">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm block mb-1" style={{ color: theme.text.primary }}>
                Married Men
              </span>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                View members
              </span>
            </Link>

            {/* Married Women */}
            <Link
              href="/married/women"
              className="p-5 rounded-xl border text-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${theme.women}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.women} strokeWidth="1.5">
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <span className="text-sm block mb-1" style={{ color: theme.text.primary }}>
                Married Women
              </span>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                View members
              </span>
            </Link>
          </div>

          {/* Clusters Section */}
          <div className="mb-6">
            <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
              Clusters
            </span>
            <Link
              href="/cluster-admin"
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${theme.accent}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.5">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-sm block" style={{ color: theme.text.primary }}>
                  View All Clusters
                </span>
                <span className="text-xs" style={{ color: theme.text.muted }}>
                  Monitor cluster progress and follow-ups
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* My Cluster (if also a cluster head) */}
          <div>
            <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
              My Duties
            </span>
            <Link
              href="/cluster-head"
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${theme.youth}15` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.youth} strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-sm block" style={{ color: theme.text.primary }}>
                  My Cluster Dashboard
                </span>
                <span className="text-xs" style={{ color: theme.text.muted }}>
                  Submit follow-ups and manage members
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
      </main>
    </div>
  );
}
