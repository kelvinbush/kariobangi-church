"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { createPortal } from "react-dom";
import { formatIsoDate } from "@/lib/date";

type Props = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
};

export default function AttendanceHistoryModal({
  open,
  onClose,
  memberId,
  memberName,
}: Props) {
  const history = useQuery(
    api.attendance.historyForMember,
    open ? { memberId: memberId as any } : "skip"
  );

  if (!open) return null;

  const records = history ?? [];
  const presentCount = records.filter((r) => r.present).length;
  const absentCount = records.filter((r) => !r.present).length;
  const totalCount = records.length;
  const attendanceRate =
    totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-lg mx-auto rounded-2xl bg-white/95 backdrop-blur-xl p-6 shadow-xl max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-zinc-900">
            Attendance History
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 text-xl"
          >
            ×
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm text-zinc-600 mb-2">{memberName}</p>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Present: </span>
              <span className="font-medium text-emerald-600">{presentCount}</span>
            </div>
            <div>
              <span className="text-zinc-500">Absent: </span>
              <span className="font-medium text-rose-600">{absentCount}</span>
            </div>
            <div>
              <span className="text-zinc-500">Rate: </span>
              <span className="font-medium">{attendanceRate}%</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {records.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">
              No attendance records
            </p>
          ) : (
            records.map((record) => (
              <div
                key={record._id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-50"
              >
                <span className="text-sm text-zinc-900">
                  {formatIsoDate(record.date)}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    record.present
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {record.present ? "Present" : "Absent"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
