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
