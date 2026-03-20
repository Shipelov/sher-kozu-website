CREATE TABLE `authRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`identifier` varchar(320) NOT NULL,
	`action` varchar(32) NOT NULL,
	`attempts` int NOT NULL DEFAULT 1,
	`windowExpiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authRateLimits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otpCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`target` varchar(320) NOT NULL,
	`code` varchar(6) NOT NULL,
	`otpPurpose` enum('registration','password_reset') NOT NULL,
	`otpChannel` enum('email','phone') NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`verified` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otpCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`token` varchar(128) NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResetTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordResetTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);