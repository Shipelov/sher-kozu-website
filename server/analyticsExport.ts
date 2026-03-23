/**
 * Analytics Export — CSV and PDF generation for admin.
 *
 * Generates downloadable reports for:
 * 1. Owner Ratings — leaderboard with scores, titles, animal counts
 * 2. Herd Wellness — per-animal metrics (happiness, health, etc.)
 * 3. Marketplace Sales — top items, categories, buyers
 */

import { getDb } from "./db";

// ─── CSV helpers ─────────────────────────────────────────

function escapeCsvField(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const keys = headers;
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCsvField(row[k])).join(","));
  }
  return "\ufeff" + lines.join("\n"); // BOM for Excel UTF-8
}

// ─── Owner Ratings CSV ──────────────────────────────────

export async function exportOwnerRatingsCsv(): Promise<string> {
  const db = await getDb();
  if (!db) return toCsv(["error"], [{ error: "DB unavailable" }]);

  const { ownerRatings, users, animalOwnerships } = await import("../drizzle/schema");
  const { eq, and, sql, asc } = await import("drizzle-orm");

  const ratings = await db.select().from(ownerRatings).orderBy(asc(ownerRatings.rank));

  const rows = [];
  for (const r of ratings) {
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.openId, r.ownerOpenId));
    const [countResult] = await db
      .select({ count: sql<number>`count(DISTINCT animalId)` })
      .from(animalOwnerships)
      .where(
        and(
          eq(animalOwnerships.ownerOpenId, r.ownerOpenId),
          eq(animalOwnerships.status, "active"),
        ),
      );
    rows.push({
      rank: r.rank,
      owner: user?.name ?? r.ownerOpenId,
      title: r.title,
      totalScore: r.totalScore,
      averageAnimalRating: r.averageAnimalRating,
      activityBonus: r.activityBonus,
      animalCount: countResult?.count ?? 0,
      totalSpentSKC: r.totalSpentSKC,
      totalPurchases: r.totalPurchases,
    });
  }

  return toCsv(
    [
      "rank",
      "owner",
      "title",
      "totalScore",
      "averageAnimalRating",
      "activityBonus",
      "animalCount",
      "totalSpentSKC",
      "totalPurchases",
    ],
    rows,
  );
}

// ─── Herd Wellness CSV ──────────────────────────────────

export async function exportHerdWellnessCsv(): Promise<string> {
  const db = await getDb();
  if (!db) return toCsv(["error"], [{ error: "DB unavailable" }]);

  const { animalWellnessMetrics, animals } = await import("../drizzle/schema");
  const { eq, asc } = await import("drizzle-orm");

  const metrics = await db
    .select()
    .from(animalWellnessMetrics)
    .orderBy(asc(animalWellnessMetrics.herdRank));

  const rows = [];
  for (const m of metrics) {
    const [animal] = await db
      .select({ name: animals.name, species: animals.species })
      .from(animals)
      .where(eq(animals.id, m.animalId));
    rows.push({
      herdRank: m.herdRank,
      animalName: animal?.name ?? `#${m.animalId}`,
      species: animal?.species ?? "unknown",
      happiness: m.happiness,
      health: m.health,
      attachment: m.attachment,
      mood: m.mood,
      obedience: m.obedience,
      overallRating: m.overallRating,
    });
  }

  return toCsv(
    [
      "herdRank",
      "animalName",
      "species",
      "happiness",
      "health",
      "attachment",
      "mood",
      "obedience",
      "overallRating",
    ],
    rows,
  );
}

// ─── Marketplace Sales CSV ──────────────────────────────

export async function exportMarketplaceSalesCsv(): Promise<string> {
  const db = await getDb();
  if (!db) return toCsv(["error"], [{ error: "DB unavailable" }]);

  const { marketplacePurchases, marketplaceItems, animals, users } = await import(
    "../drizzle/schema"
  );
  const { eq, desc } = await import("drizzle-orm");

  const purchases = await db
    .select()
    .from(marketplacePurchases)
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(500);

  const rows = [];
  for (const p of purchases) {
    const [item] = await db
      .select({ name: marketplaceItems.name })
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, p.itemId));
    const [animal] = await db
      .select({ name: animals.name })
      .from(animals)
      .where(eq(animals.id, p.animalId));
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.openId, p.ownerOpenId));
    rows.push({
      date: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "",
      owner: user?.name ?? p.ownerOpenId,
      animal: animal?.name ?? `#${p.animalId}`,
      item: item?.name ?? `#${p.itemId}`,
      priceSKC: p.pricePaidSKC,
    });
  }

  return toCsv(["date", "owner", "animal", "item", "priceSKC"], rows);
}

