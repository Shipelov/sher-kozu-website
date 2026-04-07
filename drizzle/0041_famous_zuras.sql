ALTER TABLE `clubEvents` ADD `hidden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clubMembers` ADD `hidden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clubPosts` ADD `hidden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_clubPosts_hidden` ON `clubPosts` (`hidden`);