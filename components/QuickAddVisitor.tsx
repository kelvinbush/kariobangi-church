"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { amber: '#c9a87c', amberLight: '#e8dcc8', sage: '#9db88c', terracotta: '#c49a84' }
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReturningPrompt, setShowReturningPrompt] = useState(false);
  const [returningVisitor, setReturningVisitor] = useState<any>(null);

  const quickAdd = useMutation(api.visitors.quickAdd);
  const markPresent = useMutation(api.attendance.markPresent);

  const returningVisitors = useQuery(
    api.attendance.findReturningVisitors,
    name.trim() || contact.trim() 
      ? { date: dateIso, name: name.trim() || undefined, contact: contact.trim() || undefined }
      : "skip"
  );

  useEffect(() => {
    if (name.trim() && returningVisitors && returningVisitors.length > 0) {
      const match = returningVisitors[0];
      setReturningVisitor(match);
      setShowReturningPrompt(true);
      if (match.contact && !contact.trim()) setContact(match.contact);
      if (match.residence && !residence.trim()) setResidence(match.residence);
      if (match.relationshipStatus && !relationshipStatus.trim()) setRelationshipStatus(match.relationshipStatus);
      if (match.previousChurch && !previousChurch.trim()) setPreviousChurch(match.previousChurch);
    } else {
      setShowReturningPrompt(false);
      setReturningVisitor(null);
    }
  }, [name, contact, returningVisitors]);

  const handleMarkReturning = async () => {
    if (!returningVisitor) return;
    setLoading(true);
    try {
      await markPresent({ memberId: returningVisitor._id as any, date: dateIso });
      resetForm();
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to mark visitor");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setContact("");
    setResidence("");
    setRelationshipStatus("");
    setPreviousChurch("");
    setAge("");
    setShowReturningPrompt(false);
    setReturningVisitor(null);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (showReturningPrompt && returningVisitor) return;
    
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
      {/* Returning Visitor Prompt */}
      {showReturningPrompt && returningVisitor && (
        <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: colors.accent.amberLight }}>
          <div className="text-sm mb-1" style={{ color: colors.text.primary }}>Returning Visitor</div>
          <div className="text-xs mb-2" style={{ color: colors.text.secondary }}>
            <strong>{returningVisitor.name}</strong>
            {returningVisitor.sundayCount && ` — ${returningVisitor.sundayCount} Sunday${returningVisitor.sundayCount > 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleMarkReturning} disabled={loading} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>Mark Present</button>
            <button type="button" onClick={() => { setShowReturningPrompt(false); setReturningVisitor(null); }} className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: colors.surface, color: colors.text.secondary }}>New Entry</button>
          </div>
        </div>
      )}

      {/* Name & Contact */}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visitor name" required className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
      </div>

      {/* Residence */}
      <input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Residence" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />

      {/* Status & Age Row */}
      <div className="flex gap-2">
        <select value={relationshipStatus} onChange={(e) => { setRelationshipStatus(e.target.value); if (e.target.value !== "child") setAge(""); }} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }}>
          <option value="">Status</option>
          <option value="married">Married</option>
          <option value="youth">Youth</option>
          <option value="single">Single</option>
          <option value="widow">Widow</option>
          <option value="widower">Widower</option>
          <option value="child">Child</option>
        </select>
        {relationshipStatus === "child" && (
          <input type="number" min="0" max="150" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />
        )}
      </div>

      {/* Previous Church */}
      <input value={previousChurch} onChange={(e) => setPreviousChurch(e.target.value)} placeholder="Previous Church (optional)" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: colors.bg, color: colors.text.primary }} />

      {/* Submit */}
      <button type="submit" disabled={loading || !name.trim()} className="w-full py-2.5 rounded-xl text-sm disabled:opacity-50" style={{ backgroundColor: colors.accent.amber, color: '#fff' }}>
        {loading ? "Adding..." : "Add Visitor"}
      </button>

      {error && <div className="text-xs text-center" style={{ color: colors.accent.terracotta }}>{error}</div>}
    </form>
  );
}
