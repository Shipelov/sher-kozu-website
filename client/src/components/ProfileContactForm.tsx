import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Mail, Phone, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfileContactForm() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync form with user data on load
  useEffect(() => {
    if (user) {
      setEmail((user as any).email ?? "");
      setPhone((user as any).phone ?? "");
    }
  }, [user]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Контактные данные сохранены");
      setDirty(false);
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось сохранить контактные данные");
    },
  });

  const handleFieldChange = useCallback(
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setDirty(true);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim() || null;
      const trimmedPhone = phone.trim() || null;

      // Basic email validation
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        toast.error("Введите корректный email-адрес");
        return;
      }

      updateProfile.mutate({
        email: trimmedEmail,
        phone: trimmedPhone,
      });
    },
    [email, phone, updateProfile],
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
              Email и телефон для связи с фермой
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={handleFieldChange(setEmail)}
              className="rounded-xl"
              maxLength={320}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone" className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Телефон
            </Label>
            <Input
              id="profile-phone"
              type="tel"
              placeholder="+7 (999) 123-45-67"
              value={phone}
              onChange={handleFieldChange(setPhone)}
              className="rounded-xl"
              maxLength={32}
            />
          </div>

          <div className="rounded-xl bg-secondary/55 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            Эти данные видны только ферме и используются для связи по вопросам доставки и участия.
          </div>

          <Button
            type="submit"
            disabled={!dirty || updateProfile.isPending}
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
