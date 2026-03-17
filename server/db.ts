import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  animalMedia,
  animalOwnerships,
  animalPhotos,
  animals,
  clubAdminPresets,
  clubEvents,
  clubMembers,
  clubPosts,
  families,
  InsertAnimal,
  InsertAnimalMedium,
  InsertAnimalPhoto,
  InsertClubAdminPreset,
  InsertClubEvent,
  InsertClubMember,
  InsertClubPost,
  InsertIntegrationAudit,
  InsertPartnerLead,
  InsertUser,
  InsertPlan,
  InsertPlanDuration,
  integrationAudits,
  partnerLeads,
  planDurations,
  plans,
  productBatches,
  productCompositionSnapshots,
  productDeliveries,
  productMonthlyMetrics,
  users,
  wallets,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;
let _pool: Pool | null = null;
const seededOwners = new Set<string>();

const CLUB_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit_5a4c7c31.jpg";

async function ensureOwnerExperienceSeed(ownerOpenId: string) {
  if (!ownerOpenId || seededOwners.has(ownerOpenId)) return;

  const db = await getDb();
  if (!db) return;

  const existingBatch = await db.select({ id: productBatches.id }).from(productBatches).where(eq(productBatches.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingBatch.length) {
    await db.insert(productBatches).values([
      {
        animalSlug: "marta",
        ownerOpenId,
        productName: "Именной набор Марты",
        productType: "Молоко и свежий сыр",
        stage: "К созреванию и упаковке",
        routeLabel: "Надой → анализ → сыроварня → упаковка",
        detail: "Утренний надой уже прошёл лабораторный контроль и ушёл в сыроварню для свежего семейного набора.",
        badge: "Прозрачный маршрут",
        batchCode: "MRT-2403-A",
        producedAt: new Date("2026-03-12T07:30:00Z"),
        deliveryWindow: "Доставка 15–16 марта",
        sortOrder: 0,
      },
      {
        animalSlug: "marta",
        ownerOpenId,
        productName: "Сырная партия Марты",
        productType: "Полутвёрдый сыр",
        stage: "Созревание",
        routeLabel: "Надой → созревание → маркировка",
        detail: "Партия выдерживается в камере созревания и будет готова к клубному набору следующей недели.",
        badge: "Семейная сыроварня",
        batchCode: "MRT-2403-B",
        producedAt: new Date("2026-03-10T09:10:00Z"),
        deliveryWindow: "Отгрузка 20 марта",
        sortOrder: 1,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        productName: "Набор Златы для завтрака",
        productType: "Йогурт и мягкий сыр",
        stage: "Упаковка",
        routeLabel: "Надой → ферментация → упаковка",
        detail: "Нежный йогурт и мягкий сыр уже фасуются для утренней доставки подписчикам фермы.",
        badge: "Лёгкий формат",
        batchCode: "ZLT-2403-A",
        producedAt: new Date("2026-03-13T06:50:00Z"),
        deliveryWindow: "Доставка 16 марта",
        sortOrder: 0,
      },
    ]);
  }

  const existingCompositions = await db.select({ id: productCompositionSnapshots.id }).from(productCompositionSnapshots).where(eq(productCompositionSnapshots.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingCompositions.length) {
    await db.insert(productCompositionSnapshots).values([
      {
        animalSlug: "marta",
        ownerOpenId,
        title: "Утренний профиль молока",
        fatPercent: "4.8%",
        proteinPercent: "3.6%",
        lactosePercent: "4.3%",
        dryMatterPercent: "12.5%",
        note: "Подходит для свежих сыров и мягких семейных десертов.",
        sortOrder: 0,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        title: "Нежный профиль для йогурта",
        fatPercent: "4.2%",
        proteinPercent: "3.4%",
        lactosePercent: "4.5%",
        dryMatterPercent: "11.9%",
        note: "Даёт мягкую текстуру и хорошую стабильность ферментации.",
        sortOrder: 0,
      },
    ]);
  }

  const existingMetrics = await db.select({ id: productMonthlyMetrics.id }).from(productMonthlyMetrics).where(eq(productMonthlyMetrics.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingMetrics.length) {
    await db.insert(productMonthlyMetrics).values([
      {
        animalSlug: "marta",
        ownerOpenId,
        label: "Январь",
        milkLiters: 81,
        cheeseKg: 12,
        yogurtKg: 9,
        sortOrder: 0,
      },
      {
        animalSlug: "marta",
        ownerOpenId,
        label: "Февраль",
        milkLiters: 88,
        cheeseKg: 14,
        yogurtKg: 10,
        sortOrder: 1,
      },
      {
        animalSlug: "marta",
        ownerOpenId,
        label: "Март",
        milkLiters: 92,
        cheeseKg: 16,
        yogurtKg: 11,
        sortOrder: 2,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        label: "Январь",
        milkLiters: 74,
        cheeseKg: 10,
        yogurtKg: 13,
        sortOrder: 0,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        label: "Февраль",
        milkLiters: 78,
        cheeseKg: 11,
        yogurtKg: 14,
        sortOrder: 1,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        label: "Март",
        milkLiters: 83,
        cheeseKg: 12,
        yogurtKg: 15,
        sortOrder: 2,
      },
    ]);
  }

  const existingDeliveries = await db.select({ id: productDeliveries.id }).from(productDeliveries).where(eq(productDeliveries.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingDeliveries.length) {
    await db.insert(productDeliveries).values([
      {
        animalSlug: "marta",
        ownerOpenId,
        title: "Клубный набор Марты",
        status: "В пути",
        etaLabel: "15 марта, 18:00–20:00",
        destination: "Алматы, Медеуский район",
        routeLabel: "Ферма → сортировка → курьер",
        courierName: "Sher Kozu Delivery",
        trackingCode: "SK-MRT-1503",
        detail: "Курьер забрал заказ, следующий чекпойнт — сортировка и передача в городскую доставку.",
        isActive: 1,
        sortOrder: 0,
      },
      {
        animalSlug: "zlata",
        ownerOpenId,
        title: "Завтрак от Златы",
        status: "Готовится",
        etaLabel: "16 марта, до 11:00",
        destination: "Алматы, Бостандыкский район",
        routeLabel: "Ферма → упаковка → курьер",
        courierName: "Семейная логистика",
        trackingCode: "SK-ZLT-1603",
        detail: "Набор упаковывается и будет передан курьеру завтра утром.",
        isActive: 1,
        sortOrder: 0,
      },
    ]);
  }

  const existingPosts = await db.select({ id: clubPosts.id }).from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPosts.length) {
    await db.insert(clubPosts).values([
      {
        ownerOpenId,
        category: "Дневник фермы",
        author: "Шерь Козу",
        avatar: "ШК",
        role: "семейная ферма",
        timeLabel: "Сегодня, 08:40",
        title: "Утро на молочной кухне",
        text: "У Марты и Златы сегодня особенно мягкое молоко — запускаем малую партию свежего сыра для клубного ужина выходного дня.",
        imageUrl: CLUB_IMAGE,
        likes: 18,
        comments: 6,
        tagsCsv: "сыроварня,утренний надой,семейный ритм",
        pinned: 1,
        sortOrder: 0,
      },
      {
        ownerOpenId,
        category: "Клуб владельцев",
        author: "Алия",
        avatar: "А",
        role: "владелица Марты",
        timeLabel: "Вчера, 19:15",
        title: "Семейный визит на ферму",
        text: "Дети впервые увидели, как проходит вечерний уход. После этого молоко и сыр ощущаются совсем иначе — как часть живой истории.",
        imageUrl: CLUB_IMAGE,
        likes: 24,
        comments: 9,
        tagsCsv: "семья,визит,эмоциональная связь",
        pinned: 0,
        sortOrder: 1,
      },
    ]);
  }

  const existingEvents = await db.select({ id: clubEvents.id }).from(clubEvents).where(eq(clubEvents.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingEvents.length) {
    await db.insert(clubEvents).values([
      {
        ownerOpenId,
        title: "Закрытый ужин владельцев",
        dateLabel: "22 марта · 18:30",
        description: "Дегустация сыров весенней партии и обсуждение новых семейных наборов.",
        status: "Открыта запись",
        tone: "warm",
        sortOrder: 0,
      },
      {
        ownerOpenId,
        title: "Утро на ферме с детьми",
        dateLabel: "29 марта · 10:00",
        description: "Небольшая семейная встреча: кормление животных, экскурсия и свежий завтрак на террасе.",
        status: "Мест осталось мало",
        tone: "soft",
        sortOrder: 1,
      },
    ]);
  }

  const existingMembers = await db.select({ id: clubMembers.id }).from(clubMembers).where(eq(clubMembers.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingMembers.length) {
    await db.insert(clubMembers).values([
      {
        ownerOpenId,
        name: "Алия и семья",
        animal: "Марта",
        sinceLabel: "с ноября 2025",
        badge: "семейный круг",
        sortOrder: 0,
      },
      {
        ownerOpenId,
        name: "Тимур",
        animal: "Злата",
        sinceLabel: "с января 2026",
        badge: "городской гастроном",
        sortOrder: 1,
      },
    ]);
  }

  const existingPresets = await db.select({ id: clubAdminPresets.id }).from(clubAdminPresets).where(eq(clubAdminPresets.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPresets.length) {
    await db.insert(clubAdminPresets).values([
      {
        ownerOpenId,
        tab: "posts",
        name: "Тёплый анонс дневника",
        configJson: JSON.stringify({ category: "Дневник фермы", role: "семейная ферма" }),
        sortOrder: 0,
      },
      {
        ownerOpenId,
        tab: "events",
        name: "Семейная встреча",
        configJson: JSON.stringify({ tone: "warm", status: "Открыта запись" }),
        sortOrder: 1,
      },
      {
        ownerOpenId,
        tab: "members",
        name: "Новый владелец",
        configJson: JSON.stringify({ badge: "новый круг" }),
        sortOrder: 2,
      },
    ]);
  }

  seededOwners.add(ownerOpenId);
}

export async function getDb() {
  if (_db) return _db;

  if (!ENV.databaseUrl) {
    return null;
  }

  try {
    _pool = createPool({
      uri: ENV.databaseUrl,
      connectionLimit: 10,
      namedPlaceholders: true,
      enableKeepAlive: true,
      timezone: "Z",
      ssl: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: false,
      },
    });
    _db = drizzle(_pool);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    _db = null;
    _pool = null;
    return null;
  }
}

export async function upsertUser(user: InsertUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for user upsert");
  }
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  try {
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existing.length) {
      const updatePayload: Partial<InsertUser> = {};

      if (Object.prototype.hasOwnProperty.call(user, "name")) {
        updatePayload.name = user.name ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(user, "email")) {
        updatePayload.email = user.email ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(user, "role")) {
        updatePayload.role = user.role;
      }
      if (Object.prototype.hasOwnProperty.call(user, "loginMethod")) {
        updatePayload.loginMethod = user.loginMethod ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(user, "lastSignedIn") && user.lastSignedIn) {
        updatePayload.lastSignedIn = user.lastSignedIn;
      }

      if (Object.keys(updatePayload).length) {
        await db.update(users).set(updatePayload).where(eq(users.openId, user.openId));
      }
    } else {
      await db.insert(users).values(user);
    }
    const records = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    return records[0] ?? null;
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}


export async function ensureUserRecord(user: InsertUser) {
  const saved = await upsertUser(user);
  if (saved) {
    await ensureOwnerExperienceSeed(saved.openId);
  }
  return saved;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;

  const records = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = records[0] ?? null;
  if (user) {
    await ensureOwnerExperienceSeed(user.openId);
  }
  return user;
}

export async function listAnimalPhotos(animalSlug: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    const items = await db
      .select()
      .from(animalPhotos)
      .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    return items;
  } catch (error) {
    console.error("[Database] Failed to list animal photos:", error);
    throw error;
  }
}

export async function createAnimalPhoto(input: InsertAnimalPhoto) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo creation");
  }

  const existing = await db
    .select({ sortOrder: animalPhotos.sortOrder })
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, input.animalSlug), eq(animalPhotos.ownerOpenId, input.ownerOpenId)))
    .orderBy(desc(animalPhotos.sortOrder))
    .limit(1);

  const nextSortOrder = existing[0]?.sortOrder != null ? Number(existing[0].sortOrder) + 1 : 0;

  await db.insert(animalPhotos).values({
    ...input,
    sortOrder: input.sortOrder ?? nextSortOrder,
  });

  const created = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.ownerOpenId, input.ownerOpenId), eq(animalPhotos.fileKey, input.fileKey)))
    .orderBy(desc(animalPhotos.id))
    .limit(1);

  if (!created[0]) {
    throw new Error("Failed to resolve inserted photo id after upload");
  }

  return created[0];
}

