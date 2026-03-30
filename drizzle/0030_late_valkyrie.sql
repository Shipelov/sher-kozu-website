CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`photoApproved` boolean NOT NULL DEFAULT true,
	`photoRejected` boolean NOT NULL DEFAULT true,
	`clubPost` boolean NOT NULL DEFAULT true,
	`clubEvent` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationPreferences_userOpenId_unique` UNIQUE(`userOpenId`)
);
