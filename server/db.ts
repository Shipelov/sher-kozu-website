import { and, asc, desc, eq, gte, isNotNull, isNull, like, lt, lte, ne, or, sql } from "drizzle-orm";
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
  walletTransactions,
  otpCodes,
  passwordResetTokens,
  authRateLimits,
  userNotifications,
  notificationPreferences,
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

  // Resolve actual animal slugs for this owner — skip experience seed if no animals exist
  const ownerAnimals = await db.select({ slug: animals.slug, name: animals.name }).from(animals).where(eq(animals.ownerOpenId, ownerOpenId)).orderBy(animals.sortOrder).limit(2);
  if (!ownerAnimals.length) {
    seededOwners.add(ownerOpenId);
    return;
  }
  const slugA = ownerAnimals[0]!.slug;
  const slugB = ownerAnimals[1]?.slug ?? ownerAnimals[0]!.slug;
  const nameA = ownerAnimals[0]!.name;
  const nameB = ownerAnimals[1]?.name ?? ownerAnimals[0]!.name;

  const existingBatch = await db.select({ id: productBatches.id }).from(productBatches).where(eq(productBatches.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingBatch.length) {
    await db.insert(productBatches).values([
      {
        animalSlug: slugA,
        ownerOpenId,
        productName: `Именной набор — ${nameA}`,
        productType: "Молоко и свежий сыр",
        stage: "К созреванию и упаковке",
        routeLabel: "Надой → анализ → сыроварня → упаковка",
        detail: "Утренний надой уже прошёл лабораторный контроль и ушёл в сыроварню для свежего семейного набора.",
        badge: "Прозрачный маршрут",
        batchCode: `${slugA.slice(0,3).toUpperCase()}-2403-A`,
        producedAt: new Date("2026-03-12T07:30:00Z"),
        deliveryWindow: "Доставка 15–16 марта",
        sortOrder: 0,
      },
      {
        animalSlug: slugA,
        ownerOpenId,
        productName: `Сырная партия — ${nameA}`,
        productType: "Полутвёрдый сыр",
        stage: "Созревание",
        routeLabel: "Надой → созревание → маркировка",
        detail: "Партия выдерживается в камере созревания и будет готова к клубному набору следующей недели.",
        badge: "Семейная сыроварня",
        batchCode: `${slugA.slice(0,3).toUpperCase()}-2403-B`,
        producedAt: new Date("2026-03-10T09:10:00Z"),
        deliveryWindow: "Отгрузка 20 марта",
        sortOrder: 1,
      },
      {
        animalSlug: slugB,
        ownerOpenId,
        productName: `Набор ${nameB} для завтрака`,
        productType: "Йогурт и мягкий сыр",
        stage: "Упаковка",
        routeLabel: "Надой → ферментация → упаковка",
        detail: "Нежный йогурт и мягкий сыр уже фасуются для утренней доставки подписчикам фермы.",
        badge: "Лёгкий формат",
        batchCode: `${slugB.slice(0,3).toUpperCase()}-2403-A`,
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
        title: `Клубный набор — ${nameA}`,
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
        title: `Завтрак от ${nameB}`,
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
        text: `У ${nameA} и ${nameB} сегодня особенно мягкое молоко — запускаем малую партию свежего сыра для клубного ужина выходного дня.`,
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
        role: `владелица ${nameA}`,
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
        animal: nameA,
        sinceLabel: "с ноября 2025",
        badge: "семейный круг",
        sortOrder: 0,
      },
      {
        ownerOpenId,
        name: "Тимур",
        animal: nameB,
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
      connectionLimit: 20,
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
    // Auto-create wallet for every registered user
    const { ensureWallet } = await import("./gamification");
    await ensureWallet(saved.openId);
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
    // Auto-create wallet on login if missing
    const { ensureWallet } = await import("./gamification");
    await ensureWallet(user.openId);
  }
  return user;
}

export async function listAnimalPhotos(animalSlug: string, callerOpenId?: string) {
  const db = await getDb();
  if (!db) return [];

  try {
    const isAdmin = callerOpenId === ENV.ownerOpenId;

    // Admin sees all photos (including pending and rejected)
    // Regular users see: approved photos + their own pending photos
    const items = await db
      .select()
      .from(animalPhotos)
      .where(eq(animalPhotos.animalSlug, animalSlug))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    if (isAdmin) {
      return items;
    }

    // Filter for regular users: approved OR own pending
    return items.filter((item: any) => {
      if (item.moderationStatus === "approved") return true;
      if (item.moderationStatus === "pending" && item.ownerOpenId === callerOpenId) return true;
      return false;
    });
  } catch (error) {
    console.error("[Database] Failed to list animal photos:", error);
    throw error;
  }
}

/**
 * Get photo upload limit for a user on a specific animal.
 * - Admin: 1 photo (cover)
 * - User: number of active ownership slots (max 10)
 * Returns { limit, used, remaining }
 */
export async function getPhotoUploadLimit(animalSlug: string, callerOpenId: string) {
  const db = await getDb();
  if (!db) return { limit: 0, used: 0, remaining: 0, isAdmin: false };

  const isAdmin = callerOpenId === ENV.ownerOpenId;

  // Count existing photos by this user for this animal (exclude rejected)
  const userPhotos = await db
    .select({ id: animalPhotos.id })
    .from(animalPhotos)
    .where(
      and(
        eq(animalPhotos.animalSlug, animalSlug),
        eq(animalPhotos.ownerOpenId, callerOpenId),
        ne(animalPhotos.moderationStatus, "rejected"),
      ),
    );
  const used = userPhotos.length;

  if (isAdmin) {
    // Admin can upload 1 cover photo per animal
    return { limit: 1, used, remaining: Math.max(0, 1 - used), isAdmin: true };
  }

  // Get animal id from slug
  const animalRows = await db
    .select({ id: animals.id })
    .from(animals)
    .where(eq(animals.slug, animalSlug))
    .limit(1);
  const animalId = animalRows[0]?.id;
  if (!animalId) return { limit: 0, used, remaining: 0, isAdmin: false };

  // Count user's active ownership slots for this animal
  const ownerSlots = await db
    .select({ id: animalOwnerships.id })
    .from(animalOwnerships)
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, callerOpenId),
        eq(animalOwnerships.animalId, animalId),
        or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment")),
      ),
    );

  const slotsCount = ownerSlots.length;
  // Limit = number of slots, capped at 10
  const limit = Math.min(10, slotsCount);

  return { limit, used, remaining: Math.max(0, limit - used), isAdmin: false };
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

  // If this photo is a cover, sync coverImageUrl on the animals table
  if (created[0].isCover && created[0].url) {
    const animalRow = await db
      .select({ id: animals.id })
      .from(animals)
      .where(eq(animals.slug, input.animalSlug))
      .limit(1);
    if (animalRow[0]) {
      await db
        .update(animals)
        .set({ coverImageUrl: created[0].url, updatedAt: new Date() })
        .where(eq(animals.id, animalRow[0].id));
    }
  }

  return created[0];
}

