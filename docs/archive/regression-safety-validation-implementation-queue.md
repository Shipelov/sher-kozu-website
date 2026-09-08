# Implementation Queue — Sprint 1 Execution Step 5: Regression Safety and Validation

## Назначение

Этот документ переводит **Execution Step 5 — Regression Safety and Validation** в конкретную очередь реализации. Его задача — закрепить весь vertical slice Sprint 1 как устойчивый рабочий путь: `Home → Gallery → Animal Profile → Share selection`. Без этого шага Sprint 1 останется набором локально улучшенных экранов, которые можно случайно сломать следующей же итерацией [1] [2] [3].

Execution Step 5 всегда идёт последним. Это принципиально важно: regression safety должна защищать уже собранную продуктовую связку, а не подменять собой её разработку. После того как Home narrative стабилизирован, карточки животных унифицированы, профиль животного превращён в decision page, а share UX получил нормализованный shape, нужно превратить эти договорённости в проверяемую систему [1] [2].

## Целевой результат шага

После завершения этого шага команда должна иметь не просто уверенность «мы вроде всё поправили», а воспроизводимый набор проверок, который удерживает Sprint 1 в рабочем состоянии. Важна не только техническая корректность, но и сохранение продуктового смысла funnel-пути [1] [3].

| Что должно быть защищено | Как выглядит успех |
|---|---|
| **Home narrative** | Ключевые narrative anchors, CTA и gallery section стабильно присутствуют |
| **Unified Animal Cards** | Карточки на Home и `/animals` сохраняют единый contract, ключевые метрики и CTA |
| **Animal Profile** | Decision markers профиля не пропадают и не дрейфуют |
| **Share Selection** | Блок выбора доли не показывает `NaN`, `undefined.length` и пустые ключевые значения |
| **Сборка и маршрутный проход** | `pnpm test`, `pnpm build` и ручной preview pass дают предсказуемый результат |

## Validation Philosophy

Regression protection в Sprint 1 должна быть двухслойной. С одной стороны, нужны **helper/unit tests** для нормализации shape, derived state и защит от хрупких вычислений. С другой стороны, нужны **smoke/visual regression checks**, которые удерживают сам продуктовый маршрут и ключевые UI-маркеры. Только комбинация этих слоёв реально защищает conversion spine [1] [2] [3].

| Слой проверки | Что защищает | Где применим |
|---|---|---|
| **Vitest helper/unit tests** | Нормализаторы, derived labels, безопасные fallback-значения | card contract, share adapter, status helpers |
| **Smoke/page-level tests** | Наличие ключевых блоков, CTA, narrative markers, decision markers | Home, `/animals`, animal profile |
| **Manual preview pass** | Реальный пользовательский путь и визуальная согласованность | весь vertical slice |
| **Build/test commands** | Техническую пригодность проекта | весь репозиторий |

## Implementation Queue

### Queue Item 1 — Составить canonical regression matrix для всего vertical slice

Сначала нужно зафиксировать, что именно в Sprint 1 считается защищаемым поведением. Без этой матрицы тесты быстро превращаются в случайный набор проверок, а не в систему защиты funnel-пути.

| Что сделать | Как выполнить | Результат |
|---|---|---|
| Определить ключевые маршруты | `Home`, `/animals`, profile page, share selection state | Карта критического пути |
| Определить ключевые маркеры | gallery anchor, card metrics, profile decision block, share labels | Список обязательных UI markers |
| Определить data-risk зоны | неполные share-поля, пустые проценты, статусы, цена | Список helper-level рисков |

### Queue Item 2 — Закрепить helper-level contract tests

После определения regression matrix нужно усилить helper-уровень. Именно здесь чаще всего рождаются будущие поломки: `NaN`, `undefined.length`, дрейф price-formatting, конфликт label-логики. Эти вещи легче и дешевле удерживать unit-проверками, чем ловить только в браузере [1] [3].

| Что проверить | Тип теста |
|---|---|
| Нормализация карточки животного | Vitest helper test |
| Derived relationship status | Vitest helper test |
| Нормализация share shape | Vitest helper test |
| Вычисление цены выбранной доли | Vitest helper test |
| Safe defaults для пустых полей | Vitest helper test |

**Вероятные файлы:** существующие helper test files, `server/adminAnimalsUiHelpers.test.ts`, новые test-файлы рядом с helper-слоем.

### Queue Item 3 — Обновить smoke coverage для Home и animal cards

Следующий слой — page-level smoke tests, которые удерживают продуктовый язык и entry points. Для Home важно не только то, что страница рендерится, но и то, что на ней сохраняются narrative anchors, gallery, CTA и карточечный мост в каталог животных [1] [2].

| Что сделать | Что должно быть в проверке |
|---|---|
| Проверить Home narrative markers | hero message, primary CTA, `animal-gallery`, intro copy |
| Проверить Home gallery | наличие галереи и входа в профиль животного |
| Проверить `/animals` cards | наличие unified metrics, CTA и статусов |
| Проверить card-to-profile bridge | присутствие ссылок/роутинга к профилю |

**Вероятные файлы:** `server/pageVisuals.test.ts` или эквивалентные smoke-файлы.

