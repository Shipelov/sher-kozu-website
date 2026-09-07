import express, { type RequestHandler } from "express";

/** Лимит тела запроса по умолчанию: обычные JSON-вызовы и формы. */
export const DEFAULT_BODY_LIMIT = "200kb";

/** Лимит для маршрутов, которые принимают файлы (multipart/raw или base64 в JSON). */
export const UPLOAD_BODY_LIMIT = "10mb";

/**
 * tRPC-процедуры, принимающие файлы как base64 внутри JSON-тела.
 * Для них сохраняется большой лимит, остальные /api/trpc вызовы получают default.
 */
export const LARGE_BODY_TRPC_PROCEDURES: readonly string[] = [
  "animalPhotos.upload",
  "cms.uploadImage",
  "productTrack.sendMessage",
  "partnerLeads.create",
];

/** Express-маршруты (префиксы), принимающие файлы напрямую в теле запроса. */
export const LARGE_BODY_PATH_PREFIXES: readonly string[] = ["/api/nutri/"];

const TRPC_PREFIX = "/api/trpc/";

/**
 * Нужен ли пути большой лимит тела. tRPC-batch объединяет процедуры через
 * запятую в одном пути, поэтому проверяется каждая из них.
 */
export function needsLargeBody(path: string): boolean {
  if (LARGE_BODY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }
  if (!path.startsWith(TRPC_PREFIX)) return false;

  let procedures: string;
  try {
    procedures = decodeURIComponent(path.slice(TRPC_PREFIX.length));
  } catch {
    return false;
  }
  return procedures
    .split(",")
    .some((procedure) => LARGE_BODY_TRPC_PROCEDURES.includes(procedure));
}

/**
 * Пара body-parser'ов с выбором лимита по пути: 10mb только для загрузок,
 * 200kb для всего остального.
 */
export function createBodyLimitMiddleware(): RequestHandler[] {
  const jsonDefault = express.json({ limit: DEFAULT_BODY_LIMIT });
  const jsonLarge = express.json({ limit: UPLOAD_BODY_LIMIT });
  const urlencodedDefault = express.urlencoded({ limit: DEFAULT_BODY_LIMIT, extended: true });
  const urlencodedLarge = express.urlencoded({ limit: UPLOAD_BODY_LIMIT, extended: true });

  const json: RequestHandler = (req, res, next) =>
    (needsLargeBody(req.path) ? jsonLarge : jsonDefault)(req, res, next);
  const urlencoded: RequestHandler = (req, res, next) =>
    (needsLargeBody(req.path) ? urlencodedLarge : urlencodedDefault)(req, res, next);

  return [json, urlencoded];
}
