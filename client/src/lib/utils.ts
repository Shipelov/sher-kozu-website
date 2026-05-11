import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number to a fixed number of decimal places.
 * Removes trailing zeros for cleaner display (e.g. 134.00 → 134, 134.50 → 134.5).
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 */
export function fmtNum(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

/**
 * Format a number to exactly 2 decimal places (always shows .XX).
 * Use for financial/accounting displays where trailing zeros matter.
 * @param value - The number to format
 */
export function fmtFixed(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === "") return (0).toFixed(decimals);
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return (0).toFixed(decimals);
  return num.toFixed(decimals);
}
