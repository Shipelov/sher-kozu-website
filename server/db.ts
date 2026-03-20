import { and, asc, desc, eq, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
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
  animalProductionProfiles,
  productOptions,
  ownerProductPlans,
  deliverySchedule,
  chatMessages,
  InsertAnimalProductionProfile,
  InsertProductOption,
  InsertOwnerProductPlan,
  InsertDeliveryScheduleEntry,
  InsertChatMessage,
  planChangeLog,
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

  // Resolve actual animal slugs for this owner
  const ownerAnimals = await db.select({ slug: animals.slug, name: animals.name }).from(animals).where(eq(animals.ownerOpenId, ownerOpenId)).orderBy(animals.sortOrder).limit(2);
  const slugA = ownerAnimals[0]?.slug ?? "marta";
  const slugB = ownerAnimals[1]?.slug ?? "zlata";

  const existingBatch = await db.select({ id: productBatches.id }).from(productBatches).where(eq(productBatches.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingBatch.length) {
    await db.insert(productBatches).values([
      {
        animalSlug: slugA,
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
        animalSlug: slugA,
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
        animalSlug: slugB,
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
        animalSlug: slugA,
        ownerOpenId,
        label: "Жирность",
        value: "4.8%",
        note: "Подходит для свежих сыров и мягких семейных десертов.",
        sortOrder: 0,
      },
      {
        animalSlug: slugA,
        ownerOpenId,
        label: "Белок",
        value: "3.6%",
        note: "Стабильный показатель для сыроварения.",
        sortOrder: 1,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        label: "Жирность",
        value: "4.2%",
        note: "Даёт мягкую текстуру и хорошую стабильность ферментации.",
        sortOrder: 0,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        label: "Белок",
        value: "3.4%",
        note: "Нежный профиль для йогурта.",
        sortOrder: 1,
      },
    ]);
  }

  const existingMetrics = await db.select({ id: productMonthlyMetrics.id }).from(productMonthlyMetrics).where(eq(productMonthlyMetrics.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingMetrics.length) {
    await db.insert(productMonthlyMetrics).values([
      {
        animalSlug: slugA,
        ownerOpenId,
        monthLabel: "Январь",
        milkVolumeLiters: 81,
        proteinPercentTenth: 36,
        fatPercentTenth: 48,
        sortOrder: 0,
      },
      {
        animalSlug: slugA,
        ownerOpenId,
        monthLabel: "Февраль",
        milkVolumeLiters: 88,
        proteinPercentTenth: 37,
        fatPercentTenth: 49,
        sortOrder: 1,
      },
      {
        animalSlug: slugA,
        ownerOpenId,
        monthLabel: "Март",
        milkVolumeLiters: 92,
        proteinPercentTenth: 36,
        fatPercentTenth: 50,
        sortOrder: 2,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        monthLabel: "Январь",
        milkVolumeLiters: 74,
        proteinPercentTenth: 34,
        fatPercentTenth: 42,
        sortOrder: 0,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        monthLabel: "Февраль",
        milkVolumeLiters: 78,
        proteinPercentTenth: 35,
        fatPercentTenth: 43,
        sortOrder: 1,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        monthLabel: "Март",
        milkVolumeLiters: 83,
        proteinPercentTenth: 34,
        fatPercentTenth: 44,
        sortOrder: 2,
      },
    ]);
  }

  const existingDeliveries = await db.select({ id: productDeliveries.id }).from(productDeliveries).where(eq(productDeliveries.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingDeliveries.length) {
    await db.insert(productDeliveries).values([
      {
        animalSlug: slugA,
        ownerOpenId,
        title: "Клубный набор Марты",
        status: "В пути",
        etaLabel: "15 марта, 18:00–20:00",
        destination: "Алматы, Медеуский район",
        courierNote: "Курьер забрал заказ, следующий чекпойнт — сортировка.",
        isActive: 1,
        sortOrder: 0,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        title: "Завтрак от Златы",
        status: "Готовится",
        etaLabel: "16 марта, до 11:00",
        destination: "Алматы, Бостандыкский район",
        courierNote: "Набор упаковывается, передача курьеру завтра утром.",
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

export async function listAnimalPhotos(animalSlug: string, _ownerOpenId?: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Admin can view photos for any animal (single-owner farm)
    const items = await db
      .select()
      .from(animalPhotos)
      .where(eq(animalPhotos.animalSlug, animalSlug))
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

export async function deleteAnimalPhoto(photoId: number, _ownerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo deletion");
  }

  // Admin can delete any photo (single-owner farm)
  const existing = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.id, photoId))
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
      .where(eq(animalPhotos.animalSlug, existing[0].animalSlug))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    if (fallback[0]) {
      await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, fallback[0].id));
    }
  }

  return existing[0];
}

export async function setAnimalPhotoCover(photoId: number, _ownerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for setting photo cover");
  }

  // Admin can set cover for any photo (single-owner farm)
  const target = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.id, photoId))
    .limit(1);

  if (!target[0]) {
    return null;
  }

  await db.update(animalPhotos).set({ isCover: 0 }).where(eq(animalPhotos.animalSlug, target[0].animalSlug));

  await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, photoId));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, photoId)).limit(1);
  return updated[0] ?? null;
}

export async function updateAnimalPhotoMeta(input: { photoId: number; ownerOpenId: string; title: string; alt: string | null }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for updating photo metadata");
  }

  // Admin can update meta for any photo (single-owner farm)
  const existing = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.id, input.photoId))
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
    .where(eq(animalPhotos.id, input.photoId));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, input.photoId)).limit(1);
  return updated[0] ?? null;
}

export async function reorderAnimalPhotos(photoIds: number[], _ownerOpenId: string, animalSlug: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for reordering photos");
  }

  // Admin can reorder photos for any animal (single-owner farm)
  const existing = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.animalSlug, animalSlug))
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
    .where(eq(animalPhotos.animalSlug, animalSlug))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

  return updated;
}

