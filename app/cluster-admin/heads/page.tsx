"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronLeft, Users } from "lucide-react";

export default function ClusterHeadsView() {
  const { isAuthenticated } = useConvexAuth();

  const heads = useQuery(
    api.clusterHeads.list,
    isAuthenticated ? { activeOnly: true } : "skip"
  );
  const clusters = useQuery(
    api.clusters.list,
    isAuthenticated ? { includeInactive: false } : "skip"
  );

  // Map cluster names to heads
  const headsWithClusters = heads?.map((head) => {
    const cluster = clusters?.find((c) => c._id === head.clusterId);
    return { ...head, clusterName: cluster?.name };
  });

  const assignedHeads = headsWithClusters?.filter((h) => h.clusterId) || [];
  const unassignedHeads = headsWithClusters?.filter((h) => !h.clusterId) || [];

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
          <span className="font-semibold text-slate-900">Cluster Heads</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <SignedOut>
          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-sm text-slate-600">Sign in to view cluster heads</p>
            <SignInButton mode="modal">
              <button className="mt-4 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg">
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Assigned Heads */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Assigned</h2>
              <span className="text-sm text-slate-500">{assignedHeads.length}</span>
            </div>
            {assignedHeads.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {assignedHeads.map((head) => (
                  <div 
                    key={head._id} 
                    className="px-4 py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{head.displayName}</p>
                        <p className="text-xs text-slate-500">{head.clusterName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                <p className="text-slate-600 text-sm">No assigned cluster heads</p>
              </div>
            )}
          </div>

          {/* Unassigned Heads */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Unassigned</h2>
              <span className="text-sm text-slate-500">{unassignedHeads.length}</span>
            </div>
            {unassignedHeads.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {unassignedHeads.map((head) => (
                  <div 
                    key={head._id} 
                    className="px-4 py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{head.displayName}</p>
                        {head.email && (
                          <p className="text-xs text-slate-500">{head.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                <p className="text-slate-600 text-sm">No unassigned cluster heads</p>
              </div>
            )}
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
