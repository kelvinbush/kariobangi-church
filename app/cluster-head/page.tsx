"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Luxury Color Palette - Warm, muted, earth-toned
const palette = {
  canvas: '#faf9f6',
  surface: '#ffffff',
  muted: '#f5f3ef',
  
  primary: '#1a1a1a',
  secondary: '#6b6560',
  tertiary: '#9a9590',
  
  accent: '#8b7355',
  accentLight: '#c4b5a0',
  
  border: '#e8e4df',
  divider: '#f0ece6',
  
  success: '#6b8e6b',
  attention: '#b87070',
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

  const absentCount = myCluster?.members?.length ? myCluster.members.length - (myCluster.memberCount || 0) : 0;
  const pendingCount = 0; // Would need to query actual pending count

  const lastSunday = getLastSunday();

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.canvas }}>
      {/* Header */}
      <header style={{ backgroundColor: palette.surface }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-base tracking-wide" style={{ color: palette.primary }}>
            {myCluster?.name || "My Cluster"}
          </span>
          <Link 
            href="/" 
            className="text-sm tracking-wide hidden sm:block"
            style={{ color: palette.tertiary }}
          >
            Return to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-20 text-center">
            <p className="text-sm mb-8" style={{ color: palette.secondary }}>
              Please sign in to access your cluster
            </p>
            <SignInButton mode="modal">
              <button 
                className="px-8 py-3 text-sm tracking-wide border transition-colors"
                style={{ borderColor: palette.primary, color: palette.primary }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!myCluster ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: palette.secondary }}>
                You are not assigned to a cluster
              </p>
            </div>
          ) : (
            <>
              {/* Page Header */}
              <div className="mb-12">
                <p className="text-xs tracking-wide uppercase mb-2" style={{ color: palette.tertiary }}>
                  {lastSunday}
                </p>
                <h1 className="text-2xl tracking-tight" style={{ color: palette.primary }}>
                  {myCluster.name}
                </h1>
              </div>

              {/* Stats - Inline */}
              <div className="flex gap-8 mb-16 pb-12 border-b" style={{ borderColor: palette.divider }}>
                <div>
                  <p className="text-3xl tracking-tight mb-1" style={{ color: palette.primary }}>
                    {myCluster.members?.length || 0}
                  </p>
                  <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                    Members
                  </p>
                </div>
                <div>
                  <p className="text-3xl tracking-tight mb-1" style={{ color: absentCount > 0 ? palette.attention : palette.primary }}>
                    {absentCount}
                  </p>
                  <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                    Absent
                  </p>
                </div>
                {pendingCount > 0 && (
                  <div>
                    <p className="text-3xl tracking-tight mb-1" style={{ color: palette.attention }}>
                      {pendingCount}
                    </p>
                    <p className="text-xs tracking-wide uppercase" style={{ color: palette.tertiary }}>
                      Pending
                    </p>
                  </div>
                )}
              </div>

              {/* Action Link */}
              <div className="mb-12">
                <Link 
                  href="/cluster-head/follow-ups"
                  className="inline-flex items-center gap-2 text-sm tracking-wide"
                  style={{ color: palette.accent }}
                >
                  Submit Follow-ups
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 12l4-4-4-4" />
                  </svg>
                </Link>
              </div>

              {/* Members List */}
              <div>
                <h2 className="text-sm tracking-wide mb-6" style={{ color: palette.tertiary }}>
                  Members
                </h2>
                
                {myCluster?.members && myCluster.members.length > 0 ? (
                  <div className="space-y-0">
                    {myCluster.members.map((member: Member) => (
                      <button
                        key={member._id}
                        onClick={() => setSelectedMember(member)}
                        className="w-full text-left flex items-center justify-between py-5 border-b group transition-colors"
                        style={{ borderColor: palette.divider }}
                      >
                        <p className="text-base" style={{ color: palette.primary }}>
                          {member.name}
                        </p>
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 16 16" 
                          fill="none" 
                          stroke={palette.tertiary}
                          strokeWidth="1.5"
                        >
                          <path d="M6 12l4-4-4-4" />
                        </svg>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm py-8" style={{ color: palette.secondary }}>
                    No members in cluster
                  </p>
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
          style={{ backgroundColor: 'rgba(26, 26, 26, 0.3)' }}
          onClick={() => setSelectedMember(null)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl overflow-hidden"
            style={{ backgroundColor: palette.surface, maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: palette.divider }}>
              <h3 className="text-base" style={{ color: palette.primary }}>
                {selectedMember.name}
              </h3>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 -mr-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={palette.secondary} strokeWidth="1.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              <div className="space-y-6">
                {selectedMember.contact && (
                  <div>
                    <p className="text-xs tracking-wide uppercase mb-2" style={{ color: palette.tertiary }}>
                      Contact
                    </p>
                    <a 
                      href={`tel:${selectedMember.contact}`}
                      className="text-sm flex items-center gap-2"
                      style={{ color: palette.accent }}
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
                    <p className="text-xs tracking-wide uppercase mb-2" style={{ color: palette.tertiary }}>
                      Residence
                    </p>
                    <p className="text-sm" style={{ color: palette.primary }}>
                      {selectedMember.residence}
                    </p>
                  </div>
                )}
              </div>
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