export async function getOwnerDashboardData(ownerOpenId: string) {
  await ensureSprintOneSeed(ownerOpenId);
  await ensureOwnerExperienceSeed(ownerOpenId);

  const db = await getDb();
  if (!db) {
    return {
      ownership: null,
      animal: null,
      productSummary: null,
      clubSummary: null,
      quickLinks: [
        { label: "Открыть галерею животных", href: "/animals", description: "Выберите животное и начните маршрут участия." },
      ],
      nextSteps: [
        {
          id: "explore-animals",
          title: "Выберите животное для участия",
          description: "Откройте галерею, сравните профили и начните путь от выбора животного к личному кабинету владельца.",
          href: "/animals",
          kind: "explore",
        },
      ],
    } as const;
  }

  const ownershipRows = await db
    .select({
      ownershipId: animalOwnerships.id,
      animalId: animalOwnerships.animalId,
      slotIndex: animalOwnerships.slotIndex,
      status: animalOwnerships.status,
      startsAt: animalOwnerships.startsAt,
      endsAt: animalOwnerships.endsAt,
      priceMinor: animalOwnerships.priceMinor,
      notes: animalOwnerships.notes,
      animalName: animals.name,
      animalSlug: animals.slug,
      animalStatus: animals.status,
      species: animals.species,
      breed: animals.breed,
      shortDescription: animals.shortDescription,
      baseMonthlyPriceMinor: animals.baseMonthlyPriceMinor,
      totalOwnershipSlots: animals.totalOwnershipSlots,
      coverImageUrl: animals.coverImageUrl,
      healthScore: animals.healthScore,
      happinessScore: animals.happinessScore,
      milkPotentialScore: animals.milkPotentialScore,
      careLevelScore: animals.careLevelScore,
    })
    .from(animalOwnerships)
    .innerJoin(animals, eq(animalOwnerships.animalId, animals.id))
    .where(and(eq(animalOwnerships.ownerOpenId, ownerOpenId), or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment"))))
    .orderBy(desc(animalOwnerships.status), desc(animalOwnerships.startsAt), desc(animalOwnerships.id));

  const groupedByAnimal = new Map<number, any[]>();
  for (const row of ownershipRows) {
    const current = groupedByAnimal.get(row.animalId) ?? [];
    current.push(row);
    groupedByAnimal.set(row.animalId, current);
  }

  const sortedGroups = Array.from(groupedByAnimal.values()).sort((left, right) => {
    const leftPending = left.some((item) => item.status === "pending_payment") ? 1 : 0;
    const rightPending = right.some((item) => item.status === "pending_payment") ? 1 : 0;
    if (leftPending !== rightPending) return rightPending - leftPending;
    return right.length - left.length;
  });

  const primaryOwnershipGroup = sortedGroups[0] ?? null;
  const primaryOwnership = primaryOwnershipGroup?.[0] ?? null;

  // Build allOwnerships — one entry per animal the owner has booked/paid
  const allOwnerships = sortedGroups.map((group) => {
    const first = group[0];
    const slotsCount = group.length;
    const totalSlots = normalizeOwnershipSlots(first.totalOwnershipSlots ?? 10);
    const sharePercent = slotsCount * Math.round(getPercentPerSlot(totalSlots));
    const hasPending = group.some((item: any) => item.status === "pending_payment");
    const hasActive = group.some((item: any) => item.status === "active");
    return {
      animalId: first.animalId,
      animalSlug: first.animalSlug,
      animalName: first.animalName,
      species: first.species,
      breed: first.breed,
      coverImageUrl: first.coverImageUrl,
      sharePercent,
      slotsCount,
      status: hasPending ? "pending_payment" as const : "active" as const,
      statusLabel: hasPending ? "Ожидает подтверждения" : hasActive ? "Активное участие" : "Без активного участия",
      startsAt: first.startsAt,
      endsAt: first.endsAt,
      priceMinorTotal: group.reduce((sum: number, item: any) => sum + Number(item.priceMinor ?? 0), 0),
      slotIndexes: group.map((item: any) => item.slotIndex).sort((a: number, b: number) => a - b),
    };
  });
  const currentAnimal = primaryOwnership ? await getAnimalBySlug(primaryOwnership.animalSlug, ownerOpenId) : null;
  const mySharePercent = currentAnimal?.mySharePercent ?? (primaryOwnershipGroup ? primaryOwnershipGroup.length * Math.round(getPercentPerSlot(normalizeOwnershipSlots(primaryOwnership.totalOwnershipSlots ?? 10))) : 0);
  const trackerData = primaryOwnership ? await getProductTrackerData(ownerOpenId, primaryOwnership.animalSlug) : { productBatches: [], compositionSnapshots: [], monthlyMetrics: [], deliveries: [] };
  const clubData = await getClubFeedData(ownerOpenId);

  const currentDelivery = trackerData.deliveries.find((item: any) => Boolean(item.isActive)) ?? trackerData.deliveries[0] ?? null;
  const currentBatch = trackerData.productBatches[0] ?? null;
  const nextEvent = clubData.events.find((item: any) => ["Открыта запись", "Мест осталось мало", "Скоро"].includes(String(item.status ?? ""))) ?? clubData.events[0] ?? null;

  const statusLabel = primaryOwnershipGroup?.some((item) => item.status === "pending_payment")
    ? "Ожидает подтверждения"
    : primaryOwnershipGroup?.some((item) => item.status === "active")
      ? "Активное участие"
      : "Без активного участия";

  const animalHref = currentAnimal ? `/animals/${currentAnimal.slug}` : "/animals";
  const trackerHref = currentAnimal ? `/tracker?animal=${currentAnimal.slug}` : "/tracker";
  const clubHref = currentAnimal ? `/club?animal=${currentAnimal.slug}` : "/club";

  const quickLinks = currentAnimal
    ? [
        { label: `Дневник ${currentAnimal.name}`, href: `${animalHref}#profile-diary`, description: "Открыть последние записи, ритм дня и заметки по уходу." },
        { label: "Трекер продукции", href: trackerHref, description: "Посмотреть текущую партию, доставку и происхождение семейного набора." },
        { label: "Клуб владельцев", href: clubHref, description: "Проверить ближайшие события, визиты и закрытые форматы сообщества." },
      ]
    : [{ label: "Открыть галерею животных", href: "/animals", description: "Начните с выбора животного и понятного сценария участия." }];

  const nextSteps = currentAnimal
    ? [
        primaryOwnershipGroup?.some((item) => item.status === "pending_payment")
          ? {
              id: "confirm-participation",
              title: "Подтвердить участие и перейти в полный режим владельца",
              description: `У вас уже забронировано ${mySharePercent}% участия в ${currentAnimal.name}. Следующий шаг — подтвердить участие и сохранить маршрут в кабинете владельца.`,
              href: animalHref,
              kind: "confirm",
            }
          : {
              id: "open-diary",
              title: `Проверить, как проходит день у ${currentAnimal.name}`,
              description: "Откройте дневник и галерею, чтобы быстро вернуться в живой ритм фермы между поставками и визитами.",
              href: `${animalHref}#profile-diary`,
              kind: "diary",
            },
        currentDelivery
          ? {
              id: "track-delivery",
              title: "Проверить текущую доставку и именную коробку",
              description: `${currentDelivery.title ?? currentDelivery.batchCode ?? "Текущая партия"} сейчас находится на этапе «${currentDelivery.status ?? "в пути"}».`,
              href: trackerHref,
              kind: "tracker",
            }
          : {
              id: "open-tracker",
              title: "Открыть трекер продукта",
              description: "Даже если активная доставка ещё не сформирована, трекер показывает происхождение продукта и прозрачность следующей партии.",
              href: trackerHref,
              kind: "tracker",
            },
        nextEvent
          ? {
              id: "open-club-event",
              title: `Посмотреть ближайшее событие: ${nextEvent.title}`,
              description: nextEvent.teaser ?? nextEvent.description ?? "Клубный маршрут поддерживает личную связь семьи с фермой.",
              href: clubHref,
              kind: "club",
            }
          : {
              id: "open-club",
              title: "Заглянуть в клуб владельцев",
              description: "Проверьте новые встречи, закрытые ужины и форматы, которые удерживают связь с фермой между доставками.",
              href: clubHref,
              kind: "club",
            },
      ].filter(Boolean)
    : [
        {
          id: "explore-animals",
          title: "Выберите животное для участия",
          description: "Кабинет владельца оживает после выбора доли: сначала откройте каталог и найдите животное, с которым хотите выстроить личную связь.",
          href: "/animals",
          kind: "explore",
        },
      ];

  return {
    ownership: primaryOwnership
      ? {
          animalId: primaryOwnership.animalId,
          animalSlug: primaryOwnership.animalSlug,
          animalName: primaryOwnership.animalName,
          sharePercent: mySharePercent,
          slotsCount: primaryOwnershipGroup?.length ?? 0,
          status: primaryOwnershipGroup?.some((item) => item.status === "pending_payment") ? "pending_payment" : "active",
          statusLabel,
          startsAt: primaryOwnership.startsAt,
          endsAt: primaryOwnership.endsAt,
          priceMinorTotal: (primaryOwnershipGroup ?? []).reduce((sum, item) => sum + Number(item.priceMinor ?? 0), 0),
          slotIndexes: (primaryOwnershipGroup ?? []).map((item) => item.slotIndex).sort((a, b) => a - b),
        }
      : null,
    animal: currentAnimal
      ? {
          id: currentAnimal.id,
          slug: currentAnimal.slug,
          name: currentAnimal.name,
          species: currentAnimal.species,
          breed: currentAnimal.breed,
          coverImageUrl: currentAnimal.coverImageUrl,
          shortDescription: currentAnimal.shortDescription,
          status: currentAnimal.status,
          healthScore: currentAnimal.healthScore,
          happinessScore: currentAnimal.happinessScore,
          milkPotentialScore: currentAnimal.milkPotentialScore,
          careLevelScore: currentAnimal.careLevelScore,
          availablePercent: currentAnimal.availablePercent,
          ownedPercent: currentAnimal.ownedPercent,
          shareUnitPercent: currentAnimal.shareUnitPercent,
          mySharePercent: currentAnimal.mySharePercent,
        }
      : null,
    productSummary: currentAnimal
      ? {
          currentBatch,
          currentDelivery,
          deliveryCount: trackerData.deliveries.length,
          batchCount: trackerData.productBatches.length,
          compositionCount: trackerData.compositionSnapshots.length,
          monthlyMetricCount: trackerData.monthlyMetrics.length,
        }
      : null,
    clubSummary: {
      nextEvent,
      postCount: clubData.posts.length,
      eventCount: clubData.events.length,
      memberCount: clubData.members.length,
    },
    quickLinks,
    nextSteps,
    allOwnerships,
  } as const;
}

export async function getProductTrackerData(ownerOpenId: string, animalSlug: string) {
  const db = await getDb();
  if (!db) {
    return {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: null,
    };
  }

  // Fetch animal data for the tracker page
  const animalRows = await db.select().from(animals).where(eq(animals.slug, animalSlug)).limit(1);
  const animal = animalRows[0] ?? null;

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
    currentAnimal: animal
      ? {
          slug: animal.slug,
          name: animal.name,
          title: `${animal.name} — источник вашего персонального маршрута`,
          description: animal.shortDescription ?? `Трекер продукции ${animal.name} показывает происхождение молока, параметры партии и ход доставки.`,
          coverImageUrl: animal.coverImageUrl,
        }
      : null,
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

export async function countPendingOwnerships(animalId: number) {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(animalOwnerships)
    .where(and(eq(animalOwnerships.animalId, animalId), eq(animalOwnerships.status, "pending_payment")));
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
  const pendingOwnerships = await countPendingOwnerships(animal.id);
  const media = await db
    .select()
    .from(animalMedia)
    .where(eq(animalMedia.animalId, animal.id))
    .orderBy(desc(animalMedia.isCover), asc(animalMedia.sortOrder), asc(animalMedia.id));
  const occupiedUntil = await getAnimalOccupiedUntil(animal.id);
  const shareMetrics = buildAnimalShareMetrics(animal, activeOwnerships);
  const shareDistribution = await buildShareDistribution(animal.id);

  const occupiedValueMinor = shareDistribution.reduce(
    (sum, entry) => sum + getSharePriceMinor(animal.baseMonthlyPriceMinor, entry.percent),
    0,
  );

  return {
    ...animal,
    ...shareMetrics,
    pendingOwnerships,
    occupiedUntil,
    occupiedValueMinor,
    shareDistribution,
    ownersCount: shareDistribution.length,
    coverImageUrl: media.find((item: any) => item.isCover)?.url ?? animal.coverImageUrl,
    media,
  };
}

export async function listPublicAnimals() {
  const db = await getDb();
  const farmOwner = ENV.ownerOpenId;
  const statusFilter = or(eq(animals.status, "public_available"), eq(animals.status, "public_limited"), eq(animals.status, "fully_booked"));
  // Public catalog shows only the farm owner's animals (not test/buyer animals)
  const ownerFilter = farmOwner ? and(eq(animals.ownerOpenId, farmOwner), statusFilter) : statusFilter;
  const rows = await db
    .select()
    .from(animals)
    .where(ownerFilter)
    .orderBy(desc(animals.isFeatured), asc(animals.sortOrder), asc(animals.name));

  return Promise.all(rows.map((animal: any) => enrichAnimalWithShareMetrics(db, animal)));
}

export async function getAnimalBySlug(slug: string, viewerOpenId?: string | null) {
  const db = await getDb();
  const rows = await db.select().from(animals).where(eq(animals.slug, slug)).limit(1);
  const animal = rows[0];

  if (!animal || animal.status === "archived") {
    return null;
  }

  const ownerLinkedPlans = await db
    .select()
    .from(plans)
    .where(and(eq(plans.ownerOpenId, animal.ownerOpenId), eq(plans.status, "active")))
    .orderBy(asc(plans.id));
  const linkedPlans = ownerLinkedPlans.length
    ? ownerLinkedPlans
    : await db.select().from(plans).where(eq(plans.status, "active")).orderBy(asc(plans.id));
  const durations = linkedPlans.length
    ? await db.select().from(planDurations).where(eq(planDurations.isActive, 1)).orderBy(asc(planDurations.sortOrder), asc(planDurations.months))
    : [];
  const enriched = await enrichAnimalWithShareMetrics(db, animal);

  // Compute mySharePercent for the viewing user
  let mySharePercent = 0;
  if (viewerOpenId) {
    const myOwnerships = await db
      .select({ slotIndex: animalOwnerships.slotIndex })
      .from(animalOwnerships)
      .where(
        and(
          eq(animalOwnerships.animalId, animal.id),
          eq(animalOwnerships.ownerOpenId, viewerOpenId),
          or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment")),
        ),
      );
    const totalSlots = getStandardizedOwnershipSlots();
    const shareUnitPercent = Math.round(getPercentPerSlot(totalSlots));
    mySharePercent = myOwnerships.length * shareUnitPercent;
  }

  return {
    ...enriched,
    mySharePercent,
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

export async function listAdminAnimals(_ownerOpenId?: string) {
  const db = await getDb();
  // Admin sees only the farm owner's animals (filter out test/buyer-created animals)
  const farmOwner = ENV.ownerOpenId;
  const whereClause = farmOwner
    ? eq(animals.ownerOpenId, farmOwner)
    : undefined;
  const rows = await db
    .select()
    .from(animals)
    .where(whereClause)
    .orderBy(desc(animals.isFeatured), asc(animals.sortOrder), asc(animals.name));

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
  _ownerOpenId: string,
  input: Partial<UpsertAnimalPayload>
) {
  const db = await getDb();
  const { media, ...animalPatch } = input;

  // Admin can update any animal (single-owner farm)
  await db
    .update(animals)
    .set({ ...animalPatch, updatedAt: new Date() })
    .where(eq(animals.id, animalId));

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

export async function archiveAnimalProfile(animalId: number, _ownerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for animal archiving");
  }

  // Admin can archive any animal (single-owner farm)
  const existingRows = await db
    .select({
      id: animals.id,
      slug: animals.slug,
      name: animals.name,
      status: animals.status,
    })
    .from(animals)
    .where(eq(animals.id, animalId))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return null;
  }

  await db
    .update(animals)
    .set({
      status: "archived",
      publishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(animals.id, animalId));

  return {
    ...existing,
    status: "archived" as const,
  };
}

export async function restoreAnimalProfile(animalId: number, _ownerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for animal restore");
  }

  // Admin can restore any animal (single-owner farm)
  const existingRows = await db
    .select({
      id: animals.id,
      slug: animals.slug,
      name: animals.name,
      status: animals.status,
    })
    .from(animals)
    .where(eq(animals.id, animalId))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return null;
  }

  await db
    .update(animals)
    .set({
      status: "hidden",
      updatedAt: new Date(),
    })
    .where(eq(animals.id, animalId));

  const rows = await db.select({ slug: animals.slug }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0] ? getAnimalBySlug(rows[0].slug) : null;
}

export async function setAnimalVisibility(animalId: number, _ownerOpenId: string, mode: "public" | "hidden" | "archived") {
  const db = await getDb();
  const nextStatus = mode === "hidden" ? "hidden" : mode === "archived" ? "archived" : "public_available";
  // Admin can change visibility of any animal (single-owner farm)
  await db
    .update(animals)
    .set({ status: nextStatus, publishedAt: mode === "public" ? new Date() : null, updatedAt: new Date() })
    .where(eq(animals.id, animalId));

  if (mode === "public") {
    await recalculateAnimalStatus(animalId);
  }

  const rows = await db.select({ slug: animals.slug }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0] ? getAnimalBySlug(rows[0].slug) : null;
}

export async function ensureSprintOneSeed(ownerOpenId: string) {
  // Only seed animals for the actual farm owner, not for buyer/test accounts
  const farmOwner = ENV.ownerOpenId;
  if (farmOwner && ownerOpenId !== farmOwner) {
    return;
  }
  const db = await getDb();
  const existingAnimals = await db.select({ id: animals.id, species: animals.species }).from(animals).where(eq(animals.ownerOpenId, ownerOpenId));
  const hasGoat = existingAnimals.some((a: any) => a.species === 'goat');
  const hasSheep = existingAnimals.some((a: any) => a.species === 'sheep');
  if (hasGoat && hasSheep) {
    // Both species exist — just ensure plan durations
    await ensurePlanDurationsExist(db, ownerOpenId);
    return;
  }
  if (existingAnimals.length && hasGoat && !hasSheep) {
    // Has goats but no sheep — create Zlata only, then return
    await ensurePlanDurationsExist(db, ownerOpenId);
    const ownerSuffix = ownerOpenId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    try {
      await createAnimalWithMedia({
        ownerOpenId,
        name: "Злата",
        slug: `zlata-${ownerSuffix}`,
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
        media: [{
          animalId: 0,
          kind: "image",
          title: "Образ Златы",
          alt: "Овца Злата на ферме",
          fileKey: "seed/zlata-hero",
          url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
          mimeType: "image/jpeg",
          sortOrder: 0,
          isCover: 1,
        }],
      });
    } catch (err) {
      if (!(err as any)?.message?.includes('Duplicate')) throw err;
    }
    return;
  }
  if (existingAnimals.length) {
    // Has animals but missing goat — just ensure durations
    await ensurePlanDurationsExist(db, ownerOpenId);
    return;
  }

  const ownerSuffix = ownerOpenId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);

  const existingPlans = await db.select({ id: plans.id }).from(plans).where(eq(plans.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPlans.length) {
    const planCode = `core-care-${ownerSuffix}-${Date.now().toString(36)}`;
    const planResult = await db.insert(plans).values({
      ownerOpenId,
      code: planCode,
      name: "Базовая опека",
      description: "Стартовый статус для участия семьи в жизни животного и получения продукции.",
      status: "active",
      basePriceMinor: 45000,
      maxOwnersPerAnimal: 3,
      benefitsSummary: "Доступ к кабинету, клубным обновлениям и базовой продуктовой выдаче.",
    });
    let planId = Number((planResult as { insertId?: number | string }).insertId);
    if (!Number.isFinite(planId) || planId <= 0) {
      // Fallback: drizzle mysql2 may return [ResultSetHeader, FieldPacket[]]
      planId = Number((planResult as any)?.[0]?.insertId);
    }
    if (!Number.isFinite(planId) || planId <= 0) {
      // Final fallback: query by code
      const rows = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, planCode)).limit(1);
      planId = Number(rows[0]?.id);
    }
    if (!Number.isFinite(planId) || planId <= 0) {
      console.warn(`[ensureSprintOneSeed] Could not resolve planId for ${ownerOpenId}, skipping durations`);
      return;
    }

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

  // Create animals — ignore duplicate slug errors (animals may already exist from another owner seed)
  try {
    await createAnimalWithMedia({
      ownerOpenId,
      name: "Марта",
      slug: `marta-${ownerSuffix}`,
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
  } catch (err) {
    // Duplicate slug — animal already exists, continue
    if (!(err as any)?.message?.includes('Duplicate')) throw err;
  }

  try {
    await createAnimalWithMedia({
      ownerOpenId,
      name: "Злата",
      slug: `zlata-${ownerSuffix}`,
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
  } catch (err) {
    // Duplicate slug — animal already exists, continue
    if (!(err as any)?.message?.includes('Duplicate')) throw err;
  }

}

async function ensurePlanDurationsExist(db: any, ownerOpenId: string) {
  const activePlans = await db
    .select({ id: plans.id, basePriceMinor: plans.basePriceMinor })
    .from(plans)
    .where(and(eq(plans.ownerOpenId, ownerOpenId), eq(plans.status, "active")));

  for (const plan of activePlans) {
    if (!Number.isFinite(plan.id) || plan.id <= 0) continue;

    const existingDurations = await db
      .select({ id: planDurations.id })
      .from(planDurations)
      .where(eq(planDurations.planId, plan.id))
      .limit(1);

    if (!existingDurations.length) {
      try {
        const base = plan.basePriceMinor || 45000;
        await db.insert(planDurations).values([
          {
            planId: plan.id,
            months: 1,
            label: "1 месяц",
            priceMinor: base,
            isDefault: 1,
            isActive: 1,
            sortOrder: 0,
          },
          {
            planId: plan.id,
            months: 3,
            label: "3 месяца",
            priceMinor: Math.round(base * 3 * 0.95),
            isDefault: 0,
            isActive: 1,
            sortOrder: 1,
          },
          {
            planId: plan.id,
            months: 12,
            label: "12 месяцев",
            priceMinor: Math.round(base * 12 * 0.89),
            isDefault: 0,
            isActive: 1,
            sortOrder: 2,
          },
        ] as InsertPlanDuration[]);
      } catch (err) {
        // Ignore duplicate key errors — another concurrent call may have inserted durations
        console.warn(`[ensurePlanDurationsExist] Insert failed for planId=${plan.id}, likely race condition:`, (err as Error).message?.slice(0, 120));
      }
    }
  }
}


// ─── Admin Ownership Management ──────────────────────────────────────────────

export async function listAnimalOwnerships(animalId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      id: animalOwnerships.id,
      ownerOpenId: animalOwnerships.ownerOpenId,
      animalId: animalOwnerships.animalId,
      familyId: animalOwnerships.familyId,
      planId: animalOwnerships.planId,
      planDurationId: animalOwnerships.planDurationId,
      slotIndex: animalOwnerships.slotIndex,
      status: animalOwnerships.status,
      startsAt: animalOwnerships.startsAt,
      endsAt: animalOwnerships.endsAt,
      priceMinor: animalOwnerships.priceMinor,
      paidAt: animalOwnerships.paidAt,
      cancelledAt: animalOwnerships.cancelledAt,
      notes: animalOwnerships.notes,
      createdAt: animalOwnerships.createdAt,
      updatedAt: animalOwnerships.updatedAt,
      familyName: families.name,
      planCode: plans.code,
      planName: plans.name,
      durationMonths: planDurations.months,
      durationLabel: planDurations.label,
    })
    .from(animalOwnerships)
    .leftJoin(families, eq(animalOwnerships.familyId, families.id))
    .leftJoin(plans, eq(animalOwnerships.planId, plans.id))
    .leftJoin(planDurations, eq(animalOwnerships.planDurationId, planDurations.id))
    .where(eq(animalOwnerships.animalId, animalId))
    .orderBy(asc(animalOwnerships.slotIndex), desc(animalOwnerships.createdAt));

  return rows;
}

export async function updateOwnershipStatus(
  ownershipId: number,
  newStatus: "active" | "cancelled" | "expired",
  adminOpenId: string,
) {
  const db = await getDb();
  const existing = await db
    .select({ id: animalOwnerships.id, animalId: animalOwnerships.animalId, status: animalOwnerships.status })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.id, ownershipId))
    .limit(1);

  const ownership = existing[0];
  if (!ownership) {
    return null;
  }

  const updateFields: Record<string, unknown> = { status: newStatus };
  if (newStatus === "active" && !ownership.status.includes("active")) {
    updateFields.paidAt = new Date();
  }
  if (newStatus === "cancelled") {
    updateFields.cancelledAt = new Date();
  }

  await db.update(animalOwnerships).set(updateFields).where(eq(animalOwnerships.id, ownershipId));

  // Recalculate animal status after ownership change
  await recalculateAnimalStatus(ownership.animalId);

  return { id: ownershipId, newStatus, animalId: ownership.animalId };
}

export async function buildShareDistribution(animalId: number) {
  const db = await getDb();
  const rows = await db
    .select({
      ownerOpenId: animalOwnerships.ownerOpenId,
      slotIndex: animalOwnerships.slotIndex,
      status: animalOwnerships.status,
      familyName: families.name,
      planName: plans.name,
      durationLabel: planDurations.label,
    })
    .from(animalOwnerships)
    .leftJoin(families, eq(animalOwnerships.familyId, families.id))
    .leftJoin(plans, eq(animalOwnerships.planId, plans.id))
    .leftJoin(planDurations, eq(animalOwnerships.planDurationId, planDurations.id))
    .where(
      and(
        eq(animalOwnerships.animalId, animalId),
        or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment")),
      ),
    )
    .orderBy(asc(animalOwnerships.slotIndex));

  // Group by ownerOpenId
  const grouped = new Map<string, { familyName: string; planLabel: string; slots: number[] }>();
  for (const row of rows) {
    const key = row.ownerOpenId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        familyName: row.familyName ?? "Без имени",
        planLabel: row.durationLabel ?? row.planName ?? "—",
        slots: [],
      });
    }
    grouped.get(key)!.slots.push(row.slotIndex);
  }

  const totalSlots = getStandardizedOwnershipSlots();
  const shareUnitPercent = Math.round(getPercentPerSlot(totalSlots));

  return Array.from(grouped.values()).map((entry) => ({
    familyName: entry.familyName,
    percent: entry.slots.length * shareUnitPercent,
    slots: entry.slots,
    planLabel: entry.planLabel,
  }));
}


