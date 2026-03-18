/*
Design Philosophy Reminder — Navbar.tsx
Biomorphic Tech navigation shell.
Core: clear routes, mobile continuity, premium calmness.
Every nav state must reinforce that the product is one connected ecosystem.
*/

import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Leaf, Home, LayoutDashboard, Menu, Milk, PawPrint, Users, X, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const animalsQuery = trpc.animals.listPublic.useQuery();

  const featuredAnimal = animalsQuery.data?.[0] ?? null;
  const featuredAnimalName = featuredAnimal?.name ?? "животное";
  const navItems = useMemo(
    () => [
      { href: "/", label: "Главная", icon: Home },
      { href: "/dashboard", label: "Мой кабинет", icon: LayoutDashboard },
      { href: "/animals", label: "Каталог животных", icon: PawPrint },
      { href: "/tracker", label: "Трекер продуктов", icon: Milk },
      { href: "/club", label: "Клуб", icon: Users },
    ],
    [],
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white/90 shadow-sm backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Шерь <span className="text-primary">Козу</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <span className="pulse-dot" />
            <span className="font-mono-data text-xs">{featuredAnimalName} онлайн</span>
          </div>
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="hidden items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-primary/90 sm:flex"
            >
              Личный кабинет
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-muted md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-white/96 shadow-sm backdrop-blur md:hidden">
          <div className="container flex flex-col gap-2 py-3">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </Link>
              );
            })}

            <Link href="/dashboard">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow transition-colors hover:bg-primary/90"
              >
                Открыть личный кабинет
                <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
