CREATE TABLE `telegramLinkTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegramLinkTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramLinkTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `telegramSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` varchar(20) NOT NULL,
	`telegramSessionState` enum('idle','chat_zoya','chat_masha') NOT NULL DEFAULT 'idle',
	`contextJson` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegramSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramSessions_chatId_unique` UNIQUE(`chatId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `telegramChatId` varchar(20);