/* ───────────────────────────────────────────────
   Product Track — query helpers
   ─────────────────────────────────────────────── */

// ── Admin: Production Profile ──

export async function getProductionProfile(animalId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(animalProductionProfiles).where(eq(animalProductionProfiles.animalId, animalId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertProductionProfile(animalId: number, annualMilkLiters: number, notes?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getProductionProfile(animalId);
  if (existing) {
    await db.update(animalProductionProfiles)
      .set({ annualMilkLiters, notes: notes ?? null })
      .where(eq(animalProductionProfiles.id, existing.id));
    return { ...existing, annualMilkLiters, notes: notes ?? null };
  }

  const [result] = await db.insert(animalProductionProfiles).values({ animalId, annualMilkLiters, notes: notes ?? null });
  return { id: result.insertId, animalId, annualMilkLiters, notes: notes ?? null };
}

// ── Admin: Product Options ──

export async function listProductOptions(animalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productOptions).where(eq(productOptions.animalId, animalId)).orderBy(asc(productOptions.sortOrder));
}

export async function upsertProductOption(input: {
  id?: number;
  animalId: number;
  productType: "milk" | "smetana" | "yogurt" | "kefir" | "cheese";
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  isEnabled?: boolean;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (input.id) {
    await db.update(productOptions).set({
      productType: input.productType,
      label: input.label,
      conversionRatio: input.conversionRatio,
      unit: input.unit,
      maxAnnualUnits: input.maxAnnualUnits,
      isEnabled: input.isEnabled === false ? 0 : 1,
      sortOrder: input.sortOrder ?? 0,
    }).where(and(eq(productOptions.id, input.id), eq(productOptions.animalId, input.animalId)));
    const updated = await db.select().from(productOptions).where(eq(productOptions.id, input.id)).limit(1);
    return updated[0] ?? null;
  }

  const [result] = await db.insert(productOptions).values({
    animalId: input.animalId,
    productType: input.productType,
    label: input.label,
    conversionRatio: input.conversionRatio,
    unit: input.unit,
    maxAnnualUnits: input.maxAnnualUnits,
    isEnabled: input.isEnabled === false ? 0 : 1,
    sortOrder: input.sortOrder ?? 0,
  });
  const created = await db.select().from(productOptions).where(eq(productOptions.id, result.insertId)).limit(1);
  return created[0] ?? null;
}

export async function deleteProductOption(optionId: number, animalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productOptions).where(and(eq(productOptions.id, optionId), eq(productOptions.animalId, animalId)));
  return { success: true };
}

// ── Owner: Product Plan ──

export async function getOwnerProductPlan(ownerOpenId: string, animalId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ownerProductPlans)
    .where(and(eq(ownerProductPlans.ownerOpenId, ownerOpenId), eq(ownerProductPlans.animalId, animalId)))
    .orderBy(desc(ownerProductPlans.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createOwnerProductPlan(input: {
  ownerOpenId: string;
  animalId: number;
  ownershipId: number;
  selectionsJson: string;
  totalMilkUsed: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(ownerProductPlans).values({
    ownerOpenId: input.ownerOpenId,
    animalId: input.animalId,
    ownershipId: input.ownershipId,
    status: "pending_approval",
    selectionsJson: input.selectionsJson,
    totalMilkUsed: input.totalMilkUsed,
    confirmedAt: null,
  });

  const created = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, result.insertId)).limit(1);
  return created[0] ?? null;
}

export async function adminUpdateOwnerProductPlan(planId: number, input: {
  selectionsJson: string;
  totalMilkUsed: number;
  adminNotes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(ownerProductPlans).set({
    status: "modified_by_admin",
    selectionsJson: input.selectionsJson,
    totalMilkUsed: input.totalMilkUsed,
    adminNotes: input.adminNotes ?? null,
  }).where(eq(ownerProductPlans.id, planId));

  const updated = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, planId)).limit(1);
  return updated[0] ?? null;
}

// ── Delivery Schedule ──

export async function generateDeliverySchedule(input: {
  ownerOpenId: string;
  animalId: number;
  ownershipId: number;
  productPlanId: number;
  selections: Array<{ productType: string; label: string; annualUnits: number; unit: string }>;
  year: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing schedule for this plan + year
  await db.delete(deliverySchedule).where(
    and(
      eq(deliverySchedule.productPlanId, input.productPlanId),
      eq(deliverySchedule.year, input.year),
    ),
  );

  // Equal monthly distribution
  const entries: InsertDeliveryScheduleEntry[] = [];
  for (let month = 1; month <= 12; month++) {
    const items = input.selections.map((sel) => ({
      productType: sel.productType,
      label: sel.label,
      quantity: Math.round((sel.annualUnits / 12) * 100) / 100,
      unit: sel.unit,
    }));

    entries.push({
      ownerOpenId: input.ownerOpenId,
      animalId: input.animalId,
      ownershipId: input.ownershipId,
      productPlanId: input.productPlanId,
      month,
      year: input.year,
      itemsJson: JSON.stringify(items),
      status: "planned",
    });
  }

  if (entries.length > 0) {
    await db.insert(deliverySchedule).values(entries);
  }

  return listDeliverySchedule(input.ownerOpenId, input.animalId, input.year);
}

export async function listDeliverySchedule(ownerOpenId: string, animalId: number, year?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(deliverySchedule.ownerOpenId, ownerOpenId),
    eq(deliverySchedule.animalId, animalId),
  ];
  if (year) {
    conditions.push(eq(deliverySchedule.year, year));
  }

  return db.select().from(deliverySchedule)
    .where(and(...conditions))
    .orderBy(asc(deliverySchedule.year), asc(deliverySchedule.month));
}

export async function updateDeliveryStatus(deliveryId: number, status: "planned" | "ready" | "delivered", adminNote?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(deliverySchedule).set({
    status,
    deliveredAt: status === "delivered" ? new Date() : null,
    adminNote: adminNote ?? null,
  }).where(eq(deliverySchedule.id, deliveryId));

  const updated = await db.select().from(deliverySchedule).where(eq(deliverySchedule.id, deliveryId)).limit(1);
  return updated[0] ?? null;
}

// ── Chat Messages ──

export async function listChatMessages(animalId: number, ownerOpenId: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(chatMessages)
    .where(and(eq(chatMessages.animalId, animalId), eq(chatMessages.ownerOpenId, ownerOpenId)))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
}

export async function createChatMessage(input: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(chatMessages).values(input);
  const created = await db.select().from(chatMessages).where(eq(chatMessages.id, result.insertId)).limit(1);
  return created[0] ?? null;
}

export async function markChatMessagesRead(animalId: number, ownerOpenId: string, readerRole: "owner" | "admin") {
  const db = await getDb();
  if (!db) return;

  // Mark messages from the OTHER party as read
  const senderToMark = readerRole === "owner" ? "admin" : "owner";
  await db.update(chatMessages).set({ isRead: 1 }).where(
    and(
      eq(chatMessages.animalId, animalId),
      eq(chatMessages.ownerOpenId, ownerOpenId),
      eq(chatMessages.sender, senderToMark),
      eq(chatMessages.isRead, 0),
    ),
  );
}

export async function countUnreadChatMessages(animalId: number, ownerOpenId: string, forRole: "owner" | "admin") {
  const db = await getDb();
  if (!db) return 0;

  const senderToCount = forRole === "owner" ? "admin" : "owner";
  const rows = await db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(
    and(
      eq(chatMessages.animalId, animalId),
      eq(chatMessages.ownerOpenId, ownerOpenId),
      eq(chatMessages.sender, senderToCount),
      eq(chatMessages.isRead, 0),
    ),
  );
  return rows[0]?.count ?? 0;
}

/** Admin: list all conversations (one per animal+owner pair) with unread counts */
export async function listAdminChatConversations() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({
    animalId: chatMessages.animalId,
    ownerOpenId: chatMessages.ownerOpenId,
    lastMessageAt: sql<Date>`MAX(${chatMessages.createdAt})`,
    totalMessages: sql<number>`COUNT(*)`,
    unreadCount: sql<number>`SUM(CASE WHEN ${chatMessages.sender} = 'owner' AND ${chatMessages.isRead} = 0 THEN 1 ELSE 0 END)`,
  }).from(chatMessages)
    .groupBy(chatMessages.animalId, chatMessages.ownerOpenId)
    .orderBy(desc(sql`MAX(${chatMessages.createdAt})`));

  // Enrich with animal name and owner name
  const enriched = [];
  for (const row of rows) {
    const animalRow = await db.select({ name: animals.name, slug: animals.slug }).from(animals).where(eq(animals.id, row.animalId)).limit(1);
    const userRow = await db.select({ name: users.name }).from(users).where(eq(users.openId, row.ownerOpenId)).limit(1);
    enriched.push({
      animalId: row.animalId,
      animalName: animalRow[0]?.name ?? "—",
      animalSlug: animalRow[0]?.slug ?? "",
      ownerOpenId: row.ownerOpenId,
      ownerName: userRow[0]?.name ?? "Владелец",
      lastMessageAt: row.lastMessageAt,
      totalMessages: row.totalMessages,
      unreadCount: row.unreadCount ?? 0,
    });
  }

  return enriched;
}

// ── Admin: list all owner product plans for an animal ──

export async function listOwnerProductPlansByAnimal(animalId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({
    plan: ownerProductPlans,
    ownerName: users.name,
    ownerEmail: users.email,
    ownerPhone: users.phone,
    ownerPreferredContact: users.preferredContact,
    familyName: families.name,
  })
    .from(ownerProductPlans)
    .leftJoin(users, eq(ownerProductPlans.ownerOpenId, users.openId))
    .leftJoin(animalOwnerships, eq(ownerProductPlans.ownershipId, animalOwnerships.id))
    .leftJoin(families, eq(animalOwnerships.familyId, families.id))
    .where(eq(ownerProductPlans.animalId, animalId))
    .orderBy(desc(ownerProductPlans.createdAt));

  // Enrich each plan with the owner's share percent
  const enriched = [];
  for (const r of rows) {
    const sharePercent = await resolveOwnerSharePercent(r.plan.ownerOpenId, animalId);
    enriched.push({
      ...r.plan,
      ownerName: r.ownerName ?? "Владелец",
      ownerEmail: r.ownerEmail ?? null,
      ownerPhone: r.ownerPhone ?? null,
      ownerPreferredContact: r.ownerPreferredContact ?? null,
      familyName: r.familyName ?? "—",
      sharePercent,
    });
  }
  return enriched;
}

/** Get full product track data for an animal (admin view) */
export async function getAnimalProductTrackData(animalId: number) {
  const [profile, options, ownerPlans] = await Promise.all([
    getProductionProfile(animalId),
    listProductOptions(animalId),
    listOwnerProductPlansByAnimal(animalId),
  ]);

  return { profile, options, ownerPlans };
}

/**
 * Resolve the first active ownership ID for a given owner + animal.
 * Returns the ownership id or null if none found.
 */
export async function resolveOwnershipId(ownerOpenId: string, animalId: number): Promise<number | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: animalOwnerships.id })
    .from(animalOwnerships)
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, ownerOpenId),
        eq(animalOwnerships.animalId, animalId),
        or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment")),
      ),
    )
    .orderBy(asc(animalOwnerships.id))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Resolve owner's share percent for a given animal */
