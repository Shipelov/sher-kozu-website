import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workerRoot = path.resolve(process.cwd(), "cloudflare/tg-proxy");

async function readWorker(relativePath: string) {
  return readFile(path.join(workerRoot, relativePath), "utf8");
}

// С 2026-09-09 src/worker.js развивается в репозитории (Anthropic через AI Gateway,
// stream, транскрипция); checksums экспорта f364d3ca остаются в metadata как история.
describe("Cloudflare tg-proxy export", () => {
  it("keeps the export provenance and marks the source as modified in the repo", async () => {
    const metadata = JSON.parse(await readWorker("export-metadata.json"));

    expect(metadata.activeVersionId).toBe("f364d3ca");
    expect(metadata.productionChangedDuringExport).toBe(false);
    expect(metadata.exportedNormalizedLfSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(metadata.modifiedInRepoSince).toBe("2026-09-09");
    expect(metadata.anthropicViaAiGateway).toBe(true);
  });

  it("documents the real AI binding, the fallback model, and supported routes", async () => {
    const config = JSON.parse(await readWorker("wrangler.jsonc"));
    const source = await readWorker("src/worker.js");

    expect(config.name).toBe("tg-proxy");
    expect(config.main).toBe("src/worker.js");
    expect(config.ai).toEqual({ binding: "AI" });
    expect(source).toContain('const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"');
    expect(source).toContain('const WORKERS_AI_WHISPER_MODEL = "@cf/openai/whisper"');
    expect(source).toContain('url.pathname === "/openai/v1/chat/completions"');
    expect(source).toContain('url.pathname === "/openai/v1/audio/transcriptions"');
    expect(source).toContain("/anthropic/v1/messages");
    expect(source).toContain('url.pathname.startsWith("/webhook/")');
    expect(source).toContain('url.pathname.startsWith("/sdk/")');
    expect(source).toContain('url.pathname === "/health"');
  });

  it("declares secret names without committing common literal credentials or IP addresses", async () => {
    const config = JSON.parse(await readWorker("wrangler.jsonc"));
    const source = await readWorker("src/worker.js");
    const requiredSecrets = [
      "ALERT_BOT_TOKEN",
      "ALERT_CHAT_ID",
      "OPENAI_PROXY_SECRET",
      "PROXY_SECRET",
      "ANTHROPIC_API_KEY",
      "AI_GATEWAY_URL",
      "ANTHROPIC_MODEL_SONNET",
      "ANTHROPIC_MODEL_HAIKU",
    ];

    expect(config.secrets.required).toEqual(requiredSecrets);
    for (const secretName of [...requiredSecrets, "AI_GATEWAY_TOKEN"]) {
      expect(source).toMatch(new RegExp(`env\\?*\\.${secretName}`));
    }

    expect(source).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(source).not.toMatch(/\d{8,}:[A-Za-z0-9_-]{20,}/);
    expect(source).not.toMatch(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
    expect(source).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });
});
