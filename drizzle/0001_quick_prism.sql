CREATE TABLE `data_controls` (
	`scope` text PRIMARY KEY NOT NULL,
	`epoch` integer DEFAULT 0 NOT NULL,
	`policy` text DEFAULT '{}' NOT NULL,
	`operation` text,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_events` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`site_owner` text NOT NULL,
	`learner_owner` text NOT NULL,
	`scope` text NOT NULL,
	`status` text NOT NULL,
	`plan` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`site_owner` text NOT NULL,
	`learner_owner` text NOT NULL,
	`script_id` text NOT NULL,
	`script_hash` text NOT NULL,
	`segment` integer NOT NULL,
	`object_key` text NOT NULL,
	`status` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
