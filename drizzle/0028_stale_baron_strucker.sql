ALTER TABLE `animalPhotos` ADD `photoModerationStatus` enum('pending','approved','rejected') DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `animalPhotos` ADD `moderatedBy` varchar(64);--> statement-breakpoint
ALTER TABLE `animalPhotos` ADD `moderatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `animalPhotos` ADD `rejectionReason` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_animalPhotos_moderationStatus` ON `animalPhotos` (`photoModerationStatus`);