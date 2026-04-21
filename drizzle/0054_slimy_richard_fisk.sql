ALTER TABLE `milkReceptions` ADD `milkType` enum('goat','sheep','cow') NOT NULL;--> statement-breakpoint
ALTER TABLE `milkSessions` ADD `goatVolumeMl` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `milkSessions` ADD `sheepVolumeMl` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `milkSessions` ADD `cowVolumeMl` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `milkTanks` ADD `milkType` enum('goat','sheep','cow') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_milkTanks_milkType` ON `milkTanks` (`milkType`);--> statement-breakpoint
ALTER TABLE `milkSessions` DROP COLUMN `totalVolumeMl`;