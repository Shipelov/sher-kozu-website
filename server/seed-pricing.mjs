/**
 * Seed script for pricing section data.
 * Run with: node server/seed-pricing.mjs
 * 
 * Seeds:
 * 1. pricingTiers — 4 tariff plans (Guest, Basic, Standard, Professional)
 * 2. marketPrices — real market prices from sff.market, Kalachevo, Esh Derevenskoe, etc.
 * 3. productConversions — milk-to-product conversion rates
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { pathToFileURL } from 'node:url';

// Helper: convert rubles to kopecks
const rub = (r) => Math.round(r * 100);

// ─── 1. Pricing Tiers ───────────────────────────────────────────────────────

const tiers = [
  {
    slug: 'guest',
    name: 'Гость фермы',
    subtitle: 'Познакомьтесь с фермой без обязательств',
    sharePercent: 0,
    minAnimals: 0,
    monthlyFeeMinor: 0,
    annualDiscountPercent: 0,
    renewalDiscountPercent: 0,
    packageDiscountPercent: 0,
    planChangeFrequency: null,
    deliveryAddresses: 0,
    personalizedLabelFree: false,
    agedCheeseAccess: false,
    maxGiftSubscriptionMonths: 0,
    farmVisitsPerYear: 0,
    clubEventsPerYear: 0,
    shopDiscountPercent: 5,
    referralMultiplier: 1,
    hasPersonalManager: false,
    hasDigitalDiary: false,
    badgeSystemLevel: 'none',
    displayOrder: 0,
    isActive: true,
    heroDescription: 'Бесплатный доступ к каталогу животных, блогу фермы и магазину. Идеальный способ познакомиться с экосистемой Шерь Козу перед тем, как стать владельцем.',
    targetAudience: 'Новые посетители, интересующиеся фермерской продукцией',
    featureHighlights: JSON.stringify([
      'Доступ к каталогу животных',
      'Блог и новости фермы',
      'Магазин фермерской продукции',
      'Скидка 5% в магазине'
    ]),
    limitations: JSON.stringify([
      'Нет права владения животным',
      'Нет доступа к продуктовому плану',
      'Нет доступа к клубу владельцев'
    ])
  },
  {
    slug: 'basic',
    name: 'Базовый',
    subtitle: 'Совладение 50% — ваш первый шаг в персональное фермерство',
    sharePercent: 50,
    minAnimals: 1,
    monthlyFeeMinor: rub(7500),
    annualDiscountPercent: 15,
    renewalDiscountPercent: 20,
    packageDiscountPercent: 0,
    planChangeFrequency: 'quarterly',
    deliveryAddresses: 1,
    personalizedLabelFree: false,
    agedCheeseAccess: false,
    maxGiftSubscriptionMonths: 0,
    farmVisitsPerYear: 2,
    clubEventsPerYear: 4,
    shopDiscountPercent: 10,
    referralMultiplier: 2,
    hasPersonalManager: false,
    hasDigitalDiary: true,
    badgeSystemLevel: 'basic',
    displayOrder: 1,
    isActive: true,
    heroDescription: 'Станьте совладельцем животного с долей 50%. Получайте половину надоя в виде продуктов по вашему выбору. Идеальный старт для знакомства с персональным фермерством.',
    targetAudience: 'Семьи, желающие попробовать фермерскую продукцию с личной историей',
    featureHighlights: JSON.stringify([
      'Доля 50% в выбранном животном',
      '50% надоя → ваш продуктовый план',
      'Смена плана раз в квартал',
      '1 адрес доставки',
      '2 визита на ферму в год',
      '4 клубных мероприятия в год',
      'Цифровой дневник животного',
      'Скидка 10% в магазине',
      'Персональная этикетка (платно)'
    ]),
    limitations: JSON.stringify([
      'Молодые сыры до 6 месяцев выдержки',
      'Подарочная отправка без подписки',
      'Нет персонального менеджера'
    ])
  },
  {
    slug: 'standard',
    name: 'Стандартный',
    subtitle: 'Полное владение 100% — ваше животное, ваши продукты',
    sharePercent: 100,
    minAnimals: 1,
    monthlyFeeMinor: rub(14900),
    annualDiscountPercent: 15,
    renewalDiscountPercent: 20,
    packageDiscountPercent: 0,
    planChangeFrequency: 'monthly',
    deliveryAddresses: 2,
    personalizedLabelFree: false,
    agedCheeseAccess: false,
    maxGiftSubscriptionMonths: 3,
    farmVisitsPerYear: 4,
    clubEventsPerYear: 8,
    shopDiscountPercent: 15,
    referralMultiplier: 3,
    hasPersonalManager: false,
    hasDigitalDiary: true,
    badgeSystemLevel: 'extended',
    displayOrder: 2,
    isActive: true,
    heroDescription: 'Полное владение животным — 100% надоя в вашем распоряжении. Максимальная свобода в выборе продуктов, два адреса доставки и возможность дарить подписку друзьям.',
    targetAudience: 'Семьи, ценящие полный контроль над происхождением продуктов',
    featureHighlights: JSON.stringify([
      'Полное владение 100%',
      'Весь надой → ваш продуктовый план',
      'Смена плана раз в месяц',
      '2 адреса доставки',
      'Подарочная подписка до 3 месяцев',
      '4 визита на ферму в год',
      '8 клубных мероприятий в год',
      'Молодые сыры до 6 мес. выдержки',
      'Скидка 15% в магазине',
      'Персональная этикетка (платно)'
    ]),
    limitations: JSON.stringify([
      'Выдержанные сыры 6-24 мес. недоступны',
      'Нет персонального менеджера'
    ])
  },
  {
    slug: 'professional',
    name: 'Профессиональный',
    subtitle: 'Мини-стадо от 3 животных — максимум привилегий и эксклюзивный аффинаж',
    sharePercent: 100,
    minAnimals: 3,
    monthlyFeeMinor: rub(39900),
    annualDiscountPercent: 15,
    renewalDiscountPercent: 20,
    packageDiscountPercent: 10,
    planChangeFrequency: 'weekly',
    deliveryAddresses: 5,
    personalizedLabelFree: true,
    agedCheeseAccess: true,
    maxGiftSubscriptionMonths: 12,
    farmVisitsPerYear: 12,
    clubEventsPerYear: 24,
    shopDiscountPercent: 20,
    referralMultiplier: 5,
    hasPersonalManager: true,
    hasDigitalDiary: true,
    badgeSystemLevel: 'full',
    displayOrder: 3,
    isActive: true,
    heroDescription: 'Собственное мини-стадо от 3 животных со скидкой 10% на совокупный разовый платёж. Эксклюзивный доступ к выдержанным сырам 6–24 месяцев в погребе фермы с высочайшим аффинажным стандартом. Персональный менеджер и максимальные привилегии.',
    targetAudience: 'Ценители, гурманы и семьи, стремящиеся к максимальному погружению в фермерскую культуру',
    featureHighlights: JSON.stringify([
      'Мини-стадо от 3 животных (100% каждое)',
      'Скидка 10% на совокупный разовый платёж',
      'Смена плана раз в неделю',
      '5 адресов доставки',
      'Подарочная подписка до 12 месяцев',
      'Эксклюзивный аффинаж 6-24 мес. в погребе фермы',
      'Персональная этикетка бесплатно',
      'Персональный менеджер',
      '12 визитов на ферму в год',
      '24 клубных мероприятия в год',
      'Скидка 20% в магазине',
      'Полная система бейджей'
    ]),
    limitations: JSON.stringify([])
  }
];

/** Идемпотентный сид тарифов, рыночных цен и конверсий. Используется и CLI, и scripts/seed-test-db.mjs. */
export async function seedPricing(conn) {
console.log('Seeding pricing tiers...');
for (const tier of tiers) {
  const cols = Object.keys(tier);
  const placeholders = cols.map(() => '?').join(', ');
  const updateClauses = cols.filter(c => c !== 'slug').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  await conn.execute(
    `INSERT INTO pricingTiers (${cols.map(c => '`' + c + '`').join(', ')}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClauses}`,
    Object.values(tier)
  );
  console.log(`  ✓ ${tier.name}`);
}

// ─── 2. Market Prices ────────────────────────────────────────────────────────

const marketPricesData = [
  // Goat products
  { productName: 'Козье молоко цельное', productSlug: 'goat-milk', mp_species: 'goat', mp_category: 'milk', mp_unit: 'liter', minPriceMinor: rub(200), maxPriceMinor: rub(400), avgPriceMinor: rub(300), source: 'Перекрёсток, фермерские хозяйства', mp_tierAvailability: 'all' },
  { productName: 'Козий кефир', productSlug: 'goat-kefir', mp_species: 'goat', mp_category: 'fermented', mp_unit: 'liter', minPriceMinor: rub(450), maxPriceMinor: rub(750), avgPriceMinor: rub(600), source: 'Средняя по рынку', mp_tierAvailability: 'all' },
  { productName: 'Козий творог', productSlug: 'goat-tvorog', mp_species: 'goat', mp_category: 'fermented', mp_unit: 'kg', minPriceMinor: rub(1200), maxPriceMinor: rub(2000), avgPriceMinor: rub(1600), source: 'Калачёво', mp_tierAvailability: 'all' },
  { productName: 'Козья сметана', productSlug: 'goat-smetana', mp_species: 'goat', mp_category: 'fermented', mp_unit: 'kg', minPriceMinor: rub(1400), maxPriceMinor: rub(2200), avgPriceMinor: rub(1800), source: 'Средняя по рынку', mp_tierAvailability: 'all' },
  { productName: 'Козий мягкий сыр (рикотта, шевр)', productSlug: 'goat-soft-cheese', mp_species: 'goat', mp_category: 'soft_cheese', mp_unit: 'kg', minPriceMinor: rub(2500), maxPriceMinor: rub(3800), avgPriceMinor: rub(3150), source: 'Ешь Деревенское', mp_tierAvailability: 'all' },
  { productName: 'Козий полутвёрдый сыр (качотта)', productSlug: 'goat-semi-hard-cheese', mp_species: 'goat', mp_category: 'semi_hard_cheese', mp_unit: 'kg', minPriceMinor: rub(3500), maxPriceMinor: rub(5500), avgPriceMinor: rub(4500), source: 'Средняя по рынку', mp_tierAvailability: 'standard_plus' },
  { productName: 'Козий выдержанный сыр (6-24 мес.)', productSlug: 'goat-aged-cheese', mp_species: 'goat', mp_category: 'aged_cheese', mp_unit: 'kg', minPriceMinor: rub(5000), maxPriceMinor: rub(8000), avgPriceMinor: rub(6490), source: 'Gourmeria', mp_tierAvailability: 'professional_only' },
  // Sheep products
  { productName: 'Овечье молоко цельное', productSlug: 'sheep-milk', mp_species: 'sheep', mp_category: 'milk', mp_unit: 'liter', minPriceMinor: rub(800), maxPriceMinor: rub(1200), avgPriceMinor: rub(980), source: 'Ферма М2, sff.market', mp_tierAvailability: 'all' },
  { productName: 'Овечий кефир', productSlug: 'sheep-kefir', mp_species: 'sheep', mp_category: 'fermented', mp_unit: 'liter', minPriceMinor: rub(1400), maxPriceMinor: rub(2100), avgPriceMinor: rub(1728), source: 'sff.market (432₽/0.25л)', mp_tierAvailability: 'all' },
  { productName: 'Овечий творог', productSlug: 'sheep-tvorog', mp_species: 'sheep', mp_category: 'fermented', mp_unit: 'kg', minPriceMinor: rub(2800), maxPriceMinor: rub(3900), avgPriceMinor: rub(3336), source: 'sff.market (834₽/0.25кг)', mp_tierAvailability: 'all' },
  { productName: 'Овечья сметана', productSlug: 'sheep-smetana', mp_species: 'sheep', mp_category: 'fermented', mp_unit: 'kg', minPriceMinor: rub(3800), maxPriceMinor: rub(5700), avgPriceMinor: rub(4740), source: 'sff.market (948₽/0.2л)', mp_tierAvailability: 'all' },
  { productName: 'Овечий мягкий сыр (адыгейский)', productSlug: 'sheep-soft-cheese', mp_species: 'sheep', mp_category: 'soft_cheese', mp_unit: 'kg', minPriceMinor: rub(2000), maxPriceMinor: rub(3200), avgPriceMinor: rub(2567), source: 'sff.market', mp_tierAvailability: 'all' },
  { productName: 'Овечий полутвёрдый сыр (качотта)', productSlug: 'sheep-semi-hard-cheese', mp_species: 'sheep', mp_category: 'semi_hard_cheese', mp_unit: 'kg', minPriceMinor: rub(8500), maxPriceMinor: rub(12000), avgPriceMinor: rub(10660), source: 'sff.market', mp_tierAvailability: 'standard_plus' },
  { productName: 'Овечий твёрдый сыр (пекорино, манчего)', productSlug: 'sheep-hard-cheese', mp_species: 'sheep', mp_category: 'hard_cheese', mp_unit: 'kg', minPriceMinor: rub(8900), maxPriceMinor: rub(10080), avgPriceMinor: rub(9350), source: 'sff.market', mp_tierAvailability: 'standard_plus' },
  { productName: 'Овечий выдержанный сыр (12-24 мес.)', productSlug: 'sheep-aged-cheese', mp_species: 'sheep', mp_category: 'aged_cheese', mp_unit: 'kg', minPriceMinor: rub(9000), maxPriceMinor: rub(12000), avgPriceMinor: rub(10080), source: 'sff.market', mp_tierAvailability: 'professional_only' },
  { productName: 'Овечье масло сливочное', productSlug: 'sheep-butter', mp_species: 'sheep', mp_category: 'butter', mp_unit: 'kg', minPriceMinor: rub(3200), maxPriceMinor: rub(4800), avgPriceMinor: rub(4000), source: 'sff.market', mp_tierAvailability: 'standard_plus' },
];

console.log('\nSeeding market prices...');
for (const mp of marketPricesData) {
  const cols = Object.keys(mp);
  const placeholders = cols.map(() => '?').join(', ');
  const updateClauses = cols.filter(c => c !== 'productSlug').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
  await conn.execute(
    `INSERT INTO marketPrices (${cols.map(c => '`' + c + '`').join(', ')}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClauses}`,
    Object.values(mp)
  );
  console.log(`  ✓ ${mp.productName}`);
}

// ─── 3. Product Conversions ──────────────────────────────────────────────────

console.log('\nSeeding product conversions...');

// Get market price IDs
const [rows] = await conn.execute('SELECT id, productSlug FROM marketPrices');
const mpMap = {};
for (const r of rows) mpMap[r.productSlug] = r.id;

const conversions = [
  // Goat conversions
  { marketPriceId: mpMap['goat-milk'], milkLitersPerUnit: 1.0, pc_outputUnit: 'liter', notes: 'Прямая поставка цельного молока' },
  { marketPriceId: mpMap['goat-kefir'], milkLitersPerUnit: 1.2, pc_outputUnit: 'liter', notes: 'Кефирная закваска + молоко' },
  { marketPriceId: mpMap['goat-tvorog'], milkLitersPerUnit: 5.0, pc_outputUnit: 'kg', notes: '5 литров молока → 1 кг творога' },
  { marketPriceId: mpMap['goat-smetana'], milkLitersPerUnit: 4.0, pc_outputUnit: 'kg', notes: '4 литра молока → 1 кг сметаны' },
  { marketPriceId: mpMap['goat-soft-cheese'], milkLitersPerUnit: 8.0, pc_outputUnit: 'kg', notes: '8 литров → 1 кг мягкого сыра' },
  { marketPriceId: mpMap['goat-semi-hard-cheese'], milkLitersPerUnit: 10.0, pc_outputUnit: 'kg', notes: '10 литров → 1 кг полутвёрдого сыра' },
  { marketPriceId: mpMap['goat-aged-cheese'], milkLitersPerUnit: 12.0, pc_outputUnit: 'kg', notes: '12 литров → 1 кг выдержанного сыра (6-24 мес.)' },
  // Sheep conversions
  { marketPriceId: mpMap['sheep-milk'], milkLitersPerUnit: 1.0, pc_outputUnit: 'liter', notes: 'Прямая поставка цельного молока' },
  { marketPriceId: mpMap['sheep-kefir'], milkLitersPerUnit: 1.2, pc_outputUnit: 'liter', notes: 'Кефирная закваска + молоко' },
  { marketPriceId: mpMap['sheep-tvorog'], milkLitersPerUnit: 5.0, pc_outputUnit: 'kg', notes: '5 литров молока → 1 кг творога' },
  { marketPriceId: mpMap['sheep-smetana'], milkLitersPerUnit: 4.0, pc_outputUnit: 'kg', notes: '4 литра молока → 1 кг сметаны' },
  { marketPriceId: mpMap['sheep-soft-cheese'], milkLitersPerUnit: 8.0, pc_outputUnit: 'kg', notes: '8 литров → 1 кг мягкого сыра' },
  { marketPriceId: mpMap['sheep-semi-hard-cheese'], milkLitersPerUnit: 10.0, pc_outputUnit: 'kg', notes: '10 литров → 1 кг полутвёрдого сыра' },
  { marketPriceId: mpMap['sheep-hard-cheese'], milkLitersPerUnit: 10.0, pc_outputUnit: 'kg', notes: '10 литров → 1 кг твёрдого сыра' },
  { marketPriceId: mpMap['sheep-aged-cheese'], milkLitersPerUnit: 12.0, pc_outputUnit: 'kg', notes: '12 литров → 1 кг выдержанного сыра (12-24 мес.)' },
  { marketPriceId: mpMap['sheep-butter'], milkLitersPerUnit: 20.0, pc_outputUnit: 'kg', notes: '20 литров → 1 кг масла' },
];

for (const c of conversions) {
  if (!c.marketPriceId) {
    console.log(`  ⚠ Skipping conversion (missing marketPriceId for slug)`);
    continue;
  }
  // У productConversions нет unique-ключа, поэтому ON DUPLICATE KEY не работает — проверяем вручную
  const [existing] = await conn.execute(
    'SELECT id FROM productConversions WHERE marketPriceId = ? LIMIT 1',
    [c.marketPriceId]
  );
  if (existing.length > 0) {
    await conn.execute(
      'UPDATE productConversions SET milkLitersPerUnit = ?, pc_outputUnit = ?, notes = ? WHERE id = ?',
      [c.milkLitersPerUnit, c.pc_outputUnit, c.notes, existing[0].id]
    );
  } else {
    await conn.execute(
      'INSERT INTO productConversions (marketPriceId, milkLitersPerUnit, pc_outputUnit, notes) VALUES (?, ?, ?, ?)',
      [c.marketPriceId, c.milkLitersPerUnit, c.pc_outputUnit, c.notes]
    );
  }
  console.log(`  ✓ Conversion for marketPriceId=${c.marketPriceId}`);
}

console.log('\n✅ Pricing seed complete!');
}

// Запуск как CLI: node server/seed-pricing.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const conn = await mysql.createConnection(DATABASE_URL);
  try {
    await seedPricing(conn);
  } finally {
    await conn.end();
  }
}
