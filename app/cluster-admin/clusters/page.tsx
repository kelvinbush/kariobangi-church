"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react";

export default function ClustersView() {
  const { isAuthenticated } = useConvexAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const clusters = useQuery(
    api.clusters.list,
    isAuthenticated ? { includeInactive: false } : "skip"
  );

  const filteredClusters = clusters?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.leaderName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link 
            href="/cluster-admin" 
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold text-slate-900">Clusters</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-sm text-slate-600">Sign in to view clusters</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search clusters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {/* Clusters List */}
          {filteredClusters && filteredClusters.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {filteredClusters.map((cluster) => (
                <div
                  key={cluster._id}
                  className="px-4 py-4 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{cluster.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {cluster.memberCount} members
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`/cluster-admin/clusters?id=${cluster._id}`}
                      className="p-2 rounded-lg hover:bg-slate-100"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Link>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Leader: {cluster.leaderName || "Not assigned"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-600">
                {searchTerm ? "No clusters match your search." : "No clusters found."}
              </p>
            </div>
          )}
        </SignedIn>
      </main>
    </div>
  );
}
