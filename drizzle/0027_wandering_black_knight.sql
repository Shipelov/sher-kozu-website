CREATE TABLE `cmsBlockHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`page` varchar(64) NOT NULL,
	`blockKey` varchar(128) NOT NULL,
	`action` varchar(64) NOT NULL,
	`prevContent` text,
	`prevImageUrl` text,
	`prevVisible` boolean,
	`newContent` text,
	`newImageUrl` text,
	`newVisible` boolean,
	`changedByOpenId` varchar(64) NOT NULL,
	`changedByName` varchar(255),
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cmsBlockHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cms_history_blockId_idx` ON `cmsBlockHistory` (`blockId`);--> statement-breakpoint
CREATE INDEX `cms_history_page_idx` ON `cmsBlockHistory` (`page`);--> statement-breakpoint
CREATE INDEX `cms_history_changedAt_idx` ON `cmsBlockHistory` (`changedAt`);