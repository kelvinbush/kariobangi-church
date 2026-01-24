"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: Record<string, { label?: string; color?: string }>;
    children: React.ReactNode;
  }
>(({ className, config, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("w-full", className)}
    {...props}
  >
    <ResponsiveContainer width="100%" height={300}>
      {children}
    </ResponsiveContainer>
  </div>
));
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = ({ children, ...props }: any) => {
  return <div {...props}>{children}</div>;
};

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean;
    payload?: any[];
    label?: string;
  }
>(({ className, active, payload, label, ...props }, ref) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-white/95 backdrop-blur p-2 shadow-md",
        className
      )}
      {...props}
    >
      <div className="grid gap-1.5">
        {label && (
          <div className="font-medium text-sm text-zinc-900">{label}</div>
        )}
        {payload.map((item: any, index: number) => (
          <div
            key={index}
            className="flex items-center gap-2 text-sm"
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-zinc-700">{item.name}:</span>
            <span className="font-medium text-zinc-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartTooltip, ChartTooltipContent };
