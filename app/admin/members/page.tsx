"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import MemberEditor, { MemberSummary } from "@/components/MemberEditor";
import KidEditor, { KidSummary } from "@/components/KidEditor";
import VisitorEditor, { VisitorSummary } from "@/components/VisitorEditor";
import { getTodayLocal } from "@/lib/date";

const DEPARTMENTS = [
  "Worship Team", "Keyboard Dept", "Violinists", "Security Team", "Prisons", "Hospital",
  "Logistics", "Sanitation", "Ushers", "Home Fellowships", "Finance", "Communication",
  "Decoration", "Protocol", "Sunday School", "Kitchen", "Clean Water", "Translation",
  "Gate 1", "Welfare", "Technical Team"
];

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { 
    amber: '#0D9762', 
    amberLight: '#a7ddc7', 
    sage: '#154618', 
    sageLight: '#c3d3c4',
    red: '#ef4444',
    redLight: '#fee2e2'
  }
};

const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 2000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[11000] px-5 py-3 rounded-full text-sm shadow-lg font-medium" style={{ backgroundColor: colors.text.primary, color: '#fff' }}>
      {message}
    </div>
  );
}

// Phone normalization helper
function normalizePhoneForComparison(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return digits.slice(3); // 9-digit suffix
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return digits.slice(1); // 9-digit suffix
  }
  return digits;
}

