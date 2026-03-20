CREATE TABLE `planChangeLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`animalId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`actorId` varchar(64) NOT NULL,
	`planChangeAction` enum('created','submitted','approved','modified','reset') NOT NULL,
	`previousStatus` varchar(32),
	`newStatus` varchar(32) NOT NULL,
	`selectionsSnapshot` text,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planChangeLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ownerProductPlans` MODIFY COLUMN `ownerProductPlanStatus` enum('draft','pending_approval','confirmed','modified_by_admin') NOT NULL DEFAULT 'draft';