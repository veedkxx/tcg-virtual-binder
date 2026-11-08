CREATE TABLE `wishlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`variant` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`image_url` text,
	`set_name` text,
	`local_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_items_uq` ON `wishlist_items` (`user_id`,`card_id`,`language`,`variant`);--> statement-breakpoint
ALTER TABLE `binders` ADD `color` text;--> statement-breakpoint
ALTER TABLE `binders` ADD `cover_image_url` text;