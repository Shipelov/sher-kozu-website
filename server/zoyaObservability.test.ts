import { describe, expect, it, vi } from "vitest";
import { buildZoyaTelemetryEvent, classifyZoyaFailure, logZoyaTelemetry } from "./zoyaObservability";

const context = {
  status: "ready",
  intent: "personal_menu",
  evidence: [{ value: "sensitive evidence" }],
  confirmedProducts: [{ label: "Sensitive product" }],
} as any;

describe("Zoya observability", () => {
  it("emits only bounded operational metadata without query, profile or product labels", () => {
    const event = buildZoyaTelemetryEvent({
      transport: "sse",
      context,
      totalLatencyMs: 1234.7,
      diagnostics: {
        mode: "deterministic_menu",
        aiAttempted: true,
        aiOutcome: "fallback",
        aiReasonCode: "AI_CONTENT_INVALID:secret payload",
        aiLatencyMs: 900,
        validationErrors: ["unknown_farm_product:Sensitive product"],
      },
    });

    expect(event).toMatchObject({
      transport: "sse",
      intent: "personal_menu",
      outcome: "fallback",
      reasonCode: "AI_CONTENT_INVALID",
      evidenceCount: 1,
      confirmedProductCount: 1,
      validationErrorCodes: ["UNKNOWN_FARM_PRODUCT"],
      totalLatencyMs: 1235,
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("secret payload");
    expect(serialized).not.toContain("Sensitive product");
    expect(serialized).not.toContain("sensitive evidence");
  });

  it("classifies deterministic validation separately from transport failures", () => {
    const validation = new Error("unknown_farm_product:secret");
    validation.name = "ZoyaValidationError";
    expect(classifyZoyaFailure(validation)).toBe("SERVER_DRAFT_VALIDATION_FAILED");
    expect(classifyZoyaFailure(new DOMException("aborted", "AbortError"))).toBe("REQUEST_TIMEOUT");
  });

  it("uses warning logs only when the AI layer falls back or orchestration fails", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logZoyaTelemetry(buildZoyaTelemetryEvent({
      transport: "trpc",
      context,
      totalLatencyMs: 20,
      diagnostics: {
        mode: "verified_draft",
        aiAttempted: false,
        aiOutcome: "skipped",
        aiReasonCode: null,
        aiLatencyMs: null,
        validationErrors: [],
      },
    }));
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    info.mockRestore();
    warn.mockRestore();
  });
});
