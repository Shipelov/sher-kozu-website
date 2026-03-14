import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { animalPhotos, InsertAnimalPhoto, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
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

  return db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));
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
  const insertedId = Number((result as { insertId?: number }).insertId);

  if (values.isCover) {
    await db
      .update(animalPhotos)
      .set({ isCover: 0 })
      .where(and(eq(animalPhotos.animalSlug, values.animalSlug), eq(animalPhotos.ownerOpenId, values.ownerOpenId), sql`${animalPhotos.id} <> ${insertedId}`));
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
    remaining.map((photo, index) =>
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

  const existingIds = existing.map((photo) => photo.id).sort((a, b) => a - b);
  const incomingIds = [...photoIds].sort((a, b) => a - b);

  if (existingIds.length !== incomingIds.length || existingIds.some((id, index) => id !== incomingIds[index])) {
    throw new Error("Photo order payload does not match available gallery items");
  }

  await Promise.all(
    photoIds.map((photoId, index) => db.update(animalPhotos).set({ sortOrder: index }).where(eq(animalPhotos.id, photoId))),
  );

  return db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.animalSlug, animalSlug), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .orderBy(asc(animalPhotos.sortOrder), desc(animalPhotos.createdAt));
}
