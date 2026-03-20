CREATE TABLE `animalProductionProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`annualMilkLiters` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animalProductionProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`chatMessageSender` enum('owner','admin') NOT NULL,
	`text` text,
	`photoUrl` text,
	`photoKey` varchar(255),
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliverySchedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`animalId` int NOT NULL,
	`ownershipId` int NOT NULL,
	`productPlanId` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`itemsJson` text NOT NULL,
	`deliveryStatus` enum('planned','ready','delivered') NOT NULL DEFAULT 'planned',
	`deliveredAt` timestamp,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deliverySchedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerProductPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`animalId` int NOT NULL,
	`ownershipId` int NOT NULL,
	`ownerProductPlanStatus` enum('draft','confirmed','modified_by_admin') NOT NULL DEFAULT 'draft',
	`selectionsJson` text NOT NULL,
	`totalMilkUsed` int NOT NULL DEFAULT 0,
	`adminNotes` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerProductPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`productType` enum('milk','smetana','yogurt','kefir','cheese') NOT NULL,
	`label` varchar(160) NOT NULL,
	`conversionRatio` int NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'л',
	`maxAnnualUnits` int NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productOptions_id` PRIMARY KEY(`id`)
);