export async function deleteAnimalPhoto(photoId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo deletion");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, photoId), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  const isCover = Boolean(existing[0].isCover);

  await db.delete(animalPhotos).where(eq(animalPhotos.id, photoId));

  if (isCover) {
    const fallback = await db
      .select()
      .from(animalPhotos)
      .where(and(eq(animalPhotos.animalSlug, existing[0].animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    if (fallback[0]) {
      await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, fallback[0].id));
    }
  }

  return existing[0];
}

export async function setAnimalPhotoCover(photoId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for setting photo cover");
  }

  const target = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, photoId), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .limit(1);

  if (!target[0]) {
    return null;
  }

  await db.update(animalPhotos).set({ isCover: 0 }).where(and(eq(animalPhotos.animalSlug, target[0].animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)));

  await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, photoId));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, photoId)).limit(1);
  return updated[0] ?? null;
}

export async function updateAnimalPhotoMeta(input: { photoId: number; ownerOpenId: string; title: string; alt: string | null }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating photo metadata");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, input.photoId), eq(animalPhotos.ownerOpenId, input.ownerOpenId)))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  await db
    .update(animalPhotos)
    .set({
      title: input.title,
      meta: input.alt?.trim() || input.title,
    })
    .where(and(eq(animalPhotos.id, input.photoId), eq(animalPhotos.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, input.photoId)).limit(1);
  return updated[0] ?? null;
}

export async function reorderAnimalPhotos(photoIds: number[], ownerOpenId: string, animalSlug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for reordering photos");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

  if (!existing.length) {
    return [];
  }

  const existingIds = new Set(existing.map((item: any) => item.id));
  if (photoIds.some((id) => !existingIds.has(id))) {
    throw new Error("Photo order payload contains unknown gallery items");
  }

  const orderedIds = [...photoIds];
  const missingIds = existing.map((item: any) => item.id).filter((id: number) => !orderedIds.includes(id));
  orderedIds.push(...missingIds);

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    await db.update(animalPhotos).set({ sortOrder: index }).where(eq(animalPhotos.id, id));
  }

  const updated = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

  return updated;
}

