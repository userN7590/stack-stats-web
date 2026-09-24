const numberFormatter = new Intl.NumberFormat("en-US");
const percentageFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

/** Accepts a percentage on the 0–100 scale; rounds only the displayed text. */
export function formatPercentage(value: number) {
  return `${percentageFormatter.format(value)}%`;
}

export function formatCodingTime(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${formatNumber(totalMinutes)}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0
    ? `${formatNumber(hours)}h ${minutes}m`
    : `${formatNumber(hours)}h`;
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SS";
}

export function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
