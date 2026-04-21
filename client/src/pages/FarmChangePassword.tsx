/**
 * /farm/change-password — Farm Worker Change Password Page.
 *
 * Shown on first login (mustChangePassword) or when worker wants to change password.
 * Mobile-first design with large touch targets.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function FarmChangePassword() {
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check auth
  const meQuery = trpc.farmAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!meQuery.isLoading && !meQuery.data) {
      navigate("/farm");
    }
  }, [meQuery.isLoading, meQuery.data, navigate]);

  const changeMutation = trpc.farmAuth.changePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      // After 2 seconds, redirect to the appropriate ARM
      setTimeout(() => {
        const role = meQuery.data?.role;
        if (role === "milker") {
          navigate("/farm/milker");
        } else if (role === "cheesemaker") {
          navigate("/farm/cheesemaker");
        } else {
          navigate("/farm/milker");
        }
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Новый пароль должен содержать минимум 6 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    changeMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const isLoading = changeMutation.isPending;
  const isFirstLogin = meQuery.data?.mustChangePassword;

  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.35_0.12_150)]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[oklch(0.97_0.015_90)]">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[oklch(0.22_0.04_60)] mb-2 text-center">
          Пароль изменён
        </h2>
        <p className="text-sm text-[oklch(0.52_0.04_80)] text-center">
          Перенаправляем в рабочую зону...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[oklch(0.97_0.015_90)]">
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-4">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-[oklch(0.72_0.15_75)] flex items-center justify-center mb-6 shadow-lg">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-[oklch(0.22_0.04_60)] mb-1 text-center">
          {isFirstLogin ? "Установите пароль" : "Смена пароля"}
        </h1>
        <p className="text-sm text-[oklch(0.52_0.04_80)] mb-8 text-center max-w-xs">
          {isFirstLogin
            ? "Для безопасности установите свой пароль при первом входе."
            : "Введите текущий и новый пароль."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Current password — only if not first login */}
          {!isFirstLogin && (
            <div className="space-y-2">
              <Label
                htmlFor="current-pw"
                className="text-sm font-medium text-[oklch(0.35_0.04_60)]"
              >
                Текущий пароль
              </Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Текущий пароль"
                  className="h-14 text-lg rounded-xl border-[oklch(0.85_0.02_90)] bg-white pr-14
                             focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]
                             placeholder:text-[oklch(0.7_0.02_80)]"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[oklch(0.52_0.04_80)]
                             active:text-[oklch(0.35_0.12_150)] touch-manipulation"
                  tabIndex={-1}
                >
                  {showCurrent ? (
                    <EyeOff className="w-6 h-6" />
                  ) : (
                    <Eye className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* New password */}
          <div className="space-y-2">
            <Label
              htmlFor="new-pw"
              className="text-sm font-medium text-[oklch(0.35_0.04_60)]"
            >
              Новый пароль
            </Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="h-14 text-lg rounded-xl border-[oklch(0.85_0.02_90)] bg-white pr-14
                           focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]
                           placeholder:text-[oklch(0.7_0.02_80)]"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[oklch(0.52_0.04_80)]
                           active:text-[oklch(0.35_0.12_150)] touch-manipulation"
                tabIndex={-1}
              >
                {showNew ? (
                  <EyeOff className="w-6 h-6" />
                ) : (
                  <Eye className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label
              htmlFor="confirm-pw"
              className="text-sm font-medium text-[oklch(0.35_0.04_60)]"
            >
              Подтвердите пароль
            </Label>
            <Input
              id="confirm-pw"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
              className="h-14 text-lg rounded-xl border-[oklch(0.85_0.02_90)] bg-white
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]
                         placeholder:text-[oklch(0.7_0.02_80)]"
              disabled={isLoading}
            />
            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <p
                className={`text-xs mt-1 ${
                  newPassword === confirmPassword
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {newPassword === confirmPassword
                  ? "✓ Пароли совпадают"
                  : "✗ Пароли не совпадают"}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading || newPassword.length < 6 || newPassword !== confirmPassword}
            className="w-full h-14 text-lg font-semibold rounded-xl
                       bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]
                       active:bg-[oklch(0.28_0.12_150)] text-white
                       shadow-md active:shadow-sm transition-all
                       disabled:opacity-50 touch-manipulation"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Сохранить пароль"
            )}
          </Button>
        </form>
      </div>

      {/* Bottom */}
      <div className="px-6 pb-8 pt-4 text-center">
        <p className="text-xs text-[oklch(0.65_0.02_80)]">
          Пароль должен содержать минимум 6 символов.
        </p>
      </div>
    </div>
  );
}