export async function getProductTrackerData(ownerOpenId: string, animalSlug: string) {
  const db = await getDb();
  if (!db) {
    return {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [],
      deliveries: [],
    };
  }

  const [productBatchesRows, compositionSnapshotsRows, monthlyMetricsRows, deliveriesRows] = await Promise.all([
    db
      .select()
      .from(productBatches)
      .where(and(eq(productBatches.ownerOpenId, ownerOpenId), eq(productBatches.animalSlug, animalSlug)))
      .orderBy(asc(productBatches.sortOrder), desc(productBatches.producedAt)),
    db
      .select()
      .from(productCompositionSnapshots)
      .where(and(eq(productCompositionSnapshots.ownerOpenId, ownerOpenId), eq(productCompositionSnapshots.animalSlug, animalSlug)))
      .orderBy(asc(productCompositionSnapshots.sortOrder)),
    db
      .select()
      .from(productMonthlyMetrics)
      .where(and(eq(productMonthlyMetrics.ownerOpenId, ownerOpenId), eq(productMonthlyMetrics.animalSlug, animalSlug)))
      .orderBy(asc(productMonthlyMetrics.sortOrder)),
    db
      .select()
      .from(productDeliveries)
      .where(and(eq(productDeliveries.ownerOpenId, ownerOpenId), eq(productDeliveries.animalSlug, animalSlug)))
      .orderBy(desc(productDeliveries.isActive), asc(productDeliveries.sortOrder)),
  ]);

  return {
    productBatches: productBatchesRows,
    compositionSnapshots: compositionSnapshotsRows,
    monthlyMetrics: monthlyMetricsRows,
    deliveries: deliveriesRows,
  };
}

export async function getClubFeedData(ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    return {
      posts: [],
      events: [],
      members: [],
      presets: [],
    };
  }

  const [posts, events, members, presets] = await Promise.all([
    db.select().from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)).orderBy(asc(clubPosts.sortOrder), desc(clubPosts.createdAt)),
    db.select().from(clubEvents).where(eq(clubEvents.ownerOpenId, ownerOpenId)).orderBy(asc(clubEvents.sortOrder), desc(clubEvents.createdAt)),
    db.select().from(clubMembers).where(eq(clubMembers.ownerOpenId, ownerOpenId)).orderBy(asc(clubMembers.sortOrder), desc(clubMembers.createdAt)),
    db.select().from(clubAdminPresets).where(eq(clubAdminPresets.ownerOpenId, ownerOpenId)).orderBy(asc(clubAdminPresets.sortOrder), asc(clubAdminPresets.id)),
  ]);

  return {
    posts,
    events,
    members,
    presets,
  };
}

export async function listClubAdminData(ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    return {
      posts: [],
      events: [],
      members: [],
      presets: [],
      summary: {
        totalPosts: 0,
        pinnedPosts: 0,
        totalEvents: 0,
        openEvents: 0,
        totalMembers: 0,
      },
    };
  }

  const [posts, events, members, presets] = await Promise.all([
    db.select().from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)).orderBy(asc(clubPosts.sortOrder), desc(clubPosts.createdAt)),
    db.select().from(clubEvents).where(eq(clubEvents.ownerOpenId, ownerOpenId)).orderBy(asc(clubEvents.sortOrder), desc(clubEvents.createdAt)),
    db.select().from(clubMembers).where(eq(clubMembers.ownerOpenId, ownerOpenId)).orderBy(asc(clubMembers.sortOrder), desc(clubMembers.createdAt)),
    db.select().from(clubAdminPresets).where(eq(clubAdminPresets.ownerOpenId, ownerOpenId)).orderBy(asc(clubAdminPresets.sortOrder), asc(clubAdminPresets.id)),
  ]);

  return {
    posts,
    events,
    members,
    presets,
    summary: {
      totalPosts: posts.length,
      pinnedPosts: posts.filter((post: any) => Boolean(post.pinned)).length,
      totalEvents: events.length,
      openEvents: events.filter((event: any) => ["Открыта запись", "Мест осталось мало"].includes(event.status)).length,
      totalMembers: members.length,
    },
  };
}

