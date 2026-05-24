import type { Doc } from "./_generated/dataModel";

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  new: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  ready: "Graduation ready",
  dormant: "Dormant",
  graduated: "Graduated",
  dropped: "Dropped",
};

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  needs_follow_up: "Needs follow-up",
  graduated: "Graduated",
  removed: "Removed",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayISO(): string {
  const now = new Date();
  const kenyaOffset = 3 * 60 * 60 * 1000;
  const kenyaDate = new Date(now.getTime() + kenyaOffset);
  return kenyaDate.toISOString().split("T")[0];
}

export function isSunday(isoDate: string): boolean {
  return parseIsoUtc(isoDate).getUTCDay() === 0;
}

export function daysSince(startDate: string, referenceDate = todayISO()): number {
  const start = parseIsoUtc(startDate);
  const end = parseIsoUtc(referenceDate);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}

export function computeFollowUpWeek(assignedDate: string, referenceDate = todayISO(), weekOverride?: number | null): number {
  if (typeof weekOverride === "number") {
    return weekOverride;
  }
  const weekNumber = Math.floor(daysSince(assignedDate, referenceDate) / 7) + 1;
  return Math.max(1, Math.min(weekNumber, 4));
}

export function hasCompletedWeekFour(assignedDate: string | null | undefined, referenceDate = todayISO(), weekOverride?: number | null): boolean {
  if (typeof weekOverride === "number") {
    return weekOverride >= 4;
  }
  if (!assignedDate) return false;
  return daysSince(assignedDate, referenceDate) >= 28;
}

export function isChildVisitor(visitor: Pick<Doc<"visitors">, "relationshipStatus" | "age">): boolean {
  const status = (visitor.relationshipStatus ?? "").trim().toLowerCase();
  return status === "child" || status.includes("child");
}

export function isRegularVisitor(visitor: Pick<Doc<"visitors">, "visitType">): boolean {
  return !visitor.visitType || visitor.visitType === "regular";
}

export function isAssignableVisitor(
  visitor: Pick<Doc<"visitors">, "active" | "relationshipStatus" | "visitType" | "pipelineStage" | "age">,
): boolean {
  if (!visitor.active) return false;
  if (!isRegularVisitor(visitor)) return false;
  if (isChildVisitor(visitor)) return false;
  if (visitor.pipelineStage === "dormant" || visitor.pipelineStage === "dropped" || visitor.pipelineStage === "graduated") {
    return false;
  }
  return true;
}

export function getPipelineStage(
  visitor: Pick<Doc<"visitors">, "pipelineStage">,
  followUp: Pick<Doc<"followUps">, "assignedDate" | "status" | "archived" | "weekOverride"> | null | undefined,
  referenceDate = todayISO(),
): string {
  const storedStage = visitor.pipelineStage || "new";
  if (storedStage === "graduated" || storedStage === "dropped" || storedStage === "dormant") {
    return storedStage;
  }
  if (followUp && !followUp.archived && hasCompletedWeekFour(followUp.assignedDate, referenceDate, followUp.weekOverride)) {
    return "ready";
  }
  if (followUp && !followUp.archived && followUp.status !== "not_contacted") {
    return "in_progress";
  }
  if (followUp && !followUp.archived) {
    return "assigned";
  }
  return storedStage;
}

export function getDormantCandidate(
  visitor: Pick<Doc<"visitors">, "active" | "pipelineStage" | "visitType" | "date" | "lastAttendanceDate">,
  sundayCount: number,
  hasActiveFollowUp: boolean,
  referenceDate = todayISO(),
): { eligible: boolean; daysSinceLastVisit: number; reason: string } {
  const lastVisitDate = visitor.lastAttendanceDate || visitor.date;
  const daysSinceLastVisit = daysSince(lastVisitDate, referenceDate);

  if (!visitor.active) {
    return { eligible: false, daysSinceLastVisit, reason: "Visitor is inactive" };
  }
  if (visitor.pipelineStage === "dormant" || visitor.pipelineStage === "dropped" || visitor.pipelineStage === "graduated") {
    return { eligible: false, daysSinceLastVisit, reason: "Visitor is already closed" };
  }
  if (!isRegularVisitor(visitor)) {
    return { eligible: false, daysSinceLastVisit, reason: "Visitor is not a regular follow-up" };
  }
  if (hasActiveFollowUp) {
    return { eligible: false, daysSinceLastVisit, reason: "Visitor has an active follow-up" };
  }
  if (sundayCount <= 1 && daysSinceLastVisit >= 28) {
    return {
      eligible: true,
      daysSinceLastVisit,
      reason: `${daysSinceLastVisit} days since last visit with ${sundayCount} Sunday${sundayCount === 1 ? "" : "s"}`,
    };
  }
  return { eligible: false, daysSinceLastVisit, reason: "Visitor is still active enough" };
}

export function isWhatsAppOnlyProtocolMember(member: Pick<Doc<"protocolMembers">, "clerkId" | "accessMode">): boolean {
  return member.accessMode === "whatsapp_only" || member.clerkId.startsWith("wa:phone:");
}

export function protocolPhoneFromClerkId(clerkId: string): string | null {
  return clerkId.startsWith("wa:phone:") ? clerkId.replace("wa:phone:", "") : null;
}
