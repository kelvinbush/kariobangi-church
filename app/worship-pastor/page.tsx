"use client";

import { useState, useMemo } from "react";
import { SignedIn, UserButton } from "@clerk/nextjs";
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

// Get current time in HH:MM format
const getCurrentTime = () => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

export default function WorshipPastorPage() {
  const { isAuthenticated } = useConvexAuth();
  const [activeTab, setActiveTab] = useState<"sunday" | "practice" | "stats">("sunday");
  const [selectedSunday, setSelectedSunday] = useState<string>(toISODate(new Date()));
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

  const handleUpdateTime = async (memberId: string) => {
    if (!newTime) return;
    
    // Find the member's current practice record
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

  const copyPhoneNumbers = (attendance: any[]) => {
    const phoneNumbers = attendance
      ?.filter((m: any) => m.contact && m.contact.trim() !== "")
      .map((m: any) => m.contact.trim());
    
    if (!phoneNumbers || phoneNumbers.length === 0) return;
    
    navigator.clipboard.writeText(phoneNumbers.join(", "));
  };

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
              {/* Date Selector */}
              <div 
                className="p-4 rounded-xl flex items-center gap-4"
                style={{ backgroundColor: colors.surface }}
              >
                <label className="text-sm" style={{ color: colors.text.secondary }}>
                  Select Sunday:
                </label>
                <input
                  type="date"
                  value={selectedSunday}
                  onChange={(e) => setSelectedSunday(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: colors.bg, color: colors.text.primary }}
                />
                <button
                  onClick={() => copyPhoneNumbers(sundayAttendance || [])}
                  className="ml-auto text-xs px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: colors.accent.purpleLight, color: colors.accent.purple }}
                >
                  Copy Numbers
                </button>
              </div>

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
                            <span className="text-sm" style={{ color: colors.text.primary }}>
                              {member.name}
                            </span>
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
                        <div className="flex items-center gap-3">
                          {member.present && member.arrivalTime && (
                            <span 
                              className="text-xs px-3 py-1 rounded-full"
                              style={{ 
                                backgroundColor: colors.accent.sageLight,
                                color: colors.accent.sage
                              }}
                            >
                              Arrived {member.arrivalTime}
                            </span>
                          )}
                          <span 
                            className="text-xs px-3 py-1 rounded-full"
                            style={{ 
                              backgroundColor: member.present ? colors.accent.sageLight : colors.accent.terracottaLight,
                              color: member.present ? colors.accent.sage : colors.accent.terracotta
                            }}
                          >
                            {member.present ? "Present" : "Absent"}
                          </span>
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
                <button
                  onClick={() => copyPhoneNumbers(practiceAttendance || [])}
                  className="ml-auto text-xs px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: colors.accent.purpleLight, color: colors.accent.purple }}
                >
                  Copy Numbers
                </button>
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
                            <span className="text-sm" style={{ color: colors.text.primary }}>
                              {member.name}
                            </span>
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
                              className="text-xs px-3 py-1 rounded-full"
                              style={{ 
                                backgroundColor: colors.accent.sageLight,
                                color: colors.accent.sage
                              }}
                            >
                              {member.arrivalTime}
                            </button>
                          )}
                          <button
                            onClick={() => handleMarkPractice(member.memberId, !member.present)}
                            className="text-xs px-3 py-1.5 rounded-full transition-colors"
                            style={{ 
                              backgroundColor: member.present ? colors.accent.terracottaLight : colors.accent.sageLight,
                              color: member.present ? colors.accent.terracotta : colors.accent.sage
                            }}
                          >
                            {member.present ? "Absent" : "Present"}
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
      </div>
    </AuthenticatedLayout>
  );
}
