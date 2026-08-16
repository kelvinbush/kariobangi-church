"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import VisitorSourceToggle from "@/components/VisitorSourceToggle";

const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceHover: '#ececee',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7', sage: '#154618', terracotta: '#0D9762' }
};

type Props = {
  dateIso: string;
  onDone?: () => void;
};

export default function QuickAddVisitor({ dateIso, onDone }: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [residence, setResidence] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [previousChurch, setPreviousChurch] = useState("");
  const [age, setAge] = useState("");
  const [fromOtherChurch, setFromOtherChurch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickAdd = useMutation(api.visitors.quickAdd);
  const markPresent = useMutation(api.attendance.markPresent);

  const resetForm = () => {
    setName("");
    setContact("");
    setResidence("");
    setRelationshipStatus("");
    setPreviousChurch("");
    setAge("");
    setFromOtherChurch(true);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const ageNum = age.trim() ? parseInt(age.trim(), 10) : undefined;
      if (age.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) {
        setError("Please enter a valid age");
        setLoading(false);
        return;
      }
      const visitorId = await quickAdd({
        name: name.trim(),
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        relationshipStatus: relationshipStatus.trim() || undefined,
        previousChurch: previousChurch.trim() || undefined,
        age: ageNum,
        fromOtherChurch,
        date: dateIso,
      });
      await markPresent({ memberId: visitorId as any, date: dateIso });
      resetForm();
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add visitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2">
      {/* Name & Contact */}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visitor name" required className="min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className="min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />

      {/* Residence & Status (age shares the status cell for children) */}
      <input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Residence" className="min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
      <div className="flex gap-2 min-w-0">
        <select value={relationshipStatus} onChange={(e) => { setRelationshipStatus(e.target.value); if (e.target.value !== "child") setAge(""); }} className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
          <option value="">Status</option>
          <option value="married">Married</option>
          <option value="youth">Youth</option>
          <option value="single">Single</option>
          <option value="widow">Widow</option>
          <option value="widower">Widower</option>
          <option value="child">Child</option>
        </select>
        {relationshipStatus === "child" && (
          <input type="number" min="0" max="150" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="w-16 min-w-0 px-2 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        )}
      </div>

      {/* Where they came from */}
      <div className="col-span-2">
        <VisitorSourceToggle value={fromOtherChurch} onChange={setFromOtherChurch} />
      </div>

      {/* Previous church & submit */}
      <input value={previousChurch} onChange={(e) => setPreviousChurch(e.target.value)} placeholder={fromOtherChurch ? "Previous church" : "Which branch?"} className="min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
      <button type="submit" disabled={loading || !name.trim()} className="py-2 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>
        {loading ? "Adding..." : "Add Visitor"}
      </button>

      {error && <div className="col-span-2 text-xs text-center" style={{ color: colors.accent.terracotta }}>{error}</div>}
    </form>
  );
}
