CREATE TABLE `ratingSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`totalScore` int NOT NULL DEFAULT 0,
	`averageAnimalRating` int NOT NULL DEFAULT 0,
	`activityBonus` int NOT NULL DEFAULT 0,
	`rank` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ratingSnapshots_id` PRIMARY KEY(`id`)
);
