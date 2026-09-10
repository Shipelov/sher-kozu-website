CREATE TABLE `assistantKnowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assistant` enum('masha','zoya','shared') NOT NULL DEFAULT 'masha',
	`category` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`tags` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assistantKnowledge_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_assistantKnowledge_key` UNIQUE(`assistant`,`category`,`title`)
);
--> statement-breakpoint
ALTER TABLE `faqQuestions` ADD `outcome` varchar(32);--> statement-breakpoint
ALTER TABLE `faqQuestions` ADD `toolTrace` json;--> statement-breakpoint
ALTER TABLE `uncertainAnswers` ADD `toolTrace` json;--> statement-breakpoint
CREATE INDEX `idx_assistantKnowledge_assistant_category_active` ON `assistantKnowledge` (`assistant`,`category`,`isActive`);