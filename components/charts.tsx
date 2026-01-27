"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Bar, BarChart, Pie, PieChart, Cell, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type ChartData = {
  date: string;
  members?: number;
  kids?: number;
  visitors?: number;
  total?: number;
  present?: number;
  [key: string]: string | number | undefined;
};

type AreaChartProps = {
  data: ChartData[];
  dataKey: string;
  color?: string;
  title?: string;
};

export function AttendanceAreaChart({ data, dataKey, color = "#10b981", title }: AreaChartProps) {
  return (
    <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl">
      {title && <h3 className="text-lg font-medium text-zinc-900 mb-4">{title}</h3>}
      <ChartContainer config={{ [dataKey]: { label: dataKey, color } }}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#color${dataKey})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

type MultiAreaChartProps = {
  data: ChartData[];
  dataKeys: { key: string; color: string; name: string }[];
  title?: string;
};

export function MultiAreaChart({ data, dataKeys, title }: MultiAreaChartProps) {
  const config = dataKeys.reduce((acc, { key, name, color }) => {
    acc[key] = { label: name, color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl">
      {title && <h3 className="text-lg font-medium text-zinc-900 mb-4">{title}</h3>}
      <ChartContainer config={config}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {dataKeys.map(({ key, color }) => (
              <linearGradient key={key} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          {dataKeys.map(({ key, color, name }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stackId="1"
              stroke={color}
              fill={`url(#color${key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

type BarChartProps = {
  data: ChartData[];
  dataKey: string;
  color?: string;
  title?: string;
};

export function AttendanceBarChart({ data, dataKey, color = "#10b981", title }: BarChartProps) {
  return (
    <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl">
      {title && <h3 className="text-lg font-medium text-zinc-900 mb-4">{title}</h3>}
      <ChartContainer config={{ [dataKey]: { label: dataKey, color } }}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

type PieChartProps = {
  data: { name: string; value: number; color: string }[];
  title?: string;
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function AttendancePieChart({ data, title }: PieChartProps) {
  const config = data.reduce((acc, item, index) => {
    acc[item.name] = { label: item.name, color: item.color || COLORS[index % COLORS.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square max-h-[260px]"
    >
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
          outerRadius={100}
          fill="#e5e5e5"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
      </PieChart>
    </ChartContainer>
  );
}
