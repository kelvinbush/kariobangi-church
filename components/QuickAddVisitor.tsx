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
    <form onSubmit={submit} className="space-y-3">
      {/* Name & Contact */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visitor name" required className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
      </div>

      {/* Residence */}
      <input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Residence" className="w-full min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />

      {/* Status & Age Row */}
      <div className="flex flex-col sm:flex-row gap-2">
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
          <input type="number" min="0" max="150" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        )}
      </div>

      {/* Where they came from */}
      <VisitorSourceToggle value={fromOtherChurch} onChange={setFromOtherChurch} />

      {/* Previous Church */}
      <input value={previousChurch} onChange={(e) => setPreviousChurch(e.target.value)} placeholder={fromOtherChurch ? "Previous Church (optional)" : "Which branch? (optional)"} className="w-full min-w-0 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />

      {/* Submit */}
      <button type="submit" disabled={loading || !name.trim()} className="w-full py-2.5 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>
        {loading ? "Adding..." : "Add Visitor"}
      </button>

      {error && <div className="text-xs text-center" style={{ color: colors.accent.terracotta }}>{error}</div>}
    </form>
  );
}
