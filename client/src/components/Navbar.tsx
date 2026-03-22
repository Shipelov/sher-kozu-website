/*
Design Philosophy Reminder — Navbar.tsx
Biomorphic Tech navigation shell.
Core: clear routes, mobile continuity, premium calmness.
Auth-aware: shows login/register for guests, avatar+dropdown for authenticated users.
*/

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  Home,
  LayoutDashboard,
  Menu,
  Milk,
  PawPrint,
  Users,
  X,
  ChevronRight,
  LogIn,
  LogOut,
  Shield,
  User,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthModal from "./AuthModal";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const animalsQuery = trpc.animals.listPublic.useQuery();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">("login");

  const openLogin = useCallback(() => {
    setAuthModalView("login");
    setAuthModalOpen(true);
    setMobileOpen(false);
  }, []);

  const openRegister = useCallback(() => {
    setAuthModalView("register");
    setAuthModalOpen(true);
    setMobileOpen(false);
  }, []);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const handleLogout = useCallback(async () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // fallback: redirect anyway
      window.location.href = "/";
    }
  }, [logoutMutation]);

  const featuredAnimal = animalsQuery.data?.[0] ?? null;
  const featuredAnimalName = featuredAnimal?.name ?? "животное";

  const isAdmin = user?.role === "admin";

  const navItems = useMemo(
    () => [
      { href: "/", label: "Главная", icon: Home },
      { href: "/animals", label: "Каталог животных", icon: PawPrint },
      { href: "/about", label: "О ферме", icon: Leaf },
      { href: "/club", label: "Клуб", icon: Users },
    ],
    [],
  );

  const authNavItems = useMemo(
    () => [
      { href: "/dashboard", label: "Мой кабинет", icon: LayoutDashboard },
      { href: "/tracker", label: "Трекер продуктов", icon: Milk },
    ],
    [],
  );

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white/90 shadow-sm backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Шерь <span className="text-primary">Козу</span>
            </span>
          </Link>

          {/* Desktop nav */}
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
            {isAuthenticated &&
              authNavItems.map((item) => {
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

          {/* Right side: auth state */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Live indicator */}
            <div className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
              <span className="pulse-dot" />
              <span className="font-mono-data text-xs">{featuredAnimalName} онлайн</span>
            </div>

            {/* Auth section */}
            {authLoading ? (
              <div className="hidden h-9 w-24 animate-pulse rounded-full bg-muted sm:block" />
            ) : isAuthenticated && user ? (
              /* Authenticated: avatar + dropdown */
              <div ref={userMenuRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {userInitials}
                  </div>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-lg"
                    >
                      <div className="border-b border-border px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isAdmin ? "Администратор" : "Владелец"}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link href="/dashboard">
                          <button
                            type="button"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                            Мой кабинет
                          </button>
                        </Link>
                        <Link href="/profile">
                          <button
                            type="button"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            Мой профиль
                          </button>
                        </Link>
                        {isAdmin && (
                          <Link href="/admin">
                            <button
                              type="button"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                            >
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              Админ-панель
                            </button>
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-border py-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={logoutMutation.isPending}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" />
                          {logoutMutation.isPending ? "Выход..." : "Выйти"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Not authenticated: Login + Register buttons */
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={openLogin}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <LogIn className="h-4 w-4" />
                  Войти
                </button>
                <button
                  type="button"
                  onClick={openRegister}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  Регистрация
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-white/96 shadow-sm backdrop-blur md:hidden">
            <div className="container flex flex-col gap-2 py-3">
              {/* User info (mobile) */}
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-3 mb-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {userInitials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isAdmin ? "Администратор" : "Владелец"}
                    </p>
                  </div>
                </div>
              )}

              {/* Nav items */}
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

              {/* Auth-only nav items */}
              {isAuthenticated &&
                authNavItems.map((item) => {
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

              {/* Profile link (mobile) */}
              {isAuthenticated && (
                <Link href="/profile">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                      location === "/profile"
                        ? "bg-primary/10 text-primary"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <User className="h-4 w-4" />
                      Мой профиль
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </Link>
              )}

              {/* Admin link (mobile) */}
              {isAdmin && (
                <Link href="/admin">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                      location.startsWith("/admin")
                        ? "bg-primary/10 text-primary"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <Shield className="h-4 w-4" />
                      Админ-панель
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </Link>
              )}

              {/* Bottom action */}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {logoutMutation.isPending ? "Выход..." : "Выйти"}
                </button>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={openLogin}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <LogIn className="h-4 w-4" />
                    Войти
                  </button>
                  <button
                    type="button"
                    onClick={openRegister}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow transition-colors hover:bg-primary/90"
                  >
                    <UserPlus className="h-4 w-4" />
                    Регистрация
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultView={authModalView}
      />
    </>
  );
}
