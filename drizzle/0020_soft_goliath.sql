CREATE TABLE `achievementBadges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`badgeType` varchar(64) NOT NULL,
	`metadata` text,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `achievementBadges_id` PRIMARY KEY(`id`)
);
