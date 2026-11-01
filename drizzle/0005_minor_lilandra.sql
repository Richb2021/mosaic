CREATE TABLE `cost_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_owner` text NOT NULL,
	`learner_owner` text,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`usage` text,
	`rates` text NOT NULL,
	`estimate_micros` integer,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cost_owner_age` ON `cost_receipts` (`site_owner`,`created`);--> statement-breakpoint
CREATE INDEX `cost_learner` ON `cost_receipts` (`learner_owner`);--> statement-breakpoint
CREATE TABLE `retention_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`site_owner` text NOT NULL,
	`learner_owner` text NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retention_subject_owner` ON `retention_subjects` (`site_owner`,`learner_owner`);