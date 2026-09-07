/**
 * Telegram Bot for Шерь Козу — pull-first companion bot.
 *
 * Commands:
 *   /start <token>  — Link Telegram account to website profile
 *   /status         — Animal summary + wellness metrics
 *   /delivery       — Current delivery status
 *   /balance        — SKC token balance
 *   /events         — Upcoming club events
 *   /photo          — Latest animal photo
 *   /zoya           — AI nutritionist chat mode
 *   /help           — AI assistant Masha chat mode
 *   /settings       — Notification preferences
 *   /exit           — Exit chat mode, return to normal
 *   /myid           — Show Telegram chat ID for farm worker linking
 */

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { ENV } from "./_core/env";
import { getTelegramApiRoot, getTelegramFileUrl } from "./_core/telegramApiBase";
import { getDb } from "./db";
import {
  users,
  telegramLinkTokens,
  telegramSessions,
} from "../drizzle/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import crypto from "crypto";

/* ─── Bot Instance ─── */

let botInstance: Bot | null = null;

export function getBot(): Bot {
  if (!botInstance) {
    if (!ENV.telegramBotToken) {
      throw new Error("[Telegram] TELEGRAM_BOT_TOKEN is not configured");
    }
    const apiRoot = getTelegramApiRoot();
    botInstance = new Bot(ENV.telegramBotToken, {
      client: { apiRoot },
    });
    if (apiRoot !== "https://api.telegram.org") {
      console.log(`[Telegram] Using API proxy: ${apiRoot}`);
    }
    registerHandlers(botInstance);
  }
  return botInstance;
}

/* ─── DB Helpers ─── */

export async function getUserByTelegramChatId(chatId: string) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);
  return user ?? null;
}

export async function linkTelegramAccount(token: string, chatId: string): Promise<{ success: boolean; userName?: string; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "База данных недоступна" };

  // Find valid, unused token
  const [linkToken] = await db
    .select()
    .from(telegramLinkTokens)
    .where(
      and(
        eq(telegramLinkTokens.token, token),
        isNull(telegramLinkTokens.usedAt),
        gt(telegramLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!linkToken) {
    return { success: false, error: "Ссылка устарела или уже использована. Создайте новую в личном кабинете." };
  }

  // Check if this chatId is already linked to another user
  const [existingUser] = await db.select().from(users).where(eq(users.telegramChatId, chatId)).limit(1);
  if (existingUser && existingUser.openId !== linkToken.userOpenId) {
    return { success: false, error: "Этот Telegram-аккаунт уже привязан к другому профилю." };
  }

  // Link the account
  await db.update(users).set({ telegramChatId: chatId }).where(eq(users.openId, linkToken.userOpenId));
  // Mark token as used
  await db.update(telegramLinkTokens).set({ usedAt: new Date() }).where(eq(telegramLinkTokens.id, linkToken.id));

  // Get user name
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.openId, linkToken.userOpenId)).limit(1);

  return { success: true, userName: user?.name ?? undefined };
}

export async function generateLinkToken(userOpenId: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(telegramLinkTokens).values({
    token,
    userOpenId,
    expiresAt,
  });

  return token;
}

/* ─── Session Management ─── */

type SessionState = "idle" | "chat_zoya" | "chat_masha";

async function getSessionState(chatId: string): Promise<SessionState> {
  const db = await getDb();
  if (!db) return "idle";
  const [session] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId)).limit(1);
  return (session?.state as SessionState) ?? "idle";
}

async function setSessionState(chatId: string, state: SessionState, contextJson?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId)).limit(1);
  if (existing) {
    await db.update(telegramSessions).set({ state, contextJson: contextJson ?? null }).where(eq(telegramSessions.chatId, chatId));
  } else {
    await db.insert(telegramSessions).values({ chatId, state, contextJson: contextJson ?? null });
  }
}

async function getSessionContext(chatId: string): Promise<Array<{ role: string; content: string }>> {
  const db = await getDb();
  if (!db) return [];
  const [session] = await db.select().from(telegramSessions).where(eq(telegramSessions.chatId, chatId)).limit(1);
  if (!session?.contextJson) return [];
  try {
    return JSON.parse(session.contextJson);
  } catch {
    return [];
  }
}

async function appendToContext(chatId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
  const existing = await getSessionContext(chatId);
  const updated = [...existing, ...messages].slice(-20); // Keep last 20 messages
  const state = await getSessionState(chatId);
  await setSessionState(chatId, state, JSON.stringify(updated));
}

