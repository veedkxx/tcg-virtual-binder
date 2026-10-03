CREATE TABLE `collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` text NOT NULL,
	`language` text DEFAULT 'pt' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`image_url` text,
	`set_id` text,
	`set_name` text,
	`local_id` text,
	`rarity` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "collection_items_quantity_positive" CHECK("collection_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_card_lang_uq` ON `collection_items` (`card_id`,`language`);