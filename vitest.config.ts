import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Интеграционные тесты ходят в TiDB: bcrypt и сетевые запросы не укладываются в 5 с
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Повтор только в CI и только для упавших тестов: TiDB Starter иногда отдаёт
    // ETIMEDOUT на первом соединении после простоя. Локально retry выключен,
    // чтобы нестабильный тест был виден сразу, а не маскировался повтором.
    retry: process.env.CI ? 2 : 0,
    // Не больше 4 параллельных файлов, иначе Starter-кластер TiDB рвёт соединения
    // (PROTOCOL_CONNECTION_LOST). Лимит задан для обоих пулов vitest.
    poolOptions: {
      forks: { minForks: 1, maxForks: 4 },
      threads: { minThreads: 1, maxThreads: 4 },
    },
  },
});
