/**
 * Bitrix24 → koza.vip inbound webhook handler.
 *
 * Receives events when a deal stage changes in Bitrix24 CRM.
 * Updates the corresponding animalOwnership status in koza.vip DB.
 *
 * Bitrix24 sends POST to /api/bitrix24/webhook with:
 *   event: "ONCRMDEALADD" | "ONCRMDEALUPDATE" | "ONCRMDEALDELETE"
 *   data[FIELDS][ID]: deal ID
 *
 * Security: we verify by fetching the deal from Bitrix24 API using our webhook token
 * (no shared secret from Bitrix24 outbound webhooks — we validate by round-trip).
 */
import type { Request, Response, Express } from "express";
import {
  B24_CATEGORY_MAIN,
  B24_STAGE_TO_OWNERSHIP_STATUS,
  B24_FIELD,
} from "../shared/bitrix24Constants";
import { isBitrixConfigured, getBitrixWebhookBaseUrl } from "./bitrix24";
import { createIntegrationAudit, recalculateAnimalStatus } from "./db";

async function callBitrixDirect<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${getBitrixWebhookBaseUrl()}/${method}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: string; error_description?: string };
  if (!response.ok || json?.error) {
    throw new Error(json?.error_description || json?.error || `Bitrix24 ${method} failed`);
  }
  return json;
}

interface BitrixDeal {
  ID: string;
  CATEGORY_ID: string;
  STAGE_ID: string;
  TITLE: string;
  [key: string]: unknown;
}

