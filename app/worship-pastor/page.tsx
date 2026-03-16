"use client";

import { useState, useMemo } from "react";
import { SignedIn, UserButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, toISODate } from "@/lib/date";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// Color Palette
const colors = {
  bg: '#f5f3ef',
  surface: '#faf9f7',
  surfaceHover: '#f0ede8',
  text: {
    primary: '#3d3a36',
    secondary: '#6b6864',
    muted: '#9a9793',
  },
  accent: {
    amber: '#c9a87c',
    amberLight: '#e8dcc8',
    sage: '#9db88c',
    sageLight: '#c5d4be',
    terracotta: '#c49a84',
    terracottaLight: '#e8d8cc',
    purple: '#9b8cb8',
    purpleLight: '#d4cbe5',
  }
};

// Subtle dot pattern
const DotPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotPattern)"/>
  </svg>
);

// Get current time in HH:MM format (Kenya timezone)
const getCurrentTime = () => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  });
};

// Get last Saturday's date
const getLastSaturday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day - 1; // Adjust to get Saturday
  const saturday = new Date(today.setDate(diff));
  return toISODate(saturday);
};

// Get last Sunday's date
const getLastSunday = () => {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const sunday = new Date(today);
  // Subtract the day number to get to the most recent Sunday
  // If today is Sunday (0), we stay on today. If Monday (1), we go back 1 day, etc.
  sunday.setDate(today.getDate() - day);
  return toISODate(sunday);
};

// Get previous Sundays for the dropdown
const getPreviousSundays = (count: number) => {
  const sundays: string[] = [];
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday
  
  // Start from most recent Sunday
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - currentDay);
  
  for (let i = 0; i < count; i++) {
    const d = new Date(lastSunday);
    d.setDate(lastSunday.getDate() - (i * 7));
    sundays.push(toISODate(d));
  }
  
  return sundays;
};

