CREATE TABLE IF NOT EXISTS `processingInputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`tankId` int NOT NULL,
	`volumeMl` int NOT NULL,
	`milkType` enum('goat','sheep','cow') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processingInputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `processingOutputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`catalogItemId` int NOT NULL,
	`productLabel` varchar(160) NOT NULL,
	`quantity` double NOT NULL,
	`unit` varchar(16) NOT NULL,
	`warehouseId` int NOT NULL,
	`actualConversionRatio` double,
	`baseConversionRatio` double,
	`deviationPercent` double,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processingOutputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `processingSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionCode` varchar(32) NOT NULL,
	`shiftDate` varchar(10) NOT NULL,
	`processingSessionStatus` enum('draft','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
	`startedByWorkerId` int NOT NULL,
	`totalInputMl` int NOT NULL DEFAULT 0,
	`note` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processingSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `processingSessions_sessionCode_unique` UNIQUE(`sessionCode`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `warehouseInventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`catalogItemId` int NOT NULL,
	`productLabel` varchar(160) NOT NULL,
	`quantity` double NOT NULL DEFAULT 0,
	`unit` varchar(16) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseInventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `warehouseMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`warehouseMovementType` enum('in','out','writeoff','adjustment') NOT NULL,
	`catalogItemId` int NOT NULL,
	`productLabel` varchar(160) NOT NULL,
	`quantity` double NOT NULL,
	`unit` varchar(16) NOT NULL,
	`processingSessionId` int,
	`performedByWorkerId` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouseMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `milkAuditLog` MODIFY COLUMN `milkAuditAction` enum('session_created','session_updated','session_cancelled','session_confirmed','session_disputed','session_auto_confirmed','reception_accepted','reception_rejected','tank_movement','batch_started','batch_completed','worker_login','worker_password_changed','admin_edit','admin_delete','processing_session_created','processing_session_updated','processing_session_completed','processing_session_cancelled','processing_session_corrected','warehouse_created','warehouse_updated','warehouse_movement') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_processingInputs_sessionId` ON `processingInputs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_processingInputs_tankId` ON `processingInputs` (`tankId`);--> statement-breakpoint
CREATE INDEX `idx_processingOutputs_sessionId` ON `processingOutputs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_processingOutputs_catalogItemId` ON `processingOutputs` (`catalogItemId`);--> statement-breakpoint
CREATE INDEX `idx_processingOutputs_warehouseId` ON `processingOutputs` (`warehouseId`);--> statement-breakpoint
CREATE INDEX `idx_processingSessions_shiftDate` ON `processingSessions` (`shiftDate`);--> statement-breakpoint
CREATE INDEX `idx_processingSessions_status` ON `processingSessions` (`processingSessionStatus`);--> statement-breakpoint
CREATE INDEX `idx_processingSessions_startedByWorkerId` ON `processingSessions` (`startedByWorkerId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseInventory_warehouseId` ON `warehouseInventory` (`warehouseId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseInventory_catalogItemId` ON `warehouseInventory` (`catalogItemId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseMovements_warehouseId` ON `warehouseMovements` (`warehouseId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseMovements_catalogItemId` ON `warehouseMovements` (`catalogItemId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseMovements_processingSessionId` ON `warehouseMovements` (`processingSessionId`);--> statement-breakpoint
CREATE INDEX `idx_warehouseMovements_performedByWorkerId` ON `warehouseMovements` (`performedByWorkerId`);