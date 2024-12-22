CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queue` varchar(255) NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`expireAt` timestamp,
	`allocationId` varchar(50) NOT NULL,
	`numRunsLeft` int NOT NULL,
	`maxNumRuns` int NOT NULL,
	`idempotencyKey` varchar(255),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_queue_idempotencyKey_unique` UNIQUE(`queue`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `tasks_queue_idx` ON `tasks` (`queue`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_expire_at_idx` ON `tasks` (`expireAt`);--> statement-breakpoint
CREATE INDEX `tasks_num_runs_left_idx` ON `tasks` (`numRunsLeft`);--> statement-breakpoint
CREATE INDEX `tasks_max_num_runs_idx` ON `tasks` (`maxNumRuns`);--> statement-breakpoint
CREATE INDEX `tasks_allocation_id_idx` ON `tasks` (`allocationId`);