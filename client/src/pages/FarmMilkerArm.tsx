/**
 * /farm/milker — Milker ARM (Automated Workstation) placeholder.
 *
 * Mobile-first interface for recording milking sessions.
 * Full implementation in Stage 2.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Milk, LogOut, Construction } from "lucide-react";
import { toast } from "sonner";

export default function FarmMilkerArm() {
  const [, navigate] = useLocation();

  const meQuery = trpc.farmAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.farmAuth.logout.useMutation({
    onSuccess: () => {
      navigate("/farm");
    },
  });

  useEffect(() => {
    if (!meQuery.isLoading && !meQuery.data) {
      navigate("/farm");
    }
    if (meQuery.data?.mustChangePassword) {
      navigate("/farm/change-password");
    }
  }, [meQuery.isLoading, meQuery.data, navigate]);

  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.35_0.12_150)]" />
      </div>
    );
  }

  const worker = meQuery.data;
  if (!worker) return null;

  return (
    <div className="min-h-dvh flex flex-col bg-[oklch(0.97_0.015_90)]">
      {/* Header — compact, mobile-friendly */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[oklch(0.9_0.02_90)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center">
            <Milk className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[oklch(0.22_0.04_60)] leading-tight">
              {worker.name}
            </p>
            <p className="text-xs text-[oklch(0.52_0.04_80)]">Дояр</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => logoutMutation.mutate()}
          className="h-10 w-10 text-[oklch(0.52_0.04_80)] hover:text-red-500 touch-manipulation"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Main content — placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-24 h-24 rounded-full bg-[oklch(0.92_0.04_150)] flex items-center justify-center mb-6">
          <Construction className="w-12 h-12 text-[oklch(0.35_0.12_150)]" />
        </div>
        <h2 className="text-xl font-bold text-[oklch(0.22_0.04_60)] mb-2 text-center">
          АРМ Дояра
        </h2>
        <p className="text-sm text-[oklch(0.52_0.04_80)] text-center max-w-xs mb-8">
          Модуль фиксации дойки будет доступен в следующем обновлении.
          Авторизация работает — вы вошли как <strong>{worker.name}</strong>.
        </p>

        {/* Quick actions preview */}
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => toast.info("Функция будет доступна в следующем обновлении")}
            className="w-full h-16 rounded-xl bg-white border border-[oklch(0.85_0.02_90)]
                       flex items-center gap-4 px-5 active:bg-[oklch(0.95_0.02_90)]
                       transition-colors touch-manipulation"
          >
            <div className="w-10 h-10 rounded-lg bg-[oklch(0.92_0.04_150)] flex items-center justify-center flex-shrink-0">
              <Milk className="w-5 h-5 text-[oklch(0.35_0.12_150)]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
                Новая дойка
              </p>
              <p className="text-xs text-[oklch(0.52_0.04_80)]">
                Зафиксировать утреннюю / вечернюю
              </p>
            </div>
          </button>

          <button
            onClick={() => toast.info("Функция будет доступна в следующем обновлении")}
            className="w-full h-16 rounded-xl bg-white border border-[oklch(0.85_0.02_90)]
                       flex items-center gap-4 px-5 active:bg-[oklch(0.95_0.02_90)]
                       transition-colors touch-manipulation"
          >
            <div className="w-10 h-10 rounded-lg bg-[oklch(0.88_0.10_80)] flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📋</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[oklch(0.22_0.04_60)]">
                История дойок
              </p>
              <p className="text-xs text-[oklch(0.52_0.04_80)]">
                Просмотр записей за период
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="px-4 pb-6 pt-4">
        <Button
          variant="outline"
          onClick={() => navigate("/farm/change-password")}
          className="w-full h-12 rounded-xl text-sm touch-manipulation"
        >
          Сменить пароль
        </Button>
      </div>
    </div>
  );
}
