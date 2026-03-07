"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { amber: '#c9a87c', amberLight: '#e8dcc8', sage: '#9db88c' }
};

const DEPARTMENTS = [
  "Worship Team", "Keyboard Dept", "Violinists", "Security Team", "Prisons", "Hospital",
  "Logistics", "Clusters", "Imara Studio", "Marriage", "Sanitation", "Ushers",
  "Home Fellowships", "Finance", "Communication", "Decoration", "Protocol",
  "Sunday School", "Kitchen", "Clean Water", "Translation", "Gate 1", "Welfare", "Technical Team"
];

type Props = {
  dateIso: string;
  onDone?: () => void;
};

export default function QuickAddMember({ dateIso, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [residence, setResidence] = useState("");
  const [gender, setGender] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [markPresentAfter, setMarkPresentAfter] = useState(true);
  const [loading, setLoading] = useState(false);
  const quickAdd = useMutation(api.members.quickAdd);
  const markPresent = useMutation(api.attendance.markPresent);

  const reset = () => {
    setName(""); setContact(""); setResidence(""); setGender(""); setDepartment(""); setStatus(""); setMarkPresentAfter(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const memberId = await quickAdd({
        name: name.trim(),
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        gender: gender.trim() || undefined,
        department: department.trim() || undefined,
        status: status.trim() || undefined,
      });
      if (markPresentAfter && memberId) await markPresent({ memberId, date: dateIso });
      setOpen(false);
      reset();
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => setOpen(true)} className="w-full py-2.5 rounded-xl text-sm" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>+ Add Member</button>

      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}>
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-[10000] w-full max-w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: colors.surface }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
              <h3 className="text-base" style={{ color: colors.text.primary }}>Add Member</h3>
              <button onClick={() => setOpen(false)} style={{ color: colors.text.muted }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
              <div className="grid grid-cols-2 gap-3">
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone" className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
                <input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Residence" className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                  <option value="">Status</option>
                  <option value="married">Married</option>
                  <option value="youth">Youth</option>
                  <option value="single">Single</option>
                  <option value="widow">Widow</option>
                  <option value="widower">Widower</option>
                </select>
              </div>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
              </select>
              <label className="flex items-center gap-2 text-sm" style={{ color: colors.text.secondary }}>
                <input type="checkbox" checked={markPresentAfter} onChange={(e) => setMarkPresentAfter(e.target.checked)} className="rounded" />
                Mark as present today
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm" style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}>Cancel</button>
                <button type="submit" disabled={loading || !name.trim()} className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>{loading ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
