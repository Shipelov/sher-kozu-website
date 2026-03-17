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
});
