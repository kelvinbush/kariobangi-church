"use client";

import { useMemo, useState } from "react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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

// Copy phone numbers button component
function CopyPhoneNumbersButton({ people }: { people: Person[] }) {
  const [copied, setCopied] = useState(false);

  const copyPhoneNumbers = async () => {
    // Filter out kids and those without phone numbers
    const phoneNumbers = people
      .filter((p) => p.type !== "kid" && p.contact && p.contact.trim() !== "")
      .map((p) => p.contact!.trim());

    if (phoneNumbers.length === 0) return;

    // Join with commas for easy pasting
    const text = phoneNumbers.join(", ");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const eligibleCount = people.filter(
    (p) => p.type !== "kid" && p.contact && p.contact.trim() !== ""
  ).length;

  return (
    <button
      onClick={copyPhoneNumbers}
      disabled={eligibleCount === 0}
      className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
      style={{
        backgroundColor: copied ? colors.accent.sageLight : colors.surface,
        color: copied ? colors.accent.sage : colors.text.secondary,
      }}
      title={eligibleCount > 0 ? `Copy ${eligibleCount} phone number${eligibleCount !== 1 ? 's' : ''}` : 'No phone numbers available'}
    >
      {copied ? "Copied!" : `Copy Numbers (${eligibleCount})`}
    </button>
  );
}

type PersonType = "member" | "kid" | "visitor" | "returningVisitor";

type Person = {
  _id: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  active: boolean;
  type: PersonType;
  age?: number | null;
  // Visitor-specific fields
  relationshipStatus?: string | null;
  previousChurch?: string | null;
  date?: string;
  attendanceCount?: number;
};

export default function MasterListPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PersonType>("all");

  const members = useQuery(api.members.list, isAuthenticated ? { active: undefined } : "skip");
  const kids = useQuery(api.kids.list, isAuthenticated ? { active: undefined } : "skip");
  const visitors = useQuery(api.visitors.list, isAuthenticated ? {} : "skip");
  const visitorAttendanceCounts = useQuery(api.attendance.visitorAttendanceCounts, isAuthenticated ? {} : "skip");

  // Combine and filter
  const filteredPeople = useMemo(() => {
    // Create a map of visitor attendance counts
    const countMap = new Map<string, number>();
    visitorAttendanceCounts?.forEach((v: any) => {
      countMap.set(v.visitorId, v.count);
    });

    const allPeople: Person[] = [
      ...(members || []).map((m: any) => ({ 
        ...m, 
        type: "member" as const 
      })),
      ...(kids || []).map((k: any) => ({ 
        ...k, 
        type: "kid" as const, 
        gender: null, 
        department: null, 
        status: null 
      })),
      ...(visitors || []).map((v: any) => {
        const attendanceCount = countMap.get(v._id) || 0;
        // Visitors with 4+ attendances are "returning visitors"
        const isReturning = attendanceCount >= 4;
        return {
          ...v,
          type: isReturning ? "returningVisitor" as const : "visitor" as const,
          gender: null,
          department: null,
          status: null,
          attendanceCount,
        };
      }),
    ];

    return allPeople
      .filter((person) => {
        // Search
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const searchable = `${person.name} ${person.contact} ${person.residence} ${person.department || ""} ${person.status || ""}`.toLowerCase();
          if (!searchable.includes(query)) return false;
        }
        // Type filter
        if (typeFilter !== "all" && person.type !== typeFilter) return false;
        // Active filter
        if (activeFilter === "active" && !person.active) return false;
        if (activeFilter === "inactive" && person.active) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, kids, visitors, visitorAttendanceCounts, searchQuery, typeFilter, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const countMap = new Map<string, number>();
    visitorAttendanceCounts?.forEach((v: any) => {
      countMap.set(v.visitorId, v.count);
    });

    const visitorList = (visitors || []).map((v: any) => ({
      ...v,
      attendanceCount: countMap.get(v._id) || 0,
      isReturning: (countMap.get(v._id) || 0) >= 4,
    }));

    return {
      total: (members || []).length + (kids || []).length + (visitors || []).length,
      members: (members || []).length,
      kids: (kids || []).length,
      visitors: visitorList.filter((v: any) => !v.isReturning).length,
      returningVisitors: visitorList.filter((v: any) => v.isReturning).length,
    };
  }, [members, kids, visitors, visitorAttendanceCounts]);

  // Export CSV using the same format as attendance history visitors export
  const exportToCSV = () => {
    if (filteredPeople.length === 0) return;
    
    // Get today's date for the prefix
    const prefix = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    
    // Same headers as the attendance history visitors export
    const headers = ["Name Prefix", "First Name", "Phone 1 - Value", "Address 1 - Street", "Notes"];
    
    const rows = filteredPeople.map((p) => {
      // Build notes based on person type
      const notesParts = [];
      if (p.type === "member") {
        if (p.status) notesParts.push(`Status: ${p.status}`);
        if (p.department) notesParts.push(`Dept: ${p.department}`);
        notesParts.push("Type: Member");
      } else if (p.type === "kid") {
        notesParts.push("Type: Kid");
        if (p.age) notesParts.push(`Age: ${p.age}`);
      } else if (p.type === "visitor") {
        if (p.relationshipStatus) notesParts.push(`Status: ${p.relationshipStatus}`);
        if (p.previousChurch) notesParts.push(`From: ${p.previousChurch}`);
        notesParts.push("Type: First-time Visitor");
      } else if (p.type === "returningVisitor") {
        if (p.relationshipStatus) notesParts.push(`Status: ${p.relationshipStatus}`);
        if (p.previousChurch) notesParts.push(`From: ${p.previousChurch}`);
        notesParts.push(`Type: Returning Visitor (${p.attendanceCount || 0} visits)`);
      }
      
      return [
        prefix,
        p.name || "",
        p.contact || "",
        p.residence || "",
        notesParts.join(" | "),
      ];
    });
    
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `master-list-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Get type label for display
  const getTypeLabel = (type: PersonType) => {
    switch (type) {
      case "member": return "Member";
      case "kid": return "Kid";
      case "visitor": return "Visitor";
      case "returningVisitor": return "Returning Visitor";
      default: return type;
    }
  };

  // Get current type filter label
  const getTypeFilterLabel = () => {
    switch (typeFilter) {
      case "all": return "All types";
      case "member": return "Members";
      case "kid": return "Kids";
      case "visitor": return "Visitors";
      case "returningVisitor": return "Returning Visitors";
      default: return "All types";
    }
  };

  // Cycle through type filters
  const cycleTypeFilter = () => {
    const types: ("all" | PersonType)[] = ["all", "member", "kid", "visitor", "returningVisitor"];
    const currentIndex = types.indexOf(typeFilter);
    const nextIndex = (currentIndex + 1) % types.length;
    setTypeFilter(types[nextIndex]);
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
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            Master List
          </span>
          <div className="flex items-center gap-3">
            <CopyPhoneNumbersButton people={filteredPeople} />
            <button
              onClick={exportToCSV}
              disabled={filteredPeople.length === 0}
              className="text-xs px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
              style={{ 
                backgroundColor: colors.surface,
                color: colors.text.secondary
              }}
            >
              Export
            </button>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Stats - Compact Grid */}
          <div 
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div 
                  className="text-3xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.total}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Total
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-3xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.members}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Members
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-3xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.kids}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Kids
                </div>
              </div>
              <div className="text-center">
                <div 
                  className="text-3xl font-light mb-1"
                  style={{ color: colors.accent.amber }}
                >
                  {stats.visitors + stats.returningVisitors}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Visitors
                </div>
              </div>
            </div>
            {/* Visitor breakdown */}
            <div 
              className="flex justify-center gap-6 mt-3 pt-3"
              style={{ borderTop: `1px solid rgba(61, 58, 54, 0.08)` }}
            >
              <div className="text-center">
                <span className="text-lg font-light" style={{ color: colors.text.primary }}>{stats.visitors}</span>
                <span className="text-xs ml-1" style={{ color: colors.text.muted }}>First-time</span>
              </div>
              <div className="text-center">
                <span className="text-lg font-light" style={{ color: colors.text.primary }}>{stats.returningVisitors}</span>
                <span className="text-xs ml-1" style={{ color: colors.text.muted }}>Returning</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search everyone..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ 
                backgroundColor: colors.surface,
                color: colors.text.primary
              }}
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={cycleTypeFilter}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{ 
                backgroundColor: typeFilter === "all" ? colors.surface : colors.accent.amberLight,
                color: typeFilter === "all" ? colors.text.secondary : colors.accent.amber
              }}
            >
              {getTypeFilterLabel()}
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "all" ? "active" : activeFilter === "active" ? "inactive" : "all")}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{ 
                backgroundColor: activeFilter === "all" ? colors.surface : activeFilter === "active" ? colors.accent.sageLight : colors.accent.terracottaLight,
                color: activeFilter === "all" ? colors.text.secondary : activeFilter === "active" ? colors.accent.sage : colors.accent.terracotta
              }}
            >
              {activeFilter === "all" ? "All status" : activeFilter === "active" ? "Active" : "Inactive"}
            </button>
            {(searchQuery || typeFilter !== "all" || activeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setActiveFilter("all");
                }}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{ color: colors.text.muted }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="mb-4">
            <span className="text-xs" style={{ color: colors.text.muted }}>
              {filteredPeople.length} result{filteredPeople.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* People List */}
          <div className="space-y-2">
            {filteredPeople.length === 0 ? (
              <div 
                className="py-12 text-center text-sm"
                style={{ color: colors.text.muted }}
              >
                No results found
              </div>
            ) : (
              filteredPeople.map((person) => (
                <div
                  key={person._id}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="text-sm"
                          style={{ color: colors.text.primary }}
                        >
                          {person.name}
                        </span>
                        {/* Type badge */}
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ 
                            backgroundColor: 
                              person.type === "member" ? colors.accent.sageLight : 
                              person.type === "kid" ? colors.accent.terracottaLight :
                              person.type === "returningVisitor" ? colors.accent.amberLight :
                              colors.surfaceHover,
                            color: 
                              person.type === "member" ? colors.accent.sage : 
                              person.type === "kid" ? colors.accent.terracotta :
                              person.type === "returningVisitor" ? colors.accent.amber :
                              colors.text.secondary
                          }}
                        >
                          {getTypeLabel(person.type)}
                        </span>
                        {!person.active && (
                          <span 
                            className="text-xs"
                            style={{ color: colors.text.muted }}
                          >
                            (inactive)
                          </span>
                        )}
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: colors.text.muted }}
                      >
                        {person.type === "member" && person.status}
                        {person.type === "kid" && "Kid"}
                        {person.type === "visitor" && "First-time visitor"}
                        {person.type === "returningVisitor" && `Returning visitor (${person.attendanceCount} visits)`}
                        {person.contact && ` • ${person.contact}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {person.residence && (
                        <span 
                          className="text-xs hidden sm:block"
                          style={{ color: colors.text.secondary }}
                        >
                          {person.residence}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
