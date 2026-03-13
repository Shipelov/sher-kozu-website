/*
Design Philosophy Reminder — Home.tsx
Biomorphic Tech landing for Sher Kozu.
Core: asymmetric storytelling, warm organic luxury, clear route into product ecosystem.
Avoid generic food ecommerce tropes. Every section must explain personal farming and route deeper.
*/

import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Milk,
  ShieldCheck,
  Sparkles,
  Users,
  Camera,
  Package,
  BookOpen,
  MapPin,
  Calendar,
  Bot,
  Leaf,
} from "lucide-react";

const CDN = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/hero_farm_ab0d054b.jpg",
  goat: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/goat_portrait_80fc5726.jpg",
  milk: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/milk_products_d3f8c13d.jpg",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/family_farm_446b395e.jpg",
  club: "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/club_event_3bef2b1e.jpg",
};

const steps = [
  {
    index: "01",
    title: "Вы выбираете животное",
    text: "Не обезличенную корзину продуктов, а конкретную козу или овцу с именем, историей и прозрачным происхождением.",
    icon: Heart,
  },
  {
    index: "02",
    title: "Следите за жизнью на ферме",
    text: "Дашборд, дневник, прямой эфир и события клуба превращают фермерство в личный ритм, а не в редкую покупку.",
    icon: Camera,
  },
  {
    index: "03",
    title: "Получаете продукты именно от неё",
    text: "Трекер показывает путь молока и именных продуктов — от надоя до доставки семье или подарочного набора.",
    icon: Package,
  },
];

const values = [
  {
    title: "Эмоциональная связь",
    text: "Профиль животного, характер, фото, дневник и семейные визиты делают участие живым и личным.",
    icon: Heart,
  },
  {
    title: "Радикальная прозрачность",
    text: "Вы видите происхождение продукта, статус ухода, состав молока и маршрут доставки без чёрных ящиков.",
    icon: ShieldCheck,
  },
  {
    title: "Премиальная фермерская продукция",
    text: "Молоко, сыры и сезонные наборы идут не от абстрактной фермы, а из вашей персональной истории владения.",
    icon: Milk,
  },
  {
    title: "Закрытый клуб",
    text: "Ужины, визиты, мастер-классы и семейные ритуалы создают community layer вокруг фермы.",
    icon: Users,
  },
];

const ecosystemRoutes = [
  {
    title: "Dashboard владельца",
    text: "Цифровое сердце экосистемы: животное, продукт, клуб и AI-слой в одном пространстве.",
    href: "/dashboard",
    icon: Sparkles,
  },
  {
    title: "Профиль животного",
    text: "История, настроение, дневник и биография конкретной козы или овцы как ядро удержания.",
    href: "/animal/marta",
    icon: BookOpen,
  },
  {
    title: "Трекер продуктов",
    text: "Состав молока, динамика надоев и история доставок формируют рациональное доверие.",
    href: "/tracker",
    icon: Package,
  },
  {
    title: "Клубная лента",
    text: "События, новости фермы и клубные ритуалы удерживают пользователя между доставками.",
    href: "/club",
    icon: Users,
  },
];

