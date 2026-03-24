CREATE TABLE `uncertainAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'faq',
	`sessionId` varchar(64) NOT NULL,
	`resolved` boolean NOT NULL DEFAULT false,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `uncertainAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_uncertainAnswers_resolved` ON `uncertainAnswers` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_uncertainAnswers_createdAt` ON `uncertainAnswers` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_uncertainAnswers_sessionId` ON `uncertainAnswers` (`sessionId`);