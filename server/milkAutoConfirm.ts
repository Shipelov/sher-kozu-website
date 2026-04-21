/**
 * Milk Auto-Confirmation Cron Job.
 *
 * Automatically confirms milking sessions that have been in
 * "pending_confirm" status for more than 72 hours without dispute.
 *
 * Runs every hour. Sessions auto-confirmed get status = "confirmed"
 * and an audit log entry is created.
 */

import { getDb } from "./db";
import { milkSessions, milkAuditLog } from "../drizzle/schema";
import { eq, and, lt, sql } from "drizzle-orm";

const AUTO_CONFIRM_HOURS = 72;

export async function runMilkAutoConfirm(): Promise<number> {
  try {
    const db = await getDb();

    // Find sessions older than 72h still in pending_confirm
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - AUTO_CONFIRM_HOURS);

    const pendingSessions = await db
      .select({ id: milkSessions.id, sessionCode: milkSessions.sessionCode })
      .from(milkSessions)
      .where(
        and(
          eq(milkSessions.status, "pending_confirm"),
          lt(milkSessions.createdAt, cutoff),
        ),
      );

    if (pendingSessions.length === 0) {
      return 0;
    }

    let confirmed = 0;

    for (const session of pendingSessions) {
      try {
        // Update status to confirmed
        await db
          .update(milkSessions)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            confirmedByWorkerId: null, // null = auto-confirmed
          })
          .where(eq(milkSessions.id, session.id));

        // Audit log
        await db.insert(milkAuditLog).values({
          action: "session_auto_confirmed",
          entityType: "session",
          entityId: session.id,
          detailsJson: JSON.stringify({
            sessionCode: session.sessionCode,
            autoConfirmHours: AUTO_CONFIRM_HOURS,
          }),
        });

        confirmed++;
      } catch (err) {
        console.error(
          `[MilkAutoConfirm] Failed to auto-confirm session ${session.sessionCode}:`,
          err,
        );
      }
    }

    if (confirmed > 0) {
      console.log(
        `[MilkAutoConfirm] Auto-confirmed ${confirmed} session(s) older than ${AUTO_CONFIRM_HOURS}h`,
      );
    }

    return confirmed;
  } catch (err) {
    console.error("[MilkAutoConfirm] Cron job failed:", err);
    return 0;
  }
}
