import { renderToStaticMarkup } from "react-dom/server";

import ShareSelectionPreviewCard from "../../client/src/components/ShareSelectionPreviewCard";

type ShareSelectionPreviewCardProps = Parameters<typeof ShareSelectionPreviewCard>[0];

export const shareSelectionPreviewCardBaseProps: ShareSelectionPreviewCardProps = {
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

export function renderShareSelectionPreviewCard(
  overrides: Partial<ShareSelectionPreviewCardProps> = {},
) {
  return renderToStaticMarkup(
    <ShareSelectionPreviewCard
      {...shareSelectionPreviewCardBaseProps}
      {...overrides}
    />,
  );
}

export function renderShareSelectionPreviewCardInsideOuterLink(
  overrides: Partial<ShareSelectionPreviewCardProps> = {},
  href = "/animals/marta?share=20",
) {
  return renderToStaticMarkup(
    <a href={href}>
      <ShareSelectionPreviewCard
        {...shareSelectionPreviewCardBaseProps}
        ctaHref={href}
        ctaAsButton
        {...overrides}
      />
    </a>,
  );
}
