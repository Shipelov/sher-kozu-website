/**
 * Analytics Monitor — tracks success/failure rates for analytics operations.
 *
 * Logs periodic summaries to the console so operators can assess
 * the scale of lost visits/events without external monitoring tools.
 */

interface OperationStats {
  success: number;
  failure: number;
  lastFailureAt: number | null;
  lastError: string | null;
}

class AnalyticsMonitor {
  private stats = new Map<string, OperationStats>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly reportIntervalMs: number;

  constructor(reportIntervalMs = 5 * 60 * 1000) {
    this.reportIntervalMs = reportIntervalMs;
  }

  /** Start periodic reporting (call once at server startup) */
  startReporting(): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.report(), this.reportIntervalMs);
    // Don't block process exit
    if (this.intervalHandle.unref) {
      this.intervalHandle.unref();
    }
  }

  /** Stop periodic reporting */
  stopReporting(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /** Record a successful operation */
  recordSuccess(operation: string): void {
    const entry = this.getOrCreate(operation);
    entry.success++;
  }

  /** Record a failed operation */
  recordFailure(operation: string, err: unknown): void {
    const entry = this.getOrCreate(operation);
    entry.failure++;
    entry.lastFailureAt = Date.now();
    entry.lastError = err instanceof Error ? err.message : String(err);
  }

  /** Get current stats snapshot */
  getStats(): Record<string, OperationStats & { successRate: string }> {
    const result: Record<string, OperationStats & { successRate: string }> = {};
    for (const [op, stats] of Array.from(this.stats.entries())) {
      const total = stats.success + stats.failure;
      const rate = total > 0 ? ((stats.success / total) * 100).toFixed(1) + "%" : "N/A";
      result[op] = { ...stats, successRate: rate };
    }
    return result;
  }

  /** Reset all counters */
  reset(): void {
    this.stats.clear();
  }

  /** Print a summary to the console */
  private report(): void {
    if (this.stats.size === 0) return;

    let totalSuccess = 0;
    let totalFailure = 0;
    const lines: string[] = [];

    for (const [op, stats] of Array.from(this.stats.entries())) {
      const total = stats.success + stats.failure;
      if (total === 0) continue;

      totalSuccess += stats.success;
      totalFailure += stats.failure;

      const rate = ((stats.success / total) * 100).toFixed(1);
      lines.push(
        `  ${op}: ${stats.success}/${total} (${rate}% success)` +
          (stats.failure > 0 && stats.lastError
            ? ` — last error: ${stats.lastError}`
            : "")
      );
    }

    const grandTotal = totalSuccess + totalFailure;
    if (grandTotal === 0) return;

    const overallRate = ((totalSuccess / grandTotal) * 100).toFixed(1);

    console.log(
      `[Analytics Monitor] Report — ${totalSuccess}/${grandTotal} operations succeeded (${overallRate}%)` +
        (totalFailure > 0 ? ` — ${totalFailure} lost` : "")
    );
    for (const line of lines) {
      console.log(line);
    }

    // Reset counters after reporting
    this.stats.clear();
  }

  private getOrCreate(operation: string): OperationStats {
    let entry = this.stats.get(operation);
    if (!entry) {
      entry = { success: 0, failure: 0, lastFailureAt: null, lastError: null };
      this.stats.set(operation, entry);
    }
    return entry;
  }
}

/** Singleton instance — import and use across the server */
export const analyticsMonitor = new AnalyticsMonitor();
