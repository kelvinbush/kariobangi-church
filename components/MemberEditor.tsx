"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { amber: '#c9a87c', amberLight: '#e8dcc8', sage: '#9db88c', sageLight: '#c5d4be', terracotta: '#c49a84', terracottaLight: '#e8d8cc' }
};

// Departments from the church structure
const DEPARTMENTS = [
  "Worship Team",
  "Keyboard Dept",
  "Violinists",
  "Security Team",
  "Prisons",
  "Hospital",
  "Logistics",
  "Clusters",
  "Imara Studio",
  "Marriage",
  "Sanitation",
  "Ushers",
  "Home Fellowships",
  "Finance",
  "Communication",
  "Decoration",
  "Protocol",
  "Sunday School",
  "Kitchen",
  "Clean Water",
  "Translation",
  "Gate 1",
  "Welfare",
  "Technical Team"
];

export type MemberSummary = {
  memberId: string;
  name: string;
  contact: string | null;
  residence: string | null;
  gender: string | null;
  department: string | null;
  status: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  member: MemberSummary;
  onSaved?: () => void;
  allowMoveToKids?: boolean;
};

export default function MemberEditor({ open, onClose, member, onSaved, allowMoveToKids }: Props) {
  const { user } = useUser();
  const [name, setName] = useState(member.name);
  const [contact, setContact] = useState(member.contact ?? "");
  const [residence, setResidence] = useState(member.residence ?? "");
  const [gender, setGender] = useState(member.gender ?? "");
  const [department, setDepartment] = useState(member.department ?? "");
  const [status, setStatus] = useState(member.status ?? "");
  const [kidAge, setKidAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [movingToKids, setMovingToKids] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMember = useMutation(api.members.update);
  const removeMember = useMutation(api.members.remove);
  const convertToKid = useMutation(api.members.convertToKid);

  const isAdmin = (user?.publicMetadata as any)?.role === "admin";

  useEffect(() => {
    if (!open) return;
    setName(member.name);
    setContact(member.contact ?? "");
    setResidence(member.residence ?? "");
    setGender(member.gender ?? "");
    setDepartment(member.department ?? "");
    setStatus(member.status ?? "");
    setKidAge("");
    setMovingToKids(false);
  }, [open, member]);

  function validPhone(p: string) {
    const s = p.trim();
    if (!s) return true;
    return /^(?:\+?\d{10,15}|0\d{8,10}|[1-9]\d{7,})$/.test(s);
  }

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (!validPhone(contact)) {
      setError("Please enter a valid phone number or leave blank.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateMember({
        memberId: member.memberId as any,
        name: name.trim() || undefined,
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        gender: gender.trim() || undefined,
        department: department.trim() || undefined,
        status: status.trim() || undefined,
      } as any);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update member.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-[10000] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: colors.surface }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <h3 className="text-base" style={{ color: colors.text.primary }}>Edit Member</h3>
          <button onClick={onClose} style={{ color: colors.text.muted }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
          </div>

          {/* Contact & Residence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Phone</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Residence</label>
              <input value={residence} onChange={(e) => setResidence(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
            </div>
          </div>

          {/* Gender & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                <option value="">Select</option>
                <option value="married">Married</option>
                <option value="youth">Youth</option>
                <option value="single">Single</option>
                <option value="widow">Widow</option>
                <option value="widower">Widower</option>
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
              <option value="">Select Department</option>
              {DEPARTMENTS.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
            </select>
          </div>

          {/* Move to Kids - Admin only */}
          {allowMoveToKids && isAdmin && (
            <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: colors.accent.amberLight }}>
              <div className="text-sm" style={{ color: colors.text.primary }}>Move to Kids List</div>
              <p className="text-xs" style={{ color: colors.text.secondary }}>This will move the member to kids list. Attendance history is preserved.</p>
              <div className="flex gap-2">
                <input type="number" min={0} max={150} value={kidAge} onChange={(e) => setKidAge(e.target.value)} placeholder="Age" className="w-20 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }} />
                <button type="button" disabled={movingToKids || !name.trim()} onClick={async () => { const ageNum = kidAge.trim() ? parseInt(kidAge.trim(), 10) : undefined; if (kidAge.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) { setError("Invalid age"); return; } setMovingToKids(true); try { await convertToKid({ memberId: member.memberId as any, name: name.trim() || undefined, contact: contact.trim() || undefined, residence: residence.trim() || undefined, age: ageNum }); onSaved?.(); onClose(); } catch (e: any) { setError(e?.message ?? "Failed to move"); } finally { setMovingToKids(false); } }} className="flex-1 py-2 rounded-xl text-xs" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{movingToKids ? "Moving..." : "Move to Kids"}</button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div className="text-xs text-center py-2" style={{ color: colors.accent.terracotta }}>{error}</div>}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isAdmin && (
              <button type="button" disabled={loading} onClick={async () => { if (!window.confirm(`Delete ${name || "member"}?`)) return; setLoading(true); try { await removeMember({ memberId: member.memberId as any } as any); onSaved?.(); onClose(); } catch (e: any) { setError(e?.message ?? "Failed to delete"); } finally { setLoading(false); } }} className="px-4 py-2.5 rounded-xl text-sm" style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}>Delete</button>
            )}
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{loading ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