export async function resolveOwnerSharePercent(ownerOpenId: string, animalId: number): Promise<number> {
  const db = await getDb();
  // Count owner's active slots
  const ownerSlots = await db
    .select({ id: animalOwnerships.id })
    .from(animalOwnerships)
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, ownerOpenId),
        eq(animalOwnerships.animalId, animalId),
        eq(animalOwnerships.status, "active"),
      ),
    );
  // Get animal's total slots
  const animalRows = await db
    .select({ totalOwnershipSlots: animals.totalOwnershipSlots })
    .from(animals)
    .where(eq(animals.id, animalId))
    .limit(1);
  const totalSlots = Math.max(1, animalRows[0]?.totalOwnershipSlots ?? 10);
  const percentPerSlot = 100 / totalSlots;
  return Math.min(100, Math.round(ownerSlots.length * percentPerSlot));
}

/** Get a single owner product plan by its ID (admin use) */
export async function getOwnerProductPlanById(planId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, planId)).limit(1);
  return rows[0] ?? null;
}

/** Get animal name by ID (lightweight query for notifications) */
export async function getAnimalNameById(animalId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Животное";
  const rows = await db.select({ name: animals.name }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0]?.name ?? "Животное";
}

/** Reset an owner product plan back to draft status for re-selection */
export async function resetOwnerProductPlan(planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(ownerProductPlans).set({
    status: "draft",
    selectionsJson: "[]",
    totalMilkUsed: 0,
    adminNotes: "Сброшен администратором для повторного выбора",
    confirmedAt: null,
  }).where(eq(ownerProductPlans.id, planId));

  const updated = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, planId)).limit(1);
  return updated[0] ?? null;
}

