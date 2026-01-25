"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = {
  dateIso: string;
  onDone?: () => void;
};

export default function QuickAddKid({ dateIso, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [residence, setResidence] = useState("");
  const [age, setAge] = useState("");
  const [markPresentAfter, setMarkPresentAfter] = useState(true);
  const [loading, setLoading] = useState(false);
  const quickAdd = useMutation(api.kids.quickAdd);
  const markPresent = useMutation(api.attendance.markPresent);

  const reset = () => {
    setName("");
    setContact("");
    setResidence("");
    setAge("");
    setMarkPresentAfter(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const ageNum = age.trim() ? parseInt(age.trim(), 10) : undefined;
      if (age.trim() && (isNaN(ageNum!) || ageNum! < 0 || ageNum! > 150)) {
        return; // Invalid age, but don't show error in quick add
      }
      const kidId = await quickAdd({
        name: name.trim(),
        contact: contact.trim() || undefined,
        residence: residence.trim() || undefined,
        age: ageNum,
      });
      if (markPresentAfter && kidId) {
        await markPresent({ memberId: kidId, date: dateIso });
      }
      setOpen(false);
      reset();
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        className="px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 text-sm cursor-pointer"
        onClick={() => setOpen(true)}
      >
        + Add Kid
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <div className="relative z-[10000] w-full max-w-lg mx-auto rounded-2xl bg-white/90 backdrop-blur-xl p-6 shadow-xl max-h-[85vh] overflow-auto">
              <h2 className="text-lg font-medium mb-4 text-zinc-900">Quick Add Kid</h2>
              <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Name" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Parent's Phone">
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="07..."
                  />
                </Field>
                <Field label="Residence">
                  <input
                    value={residence}
                    onChange={(e) => setResidence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white/70 backdrop-blur text-zinc-900 placeholder:text-zinc-400 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="Location"
                  />
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

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={markPresentAfter} onChange={(e) => setMarkPresentAfter(e.target.checked)} />
                Mark as present today
              </label>

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" className="px-3 py-1.5 rounded-full bg-zinc-200 text-zinc-900" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-1.5 rounded-full bg-amber-300 text-zinc-900 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      
    </div>
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
