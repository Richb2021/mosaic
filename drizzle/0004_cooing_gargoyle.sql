CREATE INDEX `event_scope_age` ON `data_events` (`scope`,`created`);--> statement-breakpoint
CREATE INDEX `lease_scope_expiry` ON `data_leases` (`scope`,`expires`);--> statement-breakpoint
CREATE INDEX `operation_owner` ON `data_operations` (`site_owner`,`learner_owner`,`created`);--> statement-breakpoint
CREATE INDEX `media_owner` ON `media_assets` (`site_owner`,`learner_owner`);--> statement-breakpoint
CREATE INDEX `media_script` ON `media_assets` (`script_id`);