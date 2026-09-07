-- Заполняет исторический пропуск idx 21: миграция 0017 закомментирована («колонка уже есть в БД»),
-- а для drizzle/meta/0021_snapshot.json (удаление plainPassword) SQL никогда не существовало.
-- На базах с ledger 0022+ drizzle пропускает эту миграцию по timestamp.
ALTER TABLE `users` ADD `primaryAnimalId` int;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `plainPassword`;
