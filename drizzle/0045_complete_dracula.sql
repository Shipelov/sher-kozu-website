CREATE TABLE `pagePerformance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userOpenId` varchar(64),
	`pagePath` varchar(512) NOT NULL,
	`dnsMs` int,
	`tcpMs` int,
	`tlsMs` int,
	`ttfbMs` int,
	`downloadMs` int,
	`domInteractiveMs` int,
	`domContentLoadedMs` int,
	`pageLoadMs` int,
	`fcpMs` int,
	`lcpMs` int,
	`fidMs` int,
	`clsX1000` int,
	`transferSizeBytes` int,
	`resourceCount` int,
	`deviceType` varchar(16),
	`connectionType` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pagePerformance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pp_pagePath_idx` ON `pagePerformance` (`pagePath`);--> statement-breakpoint
CREATE INDEX `pp_createdAt_idx` ON `pagePerformance` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pp_pageLoadMs_idx` ON `pagePerformance` (`pageLoadMs`);--> statement-breakpoint
CREATE INDEX `pp_sessionId_idx` ON `pagePerformance` (`sessionId`);