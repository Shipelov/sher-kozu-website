/**
 * S3 Storage helpers — direct AWS SDK (compatible with Yandex Object Storage).
 *
 * Falls back to the Manus Forge proxy if S3_ENDPOINT is not configured,
 * so the code works in both environments during migration.
 */
import { ENV } from "./_core/env";

// ─── Direct S3 mode (AWS SDK) ───────────────────────────────

let s3ClientPromise: Promise<any> | null = null;

async function getS3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      return new S3Client({
        endpoint: ENV.s3Endpoint,
        region: ENV.s3Region,
        credentials: {
          accessKeyId: ENV.s3AccessKeyId,
          secretAccessKey: ENV.s3SecretAccessKey,
        },
        forcePathStyle: true, // Required for Yandex Object Storage
      });
    })();
  }
  return s3ClientPromise;
}

function isDirectS3Configured(): boolean {
  return !!(ENV.s3Endpoint && ENV.s3AccessKeyId && ENV.s3SecretAccessKey && ENV.s3Bucket);
}

// ─── Legacy Manus proxy mode ────────────────────────────────

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage credentials missing: configure S3_ENDPOINT+S3_ACCESS_KEY_ID+S3_SECRET_ACCESS_KEY+S3_BUCKET, or BUILT_IN_FORGE_API_URL+BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// ─── Public API ─────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  // ── Direct S3 ──
  if (isDirectS3Configured()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const body = typeof data === "string" ? Buffer.from(data) : data;

    await client.send(
      new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    // Construct public URL
    const endpoint = ENV.s3Endpoint.replace(/\/+$/, "");
    const url = `${endpoint}/${ENV.s3Bucket}/${key}`;
    return { key, url };
  }

  // ── Legacy Manus proxy ──
  const { baseUrl, apiKey } = getStorageConfig();
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  // ── Direct S3 ──
  if (isDirectS3Configured()) {
    const endpoint = ENV.s3Endpoint.replace(/\/+$/, "");
    const url = `${endpoint}/${ENV.s3Bucket}/${key}`;
    return { key, url };
  }

  // ── Legacy Manus proxy ──
  const { baseUrl, apiKey } = getStorageConfig();
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return { key, url: (await response.json()).url };
}
