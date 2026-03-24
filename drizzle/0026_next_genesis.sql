CREATE TABLE `cmsBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page` varchar(64) NOT NULL,
	`blockKey` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`contentType` enum('text','richtext','image','json') NOT NULL DEFAULT 'text',
	`content` text,
	`imageUrl` text,
	`section` varchar(128),
	`sortOrder` int NOT NULL DEFAULT 0,
	`visible` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cmsBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cms_page_key_idx` ON `cmsBlocks` (`page`,`blockKey`);