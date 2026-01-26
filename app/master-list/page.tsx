"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  type: "member";
};

type Kid = {
  _id: string;
  _creationTime: number;
  name: string;
  contact: string | null;
  residence: string | null;
  age?: number | null;
  active: boolean;
  type: "kid";
};

type Person = Member | Kid;

export default function MasterListPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "member" | "kid">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"name" | "department" | "status" | "created">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const members = useQuery(
    api.members.list,
    isAuthenticated ? { active: undefined } : "skip"
  );

  const kids = useQuery(
    api.kids.list,
    isAuthenticated ? { active: undefined } : "skip"
  );

  // Combine members and kids
  const allPeople = useMemo(() => {
    const membersList = (members || []).map((m) => ({ ...m, type: "member" as const }));
    const kidsList = (kids || []).map((k) => ({ ...k, type: "kid" as const }));
    return [...membersList, ...kidsList];
  }, [members, kids]);

  // Get unique departments and statuses for filters
  const departments = useMemo(() => {
    const depts = new Set<string>();
    allPeople.forEach((p) => {
      if (p.type === "member" && p.department) depts.add(p.department);
    });
    return Array.from(depts).sort();
  }, [allPeople]);

  const statuses = useMemo(() => {
    const stats = new Set<string>();
    allPeople.forEach((p) => {
      if (p.type === "member" && p.status) stats.add(p.status);
    });
    return Array.from(stats).sort();
  }, [allPeople]);

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = allPeople.filter((person) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchable = `${person.name} ${person.contact} ${person.residence} ${
          person.type === "member" ? `${person.department} ${person.status}` : ""
        }`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Type filter
      if (typeFilter !== "all") {
        if (person.type !== typeFilter) return false;
      }

      // Gender filter (only for members)
      if (genderFilter !== "all") {
        if (person.type !== "member") return false;
        const personGender = ((person as Member).gender ?? "").toLowerCase();
        if (personGender !== genderFilter.toLowerCase()) return false;
      }

      // Department filter (only for members)
      if (departmentFilter !== "all") {
        if (person.type !== "member") return false;
        if ((person as Member).department !== departmentFilter) return false;
      }

      // Status filter (only for members)
      if (statusFilter !== "all") {
        if (person.type !== "member") return false;
        if ((person as Member).status !== statusFilter) return false;
      }

      // Active filter
      if (activeFilter !== "all") {
        if (activeFilter === "active" && !person.active) return false;
        if (activeFilter === "inactive" && person.active) return false;
      }

      return true;
    });

    // Sort people
    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "department":
          if (a.type === "member" && b.type === "member") {
            aVal = ((a as Member).department || "").toLowerCase();
            bVal = ((b as Member).department || "").toLowerCase();
          } else {
            return a.type === "member" ? -1 : 1;
          }
          break;
        case "status":
          if (a.type === "member" && b.type === "member") {
            aVal = ((a as Member).status || "").toLowerCase();
            bVal = ((b as Member).status || "").toLowerCase();
          } else {
            return a.type === "member" ? -1 : 1;
          }
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
  }, [
    allPeople,
    searchQuery,
    typeFilter,
    genderFilter,
    departmentFilter,
    statusFilter,
    activeFilter,
    sortBy,
    sortOrder,
  ]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredPeople.length === 0) return;

    const headers = [
      "Name",
      "Type",
      "Contact",
      "Residence",
      "Gender",
      "Department",
      "Status",
      "Age",
      "Active",
      "Date Added",
    ];
    const rows = filteredPeople.map((p) => {
      const type =
        p.type === "kid"
          ? "Kid"
          : (p as Member).status || "Member";
      return [
        p.name,
        type,
        p.contact || "",
        p.residence || "",
        p.type === "member" ? (p as Member).gender || "" : "",
        p.type === "member" ? (p as Member).department || "" : "",
        p.type === "member" ? (p as Member).status || "" : "",
        p.type === "kid" ? ((p as Kid).age?.toString() || "") : "",
        p.active ? "Yes" : "No",
        new Date(p._creationTime).toLocaleDateString(),
      ];
    });

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
    const total = filteredPeople.length;
    const active = filteredPeople.filter((p) => p.active).length;
    const members = filteredPeople.filter((p) => p.type === "member").length;
    const kids = filteredPeople.filter((p) => p.type === "kid").length;
    const male = filteredPeople.filter(
      (p) => p.type === "member" && ((p as Member).gender ?? "").toLowerCase() === "male"
    ).length;
    const female = filteredPeople.filter(
      (p) => p.type === "member" && ((p as Member).gender ?? "").toLowerCase() === "female"
    ).length;
    return { total, active, members, kids, male, female };
  }, [filteredPeople]);

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <div className="backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full bg-zinc-900/90 text-white text-sm font-light hover:bg-zinc-900 transition-colors"
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
              disabled={!filteredPeople || filteredPeople.length === 0}
              className="px-3 py-1.5 rounded-full bg-zinc-900/90 text-white text-xs sm:text-sm hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Export CSV ({filteredPeople?.length || 0})
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
                <button className="px-4 py-2 rounded-full bg-zinc-900/90 text-white">Sign in</button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Members" value={stats.members} />
            <StatCard label="Kids" value={stats.kids} />
          </div>

          {/* Search */}
          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, contact, residence, department, or status..."
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="px-4 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm hover:bg-white flex items-center gap-2"
              >
                Filters
                {filtersOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Collapsible Filters */}
            {filtersOpen && (
              <div className="mt-4 pt-4 border-t border-zinc-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Type Filter */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="all">All</option>
                      <option value="member">Members</option>
                      <option value="kid">Kids</option>
                    </select>
                  </div>

                  {/* Gender Filter */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Gender</label>
                    <select
                      value={genderFilter}
                      onChange={(e) => setGenderFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="all">All</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Department</label>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="all">All</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="all">All</option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Active Filter */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Active Status</label>
                    <select
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-1.5 block">Sort By</label>
                    <div className="flex gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                      >
                        <option value="name">Name</option>
                        <option value="department">Department</option>
                        <option value="status">Status</option>
                        <option value="created">Date Added</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 text-sm hover:bg-white"
                      >
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                {(searchQuery ||
                  typeFilter !== "all" ||
                  genderFilter !== "all" ||
                  departmentFilter !== "all" ||
                  statusFilter !== "all" ||
                  activeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                      setGenderFilter("all");
                      setDepartmentFilter("all");
                      setStatusFilter("all");
                      setActiveFilter("all");
                    }}
                    className="px-3 py-1.5 rounded-full bg-zinc-200 text-zinc-900 text-sm hover:bg-zinc-300"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* People List/Grid */}
          {allPeople.length === 0 && members === undefined && kids === undefined ? (
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
          ) : filteredPeople.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white/30 backdrop-blur-xl text-center">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-zinc-900 font-medium mb-1">No results found</div>
              <div className="text-sm text-zinc-600">
                Try adjusting your filters or search query
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeople.map((person) => (
                <PersonCard key={person._id} person={person} />
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
                            if (sortBy === "name")
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-zinc-900"
                        >
                          Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Type
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Contact
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Residence
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Gender
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        <button
                          onClick={() => {
                            setSortBy("department");
                            if (sortBy === "department")
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-zinc-900"
                        >
                          Department{" "}
                          {sortBy === "department" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        <button
                          onClick={() => {
                            setSortBy("status");
                            if (sortBy === "status")
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          }}
                          className="flex items-center gap-1 hover:text-zinc-900"
                        >
                          Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Age
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-light tracking-wide text-zinc-700">
                        Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => (
                      <tr
                        key={person._id}
                        className="transition-colors hover:bg-white/35"
                      >
                        <td className="px-5 py-3 text-sm font-light text-zinc-900 rounded-l-xl">
                          {person.name}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900 text-xs capitalize">
                            {person.type === "kid"
                              ? "Kid"
                              : (person as Member).status || "Member"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {person.contact || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {person.residence || "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800 capitalize">
                          {person.type === "member" ? (
                            (person as Member).gender ? (
                              <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900">
                                {(person as Member).gender}
                              </span>
                            ) : (
                              "-"
                            )
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {person.type === "member"
                            ? (person as Member).department || "-"
                            : "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {person.type === "member"
                            ? (person as Member).status || "-"
                            : "-"}
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-800">
                          {person.type === "kid" ? (person as Kid).age || "-" : "-"}
                        </td>
                        <td className="px-5 py-3 text-sm rounded-r-xl">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              person.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {person.active ? "Active" : "Inactive"}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4 bg-zinc-900/90 text-white">
      <div className="text-xs opacity-80 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
    </div>
  );
}

function PersonCard({ person }: { person: Person }) {
  return (
    <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl hover:bg-white/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-900 mb-1">{person.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-xl text-zinc-900 text-xs capitalize">
              {person.type === "kid"
                ? "Kid"
                : (person as Member).status || "Member"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                person.active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {person.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-zinc-600">
        {person.contact && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">📞</span>
            <span>{person.contact}</span>
          </div>
        )}
        {person.residence && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">📍</span>
            <span>{person.residence}</span>
          </div>
        )}
        {person.type === "member" && (person as Member).department && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">🏢</span>
            <span>{(person as Member).department}</span>
          </div>
        )}
        {person.type === "member" && (person as Member).status && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">👤</span>
            <span>{(person as Member).status}</span>
          </div>
        )}
        {person.type === "member" && (person as Member).gender && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">⚧</span>
            <span className="capitalize">{(person as Member).gender}</span>
          </div>
        )}
        {person.type === "kid" && (person as Kid).age && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">🎂</span>
            <span>Age: {(person as Kid).age}</span>
          </div>
        )}
      </div>
    </div>
  );
}
