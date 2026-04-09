CREATE TABLE `zoyaSharedContent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`title` varchar(500),
	`userQuestion` text,
	`userId` int,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `zoyaSharedContent_id` PRIMARY KEY(`id`),
	CONSTRAINT `zoyaSharedContent_shareToken_unique` UNIQUE(`shareToken`)
);
