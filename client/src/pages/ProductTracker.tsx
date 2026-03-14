/*
Design Philosophy Reminder — ProductTracker.tsx
Biomorphic Tech product transparency layer.
Core: transform product status into trust and narrative, not dry logistics.
Must connect milk, delivery, named products and animal origin in one readable route.
*/

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Leaf,
  Milk,
  Package,
  Sparkles,
  Truck,
  Users,
  ShieldCheck,
  Star,
} from "lucide-react";

const CDN = {
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  delivery: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_family_farm_hero-UF9QBY2UhWL9gdEpLXiEFS.webp",
  cheese: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_named_dairy_box-3mP3ykmuPDWBoKghC7cnDc.webp",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/sherkozu_anglonubian_portrait-fvqToDAjgebgcmNhLN93Db.webp",
};

const composition = [
  { label: "Жирность", value: 4.8, max: 6, unit: "%" },
  { label: "Белок", value: 3.2, max: 5, unit: "%" },
  { label: "Лактоза", value: 4.1, max: 6, unit: "%" },
  { label: "Кальций", value: 134, max: 200, unit: "мг/100 мл" },
];

const monthlyData = [
  { month: "Сен", liters: 38 },
  { month: "Окт", liters: 42 },
  { month: "Ноя", liters: 44 },
  { month: "Дек", liters: 40 },
  { month: "Янв", liters: 36 },
  { month: "Фев", liters: 43 },
  { month: "Мар", liters: 47 },
];

const deliveries = [
  {
    id: "ДСТ-2026-031",
    date: "15 марта 2026",
    status: "Собирается",
    progress: 45,
    story: "Надой Марты от 13 марта уже распределён в коробку семьи Петровых. Сейчас ферма комплектует молоко, сыр и йогурт в персональную капсулу продукта.",
    items: ["Молоко козье свежее · 2 л", "Сыр «Марта Петровых» · 300 г", "Йогурт натуральный · 500 г"],
  },
  {
    id: "ДСТ-2026-028",
    date: "8 марта 2026",
    status: "Доставлено",
    progress: 100,
    story: "Коробка была передана семье вовремя. Включала молоко, мягкий творог и сезонную карту происхождения партии.",
    items: ["Молоко козье свежее · 2 л", "Творог мягкий · 400 г", "Карта происхождения партии"],
  },
  {
    id: "ДСТ-2026-021",
    date: "1 марта 2026",
    status: "Доставлено",
    progress: 100,
    story: "Первая мартовская коробка стала базой для клубного дегустационного вечера и семейной фотосессии с Мартой.",
    items: ["Молоко козье свежее · 3 л", "Сыр «Марта Петровых» · 200 г", "Масло сливочное · 200 г"],
  },
];

const originSteps = [
  { title: "Жизнь животного", text: "Уход, питание и состояние Марты напрямую влияют на качество молока и доверие владельца." },
  { title: "Надой и анализ", text: "Каждая партия получает лабораторную фиксацию состава, чтобы продукт был наблюдаемым, а не абстрактным." },
  { title: "Сборка доставки", text: "Продукты из вашей истории участия собираются в именную коробку с понятным маршрутом." },
  { title: "Семейный опыт", text: "Доставка становится не финалом транзакции, а продолжением фермерской истории дома." },
];

const routeNotes = [
  "Трекер объясняет происхождение через данные, а не только через copywriting.",
  "Именная коробка визуально доказывает, что продукт связан с животным и семьёй.",
  "Даже логистический слой должен вести обратно к профилю животного и клубным сценариям.",
];

const maxLiters = Math.max(...monthlyData.map((item) => item.liters));

