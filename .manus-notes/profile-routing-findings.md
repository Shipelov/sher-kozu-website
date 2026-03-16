# Profile Routing Findings

## ProductTracker.tsx

- `trpc.productTracker.getByAnimal.useQuery({ animalSlug: "marta" })` жёстко привязан к Марте.
- Hero fallback headline содержит текст: "Трекер показывает, как Марта превращается в семейный продуктовый маршрут."
- Секция состава использует fallback "Состав молока от Марты".
- CTA блок "Связанные маршруты" содержит `Link href="/animal/marta"` и текст "К профилю Марты".
- Финальный CTA блок также содержит `Link href="/animal/marta"` и текст "К профилю Марты".

## ClubFeed.tsx

- `ritualTitle` fallback: "День рождения Марты уже в календаре семьи."
- Изображение ритуала использует alt="Марта".
- CTA блок "Маршруты сообщества" содержит `Link href="/animal/marta"` и текст "К профилю Марты".
- Блок уведомлений клуба также содержит `Link href="/animal/marta"` и текст "К профилю Марты".

## Dashboard.tsx

- Множественные тексты и diaryEntries жёстко называют Марту.
- Hero stats содержит label `"Марта"`.
- Карточка продукта содержит заголовок про историю Марты.
- Секция сводки дня: "Марта, продукт и маршрут семьи синхронизированы."
- LiveCam img alt: "Портрет Марты".
- Две CTA ссылки ведут на `/animal/marta`.
- Дневник и уведомления содержат текстовые зависимости от Марты.

## App.tsx / маршруты

- Сейчас `/animal/:id` ведёт на `AnimalProfile`.
- `/animals/:slug` всё ещё ведёт на упрощённый `AnimalDetails`.
- Для полной унификации нужно перевести `/animals/:slug` на тот же универсальный профиль или обёртку вокруг него.

## AnimalDetails.tsx

- Страница остаётся упрощённой и дублирует часть профиля без upload/remove/reorder/share/lightbox/CTA-логики.
- Наиболее безопасное направление: заменить `AnimalDetails` на thin wrapper или редирект к универсальному `AnimalProfile` по slug.
