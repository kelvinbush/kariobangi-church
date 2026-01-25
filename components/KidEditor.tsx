"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

export type KidSummary = {
  memberId: string; // Convex Id serialized
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
};

export default function KidEditor({ open, onClose, kid, onSaved }: Props) {
  const { user } = useUser();
  const [name, setName] = useState(kid.name);
  const [contact, setContact] = useState(kid.contact ?? "");
  const [residence, setResidence] = useState(kid.residence ?? "");
  const [age, setAge] = useState(kid.age?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateKid = useMutation(api.kids.update);
  const removeKid = useMutation(api.kids.remove);

  const isAdmin = (user?.publicMetadata as any)?.role === "admin";

  useEffect(() => {
    if (!open) return;
    // Reset form to incoming kid values when opened
    setName(kid.name);
    setContact(kid.contact ?? "");
    setResidence(kid.residence ?? "");
    setAge(kid.age?.toString() ?? "");
  }, [open, kid]);

  function validPhone(p: string) {
    const s = p.trim();
    if (!s) return true; // optional
    return /^(?:\+?\d{10,15}|0\d{8,10}|[1-9]\d{7,})$/.test(s);
  }

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (!validPhone(contact)) {
      setError("Please enter a valid phone number or leave blank.");
      return;
    }
    const ageNum = age.trim() ? parseInt(age.trim(), 10) : undefined;
    if (age.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) {
      setError("Please enter a valid age (0-150) or leave blank.");
      return;
    }
    setLoading(true);
    try {
      await updateKid({
        kidId: kid.memberId as any,
        name: name.trim() || undefined,
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        age: ageNum,
      } as any);
      setError(null);
      onSaved?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-lg mx-auto rounded-2xl bg-white/95 backdrop-blur-xl p-6 shadow-xl max-h-[85vh] overflow-auto">
        <h2 className="text-lg font-medium mb-4 text-zinc-900">Edit Kid</h2>
        <form onSubmit={submit} className="flex flex-col gap-3" onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
            </Field>
            <Field label="Parent's Phone">
              <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
            </Field>
            <Field label="Residence">
              <input value={residence} onChange={(e) => setResidence(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
            </Field>
            <Field label="Age">
              <input 
                type="number" 
                min="0" 
                max="150"
                value={age} 
                onChange={(e) => setAge(e.target.value)} 
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300" 
                placeholder="Age"
              />
            </Field>
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}

          <div className="flex justify-end gap-2 mt-2">
            {isAdmin && (
              <button
                type="button"
                disabled={loading}
                className="mr-auto px-3 py-1.5 rounded-full bg-rose-600 text-white disabled:opacity-50"
                onClick={async () => {
                  const ok = window.confirm(
                    `Delete ${name || "this kid"}? This cannot be undone.`
                  );
                  if (!ok) return;
                  setLoading(true);
                  try {
                    await removeKid({ kidId: kid.memberId as any } as any);
                    onSaved?.();
                    onClose();
                  } catch (e: any) {
                    setError(e?.message ?? "Failed to delete kid.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Delete
              </button>
            )}
            <button type="button" className="px-3 py-1.5 rounded-full bg-zinc-200 text-zinc-900" onClick={onClose}>
              Cancel
            </button>
            <button title="Cmd/Ctrl+Enter" type="submit" disabled={loading || !name.trim()} className="px-4 py-1.5 rounded-full bg-amber-300 text-zinc-900 disabled:opacity-50">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}
