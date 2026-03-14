import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  animalPhotos,
  clubEvents,
  clubMembers,
  clubPosts,
  InsertAnimalPhoto,
  InsertClubEvent,
  InsertClubMember,
  InsertClubPost,
  InsertUser,
  productBatches,
  productCompositionSnapshots,
  productDeliveries,
  productMonthlyMetrics,
  users,
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
        productName: "Выдержанный шевр Марты",
        productType: "Сыр",
        stage: "Созревание",
        routeLabel: "Сыроварня → камера созревания → клубный релиз",
        detail: "Партия для клубного релиза выдерживается в малой камере и будет открыта после дегустации на ферме.",
        badge: "Клубный релиз",
        batchCode: "MRT-2403-CHEVRE",
        producedAt: new Date("2026-03-08T11:00:00Z"),
        deliveryWindow: "Самовывоз после дегустации",
        sortOrder: 1,
      },
    ]);
  }

  const existingSnapshots = await db
    .select({ id: productCompositionSnapshots.id })
    .from(productCompositionSnapshots)
    .where(eq(productCompositionSnapshots.ownerOpenId, ownerOpenId))
    .limit(1);
  if (!existingSnapshots.length) {
    await db.insert(productCompositionSnapshots).values([
      { animalSlug: "marta", ownerOpenId, label: "Белок", value: "3.8%", note: "Выше сезонной нормы", sortOrder: 0 },
      { animalSlug: "marta", ownerOpenId, label: "Жирность", value: "4.7%", note: "Подходит для мягких сыров", sortOrder: 1 },
      { animalSlug: "marta", ownerOpenId, label: "Лот", value: "MRT-2403", note: "Отслеживается до коробки", sortOrder: 2 },
    ]);
  }

  const existingMetrics = await db
    .select({ id: productMonthlyMetrics.id })
    .from(productMonthlyMetrics)
    .where(eq(productMonthlyMetrics.ownerOpenId, ownerOpenId))
    .limit(1);
  if (!existingMetrics.length) {
    await db.insert(productMonthlyMetrics).values([
      { animalSlug: "marta", ownerOpenId, monthLabel: "Дек", milkVolumeLiters: 48, proteinPercentTenth: 35, fatPercentTenth: 44, sortOrder: 0 },
      { animalSlug: "marta", ownerOpenId, monthLabel: "Янв", milkVolumeLiters: 52, proteinPercentTenth: 36, fatPercentTenth: 45, sortOrder: 1 },
      { animalSlug: "marta", ownerOpenId, monthLabel: "Фев", milkVolumeLiters: 57, proteinPercentTenth: 37, fatPercentTenth: 46, sortOrder: 2 },
      { animalSlug: "marta", ownerOpenId, monthLabel: "Мар", milkVolumeLiters: 61, proteinPercentTenth: 38, fatPercentTenth: 47, sortOrder: 3 },
    ]);
  }

  const existingDeliveries = await db
    .select({ id: productDeliveries.id })
    .from(productDeliveries)
    .where(eq(productDeliveries.ownerOpenId, ownerOpenId))
    .limit(1);
  if (!existingDeliveries.length) {
    await db.insert(productDeliveries).values([
      {
        animalSlug: "marta",
        ownerOpenId,
        title: "Коробка семьи на выходные",
        status: "Курьер подтвердил выезд",
        etaLabel: "Прибытие завтра к 11:00",
        destination: "Москва, семейный адрес",
        courierNote: "Холодовая цепь подтверждена, водитель отправит фото вручения.",
        isActive: 1,
        sortOrder: 0,
      },
      {
        animalSlug: "marta",
        ownerOpenId,
        title: "Клубный дегустационный набор",
        status: "Готов к самовывозу",
        etaLabel: "Окно выдачи в день визита",
        destination: "Ферма Шерь Козу",
        courierNote: "Можно объединить с экскурсионным визитом и дегустацией.",
        isActive: 0,
        sortOrder: 1,
      },
    ]);
  }

  const existingPosts = await db.select({ id: clubPosts.id }).from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPosts.length) {
    await db.insert(clubPosts).values([
      {
        ownerOpenId,
        category: "journal",
        author: "Команда фермы",
        avatar: "SK",
        role: "Семейная хроника",
        timeLabel: "Сегодня, 08:15",
        title: "Утренний круг на дворе Марты",
        text: "Марта первой вышла на круг, а затем спокойно перешла в доильный блок. Для владельцев это значит, что сегодняшняя партия уже в работе и скоро отразится в трекере.",
        imageUrl: CLUB_IMAGE,
        likes: 26,
        comments: 7,
        tagsCsv: "утро,марта,дневник",
        pinned: 1,
        sortOrder: 0,
      },
      {
        ownerOpenId,
        category: "event",
        author: "Клуб фермы",
        avatar: "KF",
        role: "События сообщества",
        timeLabel: "Вчера, 18:40",
        title: "Открыт набор на весенний визит с сырной дегустацией",
        text: "В апреле проведём камерный клубный визит: прогулка по ферме, знакомство с Мартыным маршрутом молока и ужин с семейной дегустацией.",
        imageUrl: CLUB_IMAGE,
        likes: 19,
        comments: 5,
        tagsCsv: "визит,дегустация,клуб",
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
        title: "Весенний клубный визит",
        dateLabel: "12 апреля · 13:00",
        description: "Прогулка по ферме, знакомство с линией Марты и ужин с сырной подачей из свежей партии.",
        status: "Открыта регистрация",
        tone: "warm",
        sortOrder: 0,
      },
      {
        ownerOpenId,
        title: "Онлайн-встреча владельцев",
        dateLabel: "20 апреля · 19:30",
        description: "Короткий цифровой брифинг по новым партиям, сезонным изменениям молока и летним планам клуба.",
        status: "Подтвердите участие",
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
        name: "Владелец фермы",
        animal: "Марта",
        sinceLabel: "С клубом с января",
        badge: "Основатель маршрута",
        sortOrder: 0,
      },
      {
        ownerOpenId,
        name: "Семья Ковалёвых",
        animal: "Белла",
        sinceLabel: "С клубом с февраля",
        badge: "Гостевой стол",
        sortOrder: 1,
      },
    ]);
  }

  seededOwners.add(ownerOpenId);
}

