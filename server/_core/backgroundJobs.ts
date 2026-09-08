/**
 * Реестр фоновых задач сервера (setInterval/setTimeout из index.ts).
 *
 * Под vitest задачи не стартуют вовсе, а stopBackgroundJobs() снимает все
 * таймеры: иначе их запросы держат пул, и pool.end() в closeDb() виснет.
 */
import { analyticsMonitor } from "../analyticsMonitor";

const handles: NodeJS.Timeout[] = [];

export function backgroundJobsEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}

/** Регистрирует таймер и снимает с него удержание event loop */
export function trackBackgroundJob<T extends NodeJS.Timeout>(handle: T): T {
  handle.unref?.();
  handles.push(handle);
  return handle;
}

export function stopBackgroundJobs(): void {
  for (const handle of handles) clearTimeout(handle);
  handles.length = 0;
  analyticsMonitor.stopReporting();
}

/** Сколько таймеров сейчас зарегистрировано (для тестов) */
export function backgroundJobCount(): number {
  return handles.length;
}
