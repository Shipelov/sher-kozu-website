CREATE TABLE `clubEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`dateLabel` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`status` varchar(120) NOT NULL,
	`tone` varchar(32) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clubMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`animal` varchar(120) NOT NULL,
	`sinceLabel` varchar(120) NOT NULL,
	`badge` varchar(80) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clubPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`category` varchar(32) NOT NULL,
	`author` varchar(160) NOT NULL,
	`avatar` varchar(8) NOT NULL,
	`role` varchar(120) NOT NULL,
	`timeLabel` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`text` text NOT NULL,
	`imageUrl` text NOT NULL,
	`likes` int NOT NULL DEFAULT 0,
	`comments` int NOT NULL DEFAULT 0,
	`tagsCsv` varchar(255) NOT NULL,
	`pinned` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clubPosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalSlug` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`productName` varchar(160) NOT NULL,
	`productType` varchar(80) NOT NULL,
	`stage` varchar(80) NOT NULL,
	`routeLabel` varchar(160) NOT NULL,
	`detail` text NOT NULL,
	`badge` varchar(80) NOT NULL,
	`batchCode` varchar(80) NOT NULL,
	`producedAt` timestamp NOT NULL,
	`deliveryWindow` varchar(120) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productCompositionSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalSlug` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`value` varchar(120) NOT NULL,
	`note` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productCompositionSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalSlug` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`status` varchar(80) NOT NULL,
	`etaLabel` varchar(120) NOT NULL,
	`destination` varchar(160) NOT NULL,
	`courierNote` varchar(255) NOT NULL,
	`isActive` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productDeliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productMonthlyMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalSlug` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`monthLabel` varchar(32) NOT NULL,
	`milkVolumeLiters` int NOT NULL,
	`proteinPercentTenth` int NOT NULL,
	`fatPercentTenth` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productMonthlyMetrics_id` PRIMARY KEY(`id`)
);
