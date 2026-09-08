import { ENV } from "./_core/env";
import { maskEmail } from "./_core/logSafety";

export type PartnerLeadAttachment = {
  name: string;
  mimeType: string;
  size: number;
  url: string;
  key?: string;
};

export type PartnerLeadSyncPayload = {
  id: number;
  fullName: string;
  companyName: string;
  email: string;
  phone?: string | null;
  telegram?: string | null;
  region?: string | null;
  source: "website" | "club" | "referral" | "manual";
  interestType: "retail" | "horeca" | "distribution" | "collaboration" | "other";
  preferredContactMethod: "email" | "phone" | "whatsapp" | "telegram" | "any";
  interestProducts?: string | null;
  notes?: string | null;
  attachments?: PartnerLeadAttachment[];
};

export type BitrixEntitySyncResult = {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  leadId?: string | null;
  stageId?: string | null;
  assignedManagerId?: string | null;
  assignedManagerName?: string | null;
  nextActivityAt?: Date | null;
  requestPayload: string;
  responsePayload: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/**
 * Returns true if we are running inside a test runner (vitest / jest).
 * Used to block external API calls during automated tests.
 */
function isTestEnvironment(): boolean {
  return (
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test" ||
    typeof (globalThis as any).__vitest_worker__ !== "undefined"
  );
}

/**
 * Returns true when all three Bitrix24 webhook secrets are present
 * AND we are NOT running inside a test runner.
 * Use this before calling any sync/pull function to enable graceful degradation.
 */
export function isBitrixConfigured(): boolean {
  if (isTestEnvironment()) return false;
  return Boolean(
    ENV.bitrix24BaseUrl?.trim() &&
    ENV.bitrix24RestUserId?.trim() &&
    ENV.bitrix24WebhookToken?.trim(),
  );
}

export function getBitrixWebhookBaseUrl() {
  const baseUrl = trimTrailingSlash(ENV.bitrix24BaseUrl);
  const userId = ENV.bitrix24RestUserId.trim();
  const token = ENV.bitrix24WebhookToken.trim();

  if (!baseUrl || !userId || !token) {
    throw new Error("Bitrix24 webhook secrets are not configured.");
  }

  return `${baseUrl}/rest/${userId}/${token}`;
}

/**
 * Split a full name string into Bitrix24-compatible fields.
 * Expected input format: "Фамилия Имя Отчество" (Russian convention).
 * Bitrix24 mapping:
 *   LAST_NAME  = Фамилия (first word)
 *   NAME       = Имя (second word)
 *   SECOND_NAME = Отчество (third word and beyond)
 */
export function splitFullName(fullName: string): {
  lastName: string;
  firstName: string;
  secondName: string;
} {
  const chunks = fullName.trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) {
    return { lastName: "Контакт", firstName: "Шерь Козу", secondName: "" };
  }
  if (chunks.length === 1) {
    return { lastName: chunks[0], firstName: "", secondName: "" };
  }
  if (chunks.length === 2) {
    return { lastName: chunks[0], firstName: chunks[1], secondName: "" };
  }
  // 3+ words: first = lastName, second = firstName, rest = secondName
  return {
    lastName: chunks[0],
    firstName: chunks[1],
    secondName: chunks.slice(2).join(" "),
  };
}

export function mapLeadSource(source: PartnerLeadSyncPayload["source"]) {
  switch (source) {
    case "website":
      return "WEB";
    case "club":
      return "CALL";
    case "referral":
      return "RECOMMENDATION";
    case "manual":
    default:
      return "SELF";
  }
}