export async function deleteAnimalPhoto(photoId: number, callerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo deletion");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.id, photoId))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  const isAdmin = callerOpenId === ENV.ownerOpenId;
  const isCover = Boolean(existing[0].isCover);
  const isAdminPhoto = existing[0].ownerOpenId === ENV.ownerOpenId;

  // Non-admin users cannot delete admin-uploaded cover photos
  if (!isAdmin && isCover && isAdminPhoto) {
    throw new Error("Это фото установлено администратором как обложка и не может быть удалено.");
  }

  // Non-admin users can only delete their own photos
  if (!isAdmin && existing[0].ownerOpenId !== callerOpenId) {
    throw new Error("Вы можете удалять только свои фото.");
  }

  await db.delete(animalPhotos).where(eq(animalPhotos.id, photoId));

  if (isCover) {
    const fallback = await db
      .select()
      .from(animalPhotos)
      .where(and(eq(animalPhotos.animalSlug, existing[0].animalSlug), eq(animalPhotos.moderationStatus, "approved")))
      .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));

    if (fallback[0]) {
      await db.update(animalPhotos).set({ isCover: 1 }).where(eq(animalPhotos.id, fallback[0].id));
      // Sync coverImageUrl on the animals table
      const animalRow = await db
        .select({ id: animals.id })
        .from(animals)
        .where(eq(animals.slug, existing[0].animalSlug))
        .limit(1);
      if (animalRow[0] && fallback[0].url) {
        await db
          .update(animals)
          .set({ coverImageUrl: fallback[0].url, updatedAt: new Date() })
          .where(eq(animals.id, animalRow[0].id));
      }
    } else {
      // No fallback photo — clear coverImageUrl
      const animalRow = await db
        .select({ id: animals.id })
        .from(animals)
        .where(eq(animals.slug, existing[0].animalSlug))
        .limit(1);
      if (animalRow[0]) {
        await db
          .update(animals)
          .set({ coverImageUrl: null, updatedAt: new Date() })
          .where(eq(animals.id, animalRow[0].id));
      }
    }
  }

  return existing[0];
}

export async function setAnimalPhotoCover(photoId: number, callerOpenId?: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for setting photo cover");
  }

  const isAdmin = callerOpenId === ENV.ownerOpenId;

  // Only admin can change the cover photo
  if (!isAdmin) {
    throw new Error("Только администратор может менять обложку животного.");
  }

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

  // Also update coverImageUrl on the animals table so the avatar/card reflects the new cover
  const animalRow = await db
    .select({ id: animals.id })
    .from(animals)
    .where(eq(animals.slug, target[0].animalSlug))
    .limit(1);
  if (animalRow[0] && target[0].url) {
    await db
      .update(animals)
      .set({ coverImageUrl: target[0].url, updatedAt: new Date() })
      .where(eq(animals.id, animalRow[0].id));
  }

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
    .where(eq(animalPhotos.id, input.photoId))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  const isAdmin = input.ownerOpenId === ENV.ownerOpenId;
  const isAdminCover = Boolean(existing[0].isCover) && existing[0].ownerOpenId === ENV.ownerOpenId;

  // Non-admin users cannot edit admin-cover photos
  if (!isAdmin && isAdminCover) {
    throw new Error("Это фото установлено администратором как обложка и не может быть отредактировано.");
  }

  // Non-admin users can only edit their own photos
  if (!isAdmin && existing[0].ownerOpenId !== input.ownerOpenId) {
    throw new Error("Вы можете редактировать только свои фото.");
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

export async function moderateAnimalPhoto(input: {
  photoId: number;
  moderatorOpenId: string;
  action: "approve" | "reject";
  rejectionReason?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for photo moderation");
  }

  const isAdmin = input.moderatorOpenId === ENV.ownerOpenId;
  if (!isAdmin) {
    throw new Error("Только администратор может модерировать фото.");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.id, input.photoId))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  const newStatus = input.action === "approve" ? "approved" : "rejected";

  await db
    .update(animalPhotos)
    .set({
      moderationStatus: newStatus as any,
      moderatedBy: input.moderatorOpenId,
      moderatedAt: new Date(),
      rejectionReason: input.action === "reject" ? (input.rejectionReason || null) : null,
    })
    .where(eq(animalPhotos.id, input.photoId));

  const updated = await db.select().from(animalPhotos).where(eq(animalPhotos.id, input.photoId)).limit(1);
  const photo = updated[0];

  // Send in-app notification to the photo uploader
  if (photo && photo.ownerOpenId && photo.ownerOpenId !== input.moderatorOpenId) {
    const animalSlug = photo.animalSlug;
    if (input.action === "approve") {
      await createUserNotification({
        userOpenId: photo.ownerOpenId,
        type: "photo_approved",
        title: "\u0424\u043e\u0442\u043e \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u043e \u2705",
        body: `\u0412\u0430\u0448\u0435 \u0444\u043e\u0442\u043e \u00ab${photo.title || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"}\u00bb \u043f\u0440\u043e\u0448\u043b\u043e \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044e \u0438 \u0442\u0435\u043f\u0435\u0440\u044c \u0432\u0438\u0434\u043d\u043e \u0432 \u0433\u0430\u043b\u0435\u0440\u0435\u0435.`,
        link: `/animals/${animalSlug}`,
      });
    } else {
      const reason = input.rejectionReason ? ` \u041f\u0440\u0438\u0447\u0438\u043d\u0430: ${input.rejectionReason}` : "";
      await createUserNotification({
        userOpenId: photo.ownerOpenId,
        type: "photo_rejected",
        title: "\u0424\u043e\u0442\u043e \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e \u274c",
        body: `\u0412\u0430\u0448\u0435 \u0444\u043e\u0442\u043e \u00ab${photo.title || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"}\u00bb \u043d\u0435 \u043f\u0440\u043e\u0448\u043b\u043e \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044e.${reason}`,
        link: `/animals/${animalSlug}`,
      });
    }
  }

  return photo ?? null;
}

