"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7', sage: '#154618', sageLight: '#c3d3c4', terracotta: '#0D9762', terracottaLight: '#a7ddc7' }
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

export type KidSummary = {
  memberId: string;
  name: string;
  contact: string | null;
  residence: string | null;
  age: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  kid: KidSummary;
  onSaved?: () => void;
  allowConvertToMember?: boolean;
};

export default function KidEditor({ open, onClose, kid, onSaved, allowConvertToMember }: Props) {
  const { user } = useUser();
  const [name, setName] = useState(kid.name);
  const [contact, setContact] = useState(kid.contact ?? "");
  const [residence, setResidence] = useState(kid.residence ?? "");
  const [age, setAge] = useState(kid.age?.toString() ?? "");
  const [gender, setGender] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [convertingToMember, setConvertingToMember] = useState(false);
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateKid = useMutation(api.kids.update);
  const removeKid = useMutation(api.kids.remove);
  const convertToMember = useMutation(api.kids.convertToMember);

  const isAdmin = (user?.publicMetadata as any)?.role === "admin";

  useEffect(() => {
    if (!open) return;
    setName(kid.name);
    setContact(kid.contact ?? "");
    setResidence(kid.residence ?? "");
    setAge(kid.age?.toString() ?? "");
    setGender("");
    setDepartment("");
    setStatus("");
    setShowConvertForm(false);
  }, [open, kid]);

  function validPhone(p: string) {
    const s = p.trim();
    if (!s) return true;
    return /^(?:\+?\d{10,15}|0\d{8,10}|[1-9]\d{7,})$/.test(s);
  }

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (!validPhone(contact)) { setError("Please enter a valid phone number."); return; }
    const ageNum = age.trim() ? parseInt(age.trim(), 10) : undefined;
    if (age.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) { setError("Invalid age"); return; }
    setLoading(true);
    try {
      await updateKid({ kidId: kid.memberId as any, name: name.trim() || undefined, contact: contact.trim() || undefined, residence: residence.trim() || undefined, age: ageNum } as any);
      setError(null);
      onSaved?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: colors.surface }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(0, 0, 0, 0.06)` }}>
          <h3 className="text-base" style={{ color: colors.text.primary }}>Edit Kid</h3>
          <button onClick={onClose} style={{ color: colors.text.muted }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
          </div>

          {/* Contact & Age */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Parent's Phone</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Age</label>
              <input type="number" min="0" max="150" value={age} onChange={(e) => setAge(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
            </div>
          </div>

          {/* Residence */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: colors.text.muted }}>Residence</label>
            <input value={residence} onChange={(e) => setResidence(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
          </div>

          {/* Convert to Member - Admin only */}
          {allowConvertToMember && isAdmin && (
            <div className="p-3 rounded-xl space-y-3" style={{ backgroundColor: colors.accent.amberLight }}>
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: colors.text.primary }}>Convert to Member</div>
                <button type="button" onClick={() => setShowConvertForm(!showConvertForm)} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>{showConvertForm ? "Hide" : "Show"}</button>
              </div>
              {showConvertForm && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }}>
                      <option value="">Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }}>
                      <option value="">Status</option>
                      <option value="married">Married</option>
                      <option value="youth">Youth</option>
                      <option value="single">Single</option>
                    </select>
                  </div>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.surface, color: colors.text.primary }}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
                  </select>
                  <button type="button" disabled={convertingToMember || !name.trim()} onClick={async () => { setConvertingToMember(true); try { await convertToMember({ kidId: kid.memberId as any, name: name.trim() || undefined, contact: contact.trim() || undefined, residence: residence.trim() || undefined, gender: gender.trim() || undefined, department: department.trim() || undefined, status: status.trim() || undefined }); onSaved?.(); onClose(); } catch (e: any) { setError(e?.message ?? "Failed to convert"); } finally { setConvertingToMember(false); } }} className="w-full py-2 rounded-xl text-xs" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{convertingToMember ? "Converting..." : "Convert to Member"}</button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <div className="text-xs text-center py-2" style={{ color: colors.accent.terracotta }}>{error}</div>}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isAdmin && (
              <button type="button" disabled={loading} onClick={async () => { if (!window.confirm(`Delete ${name || "kid"}?`)) return; setLoading(true); try { await removeKid({ kidId: kid.memberId as any } as any); onSaved?.(); onClose(); } catch (e: any) { setError(e?.message ?? "Failed to delete"); } finally { setLoading(false); } }} className="px-4 py-2.5 rounded-xl text-sm" style={{ backgroundColor: colors.accent.terracottaLight, color: colors.accent.terracotta }}>Delete</button>
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
