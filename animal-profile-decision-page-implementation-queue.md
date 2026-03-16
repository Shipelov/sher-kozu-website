# Implementation Queue — Sprint 1 Execution Step 3: Animal Profile as Decision Page

## Назначение

Этот документ переводит **Execution Step 3 — Animal Profile as Decision Page** в конкретную очередь реализации. Его задача — превратить страницу профиля животного из просто красивого storytelling-экрана в **страницу продуктового решения**, на которой пользователь быстро понимает, кого он выбирает, что ещё доступно, сколько это стоит и какой следующий шаг его ждёт [1] [2] [3].

Execution Step 3 расположен после Home Narrative Lock и Unified Animal Cards не случайно. После того как главная страница стала входом в сценарий, а карточки животных — его повторяемой единицей, профиль животного должен принять на себя главную функцию Sprint 1: **закрыть неопределённость перед выбором доли** [1] [2].

## Целевой результат шага

После завершения этого шага профиль животного должен восприниматься как **decision page**, а не как просто витрина контента. Above-the-fold зона должна отвечать на четыре вопроса: кто это, почему именно это животное ценно, сколько сейчас доступно для участия и как пользователь может двигаться дальше [1] [2].

| Что должно измениться | Как выглядит успех |
|---|---|
| **Above-the-fold блок** | В первых экранах видны identity, статус, цена, доступность долей и главный CTA |
| **Контентная иерархия** | История, характер и доверие поддерживают решение, а не уводят от него |
| **CTA-путь** | Все ключевые CTA на странице ведут к выбору доли или к следующему понятному шагу |
| **Share context** | Блок доли встроен в логику профиля и не выглядит изолированным техническим модулем |
| **Неполные данные** | Профиль не показывает пустые или конфликтующие значения доступности |

## Decision Architecture for Animal Profile

В рамках Sprint 1 профиль животного должен строиться не по принципу «сначала весь storytelling, потом где-то внизу данные», а по принципу **решение сначала, углубление потом** [1] [2].

| Layer | Назначение | Приоритет |
|---|---|---|
| **1. Identity + relationship state** | Имя, вид, порода/характер, статус участия | Максимальный |
| **2. Availability + economics** | Сколько доступно, минимальный шаг, стоимость участия | Максимальный |
| **3. Primary action** | Ясный CTA к выбору доли | Максимальный |
| **4. Trust + story support** | История животного, происхождение, особенности, визуальные материалы | Средний |
| **5. Extended ecosystem context** | Клуб, трекер, расширенный ownership layer | Низкий в рамках decision page |

> Главный принцип шага: если пользователь после первого экрана профиля всё ещё не понимает, доступно ли участие и сколько оно стоит, значит профиль не выполняет свою продуктовую функцию [1] [2].

## Implementation Queue

### Queue Item 1 — Зафиксировать текущую структуру профиля и её проблемные зоны

Сначала нужно определить, какой именно файл является canonical profile page и как сейчас распределены блоки внутри профиля. В проекте для этого шага следует проверить как минимум `AnimalProfile.tsx` и `AnimalDetails.tsx`, чтобы понять, где находится основной decision surface и нет ли дублирования responsibility.

| Что сделать | Как выполнить | Файлы |
|---|---|---|
| Найти canonical profile route | Проверить, какая страница реально открывается при переходе из карточки `/animals/${slug}` | `client/src/pages/AnimalProfile.tsx`, `client/src/pages/AnimalDetails.tsx`, возможно `client/src/App.tsx` |
| Зафиксировать текущий порядок блоков | Выписать real render order: hero/profile intro/story/share sections/CTA | профильные файлы |
| Отметить decision gaps | Найти места, где цена, доступность и следующий шаг скрыты слишком глубоко или конфликтуют между собой | профильные файлы |

### Queue Item 2 — Пересобрать above-the-fold decision block

Первый экран профиля должен быть самым сильным decision surface во всём Sprint 1. Именно здесь пользователь окончательно понимает, подходит ли ему это животное и имеет ли смысл идти в выбор доли. Если эти элементы разбросаны по странице, нужно собрать их в один coherent block.

| Что должно быть в above-the-fold | Почему |
|---|---|
| Имя животного и species/breed descriptor | Даёт identity сразу |
| Relationship status | Показывает текущую доступность |
| Ключевые share metrics | Делает экономику прозрачной |
| Primary CTA | Даёт следующий шаг без поиска по странице |
| Hero-image / visual trust | Поддерживает эмоциональное решение |

| Что сделать | Решение |
|---|---|
| Проверить текущий headline и subheadline профиля | Они должны вести к решению, а не только к описанию животного |
| Поднять статус и экономику вверх страницы | Пользователь должен видеть их в первом экране |
| Сделать CTA видимым и однозначным | CTA должен вести к выбору доли, а не к расплывчатому исследованию |

### Queue Item 3 — Привести storytelling в supporting role

Storytelling остаётся важной частью Sher Kozu, но на decision page он не должен опережать действие. Правильная задача этого слоя — усиливать уверенность пользователя после того, как он понял availability и economics. Поэтому все narrative-блоки, история, характер, происхождение и доверительные детали должны поддерживать решение, а не задерживать его.

