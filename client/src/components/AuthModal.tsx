/**
 * AuthModal — Unified authentication dialog.
 * Supports: Login, Registration (with captcha + OTP), Password Reset.
 * Steps flow:
 *   Registration: form → captcha → OTP → done
 *   Login: form → done
 *   Password Reset: email → OTP → new password → done
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { applyPhoneMask } from "@shared/phone";
import PuzzleCaptcha from "./PuzzleCaptcha";
import {
  Mail,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type AuthView =
  | "login"
  | "register"
  | "register-captcha"
  | "register-otp"
  | "forgot-password"
  | "forgot-otp"
  | "reset-password"
  | "success";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: "login" | "register";
}

export default function AuthModal({
  open,
  onOpenChange,
  defaultView = "login",
}: AuthModalProps) {
  const [view, setView] = useState<AuthView>(defaultView);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Registration fields
  const [regLastName, setRegLastName] = useState(""); // Фамилия
  const [regFirstName, setRegFirstName] = useState(""); // Имя
  const [regMiddleName, setRegMiddleName] = useState(""); // Отчество
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const verificationChannel = "email" as const; // Only email verification supported
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Compose full name: "Фамилия Имя Отчество"
  const regFullName = [regLastName, regFirstName, regMiddleName].map(s => s.trim()).filter(Boolean).join(" ");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // OTP fields
  const [otpCode, setOtpCode] = useState("");
  const [otpTarget, setOtpTarget] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "phone">("email");
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Password reset fields
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Mutations
  const registerMutation = trpc.localAuth.register.useMutation();
  const verifyRegistrationMutation = trpc.localAuth.verifyRegistration.useMutation();
  const loginMutation = trpc.localAuth.login.useMutation();
  const requestResetMutation = trpc.localAuth.requestPasswordReset.useMutation();
  const resetPasswordMutation = trpc.localAuth.resetPassword.useMutation();
  const resendOtpMutation = trpc.localAuth.resendOtp.useMutation();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setView(defaultView);
      setError("");
      setSuccessMessage("");
    }
  }, [open, defaultView]);

  // Timer for OTP expiry
  useEffect(() => {
    if (!otpExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((otpExpiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setCanResend(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Registration flow ────────────────────────────────────

  const handleRegisterSubmit = () => {
    setError("");
    if (!regLastName.trim()) { setError("Введите фамилию"); return; }
    if (!regFirstName.trim()) { setError("Введите имя"); return; }
    if (!regEmail.trim()) { setError("Введите email"); return; }
    if (!regPassword) { setError("Введите пароль"); return; }
    if (regPassword.length < 8) { setError("Пароль должен содержать минимум 8 символов"); return; }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(regPassword)) { setError("Пароль должен содержать хотя бы одну букву"); return; }
    if (!/[0-9]/.test(regPassword)) { setError("Пароль должен содержать хотя бы одну цифру"); return; }
    if (regPassword !== regPasswordConfirm) { setError("Пароли не совпадают"); return; }

    // Move to captcha step
    setView("register-captcha");
  };

  const handleCaptchaVerified = () => {
    // After captcha, send OTP
    registerMutation.mutate(
      {
        name: regFullName,
        email: regEmail.trim(),
        phone: regPhone.trim() || null,
        password: regPassword,
        verificationChannel,
      },
      {
        onSuccess: (data) => {
          setOtpTarget(data.otpTarget);
          setOtpChannel(data.otpChannel);
          setOtpExpiresAt(new Date(data.expiresAt));
          setTimeLeft(180);
          setCanResend(false);
          setOtpCode("");
          setView("register-otp");
        },
        onError: (err) => {
          setError(err.message);
          setView("register");
        },
      }
    );
  };

  const handleVerifyRegistrationOtp = () => {
    setError("");
    if (otpCode.length !== 6) { setError("Введите 6-значный код"); return; }

    verifyRegistrationMutation.mutate(
      {
        name: regFullName,
        email: regEmail.trim(),
        phone: regPhone.trim() || null,
        password: regPassword,
        otpTarget,
        code: otpCode,
      },
      {
        onSuccess: () => {
          setSuccessMessage("Регистрация завершена! Добро пожаловать в Шерь Козу.");
          setView("success");
          setTimeout(() => {
            onOpenChange(false);
            window.location.reload();
          }, 1500);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  // ─── Login flow ───────────────────────────────────────────

  const handleLogin = () => {
    setError("");
    if (!loginEmail.trim()) { setError("Введите email"); return; }
    if (!loginPassword) { setError("Введите пароль"); return; }

    loginMutation.mutate(
      {
        email: loginEmail.trim(),
        password: loginPassword,
        rememberMe,
      },
      {
        onSuccess: () => {
          setSuccessMessage("Вход выполнен!");
          setView("success");
          setTimeout(() => {
            onOpenChange(false);
            window.location.reload();
          }, 1000);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  // ─── Password reset flow ──────────────────────────────────

  const handleRequestReset = () => {
    setError("");
    if (!resetEmail.trim()) { setError("Введите email"); return; }

    requestResetMutation.mutate(
      { email: resetEmail.trim() },
      {
        onSuccess: (data) => {
          setOtpTarget(resetEmail.trim());
          setOtpChannel("email");
          if (data.expiresAt) {
            setOtpExpiresAt(new Date(data.expiresAt));
            setTimeLeft(180);
          }
          setCanResend(false);
          setOtpCode("");
          setView("forgot-otp");
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  const handleVerifyResetOtp = () => {
    setError("");
    if (otpCode.length !== 6) { setError("Введите 6-значный код"); return; }
    setView("reset-password");
  };

  const handleResetPassword = () => {
    setError("");
    if (!newPassword) { setError("Введите новый пароль"); return; }
    if (newPassword.length < 8) { setError("Пароль должен содержать минимум 8 символов"); return; }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(newPassword)) { setError("Пароль должен содержать хотя бы одну букву"); return; }
    if (!/[0-9]/.test(newPassword)) { setError("Пароль должен содержать хотя бы одну цифру"); return; }
    if (newPassword !== newPasswordConfirm) { setError("Пароли не совпадают"); return; }

    resetPasswordMutation.mutate(
      {
        email: resetEmail.trim(),
        code: otpCode,
        newPassword,
      },
      {
        onSuccess: () => {
          setSuccessMessage("Пароль успешно изменён. Вы вошли в систему.");
          setView("success");
          setTimeout(() => {
            onOpenChange(false);
            window.location.reload();
          }, 1500);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  // ─── Resend OTP ───────────────────────────────────────────

  const handleResendOtp = () => {
    const purpose = view === "register-otp" ? "registration" as const : "password_reset" as const;
    resendOtpMutation.mutate(
      { target: otpTarget, purpose, channel: otpChannel },
      {
        onSuccess: (data) => {
          setOtpExpiresAt(new Date(data.expiresAt));
          setTimeLeft(180);
          setCanResend(false);
          setOtpCode("");
          setError("");
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  // ─── Phone input handler ──────────────────────────────────

  const handlePhoneChange = (value: string) => {
    setRegPhone(applyPhoneMask(value));
  };

  // ─── Render helpers ───────────────────────────────────────

  const isLoading =
    registerMutation.isPending ||
    verifyRegistrationMutation.isPending ||
    loginMutation.isPending ||
    requestResetMutation.isPending ||
    resetPasswordMutation.isPending ||
    resendOtpMutation.isPending;

  const renderBackButton = (targetView: AuthView) => (
    <button
      onClick={() => { setView(targetView); setError(""); }}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Назад
    </button>
  );

  const renderError = () =>
    error ? (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    ) : null;

  const renderPasswordInput = (
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    toggleShow: () => void,
    placeholder: string,
    id: string
  ) => (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      <button
        type="button"
        onClick={toggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  // ─── Views ────────────────────────────────────────────────

  const renderLogin = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">Вход в аккаунт</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Введите email и пароль для входа
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="your@email.com"
              className="pl-10"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">Пароль</Label>
          {renderPasswordInput(
            loginPassword,
            setLoginPassword,
            showLoginPassword,
            () => setShowLoginPassword(!showLoginPassword),
            "Введите пароль",
            "login-password"
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(c) => setRememberMe(!!c)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              Запомнить меня
            </Label>
          </div>
          <button
            onClick={() => { setView("forgot-password"); setError(""); }}
            className="text-sm text-primary hover:underline"
          >
            Забыли пароль?
          </button>
        </div>

        <Button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Войти
        </Button>
      </div>

      {/* ── Divider ── */}
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      {/* ── Google OAuth ── */}
      <Button
        variant="outline"
        size="lg"
        className="w-full gap-3 bg-white hover:bg-gray-50 border-border"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
        data-testid="google-oauth-btn"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Войти через Google
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <button
          onClick={() => { setView("register"); setError(""); }}
          className="text-primary font-medium hover:underline"
        >
          Зарегистрироваться
        </button>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">Регистрация</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Станьте участником клуба персонального фермерства
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reg-lastname">Фамилия *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reg-lastname"
              value={regLastName}
              onChange={(e) => setRegLastName(e.target.value)}
              placeholder="Иванов"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-firstname">Имя *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reg-firstname"
              value={regFirstName}
              onChange={(e) => setRegFirstName(e.target.value)}
              placeholder="Иван"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-middlename">Отчество</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reg-middlename"
              value={regMiddleName}
              onChange={(e) => setRegMiddleName(e.target.value)}
              placeholder="Иванович"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reg-email"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="your@email.com"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-phone">Телефон</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reg-phone"
              type="tel"
              value={regPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Пароль *</Label>
          {renderPasswordInput(
            regPassword,
            setRegPassword,
            showRegPassword,
            () => setShowRegPassword(!showRegPassword),
            "Минимум 8 символов, буквы + цифры",
            "reg-password"
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password-confirm">Подтвердите пароль *</Label>
          {renderPasswordInput(
            regPasswordConfirm,
            setRegPasswordConfirm,
            showRegPassword,
            () => setShowRegPassword(!showRegPassword),
            "Повторите пароль",
            "reg-password-confirm"
          )}
        </div>

        {/* Email verification notice */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <Mail className="w-4 h-4 shrink-0" />
          <span>Код подтверждения будет отправлен на указанный email</span>
        </div>

        <Button
          onClick={handleRegisterSubmit}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          Продолжить
        </Button>
      </div>

      {/* ── Divider ── */}
      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">или</span>
        </div>
      </div>

      {/* ── Google OAuth ── */}
      <Button
        variant="outline"
        size="lg"
        className="w-full gap-3 bg-white hover:bg-gray-50 border-border"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
        data-testid="google-oauth-btn-register"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Зарегистрироваться через Google
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <button
          onClick={() => { setView("login"); setError(""); }}
          className="text-primary font-medium hover:underline"
        >
          Войти
        </button>
      </div>
    </div>
  );

  const renderCaptcha = () => (
    <div className="space-y-4">
      {renderBackButton("register")}
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">Подтвердите, что вы человек</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Перетащите ползунок, чтобы вставить пазл на место
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="flex justify-center">
        <PuzzleCaptcha onVerified={handleCaptchaVerified} />
      </div>

      {registerMutation.isPending && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Отправляем код подтверждения...
        </div>
      )}
    </div>
  );

  const renderOtpVerification = (
    title: string,
    description: string,
    onVerify: () => void,
    backView: AuthView
  ) => (
    <div className="space-y-4">
      {renderBackButton(backView)}
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">{title}</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          {description}
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="space-y-4">
        {/* Target info */}
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Код отправлен на </span>
          <span className="font-medium">{otpTarget}</span>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <span className="mx-1 text-muted-foreground">—</span>
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Timer */}
        <div className="text-center text-sm">
          {timeLeft > 0 ? (
            <span className="text-muted-foreground">
              Код действителен ещё <span className="font-mono font-medium text-foreground">{formatTime(timeLeft)}</span>
            </span>
          ) : (
            <span className="text-amber-600">Код истёк</span>
          )}
        </div>

        <Button
          onClick={onVerify}
          disabled={isLoading || otpCode.length !== 6}
          className="w-full"
          size="lg"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Подтвердить
        </Button>

        {/* Resend */}
        <div className="text-center">
          {canResend || timeLeft === 0 ? (
            <button
              onClick={handleResendOtp}
              disabled={resendOtpMutation.isPending}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {resendOtpMutation.isPending ? "Отправляем..." : "Отправить код повторно"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Повторная отправка через {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="space-y-4">
      {renderBackButton("login")}
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">Восстановление пароля</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Введите email, указанный при регистрации. Мы отправим код для сброса пароля.
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="your@email.com"
              className="pl-10"
              onKeyDown={(e) => e.key === "Enter" && handleRequestReset()}
            />
          </div>
        </div>

        <Button
          onClick={handleRequestReset}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Отправить код
        </Button>
      </div>
    </div>
  );

  const renderResetPassword = () => (
    <div className="space-y-4">
      {renderBackButton("forgot-otp")}
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-center">Новый пароль</DialogTitle>
        <DialogDescription className="text-center text-muted-foreground">
          Придумайте новый пароль для вашего аккаунта
        </DialogDescription>
      </DialogHeader>

      {renderError()}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Новый пароль</Label>
          {renderPasswordInput(
            newPassword,
            setNewPassword,
            showNewPassword,
            () => setShowNewPassword(!showNewPassword),
            "Минимум 8 символов, буквы + цифры",
            "new-password"
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password-confirm">Подтвердите пароль</Label>
          {renderPasswordInput(
            newPasswordConfirm,
            setNewPasswordConfirm,
            showNewPassword,
            () => setShowNewPassword(!showNewPassword),
            "Повторите пароль",
            "new-password-confirm"
          )}
        </div>

        <Button
          onClick={handleResetPassword}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Сохранить пароль
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="space-y-4 py-8 text-center">
      <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
      <p className="text-lg font-medium">{successMessage}</p>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────

  const renderContent = () => {
    switch (view) {
      case "login":
        return renderLogin();
      case "register":
        return renderRegister();
      case "register-captcha":
        return renderCaptcha();
      case "register-otp":
        return renderOtpVerification(
          "Введите код подтверждения",
          "Мы отправили 6-значный код на вашу электронную почту",
          handleVerifyRegistrationOtp,
          "register-captcha"
        );
      case "forgot-password":
        return renderForgotPassword();
      case "forgot-otp":
        return renderOtpVerification(
          "Введите код сброса",
          "Мы отправили 6-значный код на вашу почту",
          handleVerifyResetOtp,
          "forgot-password"
        );
      case "reset-password":
        return renderResetPassword();
      case "success":
        return renderSuccess();
      default:
        return renderLogin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 max-h-[90vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
