CREATE TABLE `abExperimentAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experimentId` int NOT NULL,
	`variantId` int NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`converted` boolean NOT NULL DEFAULT false,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abExperimentAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `abExperimentVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experimentId` int NOT NULL,
	`variantKey` varchar(64) NOT NULL,
	`label` varchar(256) NOT NULL,
	`weight` int NOT NULL DEFAULT 50,
	`config` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abExperimentVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `abExperiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`targetPage` varchar(512) NOT NULL,
	`goalEvent` varchar(256) NOT NULL,
	`startDate` timestamp,
	`endDate` timestamp,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abExperiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analyticsAlertHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleId` int NOT NULL,
	`ruleName` varchar(256) NOT NULL,
	`metric` varchar(64) NOT NULL,
	`currentValue` double NOT NULL,
	`previousValue` double,
	`changePct` double,
	`message` text NOT NULL,
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsAlertHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analyticsAlertRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`metric` varchar(64) NOT NULL,
	`operator` varchar(32) NOT NULL,
	`threshold` double NOT NULL,
	`windowHours` int NOT NULL DEFAULT 24,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analyticsAlertRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aea_experimentId_idx` ON `abExperimentAssignments` (`experimentId`);--> statement-breakpoint
CREATE INDEX `aea_variantId_idx` ON `abExperimentAssignments` (`variantId`);--> statement-breakpoint
CREATE INDEX `aea_visitorId_idx` ON `abExperimentAssignments` (`visitorId`);--> statement-breakpoint
CREATE INDEX `aev_experimentId_idx` ON `abExperimentVariants` (`experimentId`);--> statement-breakpoint
CREATE INDEX `aah_ruleId_idx` ON `analyticsAlertHistory` (`ruleId`);--> statement-breakpoint
CREATE INDEX `aah_createdAt_idx` ON `analyticsAlertHistory` (`createdAt`);