export function formatLeadComment(input: PartnerLeadSyncPayload) {
  const attachmentLines = (input.attachments ?? []).map((attachment, index) => (
    `Файл ${index + 1}: ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes) — ${attachment.url}`
  ));

  return [
    `Sher Kozu Partner Lead #${input.id}`,
    `Источник: ${input.source}`,
    `Тип интереса: ${input.interestType}`,
    `Предпочтительный контакт: ${input.preferredContactMethod}`,
    input.region ? `Регион: ${input.region}` : null,
    input.telegram ? `Telegram: ${input.telegram}` : null,
    input.interestProducts ? `Интересующие продукты: ${input.interestProducts}` : null,
    input.notes ? `Комментарий: ${input.notes}` : null,
    attachmentLines.length ? "Вложения:" : null,
    ...attachmentLines,
  ].filter(Boolean).join("\n");
}

async function callBitrix<T>(method: string, body: Record<string, unknown>) {
  const response = await fetch(`${getBitrixWebhookBaseUrl()}/${method}.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json() as T & { error?: string; error_description?: string };

  if (!response.ok || json?.error) {
    throw new Error(json?.error_description || json?.error || `Bitrix24 request failed for ${method}`);
  }

  return json;
}

export async function syncPartnerLeadToBitrix(input: PartnerLeadSyncPayload): Promise<BitrixEntitySyncResult> {
  const { firstName, lastName, secondName } = splitFullName(input.fullName);

  const contactFields: Record<string, unknown> = {
    NAME: firstName,
    LAST_NAME: lastName,
    SECOND_NAME: secondName || undefined,
    OPENED: "Y",
    TYPE_ID: "CLIENT",
    SOURCE_ID: mapLeadSource(input.source),
    COMMENTS: formatLeadComment(input),
    EMAIL: [{ VALUE: input.email, VALUE_TYPE: "WORK" }],
    PHONE: input.phone ? [{ VALUE: input.phone, VALUE_TYPE: "WORK" }] : undefined,
    WEB: input.telegram ? [{ VALUE: `https://t.me/${input.telegram.replace(/^@/, "")}`, VALUE_TYPE: "OTHER" }] : undefined,
  };

  const companyFields: Record<string, unknown> = {
    TITLE: input.companyName,
    OPENED: "Y",
    COMMENTS: formatLeadComment(input),
  };

  const requestPayload = {
    contact: { fields: contactFields },
    company: { fields: companyFields },
  };

  const contactResponse = await callBitrix<{ result: number | string }>("crm.contact.add", {
    fields: contactFields,
    params: { REGISTER_SONET_EVENT: "Y" },
  });
  const contactId = String(contactResponse.result);

  const companyResponse = await callBitrix<{ result: number | string }>("crm.company.add", {
    fields: companyFields,
    params: { REGISTER_SONET_EVENT: "Y" },
  });
  const companyId = String(companyResponse.result);

  const dealFields: Record<string, unknown> = {
    TITLE: `Партнёрство: ${input.companyName}`,
    TYPE_ID: "SALE",
    SOURCE_ID: mapLeadSource(input.source),
    CONTACT_ID: contactId,
    COMPANY_ID: companyId,
    COMMENTS: formatLeadComment(input),
  };

  const dealResponse = await callBitrix<{ result: number | string }>("crm.deal.add", {
    fields: dealFields,
    params: { REGISTER_SONET_EVENT: "Y" },
  });
  const dealId = String(dealResponse.result);

  const dealGetResponse = await callBitrix<{ result?: Record<string, unknown> }>("crm.deal.get", {
    id: dealId,
  });

  const deal = dealGetResponse.result ?? {};
  const assignedManagerId = deal.ASSIGNED_BY_ID ? String(deal.ASSIGNED_BY_ID) : null;
  const stageId = deal.STAGE_ID ? String(deal.STAGE_ID) : null;
  const closeDate = typeof deal.CLOSEDATE === "string" && deal.CLOSEDATE ? new Date(deal.CLOSEDATE) : null;

  return {
    contactId,
    companyId,
    dealId,
    stageId,
    assignedManagerId,
    nextActivityAt: closeDate,
    requestPayload: JSON.stringify(requestPayload),
    responsePayload: JSON.stringify({
      contactResponse,
      companyResponse,
      dealResponse,
      dealGetResponse,
    }),
  };
}

