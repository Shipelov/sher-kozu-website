import { afterAll } from "vitest";

// vitest изолирует модули для каждого тест-файла, поэтому server/db.ts создаёт
// свой пул на файл и никогда его не закрывает: соединения висят до idleTimeout.
// Закрываем пул после каждого файла, чтобы 4 воркера не копили соединения к TiDB.
afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    const mod: { closeDb?: () => Promise<void> } = await import("./server/db");
    if (typeof mod.closeDb === "function") await mod.closeDb();
  } catch {
    // Файл замокал ./db через vi.mock без closeDb — закрывать нечего
  }
});
