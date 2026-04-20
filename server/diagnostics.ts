/**
 * Operational diagnostics for Sher Kozu.
 *
 * Provides a lightweight health summary across critical flows:
 * - Database connectivity
 * - Bitrix24 integration status
 * - Animal catalog health
 * - Ownership flow metrics
 * - Partner lead sync status
 *
 * Designed for the admin dashboard — not a public endpoint.
 */

import { and, count, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { isBitrixConfigured } from "./bitrix24";
import {
  animals,
  animalOwnerships,
  partnerLeads,
  integrationAudits,
  clubPosts,
  clubEvents,
  clubMembers,
} from "../drizzle/schema";

export type DiagnosticStatus = "healthy" | "degraded" | "critical" | "unknown";

export interface DiagnosticSection {
  status: DiagnosticStatus;
  label: string;
  details: Record<string, string | number | boolean | null>;
}

export interface DiagnosticsReport {
  timestamp: number;
  overallStatus: DiagnosticStatus;
  sections: {
    database: DiagnosticSection;
    bitrix24: DiagnosticSection;
    animalCatalog: DiagnosticSection;
    ownershipFlow: DiagnosticSection;
    partnerLeads: DiagnosticSection;
    clubContent: DiagnosticSection;
  };
}

function worstStatus(...statuses: DiagnosticStatus[]): DiagnosticStatus {
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("unknown")) return "unknown";
  return "healthy";
}

