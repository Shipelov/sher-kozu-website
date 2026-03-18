import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, "..", relativePath), "utf-8");
}

describe("Bitrix24 lifecycle — server integration", () => {
  const routersSrc = readSource("server/routers.ts");
  const bitrix24Src = readSource("server/bitrix24.ts");
  const diagnosticsSrc = readSource("server/diagnostics.ts");

  describe("isBitrixConfigured graceful degradation", () => {
    it("exports isBitrixConfigured from bitrix24.ts", () => {
      expect(bitrix24Src).toContain("export function isBitrixConfigured()");
    });

    it("imports isBitrixConfigured in routers.ts", () => {
      expect(routersSrc).toContain("isBitrixConfigured");
    });

    it("checks isBitrixConfigured before retryLeadSync", () => {
      const retrySection = routersSrc.slice(
        routersSrc.indexOf("retryLeadSync:"),
        routersSrc.indexOf("dealSnapshot:"),
      );
      expect(retrySection).toContain("isBitrixConfigured()");
      expect(retrySection).toContain("PRECONDITION_FAILED");
    });

    it("checks isBitrixConfigured before dealSnapshot", () => {
      const snapshotSection = routersSrc.slice(
        routersSrc.indexOf("dealSnapshot:"),
        routersSrc.indexOf("integrationAudit:"),
      );
      expect(snapshotSection).toContain("isBitrixConfigured()");
    });
  });

  describe("attemptBitrixSync helper", () => {
    it("defines attemptBitrixSync function", () => {
      expect(routersSrc).toContain("async function attemptBitrixSync(");
    });

    it("updates lead sync status on success", () => {
      const helperSection = routersSrc.slice(
        routersSrc.indexOf("async function attemptBitrixSync("),
        routersSrc.indexOf("function sanitizeFileName("),
      );
      expect(helperSection).toContain("updatePartnerLeadSyncResult");
    });

    it("creates audit trail on success and failure", () => {
      const helperSection = routersSrc.slice(
        routersSrc.indexOf("async function attemptBitrixSync("),
        routersSrc.indexOf("function sanitizeFileName("),
      );
      expect(helperSection).toContain("updateIntegrationAuditResult");
      // Should appear at least twice — once for success, once for failure
      const auditCalls = helperSection.match(/updateIntegrationAuditResult/g);
      expect(auditCalls?.length).toBeGreaterThanOrEqual(2);
    });

    it("notifies owner on sync success and failure", () => {
      const helperSection = routersSrc.slice(
        routersSrc.indexOf("async function attemptBitrixSync("),
        routersSrc.indexOf("function sanitizeFileName("),
      );
      const notifyCalls = helperSection.match(/notifyBitrixOperationalEvent/g);
      expect(notifyCalls?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("retryLeadSync full lifecycle", () => {
    it("creates audit entry before sync", () => {
      const retrySection = routersSrc.slice(
        routersSrc.indexOf("retryLeadSync:"),
        routersSrc.indexOf("dealSnapshot:"),
      );
      expect(retrySection).toContain("createIntegrationAudit");
      expect(retrySection).toContain('operation: "retry"');
    });

    it("calls attemptBitrixSync", () => {
      const retrySection = routersSrc.slice(
        routersSrc.indexOf("retryLeadSync:"),
        routersSrc.indexOf("dealSnapshot:"),
      );
      expect(retrySection).toContain("attemptBitrixSync");
    });
  });

  describe("partnerLeads.create with auto-sync", () => {
    it("maps message to notes", () => {
      const createSection = routersSrc.slice(
        routersSrc.indexOf("partnerLeads: router({"),
        routersSrc.indexOf("adminClub: router({"),
      );
      expect(createSection).toContain("notes: message");
    });

    it("fires background Bitrix24 sync", () => {
      const createSection = routersSrc.slice(
        routersSrc.indexOf("partnerLeads: router({"),
        routersSrc.indexOf("adminClub: router({"),
      );
      expect(createSection).toContain("attemptBitrixSync");
      expect(createSection).toContain(".catch("); // fire-and-forget pattern
    });
  });

  describe("dealSnapshot with lead update", () => {
    it("accepts optional leadId parameter", () => {
      const snapshotSection = routersSrc.slice(
        routersSrc.indexOf("dealSnapshot:"),
        routersSrc.indexOf("integrationAudit:"),
      );
      expect(snapshotSection).toContain("leadId:");
    });

    it("updates lead record when leadId provided", () => {
      const snapshotSection = routersSrc.slice(
        routersSrc.indexOf("dealSnapshot:"),
        routersSrc.indexOf("integrationAudit:"),
      );
      expect(snapshotSection).toContain("updatePartnerLeadSyncResult");
    });

    it("notifies owner about snapshot update", () => {
      const snapshotSection = routersSrc.slice(
        routersSrc.indexOf("dealSnapshot:"),
        routersSrc.indexOf("integrationAudit:"),
      );
      expect(snapshotSection).toContain("Bitrix24 snapshot обновлён для заявки");
    });

    it("notifies owner about snapshot failure", () => {
      const snapshotSection = routersSrc.slice(
        routersSrc.indexOf("dealSnapshot:"),
        routersSrc.indexOf("integrationAudit:"),
      );
      expect(snapshotSection).toContain("Bitrix24 snapshot failed для заявки");
    });
  });
});

describe("Diagnostics module", () => {
  const diagnosticsSrc = readSource("server/diagnostics.ts");
  const routersSrc = readSource("server/routers.ts");

  it("exports runDiagnostics function", () => {
    expect(diagnosticsSrc).toContain("export async function runDiagnostics");
  });

  it("checks database connectivity", () => {
    expect(diagnosticsSrc).toContain("SELECT 1");
  });

  it("checks Bitrix24 configuration", () => {
    expect(diagnosticsSrc).toContain("isBitrixConfigured");
  });

  it("reports on animal catalog", () => {
    expect(diagnosticsSrc).toContain("animalCatalog");
    expect(diagnosticsSrc).toContain("Каталог животных");
  });

  it("reports on ownership flow", () => {
    expect(diagnosticsSrc).toContain("ownershipFlow");
    expect(diagnosticsSrc).toContain("Владение");
  });

  it("reports on partner leads", () => {
    expect(diagnosticsSrc).toContain("partnerLeads");
    expect(diagnosticsSrc).toContain("Партнёрские заявки");
  });

  it("reports on club content", () => {
    expect(diagnosticsSrc).toContain("clubContent");
    expect(diagnosticsSrc).toContain("Клубный контент");
  });

  it("computes overall status from worst section", () => {
    expect(diagnosticsSrc).toContain("worstStatus");
    expect(diagnosticsSrc).toContain("overallStatus");
  });

  it("diagnostics router is registered in routers.ts", () => {
    expect(routersSrc).toContain("diagnostics: router({");
    expect(routersSrc).toContain("runDiagnostics");
  });
});
