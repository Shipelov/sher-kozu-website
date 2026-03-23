CREATE TABLE `animalFeedbackMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseId` int NOT NULL,
	`animalId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`photoUrl` text,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `animalFeedbackMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `animalWellnessMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animalId` int NOT NULL,
	`happiness` int NOT NULL DEFAULT 50,
	`health` int NOT NULL DEFAULT 50,
	`attachment` int NOT NULL DEFAULT 50,
	`mood` int NOT NULL DEFAULT 50,
	`obedience` int NOT NULL DEFAULT 50,
	`overallRating` int NOT NULL DEFAULT 50,
	`herdRank` int NOT NULL DEFAULT 0,
	`lastDecayAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animalWellnessMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `animalWellnessMetrics_animalId_unique` UNIQUE(`animalId`)
);
--> statement-breakpoint
CREATE TABLE `autoAllocationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 0,
	`amountSKC` int NOT NULL DEFAULT 50,
	`manualAllocationEnabled` int NOT NULL DEFAULT 1,
	`dayOfMonth` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `autoAllocationSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `farmAccountTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`farmAccountId` int NOT NULL,
	`walletId` int,
	`ownerOpenId` varchar(64),
	`farmTxType` enum('emission','bulk_emission','auto_emission','purchase','refund','adjustment','bonus') NOT NULL,
	`farmTxDirection` enum('credit','debit') NOT NULL,
	`amountSKC` int NOT NULL,
	`farmBalanceAfterSKC` int NOT NULL,
	`walletBalanceAfterSKC` int,
	`purchaseId` int,
	`memo` varchar(500),
	`initiatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `farmAccountTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `farmAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`farmAccountType` enum('bank','revenue') NOT NULL,
	`balanceSKC` int NOT NULL DEFAULT 0,
	`totalLifetimeSKC` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farmAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `farmAccounts_farmAccountType_unique` UNIQUE(`farmAccountType`)
);
--> statement-breakpoint
CREATE TABLE `farmerChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseId` int NOT NULL,
	`animalId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`itemName` varchar(160) NOT NULL,
	`checklistStatus` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`tasksJson` text NOT NULL,
	`farmerNotes` text,
	`photoUrlsJson` text,
	`completedAt` timestamp,
	`completedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farmerChecklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`emoji` varchar(8),
	`iconUrl` text,
	`isVisible` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplaceCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplaceCategories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `marketplaceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`imageUrl` text,
	`priceSKC` int NOT NULL,
	`stock` int NOT NULL DEFAULT -1,
	`dailyLimitPerOwner` int NOT NULL DEFAULT 0,
	`weeklyLimitPerOwner` int NOT NULL DEFAULT 0,
	`monthlyLimitPerOwner` int NOT NULL DEFAULT 0,
	`marketplaceItemSeason` enum('all','spring','summer','autumn','winter') NOT NULL DEFAULT 'all',
	`metricEffectsJson` text NOT NULL,
	`requiresChecklist` int NOT NULL DEFAULT 1,
	`checklistTemplateJson` text,
	`feedbackTemplate` text,
	`isVisible` int NOT NULL DEFAULT 1,
	`applicableSpecies` varchar(16),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplaceItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplaceItems_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `marketplacePurchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`animalId` int NOT NULL,
	`itemId` int NOT NULL,
	`walletId` int NOT NULL,
	`pricePaidSKC` int NOT NULL,
	`metricEffectsAppliedJson` text NOT NULL,
	`checklistCompleted` int NOT NULL DEFAULT 0,
	`feedbackSent` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplacePurchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`averageAnimalRating` int NOT NULL DEFAULT 50,
	`activityBonus` int NOT NULL DEFAULT 0,
	`totalScore` int NOT NULL DEFAULT 50,
	`title` varchar(80) NOT NULL DEFAULT 'Новичок',
	`rank` int NOT NULL DEFAULT 0,
	`totalSpentSKC` int NOT NULL DEFAULT 0,
	`totalPurchases` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerRatings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ownerRatings_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