// ─── Contact Management ─────────────────────────────────────

/**
 * Find an existing contact in Bitrix24 by email.
 * Returns the first matching contact ID or null.
 */
export async function findBitrixContactByEmail(email: string): Promise<string | null> {
  if (!isBitrixConfigured()) return null;
  try {
    const response = await callBitrix<{ result: Array<{ ID: string }> }>("crm.contact.list", {
      filter: { EMAIL: email },
      select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "EMAIL", "PHONE"],
    });
    const contacts = response.result;
    return contacts?.length > 0 ? String(contacts[0].ID) : null;
  } catch (e) {
    console.warn("[Bitrix24] findBitrixContactByEmail error:", e);
    return null;
  }
}

/**
 * Find an existing contact in Bitrix24 by phone.
 */
export async function findBitrixContactByPhone(phone: string): Promise<string | null> {
  if (!isBitrixConfigured()) return null;
  try {
    const response = await callBitrix<{ result: Array<{ ID: string }> }>("crm.contact.list", {
      filter: { PHONE: phone },
      select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "EMAIL", "PHONE"],
    });
    const contacts = response.result;
    return contacts?.length > 0 ? String(contacts[0].ID) : null;
  } catch (e) {
    console.warn("[Bitrix24] findBitrixContactByPhone error:", e);
    return null;
  }
}

/**
 * Create a new contact in Bitrix24 CRM.
 * Returns the new contact ID.
 */
export async function createBitrixContact(data: {
  firstName: string;
  lastName: string;
  secondName?: string;
  email: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isBitrixConfigured()) return null;
  try {
    const fields: Record<string, unknown> = {
      NAME: data.firstName,
      LAST_NAME: data.lastName,
      SECOND_NAME: data.secondName || undefined,
      OPENED: "Y",
      TYPE_ID: "CLIENT",
      SOURCE_ID: "WEB",
      SOURCE_DESCRIPTION: "Регистрация через сайт Шерь Козу",
      EMAIL: [{ VALUE: data.email, VALUE_TYPE: "WORK" }],
    };
    if (data.phone) {
      fields.PHONE = [{ VALUE: data.phone, VALUE_TYPE: "MOBILE" }];
    }
    const response = await callBitrix<{ result: number | string }>("crm.contact.add", {
      fields,
      params: { REGISTER_SONET_EVENT: "Y" },
    });
    return String(response.result);
  } catch (e) {
    console.warn("[Bitrix24] createBitrixContact error:", e);
    return null;
  }
}

/**
 * Find or create a contact in Bitrix24.
 * First searches by email, then by phone. If not found, creates a new one.
 */
export async function findOrCreateBitrixContact(data: {
  fullName: string;
  email: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isBitrixConfigured()) return null;

  // Try to find by email first
  let contactId = await findBitrixContactByEmail(data.email);
  if (contactId) return contactId;

  // Try by phone
  if (data.phone) {
    contactId = await findBitrixContactByPhone(data.phone);
    if (contactId) return contactId;
  }

  // Create new contact
  const { firstName, lastName, secondName } = splitFullName(data.fullName);
  return createBitrixContact({
    firstName,
    lastName,
    secondName,
    email: data.email,
    phone: data.phone,
  });
}

/**
 * Send an email to a contact via Bitrix24 CRM activity.
 * Uses crm.activity.add with TYPE_ID=4 (email).
 */