async function handleDealUpdate(req: Request, res: Response) {
  // Bitrix24 outbound webhook sends form-encoded or JSON
  const body = req.body || {};
  const event = body.event as string | undefined;
  const dealId = body?.data?.FIELDS?.ID || body?.data?.id;

  if (!dealId) {
    console.warn("[B24 Webhook] No deal ID in payload:", JSON.stringify(body).slice(0, 500));
    return res.status(200).json({ ok: false, error: "no_deal_id" });
  }

  console.log(`[B24 Webhook] Event: ${event}, Deal ID: ${dealId}`);

  try {
    // Round-trip: fetch the deal from Bitrix24 to get current stage and custom fields
    const dealResponse = await callBitrixDirect<{ result: BitrixDeal }>("crm.deal.get", {
      id: dealId,
    });
    const deal = dealResponse.result;

    if (!deal) {
      console.warn(`[B24 Webhook] Deal ${dealId} not found in Bitrix24`);
      return res.status(200).json({ ok: false, error: "deal_not_found" });
    }

    // Only process deals from our main funnel
    if (String(deal.CATEGORY_ID) !== String(B24_CATEGORY_MAIN)) {
      console.log(`[B24 Webhook] Deal ${dealId} is in category ${deal.CATEGORY_ID}, skipping (not main funnel)`);
      return res.status(200).json({ ok: true, skipped: true, reason: "wrong_category" });
    }

    const stageId = deal.STAGE_ID;
    const ownershipIdStr = deal[B24_FIELD.OWNERSHIP_ID] as string | undefined;
    const userOpenId = deal[B24_FIELD.USER_ID] as string | undefined;

    if (!ownershipIdStr && !userOpenId) {
      console.warn(`[B24 Webhook] Deal ${dealId} has no ownership_id or user_id`);
      return res.status(200).json({ ok: false, error: "no_ownership_link" });
    }

    // Map B24 stage → koza.vip ownership status
    const newOwnershipStatus = B24_STAGE_TO_OWNERSHIP_STATUS[stageId];
    if (!newOwnershipStatus) {
      console.log(`[B24 Webhook] Stage ${stageId} has no ownership status mapping, skipping`);
      return res.status(200).json({ ok: true, skipped: true, reason: "unmapped_stage" });
    }

    // Update ownership in DB
    const { getDb } = await import("./db");
    const db = await getDb();
    const { animalOwnerships } = await import("../drizzle/schema");
    const { eq, and: andOp } = await import("drizzle-orm");

    // Find ownerships linked to this deal
    let updateCondition;
    if (ownershipIdStr) {
      // Find by bitrixDealId (preferred)
      updateCondition = eq(animalOwnerships.bitrixDealId, String(dealId));
    } else if (userOpenId) {
      // Fallback: find by user openId + bitrixDealId
      updateCondition = andOp(
        eq(animalOwnerships.ownerOpenId, userOpenId),
        eq(animalOwnerships.bitrixDealId, String(dealId)),
      );
    }

    if (!updateCondition) {
      return res.status(200).json({ ok: false, error: "cannot_identify_ownership" });
    }

    // Get current ownership state before update
    const existingRows = await db
      .select({
        id: animalOwnerships.id,
        status: animalOwnerships.status,
        animalId: animalOwnerships.animalId,
        ownerOpenId: animalOwnerships.ownerOpenId,
      })
      .from(animalOwnerships)
      .where(updateCondition);

    if (existingRows.length === 0) {
      console.warn(`[B24 Webhook] No ownership rows found for deal ${dealId}`);
      return res.status(200).json({ ok: false, error: "ownership_not_found" });
    }

    const currentStatus = existingRows[0].status;

    // Skip if status hasn't changed
    if (currentStatus === newOwnershipStatus) {
      console.log(`[B24 Webhook] Deal ${dealId}: status already ${currentStatus}, skipping`);
      return res.status(200).json({ ok: true, skipped: true, reason: "same_status" });
    }

    // Build update fields
    const updateFields: Record<string, unknown> = {
      status: newOwnershipStatus,
      bitrixStageId: stageId,
      updatedAt: new Date(),
    };

    if (newOwnershipStatus === "active" && currentStatus !== "active") {
      updateFields.paidAt = new Date();
    }
    if (newOwnershipStatus === "cancelled") {
      updateFields.cancelledAt = new Date();
    }

    await db.update(animalOwnerships).set(updateFields).where(updateCondition);

    // Recalculate animal status
    for (const row of existingRows) {
      await recalculateAnimalStatus(row.animalId);
    }

    // Audit log
    await createIntegrationAudit({
      ownerOpenId: existingRows[0]?.ownerOpenId || "system",
      integration: "bitrix24",
      entityType: "webhook",
      entityId: Number(dealId) || 0,
      operation: "webhook",
      requestPayload: JSON.stringify({ event, dealId, stageId }),
      responsePayload: JSON.stringify({
        updatedRows: existingRows.length,
        oldStatus: currentStatus,
        newStatus: newOwnershipStatus,
      }),
      status: "success",
    });

    console.log(
      `[B24 Webhook] Deal ${dealId}: ${currentStatus} → ${newOwnershipStatus} (${existingRows.length} rows updated)`,
    );

    return res.status(200).json({
      ok: true,
      dealId,
      stageId,
      oldStatus: currentStatus,
      newStatus: newOwnershipStatus,
      rowsUpdated: existingRows.length,
    });
  } catch (error) {
    console.error(`[B24 Webhook] Error processing deal ${dealId}:`, error);

    // Audit log for failures
    try {
      await createIntegrationAudit({
        ownerOpenId: "system",
        integration: "bitrix24",
        entityType: "webhook",
        entityId: Number(dealId) || 0,
        operation: "webhook",
        requestPayload: JSON.stringify({ event, dealId }),
        responsePayload: JSON.stringify({ error: String(error) }),
        status: "failed",
      });
    } catch (_) {
      // ignore audit failure
    }

    return res.status(200).json({ ok: false, error: "internal_error" });
  }
}

/**
 * Register Bitrix24 webhook routes on the Express app.
 */
export function registerBitrix24WebhookRoutes(app: Express) {
  if (!isBitrixConfigured()) {
    console.log("[B24 Webhook] Bitrix24 not configured, skipping webhook registration");
    return;
  }

  // Main webhook endpoint — handles ONCRMDEALUPDATE events
  app.post("/api/bitrix24/webhook", handleDealUpdate);

  // Health check for the webhook
  app.get("/api/bitrix24/webhook/health", (_req, res) => {
    res.json({ ok: true, configured: isBitrixConfigured(), timestamp: new Date().toISOString() });
  });

  console.log("[B24 Webhook] Registered at /api/bitrix24/webhook");
}