export async function createClubAdminPreset(input: InsertClubAdminPreset) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating club admin preset");
  }

  await db.insert(clubAdminPresets).values(input);
  const created = await db.select().from(clubAdminPresets).where(and(eq(clubAdminPresets.ownerOpenId, input.ownerOpenId), eq(clubAdminPresets.name, input.name))).orderBy(desc(clubAdminPresets.id)).limit(1);
  return created[0] ?? null;
}

export async function updateClubAdminPreset(input: InsertClubAdminPreset & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club admin preset");
  }

  await db.update(clubAdminPresets).set({
    tab: input.tab,
    name: input.name,
    configJson: input.configJson,
    sortOrder: input.sortOrder,
  }).where(and(eq(clubAdminPresets.id, input.id), eq(clubAdminPresets.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(clubAdminPresets).where(eq(clubAdminPresets.id, input.id)).limit(1);
  return updated[0] ?? null;
}

export async function deleteClubAdminPreset(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for deleting club admin preset");
  }

  const existing = await db.select().from(clubAdminPresets).where(and(eq(clubAdminPresets.id, id), eq(clubAdminPresets.ownerOpenId, ownerOpenId))).limit(1);
  if (!existing[0]) return null;

  await db.delete(clubAdminPresets).where(and(eq(clubAdminPresets.id, id), eq(clubAdminPresets.ownerOpenId, ownerOpenId)));
  return existing[0];
}

export async function createClubPost(input: InsertClubPost) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating club post");
  }

  await db.insert(clubPosts).values(input);
  const created = await db.select().from(clubPosts).where(and(eq(clubPosts.ownerOpenId, input.ownerOpenId), eq(clubPosts.title, input.title))).orderBy(desc(clubPosts.id)).limit(1);
  return created[0] ?? null;
}

export async function updateClubPost(input: InsertClubPost & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club post");
  }

  await db.update(clubPosts).set({
    category: input.category,
    author: input.author,
    avatar: input.avatar,
    role: input.role,
    timeLabel: input.timeLabel,
    title: input.title,
    text: input.text,
    imageUrl: input.imageUrl,
    likes: input.likes,
    comments: input.comments,
    tagsCsv: input.tagsCsv,
    pinned: input.pinned,
    sortOrder: input.sortOrder,
  }).where(and(eq(clubPosts.id, input.id), eq(clubPosts.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(clubPosts).where(eq(clubPosts.id, input.id)).limit(1);
  return updated[0] ?? null;
}

export async function deleteClubPost(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for deleting club post");
  }

  const existing = await db.select().from(clubPosts).where(and(eq(clubPosts.id, id), eq(clubPosts.ownerOpenId, ownerOpenId))).limit(1);
  if (!existing[0]) return null;
  await db.delete(clubPosts).where(and(eq(clubPosts.id, id), eq(clubPosts.ownerOpenId, ownerOpenId)));
  return existing[0];
}

export async function createClubEvent(input: InsertClubEvent) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating club event");
  }

  await db.insert(clubEvents).values(input);
  const created = await db.select().from(clubEvents).where(and(eq(clubEvents.ownerOpenId, input.ownerOpenId), eq(clubEvents.title, input.title))).orderBy(desc(clubEvents.id)).limit(1);
  return created[0] ?? null;
}

export async function updateClubEvent(input: InsertClubEvent & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club event");
  }

  await db.update(clubEvents).set({
    title: input.title,
    dateLabel: input.dateLabel,
    description: input.description,
    status: input.status,
    tone: input.tone,
    sortOrder: input.sortOrder,
  }).where(and(eq(clubEvents.id, input.id), eq(clubEvents.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(clubEvents).where(eq(clubEvents.id, input.id)).limit(1);
  return updated[0] ?? null;
}

export async function deleteClubEvent(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for deleting club event");
  }

  const existing = await db.select().from(clubEvents).where(and(eq(clubEvents.id, id), eq(clubEvents.ownerOpenId, ownerOpenId))).limit(1);
  if (!existing[0]) return null;
  await db.delete(clubEvents).where(and(eq(clubEvents.id, id), eq(clubEvents.ownerOpenId, ownerOpenId)));
  return existing[0];
}

export async function createClubMember(input: InsertClubMember) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating club member");
  }

  await db.insert(clubMembers).values(input);
  const created = await db.select().from(clubMembers).where(and(eq(clubMembers.ownerOpenId, input.ownerOpenId), eq(clubMembers.name, input.name))).orderBy(desc(clubMembers.id)).limit(1);
  return created[0] ?? null;
}

export async function updateClubMember(input: InsertClubMember & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club member");
  }

  await db.update(clubMembers).set({
    name: input.name,
    animal: input.animal,
    sinceLabel: input.sinceLabel,
    badge: input.badge,
    sortOrder: input.sortOrder,
  }).where(and(eq(clubMembers.id, input.id), eq(clubMembers.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(clubMembers).where(eq(clubMembers.id, input.id)).limit(1);
  return updated[0] ?? null;
}

export async function deleteClubMember(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for deleting club member");
  }

  const existing = await db.select().from(clubMembers).where(and(eq(clubMembers.id, id), eq(clubMembers.ownerOpenId, ownerOpenId))).limit(1);
  if (!existing[0]) return null;
  await db.delete(clubMembers).where(and(eq(clubMembers.id, id), eq(clubMembers.ownerOpenId, ownerOpenId)));
  return existing[0];
}

export async function createPartnerLead(input: InsertPartnerLead) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating partner lead");
  }

  await db.insert(partnerLeads).values(input);
  const created = await db.select().from(partnerLeads).where(and(eq(partnerLeads.ownerOpenId, input.ownerOpenId), eq(partnerLeads.email, input.email))).orderBy(desc(partnerLeads.id)).limit(1);
  return created[0] ?? null;
}

export async function getPartnerLeadById(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for reading partner lead");
  }

  const records = await db
    .select()
    .from(partnerLeads)
    .where(and(eq(partnerLeads.id, id), eq(partnerLeads.ownerOpenId, ownerOpenId)))
    .limit(1);

  return records[0] ?? null;
}

