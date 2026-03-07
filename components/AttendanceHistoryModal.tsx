"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { createPortal } from "react-dom";
import { formatIsoDate } from "@/lib/date";

const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: { primary: '#3d3a36', secondary: '#6b6864', muted: '#9a9793' },
  accent: { sage: '#9db88c', sageLight: '#c5d4be', terracotta: '#c49a84', terracottaLight: '#e8d8cc', amber: '#c9a87c' }
};

type Props = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
};

export default function AttendanceHistoryModal({ open, onClose, memberId, memberName }: Props) {
  const history = useQuery(api.attendance.historyForMember, open ? { memberId: memberId as any } : "skip");

  if (!open) return null;

  const records = history ?? [];
  const presentCount = records.filter((r) => r.present).length;
  const absentCount = records.filter((r) => !r.present).length;
  const totalCount = records.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, typeof records> = {};
    records.forEach((record) => {
      const date = new Date(record.date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(record);
    });
    return groups;
  }, [records]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col" style={{ backgroundColor: colors.surface }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <div>
            <h3 className="text-base" style={{ color: colors.text.primary }}>{memberName}</h3>
            <p className="text-xs" style={{ color: colors.text.muted }}>Attendance History</p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>

        {/* Stats */}
        <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: `1px solid rgba(61, 58, 54, 0.06)` }}>
          <div className="flex-1 text-center">
            <div className="text-xl font-light" style={{ color: colors.accent.sage }}>{presentCount}</div>
            <div className="text-xs" style={{ color: colors.text.muted }}>Present</div>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }} />
          <div className="flex-1 text-center">
            <div className="text-xl font-light" style={{ color: colors.accent.terracotta }}>{absentCount}</div>
            <div className="text-xs" style={{ color: colors.text.muted }}>Absent</div>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: 'rgba(61, 58, 54, 0.1)' }} />
          <div className="flex-1 text-center">
            <div className="text-xl font-light" style={{ color: colors.accent.amber }}>{attendanceRate}%</div>
            <div className="text-xs" style={{ color: colors.text.muted }}>Rate</div>
          </div>
        </div>

        {/* Records */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {records.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: colors.text.muted }}>No attendance records</p>
          ) : (
            Object.entries(groupedByMonth).map(([month, monthRecords]) => (
              <div key={month}>
                <div className="text-xs mb-2" style={{ color: colors.text.muted }}>{month}</div>
                <div className="space-y-1">
                  {monthRecords.map((record) => (
                    <div key={record._id} className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: colors.bg }}>
                      <span className="text-sm" style={{ color: colors.text.secondary }}>{formatIsoDate(record.date)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: record.present ? colors.accent.sageLight : colors.accent.terracottaLight, color: record.present ? colors.accent.sage : colors.accent.terracotta }}>{record.present ? "Present" : "Absent"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
