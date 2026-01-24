"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickAdd = useMutation(api.visitors.quickAdd);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await quickAdd({
        name: name.trim(),
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        relationshipStatus: relationshipStatus.trim() || undefined,
        previousChurch: previousChurch.trim() || undefined,
        date: dateIso,
      });
      setName("");
      setContact("");
      setResidence("");
      setRelationshipStatus("");
      setPreviousChurch("");
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add visitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
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
          onChange={(e) => setRelationshipStatus(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="">R/Ship Status</option>
          <option value="youth">Youth</option>
          <option value="married">Married</option>
          <option value="single">Single</option>
          <option value="widow">Widow</option>
          <option value="child">Child</option>
        </select>
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
