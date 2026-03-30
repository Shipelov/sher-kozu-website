CREATE TABLE `siteEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userOpenId` varchar(64),
	`category` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`label` varchar(256),
	`value` int,
	`pagePath` varchar(512),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `siteVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userOpenId` varchar(64),
	`pagePath` varchar(512) NOT NULL,
	`referrer` varchar(1024),
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(256),
	`deviceType` varchar(16),
	`browser` varchar(64),
	`os` varchar(64),
	`screenWidth` int,
	`country` varchar(8),
	`timeOnPage` int,
	`isEntry` boolean NOT NULL DEFAULT false,
	`isExit` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteVisits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `se_visitorId_idx` ON `siteEvents` (`visitorId`);--> statement-breakpoint
CREATE INDEX `se_sessionId_idx` ON `siteEvents` (`sessionId`);--> statement-breakpoint
CREATE INDEX `se_category_idx` ON `siteEvents` (`category`);--> statement-breakpoint
CREATE INDEX `se_action_idx` ON `siteEvents` (`action`);--> statement-breakpoint
CREATE INDEX `se_createdAt_idx` ON `siteEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `sv_visitorId_idx` ON `siteVisits` (`visitorId`);--> statement-breakpoint
CREATE INDEX `sv_sessionId_idx` ON `siteVisits` (`sessionId`);--> statement-breakpoint
CREATE INDEX `sv_pagePath_idx` ON `siteVisits` (`pagePath`);--> statement-breakpoint
CREATE INDEX `sv_createdAt_idx` ON `siteVisits` (`createdAt`);--> statement-breakpoint
CREATE INDEX `sv_userOpenId_idx` ON `siteVisits` (`userOpenId`);