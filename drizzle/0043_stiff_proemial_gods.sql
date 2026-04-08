CREATE TABLE `nutriKnowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nutriKnowledgeCategory` enum('nutrition_science','breed_profile','product_info','recipe','health_goal','general') NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`contentChunks` json,
	`nutriSourceType` enum('manual','file_upload','url_import','auto_search') NOT NULL DEFAULT 'manual',
	`sourceUrl` text,
	`sourceName` varchar(500),
	`nutriConfidence` enum('verified','trusted','unverified') NOT NULL DEFAULT 'verified',
	`language` varchar(10) NOT NULL DEFAULT 'ru',
	`tags` json,
	`nutriKnowledgeStatus` enum('active','pending_review','conflict','archived') NOT NULL DEFAULT 'active',
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriKnowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriKnowledgeImports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nutriSourceType` enum('manual','file_upload','url_import','auto_search') NOT NULL DEFAULT 'manual',
	`sourceUrl` text,
	`fileName` varchar(500),
	`fileKey` varchar(500),
	`factsExtracted` int NOT NULL DEFAULT 0,
	`factsNew` int NOT NULL DEFAULT 0,
	`factsConflict` int NOT NULL DEFAULT 0,
	`nutriImportStatus` enum('processing','awaiting_review','approved','partially_approved','rejected') NOT NULL DEFAULT 'processing',
	`report` json,
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriKnowledgeImports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriMealPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int,
	`title` varchar(255) NOT NULL,
	`goal` varchar(255),
	`planData` json,
	`animalId` int,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriMealPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`nutriMessageRole` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`tokenCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nutriMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`goals` json,
	`allergies` json,
	`restrictions` json,
	`familyMembers` json,
	`preferredProducts` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriRecipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`ingredients` json,
	`instructions` text,
	`goals` json,
	`prepTimeMinutes` int,
	`nutriSeason` enum('all','spring','summer','autumn','winter') NOT NULL DEFAULT 'all',
	`productIds` json,
	`imageUrl` text,
	`nutriRecipeStatus` enum('active','draft','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriRecipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriSearchJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` int,
	`queries` json,
	`resultsFound` int NOT NULL DEFAULT 0,
	`factsProposed` int NOT NULL DEFAULT 0,
	`nutriSearchJobStatus` enum('running','completed','failed','awaiting_review') NOT NULL DEFAULT 'running',
	`report` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `nutriSearchJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriSearchSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`autoSearchEnabled` boolean NOT NULL DEFAULT false,
	`cronSchedule` varchar(64) DEFAULT '0 3 * * 1',
	`priorityTopics` json,
	`trustedSources` json,
	`excludedSources` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriSearchSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutriSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`nutriUserType` enum('guest','registered','owner') NOT NULL,
	`guestFingerprint` varchar(128),
	`goal` varchar(255),
	`nutriSessionStatus` enum('active','archived') NOT NULL DEFAULT 'active',
	`messageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutriSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_nutriKnowledge_category` ON `nutriKnowledge` (`nutriKnowledgeCategory`);--> statement-breakpoint
CREATE INDEX `idx_nutriKnowledge_status` ON `nutriKnowledge` (`nutriKnowledgeStatus`);--> statement-breakpoint
CREATE INDEX `idx_nutriKnowledge_confidence` ON `nutriKnowledge` (`nutriConfidence`);--> statement-breakpoint
CREATE INDEX `idx_nutriKnowledgeImports_status` ON `nutriKnowledgeImports` (`nutriImportStatus`);--> statement-breakpoint
CREATE INDEX `idx_nutriMealPlans_userId` ON `nutriMealPlans` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_nutriMessages_sessionId` ON `nutriMessages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_nutriMessages_createdAt` ON `nutriMessages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_nutriProfiles_userId` ON `nutriProfiles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_nutriRecipes_status` ON `nutriRecipes` (`nutriRecipeStatus`);--> statement-breakpoint
CREATE INDEX `idx_nutriSearchJobs_status` ON `nutriSearchJobs` (`nutriSearchJobStatus`);--> statement-breakpoint
CREATE INDEX `idx_nutriSessions_userId` ON `nutriSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_nutriSessions_guestFingerprint` ON `nutriSessions` (`guestFingerprint`);--> statement-breakpoint
CREATE INDEX `idx_nutriSessions_createdAt` ON `nutriSessions` (`createdAt`);