CREATE TABLE `ownerTierStatus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`ownerTierSlug` enum('basic','standard','professional') NOT NULL,
	`totalAnimals` int NOT NULL DEFAULT 0,
	`totalActiveOwnerships` int NOT NULL DEFAULT 0,
	`determinedAt` timestamp NOT NULL DEFAULT (now()),
	`previousTierSlug` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerTierStatus_id` PRIMARY KEY(`id`),
	CONSTRAINT `ownerTierStatus_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
--> statement-breakpoint
CREATE TABLE `tierProductCatalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`minTier` enum('basic','standard','professional') NOT NULL,
	`productType` enum('milk','smetana','yogurt','kefir','brynza','kachotta','halumi','ricotta','camembert','aged_cheese','blue_cheese','smoked_cheese','butter','condensed_milk','fermented_drink','custom','cheese') NOT NULL,
	`label` varchar(160) NOT NULL,
	`tpc_species` enum('goat','sheep','both') NOT NULL DEFAULT 'both',
	`conversionRatio` double NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'л',
	`description` text,
	`isEnabled` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tierProductCatalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ownerProductPlans` MODIFY COLUMN `ownerProductPlanStatus` enum('draft','pending_admin_setup','pending_owner_config','pending_approval','confirmed','modified_by_admin') NOT NULL DEFAULT 'pending_admin_setup';--> statement-breakpoint
ALTER TABLE `planChangeLog` MODIFY COLUMN `planChangeAction` enum('created','submitted','approved','modified','reset','tier_changed','admin_verified','owner_configured') NOT NULL;--> statement-breakpoint
ALTER TABLE `productOptions` MODIFY COLUMN `productType` enum('milk','smetana','yogurt','kefir','brynza','kachotta','halumi','ricotta','camembert','aged_cheese','blue_cheese','smoked_cheese','butter','condensed_milk','fermented_drink','custom','cheese') NOT NULL;--> statement-breakpoint
ALTER TABLE `ownerProductPlans` ADD `tierSlug` varchar(32);--> statement-breakpoint
ALTER TABLE `ownerProductPlans` ADD `adminVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ownerProductPlans` ADD `lastChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ownerProductPlans` ADD `nextChangeAllowedAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_ownerTier_openId` ON `ownerTierStatus` (`ownerOpenId`);--> statement-breakpoint
CREATE INDEX `idx_tpc_minTier` ON `tierProductCatalog` (`minTier`);--> statement-breakpoint
CREATE INDEX `idx_tpc_species` ON `tierProductCatalog` (`tpc_species`);