/** Delete all delivery schedule entries for an owner+animal (used when plan is reset) */
export async function deleteDeliverySchedule(ownerOpenId: string, animalId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(deliverySchedule).where(
    and(
      eq(deliverySchedule.ownerOpenId, ownerOpenId),
      eq(deliverySchedule.animalId, animalId),
    ),
  );
}

/** Log a plan change event for audit trail */
export async function logPlanChange(input: {
  planId: number;
  animalId: number;
  ownerOpenId: string;
  actorId: string;
  action: "created" | "submitted" | "approved" | "modified" | "reset";
  previousStatus: string | null;
  newStatus: string;
  selectionsSnapshot?: string | null;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(planChangeLog).values({
    planId: input.planId,
    animalId: input.animalId,
    ownerOpenId: input.ownerOpenId,
    actorId: input.actorId,
    action: input.action,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    selectionsSnapshot: input.selectionsSnapshot ?? null,
    note: input.note ?? null,
  });
}

/** List plan change log entries for an animal */
export async function listPlanChangeLog(animalId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(planChangeLog)
    .where(eq(planChangeLog.animalId, animalId))
    .orderBy(desc(planChangeLog.createdAt));
}

/** List all plan change log entries (admin view) */
export async function listAllPlanChangeLogs() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(planChangeLog)
    .orderBy(desc(planChangeLog.createdAt));
}

