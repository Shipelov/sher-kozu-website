#!/usr/bin/env node
/**
 * One-time backfill script: generate mobile WebP variants for existing CMS images.
 *
 * For each cmsBlocks row that has an imageUrl but no mobileImageUrl,
 * this script:
 *   1. Downloads the original image
 *   2. Resizes to 800px wide WebP (quality 80) using sharp
 *   3. Uploads the mobile variant via the same storage layer (VDS local / S3 / Forge)
 *   4. Updates the DB row with the new mobileImageUrl
 *
 * Usage:
 *   node scripts/backfill-mobile-images.mjs          # dry-run (default)
 *   node scripts/backfill-mobile-images.mjs --apply   # actually process and update
 *
 * Environment: requires DATABASE_URL and storage env vars (same as the app).
 * Run from the project root: cd /var/www/sherkozu/current && node scripts/backfill-mobile-images.mjs --apply
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ─── Config ────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes("--apply");
const MOBILE_WIDTH = 800;
const WEBP_QUALITY = 80;

// ─── Storage helpers (inline, mirrors server/storage.ts logic) ──
const ENV = {
  localUploadsDir: process.env.LOCAL_UPLOADS_DIR ?? "",
  baseUrl: process.env.BASE_URL ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "ru-central1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

function isLocalStorage() {
  return !!(ENV.localUploadsDir && ENV.baseUrl);
}

function isDirectS3() {
  return !!(ENV.s3Endpoint && ENV.s3AccessKeyId && ENV.s3SecretAccessKey && ENV.s3Bucket);
}

async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = relKey.replace(/^\/+/, "");

  // VDS local disk
  if (isLocalStorage()) {
    const filePath = path.join(ENV.localUploadsDir, key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
    const baseUrl = ENV.baseUrl.replace(/\/+$/, "");
    return { key, url: `${baseUrl}/uploads/${key}` };
  }

  // Direct S3
  if (isDirectS3()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint: ENV.s3Endpoint,
      region: ENV.s3Region,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
      forcePathStyle: true,
    });
    await client.send(new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
    const endpoint = ENV.s3Endpoint.replace(/\/+$/, "");
    return { key, url: `${endpoint}/${ENV.s3Bucket}/${key}` };
  }

  // Forge proxy
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const uploadUrl = new URL("v1/storage/upload", baseUrl + "/");
  uploadUrl.searchParams.set("path", key);
  const blob = new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status} ${await resp.text()}`);
  return { key, url: (await resp.json()).url };
}

// ─── Download helper ───────────────────────────────────────
async function downloadImage(url) {
  // For VDS local storage, read from disk directly
  if (isLocalStorage() && url.startsWith(ENV.baseUrl.replace(/\/+$/, ""))) {
    const relativePath = url.replace(ENV.baseUrl.replace(/\/+$/, "") + "/uploads/", "");
    const filePath = path.join(ENV.localUploadsDir, relativePath);
    return fs.promises.readFile(filePath);
  }

  // Otherwise fetch from URL
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`\n🔧 CMS Mobile Image Backfill ${DRY_RUN ? "(DRY RUN)" : "(APPLYING)"}`);
  console.log(`   Storage mode: ${isLocalStorage() ? "VDS local" : isDirectS3() ? "S3" : "Forge proxy"}\n`);

  // Connect to DB
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Find all CMS blocks with imageUrl but no mobileImageUrl
  const [blocks] = await connection.execute(
    `SELECT id, page, blockKey, imageUrl, mobileImageUrl
     FROM cmsBlocks
     WHERE imageUrl IS NOT NULL AND imageUrl != '' AND mobileImageUrl IS NULL`
  );

  const candidates = blocks;

  console.log(`📊 Found ${candidates.length} CMS blocks with images but no mobile variant\n`);

  if (candidates.length === 0) {
    console.log("✅ Nothing to backfill — all images already have mobile variants.");
    await connection.end();
    return;
  }

  // List them
  for (const b of candidates) {
    console.log(`   [${b.id}] ${b.page}/${b.blockKey} → ${b.imageUrl?.substring(0, 80)}...`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("🔍 Dry run complete. Run with --apply to process images.\n");
    await connection.end();
    return;
  }

  // Process each block
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const block of candidates) {
    const label = `[${block.id}] ${block.page}/${block.blockKey}`;
    try {
      // 1. Download original
      console.log(`⬇️  ${label}: downloading...`);
      const buffer = await downloadImage(block.imageUrl);
      console.log(`   Original size: ${(buffer.length / 1024).toFixed(0)} KB`);

      // 2. Check dimensions
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || metadata.width <= MOBILE_WIDTH) {
        console.log(`   ⏭️  Skipping: width ${metadata.width}px <= ${MOBILE_WIDTH}px`);
        skipped++;
        continue;
      }

      // 3. Resize to mobile WebP
      const mobileBuffer = await sharp(buffer)
        .resize(MOBILE_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      console.log(`   Mobile variant: ${(mobileBuffer.length / 1024).toFixed(0)} KB (${metadata.width}px → ${MOBILE_WIDTH}px)`);

      // 4. Upload
      const suffix = Math.random().toString(36).substring(2, 8);
      const mobileKey = `cms/${block.id}-${suffix}-mobile.webp`;
      const { url: mobileUrl } = await storagePut(mobileKey, mobileBuffer, "image/webp");
      console.log(`   ⬆️  Uploaded: ${mobileUrl}`);

      // 5. Update DB
      await connection.execute(
        `UPDATE cmsBlocks SET mobileImageUrl = ? WHERE id = ?`,
        [mobileUrl, block.id]
      );
      console.log(`   ✅ DB updated\n`);
      success++;

    } catch (err) {
      console.error(`   ❌ ${label}: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n📋 Summary:`);
  console.log(`   ✅ Processed: ${success}`);
  console.log(`   ⏭️  Skipped (small): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${candidates.length}\n`);

  await connection.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