export async function sendBitrixEmail(params: {
  contactId: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
}): Promise<boolean> {
  if (!isBitrixConfigured()) return false;
  try {
    const userId = ENV.bitrix24RestUserId.trim();
    const now = new Date();
    const endTime = new Date(now.getTime() + 3600 * 1000);

    await callBitrix<{ result: number | string }>("crm.activity.add", {
      fields: {
        SUBJECT: params.subject,
        DESCRIPTION: params.htmlBody,
        DESCRIPTION_TYPE: 3, // 3 = HTML
        COMPLETED: "Y",
        DIRECTION: 2, // 2 = outgoing
        OWNER_ID: params.contactId,
        OWNER_TYPE_ID: 3, // 3 = contact
        TYPE_ID: 4, // 4 = email
        COMMUNICATIONS: [
          {
            VALUE: params.toEmail,
            ENTITY_ID: params.contactId,
            ENTITY_TYPE_ID: 3,
          },
        ],
        START_TIME: now.toISOString(),
        END_TIME: endTime.toISOString(),
        RESPONSIBLE_ID: userId,
        SETTINGS: {
          MESSAGE_FROM: `Шерь Козу <noreply@sherkozu.ru>`,
        },
      },
    });
    console.log(`[Bitrix24] Email sent to ${maskEmail(params.toEmail)} (contact ${params.contactId})`);
    return true;
  } catch (e) {
    console.warn("[Bitrix24] sendBitrixEmail error:", e);
    return false;
  }
}

// ─── Contact Sync from Bitrix24 to Site ─────────────────────

export type BitrixContact = {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  SECOND_NAME: string;
  EMAIL: Array<{ VALUE: string; VALUE_TYPE: string }> | null;
  PHONE: Array<{ VALUE: string; VALUE_TYPE: string }> | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
};

/**
 * Pull contacts from Bitrix24 CRM.
 * Supports pagination and optional date filter for incremental sync.
 */
export async function pullBitrixContacts(options?: {
  modifiedSince?: Date;
  start?: number;
  limit?: number;
}): Promise<{ contacts: BitrixContact[]; total: number; nextStart: number | null }> {
  if (!isBitrixConfigured()) return { contacts: [], total: 0, nextStart: null };

  const filter: Record<string, unknown> = {};
  if (options?.modifiedSince) {
    filter[">DATE_MODIFY"] = options.modifiedSince.toISOString();
  }

  const response = await callBitrix<{
    result: BitrixContact[];
    total: number;
    next?: number;
  }>("crm.contact.list", {
    filter,
    select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "EMAIL", "PHONE", "DATE_CREATE", "DATE_MODIFY"],
    order: { DATE_MODIFY: "DESC" },
    start: options?.start ?? 0,
  });

  return {
    contacts: response.result ?? [],
    total: response.total ?? 0,
    nextStart: response.next ?? null,
  };
}

export async function pullBitrixDealSnapshot(dealId: string) {
  const dealGetResponse = await callBitrix<{ result?: Record<string, unknown> }>("crm.deal.get", {
    id: dealId,
  });

  const deal = dealGetResponse.result ?? {};

  return {
    stageId: deal.STAGE_ID ? String(deal.STAGE_ID) : null,
    assignedManagerId: deal.ASSIGNED_BY_ID ? String(deal.ASSIGNED_BY_ID) : null,
    nextActivityAt: typeof deal.CLOSEDATE === "string" && deal.CLOSEDATE ? new Date(deal.CLOSEDATE) : null,
    responsePayload: JSON.stringify(dealGetResponse),
  };
}


// ─── Ownership → Bitrix24 Deal Sync ─────────────────────────────────────────
import {
  B24_CATEGORY_MAIN,
  B24_STAGE,
  B24_FIELD,
} from "@shared/bitrix24Constants";

export type OwnershipDealPayload = {
  ownershipId: number;
  ownerOpenId: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  animalId: number;
  animalName: string;
  animalSpecies: "goat" | "sheep";
  sharePercent: number;
  tariffName: string;
  priceMinor: number;
  profileUrl?: string;
};

/**
 * Create a deal in Bitrix24 "Персональное фермерство" funnel
 * when a user purchases an animal share on koza.vip.
 *
 * Returns the Bitrix24 deal ID and initial stage, or null on failure.
 */