| Что сделать | Критерий |
|---|---|
| Определить, какие story-блоки критически важны | Оставить только те, что помогают принять решение |
| Сдвинуть длинные narrative-секции ниже primary decision surface | Story идёт после identity/status/economics |
| Проверить текстовые дубли | История не должна повторять то, что уже сказано в hero профиля |

### Queue Item 4 — Согласовать share block с decision architecture

Шаг 3 ещё не является полной нормализацией share UX — это задача Step 4. Но уже здесь профиль должен показывать блок доли как естественную часть решения. Пользователь не должен ощущать скачок между «эмоциональным профилем животного» и внезапным «техническим модулем шеринга».

| Что сделать | Что должно получиться |
|---|---|
| Проверить место share block на странице | Он должен находиться вблизи decision surface |
| Проверить терминологию share block | Она должна совпадать с карточками и общим funnel-языком |
| Проверить состояния доступности | Нет пустых процентов, конфликтов и непонятных fallback-значений |

### Queue Item 5 — Привести все CTA страницы к единому смыслу

Профиль часто собирает множество CTA: посмотреть историю, узнать больше, выбрать долю, перейти в клуб, связаться и т. д. Для Sprint 1 это опасно. В рамках decision page должен существовать один основной outcome, а все остальные действия — поддерживать его.

| Что сделать | Решение |
|---|---|
| Найти все CTA на странице профиля | Выделить primary, secondary и distracting actions |
| Зафиксировать один primary CTA | Он должен вести к выбору доли или к следующему шагу участия |
| Ослабить вторичные CTA | Клуб, tracker, дополнительные маршруты должны быть ниже по приоритету |

### Queue Item 6 — Зафиксировать canonical profile data requirements

Чтобы profile page не ломалась на неполных данных и не плодила ad hoc-вычисления в JSX, нужно определить минимальный набор данных, который профиль считает обязательным для decision rendering. Это сократит хаос перед Step 4, где уже будет нормализоваться share model.

| Поле | Роль в decision page |
|---|---|
| `name`, `species`, `breed` | Identity |
| `coverImageUrl` | Trust/visual confidence |
| `shortDescription` / `profileSummary` | Quick value framing |
| `relationship status` | Availability interpretation |
| `availableSharePercents` или аналог | Decision-ready selection context |
| `occupiedSharePercent` / `availablePercent` | Share transparency |
| `pricePerShareStep` / `shareUnitPriceMinor` | Economics |
| `primaryCtaLabel` | Next action clarity |

### Queue Item 7 — Закрепить regression protection для profile decision surface

После перестройки профиля важно зафиксировать не только отсутствие runtime-ошибок, но и само наличие decision markers. Нужно добавить smoke/vitest-защиту на ключевые элементы профиля: заголовок, status block, share metrics, CTA и safe rendering при неполных данных [1] [3].

| Что сделать | Тип проверки |
|---|---|
| Проверить decision markers профиля | Smoke/page visual test |
| Проверить safe rendering на неполных share-полях | Vitest/helper test |
| Проверить отсутствие `NaN` и пустых процентов | Vitest + preview review |

## File-Level Implementation Order

| Очередь | Файл | Первое действие |
|---|---|---|
| **1** | `client/src/App.tsx` | Проверить, какой профильный маршрут canonical |
| **2** | `client/src/pages/AnimalProfile.tsx` и/или `client/src/pages/AnimalDetails.tsx` | Зафиксировать текущую структуру профиля |
| **3** | профильный файл | Пересобрать above-the-fold decision block |
| **4** | профильный файл и helper-слой | Согласовать status/economics/share context |
| **5** | профильный файл | Ослабить вторичные CTA и сдвинуть story ниже |
| **6** | тестовые файлы | Добавить smoke и helper coverage |

## Suggested Definition of Done for Step 3

| Done condition | Что значит на практике |
|---|---|
| Пользователь за первый экран понимает, кто это | Identity и visual trust доступны сразу |
| Пользователь видит, можно ли войти в долю | Relationship state и availability показываются выше fold |
| Пользователь понимает стоимость участия | Экономика присутствует в первом decision block |
| Есть один ясный primary CTA | Следующий шаг очевиден |
| Профиль не ломается на неполных данных | Нет `NaN`, пустых процентов и конфликтующих подписей |
| Regression coverage обновлено | Есть smoke и helper protection |

## Validation Queue

| Проверка | Инструмент |
|---|---|
| Проверить canonical profile route | Preview/manual |
| Проверить decision block профиля | Preview/manual + smoke |
| Проверить share context без конфликтов | Preview/manual + vitest |
| Проверить сборку и тесты | `pnpm test`, `pnpm build` |

## Immediate Next Action

Следующее практическое действие после этой очереди — определить **какой профильный файл в проекте является canonical decision page** и только затем собирать новый above-the-fold block. Без этого есть риск улучшить вторичный файл и оставить основной маршрут в старой архитектуре [1] [3].

## References

[1]: file:///home/ubuntu/sher-kozu-website/sprint-1-execution-plan.md "Sprint 1 Execution Plan — Phase A: Conversion Spine"
[2]: file:///home/ubuntu/sher-kozu-website/sprint-1-phase-a-conversion-spine.md "Sprint 1 — Phase A: Conversion Spine"
[3]: file:///home/ubuntu/sher-kozu-website/roadmap.md "Roadmap — Sher Kozu"