/** Approve a pending plan (admin action) → set status to confirmed */
export async function approveOwnerProductPlan(planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(ownerProductPlans).set({
    status: "confirmed",
    confirmedAt: new Date(),
  }).where(eq(ownerProductPlans.id, planId));

  const updated = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, planId)).limit(1);
  return updated[0] ?? null;
}

/** Submit a plan for approval (owner action) → set status to pending_approval */
export async function submitPlanForApproval(planId: number, selectionsJson: string, totalMilkUsed: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(ownerProductPlans).set({
    status: "pending_approval",
    selectionsJson,
    totalMilkUsed,
  }).where(eq(ownerProductPlans.id, planId));

  const updated = await db.select().from(ownerProductPlans).where(eq(ownerProductPlans.id, planId)).limit(1);
  return updated[0] ?? null;
}

/** Delete chat messages older than the specified number of days */
export async function purgeOldChatMessages(daysOld: number = 30) {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await db.delete(chatMessages).where(
    lt(chatMessages.createdAt, cutoff),
  );
  return result[0]?.affectedRows ?? 0;
}

/** Delete plan change log entries older than the specified number of days */
export async function purgeOldPlanChangeLogs(daysOld: number = 30) {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await db.delete(planChangeLog).where(
    lt(planChangeLog.createdAt, cutoff),
  );
  return result[0]?.affectedRows ?? 0;
}