export async function syncOwnershipDealToBitrix(
  payload: OwnershipDealPayload,
): Promise<{ dealId: string; stageId: string; contactId: string } | null> {
  if (!isBitrixConfigured()) {
    console.warn("[syncOwnershipDeal] Bitrix24 not configured — skipping sync");
    return null;
  }

  try {
    // 1. Find or create contact in Bitrix24
    let contactId: string | null = null;

    if (payload.ownerEmail) {
      contactId = await findBitrixContactByEmail(payload.ownerEmail);
    }
    if (!contactId && payload.ownerPhone) {
      contactId = await findBitrixContactByPhone(payload.ownerPhone);
    }
    if (!contactId) {
      const { firstName, lastName, secondName } = splitFullName(payload.ownerName);
      contactId = await createBitrixContact({
        firstName,
        lastName,
        secondName: secondName || undefined,
        email: payload.ownerEmail || "noemail@koza.vip",
        phone: payload.ownerPhone ?? undefined,
      });
    }

    // 2. Create deal in the main funnel
    const dealFields: Record<string, unknown> = {
      TITLE: `Доля ${payload.sharePercent}%: ${payload.animalName}`,
      CATEGORY_ID: B24_CATEGORY_MAIN,
      STAGE_ID: B24_STAGE.NEW_REQUEST,
      CONTACT_ID: contactId,
      OPPORTUNITY: payload.priceMinor / 100, // Convert minor to major currency
      CURRENCY_ID: "RUB",
      COMMENTS: [
        `Животное: ${payload.animalName} (${payload.animalSpecies === "goat" ? "коза" : "овца"})`,
        `Доля: ${payload.sharePercent}%`,
        `Тариф: ${payload.tariffName}`,
        `Цена: ${(payload.priceMinor / 100).toLocaleString("ru-RU")} ₽`,
        `Профиль: ${payload.profileUrl || "N/A"}`,
      ].join("\n"),
      // Custom fields
      [B24_FIELD.OWNERSHIP_ID]: String(payload.ownershipId),
      [B24_FIELD.ANIMAL_NAME]: payload.animalName,
      [B24_FIELD.SHARE_PCT]: payload.sharePercent,
      [B24_FIELD.TARIFF]: payload.tariffName,
      [B24_FIELD.PROFILE_URL]: payload.profileUrl || "",
      [B24_FIELD.USER_ID]: payload.ownerOpenId,
    };

    const dealResponse = await callBitrix<{ result: number | string }>("crm.deal.add", {
      fields: dealFields,
      params: { REGISTER_SONET_EVENT: "Y" },
    });

    const dealId = String(dealResponse.result);

    // 3. Create a task for the manager: "Позвонить новому клиенту"
    try {
      await callBitrix<{ result: { task: { id: number } } }>("tasks.task.add", {
        fields: {
          TITLE: `Позвонить: ${payload.ownerName} — ${payload.animalName} (${payload.sharePercent}%)`,
          DESCRIPTION: [
            `Новая заявка на долю животного.`,
            ``,
            `Клиент: ${payload.ownerName}`,
            `Email: ${payload.ownerEmail || "—"}`,
            `Телефон: ${payload.ownerPhone || "—"}`,
            `Животное: ${payload.animalName}`,
            `Доля: ${payload.sharePercent}%`,
            `Тариф: ${payload.tariffName}`,
            ``,
            `Необходимо связаться с клиентом в течение 2 часов.`,
          ].join("\n"),
          RESPONSIBLE_ID: 1, // Default to admin (ID 1)
          DEADLINE: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
          PRIORITY: 2, // High
          UF_CRM_TASK: [`D_${dealId}`], // Link task to deal
        },
      });
    } catch (taskErr) {
      console.warn("[syncOwnershipDeal] Failed to create task:", taskErr);
      // Non-critical — deal was created successfully
    }

    console.log(`[syncOwnershipDeal] Created deal ${dealId} for ownership ${payload.ownershipId}`);

    return {
      dealId,
      stageId: B24_STAGE.NEW_REQUEST,
      contactId: contactId!,
    };
  } catch (error) {
    console.error("[syncOwnershipDeal] Failed:", error);
    return null;
  }
}