export async function listPendingPhotos(moderatorOpenId: string) {
  const db = await getDb();
  if (!db) return [];

  const isAdmin = moderatorOpenId === ENV.ownerOpenId;
  if (!isAdmin) return [];

  try {
    const items = await db
      .select({
        id: animalPhotos.id,
        animalSlug: animalPhotos.animalSlug,
        ownerOpenId: animalPhotos.ownerOpenId,
        title: animalPhotos.title,
        meta: animalPhotos.meta,
        url: animalPhotos.url,
        mimeType: animalPhotos.mimeType,
        sizeBytes: animalPhotos.sizeBytes,
        moderationStatus: animalPhotos.moderationStatus,
        createdAt: animalPhotos.createdAt,
      })
      .from(animalPhotos)
      .where(eq(animalPhotos.moderationStatus, "pending" as any))
      .orderBy(asc(animalPhotos.createdAt));

    // Enrich with uploader name
    const enriched = await Promise.all(
      items.map(async (item: any) => {
        const user = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.openId, item.ownerOpenId))
          .limit(1);
        return {
          ...item,
          uploaderName: user[0]?.name || "Неизвестный",
        };
      }),
    );

    return enriched;
  } catch (error) {
    console.error("[Database] Failed to list pending photos:", error);
    throw error;
  }
}