/** Clear all chat messages for a specific animal (admin manual cleanup) */
export async function clearChatMessagesByAnimal(animalId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.delete(chatMessages).where(
    eq(chatMessages.animalId, animalId),
  );
  return result[0]?.affectedRows ?? 0;
}

/** Clear all plan change log entries for a specific animal (admin manual cleanup) */
export async function clearPlanChangeLogByAnimal(animalId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.delete(planChangeLog).where(
    eq(planChangeLog.animalId, animalId),
  );
  return result[0]?.affectedRows ?? 0;
}

// ─── Onboarding ─────────────────────────────────────────────────────────────
export async function completeUserOnboarding(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.openId, openId));
}


// ─── User Funnel Analytics ───────────────────────────────────────────────────

export async function getUserFunnelAnalytics() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, pendingPayment: 0, activeOwners: 0, withPlans: 0, recentUsers: [] };

  // Total registered users
  const totalUsersRows = await db.select({ count: sql<number>`count(*)` }).from(users);
  const totalUsers = Number(totalUsersRows[0]?.count ?? 0);

  // Pending payment ownerships (unique users)
  const pendingRows = await db
    .select({ count: sql<number>`count(distinct ${animalOwnerships.ownerOpenId})` })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.status, "pending_payment"));
  const pendingPayment = Number(pendingRows[0]?.count ?? 0);

  // Active ownerships (unique users)
  const activeRows = await db
    .select({ count: sql<number>`count(distinct ${animalOwnerships.ownerOpenId})` })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.status, "active"));
  const activeOwners = Number(activeRows[0]?.count ?? 0);

  // Users with confirmed product plans
  const planRows = await db
    .select({ count: sql<number>`count(distinct ${ownerProductPlans.ownerOpenId})` })
    .from(ownerProductPlans)
    .where(eq(ownerProductPlans.status, "confirmed"));
  const withPlans = Number(planRows[0]?.count ?? 0);

  // Recent users (last 20)
  const recentUsers = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      preferredContact: users.preferredContact,
      role: users.role,
      plainPassword: users.plainPassword,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(20);

  return { totalUsers, pendingPayment, activeOwners, withPlans, recentUsers };
}

