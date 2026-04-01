/*
  PricingCompare.tsx — Сравнение тарифов
  Full comparison table across all 4 tiers with categories.
*/

import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { trpc } from "@/lib/trpc";
import { Check, X, ArrowRight, Leaf, Loader2 } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

/* ─── Comparison data (static, matches tariffs v3.2) ─── */
interface CompRow {
  label: string;
  guest: string | boolean;
  basic: string | boolean;
  standard: string | boolean;
  professional: string | boolean;
}

interface CompSection {
  title: string;
  rows: CompRow[];
}

const SECTIONS: CompSection[] = [
  {
    title: "Финансовые параметры",
    rows: [
      { label: "Доля владения", guest: "Нет", basic: "50%", standard: "100%", professional: "3+ × 100%" },
      { label: "Разовый платёж", guest: "—", basic: "Цена × 50%", standard: "Цена × 100%", professional: "Сумма (скидка 10%)" },
      { label: "Ежемесячный взнос", guest: "Бесплатно", basic: "от 7 500 ₽", standard: "от 14 900 ₽", professional: "от 39 900 ₽" },
      { label: "Скидка при продлении", guest: "—", basic: "20%", standard: "20%", professional: "20%" },
      { label: "Годовая подписка", guest: "—", basic: "−15%", standard: "−15%", professional: "−15%" },
      { label: "Скидка в магазине", guest: "0%", basic: "5%", standard: "10%", professional: "20%" },
    ],
  },
  {
    title: "Продукция",
    rows: [
      { label: "Свежее молоко", guest: false, basic: true, standard: true, professional: true },
      { label: "Творог, кефир, йогурт", guest: false, basic: true, standard: true, professional: true },
      { label: "Мягкий сыр", guest: false, basic: true, standard: true, professional: true },
      { label: "Полутвёрдые сыры", guest: false, basic: false, standard: true, professional: true },
      { label: "Сезонные специалитеты", guest: false, basic: false, standard: true, professional: true },
      { label: "Выдержанные сыры (6‒24 мес.)", guest: false, basic: false, standard: false, professional: true },
      { label: "Авторские рецептуры", guest: false, basic: false, standard: false, professional: true },
      { label: "Эксклюзивный набор", guest: false, basic: false, standard: false, professional: true },
    ],
  },
  {
    title: "Управление",
    rows: [
      { label: "Продуктовый план", guest: "—", basic: "Стандартный", standard: "Расширенный", professional: "Полный + авторский" },
      { label: "Смена плана", guest: "—", basic: "1 раз/квартал", standard: "1 раз/мес", professional: "1 раз/нед" },
      { label: "Баланс молока", guest: false, basic: true, standard: true, professional: true },
      { label: "Объединённый баланс", guest: false, basic: false, standard: false, professional: true },
    ],
  },
  {
    title: "Доставка и подарки",
    rows: [
      { label: "Доставка себе", guest: false, basic: true, standard: true, professional: true },
      { label: "Отправка подарком", guest: false, basic: true, standard: true, professional: true },
      { label: "Адреса доставки", guest: "—", basic: "1", standard: "2", professional: "5" },
      { label: "Разделение партии", guest: false, basic: false, standard: true, professional: true },
      { label: "Подарочная подписка", guest: false, basic: false, standard: "до 6 мес.", professional: "до 12 мес." },
      { label: "Персональная этикетка", guest: false, basic: "Платно", standard: "Платно", professional: true },
      { label: "Приоритетная доставка", guest: false, basic: false, standard: true, professional: true },
    ],
  },
  {
    title: "Клуб и посещения",
    rows: [
      { label: "Посещения фермы", guest: "По записи (платно)", basic: "2 раза/мес", standard: "4 раза/мес", professional: "Без ограничений" },
      { label: "Общие мероприятия", guest: "Платно", basic: true, standard: true, professional: true },
      { label: "Закрытые мероприятия", guest: false, basic: false, standard: true, professional: true },
      { label: "VIP-мероприятия", guest: false, basic: false, standard: false, professional: true },
      { label: "Место в правлении", guest: false, basic: false, standard: false, professional: true },
      { label: "Гостевые приглашения", guest: "—", basic: "—", standard: "2/квартал", professional: "Без ограничений" },
    ],
  },
  {
    title: "Сервис",
    rows: [
      { label: "Личный кабинет", guest: true, basic: true, standard: true, professional: true },
      { label: "Трекер продукции", guest: "Демо", basic: true, standard: true, professional: true },
      { label: "Дневник животного", guest: false, basic: true, standard: true, professional: true },
      { label: "Система достижений", guest: false, basic: "Базовые", standard: "Расширенные", professional: "Все" },
      { label: "Персональный менеджер", guest: false, basic: false, standard: true, professional: true },
      { label: "Фермер-куратор", guest: false, basic: false, standard: false, professional: true },
      { label: "Приоритет при расширении", guest: false, basic: false, standard: false, professional: true },
    ],
  },
];

const TIER_HEADERS = [
  { slug: "guest", name: "Гость", sub: "Бесплатно", color: "text-muted-foreground" },
  { slug: "basic", name: "Базовый", sub: "50% доли", color: "text-primary" },
  { slug: "standard", name: "Стандартный", sub: "100% доли", color: "text-primary" },
  { slug: "professional", name: "Профессиональный", sub: "3+ животных", color: "text-accent-foreground" },
];

function CellValue({ val }: { val: string | boolean }) {
  if (val === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (val === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm text-foreground">{val}</span>;
}

export default function PricingCompare() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="container pt-4 pb-2">
          <PageBreadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Цены", href: "/pricing" },
              { label: "Сравнение тарифов" },
            ]}
          />
        </div>

        <div className="container pb-8 pt-2">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">Сравнение тарифов</h1>
          <p className="mt-2 text-muted-foreground">
            Полная таблица возможностей каждого уровня участия
          </p>
        </div>

        {/* Comparison table */}
        <div className="container pb-16">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[700px] text-sm">
              {/* Header */}
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-4 text-left font-semibold text-muted-foreground w-[200px]">Параметр</th>
                  {TIER_HEADERS.map((t) => (
                    <th key={t.slug} className="p-4 text-center">
                      <span className={`text-base font-bold ${t.color}`}>{t.name}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{t.sub}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((section, si) => (
                  <React.Fragment key={`section-${si}`}>
                    {/* Section header */}
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row, ri) => (
                      <motion.tr
                        key={`${si}-${ri}`}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={fadeUp}
                        custom={ri * 0.3}
                        className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-4 py-3 text-foreground font-medium">{row.label}</td>
                        <td className="px-4 py-3 text-center"><CellValue val={row.guest} /></td>
                        <td className="px-4 py-3 text-center"><CellValue val={row.basic} /></td>
                        <td className="px-4 py-3 text-center bg-primary/[0.02]"><CellValue val={row.standard} /></td>
                        <td className="px-4 py-3 text-center"><CellValue val={row.professional} /></td>
                      </motion.tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/pricing/calculator">
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-colors">
                Рассчитать выгоду <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/animals">
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Выбрать животное
              </button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-card py-10">
          <div className="container">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-display text-lg text-foreground">Шерь Козу</span>
                <span className="text-sm text-muted-foreground">Персональное фермерство</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <Link href="/pricing" className="transition-colors hover:text-foreground">Цены</Link>
                <Link href="/animals" className="transition-colors hover:text-foreground">Животные</Link>
                <Link href="/faq" className="transition-colors hover:text-foreground">FAQ</Link>
              </div>
            </div>
            <div className="mt-6 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Шерь Козу. Семейная ферма персонального фермерства.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