function MetricBar({ value, max }: { value: number; max: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth((value / max) * 100), 250);
    return () => clearTimeout(timer);
  }, [value, max]);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary progress-bar-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ProductTracker() {
  const [activeDelivery, setActiveDelivery] = useState(0);
  const currentDelivery = deliveries[activeDelivery] ?? deliveries[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pb-14 pt-24 md:pt-28">
        <div className="container">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-[2.25rem] border border-border/70 bg-card shadow-[0_28px_80px_-42px_rgba(32,26,20,0.26)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <div className="relative min-h-[360px] overflow-hidden">
                <img src={CDN.milk} alt="Именная молочная коробка" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,20,0.84),rgba(25,22,20,0.42),rgba(25,22,20,0.14))]" />
                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                      <Leaf className="h-3.5 w-3.5" />
                      Анализ партии от 10 марта
                    </div>
                    <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold">Органик</div>
                  </div>

                  <div className="max-w-2xl">
                    <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Трекер продукта</p>
                    <h1 className="mt-3 font-display text-4xl text-white md:text-5xl">Трекер показывает, как Марта превращается в семейный продуктовый маршрут.</h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/76 md:text-base">
                      Здесь пользователь видит происхождение молока, параметры партии, ход доставки и связь с конкретным животным.
                      Новый visual layer делает продукт более личным и премиальным, не теряя прозрачности.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(250,245,237,0.92))] p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Надой за март", value: "47.2 л", icon: Milk },
                    { label: "Доставок в сезоне", value: "12", icon: Truck },
                    { label: "Именных продуктов", value: "8", icon: Sparkles },
                    { label: "Качество партии", value: "сертифицировано", icon: FlaskConical },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 text-xl font-semibold text-foreground">{item.value}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                  <img src={CDN.goat} alt="Марта" className="h-44 w-full object-cover object-top" />
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Источник маршрута</p>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">Любой продукт в системе начинается с конкретного животного.</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Поэтому трекер не отрывается от живого профиля Марты и всегда оставляет маршрут обратно к источнику продукта.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-12 gap-5">
            <motion.section
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-5"
            >
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Состав партии</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">Состав молока от Марты</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Качество партии видно прямо в интерфейсе, а не обещается абстрактно. Новый визуальный слой усиливает ощущение премиального, но прозрачного продукта.
                  </p>
                </div>

                {composition.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono-data font-semibold text-foreground">{item.value} {item.unit}</span>
                    </div>
                    <MetricBar value={item.value} max={item.max} />
                  </div>
                ))}

                <div className="rounded-2xl bg-secondary/55 p-4 text-sm leading-7 text-muted-foreground">
                  Сертификат качества №СК-2026-0310 подтверждает партию и делает прозрачность наблюдаемой и эмоционально убедительной.
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm lg:col-span-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Динамика надоев</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">Сентябрь 2025 — март 2026</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    График показывает сезонность и связь между жизнью животного и объёмом продукта.
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono-data text-3xl font-semibold text-foreground">47.2 л</div>
                  <div className="text-xs text-green-600">+9% к прошлому месяцу</div>
                </div>
              </div>

              <div className="mt-8 flex h-48 items-end gap-3">
                {monthlyData.map((item, index) => (
                  <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className="font-mono-data text-xs text-muted-foreground">{item.liters}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(item.liters / maxLiters) * 100}%` }}
                      transition={{ delay: 0.18 + index * 0.06, duration: 0.55 }}
                      className={`w-full rounded-t-xl ${index === monthlyData.length - 1 ? "bg-primary" : "bg-primary/28"}`}
                    />
                    <span className="text-xs text-muted-foreground">{item.month}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Путь продукта</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">От жизни животного до семейной коробки</h2>
                </div>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {originSteps.map((step, index) => (
                  <div key={step.title} className="rounded-[1.5rem] bg-secondary/50 p-4">
                    <div className="font-mono-data text-xs uppercase tracking-[0.18em] text-primary">0{index + 1}</div>
                    <div className="mt-3 text-lg font-semibold text-foreground">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm"
            >
              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="overflow-hidden border-b border-border/70 lg:border-b-0 lg:border-r">
                  <img src={CDN.delivery} alt="История доставок" className="h-full min-h-[260px] w-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-primary">История доставок</p>
                      <h2 className="mt-3 text-2xl font-semibold text-foreground">Каждая доставка — часть истории, а не просто заказ.</h2>
                    </div>
                    <Package className="h-6 w-6 text-primary" />
                  </div>

                  <div className="mt-6 space-y-3">
                    {deliveries.map((delivery, index) => (
                      <button
                        key={delivery.id}
                        onClick={() => setActiveDelivery(activeDelivery === index ? -1 : index)}
                        className="w-full rounded-[1.5rem] border border-border bg-white p-4 text-left transition-colors hover:bg-muted/35"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{delivery.id}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{delivery.date}</div>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
                            {delivery.progress === 100 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                            {delivery.status}
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${delivery.progress}%` }} />
                        </div>

                        <AnimatePresence initial={false}>
                          {activeDelivery === index && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <p className="mt-4 text-sm leading-7 text-muted-foreground">{delivery.story}</p>
                              <div className="mt-3 grid gap-2">
                                {delivery.items.map((item) => (
                                  <div key={item} className="rounded-xl bg-secondary/55 px-3 py-2 text-sm text-foreground">{item}</div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="col-span-12 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:col-span-6"
            >
              <img src={CDN.cheese} alt="Именной сыр" className="h-56 w-full object-cover" />
              <div className="p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-primary">Именной продукт</p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">Сыр «Марта Петровых» завершает цикл от фермы до стола.</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Продуктовый слой должен быть личным и премиальным: не безликий сыр, а конкретный результат связи владельца с животным.
                </p>
                <div className="mt-5 space-y-2">
                  {routeNotes.map((note) => (
                    <div key={note} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Star className="mt-0.5 h-4 w-4 text-accent" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="col-span-12 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(26,58,42,0.97),rgba(46,77,59,0.94))] p-6 text-white shadow-[0_34px_80px_-42px_rgba(26,58,42,0.72)] lg:col-span-6"
            >
              <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Связанные маршруты</p>
              <h2 className="mt-3 font-display text-3xl">Трекер не должен быть тупиком.</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Пользователь должен естественно возвращаться к животному, кабинету и клубной жизни, чтобы рациональная прозрачность работала вместе с эмоциональной связью и клубной средой.
              </p>

              <div className="mt-6 grid gap-3">
                <Link href="/animal/marta" className="group flex items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12">
                  <div>
                    <div className="font-semibold text-white">К профилю Марты</div>
                    <div className="mt-1 text-xs text-white/60">Вернуться к животному, от которого начинается продуктовый путь</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/club" className="group flex items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12">
                  <div>
                    <div className="font-semibold text-white">К клубной ленте</div>
                    <div className="mt-1 text-xs text-white/60">Перейти к событиям, отзывам и семейным ритуалам вокруг продукта</div>
                  </div>
                  <Users className="h-5 w-5 text-amber-300" />
                </Link>
                <Link href="/dashboard" className="group flex items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm transition-colors hover:bg-white/12">
                  <div>
                    <div className="font-semibold text-white">В кабинет</div>
                    <div className="mt-1 text-xs text-white/60">Вернуться к статусам подписки и быстрым действиям семьи</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="col-span-12 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">Текущий статус маршрута</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">Текущая активная доставка остаётся связанной с животным, коробкой и клубной историей.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Для V1 важно, чтобы пользователь не видел набор разрозненных метрик. Он должен понимать, какая именно доставка сейчас в фокусе и куда идти дальше внутри системы.
                  </p>

                  <div className="mt-5 rounded-[1.5rem] bg-secondary/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-primary">Активная доставка</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{currentDelivery.id} · {currentDelivery.date}</div>
                      </div>
                      <div className="rounded-full bg-accent/20 px-4 py-2 text-xs font-semibold text-amber-800">
                        {currentDelivery.status}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{currentDelivery.story}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <Link href="/animal/marta" className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92">
                    К профилю Марты
                  </Link>
                  <Link href="/club" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                    К клубной ленте
                  </Link>
                  <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                    В кабинет
                  </Link>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
