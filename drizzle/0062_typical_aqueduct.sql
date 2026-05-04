CREATE TABLE `catalogImportHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminOpenId` varchar(64) NOT NULL,
	`adminName` varchar(160),
	`snapshotJson` text NOT NULL,
	`itemsCreated` int NOT NULL DEFAULT 0,
	`itemsUpdated` int NOT NULL DEFAULT 0,
	`itemsDeleted` int NOT NULL DEFAULT 0,
	`totalItems` int NOT NULL DEFAULT 0,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalogImportHistory_id` PRIMARY KEY(`id`)
);
