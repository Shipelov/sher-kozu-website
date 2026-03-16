# Home Narrative Audit

## Current section map

| Order | Section / block | Current role | Narrative value | Risk for Conversion Spine |
|---|---|---|---|---|
| 1 | Navbar | Global navigation | Neutral | Low |
| 2 | Hero | Primary brand entry | High | Medium: likely overloaded with ecosystem language |
| 3 | Signals / proof metrics | Trust layer | Medium | Low if kept subordinate |
| 4 | How it works (`steps`) | Bridge into model | High | Low |
| 5 | Values | Emotional + trust proof | Medium | Medium if it competes with CTA |
| 6 | Animal gallery (`animal-gallery`) | Main conversion bridge | Critical | Must remain primary downstream step |
| 7 | Ecosystem routes | Product expansion | Medium | High: can distract from first conversion path |
| 8 | B2B / partner lead form and Bitrix24 pilot blocks | Secondary commercial flow | Low for Sprint 1 | Very high on Home if placed before or inside main consumer path |
| 9 | Admin/CRM explanatory blocks | Internal proof / ops layer | Low | Very high for public conversion page |

## Narrative diagnosis

Главная страница уже содержит сильные ingredients для Sprint 1, но conversion spine размыт тем, что consumer path и partner/CRM path живут в одном документе `Home.tsx`. Для **Execution Step 1 — Home Narrative Lock** приоритетом должен стать не полный редизайн, а жёсткая фиксация смысловой иерархии: **idea → trust → how it works → animal gallery → next step**. Все B2B, CRM и admin-explanation блоки должны либо смещаться ниже как secondary surface, либо явно отделяться от основного пользовательского пути.

## Target narrative map for Step 1

| Layer | Goal | Allowed content | Not allowed to dominate |
|---|---|---|---|
| Entry | Объяснить идею персонального фермерства | Hero headline, short proof, primary CTA to gallery | Ecosystem sprawl, CRM or admin details |
| Trust | Подтвердить, что модель реальна и прозрачна | metrics, provenance, family-farm proof | secondary navigation overload |
| Bridge | Показать, как это работает | 3-step model, concise explanation | deep club or dashboard promises |
| Conversion | Подвести к выбору животного | gallery, featured animal, profile links | unrelated product ecosystem blocks |
| Support | Дать вторичные маршруты после главного пути | values, club atmosphere, selected ecosystem teasers | B2B pilot as equal-weight narrative |
| Secondary business | Обслужить партнёрский сценарий без каннибализации main path | partner lead form and CRM pilot blocks lower on page or later in IA | placement before main conversion spine |

## Immediate implications for implementation

| Priority | Change implication |
|---|---|
| P1 | Переписать hero hierarchy так, чтобы primary CTA всегда вёл к галерее животных или каталогу |
| P1 | Проверить, что `animal-gallery` расположен как главный conversion block после bridge layers |
| P1 | Ослабить visual/semantic weight ecosystem routes compared with gallery |
| P1 | Отделить partner/Bitrix24 pilot section от основной consumer narrative |
| P2 | Сжать или переупорядочить values/support content, чтобы он подтверждал путь, а не создавал второй сюжет |
| P2 | После правок закрепить smoke markers для hero, gallery и primary CTA |
