import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Mail, MessageCircle, Phone, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { applyPhoneMask, formatPhone, isValidRussianPhone, stripNonDigits } from "@shared/phone";

type PreferredContact = "email" | "phone" | "messenger" | null;

const PREFERRED_CONTACT_OPTIONS: { value: "email" | "phone" | "messenger"; label: string; icon: React.ReactNode }[] = [
  { value: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
  { value: "phone", label: "Телефон / Звонок", icon: <Phone className="h-3.5 w-3.5" /> },
  { value: "messenger", label: "Мессенджер (WhatsApp, Telegram)", icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

export default function ProfileContactForm() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<PreferredContact>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Sync form with user data on load
  useEffect(() => {
    if (user) {
      setEmail((user as any).email ?? "");
      setPhone((user as any).phone ?? "");
      setPreferredContact((user as any).preferredContact ?? null);
    }
  }, [user]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Контактные данные сохранены");
      setDirty(false);
      setPhoneError(null);
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось сохранить контактные данные");
    },
  });

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setDirty(true);
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    if (rawValue === "" || rawValue.trim() === "") {
      setPhone("");
      setPhoneError(null);
      setDirty(true);
      return;
    }

    const masked = applyPhoneMask(rawValue);
    setPhone(masked);
    setDirty(true);

    const digits = stripNonDigits(rawValue);
    let coreLen = digits.length;
    if (digits.length > 0 && (digits[0] === "7" || digits[0] === "8")) {
      coreLen = digits.length - 1;
    }

    if (coreLen > 0 && coreLen < 10) {
      setPhoneError("Введите 10 цифр номера");
    } else {
      setPhoneError(null);
    }
  }, []);

  const handlePhoneFocus = useCallback(() => {
    if (!phone) {
      setPhone("+7 ");
    }
  }, [phone]);

  const handlePhoneBlur = useCallback(() => {
    const trimmed = phone.trim();
    if (trimmed === "+7" || trimmed === "+7 " || trimmed === "+7 (") {
      setPhone("");
      setPhoneError(null);
    }
  }, [phone]);

  const handlePreferredContactChange = useCallback((value: string) => {
    setPreferredContact(value as PreferredContact);
    setDirty(true);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim() || null;
      const trimmedPhone = phone.trim() || null;

      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        toast.error("Введите корректный email-адрес");
        return;
      }

      let phoneToSend: string | null = null;
      if (trimmedPhone) {
        if (!isValidRussianPhone(trimmedPhone)) {
          setPhoneError("Введите корректный номер в формате +7 (XXX) XXX-XX-XX");
          return;
        }
        phoneToSend = formatPhone(trimmedPhone);
      }

      updateProfile.mutate({
        email: trimmedEmail,
        phone: phoneToSend,
        preferredContact: preferredContact,
      });
    },
    [email, phone, preferredContact, updateProfile],
  );

  if (!user) return null;

  return (
    <Card className="rounded-[2rem] border-border/70 bg-white/95 shadow-sm" data-testid="profileContactForm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Контактные данные</CardTitle>
            <CardDescription>
              Email, телефон и предпочтительный способ связи
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="profile-email" className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="profile-email"
              type="email"
              placeholder="example@mail.ru"
              value={email}
              onChange={handleEmailChange}
              className="rounded-xl"
              maxLength={320}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Телефон
            </Label>
            <Input
              ref={phoneRef}
              id="profile-phone"
              type="tel"
              placeholder="+7 (XXX) XXX-XX-XX"
              value={phone}
              onChange={handlePhoneChange}
              onFocus={handlePhoneFocus}
              onBlur={handlePhoneBlur}
              className={`rounded-xl ${phoneError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              maxLength={18}
            />
            {phoneError && (
              <p className="text-xs text-red-500 mt-1">{phoneError}</p>
            )}
          </div>

          {/* Preferred contact method */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Предпочтительный способ связи
            </Label>
            <Select
              value={preferredContact ?? ""}
              onValueChange={handlePreferredContactChange}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Выберите способ связи" />
              </SelectTrigger>
              <SelectContent>
                {PREFERRED_CONTACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preferredContact && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={() => {
                  setPreferredContact(null);
                  setDirty(true);
                }}
              >
                Сбросить выбор
              </button>
            )}
          </div>

          <div className="rounded-xl bg-secondary/55 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            Эти данные видны только ферме и используются для связи по вопросам доставки и участия.
            Телефон сохраняется в формате +7 (XXX) XXX-XX-XX.
          </div>

          <Button
            type="submit"
            disabled={!dirty || updateProfile.isPending || !!phoneError}
            className="w-full rounded-full"
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Сохранить контакты
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
