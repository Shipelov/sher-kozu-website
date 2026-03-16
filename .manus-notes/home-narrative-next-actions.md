# Home Narrative Lock — Next Actions

Текущий аудит Home завершён: hero, animal-gallery, how-it-works и value layer уже локализованы как основной consumer funnel. Следующий этап реализации должен убрать конкурирующие направления и усилить единый маршрут пользователя к выбору животного.

| Приоритет | Действие | Основные файлы |
|---|---|---|
| 1 | Переписать hero copy и CTA под путь `понять идею → открыть галерею → открыть профиль животного` | `client/src/pages/Home.tsx` |
| 2 | Понизить значимость dashboard и partner CTA в первом экране, оставив их вторичными | `client/src/pages/Home.tsx` |
| 3 | Упростить блок `Как это работает`, чтобы он напрямую вёл к галерее, а не в абстрактную экосистему | `client/src/pages/Home.tsx` |
| 4 | Подготовить regression-smoke тесты на новый consumer-first narrative | `server/pageVisuals.test.ts` |

Следующий практический шаг: внести первые правки в `Home.tsx`, затем обновить smoke-тесты и прогнать `pnpm test`.
