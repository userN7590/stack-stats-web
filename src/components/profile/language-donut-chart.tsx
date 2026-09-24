"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatPercentage } from "@/lib/format";
import { getLanguageDisplayName } from "@/lib/language-display";

type LanguageDatum = {
  name: string;
  percentage: number;
};

type LanguageDonutChartProps = {
  languages: LanguageDatum[];
};

const colors = ["#55a7ff", "#65c58f", "#d8aa54", "#a58bd4", "#77746b"];

export function LanguageDonutChart({ languages }: LanguageDonutChartProps) {
  const data = languages
    .filter(
      (language) =>
        language.name.trim().length > 0 &&
        Number.isFinite(language.percentage) &&
        language.percentage > 0,
    )
    .map((language) => ({
      name: getLanguageDisplayName(language.name),
      percentage: Math.min(100, language.percentage),
    }));

  if (data.length === 0) {
    return (
      <p className="border border-dashed border-[#34332c] px-4 py-8 text-center text-sm text-[#969287]">
        No valid language activity to display.
      </p>
    );
  }

  const description = data
    .map((language) => `${language.name} ${formatPercentage(language.percentage)}`)
    .join(", ");

  return (
    <div className="grid items-center gap-7 sm:grid-cols-[190px_1fr]">
      <div
        className="mx-auto h-[190px] w-[190px]"
        role="img"
        aria-label={`Language activity: ${description}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="percentage"
              nameKey="name"
              innerRadius={57}
              outerRadius={84}
              paddingAngle={1}
              stroke="#11110d"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((language, index) => (
                <Cell key={`${language.name}-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatPercentage(Number(value)), "Activity"]}
              contentStyle={{
                background: "#191914",
                border: "1px solid #34332c",
                borderRadius: 2,
                color: "#edeae0",
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                fontSize: 12,
              }}
              itemStyle={{ color: "#edeae0" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="divide-y divide-[#2b2a24] border-y border-[#2b2a24]">
        {data.map((language, index) => (
          <li
            key={`${language.name}-${index}`}
            className="flex items-center justify-between gap-4 py-3 font-mono text-xs"
          >
            <span className="flex min-w-0 items-center gap-3 text-[#c8c4b9]">
              <span
                className="size-2.5 shrink-0"
                style={{ backgroundColor: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <span className="truncate">{language.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[#edeae0]">
              {formatPercentage(language.percentage)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
