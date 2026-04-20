export const ENV = {
  // ─── Core ───
  appId: process.env.VITE_APP_ID ?? "sher-kozu",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  // ─── OAuth (legacy Manus — kept for backward compat, not required) ───
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",

  // ─── LLM (OpenAI-compatible) ───
  openaiApiKey: process.env.OPENAI_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openaiApiUrl: process.env.OPENAI_API_URL ?? "",

  // ─── Forge API (legacy Manus proxy — fallback for LLM/storage/maps) ───
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // ─── S3 Storage (direct AWS/Yandex Object Storage) ───
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "ru-central1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",

  // ─── VDS Local File Storage ───
  localUploadsDir: process.env.LOCAL_UPLOADS_DIR ?? "",
  baseUrl: process.env.BASE_URL ?? "",

  // ─── Google Maps (direct API key) ───
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",

  // ─── Bitrix24 CRM ───
  bitrix24BaseUrl: process.env.BITRIX24_BASE_URL ?? "",
  bitrix24RestUserId: process.env.BITRIX24_REST_USER_ID ?? "",
  bitrix24WebhookToken: process.env.BITRIX24_WEBHOOK_TOKEN ?? "",
  bitrix24OutboundWebhookToken: process.env.BITRIX24_OUTBOUND_WEBHOOK_TOKEN ?? "",

  // ─── Telegram ───
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",

  // ─── Telegram API proxy (Cloudflare Worker) — bypasses ISP blocks in Russia ───
  telegramApiProxyUrl: process.env.TELEGRAM_API_PROXY_URL ?? "",

  // ─── Telegram admin chat for owner notifications ───
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
};
