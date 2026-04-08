import { Link } from "wouter";
import { Leaf, Mail, Phone } from "lucide-react";

const CONTACT_EMAIL = "info@sherkozu.ru";

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card py-10">
      <div className="container">
        {/* Top row: brand + nav + contact */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-display text-lg text-foreground">
                Шерь Козу
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Семейная ферма персонального фермерства. Выберите животное,
              следите за его жизнью и получайте именные продукты.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">Разделы</h4>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link
                href="/animals"
                className="transition-colors hover:text-foreground"
              >
                Животные
              </Link>
              <Link
                href="/club"
                className="transition-colors hover:text-foreground"
              >
                Клуб
              </Link>
              <Link
                href="/tracker"
                className="transition-colors hover:text-foreground"
              >
                Трекер
              </Link>
              <Link
                href="/pricing"
                className="transition-colors hover:text-foreground"
              >
                Цены
              </Link>
              <Link
                href="/about"
                className="transition-colors hover:text-foreground"
              >
                О ферме
              </Link>
              <Link
                href="/partners"
                className="transition-colors hover:text-foreground"
              >
                Для партнёров
              </Link>
              <Link
                href="/faq"
                className="transition-colors hover:text-foreground"
              >
                FAQ
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              Свяжитесь с нами
            </h4>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="group inline-flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 transition-all hover:border-primary/40 hover:bg-primary/10"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {CONTACT_EMAIL}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ответим в течение дня
                </p>
              </div>
            </a>
          </div>
        </div>

        {/* Bottom row: copyright */}
        <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Шерь Козу. Семейная ферма
          персонального фермерства.
        </div>
      </div>
    </footer>
  );
}
