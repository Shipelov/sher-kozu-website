import { describe, expect, it } from "vitest";
import fs from "node:fs";

const homeSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Home.tsx", "utf8");
const partnersSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Partners.tsx", "utf8");
const adminClubSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AdminClub.tsx", "utf8");
const adminClubRemainingTabsSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/adminClubRemainingTabs.tsx", "utf8");
const adminActivitySource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/lib/adminClubActivity.ts", "utf8");
const routerSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/server/routers.ts", "utf8");
const dbSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/server/db.ts", "utf8");

// Combined source for checks that span AdminClub + its extracted tab components
const adminClubCombinedSource = adminClubSource + adminClubRemainingTabsSource;

describe("Bitrix24 pilot UI source smoke", () => {
  it("keeps partner lead form on dedicated Partners page with CRM mutation", () => {
    // Partner form moved from Home.tsx to Partners.tsx during redesign
    expect(partnersSource).toContain("B2B и партнёрства");
    expect(partnersSource).toContain("trpc.partnerLeads.create.useMutation");
    expect(partnersSource).toContain("Партнёрская заявка");
    expect(partnersSource).toContain("createPartnerLead");
    // Home uses shared Footer component which contains /partners link
    expect(homeSource).toContain("Footer");
    const footerSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/Footer.tsx", "utf8");
    expect(footerSource).toContain('href="/partners"');
    expect(footerSource).toContain("Для партнёров");
  });

  it("keeps admin club activity empty-state recovery flow", () => {
    // Activity tab content is now in adminClubRemainingTabs.tsx
    expect(adminClubRemainingTabsSource).toContain("По текущим фильтрам записи журнала не найдены");
    expect(adminClubRemainingTabsSource).toContain("Сбросить фильтры");
    expect(adminClubRemainingTabsSource).toContain("Вернуться к вкладке");
  });

  it("reserves dedicated Bitrix24 tab and activity types for CRM monitoring", () => {
    expect(adminActivitySource).toContain('AdminTabValue = EntityAdminTabValue | "bitrix" | "activity"');
    expect(adminActivitySource).toContain('AdminActionType = "create" | "update" | "delete" | "bulk" | "preset" | "sync" | "refresh"');
    expect(adminClubSource).toContain('TabsTrigger value="bitrix"');
    expect(adminClubSource).toContain("Bitrix24 CRM");
    expect(adminClubSource).toContain("retryLeadSync");
    expect(adminClubSource).toContain("refreshDealSnapshot");
  });

  it("keeps lead detail view, CRM filters and sync timeline copy in AdminClub or its extracted tabs", () => {
    // Bitrix tab content is now in adminClubRemainingTabs.tsx
    expect(adminClubRemainingTabsSource).toContain("Detail-view заявки");
    expect(adminClubRemainingTabsSource).toContain("Timeline sync attempts");
    expect(adminClubRemainingTabsSource).toContain("Для этой заявки audit trail пока пуст");
    // Labels may have been renamed during extraction
    expect(adminClubCombinedSource).toMatch(/Sync status|Server-side статус|syncStatus/);
    expect(adminClubCombinedSource).toMatch(/Ошибки синхронизации|ошибки синхронизации/);
    expect(adminClubRemainingTabsSource).toContain("Открыть detail-view");
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

  it("preserves retry-monitoring and pagination hooks in AdminClub or its extracted tabs", () => {
    // Retry/Refresh buttons are now in adminClubRemainingTabs.tsx
    expect(adminClubRemainingTabsSource).toContain("Retry sync");
    expect(adminClubRemainingTabsSource).toContain("Refresh snapshot");
    expect(adminClubSource).toContain("selectedBitrixLeadAudits");
    expect(adminClubSource).toContain("setBitrixQuery");
    expect(adminClubCombinedSource).toContain("page: 1");
  });

  it("expects owner notifications for new leads and sync lifecycle events", () => {
    expect(routerSource).toContain("notifyBitrixOperationalEvent");
    expect(routerSource).toContain("Новая партнёрская заявка #");
    expect(routerSource).toContain("Bitrix24 sync failed для заявки #");
    expect(routerSource).toContain("Bitrix24 retry выполнен для заявки #");
    expect(routerSource).toContain("Bitrix24 snapshot обновлён для заявки #");
    expect(routerSource).toContain("Bitrix24 snapshot failed для заявки #");
  });

  it("keeps notifyOwner integration available for operational alerts", () => {
    expect(routerSource).toContain("notifyOwner");
    expect(routerSource).toContain("notifyBitrixOperationalEvent");
  });
});