export async function updatePartnerLeadSyncResult(input: {
  id: number;
  ownerOpenId: string;
  syncStatus: "pending" | "success" | "failed" | "retried";
  lastSyncError: string | null;
  bitrixContactId: string | null;
  bitrixCompanyId: string | null;
  bitrixDealId: string | null;
  bitrixLeadId: string | null;
  bitrixStageId: string | null;
  assignedManagerId: string | null;
  assignedManagerName: string | null;
  nextActivityAt: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating partner lead sync result");
  }

  const current = await getPartnerLeadById(input.id, input.ownerOpenId);
  if (!current) return null;

  await db.update(partnerLeads).set({
    syncStatus: input.syncStatus,
    syncAttemptCount: Number(current.syncAttemptCount ?? 0) + 1,
    lastSyncAt: new Date(),
    lastSyncError: input.lastSyncError,
    bitrixContactId: input.bitrixContactId,
    bitrixCompanyId: input.bitrixCompanyId,
    bitrixDealId: input.bitrixDealId,
    bitrixLeadId: input.bitrixLeadId,
    bitrixStageId: input.bitrixStageId,
    assignedManagerId: input.assignedManagerId,
    assignedManagerName: input.assignedManagerName,
    nextActivityAt: input.nextActivityAt,
  }).where(and(eq(partnerLeads.id, input.id), eq(partnerLeads.ownerOpenId, input.ownerOpenId)));

  return getPartnerLeadById(input.id, input.ownerOpenId);
}

export async function createIntegrationAudit(input: InsertIntegrationAudit) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating integration audit");
  }

  await db.insert(integrationAudits).values(input);
  const created = await db.select().from(integrationAudits).where(and(eq(integrationAudits.ownerOpenId, input.ownerOpenId), eq(integrationAudits.entityType, input.entityType), eq(integrationAudits.entityId, input.entityId))).orderBy(desc(integrationAudits.id)).limit(1);
  return created[0] ?? null;
}

export async function updateIntegrationAuditResult(input: {
  id: number;
  ownerOpenId: string;
  status: "pending" | "success" | "failed";
  responsePayload: string | null;
  errorMessage: string | null;
  externalId: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating integration audit");
  }

  await db.update(integrationAudits).set({
    status: input.status,
    responsePayload: input.responsePayload,
    errorMessage: input.errorMessage,
    externalId: input.externalId,
  }).where(and(eq(integrationAudits.id, input.id), eq(integrationAudits.ownerOpenId, input.ownerOpenId)));

  const updated = await db.select().from(integrationAudits).where(eq(integrationAudits.id, input.id)).limit(1);
  return updated[0] ?? null;
}

export async function getIntegrationAuditById(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for reading integration audit");
  }

  const records = await db
    .select()
    .from(integrationAudits)
    .where(and(eq(integrationAudits.id, id), eq(integrationAudits.ownerOpenId, ownerOpenId)))
    .limit(1);

  return records[0] ?? null;
}

export async function listBitrixAdminData(
  ownerOpenId: string,
  input?: {
    page?: number;
    pageSize?: number;
    query?: string;
    syncStatus?: "all" | "pending" | "success" | "failed" | "retried";
    onlyFailed?: boolean;
    source?: "all" | "website" | "club" | "referral" | "manual";
  },
) {
  const db = await getDb();
  const page = Math.max(1, Number(input?.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(input?.pageSize ?? 10)));
  const query = (input?.query ?? "").trim();
  const syncStatus = input?.syncStatus ?? "all";
  const onlyFailed = Boolean(input?.onlyFailed);
  const source = input?.source ?? "all";

  if (!db) {
    return {
      leads: [],
      audits: [],
      summary: {
        totalLeads: 0,
        pendingLeads: 0,
        successfulLeads: 0,
        failedLeads: 0,
        retriedLeads: 0,
        totalAudits: 0,
        failedAudits: 0,
      },
      pagination: {
        page,
        pageSize,
        totalFilteredLeads: 0,
        pageCount: 0,
      },
      retryMonitoring: {
        retryLeadCount: 0,
        failedWithoutRetryCount: 0,
        repeatedAttemptLeadCount: 0,
        latestFailedLeadId: null,
      },
    };
  }

  const filters = [eq(partnerLeads.ownerOpenId, ownerOpenId)];

  if (syncStatus !== "all") {
    filters.push(eq(partnerLeads.syncStatus, syncStatus));
  }

  if (onlyFailed) {
    filters.push(eq(partnerLeads.syncStatus, "failed"));
  }

  if (source !== "all") {
    filters.push(eq(partnerLeads.source, source));
  }

  if (query) {
    const queryPattern = `%${query}%`;
    filters.push(
      or(
        like(partnerLeads.fullName, queryPattern),
        like(partnerLeads.companyName, queryPattern),
        like(partnerLeads.email, queryPattern),
        like(partnerLeads.phone, queryPattern),
        like(partnerLeads.telegram, queryPattern),
      )!,
    );
  }

  const whereClause = and(...filters);

  const [allLeads, filteredLeads, audits] = await Promise.all([
    db.select().from(partnerLeads).where(eq(partnerLeads.ownerOpenId, ownerOpenId)).orderBy(desc(partnerLeads.createdAt), desc(partnerLeads.id)),
    db.select().from(partnerLeads).where(whereClause).orderBy(desc(partnerLeads.createdAt), desc(partnerLeads.id)),
    db.select().from(integrationAudits).where(eq(integrationAudits.ownerOpenId, ownerOpenId)).orderBy(desc(integrationAudits.createdAt), desc(integrationAudits.id)).limit(100),
  ]);

  const totalFilteredLeads = filteredLeads.length;
  const pageCount = totalFilteredLeads === 0 ? 0 : Math.ceil(totalFilteredLeads / pageSize);
  const safePage = pageCount === 0 ? 1 : Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const leads = filteredLeads.slice(startIndex, startIndex + pageSize);

  const summary = {
    totalLeads: allLeads.length,
    pendingLeads: allLeads.filter((lead: any) => lead.syncStatus === "pending").length,
    successfulLeads: allLeads.filter((lead: any) => lead.syncStatus === "success").length,
    failedLeads: allLeads.filter((lead: any) => lead.syncStatus === "failed").length,
    retriedLeads: allLeads.filter((lead: any) => lead.syncStatus === "retried").length,
    totalAudits: audits.length,
    failedAudits: audits.filter((audit: any) => audit.status === "failed").length,
  };

  const retryMonitoring = {
    retryLeadCount: allLeads.filter((lead: any) => lead.syncStatus === "retried").length,
    failedWithoutRetryCount: allLeads.filter((lead: any) => lead.syncStatus === "failed" && Number(lead.syncAttemptCount ?? 0) <= 1).length,
    repeatedAttemptLeadCount: allLeads.filter((lead: any) => Number(lead.syncAttemptCount ?? 0) > 1).length,
    latestFailedLeadId: allLeads.find((lead: any) => lead.syncStatus === "failed")?.id ?? null,
  };

  return {
    leads,
    audits,
    summary,
    pagination: {
      page: safePage,
      pageSize,
      totalFilteredLeads,
      pageCount,
    },
    retryMonitoring,
  };
}

