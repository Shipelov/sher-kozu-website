import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cmsBlocks } from "../../drizzle/schema";
import { storagePut } from "../storage";

/**
 * CMS Router — admin-managed content blocks for public pages.
 * Public pages fetch blocks via `getPageBlocks` (public procedure).
 * Admin manages blocks via CRUD procedures.
 */
export const cmsRouter = router({
  /**
   * Get all blocks for a page (public — used by frontend pages).
   * Returns only visible blocks by default.
   */
  getPageBlocks: publicProcedure
    .input(z.object({
      page: z.string().min(1).max(64),
      includeHidden: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(cmsBlocks)
        .where(eq(cmsBlocks.page, input.page))
        .orderBy(asc(cmsBlocks.sortOrder));

      if (input.includeHidden) return rows;
      return rows.filter((r: typeof rows[number]) => r.visible);
    }),

  /**
   * Get all blocks across all pages (admin — for the CMS editor).
   */
  listAll: adminProcedure
    .query(async () => {
      const db = await getDb();
      return db
        .select()
        .from(cmsBlocks)
        .orderBy(asc(cmsBlocks.page), asc(cmsBlocks.sortOrder));
    }),

  /**
   * Create or update a content block (upsert by page + blockKey).
   */
  upsertBlock: adminProcedure
    .input(z.object({
      page: z.string().min(1).max(64),
      blockKey: z.string().min(1).max(128),
      label: z.string().min(1).max(255),
      contentType: z.enum(["text", "richtext", "image", "json"]).default("text"),
      content: z.string().max(50000).nullable().optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
      section: z.string().max(128).nullable().optional(),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      visible: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      // Check if block exists
      const existing = await db
        .select()
        .from(cmsBlocks)
        .where(
          and(
            eq(cmsBlocks.page, input.page),
            eq(cmsBlocks.blockKey, input.blockKey),
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(cmsBlocks)
          .set({
            label: input.label,
            contentType: input.contentType,
            content: input.content ?? null,
            imageUrl: input.imageUrl ?? null,
            section: input.section ?? null,
            sortOrder: input.sortOrder,
            visible: input.visible,
          })
          .where(eq(cmsBlocks.id, existing[0].id));
        return { id: existing[0].id, action: "updated" as const };
      }

      const result = await db.insert(cmsBlocks).values({
        page: input.page,
        blockKey: input.blockKey,
        label: input.label,
        contentType: input.contentType,
        content: input.content ?? null,
        imageUrl: input.imageUrl ?? null,
        section: input.section ?? null,
        sortOrder: input.sortOrder,
        visible: input.visible,
      });
      return { id: Number(result[0].insertId), action: "created" as const };
    }),

  /**
   * Update only the content of an existing block (quick inline edit).
   */
  updateContent: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      content: z.string().max(50000).nullable().optional(),
      imageUrl: z.string().max(2048).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const updates: Record<string, unknown> = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;

      if (Object.keys(updates).length === 0) {
        return { success: true };
      }

      await db.update(cmsBlocks).set(updates).where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Toggle block visibility.
   */
  toggleVisibility: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      visible: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db
        .update(cmsBlocks)
        .set({ visible: input.visible })
        .where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Delete a content block.
   */
  deleteBlock: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(cmsBlocks).where(eq(cmsBlocks.id, input.id));
      return { success: true };
    }),

  /**
   * Upload an image for a CMS block and update the block's imageUrl.
   */
  uploadImage: adminProcedure
    .input(z.object({
      blockId: z.number().int().positive(),
      fileName: z.string().min(1).max(180),
      mimeType: z.string().min(1).max(120),
      base64Data: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const buffer = Buffer.from(input.base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `cms/${input.blockId}-${suffix}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      await db
        .update(cmsBlocks)
        .set({ imageUrl: url, contentType: "image" })
        .where(eq(cmsBlocks.id, input.blockId));

      return { url };
    }),

  /**
   * Seed default blocks for a page if they don't exist yet.
   * Called once when admin first opens the CMS editor.
   */
  seedDefaults: adminProcedure
    .input(z.object({ page: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const existing = await db
        .select()
        .from(cmsBlocks)
        .where(eq(cmsBlocks.page, input.page))
        .limit(1);

      if (existing.length > 0) {
        return { seeded: false, message: "Blocks already exist for this page" };
      }

      const defaults = getDefaultBlocks(input.page);
      if (defaults.length === 0) {
        return { seeded: false, message: "No default blocks defined for this page" };
      }

      for (const block of defaults) {
        await db.insert(cmsBlocks).values(block);
      }

      return { seeded: true, count: defaults.length };
    }),
});

/**
 * Default content blocks for each page.
 * These match the hardcoded content in the current page components.
 */
function getDefaultBlocks(page: string) {
  if (page === "home") return homeDefaults;
  if (page === "catalog") return catalogDefaults;
  return [];
}

const homeDefaults = [
  // Section 1 — Hero
  { page: "home", blockKey: "hero_badge", label: "Hero — Бейдж", contentType: "text" as const, content: "Первый в России клуб персонального фермерства", section: "Hero", sortOrder: 1, visible: true },
  { page: "home", blockKey: "hero_title", label: "Hero — Заголовок", contentType: "text" as const, content: "Ваша ферма. Ваше молоко. Ваша история.", section: "Hero", sortOrder: 2, visible: true },
  { page: "home", blockKey: "hero_subtitle", label: "Hero — Описание", contentType: "richtext" as const, content: "Выберите конкретную козу или овцу элитной породы, наблюдайте за её жизнью, воспитывайте её на ферме и получайте именные молочные продукты — с прозрачным процессом создания.", section: "Hero", sortOrder: 3, visible: true },
  { page: "home", blockKey: "hero_image", label: "Hero — Фото", contentType: "image" as const, content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp", section: "Hero", sortOrder: 4, visible: true },
  { page: "home", blockKey: "hero_image_caption", label: "Hero — Подпись к фото", contentType: "text" as const, content: "Конкретная ферма — конкретное животное с именем, породой и историей.", section: "Hero", sortOrder: 5, visible: true },

  // Section 2 — How It Works
  { page: "home", blockKey: "howit_title", label: "Как это работает — Подзаголовок", contentType: "text" as const, content: "Как это работает", section: "Как это работает", sortOrder: 10, visible: true },
  { page: "home", blockKey: "howit_heading", label: "Как это работает — Заголовок", contentType: "text" as const, content: "Три шага — от выбора животного до именной коробки с продуктами", section: "Как это работает", sortOrder: 11, visible: true },
  { page: "home", blockKey: "howit_subtitle", label: "Как это работает — Описание", contentType: "richtext" as const, content: "Персональное фермерство — это просто. Выберите животное, наблюдайте за его жизнью и получайте продукты с прозрачной историей.", section: "Как это работает", sortOrder: 12, visible: true },
  { page: "home", blockKey: "steps", label: "Как это работает — 3 шага", contentType: "json" as const, content: JSON.stringify([
    { index: "01", title: "Выберите своё животное", text: "В каталоге — козы и овцы элитных пород: англо-нубийские, альпийские, остфризские. У каждого — имя, характер, элитная родословная и прозрачная история." },
    { index: "02", title: "Наблюдайте за жизнью на ферме", text: "Личный кабинет с профилем животного, дневником, фотоотчётами и событиями клуба. Фермерство становится частью вашего ритма, а не разовой покупкой." },
    { index: "03", title: "Получайте именные продукты", text: "Молоко, сыры и сезонные наборы именно от вашего животного — в именной коробке с трекером от надоя до двери. Наслаждайтесь сами и радуйте своих близких." },
  ]), section: "Как это работает", sortOrder: 13, visible: true },

  // Section 3 — For Whom
  { page: "home", blockKey: "forwhom_title", label: "Для кого — Подзаголовок", contentType: "text" as const, content: "Для кого это", section: "Для кого", sortOrder: 20, visible: true },
  { page: "home", blockKey: "forwhom_heading", label: "Для кого — Заголовок", contentType: "text" as const, content: "Для тех, кому важна не только еда, но и история за ней", section: "Для кого", sortOrder: 21, visible: true },
  { page: "home", blockKey: "forwhom_subtitle", label: "Для кого — Описание", contentType: "richtext" as const, content: "Персональное фермерство — это осознанный выбор. Не массовый продукт, а личная связь с источником для тех, кто ценит прозрачность и качество.", section: "Для кого", sortOrder: 22, visible: true },
  { page: "home", blockKey: "audiences", label: "Для кого — Аудитории", contentType: "json" as const, content: JSON.stringify([
    { title: "Семьи с детьми", text: "Ребёнок знает свою козу по имени, пьёт её молоко и приезжает на ферму как к другу. Детская академия, мастер-классы по сыроварению и семейные визиты — это не покупка, а воспитание." },
    { title: "Ценители качества", text: "Полная прозрачность: порода, состав молока, условия содержания, маршрут доставки. Элитная генетика европейского уровня — Остфриз, Лакон, Англо-нубийская." },
    { title: "Дарители уникальных подарков", text: "Именной сыр с вашим именем на этикетке, подарочный абонемент на продукцию «от моей козы» — подарок, который живёт и рассказывает историю." },
    { title: "Участники закрытого клуба", text: "Ужины на ферме, сезонные визиты, дни рождения животных, мастер-классы. Сообщество людей, объединённых общими ценностями." },
  ]), section: "Для кого", sortOrder: 23, visible: true },

  // Section 4 — Gallery Preview
  { page: "home", blockKey: "gallery_title", label: "Галерея — Подзаголовок", contentType: "text" as const, content: "Галерея животных", section: "Галерея", sortOrder: 30, visible: true },
  { page: "home", blockKey: "gallery_heading", label: "Галерея — Заголовок", contentType: "text" as const, content: "Познакомьтесь с животными фермы", section: "Галерея", sortOrder: 31, visible: true },
  { page: "home", blockKey: "gallery_subtitle", label: "Галерея — Описание", contentType: "richtext" as const, content: "Элитные породы с европейской генетикой. У каждого — имя, характер, родословная и доступные доли.", section: "Галерея", sortOrder: 32, visible: true },
  { page: "home", blockKey: "goats_card_title", label: "Галерея — Козы заголовок", contentType: "text" as const, content: "Англо-нубийские и альпийские козы", section: "Галерея", sortOrder: 33, visible: true },
  { page: "home", blockKey: "goats_card_text", label: "Галерея — Козы описание", contentType: "richtext" as const, content: "Молоко жирностью до 5% с исключительным сливочным вкусом. «Королевские» породы французского сыроделия — основа для артизанальных сыров.", section: "Галерея", sortOrder: 34, visible: true },
  { page: "home", blockKey: "sheep_card_title", label: "Галерея — Овцы заголовок", contentType: "text" as const, content: "Овцы Остфриз и Лакон", section: "Галерея", sortOrder: 35, visible: true },
  { page: "home", blockKey: "sheep_card_text", label: "Галерея — Овцы описание", contentType: "richtext" as const, content: "Самые высокоудойные породы в мире. Молоко с высоким содержанием жира и белка — идеально для сыроварения. Генетика уровня Рокфора.", section: "Галерея", sortOrder: 36, visible: true },

  // Section 5 — Why Us
  { page: "home", blockKey: "whyus_title", label: "Почему мы — Подзаголовок", contentType: "text" as const, content: "Почему Шерь Козу", section: "Почему мы", sortOrder: 40, visible: true },
  { page: "home", blockKey: "whyus_heading", label: "Почему мы — Заголовок", contentType: "text" as const, content: "Не просто продукты — личная история с фермой", section: "Почему мы", sortOrder: 41, visible: true },
  { page: "home", blockKey: "whyus_image", label: "Почему мы — Фото", contentType: "image" as const, content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_club_visit-mmi2c8j4W8VB63TUjVvZ4S.webp", section: "Почему мы", sortOrder: 42, visible: true },
  { page: "home", blockKey: "values", label: "Почему мы — Ценности", contentType: "json" as const, content: JSON.stringify([
    { title: "Эмоциональная связь", text: "Профиль животного с именем, характером, дневником и фотоотчётами. Это не покупка — это причастность к живой истории.", stat: "100%", statLabel: "прозрачность" },
    { title: "Радикальная прозрачность", text: "Вы видите всё: породу, родословную, состав молока, условия ухода и маршрут доставки. Никаких чёрных ящиков.", stat: "→", statLabel: "от надоя до двери" },
    { title: "Элитные породы", text: "Англо-нубийские козы, альпийские козы, овцы Остфриз и Лакон — генетика европейского уровня, обосновывающая премиальное качество.", stat: "4", statLabel: "породы" },
    { title: "Доставка до двери", text: "Именная коробка с продуктами от вашего животного — регулярно, бережно, с трекером каждого этапа.", stat: "2×", statLabel: "в месяц" },
  ]), section: "Почему мы", sortOrder: 43, visible: true },
  { page: "home", blockKey: "testimonials", label: "Почему мы — Отзывы", contentType: "json" as const, content: JSON.stringify([
    { text: "Дочка каждое утро спрашивает, как дела у Марты. Молоко пьёт только «от нашей козы». Это больше, чем продукт — это ритуал.", author: "Анна К.", role: "мама двоих детей" },
    { text: "Подарил жене долю в козе на годовщину. Теперь у нас семейная традиция — ездить на ферму каждый сезон.", author: "Дмитрий Р.", role: "участник клуба" },
    { text: "Впервые вижу такую прозрачность: знаю, от какого животного молоко, когда надоено и когда доставят. Это другой уровень.", author: "Елена М.", role: "ценитель натуральных продуктов" },
  ]), section: "Почему мы", sortOrder: 44, visible: true },

  // Section 6 — Products
  { page: "home", blockKey: "products_title", label: "Продукты — Подзаголовок", contentType: "text" as const, content: "Что вы получаете", section: "Продукты", sortOrder: 50, visible: true },
  { page: "home", blockKey: "products_heading", label: "Продукты — Заголовок", contentType: "text" as const, content: "Что внутри именной коробки", section: "Продукты", sortOrder: 51, visible: true },
  { page: "home", blockKey: "products_subtitle", label: "Продукты — Описание", contentType: "richtext" as const, content: "Каждый продукт — результат вашей связи с конкретным животным. С трекером происхождения от надоя до двери.", section: "Продукты", sortOrder: 52, visible: true },
  { page: "home", blockKey: "products_image", label: "Продукты — Фото", contentType: "image" as const, content: null, imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp", section: "Продукты", sortOrder: 53, visible: true },
  { page: "home", blockKey: "products_list", label: "Продукты — Список", contentType: "json" as const, content: JSON.stringify([
    { label: "Свежее молоко", desc: "Козье или овечье молоко от вашего животного. Доставка в течение 24 часов после надоя." },
    { label: "Именные сыры", desc: "Мягкие и выдержанные сыры ручной работы — с именем владельца на этикетке. Статусный подарок и семейная традиция." },
    { label: "Сезонные наборы", desc: "Подарочные боксы с лучшими продуктами фермы — для себя, семьи или в подарок близким." },
  ]), section: "Продукты", sortOrder: 54, visible: true },

  // Section 7 — CTA
  { page: "home", blockKey: "cta_title", label: "CTA — Подзаголовок", contentType: "text" as const, content: "Начните сейчас", section: "Призыв к действию", sortOrder: 60, visible: true },
  { page: "home", blockKey: "cta_heading", label: "CTA — Заголовок", contentType: "text" as const, content: "Станьте частью первого в России клуба персонального фермерства", section: "Призыв к действию", sortOrder: 61, visible: true },
  { page: "home", blockKey: "cta_subtitle", label: "CTA — Описание", contentType: "richtext" as const, content: "Выберите животное, познакомьтесь с его историей и начните получать именные продукты. Количество мест в клубе ограничено — мы работаем с каждым владельцем лично.", section: "Призыв к действию", sortOrder: 62, visible: true },
];

const catalogDefaults = [
  { page: "catalog", blockKey: "badge", label: "Бейдж", contentType: "text" as const, content: "Каталог животных", section: "Шапка", sortOrder: 1, visible: true },
  { page: "catalog", blockKey: "heading", label: "Заголовок", contentType: "text" as const, content: "Найдите своё животное элитной породы", section: "Шапка", sortOrder: 2, visible: true },
  { page: "catalog", blockKey: "subtitle", label: "Описание", contentType: "richtext" as const, content: "Козы и овцы с именем, характером и историей. Выберите по породе или статусу участия — и начните свою историю персонального фермерства.", section: "Шапка", sortOrder: 3, visible: true },
  { page: "catalog", blockKey: "status_relationship", label: "Статус — В отношениях", contentType: "richtext" as const, content: "Животное уже нашло свою семью. Все доли оформлены, владелец получает именные продукты.", section: "Статусы", sortOrder: 10, visible: true },
  { page: "catalog", blockKey: "status_available", label: "Статус — На выданье", contentType: "richtext" as const, content: "Животное ждёт свою семью. Все доли свободны — можно стать единственным владельцем.", section: "Статусы", sortOrder: 11, visible: true },
  { page: "catalog", blockKey: "status_shared", label: "Статус — Доступно для участия", contentType: "richtext" as const, content: "Одна семья уже участвует, но есть свободные доли. Можно присоединиться и разделить заботу о животном.", section: "Статусы", sortOrder: 12, visible: true },
];
