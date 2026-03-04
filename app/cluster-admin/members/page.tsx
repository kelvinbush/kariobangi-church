"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react";

export default function ClusterMembersView() {
  const { isAuthenticated } = useConvexAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const clusters = useQuery(
    api.clusters.list,
    isAuthenticated ? { includeInactive: false } : "skip"
  );
  const unassigned = useQuery(
    api.clusters.getUnassignedMembers,
    isAuthenticated ? {} : "skip"
  );

  const filteredClusters = clusters?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <span className="font-semibold text-slate-900">Members</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-sm text-slate-600">Sign in to view members</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Unassigned Members */}
          {unassigned && unassigned.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Unassigned Members</h2>
                <span className="text-sm text-slate-500">{unassigned.length}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {unassigned.slice(0, 5).map((member) => (
                  <div 
                    key={member._id} 
                    className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{member.name}</p>
                      {member.contact && (
                        <p className="text-xs text-slate-500">{member.contact}</p>
                      )}
                    </div>
                  </div>
                ))}
                {unassigned.length > 5 && (
                  <div className="px-4 py-2 text-center text-sm text-slate-500">
                    +{unassigned.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clusters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">By Cluster</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            {filteredClusters && filteredClusters.length > 0 ? (
              <div className="space-y-3">
                {filteredClusters.map((cluster) => (
                  <ClusterMembersCard key={cluster._id} cluster={cluster} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-600">No clusters found</p>
              </div>
            )}
          </div>
        </SignedIn>
      </main>
    </div>
  );
}

function ClusterMembersCard({ cluster }: { cluster: any }) {
  const members = useQuery(
    api.clusters.getClusterMembers,
    { clusterId: cluster._id }
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">{cluster.name}</p>
          <p className="text-xs text-slate-500">{cluster.memberCount} members</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {members?.slice(0, 5).map((member: any) => (
          <div key={member._id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-900">{member.name}</p>
              {member.contact && (
                <p className="text-xs text-slate-500">{member.contact}</p>
              )}
            </div>
          </div>
        ))}
        {members && members.length > 5 && (
          <div className="px-4 py-2 text-center text-sm text-slate-500">
            +{members.length - 5} more members
          </div>
        )}
      </div>
    </div>
  );
}
