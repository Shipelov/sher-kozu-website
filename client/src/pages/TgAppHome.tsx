/**
 * Telegram Mini App — Home screen (navigation hub)
 * Compact cards linking to all Mini App sections.
 */

import { useLocation } from "wouter";
import { useTelegram } from "@/contexts/TelegramContext";
import TelegramMiniAppLayout from "@/components/TelegramMiniAppLayout";
import { trpc } from "@/lib/trpc";
import {
  Heart,
  Truck,
  Coins,
  CalendarDays,
  Stethoscope,
  ChevronRight,
  Loader2,
} from "lucide-react";

const sections = [
  {
    id: "status",
    path: "/tg/status",
    title: "Моё животное",
    subtitle: "Здоровье, счастье, настроение",
    icon: Heart,
    color: "bg-rose-50 text-rose-600",
    iconBg: "bg-rose-100",
  },
  {
    id: "delivery",
    path: "/tg/delivery",
    title: "Доставки",
    subtitle: "Статус и расписание",
    icon: Truck,
    color: "bg-emerald-50 text-emerald-600",
    iconBg: "bg-emerald-100",
  },
  {
    id: "balance",
    path: "/tg/balance",
    title: "Баланс SKC",
    subtitle: "Токены и транзакции",
    icon: Coins,
    color: "bg-amber-50 text-amber-600",
    iconBg: "bg-amber-100",
  },
  {
    id: "events",
    path: "/tg/events",
    title: "События клуба",
    subtitle: "Ближайшие мероприятия",
    icon: CalendarDays,
    color: "bg-blue-50 text-blue-600",
    iconBg: "bg-blue-100",
  },
  {
    id: "zoya",
    path: "/tg/zoya",
    title: "Зоя — нутрициолог",
    subtitle: "AI-консультации по питанию",
    icon: Stethoscope,
    color: "bg-violet-50 text-violet-600",
    iconBg: "bg-violet-100",
  },
];

export default function TgAppHome() {
  const { user, webApp } = useTelegram();
  const [, setLocation] = useLocation();

  const handleNavigate = (path: string) => {
    webApp?.HapticFeedback?.selectionChanged();
    setLocation(path);
  };

  return (
    <TelegramMiniAppLayout showBack={false}>
      {/* Header */}
      <div className="bg-[#1a3a2a] text-white px-5 pt-5 pb-8">
        <p className="text-sm text-white/60 mb-1">Добро пожаловать,</p>
        <h1 className="text-xl font-bold">
          {user?.name || "Владелец"}
        </h1>
        <p className="text-xs text-white/50 mt-1">Шерь Козу — персональное фермерство</p>
      </div>

      {/* Cards */}
      <div className="px-4 -mt-4 space-y-3 pb-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => handleNavigate(s.path)}
              className="w-full flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div
                className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}
              >
                <Icon className={`h-6 w-6 ${s.color.split(" ")[1]}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#1a3a2a]">{s.title}</p>
                <p className="text-xs text-[#1a3a2a]/50 mt-0.5">{s.subtitle}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#1a3a2a]/20 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="px-4 pt-2 pb-6 text-center">
        <a
          href="https://koza.vip"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#1a3a2a]/40 underline"
        >
          Открыть полную версию koza.vip
        </a>
      </div>
    </TelegramMiniAppLayout>
  );
}
