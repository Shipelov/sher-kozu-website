import type { ZoyaAssembledContext } from "./zoyaContextAssembler";
import type { ZoyaOrchestrationDiagnostics } from "./zoyaOrchestrator";

export type ZoyaTransport = "trpc" | "sse";

export type ZoyaTelemetryEvent = {
  event: "zoya_orchestration";
  transport: ZoyaTransport;
  intent: ZoyaAssembledContext["intent"];
  contextStatus: ZoyaAssembledContext["status"];
  mode: ZoyaOrchestrationDiagnostics["mode"] | "internal_failure";
  outcome: ZoyaOrchestrationDiagnostics["aiOutcome"] | "failed";
  reasonCode: string | null;
  aiLatencyMs: number | null;
  totalLatencyMs: number;
  evidenceCount: number;
  confirmedProductCount: number;
  validationErrorCodes: string[];
};

function safeCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.split(":", 1)[0].trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return code.slice(0, 80) || null;
}

export function classifyZoyaFailure(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN_ERROR";
  if (error.name === "ZoyaValidationError") return "SERVER_DRAFT_VALIDATION_FAILED";
  if (error.name === "ZoyaStructuredOutputError") return "AI_CONTENT_INVALID";
  if (error.name === "AbortError" || /timeout|deadline|aborted/i.test(error.message)) return "REQUEST_TIMEOUT";
  return "INTERNAL_ORCHESTRATION_ERROR";
}

export function buildZoyaTelemetryEvent(input: {
  transport: ZoyaTransport;
  context: ZoyaAssembledContext;
  totalLatencyMs: number;
  diagnostics?: ZoyaOrchestrationDiagnostics;
  error?: unknown;
}): ZoyaTelemetryEvent {
  const validationErrorCodes = (input.diagnostics?.validationErrors ?? [])
    .map((item) => safeCode(item))
    .filter((item): item is string => Boolean(item));
  return {
    event: "zoya_orchestration",
    transport: input.transport,
    intent: input.context.intent,
    contextStatus: input.context.status,
    mode: input.diagnostics?.mode ?? "internal_failure",
    outcome: input.error ? "failed" : input.diagnostics?.aiOutcome ?? "failed",
    reasonCode: input.error
      ? classifyZoyaFailure(input.error)
      : safeCode(input.diagnostics?.aiReasonCode),
    aiLatencyMs: input.diagnostics?.aiLatencyMs ?? null,
    totalLatencyMs: Math.max(0, Math.round(input.totalLatencyMs)),
    evidenceCount: input.context.evidence.length,
    confirmedProductCount: input.context.confirmedProducts.length,
    validationErrorCodes,
  };
}

export function logZoyaTelemetry(event: ZoyaTelemetryEvent): void {
  if (event.outcome === "used" || event.outcome === "skipped") {
    console.info("[Zoya Orchestration]", event);
    return;
  }
  console.warn("[Zoya Orchestration]", event);
}
