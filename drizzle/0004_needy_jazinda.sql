CREATE TABLE `clubAdminPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`tab` enum('posts','events','members') NOT NULL,
	`name` varchar(120) NOT NULL,
	`configJson` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubAdminPresets_id` PRIMARY KEY(`id`)
);