/**
 * Update a Bitrix24 deal stage when ownership status changes on koza.vip.
 */
export async function updateBitrixDealStage(
  dealId: string,
  newStageId: string,
): Promise<boolean> {
  if (!isBitrixConfigured()) return false;

  try {
    await callBitrix<{ result: boolean }>("crm.deal.update", {
      id: dealId,
      fields: { STAGE_ID: newStageId },
    });
    console.log(`[updateBitrixDealStage] Deal ${dealId} → ${newStageId}`);
    return true;
  } catch (error) {
    console.error(`[updateBitrixDealStage] Failed for deal ${dealId}:`, error);
    return false;
  }
}

/**
 * Escalate a chat conversation from Masha AI to a client manager in Bitrix24.
 * Creates a CRM activity linked to the client's deal.
 */
export async function escalateChatToManager(params: {
  dealId: string;
  contactId: string;
  clientName: string;
  reason: string;
  chatSnapshot: string;
  topic: string;
}): Promise<{ activityId: string } | null> {
  if (!isBitrixConfigured()) return null;

  try {
    const activityResponse = await callBitrix<{ result: number | string }>("crm.activity.add", {
      fields: {
        OWNER_TYPE_ID: 2, // Deal
        OWNER_ID: params.dealId,
        TYPE_ID: 6, // Task
        SUBJECT: `Эскалация из чата: ${params.topic}`,
        DESCRIPTION: [
          `Причина эскалации: ${params.reason}`,
          `Клиент: ${params.clientName}`,
          ``,
          `--- Контекст разговора ---`,
          params.chatSnapshot,
        ].join("\n"),
        DESCRIPTION_TYPE: 1, // Plain text
        RESPONSIBLE_ID: 1, // Default manager
        PRIORITY: 2, // High
        DIRECTION: 1, // Incoming
        COMMUNICATIONS: [
          {
            TYPE: "PHONE",
            VALUE: "",
            ENTITY_ID: params.contactId,
            ENTITY_TYPE_ID: 3, // Contact
          },
        ],
      },
    });

    const activityId = String(activityResponse.result);
    console.log(`[escalateChatToManager] Created activity ${activityId} for deal ${params.dealId}`);
    return { activityId };
  } catch (error) {
    console.error("[escalateChatToManager] Failed:", error);
    return null;
  }
}


// ─── Product Plan Setup Task ─────────────────────

const B24_MANAGER_RESPONSIBLE_ID = "1"; // Андрей Шипелов

export interface ProductPlanSetupTaskParams {
  animalId: number;
  animalName: string;
  animalSlug: string;
  ownerName: string;
  ownerOpenId: string;
}

/**
 * Create a task in Bitrix24 for the manager to set up
 * the product plan (production profile + product options + plan) for an animal.
 * Deadline: 1 business day from now.
 */