function isOccupiedOwnershipStatus(status: string) {
  return status === "active" || status === "pending_payment";
}

function normalizeOwnershipSlots(totalOwnershipSlots: number | null | undefined) {
  return Math.max(1, totalOwnershipSlots ?? 10);
}

function getPercentPerSlot(totalOwnershipSlots: number | null | undefined) {
  return 100 / normalizeOwnershipSlots(totalOwnershipSlots);
}

function getOwnedPercentFromCount(activeOwnerships: number, totalOwnershipSlots: number | null | undefined) {
  return Math.min(100, Math.round(activeOwnerships * getPercentPerSlot(totalOwnershipSlots)));
}

function getSharePriceMinor(basePriceMinor: number, sharePercent: number) {
  return Math.round((Math.max(0, basePriceMinor) * sharePercent) / 100);
}

function normalizeSharePercentValue(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 10) * 10));
}

function getStandardizedOwnershipSlots() {
  return 10;
}

function getAvailableSharePercents(availablePercent: number, shareUnitPercent: number) {
  const values: number[] = [];
  const safeAvailablePercent = normalizeSharePercentValue(availablePercent);

  for (let sharePercent = shareUnitPercent; sharePercent <= safeAvailablePercent; sharePercent += shareUnitPercent) {
    values.push(sharePercent);
  }

  return values;
}

function buildAnimalShareMetrics(animal: { totalOwnershipSlots: number; baseMonthlyPriceMinor: number }, activeOwnerships: number) {
  const totalSlots = getStandardizedOwnershipSlots();
  const normalizedActiveOwnerships = Math.max(0, Math.min(totalSlots, Math.round(activeOwnerships)));
  const availableSlots = Math.max(0, totalSlots - normalizedActiveOwnerships);
  const ownedPercent = normalizeSharePercentValue(getOwnedPercentFromCount(normalizedActiveOwnerships, totalSlots));
  const availablePercent = normalizeSharePercentValue(100 - ownedPercent);
  const shareUnitPercent = 10;
  const shareUnitPriceMinor = getSharePriceMinor(animal.baseMonthlyPriceMinor, shareUnitPercent);
  const availableSharePercents = getAvailableSharePercents(availablePercent, shareUnitPercent);
  const primarySharePercent = availableSharePercents[0] ?? shareUnitPercent;

  return {
    totalSlots,
    totalOwnershipSlots: totalSlots,
    activeOwnerships: normalizedActiveOwnerships,
    availableSlots,
    ownedPercent,
    availablePercent,
    shareUnitPercent,
    shareUnitPriceMinor,
    fullPriceMinor: animal.baseMonthlyPriceMinor,
    currencyCode: "RUB",
    primarySharePercent,
    primarySharePriceMinor: getSharePriceMinor(animal.baseMonthlyPriceMinor, primarySharePercent),
    availableSharePercents,
  };
}

