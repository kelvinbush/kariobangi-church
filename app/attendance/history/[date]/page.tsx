"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatIsoDate, formatDateLong } from "@/lib/date";
import MemberEditor, { type MemberSummary } from "@/components/MemberEditor";
import KidEditor, { type KidSummary } from "@/components/KidEditor";

export default function RollCallDetailPage() {
  const params = useParams<{ date: string }>();
  const date = decodeURIComponent(params.date);
  const [editingUnknown, setEditingUnknown] = useState<MemberSummary | null>(null);
  const [editingAbsentMember, setEditingAbsentMember] = useState<MemberSummary | null>(null);
  const [editingAbsentKid, setEditingAbsentKid] = useState<KidSummary | null>(null);
  const [historyVisitor, setHistoryVisitor] = useState<{ name: string; memberId: string } | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const markPresent = useMutation(api.attendance.markPresent);
  const unmarkPresent = useMutation(api.attendance.unmarkPresent);
  const removeVisitor = useMutation(api.visitors.remove);
  const removeMember = useMutation(api.members.remove);
  const removeKid = useMutation(api.kids.remove);
  const roster = useQuery(
    api.attendance.rosterForDate,
    isAuthenticated ? { date } : "skip"
  );
  const visitorsRoster = useQuery(
    api.attendance.visitorsRosterForDate,
    isAuthenticated ? { date } : "skip"
  );
  const visitorHistory = useQuery(
    api.attendance.historyForMember,
    isAuthenticated && historyVisitor ? { memberId: historyVisitor.memberId as any } : "skip"
  );

  const rosterList = roster ?? [];
  const visitors = visitorsRoster ?? [];

  // Members + kids only: used for banner total and for Men/Women/Kids/Unknown so counts match
  const membersOnly = rosterList.filter(
    (m: any) => m.type === "member" || m.type === "kid"
  );
  const total = membersOnly.length;
  const presentMembersKids = membersOnly.filter((m: any) => m.presentToday).length;
  const absentMembersCount = Math.max(0, total - presentMembersKids);

  // All from membersOnly so banner and group counts match
  const presentMen = membersOnly.filter(
    (m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "male"
  );
  const presentWomen = membersOnly.filter(
    (m: any) => m.presentToday && (m.gender ?? "").toLowerCase() === "female"
  );
  const presentKids = membersOnly.filter(
    (m: any) => m.presentToday && m.type === "kid"
  );
  const presentUnknown = membersOnly.filter(
    (m: any) =>
      m.presentToday &&
      m.type !== "kid" &&
      !["male", "female"].includes((m.gender ?? "").toLowerCase())
  );

  // Returning visitors (in roster but not in banner total); separate section so we can mark not present
  const returningVisitorsPresent = rosterList.filter(
    (m: any) => m.type === "returningVisitor" && m.presentToday
  );
  const returningVisitorsAbsent = rosterList.filter(
    (m: any) => m.type === "returningVisitor" && !m.presentToday
  );
  const presentVisitors = visitors.filter((v: any) => v.presentToday);

  // Total human beings present this day: members + kids + returning visitors + first-time visitors
  const totalPresentHumans =
    presentMembersKids + returningVisitorsPresent.length + presentVisitors.length;

  // Absent members (members + kids not present) for the dedicated card
  const absentMembers = membersOnly.filter((m: any) => !m.presentToday);

  // Classification for banner: men / women / youth / other among everyone present
  const presentHumansList: any[] = [
    ...membersOnly.filter((m: any) => m.presentToday),
    ...returningVisitorsPresent,
    ...presentVisitors,
  ];

  const normalizeGender = (p: any) => (p.gender ?? "").toLowerCase();
  const isYouth = (p: any) => {
    const status = (p.status ?? "").toLowerCase();
    const rel = (p.relationshipStatus ?? "").toLowerCase();
    return (
      status.includes("youth") ||
      status.includes("single") ||
      rel.includes("youth") ||
      rel.includes("single")
    );
  };

  const youthCount = presentHumansList.filter((p) => isYouth(p)).length;
  const menClassified = presentHumansList.filter(
    (p) => !isYouth(p) && normalizeGender(p) === "male"
  ).length;
  const womenClassified = presentHumansList.filter(
    (p) => !isYouth(p) && normalizeGender(p) === "female"
  ).length;
  const otherClassified = Math.max(
    0,
    totalPresentHumans - (menClassified + womenClassified + youthCount)
  );

  // Classification for absent members card
  const classifyAbsent = (m: any) => {
    const gender = (m.gender ?? "").toLowerCase();
    const status = (m.status ?? "").toLowerCase();
    const isYouthOrSingle =
      status.includes("youth") || status.includes("single");
    const isMarried = status.includes("married");
    return { gender, isYouthOrSingle, isMarried };
  };

  const absentYouthMen = absentMembers.filter((m) => {
    const c = classifyAbsent(m);
    return c.gender === "male" && c.isYouthOrSingle;
  }).length;

  const absentYouthLadies = absentMembers.filter((m) => {
    const c = classifyAbsent(m);
    return c.gender === "female" && c.isYouthOrSingle;
  }).length;

  const absentMenMarried = absentMembers.filter((m) => {
    const c = classifyAbsent(m);
    return c.gender === "male" && c.isMarried;
  }).length;

  const absentWomenMarried = absentMembers.filter((m) => {
    const c = classifyAbsent(m);
    return c.gender === "female" && c.isMarried;
  }).length;

  const absentKidsCount = absentMembers.filter((m: any) => m.type === "kid").length;

  const togglePresent = async (memberId: string, current: boolean) => {
    const payload = { memberId, date };
    if (current) {
      await unmarkPresent(payload as any);
    } else {
      await markPresent(payload as any);
    }
  };

  const exportVisitorsCsv = () => {
    if (!presentVisitors.length) return;

    // Format like: Jan 25
    const prefix = new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });

    const headers = [
      "Name Prefix",
      "First Name",
      "Middle Name",
      "Last Name",
      "Name Suffix",
      "Phonetic First Name",
      "Phonetic Middle Name",
      "Phonetic Last Name",
      "Nickname",
      "File As",
      "E-mail 1 - Label",
      "E-mail 1 - Value",
      "Phone 1 - Label",
      "Phone 1 - Value",
      "Address 1 - Label",
      "Address 1 - Country",
      "Address 1 - Street",
      "Address 1 - Extended Address",
      "Address 1 - City",
      "Address 1 - Region",
      "Address 1 - Postal Code",
      "Address 1 - PO Box",
      "Organization Name",
      "Organization Title",
      "Organization Department",
      "Birthday",
      "Event 1 - Label",
      "Event 1 - Value",
      "Relation 1 - Label",
      "Relation 1 - Value",
      "Website 1 - Label",
      "Website 1 - Value",
      "Custom Field 1 - Label",
      "Custom Field 1 - Value",
      "Notes",
      "Labels",
    ];

    const rows = presentVisitors.map((v: any) => {
      const name = v.name || "";
      // Simple split: everything in first name, leave others blank
      const firstName = name;
      const phone = v.contact || "";
      const addressStreet = v.residence || "";
      const notesParts = [];
      if (v.relationshipStatus) notesParts.push(`Status: ${v.relationshipStatus}`);
      if (v.previousChurch) notesParts.push(`Previous church: ${v.previousChurch}`);
      const notes = notesParts.join(" | ");

      return [
        prefix, // Name Prefix
        firstName, // First Name
        "", // Middle Name
        "", // Last Name
        "", // Name Suffix
        "", // Phonetic First Name
        "", // Phonetic Middle Name
        "", // Phonetic Last Name
        "", // Nickname
        "", // File As
        "", // E-mail 1 - Label
        "", // E-mail 1 - Value
        phone ? "Mobile" : "", // Phone 1 - Label
        phone, // Phone 1 - Value
        addressStreet ? "Home" : "", // Address 1 - Label
        "", // Address 1 - Country
        addressStreet, // Address 1 - Street
        "", // Address 1 - Extended Address
        "", // Address 1 - City
        "", // Address 1 - Region
        "", // Address 1 - Postal Code
        "", // Address 1 - PO Box
        "", // Organization Name
        "", // Organization Title
        "", // Organization Department
        "", // Birthday
        "", // Event 1 - Label
        "", // Event 1 - Value
        "", // Relation 1 - Label
        "", // Relation 1 - Value
        "", // Website 1 - Label
        "", // Website 1 - Value
        "", // Custom Field 1 - Label
        "", // Custom Field 1 - Value
        notes, // Notes
        "", // Labels
      ];
    });

    const escapeCsv = (cell: string | number) => {
      const str = String(cell);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `visitors-${date}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="min-h-screen text-foreground font-light bg-gradient-to-br from-amber-50 via-[#F4F1EB] to-zinc-50"
      style={{
        backgroundImage:
          "linear-gradient(0deg, rgba(48,48,48,0.08), rgba(48,48,48,0.08)), linear-gradient(135deg, #FFF7E6 0%, #F4F1EB 50%, #F7F7F7 100%)",
      }}
    >
      <SignedOut>
        <div className="max-w-3xl mx-auto p-8">
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl text-center">
            <p className="mb-4 text-zinc-700">Please sign in to view roll call details.</p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-zinc-900 text-white">Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-zinc-900 font-light tracking-tight text-xl">Roll Call</div>
              <div className="text-xs text-zinc-600">{formatIsoDate(date)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/attendance/history"
                className="inline-flex px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-zinc-200 text-zinc-900 text-xs sm:text-sm"
              >
                Back
              </Link>
              <Link
                href="/attendance"
                className="inline-flex px-3 py-1.5 rounded-full bg-zinc-900/90 text-white hover:bg-zinc-900 text-xs sm:text-sm"
              >
                Mark Attendance
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <div className="rounded-2xl p-4 bg-zinc-900/90 text-white">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white/15 text-white font-medium">Total present: {totalPresentHumans}</span>
              <span className="text-white/60">|</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Members & kids present: {presentMembersKids}</span>
              <span className="text-white/60">|</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Returning: {returningVisitorsPresent.length}</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">New visitors: {presentVisitors.length}</span>
              <span className="text-white/60">|</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/90">Roster size: {total}</span>
            </div>
            <p className="text-[11px] text-white/70 mt-2">
              Present = {presentMembersKids} (members & kids) + {returningVisitorsPresent.length} (returning) + {presentVisitors.length} (new visitors) = {totalPresentHumans}. Roster = {total} (members & kids on list).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Men Present ({presentMen.length})</div>
              {presentMen.length === 0 ? (
                <div className="text-sm text-zinc-600">None</div>
              ) : (
                <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                  <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                    {presentMen.map((m: any) => (
                      <li
                        key={m.memberId as any}
                        className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-zinc-900 font-medium break-words">
                            {m.name}
                          </div>
                          <div className="text-xs text-zinc-600 break-words">
                            {m.contact ?? "-"}
                            {m.residence ? ` • ${m.residence}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Present
                          </span>
                          <button
                            onClick={() => togglePresent(m.memberId as any, true)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                          >
                            Mark not present
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Women Present ({presentWomen.length})</div>
              {presentWomen.length === 0 ? (
                <div className="text-sm text-zinc-600">None</div>
              ) : (
                <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                  <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                    {presentWomen.map((m: any) => (
                      <li
                        key={m.memberId as any}
                        className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-zinc-900 font-medium break-words">
                            {m.name}
                          </div>
                          <div className="text-xs text-zinc-600 break-words">
                            {m.contact ?? "-"}
                            {m.residence ? ` • ${m.residence}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Present
                          </span>
                          <button
                            onClick={() => togglePresent(m.memberId as any, true)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                          >
                            Mark not present
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="text-zinc-900 font-medium mb-2">Kids Present ({presentKids.length})</div>
            {presentKids.length === 0 ? (
              <div className="text-sm text-zinc-600">None</div>
            ) : (
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {presentKids.map((m: any) => (
                    <li
                      key={m.memberId as any}
                      className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-zinc-900 font-medium break-words">
                          {m.name}
                        </div>
                        <div className="text-xs text-zinc-600 break-words">
                          {m.contact ?? "-"}
                          {m.residence ? ` • ${m.residence}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Present
                        </span>
                        <button
                          onClick={() => togglePresent(m.memberId as any, true)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                        >
                          Mark not present
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {presentUnknown.length > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">
                Present (Unknown gender) ({presentUnknown.length}) — tap Edit to set
                gender
              </div>
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {presentUnknown.map((m: any) => (
                    <li
                      key={m.memberId as any}
                      className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-zinc-900 font-medium break-words">
                          {m.name}
                        </div>
                        <div className="text-xs text-zinc-600 break-words">
                          {m.contact ?? "-"}
                          {m.residence ? ` • ${m.residence}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Present
                        </span>
                        <button
                          onClick={() =>
                            setEditingUnknown({
                              memberId: m.memberId,
                              name: m.name,
                              contact: m.contact ?? null,
                              residence: m.residence ?? null,
                              gender: m.gender ?? null,
                              department: m.department ?? null,
                              status: m.status ?? null,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-500/90 text-white text-xs font-medium touch-manipulation"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => togglePresent(m.memberId as any, true)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                        >
                          Mark not present
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {editingUnknown && (
            <MemberEditor
              open={!!editingUnknown}
              onClose={() => setEditingUnknown(null)}
              member={editingUnknown}
              onSaved={() => setEditingUnknown(null)}
              allowMoveToKids
            />
          )}

          {editingAbsentMember && (
            <MemberEditor
              open={!!editingAbsentMember}
              onClose={() => setEditingAbsentMember(null)}
              member={editingAbsentMember}
              onSaved={() => setEditingAbsentMember(null)}
              allowMoveToKids
            />
          )}

          {editingAbsentKid && (
            <KidEditor
              open={!!editingAbsentKid}
              onClose={() => setEditingAbsentKid(null)}
              kid={editingAbsentKid}
              onSaved={() => setEditingAbsentKid(null)}
            />
          )}

          {absentMembers.length > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Absent members ({absentMembers.length})</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-700 mb-2">
                <span className="px-2 py-1 rounded-full bg-zinc-100">
                  Men (married): {absentMenMarried}
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-100">
                  Women (married): {absentWomenMarried}
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-100">
                  Youth men: {absentYouthMen}
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-100">
                  Youth ladies: {absentYouthLadies}
                </span>
                <span className="px-2 py-1 rounded-full bg-zinc-100">
                  Kids: {absentKidsCount}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mb-3">Members and kids not marked present for this day. You can mark them present or remove them from the roster.</p>
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {absentMembers.map((m: any) => (
                    <li
                      key={m.memberId as any}
                      className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-zinc-900 font-medium break-words">{m.name}</div>
                        <div className="text-xs text-zinc-600 break-words">
                          {m.contact ?? "-"}
                          {m.residence ? ` • ${m.residence}` : ""}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {m.type === "kid"
                            ? "Kid"
                            : (m.gender ?? "Unknown")}
                          {m.type === "member" && m.department && ` • ${m.department}`}
                        </div>
                        {m.type === "member" && (
                          <div className="text-[11px] text-zinc-500">
                            {(() => {
                              const c = classifyAbsent(m);
                              if (c.gender === "male" && c.isMarried) return "Men (married)";
                              if (c.gender === "female" && c.isMarried) return "Women (married)";
                              if (c.gender === "male" && c.isYouthOrSingle) return "Youth men";
                              if (c.gender === "female" && c.isYouthOrSingle) return "Youth ladies";
                              return "Other";
                            })()}
                          </div>
                        )}
                        {m.lastAttendance && (
                          <div className="text-xs text-zinc-500">
                            Last Attendance: {formatDateLong(m.lastAttendance.date)}
                            {!m.lastAttendance.present && " (absent)"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        {m.type === "member" && (
                          <button
                            onClick={() =>
                              setEditingAbsentMember({
                                memberId: m.memberId,
                                name: m.name,
                                contact: m.contact ?? null,
                                residence: m.residence ?? null,
                                gender: m.gender ?? null,
                                department: m.department ?? null,
                                status: m.status ?? null,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500/90 text-white text-xs font-medium touch-manipulation"
                          >
                            Edit
                          </button>
                        )}
                        {m.type === "kid" && (
                          <button
                            onClick={() =>
                              setEditingAbsentKid({
                                memberId: m.memberId,
                                name: m.name,
                                contact: m.contact ?? null,
                                residence: m.residence ?? null,
                                age: m.age ?? null,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500/90 text-white text-xs font-medium touch-manipulation"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => togglePresent(m.memberId as any, false)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium touch-manipulation"
                        >
                          Mark present
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Remove ${m.name} from the roster? This will delete their record and all attendance history.`)) return;
                            try {
                              if (m.type === "kid") {
                                await removeKid({ kidId: m.memberId });
                              } else {
                                await removeMember({ memberId: m.memberId });
                              }
                            } catch (e: any) {
                              window.alert(e?.message ?? "Failed to remove.");
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-200 text-zinc-800 text-xs font-medium touch-manipulation"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {returningVisitorsPresent.length > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Returning visitors present ({returningVisitorsPresent.length})</div>
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {returningVisitorsPresent.map((m: any) => {
                    const returns =
                      typeof m.sundayCount === "number"
                        ? Math.max(0, m.sundayCount - 1)
                        : 0;
                    return (
                      <li
                        key={m.memberId as any}
                        className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryVisitor({
                                name: m.name,
                                memberId: m.memberId,
                              })
                            }
                            className="text-zinc-900 font-medium text-left hover:underline block w-full break-words"
                          >
                            {m.name}
                          </button>
                          <div className="text-xs text-zinc-600 break-words">
                            {m.contact ?? "-"}
                            {m.residence ? ` • ${m.residence}` : ""}
                          </div>
                          {m.previousChurch != null && m.previousChurch !== "" && (
                            <div className="text-xs text-zinc-500">
                              From: {m.previousChurch}
                            </div>
                          )}
                          {(m.firstSunday != null || m.sundayCount != null) && (
                            <div className="text-xs text-zinc-500">
                              First Sunday: {m.firstSunday ? formatDateLong(m.firstSunday) : "—"}
                              {m.sundayCount != null &&
                                ` • ${returns} return${returns === 1 ? "" : "s"}`}
                            </div>
                          )}
                          {m.lastAttendance && (
                            <div className="text-xs text-zinc-500">
                              Last {m.lastAttendance.present ? "present" : "here"}:{" "}
                              {formatDateLong(m.lastAttendance.date)}
                              {!m.lastAttendance.present && " (absent)"}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <button
                            onClick={() =>
                              setHistoryVisitor({
                                name: m.name,
                                memberId: m.memberId,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-zinc-200 text-zinc-800 text-xs font-medium touch-manipulation"
                          >
                            History
                          </button>
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Present
                          </span>
                          <button
                            onClick={() => togglePresent(m.memberId as any, true)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                          >
                            Mark not present
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {returningVisitorsAbsent.length > 0 && (
            <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
              <div className="text-zinc-900 font-medium mb-2">Returning visitors absent ({returningVisitorsAbsent.length})</div>
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {returningVisitorsAbsent.map((m: any) => {
                    const returns =
                      typeof m.sundayCount === "number"
                        ? Math.max(0, m.sundayCount - 1)
                        : 0;
                    const urgent = returns === 0;
                    return (
                      <li
                        key={m.memberId as any}
                        className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryVisitor({
                                name: m.name,
                                memberId: m.memberId,
                              })
                            }
                            className="text-zinc-900 font-medium text-left hover:underline block w-full break-words"
                          >
                            {m.name}
                          </button>
                          <div className="text-xs text-zinc-600 break-words">
                            {m.contact ?? "-"}
                            {m.residence ? ` • ${m.residence}` : ""}
                          </div>
                          {m.previousChurch != null && m.previousChurch !== "" && (
                            <div className="text-xs text-zinc-500">
                              From: {m.previousChurch}
                            </div>
                          )}
                          {(m.firstSunday != null || m.sundayCount != null) && (
                            <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-1">
                              <span>
                                First Sunday:{" "}
                                {m.firstSunday ? formatDateLong(m.firstSunday) : "—"}
                              </span>
                              <span>
                                • {returns} return{returns === 1 ? "" : "s"}
                              </span>
                              {urgent && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-medium">
                                  Urgent follow-up
                                </span>
                              )}
                            </div>
                          )}
                          {m.lastAttendance && (
                            <div className="text-xs text-zinc-500">
                              Last {m.lastAttendance.present ? "present" : "here"}:{" "}
                              {formatDateLong(m.lastAttendance.date)}
                              {!m.lastAttendance.present && " (absent)"}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <button
                            onClick={() =>
                              setHistoryVisitor({
                                name: m.name,
                                memberId: m.memberId,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-zinc-200 text-zinc-800 text-xs font-medium touch-manipulation"
                          >
                            History
                          </button>
                          <button
                            onClick={() => togglePresent(m.memberId as any, false)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium touch-manipulation"
                          >
                            Mark present
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Remove ${m.name} from the visitors list? This will delete their record and all attendance history.`
                                )
                              )
                                return;
                              try {
                                await removeVisitor({ visitorId: m.memberId });
                              } catch (e: any) {
                                window.alert(
                                  e?.message ?? "Failed to remove visitor."
                                );
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-200 text-zinc-800 text-xs font-medium touch-manipulation"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {historyVisitor && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => setHistoryVisitor(null)} />
              <div className="relative z-[10000] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[85vh] flex flex-col">
                <h3 className="text-lg font-medium text-zinc-900 mb-2">{historyVisitor.name} — Attendance history</h3>
                <div className="flex-1 overflow-y-auto -mx-2 px-2">
                  {visitorHistory === undefined ? (
                    <div className="text-sm text-zinc-500 py-4">Loading…</div>
                  ) : !visitorHistory?.length ? (
                    <div className="text-sm text-zinc-500 py-4">No attendance records.</div>
                  ) : (
                    <ul className="divide-y divide-zinc-200">
                      {visitorHistory.map((r: any) => (
                        <li key={r._id} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-900">{formatDateLong(r.date)}</span>
                          <span className={r.present ? "text-emerald-600 font-medium" : "text-zinc-500"}>
                            {r.present ? "Present" : "Absent"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setHistoryVisitor(null)}
                    className="px-3 py-1.5 rounded-full bg-zinc-200 text-zinc-900 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 bg-white/60 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-zinc-900 font-medium">
                Visitors Present ({presentVisitors.length})
              </div>
              <button
                onClick={exportVisitorsCsv}
                disabled={presentVisitors.length === 0}
                className="px-3 py-1.5 rounded-full bg-zinc-900/90 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
            </div>
            {presentVisitors.length === 0 ? (
              <div className="text-sm text-zinc-600">No visitors for this date.</div>
            ) : (
              <div className="max-h-[20rem] sm:max-h-64 overflow-y-auto -mx-2 sm:-mx-4 px-2 sm:px-4">
                <ul className="divide-y divide-white/60 space-y-3 sm:space-y-0">
                  {presentVisitors.map((v: any) => (
                    <li
                      key={v.memberId as any}
                      className="py-3 sm:py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-zinc-900 font-medium break-words">
                          {v.name}
                        </div>
                        <div className="text-xs text-zinc-600 break-words">
                          {v.contact ?? "-"}
                          {v.residence ? ` • ${v.residence}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/40 text-xs text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Present
                        </span>
                        <button
                          onClick={() => togglePresent(v.memberId as any, true)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium touch-manipulation"
                        >
                          Mark not present
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
