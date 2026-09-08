/**
 * Seed script for marketplace categories and items.
 * Run: node seed-marketplace.mjs
 * 
 * Uses direct SQL via the running server's tRPC API.
 * Alternatively, we insert directly via mysql2 using DATABASE_URL from env.
 */
import { createPool } from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Скрипт живёт в scripts/, .env — в корне репозитория
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const pool = createPool({ uri: DATABASE_URL, connectionLimit: 5 });

// ─── Helper ───
function slugify(text) {
  const map = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "j", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  };
  return text
    .toLowerCase()
    .split("")
    .map((c) => map[c] || c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Categories ───
const categories = [
  { name: "Кормление", slug: "kormlenie", description: "Вкусный и полезный рацион для вашего питомца", emoji: "🥕", sortOrder: 1 },
  { name: "СПА и груминг", slug: "spa-i-gruming", description: "Процедуры ухода за шерстью, копытами и общим состоянием", emoji: "🧖", sortOrder: 2 },
  { name: "Прогулки и активности", slug: "progulki-i-aktivnosti", description: "Активный отдых и приключения на свежем воздухе", emoji: "🌿", sortOrder: 3 },
  { name: "Дрессировка и обучение", slug: "dressirovka-i-obuchenie", description: "Тренировки, команды и развитие навыков", emoji: "🎓", sortOrder: 4 },
  { name: "Подарки и аксессуары", slug: "podarki-i-aksessuary", description: "Именные подарки и памятные аксессуары", emoji: "🎁", sortOrder: 5 },
  { name: "Здоровье и витамины", slug: "zdorovie-i-vitaminy", description: "Витамины, осмотры и профилактика", emoji: "💊", sortOrder: 6 },
  { name: "Особые события", slug: "osobye-sobytiya", description: "Праздники, уникальные впечатления и памятные моменты", emoji: "🎉", sortOrder: 7 },
];

// ─── Items ───
// metricEffectsJson: {happiness, health, attachment, mood, obedience}
const items = [
  // ── Категория 1: Кормление ──
  {
    category: "kormlenie",
    name: "Сено луговое",
    description: "Базовый рацион из отборных трав",
    priceSKC: 5,
    effects: { happiness: 0, health: 2, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 3, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Положить сено в кормушку", description: "Свежее луговое сено в кормушку животного" }],
    feedback: "Ммм, какое вкусное сено! Спасибо, что заботишься о моём рационе! 🌾",
  },
  {
    category: "kormlenie",
    name: "Морковка",
    description: "Любимое лакомство — хруст и радость",
    priceSKC: 8,
    effects: { happiness: 0, health: 0, attachment: 0, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 2, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Дать морковку", description: "Угостить животное свежей морковкой" }],
    feedback: "Хрум-хрум! Обожаю морковку! Ты знаешь мои любимые лакомства! 🥕",
  },
  {
    category: "kormlenie",
    name: "Яблоко",
    description: "Сезонный витаминный перекус",
    priceSKC: 8,
    effects: { happiness: 0, health: 1, attachment: 0, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 2, weeklyLimit: 0, monthlyLimit: 0, season: "autumn",
    checklist: [{ task: "Дать яблоко", description: "Угостить животное свежим яблоком" }],
    feedback: "Какое сочное яблочко! Осень — моё любимое время года! 🍎",
  },
  {
    category: "kormlenie",
    name: "Тыква",
    description: "Осенний суперфуд для пищеварения",
    priceSKC: 10,
    effects: { happiness: 0, health: 3, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "autumn",
    checklist: [{ task: "Нарезать и дать тыкву", description: "Нарезать тыкву на кусочки и положить в кормушку" }],
    feedback: "Тыква — это так полезно! Чувствую себя сильнее! 🎃",
  },
  {
    category: "kormlenie",
    name: "Премиум-микс зерновой",
    description: "Авторская смесь фермера с минералами",
    priceSKC: 15,
    effects: { happiness: 0, health: 4, attachment: 0, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Приготовить зерновой микс", description: "Смешать зерновую смесь и насыпать в кормушку" }],
    feedback: "Вот это завтрак! Фермерский микс — лучшее, что я пробовал(а)! ✨",
  },
  {
    category: "kormlenie",
    name: "Травяной букет",
    description: "Свежий букет из клевера, люцерны и тимофеевки",
    priceSKC: 12,
    effects: { happiness: 0, health: 2, attachment: 0, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "summer",
    checklist: [{ task: "Собрать травяной букет", description: "Собрать свежие травы и подать животному" }],
    feedback: "Какой ароматный букет! Лето пахнет клевером и счастьем! 💐",
  },
  {
    category: "kormlenie",
    name: "Солевой лизунец",
    description: "Минеральная подкормка на неделю",
    priceSKC: 10,
    effects: { happiness: 0, health: 3, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Установить солевой лизунец", description: "Закрепить новый солевой лизунец в стойле" }],
    feedback: "Лизунец! Теперь у меня все минералы в порядке! 🧂",
  },
  {
    category: "kormlenie",
    name: "Праздничный торт из овощей",
    description: "Специальное угощение для особых дней",
    priceSKC: 25,
    effects: { happiness: 3, health: 0, attachment: 0, mood: 5, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 2, season: "all",
    checklist: [{ task: "Приготовить овощной торт", description: "Собрать торт из моркови, тыквы и яблок, украсить зеленью" }],
    feedback: "Торт?! Для МЕНЯ?! Это лучший день в моей жизни! 🎂",
  },

  // ── Категория 2: СПА и груминг ──
  {
    category: "spa-i-gruming",
    name: "Расчёсывание шерсти",
    description: "Нежный уход за шёрсткой",
    priceSKC: 10,
    effects: { happiness: 2, health: 3, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Расчесать шерсть", description: "Аккуратно расчесать шерсть специальной щёткой" }],
    feedback: "Ах, как приятно! Моя шёрстка теперь такая мягкая и блестящая! ✨",
  },
  {
    category: "spa-i-gruming",
    name: "Купание с шампунем",
    description: "Полноценная СПА-процедура",
    priceSKC: 15,
    effects: { happiness: 3, health: 4, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить тёплую воду", description: "Наполнить ванну тёплой водой" }, { task: "Помыть с шампунем", description: "Нанести шампунь и аккуратно помыть" }, { task: "Высушить", description: "Вытереть полотенцем и дать обсохнуть" }],
    feedback: "Я чистюля! Пахну цветами и чувствую себя королевой/королём! 🛁",
  },
  {
    category: "spa-i-gruming",
    name: "Обработка копыт",
    description: "Профессиональный педикюр",
    priceSKC: 12,
    effects: { happiness: 0, health: 4, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 2, season: "all",
    checklist: [{ task: "Осмотреть копыта", description: "Проверить состояние копыт" }, { task: "Обработать копыта", description: "Подрезать и обработать копыта" }],
    feedback: "Мои копытца в идеальном порядке! Теперь могу бегать ещё быстрее! 🦶",
  },
  {
    category: "spa-i-gruming",
    name: "Массаж",
    description: "Расслабляющий массаж от фермера",
    priceSKC: 20,
    effects: { happiness: 5, health: 3, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Сделать массаж", description: "Мягкими движениями помассировать шею, спину и бока" }],
    feedback: "Мурррр... то есть, мееее! Массаж — это рай на земле! 💆",
  },
  {
    category: "spa-i-gruming",
    name: "Ароматерапия в стойле",
    description: "Лавандовое масло и хвойные ароматы",
    priceSKC: 18,
    effects: { happiness: 4, health: 0, attachment: 0, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить ароматы", description: "Зажечь аромалампу с лавандовым маслом в стойле" }],
    feedback: "Какие чудесные ароматы! Моё стойло стало настоящим спа-салоном! 🌿",
  },
  {
    category: "spa-i-gruming",
    name: "Премиум СПА-день",
    description: "Полный день ухода: купание, массаж, маникюр, ароматерапия",
    priceSKC: 40,
    effects: { happiness: 8, health: 5, attachment: 0, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Купание", description: "Полноценное купание с шампунем" }, { task: "Массаж", description: "Расслабляющий массаж всего тела" }, { task: "Обработка копыт", description: "Педикюр и уход за копытами" }, { task: "Ароматерапия", description: "Завершающая ароматерапия" }],
    feedback: "Это был ЛУЧШИЙ день! Я как новенький(ая)! Спасибо за королевский уход! 👑",
  },

  // ── Категория 3: Прогулки и активности ──
  {
    category: "progulki-i-aktivnosti",
    name: "Прогулка по лугу",
    description: "30-минутная прогулка на свежем воздухе",
    priceSKC: 10,
    effects: { happiness: 3, health: 0, attachment: 0, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 2, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Вывести на луг", description: "Вывести животное на 30-минутную прогулку по лугу" }],
    feedback: "Какой свежий воздух! Луг, солнце, трава — что ещё нужно для счастья? 🌻",
  },
  {
    category: "progulki-i-aktivnosti",
    name: "Игровой городок",
    description: "Полоса препятствий и лазалки",
    priceSKC: 20,
    effects: { happiness: 5, health: 0, attachment: 0, mood: 0, obedience: 3 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить площадку", description: "Проверить безопасность оборудования" }, { task: "Провести занятие", description: "Провести животное через полосу препятствий" }],
    feedback: "Я прошёл(ла) все препятствия! Я настоящий чемпион! 🏆",
  },
  {
    category: "progulki-i-aktivnosti",
    name: "Плавание в пруду",
    description: "Летнее купание (сезонное)",
    priceSKC: 15,
    effects: { happiness: 4, health: 2, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "summer",
    checklist: [{ task: "Подготовить пруд", description: "Проверить температуру воды и безопасность" }, { task: "Провести купание", description: "Сопровождать животное во время плавания" }],
    feedback: "Буль-буль! Вода такая тёплая! Лето — лучшее время года! 🏊",
  },
  {
    category: "progulki-i-aktivnosti",
    name: "Горная тропа",
    description: "Поход по холмистой местности",
    priceSKC: 25,
    effects: { happiness: 4, health: 5, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 2, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить маршрут", description: "Выбрать безопасную тропу" }, { task: "Провести поход", description: "Пройти маршрут с животным" }],
    feedback: "Мы покорили вершину! Вид сверху потрясающий! Я горный козёл/овца! 🏔️",
  },
  {
    category: "progulki-i-aktivnosti",
    name: "Пикник на поляне",
    description: "Отдых с угощениями на природе",
    priceSKC: 18,
    effects: { happiness: 3, health: 0, attachment: 0, mood: 4, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить угощения", description: "Собрать корзину с лакомствами" }, { task: "Устроить пикник", description: "Расстелить покрывало и устроить пикник с животным" }],
    feedback: "Пикник! Угощения! Природа! Это был волшебный день! 🧺",
  },

  // ── Категория 4: Дрессировка и обучение ──
  {
    category: "dressirovka-i-obuchenie",
    name: "Базовые команды",
    description: "«Ко мне», «стой», «место»",
    priceSKC: 15,
    effects: { happiness: 0, health: 0, attachment: 0, mood: 0, obedience: 4 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Провести тренировку", description: "Отработать базовые команды с лакомством-поощрением" }],
    feedback: "Я выучил(а) новую команду! Смотри — «стой»! Видишь, как я стою? 🎯",
  },
  {
    category: "dressirovka-i-obuchenie",
    name: "Трюки",
    description: "Поклон, кружение, подача лапы",
    priceSKC: 20,
    effects: { happiness: 0, health: 0, attachment: 3, mood: 0, obedience: 5 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Показать трюк", description: "Обучить животное новому трюку с поощрением" }],
    feedback: "Та-дааа! Смотри мой новый трюк! Я самый талантливый! 🎪",
  },
  {
    category: "dressirovka-i-obuchenie",
    name: "Аджилити-тренировка",
    description: "Прохождение полосы препятствий на скорость",
    priceSKC: 25,
    effects: { happiness: 0, health: 4, attachment: 0, mood: 0, obedience: 5 },
    stock: -1, dailyLimit: 0, weeklyLimit: 2, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Подготовить трассу", description: "Расставить препятствия" }, { task: "Провести тренировку", description: "Пройти трассу с животным на время" }],
    feedback: "Новый рекорд! Я пролетел(а) трассу как ветер! 💨",
  },
  {
    category: "dressirovka-i-obuchenie",
    name: "Индивидуальное занятие с тренером",
    description: "Персональная программа под характер животного",
    priceSKC: 30,
    effects: { happiness: 0, health: 0, attachment: 4, mood: 0, obedience: 6 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Провести индивидуальное занятие", description: "Персональная тренировка с учётом характера животного" }],
    feedback: "Тренер говорит, я самый способный ученик! Горжусь собой! 🌟",
  },
  {
    category: "dressirovka-i-obuchenie",
    name: "Социализация в стаде",
    description: "Групповое занятие с другими животными",
    priceSKC: 12,
    effects: { happiness: 3, health: 0, attachment: 0, mood: 0, obedience: 3 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Организовать групповое занятие", description: "Провести совместную активность с другими животными стада" }],
    feedback: "У меня столько друзей в стаде! Мы вместе играли и учились! 🐐🐑",
  },

  // ── Категория 5: Подарки и аксессуары ──
  {
    category: "podarki-i-aksessuary",
    name: "Именной ошейник",
    description: "С гравировкой имени владельца",
    priceSKC: 20,
    effects: { happiness: 0, health: 0, attachment: 4, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Изготовить ошейник", description: "Подготовить ошейник с гравировкой" }, { task: "Надеть ошейник", description: "Аккуратно надеть ошейник на животное" }],
    feedback: "У меня новый ошейник с твоим именем! Теперь все знают, что я — твой! 💝",
  },
  {
    category: "podarki-i-aksessuary",
    name: "Игрушка-мяч",
    description: "Прочный мяч для игр",
    priceSKC: 10,
    effects: { happiness: 0, health: 0, attachment: 2, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Дать мяч", description: "Положить мяч в загон и поиграть с животным" }],
    feedback: "МЯЧ! МЯЧ! МЯЧ! Это лучшая игрушка в мире! ⚽",
  },
  {
    category: "podarki-i-aksessuary",
    name: "Тёплая попона",
    description: "Для холодных ночей (сезонное)",
    priceSKC: 25,
    effects: { happiness: 0, health: 4, attachment: 3, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "winter",
    checklist: [{ task: "Надеть попону", description: "Аккуратно укутать животное тёплой попоной" }],
    feedback: "Как тепло и уютно! Теперь мне не страшны никакие морозы! 🧣",
  },
  {
    category: "podarki-i-aksessuary",
    name: "Бубенчик",
    description: "Мелодичный колокольчик",
    priceSKC: 8,
    effects: { happiness: 0, health: 0, attachment: 2, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Повесить бубенчик", description: "Прикрепить бубенчик к ошейнику" }],
    feedback: "Дзинь-дзинь! Слышишь? Это я иду! Мой бубенчик самый мелодичный! 🔔",
  },
  {
    category: "podarki-i-aksessuary",
    name: "Фотосессия с животным",
    description: "Профессиональные фото для дневника",
    priceSKC: 30,
    effects: { happiness: 3, health: 0, attachment: 5, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Подготовить площадку", description: "Выбрать красивое место для фотосессии" }, { task: "Провести фотосессию", description: "Сделать серию профессиональных фотографий" }],
    feedback: "Я фотомодель! Посмотри, какие красивые фото получились! 📸",
  },
  {
    category: "podarki-i-aksessuary",
    name: "Именная табличка на стойло",
    description: "«Стойло [имя] — владелец [имя]»",
    priceSKC: 15,
    effects: { happiness: 0, health: 0, attachment: 3, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Изготовить табличку", description: "Подготовить именную табличку" }, { task: "Установить табличку", description: "Закрепить табличку на стойле" }],
    feedback: "У моего стойла теперь есть именная табличка! Я чувствую себя особенным! 🏠",
  },

  // ── Категория 6: Здоровье и витамины ──
  {
    category: "zdorovie-i-vitaminy",
    name: "Витаминный комплекс",
    description: "Курс на 2 недели",
    priceSKC: 15,
    effects: { happiness: 0, health: 5, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Дать витамины", description: "Добавить витаминный комплекс в корм" }],
    feedback: "Витаминки! Чувствую, как энергия наполняет каждую клеточку! 💪",
  },
  {
    category: "zdorovie-i-vitaminy",
    name: "Пробиотики",
    description: "Для здорового пищеварения",
    priceSKC: 12,
    effects: { happiness: 0, health: 4, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Дать пробиотики", description: "Добавить пробиотики в питьевую воду" }],
    feedback: "Мой животик говорит спасибо! Пищеварение работает как часы! 🌱",
  },
  {
    category: "zdorovie-i-vitaminy",
    name: "Осмотр ветеринара",
    description: "Плановый профилактический осмотр",
    priceSKC: 20,
    effects: { happiness: 0, health: 6, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Пригласить ветеринара", description: "Организовать визит ветеринара" }, { task: "Провести осмотр", description: "Полный профилактический осмотр" }, { task: "Записать результаты", description: "Зафиксировать результаты осмотра" }],
    feedback: "Доктор сказал, что я абсолютно здоров(а)! Всё благодаря твоей заботе! 🏥",
  },
  {
    category: "zdorovie-i-vitaminy",
    name: "Вакцинация",
    description: "Сезонная прививка",
    priceSKC: 25,
    effects: { happiness: 0, health: 8, attachment: 0, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Подготовить вакцину", description: "Проверить срок годности и подготовить" }, { task: "Провести вакцинацию", description: "Сделать прививку" }, { task: "Наблюдение", description: "Наблюдать за состоянием 30 минут после прививки" }],
    feedback: "Укольчик был не страшный! Зато теперь я защищён(а) от болезней! 💉",
  },
  {
    category: "zdorovie-i-vitaminy",
    name: "Травяной чай",
    description: "Ромашковый отвар для спокойствия",
    priceSKC: 8,
    effects: { happiness: 0, health: 3, attachment: 0, mood: 2, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Заварить чай", description: "Приготовить ромашковый отвар и остудить" }, { task: "Дать чай", description: "Налить в поилку" }],
    feedback: "Ромашковый чай — и весь мир становится спокойнее... ☕",
  },

  // ── Категория 7: Особые события ──
  {
    category: "osobye-sobytiya",
    name: "День рождения",
    description: "Праздник с тортом, украшениями и фотосессией",
    priceSKC: 50,
    effects: { happiness: 8, health: 8, attachment: 8, mood: 8, obedience: 8 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Украсить стойло", description: "Повесить гирлянды и шарики" }, { task: "Приготовить торт", description: "Испечь овощной торт" }, { task: "Провести фотосессию", description: "Сделать праздничные фото" }, { task: "Пригласить друзей из стада", description: "Организовать совместный праздник" }],
    feedback: "С ДНЁМ РОЖДЕНИЯ МЕНЯ! Это самый лучший праздник! Спасибо, что ты рядом! 🎂🎉🎈",
  },
  {
    category: "osobye-sobytiya",
    name: "Свидание с другом из стада",
    description: "Совместная прогулка с выбранным животным",
    priceSKC: 20,
    effects: { happiness: 5, health: 0, attachment: 0, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 1, weeklyLimit: 0, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Выбрать друга", description: "Определить животное-компаньона для прогулки" }, { task: "Организовать прогулку", description: "Вывести обоих животных на совместную прогулку" }],
    feedback: "Мы с другом так весело провели время! Бегали, играли, ели траву вместе! 🐐❤️🐑",
  },
  {
    category: "osobye-sobytiya",
    name: "Ночёвка под звёздами",
    description: "Ночь в открытом загоне с видом на небо",
    priceSKC: 35,
    effects: { happiness: 6, health: 0, attachment: 4, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "summer",
    checklist: [{ task: "Подготовить загон", description: "Обеспечить безопасность открытого загона" }, { task: "Постелить подстилку", description: "Положить мягкую подстилку" }, { task: "Проверить утром", description: "Утренний осмотр после ночёвки" }],
    feedback: "Звёзды были такие яркие! Я считал(а) их до самого утра... ну, почти! 🌟🌙",
  },
  {
    category: "osobye-sobytiya",
    name: "Именной сыр",
    description: "Партия сыра с именем владельца на этикетке",
    priceSKC: 40,
    effects: { happiness: 5, health: 0, attachment: 5, mood: 0, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 0, monthlyLimit: 1, season: "all",
    checklist: [{ task: "Собрать молоко", description: "Собрать молоко для производства сыра" }, { task: "Изготовить сыр", description: "Приготовить сыр по фермерскому рецепту" }, { task: "Оформить этикетку", description: "Напечатать именную этикетку" }],
    feedback: "Из моего молока сделали именной сыр! Я горжусь собой! 🧀",
  },
  {
    category: "osobye-sobytiya",
    name: "Письмо от животного",
    description: "Открытка «от лица» животного с фото",
    priceSKC: 15,
    effects: { happiness: 0, health: 0, attachment: 4, mood: 3, obedience: 0 },
    stock: -1, dailyLimit: 0, weeklyLimit: 1, monthlyLimit: 0, season: "all",
    checklist: [{ task: "Сделать фото", description: "Сфотографировать животное для открытки" }, { task: "Оформить открытку", description: "Подготовить открытку с текстом от лица животного" }],
    feedback: "Дорогой хозяин! Я написал(а) тебе письмо... ну, помог фермер, но чувства — мои! 💌",
  },
];

// ─── Seed Logic ───
async function seed() {
  console.log("🌱 Starting marketplace seed...\n");

  // 1. Ensure farm accounts exist
  const [existingAccounts] = await pool.query("SELECT * FROM farmAccounts");
  if (!existingAccounts.length) {
    console.log("Creating farm accounts (Bank & Revenue)...");
    await pool.query("INSERT INTO farmAccounts (accountType, balanceSKC, totalLifetimeSKC) VALUES ('bank', 10000, 0)");
    await pool.query("INSERT INTO farmAccounts (accountType, balanceSKC, totalLifetimeSKC) VALUES ('revenue', 0, 0)");
    console.log("✅ Farm accounts created\n");
  } else {
    console.log("✅ Farm accounts already exist\n");
  }

  // 2. Insert categories
  const categoryIdMap = {};
  for (const cat of categories) {
    const [existing] = await pool.query("SELECT id FROM marketplaceCategories WHERE slug = ?", [cat.slug]);
    if (existing.length) {
      categoryIdMap[cat.slug] = existing[0].id;
      console.log(`  ⏭️  Category "${cat.name}" already exists (id=${existing[0].id})`);
    } else {
      const [result] = await pool.query(
        "INSERT INTO marketplaceCategories (name, slug, description, emoji, isVisible, sortOrder) VALUES (?, ?, ?, ?, 1, ?)",
        [cat.name, cat.slug, cat.description, cat.emoji, cat.sortOrder]
      );
      categoryIdMap[cat.slug] = result.insertId;
      console.log(`  ✅ Category "${cat.name}" created (id=${result.insertId})`);
    }
  }
  console.log("");

  // 3. Insert items
  let created = 0;
  let skipped = 0;
  for (const item of items) {
    const categoryId = categoryIdMap[item.category];
    if (!categoryId) {
      console.error(`  ❌ Category "${item.category}" not found for item "${item.name}"`);
      continue;
    }
    const itemSlug = slugify(item.name);
    const [existing] = await pool.query("SELECT id FROM marketplaceItems WHERE slug = ?", [itemSlug]);
    if (existing.length) {
      skipped++;
      continue;
    }

    const metricEffectsJson = JSON.stringify(item.effects);
    const checklistTemplateJson = JSON.stringify(item.checklist);

    await pool.query(
      `INSERT INTO marketplaceItems 
        (categoryId, name, slug, description, priceSKC, stock, dailyLimitPerOwner, weeklyLimitPerOwner, monthlyLimitPerOwner, marketplaceItemSeason, metricEffectsJson, requiresChecklist, checklistTemplateJson, feedbackTemplate, isVisible, sortOrder) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?)`,
      [
        categoryId,
        item.name,
        itemSlug,
        item.description,
        item.priceSKC,
        item.stock,
        item.dailyLimit,
        item.weeklyLimit,
        item.monthlyLimit,
        item.season,
        metricEffectsJson,
        checklistTemplateJson,
        item.feedback,
        created + 1,
      ]
    );
    created++;
    console.log(`  ✅ Item "${item.name}" (${item.priceSKC} SKC) → ${item.category}`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Items created: ${created}`);
  console.log(`  Items skipped (already exist): ${skipped}`);
  console.log(`  Total items: ${items.length}`);
  console.log("\n🎉 Marketplace seed complete!");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
