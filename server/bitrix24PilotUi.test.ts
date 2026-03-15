import { describe, expect, it } from "vitest";
import fs from "node:fs";

const homeSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Home.tsx", "utf8");
const adminClubSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AdminClub.tsx", "utf8");
const adminActivitySource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/lib/adminClubActivity.ts", "utf8");
const routerSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/server/routers.ts", "utf8");
const dbSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/server/db.ts", "utf8");

describe("Bitrix24 pilot UI source smoke", () => {
  it("keeps partner lead section on home with CRM mutation and admin route", () => {
    expect(homeSource).toContain("Стать партнёром Sher Kozu");
    expect(homeSource).toContain("trpc.bitrix24.createPartnerLead.useMutation");
    expect(homeSource).toContain("Последняя заявка и статус pilot-синхронизации");
    expect(homeSource).toContain('href="/admin/club"');
  });

  it("keeps admin club activity empty-state recovery flow", () => {
    expect(adminClubSource).toContain("По текущим фильтрам записи журнала не найдены");
    expect(adminClubSource).toContain("Сбросить фильтры");
    expect(adminClubSource).toContain("Вернуться к вкладке");
  });

  it("reserves dedicated Bitrix24 tab and activity types for CRM monitoring", () => {
    expect(adminActivitySource).toContain('AdminTabValue = EntityAdminTabValue | "bitrix" | "activity"');
    expect(adminActivitySource).toContain('AdminActionType = "create" | "update" | "delete" | "bulk" | "preset" | "sync" | "refresh"');
    expect(adminClubSource).toContain('TabsTrigger value="bitrix"');
    expect(adminClubSource).toContain("Bitrix24 CRM");
    expect(adminClubSource).toContain("retryLeadSync");
    expect(adminClubSource).toContain("refreshDealSnapshot");
  });

  it("keeps lead detail view, CRM filters and sync timeline copy in AdminClub", () => {
    expect(adminClubSource).toContain("Detail-view заявки");
    expect(adminClubSource).toContain("Timeline sync attempts");
    expect(adminClubSource).toContain("Для этой заявки audit trail пока пуст");
    expect(adminClubSource).toContain("Sync status");
    expect(adminClubSource).toContain("Ошибки синхронизации");
    expect(adminClubSource).toContain("Открыть detail-view");
  });

  it("expects server-side Bitrix24 filter and pagination contracts", () => {
    expect(routerSource).toContain("bitrixAdminDashboardInput");
    expect(routerSource).toContain("adminDashboard: adminProcedure.input(bitrixAdminDashboardInput)");
    expect(dbSource).toContain("pageCount");
    expect(dbSource).toContain("totalFilteredLeads");
    expect(adminClubSource).toContain("bitrixQuery");
    expect(adminClubSource).toContain("bitrixPagination");
    expect(adminClubSource).toContain("visibleBitrixLeads");
  });

  it("preserves retry-monitoring and pagination hooks in AdminClub", () => {
    expect(adminClubSource).toContain("Retry sync");
    expect(adminClubSource).toContain("Refresh snapshot");
    expect(adminClubSource).toContain("selectedBitrixLeadAudits");
    expect(adminClubSource).toContain("setBitrixQuery");
    expect(adminClubSource).toContain("page: 1");
  });
});