export async function countPendingPhotos(moderatorOpenId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const isAdmin = moderatorOpenId === ENV.ownerOpenId;
  if (!isAdmin) return 0;

  try {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(animalPhotos)
      .where(eq(animalPhotos.moderationStatus, "pending" as any));
    return Number(result[0]?.count ?? 0);
  } catch (error) {
    console.error("[Database] Failed to count pending photos:", error);
    return 0;
  }
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

  // Respect user's explicit primary animal preference
  const userRow = await db.select({ primaryAnimalId: users.primaryAnimalId }).from(users).where(eq(users.openId, ownerOpenId)).limit(1);
  const preferredAnimalId = userRow[0]?.primaryAnimalId ?? null;
  let primaryOwnershipGroup = sortedGroups[0] ?? null;
  if (preferredAnimalId && groupedByAnimal.has(preferredAnimalId)) {
    primaryOwnershipGroup = groupedByAnimal.get(preferredAnimalId)!;
  }
  const primaryOwnership = primaryOwnershipGroup?.[0] ?? null;

  // Build allOwnerships — one entry per animal the owner has booked/paid
  // Resolve cover images for all owned animals using the same chain as enrichAnimalWithShareMetrics
  const allOwnerships = await Promise.all(sortedGroups.map(async (group) => {
    const first = group[0];
    const slotsCount = group.length;
    const totalSlots = normalizeOwnershipSlots(first.totalOwnershipSlots ?? 10);
    const sharePercent = slotsCount * Math.round(getPercentPerSlot(totalSlots));
    const hasPending = group.some((item: any) => item.status === "pending_payment");
    const hasActive = group.some((item: any) => item.status === "active");

    // Resolve cover: animalMedia cover → animalPhotos cover → first photo → animal.coverImageUrl
    let resolvedCover = first.coverImageUrl;
    if (!resolvedCover || resolvedCover === "NULL") {
      resolvedCover = null;
    }
    // Check animalMedia for cover
    const mediaCover = await db
      .select({ url: animalMedia.url })
      .from(animalMedia)
      .where(and(eq(animalMedia.animalId, first.animalId), eq(animalMedia.isCover, 1)))
      .limit(1);
    if (mediaCover[0]?.url) {
      resolvedCover = mediaCover[0].url;
    } else {
      // Check animalPhotos for cover (only approved)
      const photoCover = await db
        .select({ url: animalPhotos.url })
        .from(animalPhotos)
        .where(and(eq(animalPhotos.animalSlug, first.animalSlug), eq(animalPhotos.isCover, 1), eq(animalPhotos.moderationStatus, "approved")))
        .limit(1);
      if (photoCover[0]?.url) {
        resolvedCover = photoCover[0].url;
      } else {
        // Fallback to first approved photo
        const firstPhoto = await db
          .select({ url: animalPhotos.url })
          .from(animalPhotos)
          .where(and(eq(animalPhotos.animalSlug, first.animalSlug), eq(animalPhotos.moderationStatus, "approved")))
          .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt))
          .limit(1);
        if (firstPhoto[0]?.url) {
          resolvedCover = firstPhoto[0].url;
        }
      }
    }

    return {
      animalId: first.animalId,
      animalSlug: first.animalSlug,
      animalName: first.animalName,
      species: first.species,
      breed: first.breed,
      coverImageUrl: resolvedCover,
      sharePercent,
      slotsCount,
      status: hasPending ? "pending_payment" as const : "active" as const,
      statusLabel: hasPending ? "Ожидает подтверждения" : hasActive ? "Активное участие" : "Без активного участия",
      startsAt: first.startsAt,
      endsAt: first.endsAt,
      priceMinorTotal: group.reduce((sum: number, item: any) => sum + Number(item.priceMinor ?? 0), 0),
      slotIndexes: group.map((item: any) => item.slotIndex).sort((a: number, b: number) => a - b),
    };
  }));
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
    allOwnerships: allOwnerships.map((o) => ({
      ...o,
      isPrimary: primaryOwnership ? o.animalId === primaryOwnership.animalId : false,
    })),
    primaryAnimalId: preferredAnimalId,
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
    // Composition & metrics are per-animal (admin-managed), not per-owner
    db
      .select()
      .from(productCompositionSnapshots)
      .where(eq(productCompositionSnapshots.animalSlug, animalSlug))
      .orderBy(asc(productCompositionSnapshots.sortOrder)),
    db
      .select()
      .from(productMonthlyMetrics)
      .where(eq(productMonthlyMetrics.animalSlug, animalSlug))
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
  const post = created[0] ?? null;

  // Notify all active users about the new club post
  if (post) {
    try {
      await notifyAllActiveUsers({
        type: "club_post",
        title: `Новый пост в клубе 📝`,
        body: `${post.author}: ${post.title}`,
        link: "/club",
        excludeOpenId: input.ownerOpenId,
      });
    } catch (e) {
      console.error("[Notifications] Failed to notify about new club post:", e);
    }
  }

  return post;
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
  const event = created[0] ?? null;

  // Notify all active users about the new club event
  if (event) {
    try {
      await notifyAllActiveUsers({
        type: "club_event",
        title: `Новое событие в клубе 🎉`,
        body: `${event.title} — ${event.dateLabel}`,
        link: "/club",
        excludeOpenId: input.ownerOpenId,
      });
    } catch (e) {
      console.error("[Notifications] Failed to notify about new club event:", e);
    }
  }

  return event;
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
  // Single query: fetch all ownership rows with JOINs (replaces 4 separate queries)
  const ownershipRows = await db
    .select({
      ownerOpenId: animalOwnerships.ownerOpenId,
      slotIndex: animalOwnerships.slotIndex,
      status: animalOwnerships.status,
      endsAt: animalOwnerships.endsAt,
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
        eq(animalOwnerships.animalId, animal.id),
        or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment")),
      ),
    )
    .orderBy(asc(animalOwnerships.slotIndex));

  // Derive all metrics from the single result set
  const activeOwnerships = ownershipRows.length;
  const pendingOwnerships = ownershipRows.filter((r: any) => r.status === "pending_payment").length;
  const occupiedUntil = ownershipRows.reduce((max: Date | null, r: any) => {
    if (!r.endsAt) return max;
    return !max || new Date(r.endsAt) > new Date(max) ? r.endsAt : max;
  }, null);

  // Build share distribution from the same rows
  const grouped = new Map<string, { familyName: string; planLabel: string; slots: number[] }>();
  for (const row of ownershipRows) {
    const key = row.ownerOpenId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        familyName: row.familyName ?? "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438",
        planLabel: row.durationLabel ?? row.planName ?? "\u2014",
        slots: [],
      });
    }
    grouped.get(key)!.slots.push(row.slotIndex);
  }
  const totalSlots = getStandardizedOwnershipSlots();
  const shareUnitPercent = Math.round(getPercentPerSlot(totalSlots));
  const shareDistribution = Array.from(grouped.values()).map((entry) => ({
    familyName: entry.familyName,
    percent: entry.slots.length * shareUnitPercent,
    slots: entry.slots,
    planLabel: entry.planLabel,
  }));

  // Media query (still separate — different table)
  const media = await db
    .select()
    .from(animalMedia)
    .where(eq(animalMedia.animalId, animal.id))
    .orderBy(desc(animalMedia.isCover), asc(animalMedia.sortOrder), asc(animalMedia.id));

  // Also check animalPhotos for cover (gallery photos uploaded by admin/user — only approved)
  const photoCover = await db
    .select({ url: animalPhotos.url })
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animal.slug), eq(animalPhotos.isCover, 1), eq(animalPhotos.moderationStatus, "approved")))
    .limit(1);

  // First approved photo fallback if no explicit cover
  const firstPhoto = photoCover[0]
    ? null
    : (await db
        .select({ url: animalPhotos.url })
        .from(animalPhotos)
        .where(and(eq(animalPhotos.animalSlug, animal.slug), eq(animalPhotos.moderationStatus, "approved")))
        .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt))
        .limit(1))[0] ?? null;

  const shareMetrics = buildAnimalShareMetrics(animal, activeOwnerships);
  const occupiedValueMinor = shareDistribution.reduce(
    (sum, entry) => sum + getSharePriceMinor(animal.baseMonthlyPriceMinor, entry.percent),
    0,
  );

  // Resolve cover: animalMedia cover → animalPhotos cover → first photo → animal.coverImageUrl
  const resolvedCover =
    media.find((item: any) => item.isCover)?.url
    ?? photoCover[0]?.url
    ?? firstPhoto?.url
    ?? (animal.coverImageUrl && animal.coverImageUrl !== "NULL" ? animal.coverImageUrl : null);

  return {
    ...animal,
    ...shareMetrics,
    pendingOwnerships,
    occupiedUntil,
    occupiedValueMinor,
    shareDistribution,
    ownersCount: shareDistribution.length,
    coverImageUrl: resolvedCover,
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

  const results = [];
  for (const animal of rows) {
    results.push(await enrichAnimalWithShareMetrics(db, animal));
  }
  return results;
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

  const results = [];
  for (const animal of rows) {
    results.push(await enrichAnimalWithShareMetrics(db, animal));
  }
  return results;
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

  // Ensure plan and durations exist for the owner (no demo animals are created)
  await ensurePlanDurationsExist(db, ownerOpenId);

  const existingPlans = await db.select({ id: plans.id }).from(plans).where(eq(plans.ownerOpenId, ownerOpenId)).limit(1);
  if (!existingPlans.length) {
    const ownerSuffix = ownerOpenId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
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
lastLogin?: "today" | "week" | "month" | "inactive" | "never";
  sortBy?: "createdAt" | "name" | "email" | "lastSignedIn";
  sortOrder?: "asc" | "desc";
};

export async function listUsersAdmin(params: ListUsersParams) {
  const db = await getDb();
  if (!db) return { users: [], total: 0, page: params.page, pageSize: params.pageSize, totalPages: 0 };

  const conditions: ReturnType<typeof eq>[] = [];

  // Exclude soft-deleted users from active list
  conditions.push(isNull(users.deletedAt));

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

  // Has password filter else
  // Last login filter
  if (params.lastLogin) {
    const now = new Date();
    if (params.lastLogin === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      conditions.push(gte(users.lastSignedIn, startOfDay));
    } else if (params.lastLogin === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      conditions.push(gte(users.lastSignedIn, weekAgo));
    } else if (params.lastLogin === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      conditions.push(gte(users.lastSignedIn, monthAgo));
    } else if (params.lastLogin === "inactive") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      conditions.push(
        and(
          isNotNull(users.lastSignedIn),
          lte(users.lastSignedIn, monthAgo),
        )!,
      );
    } else if (params.lastLogin === "never") {
      conditions.push(isNull(users.lastSignedIn));
    }
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
      loginMethod: users.loginMethod,
      bitrix24ContactId: users.bitrix24ContactId,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
      walletStatus: wallets.status,
      walletBalance: wallets.balanceMinor,
    })
    .from(users)
    .leftJoin(wallets, eq(users.openId, wallets.ownerOpenId))
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(params.pageSize)
    .offset(offset);

  const totalPages = Math.ceil(total / params.pageSize);

  return { users: rows, total, page: params.page, pageSize: params.pageSize, totalPages };
}