export default function AdminMembersPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"export" | "members" | "kids" | "visitors">("export");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Toast notifications
  const [toast, setToast] = useState<string | null>(null);

  // Edit states
  const [editingMember, setEditingMember] = useState<MemberSummary | null>(null);
  const [editingKid, setEditingKid] = useState<KidSummary | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<VisitorSummary | null>(null);

  // Add modals state
  const [addModalType, setAddModalType] = useState<"member" | "kid" | "visitor" | null>(null);

  // Form states for adding
  const [addName, setAddName] = useState("");
  const [addContact, setAddContact] = useState("");
  const [addResidence, setAddResidence] = useState("");
  const [addGender, setAddGender] = useState("");
  const [addDepartment, setAddDepartment] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [addAge, setAddAge] = useState("");
  const [addPrevChurch, setAddPrevChurch] = useState("");
  const [addRelStatus, setAddRelStatus] = useState("");
  const [addDate, setAddDate] = useState(getTodayLocal());
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Backend queries
  const members = useQuery(api.members.list, isAuthenticated ? {} : "skip");
  const kids = useQuery(api.kids.list, isAuthenticated ? {} : "skip");
  const visitors = useQuery(api.visitors.list, isAuthenticated ? {} : "skip");

  // Mutations
  const addMemberMut = useMutation(api.members.add);
  const addKidMut = useMutation(api.kids.add);
  const addVisitorMut = useMutation(api.visitors.add);

  const removeMember = useMutation(api.members.remove);
  const removeKid = useMutation(api.kids.remove);
  const removeVisitor = useMutation(api.visitors.remove);

  // Check admin role
  const userRoles = useMemo(() => {
    const meta = user?.publicMetadata as { role?: string; roles?: string[] } | undefined;
    const roles = new Set<string>();
    if (meta?.role) roles.add(meta.role);
    meta?.roles?.forEach(r => roles.add(r));
    return Array.from(roles);
  }, [user]);

  const isAdmin = userRoles.includes("admin");

  // Export filters
  const [deduplicate, setDeduplicate] = useState(true);
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeKids, setIncludeKids] = useState(true);
  const [includeVisitors, setIncludeVisitors] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);

  // Reset add form fields
  const resetAddForm = () => {
    setAddName("");
    setAddContact("");
    setAddResidence("");
    setAddGender("");
    setAddDepartment("");
    setAddStatus("");
    setAddAge("");
    setAddPrevChurch("");
    setAddRelStatus("");
    setAddDate(getTodayLocal());
    setAddError(null);
  };

  // Add handlers
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setSubmittingAdd(true);
    setAddError(null);
    try {
      if (addModalType === "member") {
        await addMemberMut({
          name: addName.trim(),
          contact: addContact.trim(),
          gender: addGender.trim(),
          residence: addResidence.trim(),
        });
        setToast("Member added successfully");
      } else if (addModalType === "kid") {
        const ageNum = addAge.trim() ? parseInt(addAge.trim(), 10) : undefined;
        await addKidMut({
          name: addName.trim(),
          contact: addContact.trim(),
          residence: addResidence.trim(),
          age: ageNum,
        });
        setToast("Kid added successfully");
      } else if (addModalType === "visitor") {
        const ageNum = addAge.trim() ? parseInt(addAge.trim(), 10) : undefined;
        await addVisitorMut({
          name: addName.trim(),
          contact: addContact.trim(),
          residence: addResidence.trim(),
          relationshipStatus: addRelStatus.trim(),
          previousChurch: addPrevChurch.trim(),
          age: ageNum,
          gender: addGender.trim() || undefined,
          date: addDate,
        });
        setToast("Visitor added successfully");
      }
      setAddModalType(null);
      resetAddForm();
    } catch (err: any) {
      setAddError(err?.message ?? "An error occurred while adding");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Delete handlers
  const handleDeleteMember = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete member "${name}"? This will also purge their attendance records.`)) return;
    try {
      await removeMember({ memberId: id as any });
      setToast("Member deleted");
    } catch (err: any) {
      setToast("Error: " + err.message);
    }
  };

  const handleDeleteKid = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete kid "${name}"? This will also purge their attendance records.`)) return;
    try {
      await removeKid({ kidId: id as any });
      setToast("Kid deleted");
    } catch (err: any) {
      setToast("Error: " + err.message);
    }
  };

  const handleDeleteVisitor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete visitor "${name}"? This will also purge their attendance records.`)) return;
    try {
      await removeVisitor({ visitorId: id as any });
      setToast("Visitor deleted");
    } catch (err: any) {
      setToast("Error: " + err.message);
    }
  };

  // Consolidate list for exporting
  const rawExportList = useMemo(() => {
    const list: any[] = [];
    if (includeMembers && members) {
      members.forEach((m) => {
        if (!onlyActive || m.active) {
          list.push({ id: m._id, name: m.name, phone: m.contact, type: "Member", active: m.active });
        }
      });
    }
    if (includeKids && kids) {
      kids.forEach((k) => {
        if (!onlyActive || k.active) {
          list.push({ id: k._id, name: k.name, phone: k.contact, type: "Kid", active: k.active });
        }
      });
    }
    if (includeVisitors && visitors) {
      visitors.forEach((v) => {
        if (!onlyActive || v.active) {
          list.push({ id: v._id, name: v.name, phone: v.contact, type: "Visitor", active: v.active });
        }
      });
    }

    // Priority Sort: Active status first, then Member > Visitor > Kid, then Name
    return list.sort((a, b) => {
      const pA = a.type === "Member" ? 3 : a.type === "Visitor" ? 2 : 1;
      const pB = b.type === "Member" ? 3 : b.type === "Visitor" ? 2 : 1;
      if (pB !== pA) return pB - pA;
      return a.name.localeCompare(b.name);
    });
  }, [members, kids, visitors, includeMembers, includeKids, includeVisitors, onlyActive]);

  // Compute Deduplication & Omission Details
  const exportContacts = useMemo(() => {
    const seen = new Map<string, string>(); // normalized_phone -> first_included_name
    
    return rawExportList.map((item) => {
      if (!item.phone || !item.phone.trim()) {
        return { ...item, status: "No Phone" as const, details: "No phone number registered" };
      }
      
      const norm = normalizePhoneForComparison(item.phone);
      if (!deduplicate) {
        return { ...item, status: "Included" as const, details: "Exporting raw number" };
      }

      if (seen.has(norm)) {
        return { 
          ...item, 
          status: "Omitted" as const, 
          details: `Duplicate of ${seen.get(norm)} (${item.phone})` 
        };
      }

      seen.set(norm, item.name);
      return { ...item, status: "Included" as const, details: "Primary number" };
    });
  }, [rawExportList, deduplicate]);

  // Unique phone list to download
  const downloadList = useMemo(() => {
    return exportContacts.filter(item => item.status === "Included");
  }, [exportContacts]);

  // Download Excel (CSV with Excel compatibility formula to preserve leading zero)
  const handleDownloadExcel = () => {
    if (downloadList.length === 0) {
      setToast("No contacts to export");
      return;
    }

    // Column headers
    const headers = "Name,Phone Number";
    
    // Rows
    const rows = downloadList.map(item => {
      // Escape double quotes inside names
      const nameEscaped = item.name.replace(/"/g, '""');
      
      // Wrap phone number in Excel formula: ="PHONE" to keep the leading zero on import
      const phoneEscaped = item.phone ? `="${item.phone.replace(/\s+/g, '')}"` : "";
      
      return `"${nameEscaped}",${phoneEscaped}`;
    });

    const csvContent = [headers, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Kariobangi_Church_Contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Searching lists client side
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m => m.name.toLowerCase().includes(q) || (m.contact && m.contact.includes(q)) || (m.residence && m.residence.toLowerCase().includes(q)));
  }, [members, searchQuery]);

  const filteredKids = useMemo(() => {
    if (!kids) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return kids;
    return kids.filter(k => k.name.toLowerCase().includes(q) || (k.contact && k.contact.includes(q)) || (k.residence && k.residence.toLowerCase().includes(q)));
  }, [kids, searchQuery]);

  const filteredVisitors = useMemo(() => {
    if (!visitors) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return visitors;
    return visitors.filter(v => v.name.toLowerCase().includes(q) || (v.contact && v.contact.includes(q)) || (v.residence && v.residence.toLowerCase().includes(q)));
  }, [visitors, searchQuery]);

  const filteredExport = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return exportContacts;
    return exportContacts.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [exportContacts, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <span className="text-sm" style={{ color: colors.text.muted }}>Loading session...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: colors.bg }}>
        <div className="text-center space-y-3">
          <h2 className="text-xl font-light">Access Denied</h2>
          <p className="text-sm text-zinc-500 max-w-sm">This page is only accessible by administrators. Redirecting to your dashboard...</p>
          <Link href="/" className="inline-block px-4 py-2 bg-[#0D9762] text-white rounded-xl text-sm mt-2">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}><DotPattern /></div>
      
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between" style={{ backgroundColor: colors.bg, borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>Dashboard</Link>
            <span className="text-sm" style={{ color: colors.text.secondary }}>Manage & Export</span>
          </div>
          <SignedIn><UserButton /></SignedIn>
        </header>

        <main className="max-w-4xl mx-auto px-5 py-8 pb-32">
          {/* Greeting */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-light tracking-tight" style={{ color: colors.text.primary }}>
                Members & Visitors Directory
              </h1>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                Export deduplicated contacts and manage member registration.
              </p>
            </div>
            {activeTab !== "export" && (
              <button 
                onClick={() => setAddModalType(activeTab === "members" ? "member" : activeTab === "kids" ? "kid" : "visitor")}
                className="px-4 py-2 text-sm rounded-xl font-medium shadow-sm flex items-center gap-1.5 self-start md:self-auto"
                style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add {activeTab === "members" ? "Member" : activeTab === "kids" ? "Kid" : "Visitor"}
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b mb-6 overflow-x-auto whitespace-nowrap" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
            {(["export", "members", "kids", "visitors"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSearchQuery(""); }}
                className="px-5 py-3 text-sm capitalize font-medium transition-colors border-b-2 -mb-[2px]"
                style={{
                  color: activeTab === tab ? colors.accent.amber : colors.text.secondary,
                  borderColor: activeTab === tab ? colors.accent.amber : 'transparent'
                }}
              >
                {tab === "export" ? "Export List" : tab}
              </button>
            ))}
          </div>

          {/* Global Search Bar */}
          <div className="mb-6">
            <input 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder={`Search in ${activeTab === "export" ? "export directory" : activeTab}...`} 
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 outline-none text-sm shadow-sm"
              style={{ backgroundColor: colors.surface, color: colors.text.primary }}
            />
          </div>

          {/* TAB 1: EXPORT LIST */}
          {activeTab === "export" && (
            <div className="space-y-6">
              {/* Export Filters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stats Card */}
                <div className="p-5 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between" style={{ backgroundColor: colors.surface }}>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.text.muted }}>Export Overview</h3>
                    <div className="flex items-baseline gap-4 mb-2">
                      <span className="text-4xl font-light">{downloadList.length}</span>
                      <span className="text-xs" style={{ color: colors.text.muted }}>Unique contacts to export</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownloadExcel}
                    className="w-full py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 mt-4"
                    style={{ backgroundColor: colors.accent.amber, color: '#fff' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export to Excel (CSV)
                  </button>
                </div>

                {/* Filters Option Card */}
                <div className="p-5 rounded-2xl shadow-sm border border-zinc-100 space-y-3.5" style={{ backgroundColor: colors.surface }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Options</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.text.secondary }}>
                      <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="rounded accent-[#0D9762]" />
                      Deduplicate phone numbers
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.text.secondary }}>
                      <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="rounded accent-[#0D9762]" />
                      Only active profiles
                    </label>
                    <div className="h-px bg-zinc-100 my-2" />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                        <input type="checkbox" checked={includeMembers} onChange={(e) => setIncludeMembers(e.target.checked)} className="rounded accent-[#0D9762]" />
                        Members
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                        <input type="checkbox" checked={includeKids} onChange={(e) => setIncludeKids(e.target.checked)} className="rounded accent-[#0D9762]" />
                        Kids
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.secondary }}>
                        <input type="checkbox" checked={includeVisitors} onChange={(e) => setIncludeVisitors(e.target.checked)} className="rounded accent-[#0D9762]" />
                        Visitors
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm" style={{ backgroundColor: colors.surface }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Name</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Phone</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Type</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExport.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                            No matching contacts found in selection.
                          </td>
                        </tr>
                      ) : (
                        filteredExport.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-none" style={{ borderColor: 'rgba(0, 0, 0, 0.03)' }}>
                            <td className="px-5 py-3 text-sm font-medium" style={{ color: colors.text.primary }}>{item.name}</td>
                            <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{item.phone || <span className="italic" style={{ color: colors.text.muted }}>None</span>}</td>
                            <td className="px-5 py-3 text-xs" style={{ color: colors.text.muted }}>{item.type}</td>
                            <td className="px-5 py-3 text-xs">
                              <span 
                                className="px-2 py-0.5 rounded-full font-medium inline-block max-w-[200px] truncate"
                                title={item.details}
                                style={{
                                  backgroundColor: item.status === "Included" ? 'rgba(13, 151, 98, 0.1)' : item.status === "Omitted" ? 'rgba(245, 158, 11, 0.1)' : 'rgba(161, 161, 161, 0.1)',
                                  color: item.status === "Included" ? colors.accent.amber : item.status === "Omitted" ? '#d97706' : colors.text.muted
                                }}
                              >
                                {item.status === "Included" ? "Included" : item.status === "Omitted" ? "Omitted (Duplicate)" : "No Contact"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEMBERS */}
          {activeTab === "members" && (
            <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm" style={{ backgroundColor: colors.surface }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Name</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Contact</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Residence</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Department</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                          {members === undefined ? "Loading members..." : "No members found."}
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => (
                        <tr key={m._id} className="border-b last:border-none" style={{ borderColor: 'rgba(0, 0, 0, 0.03)' }}>
                          <td className="px-5 py-3 text-sm font-medium" style={{ color: colors.text.primary }}>
                            <div className="flex items-center gap-2">
                              <span>{m.name}</span>
                              {!m.active && <span className="text-[9px] px-1 bg-red-100 text-red-700 rounded-full font-normal">Inactive</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{m.contact || "—"}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{m.residence || "—"}</td>
                          <td className="px-5 py-3 text-xs" style={{ color: colors.text.muted }}>{m.department || "—"}</td>
                          <td className="px-5 py-3 text-xs">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setEditingMember({
                                    memberId: m._id,
                                    name: m.name,
                                    contact: m.contact,
                                    residence: m.residence,
                                    gender: m.gender,
                                    department: m.department,
                                    status: m.status
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100"
                                style={{ color: colors.accent.amber }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteMember(m._id, m.name)}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-50 text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: KIDS */}
          {activeTab === "kids" && (
            <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm" style={{ backgroundColor: colors.surface }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Name</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Parent Phone</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Residence</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Age</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKids.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                          {kids === undefined ? "Loading kids..." : "No kids found."}
                        </td>
                      </tr>
                    ) : (
                      filteredKids.map((k) => (
                        <tr key={k._id} className="border-b last:border-none" style={{ borderColor: 'rgba(0, 0, 0, 0.03)' }}>
                          <td className="px-5 py-3 text-sm font-medium" style={{ color: colors.text.primary }}>
                            <div className="flex items-center gap-2">
                              <span>{k.name}</span>
                              {!k.active && <span className="text-[9px] px-1 bg-red-100 text-red-700 rounded-full font-normal">Inactive</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{k.contact || "—"}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{k.residence || "—"}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{k.age !== undefined ? k.age : "—"}</td>
                          <td className="px-5 py-3 text-xs">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setEditingKid({
                                    memberId: k._id,
                                    name: k.name,
                                    contact: k.contact,
                                    residence: k.residence,
                                    age: k.age ?? null
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100"
                                style={{ color: colors.accent.amber }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteKid(k._id, k.name)}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-50 text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: VISITORS */}
          {activeTab === "visitors" && (
            <div className="rounded-2xl border border-zinc-100 overflow-hidden shadow-sm" style={{ backgroundColor: colors.surface }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Name</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Phone</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Residence</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>R/Ship Status</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Date Visited</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisitors.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: colors.text.muted }}>
                          {visitors === undefined ? "Loading visitors..." : "No visitors found."}
                        </td>
                      </tr>
                    ) : (
                      filteredVisitors.map((v) => (
                        <tr key={v._id} className="border-b last:border-none" style={{ borderColor: 'rgba(0, 0, 0, 0.03)' }}>
                          <td className="px-5 py-3 text-sm font-medium" style={{ color: colors.text.primary }}>
                            <div className="flex items-center gap-2">
                              <span>{v.name}</span>
                              {!v.active && <span className="text-[9px] px-1 bg-red-100 text-red-700 rounded-full font-normal">Inactive</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{v.contact || "—"}</td>
                          <td className="px-5 py-3 text-sm" style={{ color: colors.text.secondary }}>{v.residence || "—"}</td>
                          <td className="px-5 py-3 text-sm capitalize" style={{ color: colors.text.secondary }}>{v.relationshipStatus || "—"}</td>
                          <td className="px-5 py-3 text-xs" style={{ color: colors.text.muted }}>{v.date}</td>
                          <td className="px-5 py-3 text-xs">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setEditingVisitor({
                                    memberId: v._id,
                                    name: v.name,
                                    contact: v.contact,
                                    residence: v.residence,
                                    relationshipStatus: v.relationshipStatus,
                                    previousChurch: v.previousChurch,
                                    age: v.age ?? null
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100"
                                style={{ color: colors.accent.amber }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteVisitor(v._id, v.name)}
                                className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-50 text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* MODAL 1: ADD MEMBER / KID / VISITOR */}
        {addModalType !== null && (
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
            <div className="absolute inset-0" onClick={() => setAddModalType(null)} />
            <div className="relative z-[10000] w-full max-w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col bg-white">
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
                <h3 className="text-base font-medium capitalize" style={{ color: colors.text.primary }}>Add New {addModalType}</h3>
                <button onClick={() => setAddModalType(null)} style={{ color: colors.text.muted }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
              </div>

              <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Name *</label>
                  <input value={addName} onChange={(e) => setAddName(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="Full Name" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>{addModalType === "kid" ? "Parent's Phone" : "Phone"}</label>
                    <input value={addContact} onChange={(e) => setAddContact(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="07XXXXXXXX" />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Residence</label>
                    <input value={addResidence} onChange={(e) => setAddResidence(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="Residence" />
                  </div>
                </div>

                {addModalType === "member" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Gender</label>
                      <select value={addGender} onChange={(e) => setAddGender(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Status</label>
                      <select value={addStatus} onChange={(e) => setAddStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                        <option value="">Select</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="youth">Youth</option>
                        <option value="widow">Widow</option>
                        <option value="widower">Widower</option>
                      </select>
                    </div>
                  </div>
                )}

                {addModalType === "kid" && (
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Age</label>
                    <input type="number" min={0} max={17} value={addAge} onChange={(e) => setAddAge(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="Age (optional)" />
                  </div>
                )}

                {addModalType === "visitor" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Gender</label>
                        <select value={addGender} onChange={(e) => setAddGender(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>R/Ship Status</label>
                        <select value={addRelStatus} onChange={(e) => setAddRelStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                          <option value="">Select</option>
                          <option value="youth">Youth</option>
                          <option value="married">Married</option>
                          <option value="single">Single</option>
                          <option value="child">Child</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Age</label>
                        <input type="number" min={0} max={150} value={addAge} onChange={(e) => setAddAge(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="Age" />
                      </div>
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Date Visited</label>
                        <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Previous Church</label>
                      <input value={addPrevChurch} onChange={(e) => setAddPrevChurch(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 outline-none text-sm" style={{ backgroundColor: colors.bg, color: colors.text.primary }} placeholder="Previous Church (optional)" />
                    </div>
                  </>
                )}

                {addError && <div className="text-xs text-red-600 text-center">{addError}</div>}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setAddModalType(null)} className="flex-1 py-2.5 rounded-xl text-sm hover:bg-zinc-100 border border-zinc-200" style={{ color: colors.text.secondary }}>Cancel</button>
                  <button type="submit" disabled={submittingAdd || !addName.trim()} className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50 font-medium" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{submittingAdd ? "Adding..." : "Add"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: EDIT MODALS (REUSING COMPONENT EDITORS) */}
        {editingMember && (
          <MemberEditor 
            open={true} 
            onClose={() => setEditingMember(null)} 
            member={editingMember} 
            onSaved={() => setToast("Member updated successfully")}
          />
        )}

        {editingKid && (
          <KidEditor 
            open={true} 
            onClose={() => setEditingKid(null)} 
            kid={editingKid} 
            onSaved={() => setToast("Kid updated successfully")}
          />
        )}

        {editingVisitor && (
          <VisitorEditor 
            open={true} 
            onClose={() => setEditingVisitor(null)} 
            visitor={editingVisitor} 
            onSaved={() => setToast("Visitor updated successfully")}
          />
        )}

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </AuthenticatedLayout>
  );
}
