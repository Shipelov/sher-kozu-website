# Рабочие заметки: постоянное хранение фото

Текущее состояние:

- В `AnimalProfile.tsx` галерея хранится только в локальном состоянии `galleryImages` и использует `URL.createObjectURL`, поэтому фото исчезают после перезагрузки.
- Удаление пользовательских фото определяется через `image.src.startsWith("blob:")`, значит после перехода на постоянное хранение нужен явный признак пользовательского файла.
- После подключения backend-шаблона проект получил `server/storage.ts`, `server/db.ts`, `server/routers.ts`, `drizzle/schema.ts` и tRPC-инфраструктуру.
- В `Home.tsx` уже исправлен конфликт от автодобавленного auth-кода.

План реализации:

1. Добавить таблицу `animalPhotos` в `drizzle/schema.ts`.
2. Добавить helper-методы в `server/db.ts` для списка, создания и удаления фото.
3. Добавить tRPC router для фото в `server/routers.ts` с protected мутациями загрузки/удаления и public/protected чтением.
4. Использовать `server/storage.ts` для загрузки бинарных данных в S3.
5. Обновить `AnimalProfile.tsx`: читать persistent-фото с backend, кодировать файл в base64 на клиенте, загружать через mutation, показывать состояния загрузки/ошибок, разрешать удаление только пользовательских фото по флагу.
6. После реализации: `pnpm db:push`, vitest, build, статус и финальный user-journey QA по маршрутам Home → Dashboard → AnimalProfile → Tracker → Club.
