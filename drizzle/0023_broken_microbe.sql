CREATE TABLE `faqQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'faq',
	`userOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `faqQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_faqQuestions_sessionId` ON `faqQuestions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_faqQuestions_source` ON `faqQuestions` (`source`);--> statement-breakpoint
CREATE INDEX `idx_faqQuestions_createdAt` ON `faqQuestions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_faqQuestions_userOpenId` ON `faqQuestions` (`userOpenId`);