/* ─── Formatting Helpers ─── */

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function wellnessBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/* ─── Command Handlers ─── */

function registerHandlers(bot: Bot) {
  // /start — account linking or welcome
  bot.command("start", async (ctx) => {
    const payload = ctx.match; // deep link payload after /start
    if (payload) {
      const chatId = String(ctx.chat.id);
      const result = await linkTelegramAccount(payload, chatId);
      if (result.success) {
        const name = result.userName ? `, ${result.userName}` : "";
        await ctx.reply(
          `✅ Аккаунт привязан${name}!\n\nТеперь вы можете:\n• /status — узнать как дела у вашего животного\n• /delivery — проверить доставку\n• /balance — посмотреть баланс SKC\n• /events — ближайшие события клуба\n• /photo — последнее фото\n• /zoya — спросить нутрициолога\n• /help — задать вопрос Маше`,
        );
      } else {
        await ctx.reply(`❌ ${result.error}`);
      }
      return;
    }

    // No payload — check if already linked
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (user) {
      await ctx.reply(
        `Привет${user.name ? `, ${user.name}` : ""}! 👋\n\nВаш аккаунт уже привязан. Вот что я умею:\n\n• /status — сводка по животному\n• /delivery — статус доставки\n• /balance — баланс SKC\n• /events — события клуба\n• /photo — последнее фото\n• /zoya — нутрициолог Зоя\n• /help — помощник Маша\n• /settings — настройки уведомлений`,
      );
    } else {
      await ctx.reply(
        "Добро пожаловать в бот фермы «Шерь Козу»! 🐐\n\nЧтобы начать, привяжите аккаунт:\n1. Откройте личный кабинет на сайте koza.vip\n2. Нажмите «Подключить Telegram»\n3. Перейдите по ссылке\n\nПосле привязки вам станут доступны все команды.",
      );
    }
  });

  // /status — animal summary
  bot.command("status", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getOwnerDashboardData } = await import("./db");
      const data = await getOwnerDashboardData(user.openId);

      if (!data.animal) {
        return ctx.reply("У вас пока нет животного. Выберите своё животное на koza.vip/animals 🐐");
      }

      const a = data.animal;
      const o = data.ownership;
      const speciesEmoji = a.species === "goat" ? "🐐" : "🐑";
      const statusLabel = o?.statusLabel ?? "—";

      let msg = `${speciesEmoji} *${escapeMarkdown(a.name)}*\n`;
      msg += `${escapeMarkdown(a.breed ?? "")} • ${escapeMarkdown(statusLabel)}\n`;
      if (o) msg += `Ваша доля: ${o.sharePercent}%\n`;
      msg += `\n`;
      msg += `❤️ Счастье: ${wellnessBar(a.happinessScore ?? 0)} ${a.happinessScore ?? 0}\n`;
      msg += `💚 Здоровье: ${wellnessBar(a.healthScore ?? 0)} ${a.healthScore ?? 0}\n`;
      msg += `😊 Настроение: ${wellnessBar(a.careLevelScore ?? 0)} ${a.careLevelScore ?? 0}\n`;

      if (data.productSummary?.currentDelivery) {
        const d = data.productSummary.currentDelivery;
        msg += `\n📦 Доставка: ${escapeMarkdown(String(d.status ?? "—"))}`;
      }

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[Telegram /status]", err);
      await ctx.reply("Не удалось загрузить данные. Попробуйте позже.");
    }
  });

  // /delivery — delivery status
  bot.command("delivery", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getOwnerDashboardData } = await import("./db");
      const data = await getOwnerDashboardData(user.openId);

      if (!data.animal || !data.ownership) {
        return ctx.reply("У вас пока нет животного. Выберите на koza.vip/animals 🐐");
      }

      const { getOwnerDeliveryTimeline } = await import("./db");
      const timeline = await getOwnerDeliveryTimeline(user.openId, data.ownership.animalId);

      if (!timeline.entries.length) {
        return ctx.reply("📦 Доставки пока не запланированы. Следите за обновлениями!");
      }

      let msg = `📦 *Доставки ${timeline.year}*\n\n`;
      msg += `Всего: ${timeline.stats.total} • Доставлено: ${timeline.stats.delivered} • Готово: ${timeline.stats.ready} • Планируется: ${timeline.stats.planned}\n\n`;

      // Show next 3 upcoming/active deliveries
      const upcoming = timeline.entries
        .filter((e: any) => e.status !== "delivered")
        .slice(0, 3);

      if (upcoming.length) {
        for (const entry of upcoming) {
          const monthLabel = MONTH_NAMES_RU[(entry as any).month - 1] ?? `Месяц ${(entry as any).month}`;
          const statusIcon = (entry as any).status === "ready" ? "✅" : "📋";
          msg += `${statusIcon} ${escapeMarkdown(monthLabel)}: ${escapeMarkdown(String((entry as any).status ?? "—"))}\n`;
        }
      } else {
        msg += "Все доставки за этот год выполнены! 🎉";
      }

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[Telegram /delivery]", err);
      await ctx.reply("Не удалось загрузить данные о доставках. Попробуйте позже.");
    }
  });

  // /balance — SKC token balance
  bot.command("balance", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getOwnerBalance } = await import("./gamification");
      const wallet = await getOwnerBalance(user.openId);

      if (!wallet) {
        return ctx.reply("💰 Кошелёк: 0 SKC\n\nТокены начисляются за покупки, визиты и активность в клубе.");
      }

      const balance = wallet.balanceSKC ?? 0;
      await ctx.reply(`💰 *Баланс: ${balance} SKC*\n\nТокены можно потратить в маркетплейсе на koza\\.vip`, { parse_mode: "MarkdownV2" });
    } catch (err) {
      console.error("[Telegram /balance]", err);
      await ctx.reply("Не удалось загрузить баланс. Попробуйте позже.");
    }
  });

  // /events — upcoming club events
  bot.command("events", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getClubFeedData } = await import("./db");
      const clubData = await getClubFeedData(user.openId);

      if (!clubData.events.length) {
        return ctx.reply("📅 Пока нет запланированных событий. Следите за обновлениями в клубе!");
      }

      let msg = "📅 *Ближайшие события клуба*\n\n";
      const upcoming = clubData.events.slice(0, 5);

      for (const event of upcoming) {
        const statusIcon = event.status === "Открыта запись" ? "🟢" : event.status === "Мест осталось мало" ? "🟡" : "📌";
        msg += `${statusIcon} *${escapeMarkdown(event.title)}*\n`;
        if (event.date) msg += `   📆 ${escapeMarkdown(String(event.date))}\n`;
        if (event.teaser) msg += `   ${escapeMarkdown(event.teaser)}\n`;
        msg += `\n`;
      }

      msg += `Подробнее на koza.vip/club`;
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[Telegram /events]", err);
      await ctx.reply("Не удалось загрузить события. Попробуйте позже.");
    }
  });

  // /photo — latest animal photo
  bot.command("photo", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getOwnerDashboardData, listAnimalPhotos } = await import("./db");
      const data = await getOwnerDashboardData(user.openId);

      if (!data.animal) {
        return ctx.reply("У вас пока нет животного. Выберите на koza.vip/animals 🐐");
      }

      const photos = await listAnimalPhotos(data.animal.slug, user.openId);
      if (!photos.length) {
        // Try cover image
        if (data.animal.coverImageUrl) {
          await ctx.replyWithPhoto(data.animal.coverImageUrl, {
            caption: `📸 ${data.animal.name}`,
          });
        } else {
          await ctx.reply("📷 Фотографий пока нет. Загрузите первое фото в профиле животного на сайте!");
        }
        return;
      }

      const latest = photos[0];
      const imageUrl = (latest as any).imageUrl || (latest as any).url;
      if (imageUrl) {
        await ctx.replyWithPhoto(imageUrl, {
          caption: `📸 ${data.animal.name}${(latest as any).title ? ` — ${(latest as any).title}` : ""}`,
        });
      } else {
        await ctx.reply("📷 Не удалось загрузить фото. Попробуйте позже.");
      }
    } catch (err) {
      console.error("[Telegram /photo]", err);
      await ctx.reply("Не удалось загрузить фото. Попробуйте позже.");
    }
  });

  // /settings — notification preferences
  bot.command("settings", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    try {
      const { getNotificationPreferences } = await import("./db");
      const prefs = await getNotificationPreferences(user.openId);

      const check = (v: boolean | number | null | undefined) => v ? "✅" : "❌";

      let msg = "⚙️ *Настройки уведомлений*\n\n";
      msg += `${check(prefs?.deliveryStatus)} Статус доставки\n`;
      msg += `${check(prefs?.clubEvent)} События клуба\n`;
      msg += `${check(prefs?.clubPost)} Публикации клуба\n`;
      msg += `${check(prefs?.compositionUpdate)} Состав молока\n`;
      msg += `${check(prefs?.metricsUpdate)} Метрики животного\n`;
      msg += `${check(prefs?.photoApproved)} Фото одобрено\n`;
      msg += `${check(prefs?.photoRejected)} Фото отклонено\n`;
      msg += `\nУправлять настройками: koza.vip/settings/notifications`;

      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[Telegram /settings]", err);
      await ctx.reply("Не удалось загрузить настройки. Попробуйте позже.");
    }
  });

  // /zoya — enter Zoya chat mode
  bot.command("zoya", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    await setSessionState(chatId, "chat_zoya", JSON.stringify([]));
    await ctx.reply(
      "🥛 *Зоя — нутрициолог фермы*\n\nЗадайте вопрос о козьем или овечьем молоке, питании, аллергиях или продуктах фермы.\n\nНапишите /exit чтобы вернуться в обычный режим.",
      { parse_mode: "Markdown" },
    );
  });

  // /help — enter Masha chat mode
  bot.command("help", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан. Привяжите его в личном кабинете на koza.vip");

    await setSessionState(chatId, "chat_masha", JSON.stringify([]));
    await ctx.reply(
      "👩‍🌾 *Маша — управляющая фермой*\n\nЗадайте любой вопрос о ферме, животных, участии или доставках.\n\nНапишите /exit чтобы вернуться в обычный режим.",
      { parse_mode: "Markdown" },
    );
  });

  // /myid — show Telegram chat ID for farm worker linking
  bot.command("myid", async (ctx) => {
    const chatId = String(ctx.chat.id);
    await ctx.reply(
      `🆔 Ваш Telegram Chat ID:\n\n\`${chatId}\`\n\nСообщите этот ID администратору для привязки к вашему аккаунту сотрудника фермы.`,
      { parse_mode: "Markdown" },
    );
  });

  // /exit — leave chat mode
  bot.command("exit", async (ctx) => {
    const chatId = String(ctx.chat.id);
    await setSessionState(chatId, "idle");
    await ctx.reply("Вы вернулись в обычный режим. Используйте команды бота для навигации. 👋");
  });

  // Text messages — route to AI chat if in chat mode
  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const state = await getSessionState(chatId);

    if (state === "idle") {
      // Not in chat mode — show hint
      await ctx.reply(
        "Используйте команды для навигации:\n/status • /delivery • /balance • /events • /photo • /zoya • /help • /settings",
      );
      return;
    }

    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан.");

    const userMessage = ctx.message.text;

    try {
      const { invokeLLM } = await import("./_core/llm");

      let systemPrompt: string;
      if (state === "chat_zoya") {
        systemPrompt = getZoyaTelegramPrompt(user.name ?? undefined);
      } else {
        systemPrompt = getMashaTelegramPrompt(user.name ?? undefined);
      }

      // Get conversation history
      const history = await getSessionContext(chatId);

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMessage },
      ];

      // Send typing indicator
      await ctx.replyWithChatAction("typing");

      const response = await invokeLLM({ messages, maxTokens: 2048 });
      const rawContent = response.choices?.[0]?.message?.content;
      const reply = (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) ?? "Не удалось получить ответ. Попробуйте ещё раз.";

      // Save to context
      await appendToContext(chatId, [
        { role: "user", content: userMessage },
        { role: "assistant", content: reply },
      ]);

      // Send reply (split if too long)
      if (reply.length > 4000) {
        const chunks = splitMessage(reply, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(reply);
      }
    } catch (err) {
      console.error(`[Telegram ${state}]`, err);
      await ctx.reply("Произошла ошибка. Попробуйте ещё раз или напишите /exit для выхода.");
    }
  });

  // Voice messages — transcribe and route to AI
  bot.on("message:voice", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const state = await getSessionState(chatId);

    if (state === "idle") {
      await ctx.reply("Голосовые сообщения работают в режиме чата. Используйте /zoya или /help для входа.");
      return;
    }

    const user = await getUserByTelegramChatId(chatId);
    if (!user) return ctx.reply("⚠️ Аккаунт не привязан.");

    try {
      // Check voice duration (max 60 seconds)
      if (ctx.message.voice.duration > 60) {
        await ctx.reply("⚠️ Голосовое сообщение слишком длинное. Максимум — 60 секунд.");
        return;
      }

      await ctx.replyWithChatAction("typing");

      // Get file URL from Telegram
      const file = await ctx.getFile();
      const fileUrl = getTelegramFileUrl(file.file_path!);

      // Transcribe
      const { transcribeAudio } = await import("./_core/voiceTranscription");
      const transcription = await transcribeAudio({
        audioUrl: fileUrl,
        language: "ru",
        prompt: state === "chat_zoya" ? "Вопрос о молоке, питании, здоровье" : "Вопрос о ферме Шерь Козу",
      });

      if ("error" in transcription) {
        await ctx.reply(`⚠️ Ошибка распознавания: ${transcription.error}`);
        return;
      }

      const text = transcription.text;
      if (!text || text.trim().length === 0) {
        await ctx.reply("Не удалось распознать речь. Попробуйте ещё раз или напишите текстом.");
        return;
      }

      // Show transcription
      await ctx.reply(`🎤 _${escapeMarkdown(text)}_`, { parse_mode: "Markdown" });

      // Process as text message
      const { invokeLLM } = await import("./_core/llm");
      let systemPrompt: string;
      if (state === "chat_zoya") {
        systemPrompt = getZoyaTelegramPrompt(user.name ?? undefined);
      } else {
        systemPrompt = getMashaTelegramPrompt(user.name ?? undefined);
      }

      const history = await getSessionContext(chatId);
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: text },
      ];

      await ctx.replyWithChatAction("typing");
      const response = await invokeLLM({ messages, maxTokens: 2048 });
      const rawVoiceContent = response.choices?.[0]?.message?.content;
      const reply = (typeof rawVoiceContent === "string" ? rawVoiceContent : JSON.stringify(rawVoiceContent)) ?? "Не удалось получить ответ.";

      await appendToContext(chatId, [
        { role: "user", content: text },
        { role: "assistant", content: reply },
      ]);

      if (reply.length > 4000) {
        const chunks = splitMessage(reply, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(reply);
      }
    } catch (err) {
      console.error("[Telegram voice]", err);
      await ctx.reply("Не удалось обработать голосовое сообщение. Попробуйте текстом.");
    }
  });
}

