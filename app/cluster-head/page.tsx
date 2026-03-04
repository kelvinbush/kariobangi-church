"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getLastSunday, formatIsoDate } from "@/lib/date";

// Clean, readable color palette
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
  accentLight: '#f5f3ef',
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
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: theme.text.primary }}>
            {myCluster?.name || "My Cluster"}
          </h1>
          <Link 
            href="/" 
            className="text-sm"
            style={{ color: theme.text.secondary }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-base mb-6" style={{ color: theme.text.secondary }}>
              Please sign in to access your cluster
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-3 text-base font-medium rounded-xl border"
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
              <p className="text-base" style={{ color: theme.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Quick Action Card */}
              <Link
                href="/cluster-head/follow-ups"
                className="block p-5 rounded-2xl border mb-4"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: theme.accentLight }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: theme.text.primary }}>
                        Submit Follow-ups
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: theme.text.muted }}>
                        {formatIsoDate(lastSunday)}
                      </p>
                    </div>
                  </div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              {/* Stats Card */}
              <div 
                className="p-5 rounded-2xl border mb-6"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: theme.bg }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.text.secondary} strokeWidth="2">
                      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-bold" style={{ color: theme.text.primary }}>
                      {memberCount}
                    </p>
                    <p className="text-sm" style={{ color: theme.text.muted }}>
                      Total Members
                    </p>
                  </div>
                </div>
              </div>

              {/* Members Header */}
              <h2 className="text-sm font-bold uppercase tracking-wide mb-3 px-1" style={{ color: theme.text.muted }}>
                Members
              </h2>

              {/* Member Cards */}
              <div className="space-y-3">
                {myCluster.members && myCluster.members.length > 0 ? (
                  myCluster.members.map((member: Member) => (
                    <button
                      key={member._id}
                      onClick={() => setSelectedMember(member)}
                      className="w-full p-4 rounded-2xl border text-left"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar with initials */}
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                          style={{ backgroundColor: theme.bg, color: theme.text.secondary }}
                        >
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        
                        {/* Name and contact */}
                        <div className="flex-1 min-w-0">
                          <h3 
                            className="text-lg font-semibold truncate"
                            style={{ color: theme.text.primary }}
                          >
                            {member.name}
                          </h3>
                          {member.contact ? (
                            <a 
                              href={`tel:${member.contact}`}
                              className="text-sm truncate block mt-0.5"
                              style={{ color: theme.accent }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {member.contact}
                            </a>
                          ) : (
                            <span className="text-sm mt-0.5 block" style={{ color: theme.text.muted }}>
                              No contact
                            </span>
                          )}
                        </div>

                        {/* Arrow */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.text.muted} strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-base" style={{ color: theme.text.secondary }}>
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-5 flex items-center gap-4 border-b"
              style={{ borderColor: theme.border }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: theme.bg, color: theme.text.secondary }}
              >
                {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold truncate" style={{ color: theme.text.primary }}>
                  {selectedMember.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2"
                style={{ color: theme.text.secondary }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {selectedMember.contact && (
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: theme.text.muted }}>
                    Contact
                  </label>
                  <a 
                    href={`tel:${selectedMember.contact}`}
                    className="flex items-center gap-2 text-lg"
                    style={{ color: theme.accent }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {selectedMember.contact}
                  </a>
                </div>
              )}
              
              {selectedMember.residence && (
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: theme.text.muted }}>
                    Residence
                  </label>
                  <p className="text-lg" style={{ color: theme.text.primary }}>
                    {selectedMember.residence}
                  </p>
                </div>
              )}
              
              {selectedMember.gender && (
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: theme.text.muted }}>
                    Gender
                  </label>
                  <p className="text-lg" style={{ color: theme.text.primary }}>
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
