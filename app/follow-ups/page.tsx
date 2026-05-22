"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateLong } from "@/lib/date";
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

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not contacted", color: colors.accent.terracotta },
  { value: "contacted", label: "Contacted", color: colors.accent.sage },
  { value: "needs_follow_up", label: "Needs follow-up", color: colors.accent.amber },
];

// Toast component with auto-dismiss
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div 
      className="mb-4 p-4 rounded-xl text-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2"
      style={{ backgroundColor: colors.text.primary, color: '#fff' }}
    >
      <span>{message}</span>
      <button 
        onClick={onDismiss}
        className="text-white/70 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export default function FollowUpsAdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const { user } = useUser();
  const metadata = user?.publicMetadata as { role?: string; roles?: string[]; secondaryRole?: string } | undefined;
  const userRoles = new Set<string>();
  if (metadata?.role) userRoles.add(metadata.role);
  if (metadata?.roles?.length) metadata.roles.forEach((r: string) => userRoles.add(r));
  if (metadata?.secondaryRole) userRoles.add(metadata.secondaryRole);
  
  const canAccess = userRoles.has("admin") || userRoles.has("follow-up-admin");
  const isAdmin = userRoles.has("admin");

  const eligible = useQuery(api.followUps.visitorsEligibleForFollowUp, isAuthenticated ? {} : "skip");
  const protocolList = useQuery(api.protocolMembers.list, isAuthenticated ? { activeOnly: true } : "skip");
  const listAll = useQuery(api.followUps.listAll, isAuthenticated ? {} : "skip");
  const removalQueue = useQuery(api.followUps.removalQueue, isAuthenticated ? {} : "skip");
  const graduates = useQuery(api.followUps.graduatesByProtocolMember, isAuthenticated ? {} : "skip");
  const recentGrads = useQuery(api.followUps.recentGraduates, isAuthenticated ? { limit: 5 } : "skip");
  const protocolListAll = useQuery(api.protocolMembers.list, isAuthenticated ? {} : "skip");

  const assignMutation = useMutation(api.followUps.assign);
  const reassignMutation = useMutation(api.followUps.reassign);
  const removeVisitorMutation = useMutation(api.followUps.removeVisitorAndArchiveFollowUp);
  const markAsGraduatedMutation = useMutation(api.followUps.markAsGraduated);
  const addProtocolMutation = useMutation(api.protocolMembers.add);
  const updateProtocolMutation = useMutation(api.protocolMembers.update);

  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<Set<Id<"visitors">>>(new Set());
  const [reassignFollowUpId, setReassignFollowUpId] = useState<Id<"followUps"> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "assign" | "removal" | "graduates" | "protocol">("list");
  const [newProtocolClerkId, setNewProtocolClerkId] = useState("");
  const [newProtocolDisplayName, setNewProtocolDisplayName] = useState("");
  const [isWhatsAppOnly, setIsWhatsAppOnly] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const handleAssignSelected = async () => {
    if (!selectedAssignee || selectedVisitorIds.size === 0) {
      setToast("Choose a protocol member and select at least one visitor");
      return;
    }
    try {
      const visitorIds = Array.from(selectedVisitorIds);
      await Promise.all(
        visitorIds.map((id) => assignMutation({ visitorId: id, assignedToClerkId: selectedAssignee }))
      );
      setToast(`Assigned ${visitorIds.length} visitor${visitorIds.length > 1 ? "s" : ""}`);
      setSelectedVisitorIds(new Set());
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to assign");
    }
  };

  const getProtocolOptions = () => {
    const currentUserId = user?.id;
    const currentUserOption =
      currentUserId && !(protocolList ?? []).some((p) => p.clerkId === currentUserId)
        ? [{ clerkId: currentUserId, displayName: (user?.fullName ?? "Me (you)").trim() || "Me (you)" }]
        : [];
    const fromTable = protocolList ?? [];
    return [...currentUserOption, ...fromTable];
  };

  const handleReassignTo = async (clerkId: string) => {
    if (!reassignFollowUpId) return;
    try {
      await reassignMutation({ followUpId: reassignFollowUpId, assignedToClerkId: clerkId });
      setToast("Reassigned");
      setReassignFollowUpId(null);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to reassign");
    }
  };

  const handleApproveRemoval = async (visitorId: Id<"visitors">, followUpId: Id<"followUps">) => {
    if (!isAdmin) return;
    try {
      await removeVisitorMutation({ visitorId, followUpId });
      setToast("Visitor removed and follow-up archived");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const handleAddProtocol = async () => {
    const clerkId = isWhatsAppOnly ? `wa:phone:${whatsappPhone.trim()}` : newProtocolClerkId.trim();
    if (!clerkId || !newProtocolDisplayName.trim()) {
      setToast(isWhatsAppOnly ? "Enter phone number and display name" : "Enter Clerk ID and display name");
      return;
    }
    try {
      await addProtocolMutation({
        clerkId,
        displayName: newProtocolDisplayName.trim(),
      });
      setToast("Protocol member added");
      setNewProtocolClerkId("");
      setNewProtocolDisplayName("");
      setWhatsappPhone("");
      setIsWhatsAppOnly(false);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const handleGenerateMemberWhatsAppReport = async (p: any) => {
    try {
      const activeAssignments = await convex.query(api.followUps.myFollowUps, { clerkId: p.clerkId });
      if (!activeAssignments || activeAssignments.length === 0) {
        setToast("No active assignments for this member");
        return;
      }
      let report = `*⛪ IMAARA PROTOCOL FOLLOW-UP REPORT*\n`;
      report += `*Follow-up Team Member:* ${p.displayName}\n`;
      report += `*Date:* ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}\n`;
      report += `*Total Active Assignments:* ${activeAssignments.length}\n`;
      report += `=========================\n\n`;

      activeAssignments.forEach((fu: any, index: number) => {
        report += `${index + 1}. *${fu.visitorName}*\n`;
        if (fu.visitorContact) {
          report += `📱 Contact: ${fu.visitorContact}\n`;
        }
        if (fu.visitorResidence) {
          report += `🏠 Residence: ${fu.visitorResidence}\n`;
        }
        report += `⏳ Pipeline Stage: *${fu.visitorPipelineStage ? fu.visitorPipelineStage.replace(/_/g, " ").toUpperCase() : "NEW"}*\n`;
        report += `📅 Current week: Week ${fu.weekNumber ?? 1}\n`;
        
        const statusLabel = STATUS_OPTIONS.find(s => s.value === fu.status)?.label || fu.status;
        report += `💬 Call Status: ${statusLabel}\n`;
        report += `\n`;
      });

      report += `=========================\n`;
      report += `_Generated via Imaara Church System_`;

      window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to fetch assignments");
    }
  };

  const handleExportActivityPDF = () => {
    if (!protocolListAll) return;

    // Calculate active count per clerk ID
    const activeCounts: Record<string, number> = {};
    (listAll ?? []).forEach((f) => {
      if (f.assignedToClerkId) {
        activeCounts[f.assignedToClerkId] = (activeCounts[f.assignedToClerkId] ?? 0) + 1;
      }
    });

    // Map graduate counts
    const gradCounts: Record<string, number> = {};
    (graduates ?? []).forEach((g) => {
      gradCounts[g.clerkId] = g.count;
    });

    // Compile rows
    const rows = protocolListAll.map((p) => {
      const active = activeCounts[p.clerkId] ?? 0;
      const graduated = gradCounts[p.clerkId] ?? 0;
      const total = active + graduated;
      const rate = total > 0 ? Math.round((graduated / total) * 100) : 0;
      return {
        name: p.displayName,
        active,
        graduated,
        rate,
        status: p.active ? "Active" : "Inactive"
      };
    }).sort((a, b) => b.rate - a.rate); // Sort by graduation rate

    const totalActive = rows.reduce((sum, r) => sum + r.active, 0);
    const totalGraduated = rows.reduce((sum, r) => sum + r.graduated, 0);
    const overallRate = (totalActive + totalGraduated) > 0
      ? Math.round((totalGraduated / (totalActive + totalGraduated)) * 100)
      : 0;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Protocol Team Follow-up Activity Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
          body {
            font-family: 'Outfit', sans-serif;
            background-color: #faf9f7;
            color: #3d3a36;
            margin: 40px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #c9a87c;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .header h1 {
            font-size: 22px;
            font-weight: 500;
            margin: 0;
            color: #3d3a36;
          }
          .header p {
            font-size: 13px;
            color: #6b6864;
            margin: 5px 0 0 0;
          }
          .logo-container {
            text-align: right;
          }
          .logo-main {
            font-size: 18px;
            font-weight: 600;
            color: #3d3a36;
            letter-spacing: 0.5px;
          }
          .logo-sub {
            font-size: 11px;
            color: #c9a87c;
          }
          .summary-cards {
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
          }
          .card {
            flex: 1;
            background: #fff;
            border: 1px solid #e8e6e3;
            border-radius: 12px;
            padding: 12px;
            text-align: center;
          }
          .card .val {
            font-size: 24px;
            font-weight: 600;
            color: #3d3a36;
          }
          .card .lbl {
            font-size: 11px;
            color: #9a9793;
            margin-top: 3px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e8e6e3;
          }
          th, td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #e8e6e3;
          }
          th {
            background-color: #f0ede8;
            color: #3d3a36;
            font-weight: 500;
            font-size: 12px;
          }
          td {
            font-size: 12px;
            color: #5a5856;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #9a9793;
            border-top: 1px solid #e8e6e3;
            padding-top: 12px;
          }
          @media print {
            body {
              background-color: #fff;
              margin: 15px;
            }
          }
        </style>
      </head>
      <body onload="window.print()">
        <div class="header">
          <div>
            <h1>Protocol Team Activity Report</h1>
            <p>Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <div class="logo-container">
            <div class="logo-main">The Imaara Mall 3rd Floor</div>
            <div class="logo-sub">Imara Daima Altar</div>
          </div>
        </div>

        <div class="summary-cards">
          <div class="card">
            <div class="val">${totalActive}</div>
            <div class="lbl">Active Assignments</div>
          </div>
          <div class="card">
            <div class="val">${totalGraduated}</div>
            <div class="lbl">Completed Graduates</div>
          </div>
          <div class="card">
            <div class="val">${overallRate}%</div>
            <div class="lbl">Overall Graduation Rate</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Protocol Member</th>
              <th>Status</th>
              <th>Active Assignments</th>
              <th>Completed Graduates</th>
              <th>Graduation Rate</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.status}</td>
                <td>${r.active}</td>
                <td>${r.graduated}</td>
                <td>${r.rate}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer">
          Imaara Church Management System • Follow-up & visitor Management
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleToggleProtocolActive = async (id: Id<"protocolMembers">, currentActive: boolean) => {
    try {
      await updateProtocolMutation({ id, active: !currentActive });
      setToast(currentActive ? "Deactivated" : "Activated");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleMarkGraduated = async (followUpId: Id<"followUps">) => {
    try {
      await markAsGraduatedMutation({ followUpId });
      setToast("Marked as graduated");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to mark graduated");
    }
  };

  if (typeof window !== "undefined" && isAuthenticated && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <div className="text-center" style={{ color: colors.text.secondary }}>
          <p className="mb-4">You need follow-up-admin or admin role to access this page.</p>
          <Link href="/" className="text-sm" style={{ color: colors.accent.amber }}>Home</Link>
        </div>
      </div>
    );
  }

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
            Follow-ups
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/follow-ups/my"
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
            >
              My list
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 pb-24">
          {/* Toast */}
          {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "list", label: `All (${listAll?.length ?? 0})` },
                { id: "assign", label: "Assign" },
                { id: "removal", label: `Queue (${removalQueue?.length ?? 0})` },
                { id: "graduates", label: "Graduates" },
                { id: "protocol", label: "Team" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-3 py-1.5 rounded-full text-xs transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.id ? colors.accent.amberLight : colors.surface,
                    color: activeTab === tab.id ? colors.text.primary : colors.text.secondary,
                    fontWeight: activeTab === tab.id ? 500 : 400,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {(activeTab === "list" || activeTab === "protocol") && (
              <button
                onClick={handleExportActivityPDF}
                className="text-xs px-3 py-1.5 rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium"
              >
                📄 Export Activity PDF
              </button>
            )}
          </div>

          {/* All Follow-ups Tab */}
          {activeTab === "list" && (
            <div className="space-y-2">
              {listAll === undefined ? (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
              ) : listAll.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                  No active follow-ups
                </div>
              ) : (
                listAll.map((f) => {
                  const status = STATUS_OPTIONS.find((s) => s.value === f.status);
                  const assignee = protocolList?.find((p) => p.clerkId === f.assignedToClerkId);
                  return (
                    <div
                      key={f._id}
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm" style={{ color: colors.text.primary }}>
                              {f.visitorName}
                            </span>
                            {f.removalRequested && (
                              <span className="text-xs" style={{ color: colors.accent.terracotta }}>
                                removal requested
                              </span>
                            )}
                          </div>
                          <div className="text-xs mb-2" style={{ color: colors.text.muted }}>
                            {formatDateLong(f.visitorDate)} • {assignee?.displayName ?? "Unassigned"}
                          </div>
                          <span 
                            className="text-xs"
                            style={{ color: status?.color ?? colors.text.muted }}
                          >
                            {status?.label ?? f.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReassignFollowUpId(f._id)}
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => handleMarkGraduated(f._id)}
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                          >
                            Graduate
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Assign Tab - with sticky bottom bar */}
          {activeTab === "assign" && (
            <div className="space-y-4 pb-32 sm:pb-20">
              {/* Protocol Member Selection */}
              <div>
                <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                  Assign to
                </div>
                <div className="flex flex-wrap gap-2">
                  {getProtocolOptions().map((p) => (
                    <button
                      key={p.clerkId}
                      onClick={() => setSelectedAssignee(p.clerkId)}
                      className="px-3 py-1.5 rounded-full text-xs transition-colors"
                      style={{
                        backgroundColor: selectedAssignee === p.clerkId ? colors.accent.amberLight : colors.surface,
                        color: selectedAssignee === p.clerkId ? colors.text.primary : colors.text.secondary,
                        fontWeight: selectedAssignee === p.clerkId ? 500 : 400,
                      }}
                    >
                      {p.displayName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eligible Visitors */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    Eligible visitors
                  </span>
                  {eligible && eligible.length > 0 && (
                    <button
                      onClick={() => {
                        const allSelected = eligible.every((v) => selectedVisitorIds.has(v._id as Id<"visitors">));
                        if (allSelected) {
                          setSelectedVisitorIds(new Set());
                        } else {
                          setSelectedVisitorIds(new Set(eligible.map((v) => v._id as Id<"visitors">)));
                        }
                      }}
                      className="text-xs"
                      style={{ color: colors.accent.amber }}
                    >
                      {eligible.every((v) => selectedVisitorIds.has(v._id as Id<"visitors">)) ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>

                {eligible === undefined ? (
                  <div className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
                ) : eligible.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                    No eligible visitors
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eligible.map((v) => {
                      const checked = selectedVisitorIds.has(v._id as Id<"visitors">);
                      return (
                        <label
                          key={v._id}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                          style={{ backgroundColor: colors.surface }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedVisitorIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(v._id as Id<"visitors">);
                                else next.delete(v._id as Id<"visitors">);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm" style={{ color: colors.text.primary }}>{v.name}</div>
                            <div className="text-xs" style={{ color: colors.text.muted }}>
                              {formatDateLong(v.date)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sticky Assign Button */}
              <div 
                className="fixed bottom-16 sm:bottom-0 left-0 right-0 p-4 z-40"
                style={{ 
                  backgroundColor: colors.bg,
                  borderTop: `1px solid rgba(61, 58, 54, 0.06)`
                }}
              >
                <div className="max-w-2xl mx-auto">
                  <button
                    onClick={handleAssignSelected}
                    disabled={!selectedAssignee || selectedVisitorIds.size === 0}
                    className="w-full py-3 rounded-xl text-sm disabled:opacity-50"
                    style={{ 
                      backgroundColor: colors.text.primary, 
                      color: '#fff' 
                    }}
                  >
                    {selectedVisitorIds.size > 0 
                      ? `Assign ${selectedVisitorIds.size} visitor${selectedVisitorIds.size > 1 ? 's' : ''}`
                      : 'Select visitors to assign'
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Removal Queue Tab */}
          {activeTab === "removal" && (
            <div className="space-y-2">
              {removalQueue === undefined ? (
                <div className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
              ) : removalQueue.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                  No removal requests
                </div>
              ) : (
                removalQueue.map((f) => (
                  <div
                    key={f._id}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <div className="text-sm mb-1" style={{ color: colors.text.primary }}>
                      {f.visitorName}
                    </div>
                    <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                      {f.removalReason}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleApproveRemoval(f.visitorId, f._id)}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}
                      >
                        Approve removal
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Graduates Tab */}
          {activeTab === "graduates" && (
            <div className="space-y-6">
              {/* By Protocol Member */}
              <div>
                <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                  By team member
                </div>
                {graduates === undefined ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
                ) : graduates.length === 0 ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>No graduates yet</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {graduates.map((g) => (
                      <span
                        key={g.clerkId}
                        className="px-3 py-1.5 rounded-full text-xs"
                        style={{ backgroundColor: colors.accent.sageLight, color: colors.accent.sage }}
                      >
                        {g.displayName}: {g.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Graduates */}
              <div>
                <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                  Recent graduates
                </div>
                {recentGrads === undefined ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
                ) : recentGrads.length === 0 ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>None yet</div>
                ) : (
                  <div className="space-y-2">
                    {recentGrads.map((g) => (
                      <div
                        key={g.followUpId}
                        className="p-3 rounded-xl text-sm"
                        style={{ backgroundColor: colors.surface, color: colors.text.secondary }}
                      >
                        {g.visitorName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Protocol Team Tab */}
          {activeTab === "protocol" && (
            <div className="space-y-4">
              {/* Add New */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                <div className="text-xs mb-3" style={{ color: colors.text.muted }}>
                  Add protocol member
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer mb-2" style={{ color: colors.text.secondary }}>
                    <input
                      type="checkbox"
                      checked={isWhatsAppOnly}
                      onChange={(e) => {
                        setIsWhatsAppOnly(e.target.checked);
                        if (e.target.checked) {
                          setNewProtocolClerkId("");
                        } else {
                          setWhatsappPhone("");
                        }
                      }}
                      className="rounded"
                    />
                    WhatsApp-only (No system access)
                  </label>
                  {!isWhatsAppOnly ? (
                    <input
                      type="text"
                      value={newProtocolClerkId}
                      onChange={(e) => setNewProtocolClerkId(e.target.value)}
                      placeholder="Clerk user ID"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="Phone number (e.g. +254712345678)"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                    />
                  )}
                  <input
                    type="text"
                    value={newProtocolDisplayName}
                    onChange={(e) => setNewProtocolDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                  />
                  <button
                    onClick={handleAddProtocol}
                    disabled={isWhatsAppOnly ? (!whatsappPhone.trim() || !newProtocolDisplayName.trim()) : (!newProtocolClerkId.trim() || !newProtocolDisplayName.trim())}
                    className="w-full py-2 rounded-lg text-sm disabled:opacity-50"
                    style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                  >
                    Add member
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="space-y-2">
                {protocolListAll === undefined ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</div>
                ) : protocolListAll.length === 0 ? (
                  <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>No protocol members</div>
                ) : (
                  protocolListAll.map((p) => (
                    <div
                      key={p._id}
                      className="flex flex-col gap-2 p-3 rounded-xl"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: p.active ? colors.text.primary : colors.text.muted }}>
                          {p.displayName} {p.clerkId.startsWith("wa:phone:") && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-light ml-1.5">WhatsApp Only</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleProtocolActive(p._id, p.active)}
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: p.active ? colors.accent.sageLight : colors.surfaceHover,
                              color: p.active ? colors.accent.sage : colors.text.muted,
                            }}
                          >
                            {p.active ? "Active" : "Inactive"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1 pt-2 border-t border-black/[0.04]">
                        <Link
                          href={`/follow-ups/my?clerkId=${p.clerkId}`}
                          className="text-xs px-2.5 py-1 rounded-full transition-colors"
                          style={{ backgroundColor: colors.bg, color: colors.text.secondary }}
                        >
                          👁️ View List
                        </Link>
                        <button
                          onClick={() => handleGenerateMemberWhatsAppReport(p)}
                          className="text-xs px-2.5 py-1 rounded-full transition-colors"
                          style={{ backgroundColor: colors.accent.amberLight, color: colors.text.primary }}
                        >
                          💬 WhatsApp Report
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Reassign Modal */}
          {reassignFollowUpId && (
            <div 
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
            >
              <div 
                className="w-full max-w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="text-sm mb-4" style={{ color: colors.text.primary }}>
                  Reassign to
                </div>
                <div className="space-y-2 mb-4">
                  {getProtocolOptions().map((p) => (
                    <button
                      key={p.clerkId}
                      onClick={() => handleReassignTo(p.clerkId)}
                      className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                      style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                    >
                      {p.displayName}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setReassignFollowUpId(null)}
                  className="w-full py-3 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthenticatedLayout>
  );
}
