CREATE TABLE `productPlanSetupRequests` (
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
