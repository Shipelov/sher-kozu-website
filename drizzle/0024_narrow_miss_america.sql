CREATE TABLE `abTestSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`variantKey` varchar(64) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'floating',
	`didRespond` boolean NOT NULL DEFAULT false,
	`messageCount` int NOT NULL DEFAULT 0,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`userOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abTestSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `greetingVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantKey` varchar(64) NOT NULL,
	`greetingText` text NOT NULL,
	`description` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `greetingVariants_id` PRIMARY KEY(`id`),
	CONSTRAINT `greetingVariants_variantKey_unique` UNIQUE(`variantKey`)
);
--> statement-breakpoint
CREATE INDEX `idx_abTestSessions_sessionId` ON `abTestSessions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_abTestSessions_variantKey` ON `abTestSessions` (`variantKey`);--> statement-breakpoint
CREATE INDEX `idx_abTestSessions_createdAt` ON `abTestSessions` (`createdAt`);