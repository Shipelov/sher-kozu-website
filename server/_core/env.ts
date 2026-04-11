export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  bitrix24BaseUrl: process.env.BITRIX24_BASE_URL ?? "",
  bitrix24RestUserId: process.env.BITRIX24_REST_USER_ID ?? "",
  bitrix24WebhookToken: process.env.BITRIX24_WEBHOOK_TOKEN ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
};
