#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = path.resolve(repoRoot, process.env.OUTPUT_DIR ?? "rehearsal-output");
const privateDir = path.join(outputDir, "cloudfront-private");
const sourceHost = "d2xsxph8kpxj0f.cloudfront.net";
const expectedOccurrences = Number(process.env.EXPECTED_CLOUDFRONT_OCCURRENCES ?? 29);
const specs = [
  ["animalPhotos", "url"],
  ["animals", "coverImageUrl"],
  ["clubPosts", "imageUrl"],
  ["cmsBlocks", "imageUrl"],
];

const sha256 = value => createHash("sha256").update(value).digest("hex");
const quoteIdentifier = value => `\`${String(value).replaceAll("`", "``")}\``;

function connectionOptions(value) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dateStrings: true,
  };
}

function extensionFor(url, contentType) {
  const fromPath = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(png|jpe?g|webp|gif|svg|avif)$/.test(fromPath)) return fromPath;
  const types = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
  };
  return types[String(contentType).split(";")[0].toLowerCase()] ?? ".bin";
}

async function selfTest() {
  if (specs.length !== 4 || !specs.some(([table]) => table === "cmsBlocks")) {
    throw new Error("Asset source spec is incomplete");
  }
  console.log(JSON.stringify({ selfTest: "ok", sourceHost, specs }));
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const options = connectionOptions(databaseUrl);
  if (options.database !== "test") {
    throw new Error(`Safety stop: expected test database, got ${options.database}`);
  }

  await mkdir(path.join(privateDir, "assets"), { recursive: true, mode: 0o700 });
  const connection = await mysql.createConnection(options);
  const occurrences = [];
  try {
    for (const [tableName, columnName] of specs) {
      const [rows] = await connection.query(
        `SELECT id, ${quoteIdentifier(columnName)} AS assetUrl FROM ${quoteIdentifier(tableName)}
          WHERE ${quoteIdentifier(columnName)} LIKE ? ORDER BY id`,
        [`https://${sourceHost}/%`],
      );
      for (const row of rows) {
        occurrences.push({ tableName, columnName, id: row.id, oldUrl: row.assetUrl });
      }
    }
  } finally {
    await connection.end();
  }
  if (occurrences.length !== expectedOccurrences) {
    throw new Error(
      `Expected ${expectedOccurrences} CloudFront occurrences, got ${occurrences.length}`,
    );
  }

  const manifest = [];
  let totalBytes = 0;
  for (let index = 0; index < occurrences.length; index += 1) {
    const item = occurrences[index];
    const response = await fetch(item.oldUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Asset download failed (${response.status}) for ${item.tableName}#${item.id}`);
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || contentType.includes("text/html")) {
      throw new Error(`Invalid asset body for ${item.tableName}#${item.id}`);
    }
    const fileName = `${String(index + 1).padStart(2, "0")}-${item.tableName}-${item.id}-${sha256(item.oldUrl).slice(0, 12)}${extensionFor(item.oldUrl, contentType)}`;
    await writeFile(path.join(privateDir, "assets", fileName), bytes, { mode: 0o600 });
    totalBytes += bytes.length;
    manifest.push({ ...item, fileName, bytes: bytes.length, sha256: sha256(bytes), contentType });
  }

  const sqlLines = [
    "-- PREPARED ONLY. DO NOT EXECUTE UNTIL OWNER_ASSET_BASE is replaced and assets are uploaded.",
    "START TRANSACTION;",
  ];
  for (const item of manifest) {
    const newUrl = `https://OWNER_ASSET_BASE/${item.fileName}`;
    sqlLines.push(
      `UPDATE ${quoteIdentifier(item.tableName)} SET ${quoteIdentifier(item.columnName)} = ${mysql.escape(newUrl)} WHERE id = ${mysql.escape(item.id)} AND ${quoteIdentifier(item.columnName)} = ${mysql.escape(item.oldUrl)};`,
    );
  }
  sqlLines.push("COMMIT;", "");
  await writeFile(
    path.join(privateDir, "cloudfront-assets-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 },
  );
  await writeFile(
    path.join(privateDir, "cloudfront-url-replacement-plan.sql"),
    sqlLines.join("\n"),
    { mode: 0o600 },
  );
  const summary = {
    createdAt: new Date().toISOString(),
    sourceHost,
    occurrenceCount: manifest.length,
    downloadedFileCount: manifest.length,
    totalBytes,
    failedDownloads: 0,
    replacementStatementsPrepared: manifest.length,
    replacementStatementsExecuted: 0,
  };
  await writeFile(
    path.join(outputDir, "cloudfront-assets-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary));
}

main().catch(error => {
  console.error(`[cloudfront-assets] ${error?.message ?? error}`);
  process.exit(1);
});
