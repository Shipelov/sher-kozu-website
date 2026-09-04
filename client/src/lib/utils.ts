import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number to an exact number of decimal places.
 * Keeps trailing zeros for consistent dashboard display (e.g. 134 → 134.00).
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 */
export function fmtNum(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === "") return (0).toFixed(decimals);
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return (0).toFixed(decimals);
  return num.toFixed(decimals);
}

/**
 * Format a number to exactly 2 decimal places (always shows .XX).
 * Use for financial/accounting displays where trailing zeros matter.
 * @param value - The number to format
 */
export function fmtFixed(value: number | string | null | undefined, decimals = 2): string {
  return fmtNum(value, decimals);
}