export async function createProductPlanSetupTask(
  params: ProductPlanSetupTaskParams,
): Promise<{ taskId: string } | null> {
  if (!isBitrixConfigured()) {
    console.warn("[B24 Task] Bitrix24 not configured, skipping task creation");
    return null;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(18, 0, 0, 0);

  const description = [
    `🐐 Запрос на настройку продуктового плана`,
    ``,
    `Владелец "${params.ownerName}" запросил настройку продуктового плана для животного.`,
    ``,
    `📋 Что нужно сделать:`,
    `1. Создать Production Profile (animalProductionProfiles) для животного:`,
    `   — Указать annualMilkLiters, avgDailyMilkMl, fatPercent, proteinPercent`,
    `2. Создать Product Options (productOptions) для животного:`,
    `   — Добавить доступные продукты (молоко, сыр, творог и т.д.)`,
    `   — Указать цены, описания, единицы измерения`,
    `3. Убедиться, что владелец может создать план в дашборде`,
    ``,
    `🔗 Данные:`,
    `— Животное: ${params.animalName} (ID: ${params.animalId}, slug: ${params.animalSlug})`,
    `— Владелец: ${params.ownerName} (openId: ${params.ownerOpenId})`,
    `— Страница: koza.vip/dashboard → выбрать ${params.animalName} → Продуктовый план`,
    ``,
    `⚠️ После настройки система автоматически проверит наличие данных и уведомит владельца.`,
  ].join("\n");

  try {
    const response = await callBitrix<{ result: { task: { id: string } } }>(
      "tasks.task.add",
      {
        fields: {
          TITLE: `Настроить продуктовый план: ${params.animalName}`,
          DESCRIPTION: description,
          RESPONSIBLE_ID: B24_MANAGER_RESPONSIBLE_ID,
          CREATED_BY: B24_MANAGER_RESPONSIBLE_ID,
          PRIORITY: "2", // High
          DEADLINE: deadline.toISOString(),
          ALLOW_CHANGE_DEADLINE: "N",
          TAGS: ["product-plan-setup", "auto-request"],
        },
      },
    );

    const taskId = String(response.result.task.id);
    console.log(
      `[B24 Task] Created product plan setup task #${taskId} for animal ${params.animalName} (${params.animalId})`,
    );
    return { taskId };
  } catch (error) {
    console.error("[B24 Task] Failed to create product plan setup task:", error);
    return null;
  }
}

/**
 * Check if a B24 task is completed (status 5 = completed).
 */
export async function checkBitrixTaskCompleted(taskId: string): Promise<boolean> {
  if (!isBitrixConfigured()) return false;

  try {
    const response = await callBitrix<{ result: { task: { status: string } } }>(
      "tasks.task.get",
      { taskId },
    );
    // Status 5 = Completed, 4 = Supposedly completed (waiting for approval)
    return response.result.task.status === "5" || response.result.task.status === "4";
  } catch (error) {
    console.error(`[B24 Task] Failed to check task ${taskId}:`, error);
    return false;
  }
}

/**
 * Create a Bitrix24 task for a plan change request.
 * When an owner with a confirmed plan wants to change it,
 * the request goes through the manager instead of being auto-approved.
 */
export interface ProductPlanChangeTaskParams {
  animalId: number;
  animalName: string;
  animalSlug: string;
  ownerOpenId: string;
  ownerName: string;
  planId: number;
  currentSelections: string; // JSON of current selections
}

export async function createProductPlanChangeTask(
  params: ProductPlanChangeTaskParams,
): Promise<{ taskId: string } | null> {
  if (!isBitrixConfigured()) {
    console.warn("[B24 Task] Bitrix24 not configured, skipping plan change task creation");
    return null;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(18, 0, 0, 0);

  const description = [
    `📝 Запрос на изменение продуктового плана`,
    ``,
    `Владелец "${params.ownerName}" запросил изменение подтверждённого продуктового плана.`,
    ``,
    `📋 Что нужно сделать:`,
    `1. Связаться с владельцем и уточнить, какие изменения он хочет внести`,
    `2. При необходимости обновить доступные продукты в админке`,
    `3. Перевести план в статус "pending_owner_config" через админку`,
    `4. Уведомить владельца, что план открыт для изменения`,
    ``,
    `🔗 Данные:`,
    `— Животное: ${params.animalName} (ID: ${params.animalId}, slug: ${params.animalSlug})`,
    `— Владелец: ${params.ownerName} (openId: ${params.ownerOpenId})`,
    `— План ID: ${params.planId}`,
    `— Страница: koza.vip/dashboard → выбрать ${params.animalName} → Продуктовый план`,
    ``,
    `📊 Текущий план:`,
    `${params.currentSelections}`,
  ].join("\n");

  try {
    const response = await callBitrix<{ result: { task: { id: string } } }>(
      "tasks.task.add",
      {
        fields: {
          TITLE: `Изменение плана: ${params.ownerName} — ${params.animalName}`,
          DESCRIPTION: description,
          RESPONSIBLE_ID: B24_MANAGER_RESPONSIBLE_ID,
          CREATED_BY: B24_MANAGER_RESPONSIBLE_ID,
          PRIORITY: "1", // Normal
          DEADLINE: deadline.toISOString(),
          ALLOW_CHANGE_DEADLINE: "Y",
          TAGS: ["product-plan-change", "auto-request"],
        },
      },
    );

    const taskId = String(response.result.task.id);
    console.log(
      `[B24 Task] Created plan change task #${taskId} for ${params.ownerName} — ${params.animalName} (plan #${params.planId})`,
    );
    return { taskId };
  } catch (error) {
    console.error("[B24 Task] Failed to create plan change task:", error);
    return null;
  }
}

/**
 * Create a B24 task for the manager to confirm an owner-configured product plan.
 * Triggered when owner submits their plan configuration (status → pending_approval).
 * Deadline: 1 business day from now.
 */
export interface PlanConfirmationTaskParams {
  animalId: number;
  animalName: string;
  animalSlug: string;
  ownerOpenId: string;
  ownerName: string;
  planId: number;
  totalMilkUsed: number;
  selections: string; // formatted text of selected products
}

export async function createPlanConfirmationTask(
  params: PlanConfirmationTaskParams,
): Promise<{ taskId: string } | null> {
  if (!isBitrixConfigured()) {
    console.warn("[B24 Task] Bitrix24 not configured, skipping plan confirmation task creation");
    return null;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(18, 0, 0, 0);

  const description = [
    `✅ Запрос на подтверждение продуктового плана`,
    ``,
    `Владелец "${params.ownerName}" настроил продуктовый план и ожидает подтверждения.`,
    ``,
    `📋 Что нужно сделать:`,
    `1. Проверить выбранные продукты и объёмы в админ-панели`,
    `2. Убедиться, что план соответствует тарифу и возможностям фермы`,
    `3. Подтвердить план кнопкой "Подтвердить" в админ-панели`,
    ``,
    `🔗 Данные:`,
    `— Животное: ${params.animalName} (ID: ${params.animalId}, slug: ${params.animalSlug})`,
    `— Владелец: ${params.ownerName} (openId: ${params.ownerOpenId})`,
    `— План ID: ${params.planId}`,
    `— Использовано молока: ${params.totalMilkUsed} л`,
    `— Страница: koza.vip/admin → Продуктовый трекер → ${params.animalName}`,
    ``,
    `📊 Выбранные продукты:`,
    `${params.selections}`,
    ``,
    `⚠️ После подтверждения владелец получит уведомление, и будет сформирован график доставок.`,
  ].join("\n");

  try {
    const response = await callBitrix<{ result: { task: { id: string } } }>(
      "tasks.task.add",
      {
        fields: {
          TITLE: `Подтвердить план: ${params.ownerName} — ${params.animalName}`,
          DESCRIPTION: description,
          RESPONSIBLE_ID: B24_MANAGER_RESPONSIBLE_ID,
          CREATED_BY: B24_MANAGER_RESPONSIBLE_ID,
          PRIORITY: "2", // High
          DEADLINE: deadline.toISOString(),
          ALLOW_CHANGE_DEADLINE: "N",
          TAGS: ["product-plan-confirmation", "auto-request"],
        },
      },
    );

    const taskId = String(response.result.task.id);
    console.log(
      `[B24 Task] Created plan confirmation task #${taskId} for ${params.ownerName} — ${params.animalName} (plan #${params.planId})`,
    );
    return { taskId };
  } catch (error) {
    console.error("[B24 Task] Failed to create plan confirmation task:", error);
    return null;
  }
}
