ALTER TABLE `data_controls` ADD `checked_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `data_controls` ADD `reset_kind` text DEFAULT 'all' NOT NULL;