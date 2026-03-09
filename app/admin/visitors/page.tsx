"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate } from "@/lib/date";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
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
    sageLight: '#c5d4be',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
    purple: '#9b8cb8',
    purpleLight: '#d4cbe5',
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

export default function AdminVisitorsPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "firstTime" | "returning">("all");
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [isGraduating, setIsGraduating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Queries
  const visitors = useQuery(
    api.visitors.listWithAttendance,
    isAuthenticated ? {} : "skip"
  );

  // Mutations
  const graduateVisitor = useMutation(api.visitors.graduateToMember);

  // Filter and search visitors
  const filteredVisitors = useMemo(() => {
    let result = visitors || [];

    // Apply type filter
    if (filter === "firstTime") {
      result = result.filter((v: any) => !v.isReturning);
    } else if (filter === "returning") {
      result = result.filter((v: any) => v.isReturning);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((v: any) =>
        v.name.toLowerCase().includes(query) ||
        (v.contact && v.contact.toLowerCase().includes(query)) ||
        (v.residence && v.residence.toLowerCase().includes(query))
      );
    }

    return result;
  }, [visitors, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const all = visitors || [];
    return {
      total: all.length,
      firstTime: all.filter((v: any) => !v.isReturning).length,
      returning: all.filter((v: any) => v.isReturning).length,
      readyToGraduate: all.filter((v: any) => v.attendanceCount >= 4).length,
    };
  }, [visitors]);

  const handleGraduate = async () => {
    if (!selectedVisitor) return;

    setIsGraduating(true);
    try {
      await graduateVisitor({
        visitorId: selectedVisitor._id,
        department: department || undefined,
        status: status || undefined,
      });
      setSuccessMessage(`${selectedVisitor.name} has been graduated to a member!`);
      setShowGraduateModal(false);
      setSelectedVisitor(null);
      setDepartment("");
      setStatus("");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to graduate visitor");
    } finally {
      setIsGraduating(false);
    }
  };

  const getVisitorTypeLabel = (visitor: any) => {
    if (visitor.isReturning) return "Returning Visitor";
    return "First-time Visitor";
  };

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
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm px-3 py-1.5 rounded-full"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              Dashboard
            </Link>
            <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
              Visitors Management
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-5 py-8 pb-24">
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-light mb-1" style={{ color: colors.text.primary }}>
              All Visitors
            </h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Manage visitors and graduate them to members
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div 
              className="p-4 rounded-xl mb-6"
              style={{ backgroundColor: colors.accent.sageLight }}
            >
              <p className="text-sm" style={{ color: colors.accent.sage }}>
                {successMessage}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div 
              className="p-4 rounded-2xl text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-3xl font-light mb-1" style={{ color: colors.text.primary }}>
                {stats.total}
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>Total</div>
            </div>
            <div 
              className="p-4 rounded-2xl text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-3xl font-light mb-1" style={{ color: colors.accent.amber }}>
                {stats.firstTime}
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>First-time</div>
            </div>
            <div 
              className="p-4 rounded-2xl text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-3xl font-light mb-1" style={{ color: colors.accent.purple }}>
                {stats.returning}
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>Returning</div>
            </div>
            <div 
              className="p-4 rounded-2xl text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-3xl font-light mb-1" style={{ color: colors.accent.sage }}>
                {stats.readyToGraduate}
              </div>
              <div className="text-xs" style={{ color: colors.text.muted }}>Ready to Graduate</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitors..."
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: colors.surface, color: colors.text.primary }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: colors.surface, color: colors.text.primary }}
            >
              <option value="all">All Visitors</option>
              <option value="firstTime">First-time Only</option>
              <option value="returning">Returning Only</option>
            </select>
          </div>

          {/* Visitors List */}
          <div className="space-y-2">
            {filteredVisitors.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                No visitors found
              </div>
            ) : (
              filteredVisitors.map((visitor: any) => (
                <div
                  key={visitor._id}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {visitor.name}
                        </span>
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ 
                            backgroundColor: visitor.isReturning 
                              ? colors.accent.purpleLight 
                              : colors.accent.amberLight,
                            color: visitor.isReturning 
                              ? colors.accent.purple 
                              : colors.accent.amber
                          }}
                        >
                          {getVisitorTypeLabel(visitor)}
                        </span>
                        {visitor.attendanceCount >= 4 && (
                          <span 
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: colors.accent.sageLight,
                              color: colors.accent.sage
                            }}
                          >
                            Ready to Graduate
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        {visitor.attendanceCount} Sunday visits
                        {visitor.lastVisit && ` • Last: ${formatIsoDate(visitor.lastVisit)}`}
                      </div>
                      <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                        {visitor.contact || "No contact"}
                        {visitor.residence && ` • ${visitor.residence}`}
                      </div>
                      {(visitor.relationshipStatus || visitor.previousChurch) && (
                        <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                          {visitor.relationshipStatus && `Status: ${visitor.relationshipStatus}`}
                          {visitor.relationshipStatus && visitor.previousChurch && " • "}
                          {visitor.previousChurch && `From: ${visitor.previousChurch}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedVisitor(visitor);
                          setShowGraduateModal(true);
                        }}
                        disabled={isGraduating}
                        className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50"
                        style={{ 
                          backgroundColor: colors.accent.sageLight,
                          color: colors.accent.sage
                        }}
                      >
                        Graduate
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* Graduate Modal */}
        {showGraduateModal && selectedVisitor && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="mb-4">
                <h3 className="text-sm font-medium" style={{ color: colors.text.primary }}>
                  Graduate to Member
                </h3>
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                  {selectedVisitor.name} will become a church member
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: colors.text.muted }}>
                    Department (optional)
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Worship, Ushering"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                  />
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: colors.text.muted }}>
                    Status (optional)
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                  >
                    <option value="">Select status...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Youth">Youth</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowGraduateModal(false);
                    setSelectedVisitor(null);
                    setDepartment("");
                    setStatus("");
                  }}
                  className="flex-1 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGraduate}
                  disabled={isGraduating}
                  className="flex-1 py-3 rounded-xl text-sm disabled:opacity-50"
                  style={{ backgroundColor: colors.accent.sage, color: '#fff' }}
                >
                  {isGraduating ? 'Graduating...' : 'Graduate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
