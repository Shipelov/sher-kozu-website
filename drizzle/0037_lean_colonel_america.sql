CREATE TABLE `calculatorSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`visitorId` varchar(64),
	`cs_species` enum('goat','sheep'),
	`breedSlug` varchar(64),
	`sharePercent` int,
	`animalCount` int,
	`cs_tierSlug` varchar(32),
	`annualCostMinor` int,
	`marketValueMinor` int,
	`savingsPercent` int,
	`productDistribution` json,
	`clickedCta` boolean DEFAULT false,
	`ctaType` varchar(32),
	`referrerPage` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculatorSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSlug` varchar(64) NOT NULL,
	`mp_species` enum('goat','sheep') NOT NULL,
	`mp_category` enum('milk','fermented','soft_cheese','semi_hard_cheese','hard_cheese','aged_cheese','butter','other') NOT NULL,
	`mp_unit` enum('liter','kg') NOT NULL,
	`minPriceMinor` int NOT NULL,
	`maxPriceMinor` int NOT NULL,
	`avgPriceMinor` int NOT NULL,
	`source` varchar(255),
	`lastVerifiedAt` timestamp,
	`mp_tierAvailability` enum('all','standard_plus','professional_only') NOT NULL DEFAULT 'all',
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketPrices_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketPrices_productSlug_unique` UNIQUE(`productSlug`)
);
--> statement-breakpoint
CREATE TABLE `pricingPageViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pagePath` varchar(128) NOT NULL,
	`userId` int,
	`visitorId` varchar(64),
	`sessionId` varchar(64),
	`timeOnPageSeconds` int,
	`scrollDepthPercent` int,
	`referrer` varchar(512),
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricingPageViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`subtitle` varchar(255),
	`sharePercent` int NOT NULL DEFAULT 0,
	`minAnimals` int NOT NULL DEFAULT 1,
	`monthlyFeeMinor` int NOT NULL DEFAULT 0,
	`annualDiscountPercent` int NOT NULL DEFAULT 0,
	`renewalDiscountPercent` int NOT NULL DEFAULT 0,
	`packageDiscountPercent` int NOT NULL DEFAULT 0,
	`planChangeFrequency` enum('quarterly','monthly','weekly'),
	`deliveryAddresses` int NOT NULL DEFAULT 1,
	`personalizedLabelFree` boolean NOT NULL DEFAULT false,
	`agedCheeseAccess` boolean NOT NULL DEFAULT false,
	`maxGiftSubscriptionMonths` int NOT NULL DEFAULT 0,
	`farmVisitsPerYear` int NOT NULL DEFAULT 0,
	`clubEventsPerYear` int NOT NULL DEFAULT 0,
	`shopDiscountPercent` int NOT NULL DEFAULT 0,
	`referralMultiplier` int NOT NULL DEFAULT 1,
	`hasPersonalManager` boolean NOT NULL DEFAULT false,
	`hasDigitalDiary` boolean NOT NULL DEFAULT false,
	`badgeSystemLevel` enum('none','basic','extended','full') DEFAULT 'none',
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`heroDescription` text,
	`targetAudience` text,
	`featureHighlights` json,
	`limitations` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricingTiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricingTiers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `productConversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketPriceId` int NOT NULL,
	`milkLitersPerUnit` double NOT NULL,
	`pc_outputUnit` enum('liter','kg') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productConversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cs_userId_idx` ON `calculatorSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `cs_tierSlug_idx` ON `calculatorSessions` (`cs_tierSlug`);--> statement-breakpoint
CREATE INDEX `cs_createdAt_idx` ON `calculatorSessions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `mp_species_idx` ON `marketPrices` (`mp_species`);--> statement-breakpoint
CREATE INDEX `mp_category_idx` ON `marketPrices` (`mp_category`);--> statement-breakpoint
CREATE INDEX `mp_slug_idx` ON `marketPrices` (`productSlug`);--> statement-breakpoint
CREATE INDEX `ppv_pagePath_idx` ON `pricingPageViews` (`pagePath`);--> statement-breakpoint
CREATE INDEX `ppv_createdAt_idx` ON `pricingPageViews` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ppv_userId_idx` ON `pricingPageViews` (`userId`);--> statement-breakpoint
CREATE INDEX `pt_slug_idx` ON `pricingTiers` (`slug`);--> statement-breakpoint
CREATE INDEX `pt_active_idx` ON `pricingTiers` (`isActive`);--> statement-breakpoint
CREATE INDEX `pc_mpId_idx` ON `productConversions` (`marketPriceId`);