CREATE TABLE `clubEventRegistrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`userName` varchar(160) NOT NULL,
	`eventRegistrationStatus` enum('registered','waitlist','cancelled','rejected') NOT NULL DEFAULT 'registered',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubEventRegistrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clubPostComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`userName` varchar(160) NOT NULL,
	`text` text NOT NULL,
	`hidden` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubPostComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clubPostLikes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clubPostLikes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clubEvents` ADD `maxCapacity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubEvents` ADD `registrationCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clubEvents` ADD `registrationOpen` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_cer_eventId` ON `clubEventRegistrations` (`eventId`);--> statement-breakpoint
CREATE INDEX `idx_cer_userOpenId` ON `clubEventRegistrations` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `idx_cpc_postId` ON `clubPostComments` (`postId`);--> statement-breakpoint
CREATE INDEX `idx_cpc_userOpenId` ON `clubPostComments` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `idx_cpl_postId` ON `clubPostLikes` (`postId`);--> statement-breakpoint
CREATE INDEX `idx_cpl_userOpenId` ON `clubPostLikes` (`userOpenId`);