/**
 * Export all users matching current filters (no pagination) for CSV/Excel export.
 */
export async function exportUsersAdmin(params: Omit<ListUsersParams, "page" | "pageSize">) {
  const db = await getDb();
  if (!db) return [];

  const conditions: ReturnType<typeof eq>[] = [];

  // Exclude soft-deleted users from export
  conditions.push(isNull(users.deletedAt));

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

  if (params.role) {
    conditions.push(eq(users.role, params.role));
  }

  if (params.loginMethod) {
    conditions.push(eq(users.loginMethod, params.loginMethod));
  }

  if (params.hasBitrix === true) {
    conditions.push(isNotNull(users.bitrix24ContactId));
  } else if (params.hasBitrix === false) {
    conditions.push(isNull(users.bitrix24ContactId));
  } else
  // Last login filter
  if (params.lastLogin) {
    const now = new Date();
    if (params.lastLogin === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      conditions.push(gte(users.lastSignedIn, startOfDay));
    } else if (params.lastLogin === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      conditions.push(gte(users.lastSignedIn, weekAgo));
    } else if (params.lastLogin === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      conditions.push(gte(users.lastSignedIn, monthAgo));
    } else if (params.lastLogin === "inactive") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      conditions.push(
        and(
          isNotNull(users.lastSignedIn),
          lte(users.lastSignedIn, monthAgo),
        )!,
      );
    } else if (params.lastLogin === "never") {
      conditions.push(isNull(users.lastSignedIn));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    createdAt: users.createdAt,
    name: users.name,
    email: users.email,
    lastSignedIn: users.lastSignedIn,
  }[params.sortBy ?? "createdAt"];
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      preferredContact: users.preferredContact,
      role: users.role,
      loginMethod: users.loginMethod,
      bitrix24ContactId: users.bitrix24ContactId,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(whereClause)
    .orderBy(orderFn(sortColumn));

  return rows;
}

// ─── Trash / Soft-Delete ─────────────────────────────────────────────────────

/**
 * Soft-delete a user: set deletedAt + deletedBy. Does NOT remove data.
 */
export async function softDeleteUser(userId: number, adminOpenId: string) {
  const db = await getDb();
  await db
    .update(users)
    .set({ deletedAt: new Date(), deletedBy: adminOpenId })
    .where(eq(users.id, userId));
}

/**
 * Restore a user from trash: clear deletedAt + deletedBy.
 */
export async function restoreUser(userId: number) {
  const db = await getDb();
  await db
    .update(users)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(users.id, userId));
}

/**
 * List users currently in trash (deletedAt IS NOT NULL).
 */
export async function listTrashedUsers() {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      loginMethod: users.loginMethod,
      bitrix24ContactId: users.bitrix24ContactId,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
      deletedBy: users.deletedBy,
    })
    .from(users)
    .where(isNotNull(users.deletedAt))
    .orderBy(desc(users.deletedAt));
  return rows;
}

/**
 * Permanently delete a user and all associated data.
 * Returns the user's active ownership animalIds so the caller can
 * update animal availability.
 */
export async function permanentDeleteUser(userId: number) {
  const db = await getDb();

  // 1. Look up the user to get openId
  const [user] = await db
    .select({ openId: users.openId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { deletedOwnerships: [] };

  const openId = user.openId;

  // 2. Find active ownerships to return to farm
  const activeOwnerships = await db
    .select({
      id: animalOwnerships.id,
      animalId: animalOwnerships.animalId,
      status: animalOwnerships.status,
    })
    .from(animalOwnerships)
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, openId),
        eq(animalOwnerships.status, "active")
      )
    );

  // 3. Cancel active ownerships (return shares to farm)
  if (activeOwnerships.length > 0) {
    await db
      .update(animalOwnerships)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
        and(
          eq(animalOwnerships.ownerOpenId, openId),
          eq(animalOwnerships.status, "active")
        )
      );
  }

  // 4. Delete all user-related data from dependent tables
  const tablesToClean = [
    walletTransactions,
    wallets,
    ownerProductPlans,
    deliverySchedule,
    chatMessages,
    clubMembers,
    productDeliveries,
    partnerLeads,
    integrationAudits,
    planChangeLog,
  ];

  for (const table of tablesToClean) {
    await db.delete(table).where(eq((table as any).ownerOpenId, openId));
  }

  // 5. Delete OTP codes and password reset tokens by email
  const [userData] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userData?.email) {
    await db.delete(otpCodes).where(eq(otpCodes.target, userData.email));
  }
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userOpenId, openId));

  // 6. Delete the user record itself
  await db.delete(users).where(eq(users.id, userId));

  return {
    deletedOwnerships: activeOwnerships.map((o: { id: number; animalId: number; status: string }) => ({
      animalId: o.animalId,
      ownershipId: o.id,
    })),
  };
}

/**
 * Find users in trash older than the given number of days.
 */
export async function findExpiredTrashedUsers(days: number = 30) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: users.id, openId: users.openId, name: users.name, deletedAt: users.deletedAt })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lte(users.deletedAt, cutoff)
      )
    );
  return rows;
}


/* ───────────────────────────────────────────────
   Admin: Get full user details with all related data
   ─────────────────────────────────────────────── */

