ALTER TABLE `productOptions` ADD `isAdminVerified` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `productOptions` ADD `adminVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `productOptions` ADD `catalogItemId` int;