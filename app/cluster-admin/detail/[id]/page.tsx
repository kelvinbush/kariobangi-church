"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate, getLastSunday } from "@/lib/date";

// Clean color palette
const theme = {
  bg: '#f9f8f6',
  surface: '#ffffff',
  surfaceHover: '#f5f4f2',
  border: '#e8e6e3',
  
  text: {
    primary: '#1a1a1a',
    secondary: '#5a5a5a',
    muted: '#9a9997',
  },
  
  accent: '#7c6f5a',
  success: '#5a7a5a',
  danger: '#a06060',
  men: '#5a7a9a',
  women: '#9a5a7a',
};

interface Member {
  _id: Id<"clusterMembers">;
  memberId: Id<"members">;
  memberName: string;
  memberContact: string | null;
  memberGender: string | null;
  memberResidence: string | null;
  joinedAt: number;
}

export default function ClusterDetailPage() {
  const params = useParams();
  const clusterId = params.id as Id<"clusters">;
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const role = (user?.publicMetadata as { role?: string })?.role ?? "";
  const isAdmin = role === "admin";
  
  const [activeTab, setActiveTab] = useState<'members' | 'history'>('members');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState<string>("");
  
  // Fetch data
  const cluster = useQuery(api.clusters.get, isAuthenticated ? { id: clusterId } : "skip");
  const members = useQuery(api.clusterMembers.listByCluster, isAuthenticated ? { clusterId } : "skip");
  const unassigned = useQuery(api.clusterMembers.unassignedMembers, isAuthenticated && showAddMember ? {} : "skip");
  const clusterHeads = useQuery(api.clusterHeads.list, isAuthenticated ? { activeOnly: true } : "skip");
  const logs = useQuery(api.clusterFollowUps.getLogs, isAuthenticated ? { clusterId, limit: 50 } : "skip");
  
  // Mutations
  const updateCluster = useMutation(api.clusters.update);
  const assignLeader = useMutation(api.clusters.assignLeader);
  const removeLeader = useMutation(api.clusters.removeLeader);
  const addMember = useMutation(api.clusterMembers.addMember);
  const removeMember = useMutation(api.clusterMembers.removeMember);
  
  const lastSunday = getLastSunday();
  
  // Get leader info
  const leader = cluster?.leaderClerkId 
    ? clusterHeads?.find(h => h.clerkId === cluster.leaderClerkId)
    : null;
  
  // Unassigned heads for assignment
  const unassignedHeads = clusterHeads?.filter(h => !h.clusterId && h.active) || [];
  
  const handleEditName = async () => {
    if (!cluster || !editName.trim()) return;
    try {
      await updateCluster({ id: clusterId, name: editName.trim() });
      setShowEditName(false);
      setEditName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  };
  
  const handleAssignLeader = async () => {
    if (!selectedHeadId) return;
    try {
      await assignLeader({ clusterId, clerkId: selectedHeadId });
      setSelectedHeadId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign");
    }
  };
  
  const handleRemoveLeader = async () => {
    if (!leader || !confirm(`Remove ${leader.displayName} as leader?`)) return;
    try {
      await removeLeader({ clusterId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    }
  };
  
  const handleAddMember = async (memberId: Id<"members">) => {
    try {
      await addMember({ clusterId, memberId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add");
    }
  };
  
  const handleRemoveMember = async (memberId: Id<"members">, memberName: string) => {
    if (!confirm(`Remove ${memberName} from cluster?`)) return;
    try {
      await removeMember({ clusterId, memberId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    }
  };
  
  const logsByDate = logs?.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, typeof logs>);
  
  if (!cluster && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.bg }}>
        <p style={{ color: theme.text.secondary }}>Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link 
              href="/cluster-admin" 
              className="p-2 -ml-2"
              style={{ color: theme.text.secondary }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base truncate block max-w-[200px]" style={{ color: theme.text.primary }}>
                  {cluster?.name || 'Cluster'}
                </span>
                {isAdmin && cluster && (
                  <button
                    onClick={() => { setEditName(cluster.name); setShowEditName(true); }}
                    className="p-1"
                    style={{ color: theme.text.muted }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-xs" style={{ color: theme.text.muted }}>
                {members?.length || 0} members
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
          {cluster && (
            <>
              {/* Leader Card */}
              <div 
                className="p-4 rounded-xl border mb-4"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <span className="text-xs uppercase tracking-wide block mb-3" style={{ color: theme.text.muted }}>
                  {isAdmin ? 'Leader' : 'Cluster Leader'}
                </span>
                {leader ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: theme.bg }}
                      >
                        <span className="text-sm" style={{ color: theme.text.secondary }}>
                          {leader.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm block" style={{ color: theme.text.primary }}>
                          {leader.displayName}
                        </span>
                        <span className="text-xs" style={{ color: theme.text.muted }}>Current Leader</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={handleRemoveLeader}
                        className="px-3 py-1.5 rounded-lg text-xs border"
                        style={{ borderColor: theme.danger, color: theme.danger }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm mb-3" style={{ color: theme.text.secondary }}>No leader assigned</p>
                    {isAdmin && unassignedHeads.length > 0 ? (
                      <div className="flex gap-2">
                        <select
                          value={selectedHeadId}
                          onChange={(e) => setSelectedHeadId(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm rounded-xl border"
                          style={{ borderColor: theme.border, color: theme.text.primary }}
                        >
                          <option value="">Select head...</option>
                          {unassignedHeads.map((h: { clerkId: string; displayName: string }) => (
                            <option key={h.clerkId} value={h.clerkId}>{h.displayName}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAssignLeader}
                          disabled={!selectedHeadId}
                          className="px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                          style={{ backgroundColor: theme.accent, color: '#fff' }}
                        >
                          Assign
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: theme.text.muted }}>
                        {isAdmin ? 'No unassigned heads available' : 'Contact admin to assign leader'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                  <p className="text-lg" style={{ color: theme.text.primary }}>{members?.length || 0}</p>
                  <p className="text-xs" style={{ color: theme.text.muted }}>Members</p>
                </div>
                <div className="p-3 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                  <p className="text-lg" style={{ color: theme.success }}>
                    {logs?.filter(l => l.date === lastSunday).length || 0}
                  </p>
                  <p className="text-xs" style={{ color: theme.text.muted }}>This Week</p>
                </div>
                <div className="p-3 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                  <p className="text-lg" style={{ color: theme.text.primary }}>{logs?.length || 0}</p>
                  <p className="text-xs" style={{ color: theme.text.muted }}>Total Logs</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b mb-4" style={{ borderColor: theme.border }}>
                {(['members', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 py-3 text-sm capitalize"
                    style={{ 
                      color: activeTab === tab ? theme.text.primary : theme.text.muted,
                      borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : '2px solid transparent',
                      marginBottom: '-2px'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-3">
                  {/* Add Member Button - Admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="w-full py-3 rounded-xl text-sm border"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text.primary }}
                    >
                      + Add Member
                    </button>
                  )}
                  
                  {/* Members List */}
                  {members && members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((m: Member) => (
                        <div 
                          key={m._id}
                          className="p-3 rounded-xl border flex items-center gap-3"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
                            style={{ backgroundColor: theme.bg, color: theme.text.secondary }}
                          >
                            {m.memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm block truncate" style={{ color: theme.text.primary }}>
                              {m.memberName}
                            </span>
                            {m.memberContact && (
                              <span className="text-xs block truncate" style={{ color: theme.text.muted }}>
                                {m.memberContact}
                              </span>
                            )}
                          </div>
                          {m.memberGender && (
                            <span 
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ 
                                backgroundColor: m.memberGender === 'Male' ? `${theme.men}15` : `${theme.women}15`,
                                color: m.memberGender === 'Male' ? theme.men : theme.women
                              }}
                            >
                              {m.memberGender === 'Male' ? 'M' : 'F'}
                            </span>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleRemoveMember(m.memberId, m.memberName)}
                              className="p-2"
                              style={{ color: theme.danger }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                      <p className="text-sm" style={{ color: theme.text.secondary }}>No members yet</p>
                      {!isAdmin && (
                        <p className="text-xs mt-1" style={{ color: theme.text.muted }}>Contact admin to add members</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {logsByDate && Object.keys(logsByDate).length > 0 ? (
                    Object.entries(logsByDate)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .map(([date, dateLogs]) => (
                        <div key={date}>
                          <span className="text-xs uppercase tracking-wide mb-2 block" style={{ color: theme.text.muted }}>
                            {formatIsoDate(date)}
                          </span>
                          <div className="space-y-2">
                            {dateLogs?.map((log) => (
                              <div 
                                key={log._id}
                                className="p-3 rounded-xl border"
                                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm" style={{ color: theme.text.primary }}>{log.memberName}</span>
                                  <span 
                                    className="px-2 py-0.5 rounded text-xs"
                                    style={{ 
                                      backgroundColor: log.status === 'contacted' ? `${theme.success}15` : 
                                        log.status === 'needs_attention' ? `${theme.danger}15` : theme.bg,
                                      color: log.status === 'contacted' ? theme.success : 
                                        log.status === 'needs_attention' ? theme.danger : theme.text.secondary
                                    }}
                                  >
                                    {log.status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                {log.comment && (
                                  <p className="text-xs mt-1" style={{ color: theme.text.secondary }}>{log.comment}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="p-8 rounded-xl border text-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                      <p className="text-sm" style={{ color: theme.text.secondary }}>No follow-up logs yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </main>

      {/* Add Member Modal - Admin only */}
      {showAddMember && isAdmin && unassigned && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowAddMember(false)}
        >
          <div 
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Add Member</h3>
              <button onClick={() => setShowAddMember(false)} style={{ color: theme.text.secondary }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {unassigned.length > 0 ? (
                <div className="space-y-2">
                  {unassigned.map((m: { _id: Id<"members">; name: string; contact: string | null; gender: string | null }) => (
                    <button
                      key={m._id}
                      onClick={() => handleAddMember(m._id)}
                      className="w-full p-3 rounded-xl border flex items-center gap-3 text-left"
                      style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
                        style={{ backgroundColor: theme.surface, color: theme.text.secondary }}
                      >
                        {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block truncate" style={{ color: theme.text.primary }}>{m.name}</span>
                        {m.contact && (
                          <span className="text-xs block truncate" style={{ color: theme.text.muted }}>{m.contact}</span>
                        )}
                      </div>
                      {m.gender && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ 
                            backgroundColor: m.gender === 'Male' ? `${theme.men}15` : `${theme.women}15`,
                            color: m.gender === 'Male' ? theme.men : theme.women
                          }}
                        >
                          {m.gender === 'Male' ? 'M' : 'F'}
                        </span>
                      )}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
                        <path d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: theme.text.secondary }}>No unassigned members</p>
                  <p className="text-xs mt-1" style={{ color: theme.text.muted }}>All members are in clusters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal - Admin only */}
      {showEditName && isAdmin && cluster && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowEditName(false)}
        >
          <div 
            className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ backgroundColor: theme.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.border }}>
              <h3 className="text-base" style={{ color: theme.text.primary }}>Edit Cluster Name</h3>
            </div>
            <div className="p-5 space-y-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Cluster name..."
                className="w-full px-3 py-2.5 text-sm rounded-xl border"
                style={{ borderColor: theme.border, color: theme.text.primary }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditName(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl border"
                  style={{ borderColor: theme.border, color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditName}
                  disabled={!editName.trim() || editName === cluster.name}
                  className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: theme.accent, color: '#fff' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
