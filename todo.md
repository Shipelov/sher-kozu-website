# Project TODO

## Sprint 1 — Core Flow Foundation

- [x] Добавить enum-статусы животных, ownership и семьи в `drizzle/schema.ts`
- [x] Добавить таблицу `animals` в `drizzle/schema.ts`
- [x] Добавить таблицу `animal_media` в `drizzle/schema.ts`
- [x] Добавить таблицы `plans` и `plan_durations` в `drizzle/schema.ts`
- [x] Добавить таблицу `families` в `drizzle/schema.ts`
- [x] Добавить таблицу `animal_ownerships` в `drizzle/schema.ts`
- [x] Добавить foundation-таблицы `wallets` и `wallet_transactions` в `drizzle/schema.ts`
- [x] Применить схему через `pnpm db:push`
- [x] Добавить `listPublicAnimals()` в `server/db.ts`
- [x] Добавить `getAnimalBySlug()` в `server/db.ts`
- [x] Добавить `countActiveOwnerships()` в `server/db.ts`
- [x] Добавить `getAvailableSlotIndex()` в `server/db.ts`
- [x] Добавить `recalculateAnimalStatus()` в `server/db.ts`
- [x] Добавить helper для создания и обновления животных в `server/db.ts`
- [x] Добавить `animals.listPublic` в server router
- [x] Добавить `animals.getBySlug` в server router
- [x] Добавить `plans.listActive` или `plans.listForAnimal` в server router
- [x] Добавить `adminAnimals.list` в server router
- [x] Добавить `adminAnimals.create` в server router
- [x] Добавить `adminAnimals.update` в server router
- [x] Добавить `adminAnimals.setVisibility` в server router
- [x] Проверить защиту admin access через `adminProcedure`
- [x] Создать страницу `client/src/pages/AnimalsCatalog.tsx`
- [x] Создать страницу `client/src/pages/AnimalDetails.tsx`
- [x] Зарегистрировать маршруты `/animals` и `/animals/:slug` в `client/src/App.tsx`
- [ ] Добавить CTA с `Home.tsx` на каталог животных
- [x] Показать в каталоге и карточке животного свободные слоты, species, показатели и стартовую цену
- [x] Добавить Vitest на расчёт доступных слотов
- [x] Добавить Vitest на `recalculateAnimalStatus()`
- [x] Добавить Vitest на admin access для CRUD животных
- [x] Добавить Vitest на `animals.getBySlug`
- [x] Запустить `pnpm test` и убедиться, что все тесты проходят
- [x] Проверить статус проекта после изменений
- [ ] Сохранить checkpoint после завершения Sprint 1
- [x] Исправить текущую JSX-ошибку в `client/src/pages/Home.tsx` перед стартом Sprint 1
- [x] Подтвердить устранение JSX-ошибки `Home.tsx` по актуальным логам dev server и сборке TypeScript