export async function getDb() {
  const databaseUrl = ENV.databaseUrl || process.env.DATABASE_URL;

  if (!_db && databaseUrl) {
    try {
      _pool = createPool({
        uri: databaseUrl,
        connectionLimit: 10,
        enableKeepAlive: true,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }

  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listAnimalPhotos(animalSlug: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list animal photos: database not available");
    return [];
  }

  try {
    const rows = await db
      .select()
      .from(animalPhotos)
      .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    console.info("[AnimalPhotos] list", {
      animalSlug,
      ownerOpenId,
      ordered: rows.map((row: { id: number; sortOrder: number; isCover: number }) => ({
        id: row.id,
        sortOrder: row.sortOrder,
        isCover: row.isCover,
      })),
    });

    return rows;
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

  const currentPhotos = await db
    .select({ sortOrder: animalPhotos.sortOrder })
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, input.animalSlug), eq(animalPhotos.ownerOpenId, input.ownerOpenId)))
    .orderBy(desc(animalPhotos.sortOrder))
    .limit(1);

  const nextSortOrder = (currentPhotos[0]?.sortOrder ?? -1) + 1;

  const values: InsertAnimalPhoto = {
    ...input,
    sortOrder: input.sortOrder ?? nextSortOrder,
    isCover: input.isCover ?? 0,
  };

  const result = await db.insert(animalPhotos).values(values);
  const insertMeta = Array.isArray(result) ? result[0] : result;
  const insertedId = Number((insertMeta as { insertId?: number | string }).insertId);

  if (!Number.isFinite(insertedId) || insertedId <= 0) {
    throw new Error("Failed to resolve inserted photo id after upload");
  }

  if (values.isCover) {
    await db
      .update(animalPhotos)
      .set({ isCover: 0 })
      .where(
        and(
          eq(animalPhotos.animalSlug, values.animalSlug),
          eq(animalPhotos.ownerOpenId, values.ownerOpenId),
          sql`${animalPhotos.id} <> ${insertedId}`,
        ),
      );
  }

  const created = await db.select().from(animalPhotos).where(eq(animalPhotos.id, insertedId)).limit(1);
  return created[0];
}

export async function deleteAnimalPhoto(photoId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo deletion");
  }

  const rows = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, photoId), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .limit(1);

  const existing = rows[0];
  if (!existing) return null;

  await db.delete(animalPhotos).where(eq(animalPhotos.id, photoId));

  const remaining = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, existing.animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

  if (existing.isCover && remaining.length) {
    const nextCoverId = remaining[0]?.id;
    if (nextCoverId) {
      await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, nextCoverId));
    }
  }

  await Promise.all(
    remaining.map((photo: { id: number }, index: number) =>
      db.update(animalPhotos).set({ sortOrder: index }).where(eq(animalPhotos.id, photo.id)),
    ),
  );

  return existing;
}

