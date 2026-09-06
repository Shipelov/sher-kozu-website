ALTER TABLE `nutriMealPlans` ADD `profileId` int;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `profileName` varchar(120);--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `nutriProfileRelationship` enum('self','spouse','child','family','other');--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `nutriProfileGender` enum('male','female');--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `birthDate` date;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `heightCm` int;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `weightKg` double;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `nutriActivityLevel` enum('low','light','moderate','high','very_high');--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `activityDetails` text;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `dislikedProducts` json;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `mealPreferences` json;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `medicalNotes` text;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `noAllergiesConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `noRestrictionsConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `isPrimary` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `nutriProfileStatus` enum('draft','complete') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `confirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `lastReviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `nutriProfiles` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `nutriSessions` ADD `profileId` int;--> statement-breakpoint
ALTER TABLE `nutriSessions` ADD `profileConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `nutriSessions` ADD `contextState` json;--> statement-breakpoint
UPDATE `nutriProfiles` p
INNER JOIN (
  SELECT `userId`, MIN(`id`) AS `primaryId`
  FROM `nutriProfiles`
  GROUP BY `userId`
) firstProfile ON firstProfile.`primaryId` = p.`id`
SET
  p.`profileName` = COALESCE(NULLIF(p.`profileName`, ''), 'Основной профиль'),
  p.`nutriProfileRelationship` = COALESCE(p.`nutriProfileRelationship`, 'self'),
  p.`isPrimary` = true,
  p.`nutriProfileStatus` = 'draft';--> statement-breakpoint
UPDATE `nutriProfiles`
SET
  `profileName` = COALESCE(NULLIF(`profileName`, ''), CONCAT('Профиль ', `id`)),
  `nutriProfileRelationship` = COALESCE(`nutriProfileRelationship`, 'other')
WHERE `isPrimary` = false;--> statement-breakpoint
UPDATE `nutriSessions` s
INNER JOIN `nutriProfiles` p ON p.`userId` = s.`userId` AND p.`isPrimary` = true AND p.`archivedAt` IS NULL
SET s.`profileId` = p.`id`
WHERE s.`profileId` IS NULL;--> statement-breakpoint
UPDATE `nutriMealPlans` mp
INNER JOIN `nutriProfiles` p ON p.`userId` = mp.`userId` AND p.`isPrimary` = true AND p.`archivedAt` IS NULL
SET mp.`profileId` = p.`id`
WHERE mp.`profileId` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_nutriMealPlans_profileId` ON `nutriMealPlans` (`profileId`);--> statement-breakpoint
CREATE INDEX `idx_nutriProfiles_userPrimary` ON `nutriProfiles` (`userId`,`isPrimary`);--> statement-breakpoint
CREATE INDEX `idx_nutriProfiles_archivedAt` ON `nutriProfiles` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `idx_nutriSessions_profileId` ON `nutriSessions` (`profileId`);
