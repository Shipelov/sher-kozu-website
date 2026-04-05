/**
 * Retry utility for background tasks with exponential backoff.
 *
 * Provides a generic `withRetry` wrapper that retries failed async operations
 * with configurable attempts, delays, and error classification.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Whether to use exponential backoff (default: true) */
  exponential?: boolean;
  /** Label for logging (default: "Task") */
  label?: string;
  /** Optional predicate to decide if error is retryable (default: always retry) */
  isRetryable?: (err: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  exponential: true,
  label: "Task",
  isRetryable: () => true,
};

/**
 * Check if an error is a transient DB connection error (ECONNRESET, ETIMEDOUT, etc.)
 */
export function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  const cause = (err as any)?.cause;
  const causeMessage = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";

  const transientPatterns = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "Connection lost",
    "Connection terminated",
    "read ECONNRESET",
    "write ECONNRESET",
    "connect ETIMEDOUT",
    "socket hang up",
    "Too many connections",
    "ER_CON_COUNT_ERROR",
  ];

  return transientPatterns.some(
    (pattern) =>
      message.includes(pattern) || causeMessage.includes(pattern)
  );
}

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * @example
 * ```ts
 * await withRetry(
 *   () => db.delete(table).where(condition),
 *   { label: "CMS Cleanup", maxAttempts: 3, isRetryable: isTransientDbError }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!opts.isRetryable(err)) {
        // Non-retryable error — fail immediately
        throw err;
      }

      if (attempt < opts.maxAttempts) {
        const delay = opts.exponential
          ? opts.baseDelayMs * Math.pow(2, attempt - 1)
          : opts.baseDelayMs;

        console.warn(
          `[${opts.label}] Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms:`,
          err instanceof Error ? err.message : err
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts exhausted
  console.error(
    `[${opts.label}] All ${opts.maxAttempts} attempts failed:`,
    lastError instanceof Error ? lastError.message : lastError
  );
  throw lastError;
}
