CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content_item_id` text,
	`channel` text,
	`status` text DEFAULT 'info' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `channel_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`channel` text NOT NULL,
	`title` text,
	`body` text,
	`media_type` text,
	`post_type` text,
	`zernio_account_id` text,
	`zernio_profile_id` text,
	`zernio_connection_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_for` text,
	`published_at` text,
	`zernio_post_id` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zernio_account_id`) REFERENCES `zernio_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zernio_profile_id`) REFERENCES `zernio_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zernio_connection_id`) REFERENCES `zernio_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_name` text NOT NULL,
	`original_folder_name` text NOT NULL,
	`folder_path` text NOT NULL,
	`drive_item_id` text NOT NULL,
	`is_done` integer DEFAULT 0 NOT NULL,
	`title` text,
	`cover_image` text,
	`slide_count` integer DEFAULT 0,
	`synced_at` text,
	`renamed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_drive_item_id_unique` ON `content_items` (`drive_item_id`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `zernio_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`api_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `zernio_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`zernio_account_id` text NOT NULL,
	`zernio_profile_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`platform` text NOT NULL,
	`username` text,
	`display_name` text,
	`profile_picture` text,
	`profile_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`platform_status` text,
	`followers_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`zernio_account_id`) REFERENCES `zernio_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zernio_profile_id`) REFERENCES `zernio_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `zernio_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`zernio_account_id` text NOT NULL,
	`platform` text DEFAULT 'profile' NOT NULL,
	`profile_id` text NOT NULL,
	`profile_name` text,
	`profile_avatar` text,
	`is_default` integer DEFAULT 0,
	`color` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`zernio_account_id`) REFERENCES `zernio_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