export async function countActiveOwnerships(animalId: number) {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(animalOwnerships)
    .where(and(eq(animalOwnerships.animalId, animalId), or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment"))));
  return Number(rows[0]?.count ?? 0);
}

export async function getAnimalOccupiedUntil(animalId: number) {
  const db = await getDb();
  const rows = await db
    .select({ endsAt: animalOwnerships.endsAt })
    .from(animalOwnerships)
    .where(and(eq(animalOwnerships.animalId, animalId), or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment"))))
    .orderBy(desc(animalOwnerships.endsAt))
    .limit(1);

  return rows[0]?.endsAt ?? null;
}

export async function getAvailableSlotIndex(animalId: number) {
  const db = await getDb();
  const animalRows = await db.select({ totalOwnershipSlots: animals.totalOwnershipSlots }).from(animals).where(eq(animals.id, animalId)).limit(1);
  const totalSlots = normalizeOwnershipSlots(animalRows[0]?.totalOwnershipSlots ?? 10);
  const slotRows = await db
    .select({ slotIndex: animalOwnerships.slotIndex, status: animalOwnerships.status })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.animalId, animalId))
    .orderBy(asc(animalOwnerships.slotIndex));

  const used = new Set(
    slotRows
      .filter((row: { slotIndex: number; status: string }) => isOccupiedOwnershipStatus(row.status))
      .map((row: { slotIndex: number }) => row.slotIndex)
  );

  for (let index = 1; index <= totalSlots; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }

  return null;
}

export async function recalculateAnimalStatus(animalId: number) {
  const db = await getDb();
  const animalRows = await db
    .select({
      id: animals.id,
      status: animals.status,
      totalOwnershipSlots: animals.totalOwnershipSlots,
      publishedAt: animals.publishedAt,
    })
    .from(animals)
    .where(eq(animals.id, animalId))
    .limit(1);

  const animal = animalRows[0];
  if (!animal) {
    return null;
  }

  if (animal.status === "hidden" || animal.status === "archived") {
    return animal.status;
  }

  const activeCount = await countActiveOwnerships(animalId);
  const totalSlots = normalizeOwnershipSlots(animal.totalOwnershipSlots);
  let nextStatus: "public_available" | "public_limited" | "fully_booked" = "public_available";

  if (activeCount >= totalSlots) {
    nextStatus = "fully_booked";
  } else if (activeCount >= Math.max(1, totalSlots - 1)) {
    nextStatus = "public_limited";
  }

  await db.update(animals).set({ status: nextStatus }).where(eq(animals.id, animalId));
  return nextStatus;
}

async function enrichAnimalWithShareMetrics(db: any, animal: any) {
  const activeOwnerships = await countActiveOwnerships(animal.id);
  const media = await db
    .select()
    .from(animalMedia)
    .where(eq(animalMedia.animalId, animal.id))
    .orderBy(desc(animalMedia.isCover), asc(animalMedia.sortOrder), asc(animalMedia.id));
  const occupiedUntil = await getAnimalOccupiedUntil(animal.id);
  const shareMetrics = buildAnimalShareMetrics(animal, activeOwnerships);

  return {
    ...animal,
    ...shareMetrics,
    occupiedUntil,
    coverImageUrl: media.find((item: any) => item.isCover)?.url ?? animal.coverImageUrl,
    media,
  };
}

export async function listPublicAnimals() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(animals)
    .where(or(eq(animals.status, "public_available"), eq(animals.status, "public_limited"), eq(animals.status, "fully_booked")))
    .orderBy(desc(animals.isFeatured), asc(animals.sortOrder), asc(animals.name));

  return Promise.all(rows.map((animal: any) => enrichAnimalWithShareMetrics(db, animal)));
}

export async function getAnimalBySlug(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(animals).where(eq(animals.slug, slug)).limit(1);
  const animal = rows[0];

  if (!animal) {
    return null;
  }

  const linkedPlans = await db.select().from(plans).where(eq(plans.status, "active")).orderBy(asc(plans.id));
  const durations = linkedPlans.length
    ? await db.select().from(planDurations).where(eq(planDurations.isActive, 1)).orderBy(asc(planDurations.sortOrder), asc(planDurations.months))
    : [];
  const enriched = await enrichAnimalWithShareMetrics(db, animal);

  return {
    ...enriched,
    plans: linkedPlans.map((plan: any) => ({
      ...plan,
      durations: durations.filter((duration: any) => duration.planId === plan.id),
    })),
  };
}

export async function purchaseAnimalShare(args: {
  ownerOpenId: string;
  animalId: number;
  sharePercent: number;
  familyId?: number | null;
  planId: number;
  planDurationId: number;
  startsAt?: Date;
  endsAt?: Date;
  notes?: string | null;
}) {
  const db = await getDb();
  const animalRows = await db
    .select({
      id: animals.id,
      ownerOpenId: animals.ownerOpenId,
      slug: animals.slug,
      baseMonthlyPriceMinor: animals.baseMonthlyPriceMinor,
      totalOwnershipSlots: animals.totalOwnershipSlots,
      status: animals.status,
    })
    .from(animals)
    .where(eq(animals.id, args.animalId))
    .limit(1);

  const animal = animalRows[0];
  if (!animal) {
    throw new Error("ANIMAL_NOT_FOUND");
  }

  const totalSlots = normalizeOwnershipSlots(animal.totalOwnershipSlots);
  const shareUnitPercent = Math.round(getPercentPerSlot(totalSlots));
  const sharePercent = args.sharePercent;

  if (!Number.isInteger(sharePercent) || sharePercent < shareUnitPercent || sharePercent > 100 || sharePercent % shareUnitPercent !== 0) {
    throw new Error("INVALID_SHARE_PERCENT");
  }

  const requestedSlots = sharePercent / shareUnitPercent;
  const occupiedRows = await db
    .select({ slotIndex: animalOwnerships.slotIndex, status: animalOwnerships.status })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.animalId, args.animalId))
    .orderBy(asc(animalOwnerships.slotIndex));

  const occupiedSlotIndexes = new Set(
    occupiedRows
      .filter((row: { slotIndex: number; status: string }) => isOccupiedOwnershipStatus(row.status))
      .map((row: { slotIndex: number }) => row.slotIndex)
  );

  const freeSlotIndexes: number[] = [];
  for (let slotIndex = 1; slotIndex <= totalSlots; slotIndex += 1) {
    if (!occupiedSlotIndexes.has(slotIndex)) {
      freeSlotIndexes.push(slotIndex);
    }
    if (freeSlotIndexes.length === requestedSlots) {
      break;
    }
  }

  if (freeSlotIndexes.length < requestedSlots) {
    throw new Error("INSUFFICIENT_SHARE_AVAILABLE");
  }

  const startsAt = args.startsAt ?? new Date();
  const endsAt = args.endsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const priceMinor = getSharePriceMinor(animal.baseMonthlyPriceMinor, sharePercent);
  const pricePerSlotMinor = Math.round(priceMinor / requestedSlots);

  await db.insert(animalOwnerships).values(
    freeSlotIndexes.map((slotIndex) => ({
      ownerOpenId: args.ownerOpenId,
      animalId: args.animalId,
      familyId: args.familyId ?? 1,
      planId: args.planId,
      planDurationId: args.planDurationId,
      slotIndex,
      status: "pending_payment",
      startsAt,
      endsAt,
      priceMinor: pricePerSlotMinor,
      notes: args.notes ?? `Доля ${sharePercent}%`,
    }))
  );

  const status = await recalculateAnimalStatus(args.animalId);
  const refreshedAnimal = await getAnimalBySlug(animal.slug);

  return {
    success: true,
    animalId: args.animalId,
    sharePercent,
    requestedSlots,
    priceMinor,
    pricePerSlotMinor,
    slotIndexes: freeSlotIndexes,
    status,
    animal: refreshedAnimal,
    createdRows: freeSlotIndexes.map((slotIndex) => ({ slotIndex })),
  };
}

export async function listActivePlans() {
  const db = await getDb();
  const activePlans = await db.select().from(plans).where(eq(plans.status, "active")).orderBy(asc(plans.id));
  const durations = await db
    .select()
    .from(planDurations)
    .where(eq(planDurations.isActive, 1))
    .orderBy(asc(planDurations.planId), asc(planDurations.sortOrder), asc(planDurations.months));

  return activePlans.map((plan: any) => ({
    ...plan,
    durations: durations.filter((duration: any) => duration.planId === plan.id),
  }));
}

export async function listAdminAnimals(ownerOpenId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(animals)
    .where(eq(animals.ownerOpenId, ownerOpenId))
    .orderBy(desc(animals.createdAt), asc(animals.sortOrder), asc(animals.name));

  return Promise.all(rows.map((animal: any) => enrichAnimalWithShareMetrics(db, animal)));
}

type UpsertAnimalPayload = Omit<InsertAnimal, "id" | "createdAt" | "updatedAt"> & {
  media?: Array<Omit<InsertAnimalMedium, "id" | "createdAt" | "updatedAt">>;
};