export async function getUserDetailsAdmin(userOpenId: string) {
  const db = await getDb();

  // 1. User profile
  const [user] = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      preferredContact: users.preferredContact,
      bitrix24ContactId: users.bitrix24ContactId,
      loginMethod: users.loginMethod,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
      onboardingCompleted: users.onboardingCompleted,
      deletedAt: users.deletedAt,
      deletedBy: users.deletedBy,
    })
    .from(users)
    .where(eq(users.openId, userOpenId))
    .limit(1);

  if (!user) return null;

  // 2. Animal ownerships with animal info
  const ownershipsRaw = await db
    .select({
      id: animalOwnerships.id,
      animalId: animalOwnerships.animalId,
      animalName: animals.name,
      animalSlug: animals.slug,
      animalSpecies: animals.species,
      status: animalOwnerships.status,
      slotIndex: animalOwnerships.slotIndex,
      startsAt: animalOwnerships.startsAt,
      endsAt: animalOwnerships.endsAt,
      priceMinor: animalOwnerships.priceMinor,
      paidAt: animalOwnerships.paidAt,
      cancelledAt: animalOwnerships.cancelledAt,
      notes: animalOwnerships.notes,
      createdAt: animalOwnerships.createdAt,
    })
    .from(animalOwnerships)
    .leftJoin(animals, eq(animalOwnerships.animalId, animals.id))
    .where(eq(animalOwnerships.ownerOpenId, userOpenId))
    .orderBy(desc(animalOwnerships.createdAt));

  // 3. Product plans
  const productPlansRaw = await db
    .select({
      id: ownerProductPlans.id,
      animalId: ownerProductPlans.animalId,
      animalName: animals.name,
      ownershipId: ownerProductPlans.ownershipId,
      status: ownerProductPlans.status,
      selectionsJson: ownerProductPlans.selectionsJson,
      totalMilkUsed: ownerProductPlans.totalMilkUsed,
      adminNotes: ownerProductPlans.adminNotes,
      confirmedAt: ownerProductPlans.confirmedAt,
      createdAt: ownerProductPlans.createdAt,
    })
    .from(ownerProductPlans)
    .leftJoin(animals, eq(ownerProductPlans.animalId, animals.id))
    .where(eq(ownerProductPlans.ownerOpenId, userOpenId))
    .orderBy(desc(ownerProductPlans.createdAt));

  // 4. Delivery schedule
  const deliveriesRaw = await db
    .select({
      id: deliverySchedule.id,
      animalId: deliverySchedule.animalId,
      animalName: animals.name,
      month: deliverySchedule.month,
      year: deliverySchedule.year,
      itemsJson: deliverySchedule.itemsJson,
      status: deliverySchedule.status,
      deliveredAt: deliverySchedule.deliveredAt,
      adminNote: deliverySchedule.adminNote,
    })
    .from(deliverySchedule)
    .leftJoin(animals, eq(deliverySchedule.animalId, animals.id))
    .where(eq(deliverySchedule.ownerOpenId, userOpenId))
    .orderBy(desc(deliverySchedule.year), desc(deliverySchedule.month));

  // 5. Chat messages (last 50)
  const chatMessagesRaw = await db
    .select({
      id: chatMessages.id,
      animalId: chatMessages.animalId,
      animalName: animals.name,
      sender: chatMessages.sender,
      text: chatMessages.text,
      photoUrl: chatMessages.photoUrl,
      isRead: chatMessages.isRead,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .leftJoin(animals, eq(chatMessages.animalId, animals.id))
    .where(eq(chatMessages.ownerOpenId, userOpenId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(50);

  // 6. Plan change log (last 30)
  const changeLogRaw = await db
    .select({
      id: planChangeLog.id,
      animalId: planChangeLog.animalId,
      animalName: animals.name,
      actorId: planChangeLog.actorId,
      action: planChangeLog.action,
      previousStatus: planChangeLog.previousStatus,
      newStatus: planChangeLog.newStatus,
      note: planChangeLog.note,
      createdAt: planChangeLog.createdAt,
    })
    .from(planChangeLog)
    .leftJoin(animals, eq(planChangeLog.animalId, animals.id))
    .where(eq(planChangeLog.ownerOpenId, userOpenId))
    .orderBy(desc(planChangeLog.createdAt))
    .limit(30);

  // 7. Wallet & transactions
  const walletsRaw = await db
    .select({
      id: wallets.id,
      balanceMinor: wallets.balanceMinor,
      status: wallets.status,
      currencyCode: wallets.currencyCode,
    })
    .from(wallets)
    .where(eq(wallets.ownerOpenId, userOpenId));

  const walletTxRaw = await db
    .select({
      id: walletTransactions.id,
      transactionType: walletTransactions.transactionType,
      direction: walletTransactions.direction,
      amountMinor: walletTransactions.amountMinor,
      balanceAfterMinor: walletTransactions.balanceAfterMinor,
      memo: walletTransactions.memo,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.ownerOpenId, userOpenId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(30);

  return {
    user,
    ownerships: ownershipsRaw,
    productPlans: productPlansRaw,
    deliveries: deliveriesRaw,
    chatMessages: chatMessagesRaw,
    changeLog: changeLogRaw,
    wallets: walletsRaw,
    walletTransactions: walletTxRaw,
  };
}


/**
 * Set the user's preferred primary animal for the dashboard.
 * Pass null to reset to auto-select (default sorting).
 */
export async function setPrimaryAnimal(ownerOpenId: string, animalId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If setting a specific animal, verify the user actually owns a share
  if (animalId !== null) {
    const ownershipCheck = await db
      .select({ id: animalOwnerships.id })
      .from(animalOwnerships)
      .where(
        and(
          eq(animalOwnerships.ownerOpenId, ownerOpenId),
          eq(animalOwnerships.animalId, animalId),
          or(eq(animalOwnerships.status, "active"), eq(animalOwnerships.status, "pending_payment"))
        )
      )
      .limit(1);
    if (!ownershipCheck.length) {
      throw new Error("У вас нет доли в этом животном");
    }
  }

  await db
    .update(users)
    .set({ primaryAnimalId: animalId })
    .where(eq(users.openId, ownerOpenId));

  return { success: true, primaryAnimalId: animalId };
}


/* ───────────────────────────────────────────────────────────
   User In-App Notifications
   ─────────────────────────────────────────────────────────── */

export async function createUserNotification(input: {
  userOpenId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Respect user notification preferences
    const shouldSend = await shouldNotifyUser(input.userOpenId, input.type);
    if (!shouldSend) return null;

    const result = await db.insert(userNotifications).values({
      userOpenId: input.userOpenId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    return { id: Number(result[0].insertId) };
  } catch (error) {
    console.error("[Database] Failed to create user notification:", error);
    return null;
  }
}

export async function listUserNotifications(userOpenId: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userOpenId, userOpenId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to list user notifications:", error);
    return [];
  }
}

export async function countUnreadNotifications(userOpenId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userOpenId, userOpenId),
        eq(userNotifications.isRead, false),
      ));
    return Number(result[0]?.count ?? 0);
  } catch (error) {
    console.error("[Database] Failed to count unread notifications:", error);
    return 0;
  }
}

export async function markNotificationRead(notificationId: number, userOpenId: string) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.userOpenId, userOpenId),
      ));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark notification read:", error);
    return false;
  }
}