export async function setAnimalPhotoCover(photoId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for setting photo cover");
  }

  const rows = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, photoId), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .limit(1);

  const target = rows[0];
  if (!target) return null;

  await db
    .update(animalPhotos)
    .set({ isCover: 0 })
    .where(and(eq(animalPhotos.animalSlug, target.animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)));

  await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, photoId));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, photoId)).limit(1);
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

  console.info("[AnimalPhotos] reorder:before", {
    animalSlug,
    ownerOpenId,
    requestedPhotoIds: photoIds,
    existing: existing.map((photo: { id: number; sortOrder: number; isCover: number }) => ({
      id: photo.id,
      sortOrder: photo.sortOrder,
      isCover: photo.isCover,
    })),
  });

  const existingById = new Map(existing.map((photo: { id: number }) => [photo.id, photo] as const));

  if (!photoIds.length) {
    throw new Error("Photo order payload is empty");
  }

  const hasUnknownIds = photoIds.some((photoId) => !existingById.has(photoId));
  if (hasUnknownIds) {
    throw new Error("Photo order payload contains unknown gallery items");
  }

  const untouchedPhotos = existing.filter((photo: { id: number }) => !photoIds.includes(photo.id));
  const finalOrder = [...photoIds.map((photoId) => existingById.get(photoId)!), ...untouchedPhotos];

  await Promise.all(
    finalOrder.map((photo: { id: number }, index: number) => db.update(animalPhotos).set({ sortOrder: index }).where(eq(animalPhotos.id, photo.id))),
  );

  const updated = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

  console.info("[AnimalPhotos] reorder:after", {
    animalSlug,
    ownerOpenId,
    ordered: updated.map((photo: { id: number; sortOrder: number; isCover: number }) => ({
      id: photo.id,
      sortOrder: photo.sortOrder,
      isCover: photo.isCover,
    })),
  });

  return updated;
}

export async function getProductTrackerData(ownerOpenId: string, animalSlug: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get product tracker data: database not available");
    return {
      heroBatch: null,
      batches: [],
      composition: [],
      monthlyMetrics: [],
      deliveries: [],
    };
  }

  await ensureOwnerExperienceSeed(ownerOpenId);

  const [batches, composition, monthlyMetrics, deliveries] = await Promise.all([
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
    heroBatch: batches[0] ?? null,
    batches,
    composition,
    monthlyMetrics,
    deliveries,
  };
}

export async function getClubFeedData(ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get club feed data: database not available");
    return {
      posts: [],
      events: [],
      members: [],
    };
  }

  await ensureOwnerExperienceSeed(ownerOpenId);

  const [posts, events, members] = await Promise.all([
    db.select().from(clubPosts).where(eq(clubPosts.ownerOpenId, ownerOpenId)).orderBy(desc(clubPosts.pinned), asc(clubPosts.sortOrder), desc(clubPosts.createdAt)),
    db.select().from(clubEvents).where(eq(clubEvents.ownerOpenId, ownerOpenId)).orderBy(asc(clubEvents.sortOrder), desc(clubEvents.createdAt)),
    db.select().from(clubMembers).where(eq(clubMembers.ownerOpenId, ownerOpenId)).orderBy(asc(clubMembers.sortOrder), desc(clubMembers.createdAt)),
  ]);

  return {
    posts,
    events,
    members,
  };
}

export async function listClubAdminData(ownerOpenId: string) {
  return getClubFeedData(ownerOpenId);
}

export async function createClubPost(input: InsertClubPost) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for creating club post");
  }

  const result = await db.insert(clubPosts).values(input);
  const insertMeta = Array.isArray(result) ? result[0] : result;
  const insertedId = Number((insertMeta as { insertId?: number | string }).insertId);
  const created = await db.select().from(clubPosts).where(eq(clubPosts.id, insertedId)).limit(1);
  return created[0] ?? null;
}

export async function updateClubPost(input: InsertClubPost & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club post");
  }

  await db
    .update(clubPosts)
    .set({
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
    })
    .where(and(eq(clubPosts.id, input.id), eq(clubPosts.ownerOpenId, input.ownerOpenId)));

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

  const result = await db.insert(clubEvents).values(input);
  const insertMeta = Array.isArray(result) ? result[0] : result;
  const insertedId = Number((insertMeta as { insertId?: number | string }).insertId);
  const created = await db.select().from(clubEvents).where(eq(clubEvents.id, insertedId)).limit(1);
  return created[0] ?? null;
}

export async function updateClubEvent(input: InsertClubEvent & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club event");
  }

  await db
    .update(clubEvents)
    .set({
      title: input.title,
      dateLabel: input.dateLabel,
      description: input.description,
      status: input.status,
      tone: input.tone,
      sortOrder: input.sortOrder,
    })
    .where(and(eq(clubEvents.id, input.id), eq(clubEvents.ownerOpenId, input.ownerOpenId)));

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

  const result = await db.insert(clubMembers).values(input);
  const insertMeta = Array.isArray(result) ? result[0] : result;
  const insertedId = Number((insertMeta as { insertId?: number | string }).insertId);
  const created = await db.select().from(clubMembers).where(eq(clubMembers.id, insertedId)).limit(1);
  return created[0] ?? null;
}

export async function updateClubMember(input: InsertClubMember & { id: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating club member");
  }

  await db
    .update(clubMembers)
    .set({
      name: input.name,
      animal: input.animal,
      sinceLabel: input.sinceLabel,
      badge: input.badge,
      sortOrder: input.sortOrder,
    })
    .where(and(eq(clubMembers.id, input.id), eq(clubMembers.ownerOpenId, input.ownerOpenId)));

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
