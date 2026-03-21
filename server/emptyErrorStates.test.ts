import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const clientDir = resolve(__dirname, "..", "client", "src");

function readPage(name: string) {
  return readFileSync(resolve(clientDir, "pages", name), "utf-8");
}

// ─────────────────────────────────────────────────
// Dashboard — Empty States
// ─────────────────────────────────────────────────
describe("Dashboard empty/error states", () => {
  const src = readPage("Dashboard.tsx");

  it("has DashboardError component for error state", () => {
    expect(src).toContain("DashboardError");
  });

  it("DashboardError includes retry button", () => {
    expect(src).toContain("Попробовать снова");
  });

  it("has DashboardSkeleton for loading state", () => {
    expect(src).toContain("DashboardSkeleton");
  });

  it("has guest journey section for unauthenticated users", () => {
    expect(src).toContain("isGuestJourney");
  });

  it("has empty state for nextSteps when all steps completed", () => {
    expect(src).toContain('data-testid="dashboardEmptyNextSteps"');
  });

  it("empty nextSteps shows encouraging message", () => {
    expect(src).toContain("Все шаги выполнены");
  });

  it("empty nextSteps has CTA to gallery", () => {
    expect(src).toContain("Открыть галерею");
  });

  it("empty nextSteps only shows for non-guest users", () => {
    // The condition checks !isGuestJourney && nextSteps.length === 0
    const emptyNextStepsBlock = src.substring(
      src.indexOf('data-testid="dashboardEmptyNextSteps"') - 200,
      src.indexOf('data-testid="dashboardEmptyNextSteps"')
    );
    expect(emptyNextStepsBlock).toContain("!isGuestJourney");
    expect(emptyNextStepsBlock).toContain("nextSteps.length === 0");
  });

  it("has empty state for quickLinks", () => {
    expect(src).toContain('data-testid="dashboardEmptyQuickLinks"');
  });

  it("empty quickLinks shows helpful message", () => {
    expect(src).toContain("Быстрые переходы появятся здесь");
  });
});

// ─────────────────────────────────────────────────
// ProductTracker — Empty & Error States
// ─────────────────────────────────────────────────
describe("ProductTracker empty/error states", () => {
  const src = readPage("ProductTracker.tsx");

  it("has loading state with spinner", () => {
    expect(src).toContain("trackerQuery.isLoading");
    expect(src).toContain("animate-spin");
  });

  it("has error state block", () => {
    expect(src).toContain('data-testid="trackerError"');
  });

  it("error state shows descriptive message", () => {
    expect(src).toContain("Не удалось загрузить продуктовый маршрут");
  });

  it("error state has retry button calling refetch", () => {
    expect(src).toContain("trackerQuery.refetch()");
    expect(src).toContain("Попробовать снова");
  });

  it("error state uses destructive styling", () => {
    const errorBlock = src.substring(
      src.indexOf('data-testid="trackerError"') - 100,
      src.indexOf('data-testid="trackerError"') + 200
    );
    expect(errorBlock).toContain("border-destructive");
    expect(errorBlock).toContain("bg-destructive");
  });

  it("has global empty state when no summary data", () => {
    expect(src).toContain('data-testid="trackerEmpty"');
  });

  it("global empty state shows helpful message", () => {
    expect(src).toContain("Продуктовый маршрут ещё не сформирован");
  });

  it("global empty state has CTA to choose animal", () => {
    expect(src).toContain("Выбрать животное");
  });

  it("global empty state has link to dashboard", () => {
    const emptyIdx = src.indexOf('data-testid="trackerEmpty"');
    const emptyBlock = src.substring(emptyIdx, emptyIdx + 1600);
    expect(emptyBlock).toContain('href="/dashboard"');
    expect(emptyBlock).toContain("В кабинет");
  });

  it("global empty state condition checks loading, error, and summary", () => {
    expect(src).toContain("!trackerQuery.isLoading && !trackerQuery.isError && !summary");
  });

  it("has empty state for composition data", () => {
    expect(src).toContain('data-testid="trackerEmptyComposition"');
  });

  it("empty composition shows message about first analysis", () => {
    expect(src).toContain("Данные о составе партии появятся после первого анализа молока");
  });

  it("has empty state for deliveries list", () => {
    expect(src).toContain('data-testid="trackerEmptyDeliveries"');
  });

  it("empty deliveries shows message about first shipment", () => {
    expect(src).toContain("История доставок появится здесь после первой отправки");
  });
});