export async function markAllNotificationsRead(userOpenId: string) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(and(
        eq(userNotifications.userOpenId, userOpenId),
        eq(userNotifications.isRead, false),
      ));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark all notifications read:", error);
    return false;
  }
}


/**
 * Send a notification to all active (non-deleted, non-admin) users.
 * Used for club-wide announcements like new posts and events.
 * Optionally excludes a specific openId (e.g. the admin who created the content).
 */
export async function notifyAllActiveUsers(input: {
  type: string;
  title: string;
  body?: string;
  link?: string;
  excludeOpenId?: string;
}) {
  const db = await getDb();
  if (!db) return 0;

  try {
    const activeUsers = await db
      .select({ openId: users.openId })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          ne(users.role, "admin"),
        ),
      );

    let recipients = input.excludeOpenId
      ? activeUsers.filter((u: { openId: string }) => u.openId !== input.excludeOpenId)
      : activeUsers;

    if (recipients.length === 0) return 0;

    // Filter by user notification preferences
    const prefChecks = await Promise.all(
      recipients.map(async (u: { openId: string }) => ({
        openId: u.openId,
        wantsIt: await shouldNotifyUser(u.openId, input.type),
      })),
    );
    recipients = prefChecks
      .filter((p) => p.wantsIt)
      .map((p) => ({ openId: p.openId }));

    if (recipients.length === 0) return 0;

    const rows = recipients.map((u: { openId: string }) => ({
      userOpenId: u.openId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    }));

    await db.insert(userNotifications).values(rows);
    return recipients.length;
  } catch (error) {
    console.error("[Database] Failed to notify all active users:", error);
    return 0;
  }
}


// ─── Notification Preferences ───────────────────────────────────────────────

/** Default preferences — all enabled */
const DEFAULT_PREFS = {
  photoApproved: true,
  photoRejected: true,
  clubPost: true,
  clubEvent: true,
  compositionUpdate: true,
  metricsUpdate: true,
};

/** Map notification type string to the column name in preferences table */
const TYPE_TO_PREF_KEY: Record<string, keyof typeof DEFAULT_PREFS> = {
  photo_approved: "photoApproved",
  photo_rejected: "photoRejected",
  club_post: "clubPost",
  club_event: "clubEvent",
  composition_update: "compositionUpdate",
  metrics_update: "metricsUpdate",
};

export async function getNotificationPreferences(userOpenId: string) {
  const db = await getDb();
  if (!db) return { ...DEFAULT_PREFS };

  try {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userOpenId, userOpenId))
      .limit(1);

    if (rows.length === 0) return { ...DEFAULT_PREFS };

    const row = rows[0];
    return {
      photoApproved: row.photoApproved,
      photoRejected: row.photoRejected,
      clubPost: row.clubPost,
      clubEvent: row.clubEvent,
      compositionUpdate: row.compositionUpdate,
      metricsUpdate: row.metricsUpdate,
    };
  } catch (error) {
    console.error("[Database] Failed to get notification preferences:", error);
    return { ...DEFAULT_PREFS };
  }
}

export async function upsertNotificationPreferences(
  userOpenId: string,
  prefs: Partial<typeof DEFAULT_PREFS>,
) {
  const db = await getDb();
  if (!db) return false;

  try {
    // Check if row exists
    const existing = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userOpenId, userOpenId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(notificationPreferences)
        .set(prefs)
        .where(eq(notificationPreferences.userOpenId, userOpenId));
    } else {
      await db.insert(notificationPreferences).values({
        userOpenId,
        ...DEFAULT_PREFS,
        ...prefs,
      });
    }
    return true;
  } catch (error) {
    console.error("[Database] Failed to upsert notification preferences:", error);
    return false;
  }
}

/**
 * Check if a user wants to receive a specific notification type.
 * Returns true if the type is unknown (not in preferences) — fail-open.
 */
export async function shouldNotifyUser(userOpenId: string, type: string): Promise<boolean> {
  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true; // Unknown type → always send

  const prefs = await getNotificationPreferences(userOpenId);
  return prefs[prefKey];
}


/* ═══════════════════════════════════════════════════════════════
   Composition Snapshots & Monthly Metrics — Admin CRUD
   Data is per-animal (animalSlug), ownerOpenId is set to farm owner.
   ═══════════════════════════════════════════════════════════════ */

/** List all composition snapshots for an animal (by slug) */
export async function listCompositionSnapshots(animalSlug: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productCompositionSnapshots)
    .where(eq(productCompositionSnapshots.animalSlug, animalSlug))
    .orderBy(asc(productCompositionSnapshots.sortOrder), asc(productCompositionSnapshots.id));
}

/** Create a new composition snapshot */
export async function createCompositionSnapshot(data: {
  animalSlug: string;
  ownerOpenId: string;
  label: string;
  value: string;
  note: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productCompositionSnapshots).values({
    animalSlug: data.animalSlug,
    ownerOpenId: data.ownerOpenId,
    label: data.label,
    value: data.value,
    note: data.note,
    sortOrder: data.sortOrder ?? 0,
  });
  return { id: Number(result[0].insertId) };
}

/** Update an existing composition snapshot */
export async function updateCompositionSnapshot(
  id: number,
  data: { label?: string; value?: string; note?: string; sortOrder?: number },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (data.label !== undefined) updates.label = data.label;
  if (data.value !== undefined) updates.value = data.value;
  if (data.note !== undefined) updates.note = data.note;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  await db.update(productCompositionSnapshots).set(updates).where(eq(productCompositionSnapshots.id, id));
  return { success: true };
}

/** Delete a composition snapshot by ID */
export async function deleteCompositionSnapshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productCompositionSnapshots).where(eq(productCompositionSnapshots.id, id));
  return { success: true };
}

/** List all monthly metrics for an animal (by slug) */
export async function listMonthlyMetrics(animalSlug: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productMonthlyMetrics)
    .where(eq(productMonthlyMetrics.animalSlug, animalSlug))
    .orderBy(asc(productMonthlyMetrics.sortOrder), asc(productMonthlyMetrics.id));
}

