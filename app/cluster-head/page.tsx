"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getLastSunday, formatIsoDate } from "@/lib/date";

// ClickUp-inspired color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  borderLight: '#f0eeeb',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  accentLight: 'rgba(124, 111, 90, 0.1)',
};

interface Member {
  _id: Id<"members">;
  name: string;
  contact: string | null;
  gender: string | null;
  residence: string | null;
}

export default function ClusterHeadDashboard() {
  const { isAuthenticated } = useConvexAuth();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const myCluster = useQuery(
    api.clusters.myCluster,
    isAuthenticated ? {} : "skip"
  );

  const lastSunday = getLastSunday();
  const memberCount = myCluster?.members?.length || 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: theme.accentLight, color: theme.accent }}
            >
              {myCluster?.name?.charAt(0) || 'C'}
            </div>
            <div>
              <span className="text-sm font-semibold block" style={{ color: theme.text.primary }}>
                {myCluster?.name || "My Cluster"}
              </span>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                {memberCount} members
              </span>
            </div>
          </div>
          <Link 
            href="/" 
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: theme.text.secondary }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to access your cluster
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm font-medium rounded-lg border transition-all hover:shadow-sm"
                style={{ borderColor: theme.text.primary, color: theme.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Quick Actions Bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/cluster-head/follow-ups"
                  className="flex-1 p-4 rounded-xl border transition-all hover:shadow-md group"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                        style={{ backgroundColor: theme.accentLight }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                        Submit Follow-ups
                      </h3>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                        {formatIsoDate(lastSunday)}
                      </p>
                    </div>
                    <svg 
                      width="20" height="20" viewBox="0 0 24 24" 
                      fill="none" 
                      stroke={theme.text.muted} 
                      strokeWidth="2"
                      className="group-hover:translate-x-1 transition-transform"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                <div 
                  className="flex-1 p-4 rounded-xl border"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                        style={{ backgroundColor: theme.bg }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.text.secondary} strokeWidth="2">
                          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                        {memberCount}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: theme.text.muted }}>
                        Total Members
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div 
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                {/* List Header */}
                <div 
                  className="px-4 py-3 flex items-center gap-4 border-b"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex-1 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Member
                  </div>
                  <div className="w-32 hidden sm:block text-xs font-semibold uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Contact
                  </div>
                  <div className="w-24 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.text.muted }}>
                    Info
                  </div>
                </div>

                {/* List Items */}
                {myCluster.members && myCluster.members.length > 0 ? (
                  myCluster.members.map((member: Member) => (
                    <div 
                      key={member._id}
                      className="px-4 py-3 flex items-center gap-4 border-b last:border-b-0 cursor-pointer"
                      style={{ borderColor: theme.borderLight }}
                      onClick={() => setSelectedMember(member)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.surfaceHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.surface}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: theme.bg, color: theme.text.secondary }}
                          >
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium truncate" style={{ color: theme.text.primary }}>
                            {member.name}
                          </span>
                        </div>
                      </div>

                      <div className="w-32 hidden sm:block">
                        {member.contact ? (
                          <a 
                            href={`tel:${member.contact}`}
                            className="text-sm hover:underline truncate block"
                            style={{ color: theme.accent }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {member.contact}
                          </a>
                        ) : (
                          <span className="text-sm" style={{ color: theme.text.muted }}>—</span>
                        )}
                      </div>

                      <div className="w-24">
                        <button
                          className="text-xs px-3 py-1.5 rounded-md border transition-all hover:shadow-sm"
                          style={{ borderColor: theme.border, color: theme.text.secondary }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = theme.accent;
                            e.currentTarget.style.color = theme.accent;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = theme.border;
                            e.currentTarget.style.color = theme.text.secondary;
                          }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm" style={{ color: theme.text.secondary }}>
                      No members in cluster
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SignedIn>
      </main>

      {/* Member Detail Modal */}
      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: theme.bg, color: theme.text.secondary }}
                >
                  {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-base font-semibold" style={{ color: theme.text.primary }}>
                  {selectedMember.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: theme.text.secondary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bg}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedMember.contact && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Contact
                  </label>
                  <a 
                    href={`tel:${selectedMember.contact}`}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: theme.accent }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {selectedMember.contact}
                  </a>
                </div>
              )}
              
              {selectedMember.residence && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Residence
                  </label>
                  <p className="text-sm" style={{ color: theme.text.primary }}>
                    {selectedMember.residence}
                  </p>
                </div>
              )}
              
              {selectedMember.gender && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                    Gender
                  </label>
                  <p className="text-sm" style={{ color: theme.text.primary }}>
                    {selectedMember.gender}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
