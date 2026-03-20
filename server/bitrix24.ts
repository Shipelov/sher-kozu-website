import { ENV } from "./_core/env";

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
 * Returns true when all three Bitrix24 webhook secrets are present.
 * Use this before calling any sync/pull function to enable graceful degradation.
 */
export function isBitrixConfigured(): boolean {
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

export function splitFullName(fullName: string) {
  const chunks = fullName.trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) {
    return { firstName: "Партнёр", lastName: "Sher Kozu" };
  }

  const [firstName, ...rest] = chunks;
  return {
    firstName,
    lastName: rest.join(" ") || "Sher Kozu",
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
  const { firstName, lastName } = splitFullName(input.fullName);

  const contactFields: Record<string, unknown> = {
    NAME: firstName,
    LAST_NAME: lastName,
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
      select: ["ID", "NAME", "LAST_NAME", "EMAIL", "PHONE"],
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
      select: ["ID", "NAME", "LAST_NAME", "EMAIL", "PHONE"],
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
  email: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isBitrixConfigured()) return null;
  try {
    const fields: Record<string, unknown> = {
      NAME: data.firstName,
      LAST_NAME: data.lastName,
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
  const { firstName, lastName } = splitFullName(data.fullName);
  return createBitrixContact({
    firstName,
    lastName,
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
    console.log(`[Bitrix24] Email sent to ${params.toEmail} (contact ${params.contactId})`);
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
    select: ["ID", "NAME", "LAST_NAME", "EMAIL", "PHONE", "DATE_CREATE", "DATE_MODIFY"],
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
