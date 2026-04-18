/**
 * File Storage helpers.
 *
 * Priority order:
 * 1. VDS local disk (LOCAL_UPLOADS_DIR + BASE_URL configured)
 * 2. Direct S3 (S3_ENDPOINT + credentials configured)
 * 3. Manus Forge proxy (BUILT_IN_FORGE_API_URL + key)
 */
import { ENV } from "./_core/env";
import * as fs from "fs";
import * as path from "path";

// ─── VDS local storage mode ────────────────────────────────

function isLocalStorageConfigured(): boolean {
  return !!(ENV.localUploadsDir && ENV.baseUrl);
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

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
      "Storage credentials missing: configure LOCAL_UPLOADS_DIR+BASE_URL, or S3_ENDPOINT+S3_ACCESS_KEY_ID+S3_SECRET_ACCESS_KEY+S3_BUCKET, or BUILT_IN_FORGE_API_URL+BUILT_IN_FORGE_API_KEY"
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

  // ── VDS local disk ──
  if (isLocalStorageConfigured()) {
    const uploadsDir = ENV.localUploadsDir;
    const filePath = path.join(uploadsDir, key);
    await ensureDir(path.dirname(filePath));

    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await fs.promises.writeFile(filePath, body);

    const baseUrl = ENV.baseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/uploads/${key}`;
    return { key, url };
  }

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

  // ── VDS local disk ──
  if (isLocalStorageConfigured()) {
    const baseUrl = ENV.baseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/uploads/${key}`;
    return { key, url };
  }

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

/**
 * Delete a file from storage.
 * Only supported for VDS local and S3 modes.
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);

  // ── VDS local disk ──
  if (isLocalStorageConfigured()) {
    const filePath = path.join(ENV.localUploadsDir, key);
    await fs.promises.unlink(filePath).catch(() => {
      // File may already be deleted — ignore
    });
    return;
  }

  // ── Direct S3 ──
  if (isDirectS3Configured()) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
      })
    );
    return;
  }

  // Legacy Manus proxy doesn't support delete
}