export async function getPendingApplicationsCount() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(animalOwnerships)
    .where(eq(animalOwnerships.status, "pending_payment"));
  return Number(rows[0]?.count ?? 0);
}

// ─── User Profile Helpers ──────────────────────────────────────────────────

export async function getUserProfile(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ email: users.email, phone: users.phone, preferredContact: users.preferredContact })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateUserProfile(
  openId: string,
  data: { email: string | null; phone: string | null; preferredContact?: string | null },
) {
  const db = await getDb();
  if (!db) return;
  const setData: Record<string, unknown> = { email: data.email, phone: data.phone };
  if (data.preferredContact !== undefined) {
    setData.preferredContact = data.preferredContact;
  }
  await db
    .update(users)
    .set(setData)
    .where(eq(users.openId, openId));
}

// ─── Admin: List Users with Pagination, Search & Filters ─────────────────────

export type ListUsersParams = {
  page: number;
  pageSize: number;
  search?: string;
  role?: "user" | "admin";
  loginMethod?: string;
  hasBitrix?: boolean;
  hasPassword?: boolean;
  sortBy?: "createdAt" | "name" | "email" | "lastSignedIn";
  sortOrder?: "asc" | "desc";
};

export async function listUsersAdmin(params: ListUsersParams) {
  const db = await getDb();
  if (!db) return { users: [], total: 0, page: params.page, pageSize: params.pageSize, totalPages: 0 };

  const conditions: ReturnType<typeof eq>[] = [];

  // Search filter: match name, email, or phone
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      or(
        like(users.name, term),
        like(users.email, term),
        like(users.phone, term),
      )!,
    );
  }

  // Role filter
  if (params.role) {
    conditions.push(eq(users.role, params.role));
  }

  // Login method filter
  if (params.loginMethod) {
    conditions.push(eq(users.loginMethod, params.loginMethod));
  }

  // Bitrix linked filter
  if (params.hasBitrix === true) {
    conditions.push(isNotNull(users.bitrix24ContactId));
  } else if (params.hasBitrix === false) {
    conditions.push(isNull(users.bitrix24ContactId));
  }

  // Has password filter
  if (params.hasPassword === true) {
    conditions.push(isNotNull(users.passwordHash));
  } else if (params.hasPassword === false) {
    conditions.push(isNull(users.passwordHash));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);
  const total = Number(countRows[0]?.count ?? 0);

  // Sort
  const sortColumn = {
    createdAt: users.createdAt,
    name: users.name,
    email: users.email,
    lastSignedIn: users.lastSignedIn,
  }[params.sortBy ?? "createdAt"];
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  // Fetch page
  const offset = (params.page - 1) * params.pageSize;
  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      preferredContact: users.preferredContact,
      role: users.role,
      plainPassword: users.plainPassword,
      loginMethod: users.loginMethod,
      bitrix24ContactId: users.bitrix24ContactId,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(params.pageSize)
    .offset(offset);

  const totalPages = Math.ceil(total / params.pageSize);

  return { users: rows, total, page: params.page, pageSize: params.pageSize, totalPages };
}
