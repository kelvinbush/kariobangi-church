"use client";

import { cn } from "@/lib/utils";

type PipelineStage =
  | "new"
  | "assigned"
  | "in_progress"
  | "ready"
  | "graduated"
  | "dormant"
  | "dropped";

type Props = {
  stage: string;
  size?: "sm" | "md";
};

const stageConfig: Record<
  PipelineStage,
  { label: string; bg: string; text: string; dot: string }
> = {
  new: {
    label: "New",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  assigned: {
    label: "Assigned",
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  in_progress: {
    label: "In Progress",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  ready: {
    label: "Ready",
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  graduated: {
    label: "Graduated",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  dormant: {
    label: "Dormant",
    bg: "bg-gray-200",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
  dropped: {
    label: "Dropped",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

export function PipelineBadge({ stage, size = "md" }: Props) {
  const key = stage as PipelineStage;
  const config = stageConfig[key] ?? {
    label: stage,
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200",
        config.bg,
        config.text,
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          config.dot,
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"
        )}
      />
      {config.label}
    </span>
  );
}

export default PipelineBadge;
