/**
 * TelegramMiniAppLayout — wrapper for all /tg-app/* pages.
 * No navbar (Telegram has its own), uses BackButton for navigation,
 * applies Telegram theme colors, and shows auth/error states.
 */

import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useTelegram } from "@/contexts/TelegramContext";
import { Loader2, AlertCircle, LinkIcon } from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export default function TelegramMiniAppLayout({
  children,
  title,
  showBack = true,
}: Props) {
  const { webApp, loading, error, isAuthenticated } = useTelegram();
  const [location, setLocation] = useLocation();

  // Manage Telegram BackButton
  useEffect(() => {
    if (!webApp) return;

    const isHome = location === "/tg-app" || location === "/tg-app/";

    if (showBack && !isHome) {
      webApp.BackButton.show();
      const handler = () => {
        setLocation("/tg-app");
      };
      webApp.BackButton.onClick(handler);
      return () => {
        webApp.BackButton.offClick(handler);
        webApp.BackButton.hide();
      };
    } else {
      webApp.BackButton.hide();
    }
  }, [webApp, location, showBack, setLocation]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3a2a]" />
        <p className="text-sm text-[#1a3a2a]/60 font-medium">
          Загрузка...
        </p>
      </div>
    );
  }

  // Error / not linked
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <LinkIcon className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-[#1a3a2a]">
          Аккаунт не привязан
        </h2>
        <p className="text-sm text-[#1a3a2a]/70 max-w-xs leading-relaxed">
          {error}
        </p>
        <a
          href="https://koza.vip/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1a3a2a] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Открыть koza.vip
        </a>
      </div>
    );
  }

  // Not in Telegram
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-6 gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-[#1a3a2a]/40" />
        <p className="text-sm text-[#1a3a2a]/60">
          Откройте это приложение через Telegram-бот @sherkozu_bot
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {title && (
        <header className="sticky top-0 z-10 bg-[#1a3a2a] text-white px-4 py-3">
          <h1 className="text-base font-semibold text-center">{title}</h1>
        </header>
      )}
      <main className="pb-6">{children}</main>
    </div>
  );
}
