CREATE TABLE `animalPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalSlug` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`meta` varchar(255) NOT NULL,
	`fileKey` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animalPhotos_id` PRIMARY KEY(`id`)
);
