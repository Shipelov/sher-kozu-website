import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Seed tierProductCatalog with all products per tier
const products = [
  // BASIC tier products (minTier = basic)
  { minTier: "basic", productType: "milk", label: "Козье молоко", species: "goat", conversionRatio: 1, unit: "л", sortOrder: 1, description: "Свежее цельное козье молоко" },
  { minTier: "basic", productType: "milk", label: "Овечье молоко", species: "sheep", conversionRatio: 1, unit: "л", sortOrder: 2, description: "Свежее цельное овечье молоко" },
  { minTier: "basic", productType: "kefir", label: "Козий кефир", species: "goat", conversionRatio: 1.1, unit: "л", sortOrder: 3, description: "Натуральный козий кефир" },
  { minTier: "basic", productType: "kefir", label: "Овечий кефир", species: "sheep", conversionRatio: 1.1, unit: "л", sortOrder: 4, description: "Натуральный овечий кефир" },
  { minTier: "basic", productType: "yogurt", label: "Козий йогурт", species: "goat", conversionRatio: 1.2, unit: "л", sortOrder: 5, description: "Натуральный козий йогурт без добавок" },
  { minTier: "basic", productType: "yogurt", label: "Овечий йогурт", species: "sheep", conversionRatio: 1.2, unit: "л", sortOrder: 6, description: "Натуральный овечий йогурт" },
  { minTier: "basic", productType: "smetana", label: "Козья сметана", species: "goat", conversionRatio: 2.5, unit: "л", sortOrder: 7, description: "Густая козья сметана" },
  { minTier: "basic", productType: "smetana", label: "Овечья сметана", species: "sheep", conversionRatio: 2.5, unit: "л", sortOrder: 8, description: "Густая овечья сметана" },

  // STANDARD tier products (minTier = standard)
  { minTier: "standard", productType: "brynza", label: "Брынза из козьего молока", species: "goat", conversionRatio: 5, unit: "кг", sortOrder: 10, description: "Классическая брынза, выдержка до 3 мес." },
  { minTier: "standard", productType: "brynza", label: "Брынза из овечьего молока", species: "sheep", conversionRatio: 5, unit: "кг", sortOrder: 11, description: "Классическая овечья брынза" },
  { minTier: "standard", productType: "kachotta", label: "Качотта козья", species: "goat", conversionRatio: 7, unit: "кг", sortOrder: 12, description: "Полутвёрдый итальянский сыр, созревание 1-3 мес." },
  { minTier: "standard", productType: "halumi", label: "Халуми", species: "both", conversionRatio: 6, unit: "кг", sortOrder: 13, description: "Кипрский рассольный сыр для жарки" },
  { minTier: "standard", productType: "ricotta", label: "Рикотта с травами", species: "both", conversionRatio: 4, unit: "кг", sortOrder: 14, description: "Сезонный специалитет — рикотта с фермерскими травами" },
  { minTier: "standard", productType: "camembert", label: "Козий камамбер", species: "goat", conversionRatio: 8, unit: "кг", sortOrder: 15, description: "Мягкий сыр с белой плесенью, созревание 3-4 нед." },

  // PROFESSIONAL tier products (minTier = professional)
  { minTier: "professional", productType: "aged_cheese", label: "Выдержанный твёрдый сыр", species: "both", conversionRatio: 10, unit: "кг", sortOrder: 20, description: "Твёрдый сыр, созревание 3-12 мес." },
  { minTier: "professional", productType: "blue_cheese", label: "Сыр с голубой плесенью", species: "both", conversionRatio: 9, unit: "кг", sortOrder: 21, description: "Авторский сыр с благородной плесенью" },
  { minTier: "professional", productType: "smoked_cheese", label: "Копчёный сыр", species: "both", conversionRatio: 8, unit: "кг", sortOrder: 22, description: "Сыр холодного копчения на ольховой щепе" },
  { minTier: "professional", productType: "butter", label: "Козье масло", species: "goat", conversionRatio: 20, unit: "кг", sortOrder: 23, description: "Натуральное козье сливочное масло" },
  { minTier: "professional", productType: "condensed_milk", label: "Козья сгущёнка", species: "goat", conversionRatio: 3, unit: "л", sortOrder: 24, description: "Варёная сгущёнка из козьего молока" },
  { minTier: "professional", productType: "fermented_drink", label: "Ферментированный напиток", species: "both", conversionRatio: 1.5, unit: "л", sortOrder: 25, description: "Экспериментальный ферментированный молочный напиток" },
];

for (const p of products) {
  await conn.execute(
    `INSERT INTO tierProductCatalog (minTier, productType, label, tpc_species, conversionRatio, unit, description, isEnabled, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [p.minTier, p.productType, p.label, p.species, p.conversionRatio, p.unit, p.description, p.sortOrder]
  );
  console.log(`✅ Added: ${p.label} (minTier=${p.minTier})`);
}

console.log(`\n✅ Seeded ${products.length} products into tierProductCatalog`);
await conn.end();
