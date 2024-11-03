ALTER TABLE `tasks` ADD `idempotencyKey` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_queue_idempotencyKey_unique` ON `tasks` (`queue`,`idempotencyKey`);