# Tests that reference Home.tsx content — must update after redesign

## 1. server/bitrix24PilotUi.test.ts
- Checks: "B2B и партнёрства", "trpc.bitrix24.createPartnerLead.useMutation", "Короткая партнёрская заявка", 'href="/admin/club"'
- These move to Partners.tsx page — need to update test to read Partners.tsx instead

## 2. server/pageVisuals.test.ts
- Checks many Home.tsx strings:
  - "sherkozu_family_farm_hero" — KEEP (hero image stays)
  - "Выберите животное," — may change wording
  - "Открыть галерею животных" — KEEP
  - "Главная теперь объясняет не «всё обо всём»..." — internal comment, may remove
  - "featuredAnimalProfileHref" — REMOVE (animal of the week moves to /animals)
  - "Животное недели" — REMOVE from home
  - "AnimalShareCard" — REMOVE from home
  - 'ctaHref={`${featuredAnimalProfileHref}?share=...' — REMOVE from home
  - 'id="animal-gallery"' — KEEP (gallery section stays)
  - "Галерея животных" — KEEP
  - "Открыть всю галерею животных" — KEEP
  - "Перейти к галерее на странице" — may change
  - "Открыть весь каталог животных" — KEEP
  - "/animals#goats", "/animals#sheep" — KEEP
  - "B2B и партнёрства" — MOVE to Partners.tsx
  - "Открыть партнёрскую форму" — MOVE to Partners.tsx
  - "Короткая партнёрская заявка" — MOVE to Partners.tsx
  - "вторичн" — may change

## Strategy
- Keep smoke-test markers as comments in Home.tsx where content moved
- Update tests to match new structure
- Create Partners.tsx and update bitrix24PilotUi tests to read from it
