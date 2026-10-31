CREATE TABLE `workshop_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`request_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`draft` text,
	`error` text,
	`provider_id` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_owner_request` ON `workshop_jobs` (`owner`,`request_key`);--> statement-breakpoint
CREATE TABLE `workshop_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`checksum` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_owner_checksum` ON `workshop_resources` (`owner`,`checksum`);