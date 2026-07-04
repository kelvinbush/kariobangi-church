"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";


export default function ImportKidsPage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<null | {
    inserted: number;
    skipped: number;
    errors: number;
  }>(null);
  const [loading, setLoading] = useState(false);
  const bulkImport = useMutation(api.kids.bulkImport);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await bulkImport({ csv });
      setResult(res);
    } catch (err) {
      console.error(err);
      setResult({ inserted: 0, skipped: 0, errors: 1 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Bulk Import Kids (CSV)</h1>
      <p className="text-sm text-gray-600 mb-4">
        Paste CSV with header: Number,Name,Contact,Residence. Empty values
        like -, empty string, or N/A will be saved as null.
      </p>

      
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Number,Name,Contact,Residence\n1,Jane Doe,0712345678,Town"
            className="w-full h-64 p-3 border rounded font-mono text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !csv.trim()}
              className="px-4 py-2 bg-[#0D9762] text-white rounded disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import Kids"}
            </button>
            {result && (
              <div className="text-sm text-gray-700">
                Inserted: <b>{result.inserted}</b>, Skipped: <b>{result.skipped}</b>, Errors: <b>{result.errors}</b>
              </div>
            )}
          </div>
        </form>
    </div>
  );
}
