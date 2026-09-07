-- Baseline для таблиц и колонок, которые были залиты в production через drizzle-kit push,
-- а миграции 0048–0060 заменены на SELECT 1. Состояние соответствует drizzle/meta/0060_snapshot.json
-- (ровно то, что ожидает 0061). На базах, где __drizzle_migrations уже содержит 0061+, drizzle пропускает
-- эту миграцию по timestamp; IF NOT EXISTS — дополнительная страховка.
CREATE TABLE IF NOT EXISTS `farmWorkers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`login` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`farmWorkerRole` enum('milker','cheesemaker','controller','vet','manager') NOT NULL,
	`phone` varchar(32),
	`telegramChatId` varchar(20),
	`mustChangePassword` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farmWorkers_id` PRIMARY KEY(`id`),
	CONSTRAINT `farmWorkers_login_unique` UNIQUE(`login`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`milkAuditAction` enum('session_created','session_updated','session_cancelled','session_confirmed','session_disputed','session_auto_confirmed','reception_accepted','reception_rejected','tank_movement','batch_started','batch_completed','worker_login','worker_password_changed','admin_edit','admin_delete') NOT NULL,
	`workerId` int,
	`adminOpenId` varchar(64),
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`detailsJson` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milkAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkProcessingBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchCode` varchar(32) NOT NULL,
	`productType` enum('milk','smetana','yogurt','kefir','brynza','kachotta','halumi','ricotta','camembert','aged_cheese','blue_cheese','smoked_cheese','butter','condensed_milk','fermented_drink','custom','cheese') NOT NULL,
	`productLabel` varchar(160),
	`sourceTankId` int NOT NULL,
	`inputVolumeMl` int NOT NULL,
	`outputQuantity` int,
	`outputUnit` varchar(8),
	`startedByWorkerId` int NOT NULL,
	`completedByWorkerId` int,
	`milkProcessingStatus` enum('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
	`plannedAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milkProcessingBatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `milkProcessingBatches_batchCode_unique` UNIQUE(`batchCode`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkReceptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`milkType` enum('goat','sheep','cow') NOT NULL,
	`receivedByWorkerId` int NOT NULL,
	`acceptedVolumeMl` int NOT NULL,
	`rejectedVolumeMl` int NOT NULL DEFAULT 0,
	`temperatureTenths` int,
	`densityThousandths` int,
	`fatPercentTenths` int,
	`acidityTurner` int,
	`milkReceptionStatus` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`rejectionReason` text,
	`targetTankId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milkReceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkSessionAnimals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`animalId` int NOT NULL,
	`volumeMl` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milkSessionAnimals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionCode` varchar(20) NOT NULL,
	`workerId` int NOT NULL,
	`milkingDate` varchar(10) NOT NULL,
	`milkSessionShift` enum('morning','evening') NOT NULL,
	`goatVolumeMl` int NOT NULL DEFAULT 0,
	`goatHeadCount` int NOT NULL DEFAULT 0,
	`sheepVolumeMl` int NOT NULL DEFAULT 0,
	`sheepHeadCount` int NOT NULL DEFAULT 0,
	`cowVolumeMl` int NOT NULL DEFAULT 0,
	`cowHeadCount` int NOT NULL DEFAULT 0,
	`goatFeedingMl` int NOT NULL DEFAULT 0,
	`goatLossesMl` int NOT NULL DEFAULT 0,
	`sheepFeedingMl` int NOT NULL DEFAULT 0,
	`sheepLossesMl` int NOT NULL DEFAULT 0,
	`cowFeedingMl` int NOT NULL DEFAULT 0,
	`cowLossesMl` int NOT NULL DEFAULT 0,
	`temperatureTenths` int,
	`densityThousandths` int,
	`note` text,
	`milkSessionStatus` enum('in_progress','pending_confirm','confirmed','disputed') NOT NULL DEFAULT 'in_progress',
	`autoConfirmAt` timestamp,
	`confirmedBy` varchar(64),
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milkSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `milkSessions_sessionCode_unique` UNIQUE(`sessionCode`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkTankMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tankId` int NOT NULL,
	`milkMovementType` enum('milking_in','transfer','processing_out','waste','sample','adjustment') NOT NULL,
	`volumeMl` int NOT NULL,
	`tankVolumeAfterMl` int NOT NULL,
	`sessionId` int,
	`receptionId` int,
	`batchId` int,
	`targetTankId` int,
	`performedByWorkerId` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milkTankMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `milkTanks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`milkType` enum('goat','sheep','cow') NOT NULL,
	`capacityMl` int NOT NULL,
	`currentVolumeMl` int NOT NULL DEFAULT 0,
	`milkTankStatus` enum('empty','filling','full','processing','cleaning') NOT NULL DEFAULT 'empty',
	`location` varchar(120),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milkTanks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `productPlanSetupRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`bitrixTaskId` varchar(32),
	`setupRequestStatus` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`ownerNotified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productPlanSetupRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `animalOwnerships` MODIFY COLUMN `ownershipStatus` enum('pending_payment','active','expired','cancelled','frozen') NOT NULL DEFAULT 'pending_payment';--> statement-breakpoint
ALTER TABLE `animalOwnerships` ADD `bitrixDealId` varchar(64);--> statement-breakpoint
ALTER TABLE `animalOwnerships` ADD `bitrixStageId` varchar(120);--> statement-breakpoint
ALTER TABLE `cmsBlockHistory` ADD `prevMobileImageUrl` text;--> statement-breakpoint
ALTER TABLE `cmsBlockHistory` ADD `newMobileImageUrl` text;--> statement-breakpoint
ALTER TABLE `cmsBlocks` ADD `mobileImageUrl` text;--> statement-breakpoint
CREATE INDEX `idx_farmWorkers_role` ON `farmWorkers` (`farmWorkerRole`);--> statement-breakpoint
CREATE INDEX `idx_farmWorkers_telegramChatId` ON `farmWorkers` (`telegramChatId`);--> statement-breakpoint
CREATE INDEX `idx_milkAuditLog_action` ON `milkAuditLog` (`milkAuditAction`);--> statement-breakpoint
CREATE INDEX `idx_milkAuditLog_workerId` ON `milkAuditLog` (`workerId`);--> statement-breakpoint
CREATE INDEX `idx_milkAuditLog_entityType` ON `milkAuditLog` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_milkAuditLog_createdAt` ON `milkAuditLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_milkProcessingBatches_sourceTankId` ON `milkProcessingBatches` (`sourceTankId`);--> statement-breakpoint
CREATE INDEX `idx_milkProcessingBatches_status` ON `milkProcessingBatches` (`milkProcessingStatus`);--> statement-breakpoint
CREATE INDEX `idx_milkProcessingBatches_productType` ON `milkProcessingBatches` (`productType`);--> statement-breakpoint
CREATE INDEX `idx_milkReceptions_sessionId` ON `milkReceptions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_milkReceptions_receivedByWorkerId` ON `milkReceptions` (`receivedByWorkerId`);--> statement-breakpoint
CREATE INDEX `idx_milkReceptions_status` ON `milkReceptions` (`milkReceptionStatus`);--> statement-breakpoint
CREATE INDEX `idx_milkSessionAnimals_sessionId` ON `milkSessionAnimals` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_milkSessionAnimals_animalId` ON `milkSessionAnimals` (`animalId`);--> statement-breakpoint
CREATE INDEX `idx_milkSessions_workerId` ON `milkSessions` (`workerId`);--> statement-breakpoint
CREATE INDEX `idx_milkSessions_milkingDate` ON `milkSessions` (`milkingDate`);--> statement-breakpoint
CREATE INDEX `idx_milkSessions_status` ON `milkSessions` (`milkSessionStatus`);--> statement-breakpoint
CREATE INDEX `idx_milkSessions_autoConfirmAt` ON `milkSessions` (`autoConfirmAt`);--> statement-breakpoint
CREATE INDEX `idx_milkTankMovements_tankId` ON `milkTankMovements` (`tankId`);--> statement-breakpoint
CREATE INDEX `idx_milkTankMovements_sessionId` ON `milkTankMovements` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_milkTankMovements_batchId` ON `milkTankMovements` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_milkTanks_milkType` ON `milkTanks` (`milkType`);