/**
 * /farm — Farm Worker Login Page.
 *
 * Mobile-first design optimized for smartphone use by farm workers.
 * Large touch targets (min 48px), minimal text input, bottom-aligned actions.
 * Isolated from the main site auth — uses farm_session cookie.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Milk, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function FarmLogin() {
  const [, navigate] = useLocation();
  const [login, setLogin] = useState(() => {
    try { return localStorage.getItem("farm_saved_login") ?? ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem("farm_remember_me") === "1"; } catch { return false; }
  });
  const [error, setError] = useState("");

  // Check if already logged in
  const meQuery = trpc.farmAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      if (meQuery.data.mustChangePassword) {
        navigate("/farm/change-password");
      } else {
        // Redirect to appropriate ARM based on role
        const role = meQuery.data.role;
        if (role === "milker") {
          navigate("/farm/milker");
        } else if (role === "cheesemaker") {
          navigate("/farm/cheesemaker");
        } else {
          navigate("/farm/milker");
        }
      }
    }
  }, [meQuery.data, navigate]);

  const loginMutation = trpc.farmAuth.login.useMutation({
    onSuccess: (data) => {
      // Save or clear login for "remember me"
      try {
        if (rememberMe) {
          localStorage.setItem("farm_saved_login", login.trim());
          localStorage.setItem("farm_remember_me", "1");
        } else {
          localStorage.removeItem("farm_saved_login");
          localStorage.removeItem("farm_remember_me");
        }
      } catch { /* ignore */ }

      if (data.mustChangePassword) {
        navigate("/farm/change-password");
      } else {
        const role = data.worker.role;
        if (role === "milker") {
          navigate("/farm/milker");
        } else if (role === "cheesemaker") {
          navigate("/farm/cheesemaker");
        } else {
          navigate("/farm/milker");
        }
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login.trim() || !password.trim()) {
      setError("Введите логин и пароль");
      return;
    }
    loginMutation.mutate({ login: login.trim(), password });
  };

  const isLoading = loginMutation.isPending;

  // While checking session, show loader
  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[oklch(0.97_0.015_90)]">
        <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.35_0.12_150)]" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[oklch(0.97_0.015_90)]">
      {/* Top section with logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-4">
        {/* Farm icon */}
        <div className="w-20 h-20 rounded-2xl bg-[oklch(0.35_0.12_150)] flex items-center justify-center mb-6 shadow-lg">
          <Milk className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-[oklch(0.22_0.04_60)] mb-1 text-center">
          АРМ Фермы
        </h1>
        <p className="text-sm text-[oklch(0.52_0.04_80)] mb-8 text-center">
          Шерь Козу — Контроль оборота молока
        </p>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Login field */}
          <div className="space-y-2">
            <Label
              htmlFor="farm-login"
              className="text-sm font-medium text-[oklch(0.35_0.04_60)]"
            >
              Логин
            </Label>
            <Input
              id="farm-login"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Ваш логин"
              className="h-14 text-lg rounded-xl border-[oklch(0.85_0.02_90)] bg-white
                         focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]
                         placeholder:text-[oklch(0.7_0.02_80)]"
              disabled={isLoading}
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <Label
              htmlFor="farm-password"
              className="text-sm font-medium text-[oklch(0.35_0.04_60)]"
            >
              Пароль
            </Label>
            <div className="relative">
              <Input
                id="farm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                className="h-14 text-lg rounded-xl border-[oklch(0.85_0.02_90)] bg-white pr-14
                           focus:border-[oklch(0.35_0.12_150)] focus:ring-[oklch(0.35_0.12_150)]
                           placeholder:text-[oklch(0.7_0.02_80)]"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[oklch(0.52_0.04_80)]
                           active:text-[oklch(0.35_0.12_150)] touch-manipulation"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-6 h-6" />
                ) : (
                  <Eye className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me checkbox */}
          <label className="flex items-center gap-3 cursor-pointer touch-manipulation select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-5 h-5 rounded border-[oklch(0.85_0.02_90)] text-[oklch(0.35_0.12_150)]
                         focus:ring-[oklch(0.35_0.12_150)] accent-[oklch(0.35_0.12_150)]"
              disabled={isLoading}
            />
            <span className="text-sm text-[oklch(0.45_0.04_60)]">Запомнить меня</span>
          </label>

          {/* Submit button — large touch target */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 text-lg font-semibold rounded-xl
                       bg-[oklch(0.35_0.12_150)] hover:bg-[oklch(0.30_0.12_150)]
                       active:bg-[oklch(0.28_0.12_150)] text-white
                       shadow-md active:shadow-sm transition-all
                       touch-manipulation"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Войти"
            )}
          </Button>
        </form>
      </div>

      {/* Bottom info */}
      <div className="px-6 pb-8 pt-4 text-center">
        <p className="text-xs text-[oklch(0.65_0.02_80)]">
          Доступ только для сотрудников фермы.
          <br />
          Если забыли пароль — обратитесь к администратору.
        </p>
      </div>
    </div>
  );
}
