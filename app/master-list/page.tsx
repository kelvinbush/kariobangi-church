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

type Person = {
  _id: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  active: boolean;
  type: "member" | "kid";
  age?: number | null;
};

export default function MasterListPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "member" | "kid">("all");

  const members = useQuery(api.members.list, isAuthenticated ? { active: undefined } : "skip");
  const kids = useQuery(api.kids.list, isAuthenticated ? { active: undefined } : "skip");

  // Combine and filter
  const filteredPeople = useMemo(() => {
    const allPeople: Person[] = [
      ...(members || []).map((m) => ({ ...m, type: "member" as const })),
      ...(kids || []).map((k) => ({ ...k, type: "kid" as const, gender: null, department: null, status: null })),
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
  }, [members, kids, searchQuery, typeFilter, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const allPeople = [
      ...(members || []),
      ...(kids || []),
    ];
    return {
      total: allPeople.length,
      members: (members || []).length,
      kids: (kids || []).length,
    };
  }, [members, kids]);

  // Export CSV
  const exportToCSV = () => {
    if (filteredPeople.length === 0) return;
    const headers = ["Name", "Type", "Contact", "Residence", "Status", "Active"];
    const rows = filteredPeople.map((p) => [
      p.name,
      p.type,
      p.contact || "",
      p.residence || "",
      p.status || "",
      p.active ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `members-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
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
            Members
          </span>
          <div className="flex items-center gap-3">
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
          {/* Stats - Single Card */}
          <div 
            className="rounded-2xl p-6 mb-6"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center gap-8">
              <div>
                <div 
                  className="text-4xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.total}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Total
                </div>
              </div>
              <div 
                className="w-px h-10"
                style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
              />
              <div>
                <div 
                  className="text-4xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.members}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Members
                </div>
              </div>
              <div 
                className="w-px h-10"
                style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }}
              />
              <div>
                <div 
                  className="text-4xl font-light mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {stats.kids}
                </div>
                <div className="text-xs" style={{ color: colors.text.muted }}>
                  Kids
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ 
                backgroundColor: colors.surface,
                color: colors.text.primary
              }}
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTypeFilter(typeFilter === "all" ? "member" : typeFilter === "member" ? "kid" : "all")}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{ 
                backgroundColor: typeFilter === "all" ? colors.surface : colors.accent.amberLight,
                color: typeFilter === "all" ? colors.text.secondary : colors.accent.amber
              }}
            >
              {typeFilter === "all" ? "All types" : typeFilter === "member" ? "Members" : "Kids"}
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
                No members found
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
                        {person.type === "kid" ? "Kid" : person.status || "Member"}
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
