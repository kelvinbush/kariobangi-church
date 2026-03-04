"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Dashboard Color Palette
const colors = {
  bg: '#faf9f6',
  card: '#ffffff',
  border: '#e8e4df',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5c5a56',
    muted: '#9a9590',
  },
  
  accent: '#8b7355',
  success: '#5a7a5a',
  warning: '#b8a050',
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
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.card, borderBottom: `1px solid ${colors.border}` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
            {myCluster?.name || "My Cluster"}
          </span>
          <Link 
            href="/" 
            className="text-sm"
            style={{ color: colors.text.secondary }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              Please sign in to access your cluster
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-6 py-2.5 text-sm border rounded"
                style={{ borderColor: colors.text.primary, color: colors.text.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: colors.text.primary }}>
                    {memberCount}
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Members
                  </p>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: colors.text.primary }}>
                    —
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Present
                  </p>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <p className="text-2xl font-semibold mb-1" style={{ color: colors.warning }}>
                    —
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Absent
                  </p>
                </div>
                <Link 
                  href="/cluster-head/follow-ups"
                  className="p-4 rounded-lg border flex flex-col justify-center items-center hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: colors.accent, borderColor: colors.accent }}
                >
                  <span className="text-sm font-medium" style={{ color: '#fff' }}>
                    Follow-ups
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {formatIsoDate(lastSunday)}
                  </span>
                </Link>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mb-6">
                <Link
                  href="/cluster-head/follow-ups"
                  className="flex-1 py-3 px-4 rounded-lg border text-center text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.text.primary }}
                >
                  Submit Follow-ups
                </Link>
              </div>

              {/* Members Table */}
              <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                {/* Table Header */}
                <div 
                  className="grid grid-cols-12 gap-4 px-4 py-3 text-xs uppercase tracking-wide"
                  style={{ 
                    backgroundColor: colors.bg,
                    color: colors.text.muted,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <div className="col-span-6 sm:col-span-5">Name</div>
                  <div className="col-span-4 sm:col-span-4 hidden sm:block">Contact</div>
                  <div className="col-span-6 sm:col-span-3 text-right">Info</div>
                </div>

                {/* Table Body */}
                {myCluster.members && myCluster.members.length > 0 ? (
                  myCluster.members.map((member: Member) => (
                    <div 
                      key={member._id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 items-center"
                      style={{ borderBottom: `1px solid ${colors.border}` }}
                    >
                      <div className="col-span-6 sm:col-span-5">
                        <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                          {member.name}
                        </span>
                      </div>
                      <div className="col-span-4 sm:col-span-4 hidden sm:block">
                        {member.contact ? (
                          <a 
                            href={`tel:${member.contact}`}
                            className="text-sm hover:opacity-70 transition-opacity"
                            style={{ color: colors.accent }}
                          >
                            {member.contact}
                          </a>
                        ) : (
                          <span className="text-sm" style={{ color: colors.text.muted }}>—</span>
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-3 text-right">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="text-xs px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
                          style={{ borderColor: colors.border, color: colors.text.secondary }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm" style={{ color: colors.text.secondary }}>
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
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full max-w-sm rounded-lg overflow-hidden"
            style={{ backgroundColor: colors.card }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              <h3 className="text-base font-medium" style={{ color: colors.text.primary }}>
                {selectedMember.name}
              </h3>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-1.5 hover:opacity-70 transition-opacity"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={colors.text.secondary} strokeWidth="1.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedMember.contact && (
                <div>
                  <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>
                    Contact
                  </p>
                  <a 
                    href={`tel:${selectedMember.contact}`}
                    className="text-sm flex items-center gap-2"
                    style={{ color: colors.accent }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 5a2 2 0 012-2h1.28a1 1 0 01.948.684l.548 1.644a1 1 0 01-.577 1.213l-.876.389a11.03 11.03 0 005.068 5.069l.388-.876a1 1 0 011.213-.577l1.644.548A1 1 0 0113 12.72V14a2 2 0 01-2 2C6.82 16 1 10.18 1 4a2 2 0 012-2h0z" />
                    </svg>
                    {selectedMember.contact}
                  </a>
                </div>
              )}
              {selectedMember.residence && (
                <div>
                  <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>
                    Residence
                  </p>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
                    {selectedMember.residence}
                  </p>
                </div>
              )}
              {selectedMember.gender && (
                <div>
                  <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: colors.text.muted }}>
                    Gender
                  </p>
                  <p className="text-sm" style={{ color: colors.text.primary }}>
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

function getLastSunday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day;
  const lastSunday = new Date(today.setDate(diff));
  return lastSunday.toISOString().split("T")[0];
}

function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
