# Home Narrative Lock — Progress

Текущий аудит завершён. На странице `Home.tsx` consumer spine уже читается как `hero → animal-gallery → how it works → value layer`, но его конкурирующие блоки всё ещё смещают внимание в сторону dashboard, partner pilot, ecosystem routing и Sprint 2/AI messaging.

| Зона | Текущее состояние | Решение следующего шага |
|---|---|---|
| Hero | Главный CTA ведёт в dashboard, а narrative описывает экосистему шире, чем первый пользовательский шаг | Переписать copy и CTA под путь `понять идею → открыть галерею → открыть профиль животного` |
| Animal gallery | Блок уже встроен в первый экран и хорошо работает как bridge | Сохранить как главную consumer-to-choice точку входа |
| How it works | Логика близка к core flow, но ещё не достаточно привязана к следующему действию | Сузить формулировки к выбору животного, наблюдению и выбору доли |
| Partner / ecosystem / AI blocks | Нужны продукту, но мешают первичному funnel на первом проходе | Понизить приоритет и оставить как secondary layers ниже conversion spine |

Следующий практический шаг: внести первую реальную правку в `client/src/pages/Home.tsx`, начиная с hero hierarchy и CTA order, затем обновить smoke-тест в `server/pageVisuals.test.ts` и прогнать `pnpm test`.
