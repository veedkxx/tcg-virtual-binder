DROP INDEX `collection_items_user_card_lang_uq`;--> statement-breakpoint
ALTER TABLE `collection_items` ADD `variant` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `collection_items` ADD `condition` text DEFAULT 'NM' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_copy_uq` ON `collection_items` (`user_id`,`card_id`,`language`,`variant`,`condition`);