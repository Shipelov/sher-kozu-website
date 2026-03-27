CREATE TABLE `userNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`body` text,
	`link` varchar(512),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `notif_userOpenId_idx` ON `userNotifications` (`userOpenId`);--> statement-breakpoint
CREATE INDEX `notif_isRead_idx` ON `userNotifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `notif_createdAt_idx` ON `userNotifications` (`createdAt`);