### Queue Item 4 — Добавить profile decision markers coverage

Профиль животного — центральная decision page Sprint 1. Поэтому важно тестировать не только то, что страница открывается, но и то, что на ней остаются decision markers: identity, статус, доступность, цена и primary CTA. Иначе профиль снова может расползтись в storytelling-only страницу [1] [2].

| Что сделать | Тип проверки |
|---|---|
| Проверить наличие headline/identity block | Smoke/page-level test |
| Проверить статус и availability markers | Smoke/page-level test |
| Проверить economics/price markers | Smoke/page-level test |
| Проверить primary CTA | Smoke/page-level test |

### Queue Item 5 — Добавить share selection runtime safety checks

Это критический слой защиты. Нужно убедиться, что share block не падает при неполных данных, не выводит `NaN` и не показывает пустые или противоречивые проценты. Эта часть уже была точкой реальных регрессий, поэтому её стоит считать high-risk area [1] [3].

| Что сделать | Тип проверки |
|---|---|
| Проверить отсутствие `undefined.length` | Vitest/helper + smoke render |
| Проверить отсутствие `NaN` в процентах и цене | Vitest/helper test |
| Проверить корректный fallback при пустых `availableSharePercents` | Vitest/helper test |
| Проверить корректный selected-state path | Preview/manual + smoke if applicable |

### Queue Item 6 — Оформить обязательный manual validation pass как часть done criteria

Даже хороший тестовый набор не заменяет ручной проход vertical slice. Sprint 1 связан не только с корректностью вычислений, но и с тем, как пользователь воспринимает narrative и decision architecture. Поэтому manual preview pass должен быть формализован как часть done, а не оставаться опциональной привычкой [2] [3].

| Ручной маршрут | Что проверить |
|---|---|
| `Home` | narrative clarity, CTA hierarchy, gallery visibility |
| `/animals` | карточки, единый язык статусов и метрик |
| профиль животного | decision block above the fold |
| share selection | понятность выбора доли, цена, next step |

### Queue Item 7 — Собрать финальный validation ritual Sprint 1

Последний шаг — не только добавить разрозненные тесты, но и оформить **единый validation ritual** для конца Sprint 1 и для последующих регрессионных проверок. Это должен быть повторяемый, короткий, но строгий процесс, который можно запускать после значимых изменений funnel-пути [1] [2] [3].

| Этап ritual | Инструмент |
|---|---|
| Helper-level safety | `pnpm test` |
| Build stability | `pnpm build` |
| Project health | `webdev_check_status` |
| Manual preview pass | Home → `/animals` → profile → share selection |
| Checkpoint after pass | `webdev_save_checkpoint` |

## File-Level Implementation Order

| Очередь | Файл / слой | Первое действие |
|---|---|---|
| **1** | `sprint-1-execution-plan.md` / docs | Зафиксировать regression matrix |
| **2** | helper test files | Добавить/обновить unit coverage для contracts и нормализаторов |
| **3** | `server/pageVisuals.test.ts` | Расширить smoke coverage для Home и `/animals` |
| **4** | профильные smoke/tests | Зафиксировать decision markers профиля |
| **5** | share-related tests | Добавить runtime safety coverage для долей |
| **6** | validation docs / checklist | Описать обязательный manual pass и финальный ritual |

## Suggested Definition of Done for Step 5

| Done condition | Что значит на практике |
|---|---|
| Home narrative защищён | Есть smoke markers на hero, CTA и gallery |
| Unified cards защищены | Есть coverage на card metrics, status и CTA |
| Profile decision surface защищён | Есть smoke markers на availability, economics и CTA |
| Share block защищён | Нет `NaN`, `undefined.length`, пустых критичных значений |
| Полный набор проходит | `pnpm test` и `pnpm build` успешны |
| Preview pass подтверждён | Ручной маршрут не показывает регрессий |
| Есть новый checkpoint | Состояние Sprint 1 можно зафиксировать и восстановить |

## Validation Queue

| Проверка | Инструмент |
|---|---|
| Helper contracts | Vitest |
| Home and cards smoke | page visuals / smoke tests |
| Profile decision markers | smoke tests |
| Share runtime safety | helper tests + preview |
| Overall build/test | `pnpm test`, `pnpm build` |
| Environment health | `webdev_check_status` |

## Immediate Next Action

Следующее практическое действие после этой очереди — **составить canonical regression matrix для всех критических точек Sprint 1** и на её основе распределить проверки между helper tests, smoke tests и manual preview pass. Без этого regression coverage снова станет фрагментарной и будет плохо защищать именно тот путь, который Sprint 1 собирает [1] [3].

## References

[1]: file:///home/ubuntu/sher-kozu-website/sprint-1-execution-plan.md "Sprint 1 Execution Plan — Phase A: Conversion Spine"
[2]: file:///home/ubuntu/sher-kozu-website/sprint-1-phase-a-conversion-spine.md "Sprint 1 — Phase A: Conversion Spine"
[3]: file:///home/ubuntu/sher-kozu-website/product-operating-system.md "Product Operating System — Sher Kozu"