export async function createAnimalWithMedia(input: UpsertAnimalPayload) {
  const db = await getDb();
  const { media = [], ...animalInput } = input;

  const insertResult = await db.insert(animals).values(animalInput as InsertAnimal);

  let animalId = Number((insertResult as { insertId?: number | string }).insertId);

  if (!Number.isFinite(animalId) || animalId <= 0) {
    const createdRows = await db
      .select({ id: animals.id })
      .from(animals)
      .where(and(eq(animals.slug, String(animalInput.slug)), eq(animals.ownerOpenId, String(animalInput.ownerOpenId))))
      .limit(1);

    animalId = Number(createdRows[0]?.id);
  }

  if (!Number.isFinite(animalId) || animalId <= 0) {
    throw new Error(`Failed to resolve created animal id for slug ${String(animalInput.slug)}`);
  }

  if (media.length) {
    await db.insert(animalMedia).values(
      media.map((item) => ({
        ...item,
        animalId,
      })) as InsertAnimalMedium[]
    );
  }

  await recalculateAnimalStatus(animalId);
  return getAnimalBySlug(String(animalInput.slug));
}

export async function updateAnimalWithMedia(
  animalId: number,
  ownerOpenId: string,
  input: Partial<UpsertAnimalPayload>
) {
  const db = await getDb();
  const { media, ...animalPatch } = input;

  await db
    .update(animals)
    .set({ ...animalPatch, updatedAt: new Date() })
    .where(and(eq(animals.id, animalId), eq(animals.ownerOpenId, ownerOpenId)));

  if (media) {
    await db.delete(animalMedia).where(eq(animalMedia.animalId, animalId));
    if (media.length) {
      await db.insert(animalMedia).values(
        media.map((item) => ({
          ...item,
          animalId,
        })) as InsertAnimalMedium[]
      );
    }
  }

  await recalculateAnimalStatus(animalId);

  const rows = await db.select({ slug: animals.slug }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0] ? getAnimalBySlug(rows[0].slug) : null;
}

export async function setAnimalVisibility(animalId: number, ownerOpenId: string, mode: "public" | "hidden" | "archived") {
  const db = await getDb();
  const nextStatus = mode === "hidden" ? "hidden" : mode === "archived" ? "archived" : "public_available";
  await db
    .update(animals)
    .set({ status: nextStatus, publishedAt: mode === "public" ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(animals.id, animalId), eq(animals.ownerOpenId, ownerOpenId)));

  if (mode === "public") {
    await recalculateAnimalStatus(animalId);
  }

  const rows = await db.select({ slug: animals.slug }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0] ? getAnimalBySlug(rows[0].slug) : null;
}

export async function ensureSprintOneSeed(ownerOpenId: string) {
  const db = await getDb();
  const existingAnimals = await db.select({ id: animals.id }).from(animals).where(eq(animals.ownerOpenId, ownerOpenId)).limit(1);
  if (existingAnimals.length) {
    return;
  }

  const existingPlans = await db.select({ id: plans.id }).from(plans).where(eq(plans.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPlans.length) {
    const planResult = await db.insert(plans).values({
      ownerOpenId,
      code: `core-care-${ownerOpenId.toLowerCase().slice(0, 8)}`,
      name: "Базовая опека",
      description: "Стартовый статус для участия семьи в жизни животного и получения продукции.",
      status: "active",
      basePriceMinor: 45000,
      maxOwnersPerAnimal: 3,
      benefitsSummary: "Доступ к кабинету, клубным обновлениям и базовой продуктовой выдаче.",
    });
    const planId = Number(planResult.insertId);

    await db.insert(planDurations).values([
      {
        planId,
        months: 1,
        label: "1 месяц",
        priceMinor: 45000,
        isDefault: 1,
        isActive: 1,
        sortOrder: 0,
      },
      {
        planId,
        months: 3,
        label: "3 месяца",
        priceMinor: 129000,
        isDefault: 0,
        isActive: 1,
        sortOrder: 1,
      },
      {
        planId,
        months: 12,
        label: "12 месяцев",
        priceMinor: 480000,
        isDefault: 0,
        isActive: 1,
        sortOrder: 2,
      },
    ] as InsertPlanDuration[]);
  }

  await createAnimalWithMedia({
    ownerOpenId,
    name: "Марта",
    slug: `marta-${ownerOpenId.toLowerCase().slice(0, 6)}`,
    species: "goat",
    breed: "Зааненская",
    shortDescription: "Спокойная и общительная коза с выраженным молочным профилем.",
    story: "Марта быстро идёт на контакт с семьями и хорошо реагирует на регулярные визиты и кормление.",
    coverImageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
    galleryIntro: "Подборка фотографий Марты для витрины и карточки животного.",
    status: "public_available",
    totalOwnershipSlots: 10,
    baseMonthlyPriceMinor: 135000,
    healthScore: 88,
    happinessScore: 91,
    milkPotentialScore: 84,
    careLevelScore: 67,
    isFeatured: 1,
    sortOrder: 0,
    publishedAt: new Date(),
    media: [
      {
        animalId: 0,
        kind: "image",
        title: "Портрет Марты",
        alt: "Коза Марта на ферме",
        fileKey: "seed/marta-hero",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isCover: 1,
      },
    ],
  });

  await createAnimalWithMedia({
    ownerOpenId,
    name: "Злата",
    slug: `zlata-${ownerOpenId.toLowerCase().slice(0, 6)}`,
    species: "sheep",
    breed: "Казахская тонкорунная",
    shortDescription: "Мягкий темперамент, ровный ритм ухода и стабильная сезонная отдача.",
    story: "Злата хорошо подходит семьям, которые хотят мягкое вхождение в формат опеки и регулярных визитов.",
    coverImageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/milk_products_d3f8c13d.jpg",
    galleryIntro: "Подборка фотографий Златы для витрины и карточки животного.",
    status: "public_available",
    totalOwnershipSlots: 10,
    baseMonthlyPriceMinor: 118000,
    healthScore: 86,
    happinessScore: 89,
    milkPotentialScore: 78,
    careLevelScore: 59,
    isFeatured: 0,
    sortOrder: 1,
    publishedAt: new Date(),
    media: [
      {
        animalId: 0,
        kind: "image",
        title: "Образ Златы",
        alt: "Овца Злата на ферме",
        fileKey: "seed/zlata-hero",
        url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isCover: 1,
      },
    ],
  });

}