/** Create or update a monthly metric entry */
export async function upsertMonthlyMetric(data: {
  id?: number;
  animalSlug: string;
  ownerOpenId: string;
  monthLabel: string;
  milkVolumeLiters: number;
  proteinPercentTenth: number;
  fatPercentTenth: number;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.id) {
    // Update existing
    await db
      .update(productMonthlyMetrics)
      .set({
        monthLabel: data.monthLabel,
        milkVolumeLiters: data.milkVolumeLiters,
        proteinPercentTenth: data.proteinPercentTenth,
        fatPercentTenth: data.fatPercentTenth,
        sortOrder: data.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(productMonthlyMetrics.id, data.id));
    return { id: data.id };
  }

  // Create new
  const result = await db.insert(productMonthlyMetrics).values({
    animalSlug: data.animalSlug,
    ownerOpenId: data.ownerOpenId,
    monthLabel: data.monthLabel,
    milkVolumeLiters: data.milkVolumeLiters,
    proteinPercentTenth: data.proteinPercentTenth,
    fatPercentTenth: data.fatPercentTenth,
    sortOrder: data.sortOrder ?? 0,
  });
  return { id: Number(result[0].insertId) };
}

/** Delete a monthly metric by ID */
export async function deleteMonthlyMetric(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productMonthlyMetrics).where(eq(productMonthlyMetrics.id, id));
  return { success: true };
}

/** Get composition snapshots for public tracker (by animalSlug only, no ownerOpenId filter) */
export async function getPublicCompositionSnapshots(animalSlug: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productCompositionSnapshots)
    .where(eq(productCompositionSnapshots.animalSlug, animalSlug))
    .orderBy(asc(productCompositionSnapshots.sortOrder));
}

/** Get monthly metrics for public tracker (by animalSlug only, no ownerOpenId filter) */
export async function getPublicMonthlyMetrics(animalSlug: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productMonthlyMetrics)
    .where(eq(productMonthlyMetrics.animalSlug, animalSlug))
    .orderBy(asc(productMonthlyMetrics.sortOrder));
}

/** Resolve animal slug from animal ID */
export async function getAnimalSlugById(animalId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ slug: animals.slug }).from(animals).where(eq(animals.id, animalId)).limit(1);
  return rows[0]?.slug ?? null;
}


/* ═══════════════════════════════════════════════════════════════
   Owner Notifications — Composition Update
   Notify all active owners of an animal when its milk composition changes.
   ═══════════════════════════════════════════════════════════════ */

/** Get all active owner openIds for a given animal ID */
export async function getActiveOwnerOpenIdsByAnimalId(animalId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ ownerOpenId: animalOwnerships.ownerOpenId })
      .from(animalOwnerships)
      .where(
        and(
          eq(animalOwnerships.animalId, animalId),
          or(
            eq(animalOwnerships.status, "active"),
            eq(animalOwnerships.status, "pending_payment"),
          ),
        ),
      );
    // Deduplicate (one user can have multiple ownerships for the same animal)
    const unique: string[] = [];
    for (const r of rows) {
      if (!unique.includes(r.ownerOpenId)) {
        unique.push(r.ownerOpenId);
      }
    }
    return unique;
  } catch (error) {
    console.error("[Database] Failed to get active owners for animal:", error);
    return [];
  }
}

/**
 * Notify all active owners of an animal about a composition update.
 * Creates an in-app notification for each owner who has compositionUpdate enabled.
 * Returns the number of notifications sent.
 */
export async function notifyOwnersAboutCompositionUpdate(input: {
  animalId: number;
  animalName: string;
  animalSlug: string;
  action: "created" | "updated" | "deleted";
  detail?: string;
}): Promise<number> {
  const ownerOpenIds = await getActiveOwnerOpenIdsByAnimalId(input.animalId);
  if (ownerOpenIds.length === 0) return 0;

  const actionLabels: Record<string, string> = {
    created: "добавлен новый показатель",
    updated: "обновлён показатель",
    deleted: "удалён показатель",
  };

  const title = `Состав молока ${input.animalName}: ${actionLabels[input.action] ?? "изменение"}`;
  const body = input.detail
    ? `${actionLabels[input.action] ?? "Изменение"} состава молока для ${input.animalName}: ${input.detail}`
    : `${actionLabels[input.action] ?? "Изменение"} состава молока для ${input.animalName}.`;
  const link = `/tracker?animal=${input.animalSlug}`;

  let sent = 0;
  for (const openId of ownerOpenIds) {
    const result = await createUserNotification({
      userOpenId: openId,
      type: "composition_update",
      title,
      body,
      link,
    });
    if (result) sent++;
  }
  return sent;
}


/** Resolve animal ID from slug (reverse of getAnimalSlugById) */
export async function getAnimalIdBySlug(slug: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: animals.id }).from(animals).where(eq(animals.slug, slug)).limit(1);
  return rows[0]?.id ?? null;
}


/**
 * Notify all active owners of an animal when monthly metrics (seasonal rhythm) are updated.
 * Creates an in-app notification for each owner who has metricsUpdate enabled.
 */
export async function notifyOwnersAboutMetricsUpdate(input: {
  animalId: number;
  animalName: string;
  animalSlug: string;
  action: "created" | "updated" | "deleted";
  detail?: string;
}): Promise<number> {
  const ownerOpenIds = await getActiveOwnerOpenIdsByAnimalId(input.animalId);
  if (ownerOpenIds.length === 0) return 0;

  const actionLabels: Record<string, string> = {
    created: "добавлены новые данные",
    updated: "обновлены данные",
    deleted: "удалены данные",
  };

  const title = `Сезонный ритм ${input.animalName}: ${actionLabels[input.action] ?? "изменение"}`;
  const body = input.detail
    ? `${actionLabels[input.action] ?? "Изменение"} сезонного ритма для ${input.animalName}: ${input.detail}`
    : `${actionLabels[input.action] ?? "Изменение"} сезонного ритма для ${input.animalName}.`;
  const link = `/tracker?animal=${input.animalSlug}`;

  let sent = 0;
  for (const openId of ownerOpenIds) {
    const result = await createUserNotification({
      userOpenId: openId,
      type: "metrics_update",
      title,
      body,
      link,
    });
    if (result) sent++;
  }
  return sent;
}
