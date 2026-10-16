CREATE TABLE `binder_slots` (
	`binder_id` text NOT NULL,
	`position` integer NOT NULL,
	`collection_item_id` integer NOT NULL,
	PRIMARY KEY(`binder_id`, `position`),
	FOREIGN KEY (`binder_id`) REFERENCES `binders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_item_id`) REFERENCES `collection_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "binder_slots_position_range" CHECK("binder_slots"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `binder_slots_item_idx` ON `binder_slots` (`collection_item_id`);--> statement-breakpoint
CREATE TABLE `binders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text DEFAULT 'pt' NOT NULL,
	`set_id` text,
	`set_name` text,
	`set_logo_url` text,
	`template` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `binders_user_id_idx` ON `binders` (`user_id`);