export async function runDiagnostics(ownerOpenId: string): Promise<DiagnosticsReport> {
  const timestamp = Date.now();

  // 1. Database connectivity
  let dbSection: DiagnosticSection;
  const db = await getDb();
  if (!db) {
    dbSection = {
      status: "critical",
      label: "База данных",
      details: { connected: false, error: "DATABASE_URL не настроен или подключение не удалось" },
    };
  } else {
    try {
      await db.execute(sql`SELECT 1`);
      dbSection = {
        status: "healthy",
        label: "База данных",
        details: { connected: true, error: null },
      };
    } catch (error) {
      dbSection = {
        status: "critical",
        label: "База данных",
        details: { connected: false, error: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }

  // If no DB, return early with critical status
  if (!db) {
    return {
      timestamp,
      overallStatus: "critical",
      sections: {
        database: dbSection,
        bitrix24: { status: "unknown", label: "Bitrix24 CRM", details: { configured: false, reason: "Нет подключения к БД" } },
        animalCatalog: { status: "unknown", label: "Каталог животных", details: { reason: "Нет подключения к БД" } },
        ownershipFlow: { status: "unknown", label: "Владение", details: { reason: "Нет подключения к БД" } },
        partnerLeads: { status: "unknown", label: "Партнёрские заявки", details: { reason: "Нет подключения к БД" } },
        clubContent: { status: "unknown", label: "Клубный контент", details: { reason: "Нет подключения к БД" } },
      },
    };
  }

  // 2. Bitrix24 integration
  const bitrixConfigured = isBitrixConfigured();
  let bitrixSection: DiagnosticSection;

  if (!bitrixConfigured) {
    bitrixSection = {
      status: "degraded",
      label: "Bitrix24 CRM",
      details: {
        configured: false,
        reason: "BITRIX24_BASE_URL, BITRIX24_REST_USER_ID или BITRIX24_WEBHOOK_TOKEN не указаны",
        pendingSyncs: 0,
        failedSyncs: 0,
      },
    };
  } else {
    const [pendingResult, failedResult, failedAuditsResult] = await Promise.all([
      db.select({ cnt: count() }).from(partnerLeads).where(and(eq(partnerLeads.ownerOpenId, ownerOpenId), eq(partnerLeads.syncStatus, "pending"))),
      db.select({ cnt: count() }).from(partnerLeads).where(and(eq(partnerLeads.ownerOpenId, ownerOpenId), eq(partnerLeads.syncStatus, "failed"))),
      db.select({ cnt: count() }).from(integrationAudits).where(and(eq(integrationAudits.ownerOpenId, ownerOpenId), eq(integrationAudits.status, "failed"))),
    ]);

    const pendingSyncs = pendingResult[0]?.cnt ?? 0;
    const failedSyncs = failedResult[0]?.cnt ?? 0;
    const failedAudits = failedAuditsResult[0]?.cnt ?? 0;

    const bitrixStatus: DiagnosticStatus =
      failedSyncs > 5 ? "critical" :
      failedSyncs > 0 || pendingSyncs > 10 ? "degraded" :
      "healthy";

    bitrixSection = {
      status: bitrixStatus,
      label: "Bitrix24 CRM",
      details: {
        configured: true,
        pendingSyncs,
        failedSyncs,
        failedAudits,
      },
    };
  }

  // 3. Animal catalog
  const [totalAnimals, publicAnimals, hiddenAnimals, archivedAnimals] = await Promise.all([
    db.select({ cnt: count() }).from(animals).where(eq(animals.ownerOpenId, ownerOpenId)),
    db.select({ cnt: count() }).from(animals).where(and(eq(animals.ownerOpenId, ownerOpenId), eq(animals.status, "public_available"))),
    db.select({ cnt: count() }).from(animals).where(and(eq(animals.ownerOpenId, ownerOpenId), eq(animals.status, "hidden"))),
    db.select({ cnt: count() }).from(animals).where(and(eq(animals.ownerOpenId, ownerOpenId), eq(animals.status, "archived"))),
  ]);

  const totalCount = totalAnimals[0]?.cnt ?? 0;
  const publicCount = publicAnimals[0]?.cnt ?? 0;
  const hiddenCount = hiddenAnimals[0]?.cnt ?? 0;
  const archivedCount = archivedAnimals[0]?.cnt ?? 0;

  const catalogStatus: DiagnosticStatus =
    totalCount === 0 ? "degraded" :
    publicCount === 0 ? "degraded" :
    "healthy";

  const animalCatalogSection: DiagnosticSection = {
    status: catalogStatus,
    label: "Каталог животных",
    details: {
      total: totalCount,
      public: publicCount,
      hidden: hiddenCount,
      archived: archivedCount,
    },
  };

  // 4. Ownership flow
  const [activeOwnerships, cancelledOwnerships, frozenOwnerships] = await Promise.all([
    db.select({ cnt: count() }).from(animalOwnerships).where(eq(animalOwnerships.status, "active")),
    db.select({ cnt: count() }).from(animalOwnerships).where(eq(animalOwnerships.status, "cancelled")),
    db.select({ cnt: count() }).from(animalOwnerships).where(eq(animalOwnerships.status, "frozen")),
  ]);

  const activeCount = activeOwnerships[0]?.cnt ?? 0;
  const cancelledCount = cancelledOwnerships[0]?.cnt ?? 0;
  const frozenCount = frozenOwnerships[0]?.cnt ?? 0;

  const ownershipSection: DiagnosticSection = {
    status: "healthy",
    label: "Владение",
    details: {
      activeOwnerships: activeCount,
      cancelledOwnerships: cancelledCount,
      frozenOwnerships: frozenCount,
    },
  };

  // 5. Partner leads
  const [totalLeads, pendingLeads, failedLeads] = await Promise.all([
    db.select({ cnt: count() }).from(partnerLeads).where(eq(partnerLeads.ownerOpenId, ownerOpenId)),
    db.select({ cnt: count() }).from(partnerLeads).where(and(eq(partnerLeads.ownerOpenId, ownerOpenId), eq(partnerLeads.syncStatus, "pending"))),
    db.select({ cnt: count() }).from(partnerLeads).where(and(eq(partnerLeads.ownerOpenId, ownerOpenId), eq(partnerLeads.syncStatus, "failed"))),
  ]);

  const totalLeadCount = totalLeads[0]?.cnt ?? 0;
  const pendingLeadCount = pendingLeads[0]?.cnt ?? 0;
  const failedLeadCount = failedLeads[0]?.cnt ?? 0;

  const leadsStatus: DiagnosticStatus =
    failedLeadCount > 5 ? "critical" :
    failedLeadCount > 0 ? "degraded" :
    "healthy";

  const partnerLeadsSection: DiagnosticSection = {
    status: leadsStatus,
    label: "Партнёрские заявки",
    details: {
      total: totalLeadCount,
      pending: pendingLeadCount,
      failed: failedLeadCount,
    },
  };

  // 6. Club content
  const [postsCount, eventsCount, membersCount] = await Promise.all([
    db.select({ cnt: count() }).from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)),
    db.select({ cnt: count() }).from(clubEvents).where(eq(clubEvents.ownerOpenId, ownerOpenId)),
    db.select({ cnt: count() }).from(clubMembers).where(eq(clubMembers.ownerOpenId, ownerOpenId)),
  ]);

  const clubContentSection: DiagnosticSection = {
    status: "healthy",
    label: "Клубный контент",
    details: {
      posts: postsCount[0]?.cnt ?? 0,
      events: eventsCount[0]?.cnt ?? 0,
      members: membersCount[0]?.cnt ?? 0,
    },
  };

  const overallStatus = worstStatus(
    dbSection.status,
    bitrixSection.status,
    animalCatalogSection.status,
    ownershipSection.status,
    partnerLeadsSection.status,
    clubContentSection.status,
  );

  return {
    timestamp,
    overallStatus,
    sections: {
      database: dbSection,
      bitrix24: bitrixSection,
      animalCatalog: animalCatalogSection,
      ownershipFlow: ownershipSection,
      partnerLeads: partnerLeadsSection,
      clubContent: clubContentSection,
    },
  };
}
