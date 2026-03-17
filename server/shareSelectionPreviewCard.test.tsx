import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import ShareSelectionPreviewCard from "../client/src/components/ShareSelectionPreviewCard";

const baseProps = {
  priceLabel: "450 ₽",
  occupiedPercent: 40,
  availablePercent: 60,
  shareUnitPercent: 20,
  primarySharePercent: 20,
  primarySharePriceLabel: "90 ₽",
  availableSharePercents: [20, 40, 60],
  helperText: "Свободные доли доступны для выбора.",
  ctaLabel: "Открыть профиль и продолжить",
};

describe("ShareSelectionPreviewCard", () => {
  it("renders CTA as a link by default when ctaHref is provided", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
      />
    );

    expect(markup).toContain('<a href="/animals/marta?share=20"');
    expect(markup).not.toContain("<button");
  });

  it("renders CTA as a button when ctaAsButton is enabled, even if ctaHref is provided", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
        ctaAsButton
      />
    );

    expect(markup).toContain("<button");
    expect(markup).not.toContain('<a href="/animals/marta?share=20"');
  });

  it("keeps only one anchor in markup when used in button CTA mode inside an outer card link", () => {
    const markup = renderToStaticMarkup(
      <a href="/animals/marta?share=20">
        <ShareSelectionPreviewCard
          {...baseProps}
          ctaHref="/animals/marta?share=20"
          ctaAsButton
        />
      </a>
    );

    const anchorCount = (markup.match(/<a\b/g) ?? []).length;
    expect(anchorCount).toBe(1);
    expect(markup).toContain("<button");
  });

  it("marks link CTA as aria-disabled when disabled state is enabled", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
        ctaDisabled
      />
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('<a href="/animals/marta?share=20"');
  });

  it("disables button CTA when rendered in button mode", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
        ctaAsButton
        ctaDisabled
      />
    );

    expect(markup).toContain("<button");
    expect(markup).toContain("disabled");
  });

  it("shows pending state copy and loader marker when ctaPending is enabled", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
        ctaPending
      />
    );

    expect(markup).toContain("Подготавливаем следующий шаг");
    expect(markup).toContain("animate-spin");
  });

  it("shows login-required CTA state without switching to pending spinner", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        ctaHref="/animals/marta?share=20"
        ctaLabel="Войти и продолжить"
        ctaLoginRequired
      />
    );

    expect(markup).toContain("Войти и продолжить");
    expect(markup).toContain('<a href="/animals/marta?share=20"');
    expect(markup).not.toContain("animate-spin");
    expect(markup).toContain("lucide-package");
  });

  it("renders selectable mode with range control and active share chips", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        selectable
        selectedSharePercent={40}
      />
    );

    expect(markup).toContain('type="range"');
    expect(markup).toContain('value="40"');
    expect(markup).toContain("Выбор процента шеринга");
    expect(markup).toContain(">20%</button>");
    expect(markup).toContain(">40%</button>");
    expect(markup).toContain(">60%</button>");
  });

  it("shows fallback empty-state copy when there are no available share percents", () => {
    const markup = renderToStaticMarkup(
      <ShareSelectionPreviewCard
        {...baseProps}
        availablePercent={0}
        availableSharePercents={[]}
        selectable
      />
    );

    expect(markup).toContain("Свободных долей сейчас нет");
    expect(markup).toContain('disabled=""');
  });
});