// ─── PDF Report (HTML-based) ────────────────────────────

export async function generateAnalyticsPdfHtml(): Promise<string> {
  const db = await getDb();
  if (!db) return "<html><body>DB unavailable</body></html>";

  const { ownerRatings, animalWellnessMetrics, animals, users, animalOwnerships } =
    await import("../drizzle/schema");
  const { eq, and, sql, asc } = await import("drizzle-orm");

  // Owner ratings
  const ratings = await db.select().from(ownerRatings).orderBy(asc(ownerRatings.rank));
  const ownerRows = [];
  for (const r of ratings) {
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.openId, r.ownerOpenId));
    const [countResult] = await db
      .select({ count: sql<number>`count(DISTINCT animalId)` })
      .from(animalOwnerships)
      .where(
        and(
          eq(animalOwnerships.ownerOpenId, r.ownerOpenId),
          eq(animalOwnerships.status, "active"),
        ),
      );
    ownerRows.push({
      rank: r.rank,
      name: user?.name ?? r.ownerOpenId,
      title: r.title,
      score: r.totalScore,
      animals: countResult?.count ?? 0,
      spent: r.totalSpentSKC,
    });
  }

  // Herd wellness
  const metrics = await db
    .select()
    .from(animalWellnessMetrics)
    .orderBy(asc(animalWellnessMetrics.herdRank));
  const herdRows = [];
  for (const m of metrics) {
    const [animal] = await db
      .select({ name: animals.name, species: animals.species })
      .from(animals)
      .where(eq(animals.id, m.animalId));
    herdRows.push({
      rank: m.herdRank,
      name: animal?.name ?? `#${m.animalId}`,
      species: animal?.species ?? "",
      happiness: m.happiness,
      health: m.health,
      attachment: m.attachment,
      mood: m.mood,
      obedience: m.obedience,
      overall: m.overallRating,
    });
  }

  const now = new Date().toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Аналитика Шерь Козу — ${now}</title>
  <style>
    @page { margin: 20mm; size: A4; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
    h1 { color: #2d5016; font-size: 18pt; border-bottom: 2px solid #6d8c54; padding-bottom: 6px; margin-bottom: 20px; }
    h2 { color: #3a6b1e; font-size: 14pt; margin-top: 28px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
    th { background: #f0f5eb; color: #2d5016; text-align: left; padding: 8px 10px; border-bottom: 2px solid #6d8c54; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #fafcf8; }
    .meta { color: #666; font-size: 9pt; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>🐐 Аналитика Шерь Козу</h1>
  <p class="meta">Отчёт сформирован: ${now}</p>

  <h2>Рейтинг владельцев</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Владелец</th><th>Титул</th><th>Балл</th><th>Животных</th><th>Потрачено SKC</th></tr>
    </thead>
    <tbody>
      ${ownerRows
        .map(
          (r) => `<tr>
        <td>${r.rank}</td>
        <td>${r.name}</td>
        <td>${r.title}</td>
        <td><span class="badge ${r.score >= 70 ? "badge-green" : r.score >= 40 ? "badge-amber" : "badge-red"}">${r.score}</span></td>
        <td>${r.animals}</td>
        <td>${r.spent}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Метрики стада</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Животное</th><th>Вид</th><th>😊</th><th>💚</th><th>💕</th><th>🌤️</th><th>🎓</th><th>⭐</th></tr>
    </thead>
    <tbody>
      ${herdRows
        .map(
          (h) => `<tr>
        <td>${h.rank}</td>
        <td>${h.name}</td>
        <td>${h.species === "goat" ? "Коза" : h.species === "sheep" ? "Овца" : h.species}</td>
        <td>${h.happiness}</td>
        <td>${h.health}</td>
        <td>${h.attachment}</td>
        <td>${h.mood}</td>
        <td>${h.obedience}</td>
        <td><strong>${h.overall}</strong></td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
}
