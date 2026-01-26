"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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

  // Query for returning visitors when name or contact is entered
  const returningVisitors = useQuery(
    api.attendance.findReturningVisitors,
    name.trim() || contact.trim() 
      ? { date: dateIso, name: name.trim() || undefined, contact: contact.trim() || undefined }
      : "skip"
  );

  // Check for returning visitors when form is about to submit
  useEffect(() => {
    if (name.trim() && returningVisitors && returningVisitors.length > 0) {
      const match = returningVisitors[0]; // Use first match
      setReturningVisitor(match);
      setShowReturningPrompt(true);
      // Pre-fill the form with returning visitor's details
      if (match.contact && !contact.trim()) setContact(match.contact);
      if (match.residence && !residence.trim()) setResidence(match.residence);
      if (match.relationshipStatus && !relationshipStatus.trim()) setRelationshipStatus(match.relationshipStatus);
      if (match.previousChurch && !previousChurch.trim()) setPreviousChurch(match.previousChurch);
      if (match.age && !age.trim()) setAge(match.age.toString());
    } else {
      setShowReturningPrompt(false);
      setReturningVisitor(null);
    }
  }, [name, contact, returningVisitors]);

  const handleMarkReturning = async () => {
    if (!returningVisitor) return;
    setLoading(true);
    setError(null);
    try {
      await markPresent({
        memberId: returningVisitor._id as any,
        date: dateIso,
      });
      setName("");
      setContact("");
      setResidence("");
      setRelationshipStatus("");
      setPreviousChurch("");
      setAge("");
      setShowReturningPrompt(false);
      setReturningVisitor(null);
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to mark visitor as present");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    
    // If there's a returning visitor prompt, don't submit yet
    if (showReturningPrompt && returningVisitor) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const ageNum = age.trim() ? parseInt(age.trim(), 10) : undefined;
      if (age.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) {
        setError("Please enter a valid age (0-150) or leave blank.");
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
      // Automatically mark visitor as present
      await markPresent({
        memberId: visitorId as any,
        date: dateIso,
      });
      setName("");
      setContact("");
      setResidence("");
      setRelationshipStatus("");
      setPreviousChurch("");
      setAge("");
      setShowReturningPrompt(false);
      setReturningVisitor(null);
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add visitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {showReturningPrompt && returningVisitor && (
        <div className="mb-2 p-3 rounded-lg bg-amber-400/90 text-zinc-900 text-sm">
          <div className="font-medium mb-1">Returning Visitor Detected!</div>
          <div className="mb-2 text-xs">
            Found: <strong>{returningVisitor.name}</strong> 
            {returningVisitor.contact && ` (${returningVisitor.contact})`}
            {returningVisitor.sundayCount && ` - Attended ${returningVisitor.sundayCount} Sunday${returningVisitor.sundayCount > 1 ? 's' : ''}`}
          </div>
          <div className="mb-2 text-xs text-zinc-700">
            Details have been pre-filled. You can update them if needed, or just mark as present.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleMarkReturning}
              disabled={loading}
              className="px-3 py-1 rounded-full bg-zinc-900 text-white text-xs disabled:opacity-50"
            >
              Mark as Present
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReturningPrompt(false);
                setReturningVisitor(null);
              }}
              className="px-3 py-1 rounded-full bg-white/60 text-zinc-900 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Visitor name"
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white placeholder:text-white/70 text-sm outline-none focus:ring-2 focus:ring-amber-300"
          required
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Contact"
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white placeholder:text-white/70 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        />
        <input
          value={residence}
          onChange={(e) => setResidence(e.target.value)}
          placeholder="Residence"
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white placeholder:text-white/70 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={relationshipStatus}
          onChange={(e) => {
            setRelationshipStatus(e.target.value);
            if (e.target.value !== "child") {
              setAge(""); // Clear age when not a child
            }
          }}
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="">R/Ship Status</option>
          <option value="youth">Youth</option>
          <option value="married">Married</option>
          <option value="single">Single</option>
          <option value="widow">Widow</option>
          <option value="child">Child</option>
        </select>
        {relationshipStatus === "child" && (
          <input
            type="number"
            min="0"
            max="150"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age"
            className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white placeholder:text-white/70 text-sm outline-none focus:ring-2 focus:ring-amber-300"
          />
        )}
        <input
          value={previousChurch}
          onChange={(e) => setPreviousChurch(e.target.value)}
          placeholder="Previous Church"
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white placeholder:text-white/70 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-1.5 rounded-full bg-amber-300 text-zinc-900 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Adding..." : "Add Visitor"}
        </button>
      </div>
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </form>
  );
}