/* ─── AI Prompts (compact versions for Telegram) ─── */

function getZoyaTelegramPrompt(userName?: string): string {
  let prompt = `Ты — Зоя, AI-нутрициолог семейной фермы «Шерь Козу».
Ты отвечаешь в Telegram, поэтому будь краткой (до 300 слов), используй простое форматирование.
Специализация: козье и овечье молоко, молочная нутрициология, аллергии, детское питание, сыры.
Отвечай на русском языке. Будь дружелюбной и профессиональной.
Если вопрос не связан с питанием или молочной продукцией — вежливо перенаправь.
Не придумывай данные — если не знаешь точный ответ, скажи об этом.`;
  if (userName) prompt += `\nСобеседника зовут ${userName}.`;
  return prompt;
}

function getMashaTelegramPrompt(userName?: string): string {
  let prompt = `Ты — Маша, AI-управляющая семейной фермой «Шерь Козу» (Sher Family Farm).
Ты отвечаешь в Telegram, поэтому будь краткой (до 300 слов), используй простое форматирование.
Говоришь спокойно, ласково, с лёгким обаянием.
Знаешь всё о ферме: животные (Мира, Лола, Руфа, Злата), модель персонального фермерства, доставки, клуб владельцев.
Расположение: Истринский район Подмосковья, 65 км от Москвы.
Отвечай на русском языке. Если не знаешь точный ответ — честно скажи и предложи связаться с фермой.`;
  if (userName) prompt += `\nСобеседника зовут ${userName}.`;
  return prompt;
}

/* ─── Push Notification Dispatcher ─── */

export async function sendTelegramNotification(
  userOpenId: string,
  message: string,
  options?: { parseMode?: "Markdown" | "MarkdownV2" | "HTML" },
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Get user's telegramChatId
    const [user] = await db
      .select({ telegramChatId: users.telegramChatId })
      .from(users)
      .where(eq(users.openId, userOpenId))
      .limit(1);

    if (!user?.telegramChatId) return false;

    const bot = getBot();
    await bot.api.sendMessage(user.telegramChatId, message, {
      parse_mode: options?.parseMode,
    });
    return true;
  } catch (err) {
    console.error("[Telegram Push] Failed to send notification:", err);
    return false;
  }
}

/* ─── Webhook Handler for Express ─── */

export function getTelegramWebhookHandler() {
  const bot = getBot();
  return webhookCallback(bot, "express");
}

/* ─── Utility ─── */

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
