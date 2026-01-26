"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/date";

type Member = {
  _id: string;
  _creationTime: number;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
  active: boolean;
};

export default function MasterListPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"name" | "department" | "status" | "created">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const members = useQuery(
    api.members.list,
    isAuthenticated ? { active: undefined } : "skip"
  );

  // Get unique departments and statuses for filters
  const departments = useMemo(() => {
    if (!members) return [];
    const depts = new Set<string>();
    members.forEach((m) => {
      if (m.department) depts.add(m.department);
    });
    return Array.from(depts).sort();
  }, [members]);

  const statuses = useMemo(() => {
    if (!members) return [];
    const stats = new Set<string>();
    members.forEach((m) => {
      if (m.status) stats.add(m.status);
    });
    return Array.from(stats).sort();
  }, [members]);

  // Filter members
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    
    let filtered = members.filter((member) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchable = `${member.name} ${member.contact} ${member.residence} ${member.department} ${member.status}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Gender filter
      if (genderFilter !== "all") {
        const memberGender = (member.gender ?? "").toLowerCase();
        if (memberGender !== genderFilter.toLowerCase()) return false;
      }

      // Department filter
      if (departmentFilter !== "all") {
        if (member.department !== departmentFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (member.status !== statusFilter) return false;
      }

      // Active filter
      if (activeFilter !== "all") {
        if (activeFilter === "active" && !member.active) return false;
        if (activeFilter === "inactive" && member.active) return false;
      }

      return true;
    });

    // Sort members
    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "department":
          aVal = (a.department || "").toLowerCase();
          bVal = (b.department || "").toLowerCase();
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        case "created":
          aVal = a._creationTime;
          bVal = b._creationTime;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [members, searchQuery, genderFilter, departmentFilter, statusFilter, activeFilter, sortBy, sortOrder]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredMembers.length === 0) return;

    const headers = ["Name", "Contact", "Residence", "Gender", "Department", "Status", "Active", "Date Added"];
    const rows = filteredMembers.map((m) => [
      m.name,
      m.contact || "",
      m.residence || "",
      m.gender || "",
      m.department || "",
      m.status || "",
      m.active ? "Yes" : "No",
      new Date(m._creationTime).toLocaleDateString(),
    ]);

    // Escape commas and quotes properly
    const escapeCSV = (cell: string | number) => {
      const str = String(cell);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Add BOM for Excel compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `master-list-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = filteredMembers.length;
    const active = filteredMembers.filter((m) => m.active).length;
    const male = filteredMembers.filter((m) => (m.gender ?? "").toLowerCase() === "male").length;
    const female = filteredMembers.filter((m) => (m.gender ?? "").toLowerCase() === "female").length;
    return { total, active, male, female };
  }, [filteredMembers]);

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <div className="backdrop-blur-xl sticky top-0 z-10 bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-sm font-light hover:bg-zinc-800 transition-colors"
            >
              Home
            </Link>
            <div>
              <div className="text-zinc-900 font-light tracking-tight text-xl">Master List</div>
              <div className="text-xs text-zinc-600">Complete member directory</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm hover:bg-white"
            >
              {viewMode === "grid" ? "📋 List" : "🔲 Grid"}
            </button>
            <button
              onClick={exportToCSV}
              disabled={!filteredMembers || filteredMembers.length === 0}
              className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs sm:text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Export CSV ({filteredMembers?.length || 0})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SignedOut>
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
              <p className="mb-4 text-zinc-700">Please sign in to access the master list.</p>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Members" value={stats.total} color="zinc" />
            <StatCard label="Active" value={stats.active} color="emerald" />
            <StatCard label="Male" value={stats.male} color="blue" />
            <StatCard label="Female" value={stats.female} color="pink" />
          </div>

          {/* Filters */}
          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div>
                <label className="text-xs text-zinc-600 mb-1 block">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, contact, residence, department, or status..."
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-zinc-600 mb-2 block">Gender</label>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="All"
                      active={genderFilter === "all"}
                      onClick={() => setGenderFilter("all")}
                    />
                    <FilterChip
                      label="Male"
                      active={genderFilter === "male"}
                      onClick={() => setGenderFilter("male")}
                    />
                    <FilterChip
                      label="Female"
                      active={genderFilter === "female"}
                      onClick={() => setGenderFilter("female")}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 mb-2 block">Department</label>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="All"
                      active={departmentFilter === "all"}
                      onClick={() => setDepartmentFilter("all")}
                    />
                    {departments.map((dept) => (
                      <FilterChip
                        key={dept}
                        label={dept}
                        active={departmentFilter === dept}
                        onClick={() => setDepartmentFilter(dept)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="All"
                      active={statusFilter === "all"}
                      onClick={() => setStatusFilter("all")}
                    />
                    {statuses.map((status) => (
                      <FilterChip
                        key={status}
                        label={status}
                        active={statusFilter === status}
                        onClick={() => setStatusFilter(status)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-600 mb-2 block">Active Status</label>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="All"
                      active={activeFilter === "all"}
                      onClick={() => setActiveFilter("all")}
                    />
                    <FilterChip
                      label="Active"
                      active={activeFilter === "active"}
                      onClick={() => setActiveFilter("active")}
                    />
                    <FilterChip
                      label="Inactive"
                      active={activeFilter === "inactive"}
                      onClick={() => setActiveFilter("inactive")}
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {(searchQuery || genderFilter !== "all" || departmentFilter !== "all" || statusFilter !== "all" || activeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setGenderFilter("all");
                    setDepartmentFilter("all");
                    setStatusFilter("all");
                    setActiveFilter("all");
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-200 text-zinc-900 text-sm hover:bg-zinc-300 self-start"
                >
                  Clear All Filters
                </button>
              )}

              {/* Sort Options */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-zinc-200">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-600">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="name">Name</option>
                    <option value="department">Department</option>
                    <option value="status">Status</option>
                    <option value="created">Date Added</option>
                  </select>
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm hover:bg-white"
                >
                  {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
                </button>
              </div>
            </div>
          </div>

          {/* Members List/Grid */}
          {members === undefined ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl animate-pulse"
                >
                  <div className="h-4 w-3/4 rounded bg-zinc-200" />
                  <div className="h-3 w-1/2 rounded mt-2 bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white/30 backdrop-blur-xl text-center">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-zinc-900 font-medium mb-1">No members found</div>
              <div className="text-sm text-zinc-600">
                Try adjusting your filters or search query
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((member) => (
                <MemberCard key={member._id} member={member} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-separate border-spacing-y-1 border-spacing-x-0">
                  <thead className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        <button
                          onClick={() => {
                            setSortBy("name");
                            if (sortBy === "name") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-amber-600"
                        >
                          Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Contact</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Residence</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Gender</th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        <button
                          onClick={() => {
                            setSortBy("department");
                            if (sortBy === "department") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-amber-600"
                        >
                          Department {sortBy === "department" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        <button
                          onClick={() => {
                            setSortBy("status");
                            if (sortBy === "status") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-amber-600"
                        >
                          Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr
                        key={member._id}
                        className="transition-colors hover:bg-white/35"
                      >
                        <td className="px-5 py-3 text-sm font-light text-zinc-900 rounded-l-xl">
                          {member.name}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {member.contact || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {member.residence || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800 capitalize">
                          <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900">
                            {member.gender || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {member.department || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {member.status || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm rounded-r-xl">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              member.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {member.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SignedIn>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    zinc: "bg-zinc-900/90 text-white",
    emerald: "bg-emerald-500/90 text-white",
    blue: "bg-blue-500/90 text-white",
    pink: "bg-pink-500/90 text-white",
  };

  return (
    <div className={`rounded-2xl p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-xs opacity-80 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
        active
          ? "bg-amber-400 text-zinc-900 font-medium"
          : "bg-white/70 text-zinc-700 hover:bg-white border border-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl hover:bg-white/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-900 mb-1">{member.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {member.gender && (
              <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900 text-xs capitalize">
                {member.gender}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                member.active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {member.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-zinc-600">
        {member.contact && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">📞</span>
            <span>{member.contact}</span>
          </div>
        )}
        {member.residence && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">📍</span>
            <span>{member.residence}</span>
          </div>
        )}
        {member.department && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">🏢</span>
            <span>{member.department}</span>
          </div>
        )}
        {member.status && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">👤</span>
            <span>{member.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