const signals = [
  { value: "47", label: "семей в клубе" },
  { value: "94", label: "животных в экосистеме" },
  { value: "4.8%", label: "средняя жирность молока" },
  { value: "24/7", label: "цифровое присутствие" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),rgba(244,240,232,0.42)_35%,rgba(235,230,220,0)_65%)] pt-28 pb-16 md:pt-34 md:pb-24">
        <div className="absolute inset-0 opacity-35 pointer-events-none" aria-hidden>
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm backdrop-blur"
              >
                <Leaf className="h-4 w-4" />
                Первый в России клуб персонального фермерства
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-6 max-w-xl font-display text-5xl leading-[0.95] text-foreground md:text-7xl"
              >
                Не подписка на молоко,
                <span className="block text-primary">а личная фермерская история.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground"
              >
                <strong className="text-foreground">Шерь Козу</strong> соединяет семью с конкретным животным, фермой и именными продуктами.
                Вы входите в одну экосистему: профиль питомца, дашборд владельца, трекер происхождения и клубную жизнь.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Link href="/dashboard" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(26,58,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/95">
                  Открыть дашборд владельца
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/animal/marta" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/80 px-7 py-4 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white">
                  Открыть профиль Марты
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link href="/tracker" className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-secondary/70 px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary">
                  Перейти в трекер продуктов
                  <Package className="h-4 w-4" />
                </Link>
              </motion.div>

              <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                {signals.map((signal, index) => (
                  <motion.div
                    key={signal.label}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + index * 0.05 }}
                    className="rounded-2xl border border-border/70 bg-white/75 p-4 shadow-sm backdrop-blur"
                  >
                    <div className="font-mono-data text-2xl font-semibold text-foreground">{signal.value}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{signal.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="relative"
            >
              <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-card shadow-[0_30px_70px_-35px_rgba(33,30,24,0.35)]">
                  <img src={CDN.hero} alt="Семейная ферма Шерь Козу" className="h-[480px] w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-oak/80 via-dark-oak/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                      <MapPin className="h-3.5 w-3.5" />
                      Семейная ферма в живом цифровом формате
                    </div>
                    <h2 className="mt-3 font-display text-3xl leading-none">Ваше участие начинается с одного живого существа.</h2>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <img src={CDN.goat} alt="Коза Марта" className="h-24 w-24 rounded-2xl object-cover object-top" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">Животное недели</p>
                        <h3 className="mt-2 text-2xl font-semibold text-foreground">Коза Марта</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Англо-нубийская, 3 года, элитная порода с высокой жирностью молока и мягким темпераментом.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-secondary p-3">
                        <div className="text-muted-foreground">Счастье</div>
                        <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">87%</div>
                      </div>
                      <div className="rounded-2xl bg-accent/15 p-3">
                        <div className="text-muted-foreground">Надой сегодня</div>
                        <div className="mt-1 font-mono-data text-xl font-semibold text-foreground">1.8 л</div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
                    <img src={CDN.milk} alt="Именные молочные продукты" className="h-40 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary">Продуктовый слой</p>
                      <p className="mt-2 text-base font-semibold text-foreground">От Марты в вашу доставку: молоко, сыр и сезонные наборы с прозрачным происхождением.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-18 md:py-24">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Как это работает</p>
              <h2 className="mt-4 max-w-md font-display text-4xl text-foreground md:text-5xl">
                Новая категория между фермерством, сервисом и клубом.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Пользователь выбирает животное, наблюдает за ним и получает продукты как материальный результат этой связи.
              </p>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.07 }}
                    className="grid gap-4 rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm md:grid-cols-[88px_1fr_auto] md:items-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="font-mono-data text-xs uppercase tracking-[0.24em] text-primary/70">Шаг {step.index}</div>
                      <h3 className="mt-1 text-xl font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{step.text}</p>
                    </div>
                    <div className="text-right font-display text-5xl leading-none text-primary/15">{step.index}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/45 py-18 md:py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Почему это ценно</p>
            <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">Шерь Козу соединяет сердце, прозрачность и продукт.</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {values.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-18 md:py-24">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Маршруты внутри продукта</p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl text-foreground md:text-5xl">Лендинг не заканчивает историю, а открывает вход в экосистему.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Смысл Day 2 — превратить главную страницу в объясняющий интерфейс и маршрутизатор. Отсюда пользователь должен
                естественно уходить в dashboard, профиль животного, трекер и клубную ленту.
              </p>

              <div className="mt-8 grid gap-4">
                {ecosystemRoutes.map((route, index) => {
                  const Icon = route.icon;
                  return (
                    <Link key={route.title} href={route.href} className="group block">
                      <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.06 }}
                        className="flex items-start gap-4 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-semibold text-foreground">{route.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{route.text}</p>
                        </div>
                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid gap-4"
            >
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
                <img src={CDN.family} alt="Семья на ферме" className="h-72 w-full object-cover" />
                <div className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">Доверие и масштаб</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">Семейная ферма остаётся человеческой по масштабу, но цифровой по качеству опыта.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-dark-oak p-6 text-white shadow-[0_24px_60px_-35px_rgba(20,18,16,0.7)]">
                <div className="flex items-center gap-2 text-amber-300">
                  <Bot className="h-5 w-5" />
                  <span className="text-sm font-medium">Следующий слой ценности</span>
                </div>
                <h3 className="mt-4 font-display text-3xl">AI-куратор владельца</h3>
                  <p className="mt-3 text-sm leading-7 text-white/75">
                    В Sprint 2 продукт расширяется за счёт умного куратора, storyteller-логики и голоса животного.
                    Уже сейчас архитектура сайта готовит для этого естественные точки входа, не перегружая первую версию MVP лишней сложностью.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/60">

                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Sprint 2 ready
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI touchpoints заложены
                  </span>
                </div>
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/8 p-4 text-sm text-white/78">
                  Первая версия MVP уже ведёт в рабочие слои продукта: владелец может понять модель, увидеть животное, проследить продукт и почувствовать клубную среду без разрывов маршрута.
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-24">
        <div className="container">
          <div className="overflow-hidden rounded-[2.25rem] border border-border/70 bg-[linear-gradient(135deg,rgba(26,58,42,0.96),rgba(45,70,54,0.92))] px-6 py-8 text-white shadow-[0_34px_80px_-45px_rgba(26,58,42,0.8)] md:px-10 md:py-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Следующий шаг</p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">Войдите в цифровое сердце фермы и посмотрите, как выглядит персональное фермерство на практике.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
                  Дальше пользователь должен не теряться, а сразу попадать в рабочее ядро продукта: дашборд владельца,
                  профиль животного, прозрачность продукции и клубную жизнь.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-primary transition-colors hover:bg-white/95">
                  Перейти в Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/club" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Открыть клубную ленту
                  <Users className="h-4 w-4" />
                </Link>
                <Link href="/tracker" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Перейти к трекеру продукта
                  <Package className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
