CREATE TABLE `animalMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`animalMediaKind` enum('image','video','document') NOT NULL DEFAULT 'image',
	`title` varchar(160) NOT NULL,
	`alt` varchar(255),
	`fileKey` varchar(255),
	`url` text NOT NULL,
	`mimeType` varchar(120),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isCover` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animalMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `animalOwnerships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`animalId` int NOT NULL,
	`familyId` int NOT NULL,
	`planId` int NOT NULL,
	`planDurationId` int NOT NULL,
	`slotIndex` int NOT NULL,
	`ownershipStatus` enum('pending_payment','active','expired','cancelled') NOT NULL DEFAULT 'pending_payment',
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`priceMinor` int NOT NULL DEFAULT 0,
	`paidAt` timestamp,
	`cancelledAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animalOwnerships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `animals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`animalSpecies` enum('goat','sheep') NOT NULL,
	`breed` varchar(160),
	`birthDate` timestamp,
	`shortDescription` varchar(255),
	`story` text,
	`coverImageUrl` text,
	`galleryIntro` text,
	`animalStatus` enum('public_available','public_limited','fully_booked','hidden','archived') NOT NULL DEFAULT 'public_available',
	`totalOwnershipSlots` int NOT NULL DEFAULT 3,
	`baseMonthlyPriceMinor` int NOT NULL DEFAULT 0,
	`healthScore` int NOT NULL DEFAULT 50,
	`happinessScore` int NOT NULL DEFAULT 50,
	`milkPotentialScore` int NOT NULL DEFAULT 50,
	`careLevelScore` int NOT NULL DEFAULT 0,
	`isFeatured` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animals_id` PRIMARY KEY(`id`),
	CONSTRAINT `animals_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `families` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`familyStatus` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`maxAnimals` int NOT NULL DEFAULT 10,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `families_id` PRIMARY KEY(`id`),
	CONSTRAINT `families_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `planDurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`months` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`priceMinor` int NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planDurations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`planStatus` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`basePriceMinor` int NOT NULL DEFAULT 0,
	`maxOwnersPerAnimal` int NOT NULL DEFAULT 3,
	`benefitsSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`walletId` int NOT NULL,
	`familyId` int NOT NULL,
	`walletTransactionType` enum('topup','spend','reward','admin_grant','admin_adjustment','refund','expiry') NOT NULL,
	`walletTransactionDirection` enum('credit','debit') NOT NULL,
	`amountMinor` int NOT NULL,
	`balanceAfterMinor` int NOT NULL DEFAULT 0,
	`memo` varchar(255),
	`referenceType` varchar(64),
	`referenceId` varchar(64),
	`emittedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`familyId` int NOT NULL,
	`walletStatus` enum('active','frozen','archived') NOT NULL DEFAULT 'active',
	`balanceMinor` int NOT NULL DEFAULT 0,
	`currencyCode` varchar(12) NOT NULL DEFAULT 'SKC',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`)
);