// ─────────────────────────────────────────────────
// ClubFeed — Empty & Error States
// ─────────────────────────────────────────────────
describe("ClubFeed empty/error states", () => {
  const src = readPage("ClubFeed.tsx");

  it("has loading state with spinner", () => {
    expect(src).toContain('data-testid="clubLoading"');
    expect(src).toContain("animate-spin");
  });

  it("loading state shows descriptive text", () => {
    expect(src).toContain("Загружаем живую клубную ленту фермы");
  });

  it("has error state block", () => {
    expect(src).toContain('data-testid="clubError"');
  });

  it("error state shows descriptive message", () => {
    expect(src).toContain("Не удалось загрузить клубную ленту");
  });

  it("error state has retry button calling refetch", () => {
    expect(src).toContain("clubQuery.refetch()");
    expect(src).toContain("Попробовать снова");
  });

  it("error state uses destructive styling", () => {
    const errorBlock = src.substring(
      src.indexOf('data-testid="clubError"') - 100,
      src.indexOf('data-testid="clubError"') + 200
    );
    expect(errorBlock).toContain("border-destructive");
    expect(errorBlock).toContain("bg-destructive");
  });

  it("has empty posts state", () => {
    expect(src).toContain('data-testid="clubEmptyPosts"');
  });

  it("empty posts state is filter-aware", () => {
    const emptyIdx = src.indexOf('data-testid="clubEmptyPosts"');
    const emptyBlock = src.substring(emptyIdx, emptyIdx + 800);
    expect(emptyBlock).toContain('activeFilter !== "all"');
  });

  it("empty posts with active filter suggests showing all", () => {
    expect(src).toContain("Показать все");
    expect(src).toContain('setActiveFilter("all")');
  });

  it("empty posts without filter shows general message", () => {
    expect(src).toContain("После первого события или дневниковой записи");
  });

  it("empty posts condition excludes loading and error states", () => {
    expect(src).toContain("!clubQuery.isLoading && !clubQuery.isError && !visiblePosts.length");
  });

  it("has empty state for events calendar", () => {
    expect(src).toContain("Ближайшие события появятся здесь");
  });

  it("has empty state for members list", () => {
    expect(src).toContain("Состав клуба появится здесь");
  });

  it("events empty state uses dashed border", () => {
    // Find the events empty state
    const eventsEmptyIdx = src.indexOf("Ближайшие события появятся здесь");
    const eventsBlock = src.substring(eventsEmptyIdx - 200, eventsEmptyIdx);
    expect(eventsBlock).toContain("border-dashed");
  });

  it("members empty state uses dashed border", () => {
    const membersEmptyIdx = src.indexOf("Состав клуба появится здесь");
    const membersBlock = src.substring(membersEmptyIdx - 200, membersEmptyIdx);
    expect(membersBlock).toContain("border-dashed");
  });
});

// ─────────────────────────────────────────────────
// Cross-page consistency checks
// ─────────────────────────────────────────────────
describe("Cross-page empty/error state consistency", () => {
  const dashboard = readPage("Dashboard.tsx");
  const tracker = readPage("ProductTracker.tsx");
  const club = readPage("ClubFeed.tsx");

  it("all pages with error states use destructive color scheme", () => {
    // Dashboard uses DashboardError component
    expect(dashboard).toContain("DashboardError");
    // Tracker and Club use inline destructive styling
    expect(tracker).toContain("border-destructive");
    expect(club).toContain("border-destructive");
  });

  it("all error states provide retry mechanism", () => {
    expect(dashboard).toContain("Попробовать снова");
    expect(tracker).toContain("Попробовать снова");
    expect(club).toContain("Попробовать снова");
  });

  it("all pages handle loading state", () => {
    expect(dashboard).toContain("DashboardSkeleton");
    expect(tracker).toContain("isLoading");
    expect(club).toContain("isLoading");
  });

  it("empty states use consistent border-dashed styling for inline empties", () => {
    expect(tracker).toContain("border-dashed");
    expect(club).toContain("border-dashed");
    expect(dashboard).toContain("border-dashed");
  });

  it("all pages use data-testid for key empty/error blocks", () => {
    expect(dashboard).toContain("data-testid=");
    expect(tracker).toContain("data-testid=");
    expect(club).toContain("data-testid=");
  });
});