export default function WorshipPastorPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"sunday" | "practice" | "stats">("sunday");
  const [selectedSunday, setSelectedSunday] = useState<string>(getLastSunday());
  const [selectedPracticeDate, setSelectedPracticeDate] = useState<string>(getLastSaturday());
  const [editingTime, setEditingTime] = useState<{ memberId: string; currentTime: string } | null>(null);
  const [newTime, setNewTime] = useState("");

  // Queries
  const stats = useQuery(api.worship.worshipTeamStats, isAuthenticated ? {} : "skip");
  const sundayAttendance = useQuery(
    api.worship.worshipTeamSundayAttendance,
    isAuthenticated ? { date: selectedSunday } : "skip"
  );
  const practiceAttendance = useQuery(
    api.worship.worshipTeamPracticeAttendance,
    isAuthenticated ? { date: selectedPracticeDate } : "skip"
  );
  const recentSessions = useQuery(
    api.worship.recentPracticeSessions,
    isAuthenticated ? { limit: 5 } : "skip"
  );

  // Mutations
  const markPracticeAttendance = useMutation(api.worship.markPracticeAttendance);
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);

  // Stats calculations
  const presentToday = useMemo(() => {
    if (activeTab === "sunday") {
      return sundayAttendance?.filter((m: any) => m.present).length ?? 0;
    }
    return practiceAttendance?.filter((m: any) => m.present).length ?? 0;
  }, [sundayAttendance, practiceAttendance, activeTab]);

  const totalTeam = useMemo(() => {
    if (activeTab === "sunday") return sundayAttendance?.length ?? 0;
    return practiceAttendance?.length ?? 0;
  }, [sundayAttendance, practiceAttendance, activeTab]);

  const handleMarkPractice = async (memberId: string, present: boolean) => {
    const arrivalTime = present ? getCurrentTime() : undefined;
    await markPracticeAttendance({
      memberId: memberId as any,
      date: selectedPracticeDate,
      present,
      arrivalTime,
    });
  };

  const handleMarkSunday = async (memberId: string, present: boolean) => {
    if (present) {
      const arrivalTime = getCurrentTime();
      await markPresent({
        memberId: memberId as any,
        date: selectedSunday,
        arrivalTime,
      });
    } else {
      await unmarkPresent({
        memberId: memberId as any,
        date: selectedSunday,
      });
    }
  };

  const handleUpdateTime = async (memberId: string) => {
    if (!newTime) return;
    
    const member = practiceAttendance?.find((m: any) => m.memberId === memberId);
    if (!member) return;

    await markPracticeAttendance({
      memberId: memberId as any,
      date: selectedPracticeDate,
      present: member.present,
      arrivalTime: newTime,
      notes: member.notes,
    });
    
    setEditingTime(null);
    setNewTime("");
  };

  // Available Sundays for selection
  const availableSundays = useMemo(() => getPreviousSundays(8), []);

  // Generate WhatsApp report for Sunday
  const generateSundayReport = useMemo(() => {
    if (!sundayAttendance) return "";
    
    const present = sundayAttendance.filter((m: any) => m.present);
    const absent = sundayAttendance.filter((m: any) => !m.present);
    const leaderName = user?.fullName || user?.firstName || "Worship Pastor";
    
    let report = `*WORSHIP TEAM - SUNDAY SERVICE*\n`;
    report += `==================\n\n`;
    report += `Date: ${formatIsoDate(selectedSunday)}\n`;
    report += `Team: ${sundayAttendance.length} members\n`;
    report += `Present: ${present.length}\n`;
    report += `Absent: ${absent.length}\n`;
    report += `Attendance Rate: ${sundayAttendance.length > 0 ? Math.round((present.length / sundayAttendance.length) * 100) : 0}%\n\n`;
    
    if (present.length > 0) {
      report += `*PRESENT (${present.length})*\n`;
      present.forEach((m: any) => {
        report += `- ${m.name}\n`;
      });
      report += `\n`;
    }
    
    if (absent.length > 0) {
      report += `*ABSENT (${absent.length})*\n`;
      absent.forEach((m: any) => {
        report += `- ${m.name}`;
        if (m.contact) report += ` (${m.contact})`;
        report += `\n`;
      });
      report += `\n`;
    }
    
    report += `==================\n`;
    report += `Shared by: ${leaderName}\n`;
    report += `_Imaara Worship System_`;
    
    return report;
  }, [sundayAttendance, selectedSunday, user]);

  // Generate WhatsApp report for Practice
  const generatePracticeReport = useMemo(() => {
    if (!practiceAttendance) return "";
    
    const present = practiceAttendance.filter((m: any) => m.present);
    const absent = practiceAttendance.filter((m: any) => !m.present);
    const leaderName = user?.fullName || user?.firstName || "Worship Pastor";
    
    let report = `*WORSHIP TEAM - SATURDAY PRACTICE*\n`;
    report += `==================\n\n`;
    report += `Date: ${formatIsoDate(selectedPracticeDate)}\n`;
    report += `Team: ${practiceAttendance.length} members\n`;
    report += `Attended: ${present.length}\n`;
    report += `Missed: ${absent.length}\n`;
    report += `Attendance Rate: ${practiceAttendance.length > 0 ? Math.round((present.length / practiceAttendance.length) * 100) : 0}%\n\n`;
    
    if (present.length > 0) {
      report += `*ATTENDED (${present.length})*\n`;
      present.forEach((m: any) => {
        report += `- ${m.name}`;
        if (m.department) report += ` (${m.department})`;
        report += `\n`;
      });
      report += `\n`;
    }
    
    if (absent.length > 0) {
      report += `*MISSED (${absent.length})*\n`;
      absent.forEach((m: any) => {
        report += `- ${m.name}`;
        if (m.contact) report += ` (${m.contact})`;
        report += `\n`;
      });
      report += `\n`;
    }
    
    report += `==================\n`;
    report += `Shared by: ${leaderName}\n`;
    report += `_Imaara Worship System_`;
    
    return report;
  }, [practiceAttendance, selectedPracticeDate, user]);

  const handleShare = async () => {
    const report = activeTab === "sunday" ? generateSundayReport : generatePracticeReport;
    if (!report) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Worship Team Report - ${activeTab === "sunday" ? "Sunday" : "Practice"}`,
          text: report,
        });
        return;
      } catch {
        // Fall through to WhatsApp
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
  };

  // History modal state
  const [historyModal, setHistoryModal] = useState<{
    memberId: string;
    name: string;
    type: "sunday" | "practice";
  } | null>(null);

  // Fetch history when modal is open
  const memberHistory = useQuery(
    api.attendance.historyForMember,
    isAuthenticated && historyModal ? { memberId: historyModal.memberId as any } : "skip"
  );
  const memberPracticeHistory = useQuery(
    api.worship.practiceHistoryForMember,
    isAuthenticated && historyModal && historyModal.type === "practice" 
      ? { memberId: historyModal.memberId as any } 
      : "skip"
  );

  return (
    <AuthenticatedLayout>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundColor: colors.bg }}>
        <DotPattern />
      </div>

      <div className="relative min-h-screen">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between"
          style={{ 
            backgroundColor: colors.bg,
            borderBottom: `1px solid rgba(61, 58, 54, 0.06)`
          }}
        >
          <span className="text-sm tracking-wide" style={{ color: colors.text.secondary }}>
            Worship Pastor
          </span>
          <div className="flex items-center gap-3">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-5 py-8 pb-24">
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-light mb-1" style={{ color: colors.text.primary }}>
              Worship Team
            </h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Manage worship team attendance and practice sessions
            </p>
          </div>

          {/* Stats Overview */}
          <div 
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: colors.text.primary }}
          >
            <div className="flex items-center gap-6">
              <div>
                <div className="text-4xl font-light mb-1 text-white">{stats?.total ?? 0}</div>
                <div className="text-xs text-white/60">Total Members</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">{presentToday}</div>
                <div className="text-xs text-white/60">
                  {activeTab === "sunday" ? "Present Sunday" : "Present Practice"}
                </div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-light mb-1 text-white">
                  {stats?.byGender?.male ?? 0}/{stats?.byGender?.female ?? 0}
                </div>
                <div className="text-xs text-white/60">Male/Female</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: "sunday", label: "Sunday Service" },
              { id: "practice", label: "Saturday Practice" },
              { id: "stats", label: "Team Stats" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 py-2 rounded-full text-xs transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? colors.accent.purpleLight : colors.surface,
                  color: activeTab === tab.id ? colors.accent.purple : colors.text.secondary,
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sunday Service Tab */}
          {activeTab === "sunday" && (
            <div className="space-y-6">
              {/* Date Selector - Sundays Only */}
              <div 
                className="p-4 rounded-xl"
                style={{ backgroundColor: colors.surface }}
              >
                <label className="text-sm block mb-2" style={{ color: colors.text.secondary }}>
                  Select Sunday:
                </label>
                <select
                  value={selectedSunday}
                  onChange={(e) => setSelectedSunday(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                >
                  {availableSundays.map((sunday) => (
                    <option key={sunday} value={sunday}>
                      {formatIsoDate(sunday)}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
                  You can mark attendance for any past Sunday
                </p>
              </div>

              {/* Share Report Button */}
              <button
                onClick={handleShare}
                className="w-full py-3 rounded-full text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: '#25D366', color: '#fff' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share Sunday Report
              </button>

              {/* Sunday Attendance List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    {formatIsoDate(selectedSunday)}
                  </span>
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    {sundayAttendance?.filter((m: any) => m.present).length ?? 0} / {sundayAttendance?.length ?? 0} present
                  </span>
                </div>

                {(sundayAttendance || []).length === 0 ? (
                  <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                    No worship team members found
                  </div>
                ) : (
                  (sundayAttendance || []).map((member: any) => (
                    <div
                      key={member.memberId}
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => setHistoryModal({ memberId: member.memberId, name: member.name, type: "sunday" })}
                              className="text-sm hover:underline"
                              style={{ color: colors.text.primary }}
                            >
                              {member.name}
                            </button>
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: colors.accent.amberLight,
                                color: colors.accent.amber
                              }}
                            >
                              {member.department || "Worship"}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: colors.text.muted }}>
                            {member.gender || "Unknown gender"}
                            {member.contact && ` • ${member.contact}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.present && member.arrivalTime && (
                            <span
                              onClick={() => setHistoryModal({ memberId: member.memberId, name: member.name, type: "sunday" })}
                              className="text-xs cursor-pointer"
                              style={{ color: colors.text.muted }}
                            >
                              {member.arrivalTime}
                            </span>
                          )}
                          <button
                            onClick={() => handleMarkSunday(member.memberId, !member.present)}
                            className="px-4 py-2 rounded-full text-xs font-medium transition-all active:scale-95"
                            style={{ 
                              backgroundColor: member.present ? colors.accent.terracotta : colors.accent.sage,
                              color: '#fff',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            {member.present ? "Mark Absent" : "Mark Present"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Saturday Practice Tab */}
          {activeTab === "practice" && (
            <div className="space-y-6">
              {/* Date Selector */}
              <div 
                className="p-4 rounded-xl flex items-center gap-4"
                style={{ backgroundColor: colors.surface }}
              >
                <label className="text-sm" style={{ color: colors.text.secondary }}>
                  Practice Date:
                </label>
                <input
                  type="date"
                  value={selectedPracticeDate}
                  onChange={(e) => setSelectedPracticeDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                />
              </div>

              {/* Recent Practice Sessions */}
              {recentSessions && recentSessions.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    Recent sessions:
                  </span>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {recentSessions.map((session: any) => (
                      <button
                        key={session.date}
                        onClick={() => setSelectedPracticeDate(session.date)}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ 
                          backgroundColor: selectedPracticeDate === session.date ? colors.accent.purpleLight : colors.surface,
                          color: selectedPracticeDate === session.date ? colors.accent.purple : colors.text.secondary
                        }}
                      >
                        {formatIsoDate(session.date)} ({session.totalPresent})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Share Report Button */}
              <button
                onClick={handleShare}
                className="w-full py-3 rounded-full text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: '#25D366', color: '#fff' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share Practice Report
              </button>

              {/* Practice Attendance List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    Mark attendance for practice
                  </span>
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    {practiceAttendance?.filter((m: any) => m.present).length ?? 0} / {practiceAttendance?.length ?? 0} marked
                  </span>
                </div>

                {(practiceAttendance || []).length === 0 ? (
                  <div className="py-12 text-center text-sm" style={{ color: colors.text.muted }}>
                    No worship team members found
                  </div>
                ) : (
                  (practiceAttendance || []).map((member: any) => (
                    <div
                      key={member.memberId}
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => setHistoryModal({ memberId: member.memberId, name: member.name, type: "practice" })}
                              className="text-sm hover:underline"
                              style={{ color: colors.text.primary }}
                            >
                              {member.name}
                            </button>
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: colors.accent.amberLight,
                                color: colors.accent.amber
                              }}
                            >
                              {member.department || "Worship"}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: colors.text.muted }}>
                            {member.gender || "Unknown gender"}
                            {member.contact && ` • ${member.contact}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.present && member.arrivalTime && (
                            <button
                              onClick={() => {
                                setEditingTime({ memberId: member.memberId, currentTime: member.arrivalTime });
                                setNewTime(member.arrivalTime);
                              }}
                              className="text-xs"
                              style={{ color: colors.text.muted }}
                            >
                              {member.arrivalTime}
                            </button>
                          )}
                          <button
                            onClick={() => handleMarkPractice(member.memberId, !member.present)}
                            className="px-4 py-2 rounded-full text-xs font-medium transition-all active:scale-95"
                            style={{ 
                              backgroundColor: member.present ? colors.accent.terracotta : colors.accent.sage,
                              color: '#fff',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            {member.present ? "Mark Absent" : "Mark Present"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Team Stats Tab */}
          {activeTab === "stats" && (
            <div className="space-y-6">
              {/* By Department */}
              <div 
                className="p-5 rounded-2xl"
                style={{ backgroundColor: colors.surface }}
              >
                <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.primary }}>
                  By Department
                </h3>
                <div className="space-y-3">
                  {(stats?.byDepartment || []).map((dept: any) => (
                    <div key={dept.department} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {dept.department}
                      </span>
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${(dept.count / (stats?.total || 1)) * 100}px`,
                            backgroundColor: colors.accent.purple,
                            minWidth: '4px'
                          }}
                        />
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {dept.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Gender */}
              <div 
                className="p-5 rounded-2xl"
                style={{ backgroundColor: colors.surface }}
              >
                <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.primary }}>
                  By Gender
                </h3>
                <div className="flex gap-4">
                  <div 
                    className="flex-1 p-4 rounded-xl text-center"
                    style={{ backgroundColor: colors.accent.sageLight }}
                  >
                    <div className="text-2xl font-light mb-1" style={{ color: colors.accent.sage }}>
                      {stats?.byGender?.male ?? 0}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.secondary }}>Male</div>
                  </div>
                  <div 
                    className="flex-1 p-4 rounded-xl text-center"
                    style={{ backgroundColor: colors.accent.terracottaLight }}
                  >
                    <div className="text-2xl font-light mb-1" style={{ color: colors.accent.terracotta }}>
                      {stats?.byGender?.female ?? 0}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.secondary }}>Female</div>
                  </div>
                  <div 
                    className="flex-1 p-4 rounded-xl text-center"
                    style={{ backgroundColor: colors.surfaceHover }}
                  >
                    <div className="text-2xl font-light mb-1" style={{ color: colors.text.secondary }}>
                      {stats?.byGender?.unknown ?? 0}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.secondary }}>Unknown</div>
                  </div>
                </div>
              </div>

              {/* Recent Practice Summary */}
              {recentSessions && recentSessions.length > 0 && (
                <div 
                  className="p-5 rounded-2xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <h3 className="text-sm font-medium mb-4" style={{ color: colors.text.primary }}>
                    Recent Practice Sessions
                  </h3>
                  <div className="space-y-2">
                    {recentSessions.map((session: any) => (
                      <div 
                        key={session.date}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {formatIsoDate(session.date)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: colors.accent.sageLight,
                              color: colors.accent.sage
                            }}
                          >
                            {session.totalPresent} present
                          </span>
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: colors.accent.terracottaLight,
                              color: colors.accent.terracotta
                            }}
                          >
                            {session.totalAbsent} absent
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Time Edit Modal */}
        {editingTime && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="text-sm mb-4" style={{ color: colors.text.primary }}>
                Edit Arrival Time
              </div>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
                style={{ 
                  backgroundColor: colors.bg,
                  color: colors.text.primary
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateTime(editingTime.memberId)}
                  className="flex-1 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: colors.accent.purpleLight, color: colors.accent.purple }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingTime(null);
                    setNewTime("");
                  }}
                  className="flex-1 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {historyModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(61, 58, 54, 0.4)' }}
          >
            <div 
              className="w-full max-w-sm rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm" style={{ color: colors.text.primary }}>
                  {historyModal.name}
                </div>
                <button
                  onClick={() => setHistoryModal(null)}
                  style={{ color: colors.text.muted }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setHistoryModal({ ...historyModal, type: "sunday" })}
                  className="flex-1 py-2 rounded-full text-xs"
                  style={{
                    backgroundColor: historyModal.type === "sunday" ? colors.accent.purpleLight : colors.bg,
                    color: historyModal.type === "sunday" ? colors.accent.purple : colors.text.secondary,
                  }}
                >
                  Sunday Service
                </button>
                <button
                  onClick={() => setHistoryModal({ ...historyModal, type: "practice" })}
                  className="flex-1 py-2 rounded-full text-xs"
                  style={{
                    backgroundColor: historyModal.type === "practice" ? colors.accent.purpleLight : colors.bg,
                    color: historyModal.type === "practice" ? colors.accent.purple : colors.text.secondary,
                  }}
                >
                  Practice
                </button>
              </div>

              {/* Sunday History */}
              {historyModal.type === "sunday" && (
                <div className="space-y-2">
                  {memberHistory === undefined ? (
                    <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>
                      Loading...
                    </div>
                  ) : !memberHistory?.length ? (
                    <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>
                      No Sunday attendance records
                    </div>
                  ) : (
                    memberHistory.map((record: any) => (
                      <div 
                        key={record._id}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {formatIsoDate(record.date)}
                        </span>
                        <div className="flex items-center gap-2">
                          {record.arrivalTime && (
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {record.arrivalTime}
                            </span>
                          )}
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: record.present ? colors.accent.sageLight : colors.accent.terracottaLight,
                              color: record.present ? colors.accent.sage : colors.accent.terracotta
                            }}
                          >
                            {record.present ? "Present" : "Absent"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Practice History */}
              {historyModal.type === "practice" && (
                <div className="space-y-2">
                  {memberPracticeHistory === undefined ? (
                    <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>
                      Loading...
                    </div>
                  ) : !memberPracticeHistory?.length ? (
                    <div className="py-4 text-center text-sm" style={{ color: colors.text.muted }}>
                      No practice attendance records
                    </div>
                  ) : (
                    memberPracticeHistory.map((record: any) => (
                      <div 
                        key={record._id}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {formatIsoDate(record.date)}
                        </span>
                        <div className="flex items-center gap-2">
                          {record.arrivalTime && (
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {record.arrivalTime}
                            </span>
                          )}
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: record.present ? colors.accent.sageLight : colors.accent.terracottaLight,
                              color: record.present ? colors.accent.sage : colors.accent.terracotta
                            }}
                          >
                            {record.present ? "Present" : "Absent"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={() => setHistoryModal(null)}
                className="w-full mt-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: colors.surfaceHover, color: colors.text.secondary }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
