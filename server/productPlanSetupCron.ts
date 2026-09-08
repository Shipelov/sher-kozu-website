/**
 * productPlanSetupCron.ts
 *
 * Standalone cron function that checks pending product plan setup requests.
 * When the manager has configured the production profile + product options,
 * it marks the request as completed and notifies the owner via:
 *   1. Telegram
 *   2. Email (via Bitrix24 CRM)
 *   3. In-app notification
 *
 * Called from server/_core/index.ts every 5 minutes via setInterval.
 */

import {
  getPendingSetupRequests,
  isProductPlanConfigured,
  updateSetupRequestStatus,
  getAnimalNameById,
  createUserNotification,
  getUserProfile,
} from "./db";
import { sendTelegramNotification } from "./telegramBot";
import { maskEmail } from "./_core/logSafety";
import {
  isBitrixConfigured,
  findOrCreateBitrixContact,
  sendBitrixEmail,
} from "./bitrix24";

/**
 * Build a styled HTML email body for product plan ready notification.
 */
function buildProductPlanReadyEmailHtml(animalName: string): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f9f7f2;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e4dc;">
    <div style="background:#2d5016;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">🎉 Продуктовый план готов!</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 16px;">
        Продуктовый план для <strong>${animalName}</strong> настроен нашим менеджером.
      </p>
      <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 24px;">
        Теперь вы можете зайти в личный кабинет, выбрать продукты и сформировать свой персональный план.
      </p>
      <a href="https://koza.vip/dashboard"
         style="display:inline-block;background:#2d5016;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
        Перейти в личный кабинет
      </a>
      <p style="font-size:13px;color:#888;margin:24px 0 0;line-height:1.5;">
        Если у вас есть вопросы, напишите нашему AI-ассистенту Маше в Telegram
        или свяжитесь с менеджером через личный кабинет.
      </p>
    </div>
    <div style="background:#f5f3ee;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">
        Шерь Козу — Персональное фермерство · <a href="https://koza.vip" style="color:#2d5016;">koza.vip</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Send email notification to the owner via Bitrix24 CRM.
 * Returns true if email was sent successfully.
 */
async function sendProductPlanReadyEmail(
  ownerOpenId: string,
  animalName: string,
): Promise<boolean> {
  if (!isBitrixConfigured()) {
    console.log("[ProductPlanCron] Bitrix24 not configured, skipping email");
    return false;
  }

  try {
    // Get owner's email from profile
    const profile = await getUserProfile(ownerOpenId);
    if (!profile?.email) {
      console.log(`[ProductPlanCron] No email for user ${ownerOpenId}, skipping email`);
      return false;
    }

    // Find or create Bitrix24 contact
    const contactId = await findOrCreateBitrixContact({
      fullName: ownerOpenId, // minimal fallback
      email: profile.email,
    });

    if (!contactId) {
      console.warn(`[ProductPlanCron] Could not find/create B24 contact for ${maskEmail(profile.email)}`);
      return false;
    }

    // Send the email
    const sent = await sendBitrixEmail({
      contactId,
      toEmail: profile.email,
      subject: `Продуктовый план для ${animalName} готов — Шерь Козу`,
      htmlBody: buildProductPlanReadyEmailHtml(animalName),
    });

    if (sent) {
      console.log(`[ProductPlanCron] Email sent to ${maskEmail(profile.email)} for animal ${animalName}`);
    }
    return sent;
  } catch (err) {
    console.error("[ProductPlanCron] Email send error:", err);
    return false;
  }
}

/**
 * Main cron function: check all pending product plan setup requests.
 * For each one where the production profile is now configured:
 *   1. Mark as completed
 *   2. Notify owner via Telegram
 *   3. Notify owner via Email (Bitrix24)
 *   4. Create in-app notification
 */
export async function runProductPlanSetupCheck(): Promise<void> {
  try {
    const pending = await getPendingSetupRequests();
    if (pending.length === 0) return; // Nothing to check

    console.log(`[ProductPlanCron] Checking ${pending.length} pending setup request(s)…`);

    for (const req of pending) {
      try {
        const configured = await isProductPlanConfigured(req.animalId);
        if (!configured) continue; // Not yet configured, skip

        // Product plan is now configured — mark as completed
        await updateSetupRequestStatus(req.id, "completed", {
          completedAt: new Date(),
        });

        const animalName = await getAnimalNameById(req.animalId);
        const displayName = animalName || "вашего животного";

        // 1. Telegram notification
        const tgSent = await sendTelegramNotification(
          req.ownerOpenId,
          `🎉 Продуктовый план готов!\n\nПродуктовый план для ${displayName} настроен.\nТеперь вы можете выбрать продукты и сформировать свой план в личном кабинете.\n\n👉 koza.vip/dashboard`,
        ).catch(() => false);

        // 2. Email notification via Bitrix24
        const emailSent = await sendProductPlanReadyEmail(req.ownerOpenId, displayName);

        // 3. In-app notification
        await createUserNotification({
          userOpenId: req.ownerOpenId,
          type: "product_plan_ready",
          title: "Продуктовый план готов!",
          body: `Продуктовый план для ${displayName} настроен. Зайдите в личный кабинет, чтобы выбрать продукты.`,
          link: "/dashboard",
        });

        // Update with notification status
        await updateSetupRequestStatus(req.id, "completed", {
          completedAt: new Date(),
          ownerNotified: true,
        });

        console.log(
          `[ProductPlanCron] Request #${req.id} completed for animal ${req.animalId}. ` +
          `Telegram: ${tgSent ? "✓" : "✗"}, Email: ${emailSent ? "✓" : "✗"}, In-app: ✓`,
        );
      } catch (err) {
        console.error(`[ProductPlanCron] Error processing request #${req.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[ProductPlanCron] Cron error:", err);
  }
}
