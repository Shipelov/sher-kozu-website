ALTER TABLE `milkTankMovements` MODIFY COLUMN `performedByWorkerId` int;--> statement-breakpoint
ALTER TABLE `milkTankMovements` ADD `performedByAdminOpenId` varchar(128);