"use client";

import { cn } from "@/lib/utils";

type Props = {
  currentWeek: number;
  totalWeeks?: number;
  showLabel?: boolean;
};

export function WeekIndicator({
  currentWeek,
  totalWeeks = 3,
  showLabel = false,
}: Props) {
  const isFinalWeek = currentWeek >= totalWeeks;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      {/* Week circles */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const weekNum = i + 1;
          const isCompleted = weekNum < currentWeek;
          const isCurrent = weekNum === currentWeek;

          return (
            <div
              key={weekNum}
              className={cn(
                "relative rounded-full transition-all duration-200",
                // Sizing
                "h-3 w-3",
                // Completed: solid filled
                isCompleted && "bg-amber-500",
                // Current: ring with center dot + pulse
                isCurrent &&
                  "ring-2 ring-amber-500 bg-transparent animate-pulse",
                // Upcoming: light outline
                !isCompleted && !isCurrent && "ring-1 ring-gray-300"
              )}
            >
              {/* Center dot for current week */}
              {isCurrent && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium transition-colors duration-200",
            isFinalWeek ? "text-red-600" : "text-zinc-500"
          )}
        >
          {isFinalWeek
            ? "Final week!"
            : `Week ${currentWeek} of ${totalWeeks}`}
        </span>
      )}
    </div>
  );
}

export default WeekIndicator;
