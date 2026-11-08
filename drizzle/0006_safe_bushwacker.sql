ALTER TABLE `binders` ADD `search` text;--> statement-breakpoint
ALTER TABLE `binders` ADD `excluded` text;--> statement-breakpoint
ALTER TABLE `collection_items` ADD `illustrator` text;--> statement-breakpoint
-- Cópias existentes voltam a "a completar" para ganhar o artista (POST /api/collection/complete).
UPDATE `collection_items` SET `types` = NULL;
