"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatIsoDate, getLastSunday } from "@/lib/date";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Warm color palette
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
    blue: '#8fa8c4',
    rose: '#c49a9a',
  }
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

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
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState<string>("");
  
  const CLUSTER_TYPES = [
    { value: "men", label: "Men", color: "#5a7a8a", bgColor: "#d4e0ec" },
    { value: "youth_men", label: "Youth Men", color: "#5a7a5a", bgColor: "#c5d4be" },
    { value: "youth_ladies", label: "Youth Ladies", color: "#c49a84", bgColor: "#e8d8cc" },
    { value: "pastors", label: "Pastors", color: "#7c6f5a", bgColor: "#e8dcc8" },
    { value: "women", label: "Women", color: "#9b8cb8", bgColor: "#d4cbe5" },
  ];
  
  const getTypeInfo = (type: string | null | undefined) => {
    return CLUSTER_TYPES.find(t => t.value === type) || null;
  };
  
  const cluster = useQuery(api.clusters.get, isAuthenticated ? { id: clusterId } : "skip");
  const members = useQuery(api.clusterMembers.listByCluster, isAuthenticated ? { clusterId } : "skip");
  const unassigned = useQuery(api.clusterMembers.unassignedMembers, isAuthenticated && showAddMember ? {} : "skip");
  const clusterHeads = useQuery(api.clusterHeads.list, isAuthenticated ? { activeOnly: true } : "skip");
  const logs = useQuery(api.clusterFollowUps.getLogs, isAuthenticated ? { clusterId, limit: 50 } : "skip");
  
  const updateCluster = useMutation(api.clusters.update);
  const assignLeader = useMutation(api.clusters.assignLeader);
  const removeLeader = useMutation(api.clusters.removeLeader);
  const addMember = useMutation(api.clusterMembers.addMember);
  const removeMember = useMutation(api.clusterMembers.removeMember);
  
  const lastSunday = getLastSunday();
  
  const leader = cluster?.leaderClerkId ? clusterHeads?.find(h => h.clerkId === cluster.leaderClerkId) : null;
  const unassignedHeads = clusterHeads?.filter(h => !h.clusterId && h.active) || [];
  
  const handleEditName = async () => {
    if (!cluster || !editName.trim()) return;
    try {
      await updateCluster({ 
        id: clusterId, 
        name: editName.trim(),
        type: editType || undefined,
      });
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <p style={{ color: colors.text.secondary }}>Loading...</p>
      </div>
    );
  }
  
  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/cluster-admin" className="p-2 -ml-2" style={{ color: colors.text.secondary }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base truncate block max-w-[200px]" style={{ color: colors.text.primary }}>{cluster?.name || 'Cluster'}</span>
                {(() => {
                  const typeInfo = getTypeInfo(cluster?.type);
                  if (!typeInfo) return null;
                  return (
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: typeInfo.bgColor, color: typeInfo.color }}
                    >
                      {typeInfo.label}
                    </span>
                  );
                })()}
                {isAdmin && cluster && (
                  <button onClick={() => { setEditName(cluster.name); setEditType(cluster.type || ""); setShowEditName(true); }} className="p-1" style={{ color: colors.text.muted }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                )}
              </div>
              <span className="text-xs" style={{ color: colors.text.muted }}>{members?.length || 0} members</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 pb-24">
          {cluster && (
            <>
              {/* Leader Card */}
              <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: colors.surface }}>
                <span className="text-xs block mb-3" style={{ color: colors.text.muted }}>{isAdmin ? 'Leader' : 'Cluster Leader'}</span>
                {leader ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
                        <span className="text-sm" style={{ color: colors.text.secondary }}>{leader.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-sm block" style={{ color: colors.text.primary }}>{leader.displayName}</span>
                        <span className="text-xs" style={{ color: colors.text.muted }}>Current Leader</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={handleRemoveLeader} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}>Remove</button>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm mb-3" style={{ color: colors.text.secondary }}>No leader assigned</p>
                    {isAdmin && unassignedHeads.length > 0 ? (
                      <div className="flex gap-2">
                        <select value={selectedHeadId} onChange={(e) => setSelectedHeadId(e.target.value)} className="flex-1 px-3 py-2 text-sm rounded-xl outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                          <option value="">Select head...</option>
                          {unassignedHeads.map((h: { clerkId: string; displayName: string }) => (<option key={h.clerkId} value={h.clerkId}>{h.displayName}</option>))}
                        </select>
                        <button onClick={handleAssignLeader} disabled={!selectedHeadId} className="px-4 py-2 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>Assign</button>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: colors.text.muted }}>{isAdmin ? 'No unassigned heads available' : 'Contact admin to assign leader'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                  <p className="text-lg" style={{ color: colors.text.primary }}>{members?.length || 0}</p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>Members</p>
                </div>
                <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                  <p className="text-lg" style={{ color: colors.accent.sage }}>{logs?.filter(l => l.date === lastSunday).length || 0}</p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>This Week</p>
                </div>
                <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                  <p className="text-lg" style={{ color: colors.text.primary }}>{logs?.length || 0}</p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>Total Logs</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                {(['members', 'history'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 py-2 rounded-full text-xs transition-colors" style={{ backgroundColor: activeTab === tab ? colors.accent.amberLight : colors.surface, color: activeTab === tab ? colors.accent.amber : colors.text.secondary, fontWeight: activeTab === tab ? 500 : 400 }}>
                    {tab === 'members' ? `Members (${members?.length || 0})` : 'History'}
                  </button>
                ))}
              </div>

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-3">
                  {isAdmin && (
                    <button onClick={() => setShowAddMember(true)} className="w-full py-3 rounded-xl text-sm" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>+ Add Member</button>
                  )}
                  
                  {members && members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((m: Member) => (
                        <div key={m._id} className="p-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: colors.surface }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: colors.bg, color: colors.text.secondary }}>
                            {m.memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm block truncate" style={{ color: colors.text.primary }}>{m.memberName}</span>
                            {m.memberContact && <span className="text-xs block truncate" style={{ color: colors.text.muted }}>{m.memberContact}</span>}
                          </div>
                          {m.memberGender && (
                            <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: m.memberGender === 'Male' ? `${colors.accent.blue}20` : `${colors.accent.rose}20`, color: m.memberGender === 'Male' ? colors.accent.blue : colors.accent.rose }}>{m.memberGender === 'Male' ? 'M' : 'F'}</span>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleRemoveMember(m.memberId, m.memberName)} className="p-2" style={{ color: colors.accent.terracotta }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                      <p className="text-sm" style={{ color: colors.text.secondary }}>No members yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {logsByDate && Object.keys(logsByDate).length > 0 ? (
                    Object.entries(logsByDate).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()).map(([date, dateLogs]) => (
                      <div key={date}>
                        <span className="text-xs block mb-2" style={{ color: colors.text.muted }}>{formatIsoDate(date)}</span>
                        <div className="space-y-2">
                          {dateLogs?.map((log) => (
                            <div key={log._id} className="p-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm" style={{ color: colors.text.primary }}>{log.memberName}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: log.status === 'contacted' ? colors.accent.sageLight : log.status === 'needs_attention' ? colors.accent.terracottaLight : colors.surfaceHover, color: log.status === 'contacted' ? colors.accent.sage : log.status === 'needs_attention' ? colors.accent.terracotta : colors.text.secondary }}>{log.status.replace(/_/g, ' ')}</span>
                              </div>
                              {log.comment && <p className="text-xs mt-1" style={{ color: colors.text.secondary }}>{log.comment}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                      <p className="text-sm" style={{ color: colors.text.secondary }}>No follow-up logs yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Add Member Modal */}
        {showAddMember && isAdmin && unassigned && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }} onClick={() => { setShowAddMember(false); setAddMemberSearch(""); }}>
            <div className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col" style={{ backgroundColor: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
                <h3 className="text-base" style={{ color: colors.text.primary }}>Add Member</h3>
                <button onClick={() => { setShowAddMember(false); setAddMemberSearch(""); }} style={{ color: colors.text.secondary }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
              </div>
              <div className="p-4" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
                <input 
                  type="text" 
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full px-4 py-3 text-sm rounded-xl outline-none"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const filtered = addMemberSearch.trim() 
                    ? unassigned.filter((m: { name: string; contact: string | null }) => 
                        m.name.toLowerCase().includes(addMemberSearch.toLowerCase()) ||
                        (m.contact && m.contact.toLowerCase().includes(addMemberSearch.toLowerCase()))
                      )
                    : unassigned;
                  
                  if (filtered.length > 0) {
                    return (
                      <div className="space-y-2">
                        {filtered.map((m: { _id: Id<"members">; name: string; contact: string | null; gender: string | null }) => (
                          <button key={m._id} onClick={() => { handleAddMember(m._id); setAddMemberSearch(""); }} className="w-full p-3 rounded-xl flex items-center gap-3 text-left" style={{ backgroundColor: colors.bg }}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>{m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm block truncate" style={{ color: colors.text.primary }}>{m.name}</span>
                              {m.contact && <span className="text-xs block truncate" style={{ color: colors.text.muted }}>{m.contact}</span>}
                            </div>
                            {m.gender && <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: m.gender === 'Male' ? `${colors.accent.blue}20` : `${colors.accent.rose}20`, color: m.gender === 'Male' ? colors.accent.blue : colors.accent.rose }}>{m.gender === 'Male' ? 'M' : 'F'}</span>}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.accent.amber} strokeWidth="1.5"><path d="M12 4v16m8-8H4" /></svg>
                          </button>
                        ))}
                      </div>
                    );
                  }
                  
                  if (addMemberSearch.trim() && filtered.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <p className="text-sm" style={{ color: colors.text.secondary }}>No members found</p>
                        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>Try a different search term</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: colors.text.secondary }}>No unassigned members</p>
                      <p className="text-xs mt-1" style={{ color: colors.text.muted }}>All members are in clusters</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Edit Name Modal */}
        {showEditName && isAdmin && cluster && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }} onClick={() => setShowEditName(false)}>
            <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
                <h3 className="text-base" style={{ color: colors.text.primary }}>Edit Cluster</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Cluster name..." className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Type</label>
                  <select 
                    value={editType} 
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                  >
                    <option value="">General (no type)</option>
                    {CLUSTER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowEditName(false)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Cancel</button>
                  <button onClick={handleEditName} disabled={!editName.trim() || (editName === cluster.name && editType === (cluster.type || ""))} className="flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
