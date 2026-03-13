import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { animalPhotos, InsertAnimalPhoto, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

export async function listAnimalPhotos(animalSlug: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list animal photos: database not available");
    return [];
  }

  return db
    .select()
    .from(animalPhotos)
    .where(eq(animalPhotos.animalSlug, animalSlug))
    .orderBy(desc(animalPhotos.createdAt));
}

export async function createAnimalPhoto(photo: InsertAnimalPhoto) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(animalPhotos).values(photo);
  const created = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.fileKey, photo.fileKey), eq(animalPhotos.ownerOpenId, photo.ownerOpenId)))
    .orderBy(desc(animalPhotos.id))
    .limit(1);

  if (!created[0]) {
    throw new Error("Failed to create animal photo record");
  }

  return created[0];
}

export async function getAnimalPhotoById(photoId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(animalPhotos).where(eq(animalPhotos.id, photoId)).limit(1);
  return result[0];
}

export async function deleteAnimalPhoto(photoId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select()
    .from(animalPhotos)
    .where(and(eq(animalPhotos.id, photoId), eq(animalPhotos.ownerOpenId, ownerOpenId)))
    .limit(1);

  if (!existing[0]) {
    return null;
  }

  await db.delete(animalPhotos).where(eq(animalPhotos.id, photoId));
  return existing[0];
}
